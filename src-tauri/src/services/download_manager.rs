use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{watch, RwLock, Semaphore};
use tracing::{info, warn};
use uuid::Uuid;

use crate::database::Database;
use crate::domain::pdf_workspace::{BulkDownloadSummary, DownloadJob, EnqueueDownloadInput};
use crate::errors::AppError;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::scrapers::url_guard::UrlGuard;
use crate::services::pdf_processor::PdfProcessor;
use crate::services::pdf_resolver::PdfResolverService;

pub struct DownloadManager {
    db: Option<Arc<Database>>,
    client: reqwest::Client,
    storage_dir: PathBuf,
    semaphore: Arc<Semaphore>,
    cancel_senders: Arc<RwLock<HashMap<String, watch::Sender<bool>>>>,
}

impl DownloadManager {
    const MAX_CONCURRENT_DOWNLOADS: usize = 3;
    const MAX_ALLOWED_PDF_BYTES: u64 = 100 * 1024 * 1024; // 100 MB

    pub fn new(db: Option<Arc<Database>>, storage_dir: PathBuf) -> Self {
        // Ensure storage directory exists
        let _ = fs::create_dir_all(&storage_dir);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    attempt.error("Too many redirects")
                } else {
                    let target_url = attempt.url().as_str();
                    if UrlGuard::validate_url(target_url).is_err() {
                        attempt
                            .error("Redirect to unauthorized or private host blocked (anti-SSRF)")
                    } else {
                        attempt.follow()
                    }
                }
            }))
            .build()
            .unwrap_or_default();

        Self {
            db,
            client,
            storage_dir,
            semaphore: Arc::new(Semaphore::new(Self::MAX_CONCURRENT_DOWNLOADS)),
            cancel_senders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn storage_dir(&self) -> &Path {
        &self.storage_dir
    }

    /// Recovers any downloads that were in-flight when the app previously shut down.
    pub fn recover_interrupted_jobs(&self) -> Result<usize, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::recover_interrupted_jobs(&conn).map_err(Into::into)
    }

    /// Enqueues a single PDF download.
    pub async fn enqueue(&self, input: EnqueueDownloadInput) -> Result<DownloadJob, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;

        // 1. Validate destination and URL
        let validated_url = UrlGuard::validate_url(&input.url)
            .map_err(|e| AppError::Validation(format!("Invalid download URL: {}", e)))?;

        // 2. Check if already active for this paper
        {
            let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(active) =
                PdfWorkspaceRepository::get_active_download_for_paper(&conn, &input.paper_id)?
            {
                return Ok(active);
            }
        }

        let job_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let job = DownloadJob {
            id: job_id.clone(),
            paper_id: input.paper_id.clone(),
            paper_title: input.paper_title.clone(),
            url: validated_url.to_string(),
            source_id: input.source_id.clone(),
            status: "queued".to_string(),
            bytes_downloaded: 0,
            total_bytes: 0,
            progress_percent: 0.0,
            stage_message: "Queued for download".to_string(),
            error_message: None,
            destination_path: None,
            sha256_hash: None,
            retry_count: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        // Persist initial job record
        {
            let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
            PdfWorkspaceRepository::create_download_job(&conn, &job)?;
        }

        // Setup cancellation channel
        let (cancel_tx, cancel_rx) = watch::channel(false);
        {
            let mut senders = self.cancel_senders.write().await;
            senders.insert(job_id.clone(), cancel_tx);
        }

        // Spawn background worker
        let db_clone = self.db.clone();
        let client_clone = self.client.clone();
        let storage_dir_clone = self.storage_dir.clone();
        let semaphore_clone = self.semaphore.clone();
        let cancel_senders_clone = self.cancel_senders.clone();
        let mut job_clone = job.clone();

        tokio::spawn(async move {
            Self::run_download_task(
                db_clone,
                client_clone,
                storage_dir_clone,
                semaphore_clone,
                cancel_senders_clone,
                &mut job_clone,
                cancel_rx,
            )
            .await;
        });

        Ok(job)
    }

    /// Enqueues a bulk download request across multiple paper IDs.
    pub async fn enqueue_bulk(
        &self,
        paper_ids: Vec<String>,
    ) -> Result<BulkDownloadSummary, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;

        let mut enqueued = 0;
        let mut skipped = 0;
        let mut failed = 0;
        let mut reasons = Vec::new();

        for pid in paper_ids {
            // Check if paper already has file
            let (title, direct_url, has_file): (String, Option<String>, bool) = {
                let conn = match db.lock() {
                    Ok(c) => c,
                    Err(e) => {
                        failed += 1;
                        reasons.push(format!("Lock error for {}: {}", pid, e));
                        continue;
                    }
                };

                let res = conn.query_row(
                    "SELECT title, pdf_url, has_file FROM papers WHERE id = ?1",
                    [&pid],
                    |r| {
                        let hf: i64 = r.get(2)?;
                        Ok((r.get(0)?, r.get(1)?, hf > 0))
                    },
                );

                match res {
                    Ok(tuple) => tuple,
                    Err(_) => {
                        failed += 1;
                        reasons.push(format!("Paper {} not found in library", pid));
                        continue;
                    }
                }
            };

            if has_file {
                skipped += 1;
                reasons.push(format!("'{}' already downloaded locally", title));
                continue;
            }

            // Resolve best download URL without holding connection across await
            let target_url = if let Some(url) = direct_url {
                Some(url)
            } else {
                match PdfResolverService::resolve_for_paper(db, &self.client, &pid).await {
                    Ok(res) => res.best_url,
                    Err(_) => None,
                }
            };

            if let Some(url) = target_url {
                match self
                    .enqueue(EnqueueDownloadInput {
                        paper_id: pid,
                        paper_title: title.clone(),
                        url,
                        source_id: "batch_retrieval".to_string(),
                    })
                    .await
                {
                    Ok(_) => enqueued += 1,
                    Err(e) => {
                        failed += 1;
                        reasons.push(format!("Enqueue failed for '{}': {}", title, e));
                    }
                }
            } else {
                skipped += 1;
                reasons.push(format!("No open-access PDF discovered for '{}'", title));
            }
        }

        Ok(BulkDownloadSummary {
            enqueued,
            skipped,
            failed,
            reasons,
        })
    }

    /// Cancels an active or queued download job.
    pub async fn cancel(&self, job_id: &str) -> Result<(), AppError> {
        let senders = self.cancel_senders.read().await;
        if let Some(tx) = senders.get(job_id) {
            let _ = tx.send(true);
        }

        if let Some(db) = &self.db {
            let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(mut job) = PdfWorkspaceRepository::get_download_job(&conn, job_id)? {
                if job.status == "queued" || job.status == "downloading" {
                    job.status = "cancelled".to_string();
                    job.stage_message = "Download cancelled by user".to_string();
                    job.updated_at = Utc::now().to_rfc3339();
                    PdfWorkspaceRepository::update_download_job(&conn, &job)?;
                }
            }
        }

        Ok(())
    }

    /// Retries a failed or cancelled download job.
    pub async fn retry(&self, job_id: &str) -> Result<DownloadJob, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let existing = {
            let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
            PdfWorkspaceRepository::get_download_job(&conn, job_id)?
                .ok_or_else(|| AppError::Validation(format!("Job {} not found", job_id)))?
        };

        self.enqueue(EnqueueDownloadInput {
            paper_id: existing.paper_id,
            paper_title: existing.paper_title,
            url: existing.url,
            source_id: existing.source_id,
        })
        .await
    }

    pub fn list_jobs(&self, limit: u32) -> Result<Vec<DownloadJob>, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::list_download_jobs(&conn, limit).map_err(Into::into)
    }

    pub fn clear_completed(&self) -> Result<usize, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::clear_completed_download_jobs(&conn).map_err(Into::into)
    }

    pub fn get_job(&self, job_id: &str) -> Result<Option<DownloadJob>, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::get_download_job(&conn, job_id).map_err(Into::into)
    }

    // ------------------------------------------------------------------------
    // Internal Download Worker Execution
    // ------------------------------------------------------------------------

    async fn run_download_task(
        db_opt: Option<Arc<Database>>,
        client: reqwest::Client,
        storage_dir: PathBuf,
        semaphore: Arc<Semaphore>,
        cancel_senders: Arc<RwLock<HashMap<String, watch::Sender<bool>>>>,
        job: &mut DownloadJob,
        mut cancel_rx: watch::Receiver<bool>,
    ) {
        // Wait for concurrency permit
        let _permit = match semaphore.acquire().await {
            Ok(p) => p,
            Err(_) => return,
        };

        // Check cancellation
        if *cancel_rx.borrow() {
            return;
        }

        // Update status to downloading
        job.status = "downloading".to_string();
        job.stage_message = "Connecting to academic source...".to_string();
        job.updated_at = Utc::now().to_rfc3339();
        Self::persist_job_update(&db_opt, job);

        let temp_filename = format!(".tmp_{}.part", job.id);
        let temp_path = storage_dir.join(&temp_filename);

        let result =
            Self::execute_stream_download(&client, job, &temp_path, &mut cancel_rx, &db_opt).await;

        match result {
            Ok((sha256, byte_count)) => {
                // Verify magic bytes & parse structural PDF metadata
                let meta = PdfProcessor::process_pdf_file(&temp_path);
                if meta.status == "corrupt" {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message =
                        "File corrupted: failed PDF structural verification".to_string();
                    job.error_message =
                        Some("Downloaded file failed PDF header and body validation".to_string());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    return;
                }

                // Canonical destination path: <storage_dir>/<paper_id>.pdf
                let final_filename = format!("{}.pdf", job.paper_id);
                let final_path = storage_dir.join(&final_filename);

                // Atomic rename/move
                if let Err(e) = fs::rename(&temp_path, &final_path) {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message = "Storage error moving temporary file".to_string();
                    job.error_message = Some(e.to_string());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    return;
                }

                // Update database: register file in paper_files and update paper record
                if let Some(ref db) = db_opt {
                    if let Ok(conn) = db.lock() {
                        let _ = PdfWorkspaceRepository::attach_downloaded_file(
                            &conn,
                            &job.paper_id,
                            &final_path.to_string_lossy(),
                            &final_filename,
                            byte_count,
                            &sha256,
                            if meta.page_count > 0 {
                                Some(meta.page_count)
                            } else {
                                None
                            },
                        );
                    }
                }

                job.status = "completed".to_string();
                job.bytes_downloaded = byte_count;
                job.total_bytes = byte_count;
                job.progress_percent = 100.0;
                job.sha256_hash = Some(sha256);
                job.destination_path = Some(final_path.to_string_lossy().to_string());
                job.stage_message = "Verified PDF downloaded and linked to library".to_string();
                job.error_message = None;
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                info!(paper_id = %job.paper_id, "PDF download completed and verified successfully");
            }
            Err(e) => {
                let _ = fs::remove_file(&temp_path);
                if *cancel_rx.borrow() {
                    job.status = "cancelled".to_string();
                    job.stage_message = "Download cancelled by user".to_string();
                } else {
                    job.status = "failed".to_string();
                    job.stage_message = format!("Download failed: {}", e);
                    job.error_message = Some(e.to_string());
                }
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                warn!(paper_id = %job.paper_id, error = %e, "PDF download task failed");
            }
        }

        // Clean cancel sender
        let mut senders = cancel_senders.write().await;
        senders.remove(&job.id);
    }

    async fn execute_stream_download(
        client: &reqwest::Client,
        job: &mut DownloadJob,
        temp_path: &Path,
        cancel_rx: &mut watch::Receiver<bool>,
        db_opt: &Option<Arc<Database>>,
    ) -> Result<(String, u64), AppError> {
        let req = client.get(&job.url).header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ResearchPaperScraper/0.1.0 (PDFDownloader)",
        );

        let mut resp = req
            .send()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(AppError::Network(format!(
                "Server returned HTTP {}",
                resp.status()
            )));
        }

        let total_size = resp.content_length().unwrap_or(0);
        if total_size > Self::MAX_ALLOWED_PDF_BYTES {
            return Err(AppError::Validation(format!(
                "PDF size ({} MB) exceeds maximum allowed limit ({} MB)",
                total_size / 1024 / 1024,
                Self::MAX_ALLOWED_PDF_BYTES / 1024 / 1024
            )));
        }

        job.total_bytes = total_size;
        job.stage_message = "Transferring PDF stream...".to_string();
        Self::persist_job_update(db_opt, job);

        let mut file = File::create(temp_path).map_err(|e| AppError::Storage(e.to_string()))?;
        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();
        let mut first_chunk = true;
        let mut last_progress_report = 0u64;

        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
        {
            if *cancel_rx.borrow() {
                return Err(AppError::Validation("Download cancelled".to_string()));
            }

            let chunk_bytes = chunk.as_ref();

            // Validate PDF Magic Bytes in first chunk
            if first_chunk {
                first_chunk = false;
                if chunk_bytes.len() >= 4 {
                    let header = &chunk_bytes[..std::cmp::min(1024, chunk_bytes.len())];
                    let header_str = String::from_utf8_lossy(header);
                    if !header_str.contains("%PDF-") {
                        return Err(AppError::Validation(
                            "Server returned non-PDF content (likely an HTML paywall or error page)".to_string(),
                        ));
                    }
                }
            }

            file.write_all(chunk_bytes)
                .map_err(|e| AppError::Storage(e.to_string()))?;
            hasher.update(chunk_bytes);
            downloaded += chunk_bytes.len() as u64;

            if downloaded > Self::MAX_ALLOWED_PDF_BYTES {
                return Err(AppError::Validation(
                    "Download exceeded maximum size limit".to_string(),
                ));
            }

            // Periodic progress update (every ~256 KB)
            if downloaded - last_progress_report >= 256 * 1024 {
                last_progress_report = downloaded;
                job.bytes_downloaded = downloaded;
                if total_size > 0 {
                    job.progress_percent = (downloaded as f64 / total_size as f64) * 100.0;
                }
                Self::persist_job_update(db_opt, job);
            }
        }

        file.flush().map_err(|e| AppError::Storage(e.to_string()))?;
        let sha256 = format!("{:x}", hasher.finalize());

        if downloaded == 0 {
            return Err(AppError::Validation(
                "Zero-byte empty file received".to_string(),
            ));
        }

        Ok((sha256, downloaded))
    }

    fn persist_job_update(db_opt: &Option<Arc<Database>>, job: &DownloadJob) {
        if let Some(db) = db_opt {
            if let Ok(conn) = db.lock() {
                let _ = PdfWorkspaceRepository::update_download_job(&conn, job);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_manager_recovery() {
        let db = Arc::new(Database::open_in_memory().unwrap());
        let temp_dir = std::env::temp_dir().join(format!("test_dl_{}", Uuid::new_v4()));
        let manager = DownloadManager::new(Some(db.clone()), temp_dir.clone());

        {
            let conn = db.lock().unwrap();
            conn.execute(
                "INSERT INTO papers (id, title, clean_title_key, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                rusqlite::params!["paper-rec", "Attention Is All You Need", "attention is all you need"],
            ).unwrap();

            let job = DownloadJob {
                id: "job-rec-1".to_string(),
                paper_id: "paper-rec".to_string(),
                paper_title: "Attention Is All You Need".to_string(),
                url: "https://arxiv.org/pdf/1706.03762.pdf".to_string(),
                source_id: "arxiv".to_string(),
                status: "downloading".to_string(),
                bytes_downloaded: 50000,
                total_bytes: 100000,
                progress_percent: 50.0,
                stage_message: "Downloading...".to_string(),
                error_message: None,
                destination_path: None,
                sha256_hash: None,
                retry_count: 0,
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:01Z".to_string(),
            };
            PdfWorkspaceRepository::create_download_job(&conn, &job).unwrap();
        }

        let recovered = manager.recover_interrupted_jobs().unwrap();
        assert_eq!(recovered, 1);

        let jobs = manager.list_jobs(10).unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].status, "failed");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
