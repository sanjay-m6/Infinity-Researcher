use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::{watch, Mutex, RwLock, Semaphore};
use tracing::{info, warn};
use uuid::Uuid;

use crate::database::Database;
use crate::domain::pdf_workspace::{
    BulkDownloadSummary, CleanOrphanedResult, DownloadJob, DownloadStorageMetrics,
    EnqueueDownloadInput,
};
use crate::errors::AppError;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::scrapers::url_guard::UrlGuard;
use crate::services::candidate_verifier::CandidateVerifier;
use crate::services::pdf_processor::PdfProcessor;
use crate::services::pdf_resolver::PdfResolverService;

pub struct DownloadManager {
    db: Option<Arc<Database>>,
    client: reqwest::Client,
    storage_dir: PathBuf,
    semaphore: Arc<Semaphore>,
    cancel_senders: Arc<RwLock<HashMap<String, watch::Sender<bool>>>>,
    domain_rate_limiter: Arc<Mutex<HashMap<String, tokio::time::Instant>>>,
    app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
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
            domain_rate_limiter: Arc::new(Mutex::new(HashMap::new())),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Sets the Tauri AppHandle for streaming real-time download events to the UI
    pub async fn set_app_handle(&self, handle: tauri::AppHandle) {
        let mut w = self.app_handle.write().await;
        *w = Some(handle);
    }

    fn emit_event(
        app_handle: &Arc<RwLock<Option<tauri::AppHandle>>>,
        event_name: &str,
        job: &DownloadJob,
    ) {
        if let Ok(guard) = app_handle.try_read() {
            if let Some(ref app) = *guard {
                let _ = app.emit(event_name, job);
            }
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
            speed_bps: Some(0),
            started_at: None,
            completed_at: None,
            error_category: None,
            version_type: input.version_type,
            identity_status: Some("unknown".to_string()),
            identity_score: Some(0.0),
            identity_notes: None,
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

        Self::emit_event(&self.app_handle, "paper:download_started", &job);

        // Spawn background worker
        let db_clone = self.db.clone();
        let client_clone = self.client.clone();
        let storage_dir_clone = self.storage_dir.clone();
        let semaphore_clone = self.semaphore.clone();
        let cancel_senders_clone = self.cancel_senders.clone();
        let domain_rate_limiter_clone = self.domain_rate_limiter.clone();
        let app_handle_clone = self.app_handle.clone();
        let mut job_clone = job.clone();

        tokio::spawn(async move {
            Self::run_download_task(
                db_clone,
                client_clone,
                storage_dir_clone,
                semaphore_clone,
                cancel_senders_clone,
                domain_rate_limiter_clone,
                app_handle_clone,
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
                        version_type: None,
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
                if job.status == "queued"
                    || job.status == "resolving"
                    || job.status == "downloading"
                    || job.status == "validating"
                {
                    job.status = "cancelled".to_string();
                    job.stage_message = "Download cancelled by user".to_string();
                    job.error_category = Some("cancelled".to_string());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.speed_bps = Some(0);
                    job.updated_at = Utc::now().to_rfc3339();
                    PdfWorkspaceRepository::update_download_job(&conn, &job)?;
                    Self::emit_event(&self.app_handle, "paper:download_cancelled", &job);
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
            version_type: existing.version_type,
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

    pub fn delete_job(&self, job_id: &str) -> Result<usize, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::delete_download_job(&conn, job_id).map_err(Into::into)
    }

    pub fn get_job(&self, job_id: &str) -> Result<Option<DownloadJob>, AppError> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database unavailable".to_string()))?;
        let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        PdfWorkspaceRepository::get_download_job(&conn, job_id).map_err(Into::into)
    }

    /// Computes accurate filesystem storage metrics for downloaded PDFs and temporary parts.
    pub fn get_storage_metrics(&self) -> Result<DownloadStorageMetrics, AppError> {
        let mut total_bytes = 0u64;
        let mut pdf_count = 0usize;
        let mut temp_files_count = 0usize;
        let mut temp_files_bytes = 0u64;

        if let Ok(entries) = fs::read_dir(&self.storage_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let file_name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        let size = meta.len();
                        if file_name.ends_with(".pdf") {
                            pdf_count += 1;
                            total_bytes += size;
                        } else if file_name.ends_with(".part") || file_name.starts_with(".tmp_") {
                            temp_files_count += 1;
                            temp_files_bytes += size;
                        }
                    }
                }
            }
        }

        Ok(DownloadStorageMetrics {
            storage_path: self.storage_dir.to_string_lossy().to_string(),
            total_bytes,
            pdf_count,
            temp_files_count,
            temp_files_bytes,
        })
    }

    /// Safely purges orphaned `.part` and `.tmp_` files not tied to currently active jobs.
    /// NEVER touches `.pdf` files or user research library assets.
    pub async fn clean_orphaned_downloads(&self) -> Result<CleanOrphanedResult, AppError> {
        let mut files_deleted = 0usize;
        let mut bytes_freed = 0u64;

        let active_senders = self.cancel_senders.read().await;

        if let Ok(entries) = fs::read_dir(&self.storage_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                let lower_name = file_name.to_lowercase();
                // Strictly target ONLY temporary part files
                if lower_name.ends_with(".part") || lower_name.starts_with(".tmp_") {
                    let is_active = active_senders.keys().any(|job_id| file_name.contains(job_id));
                    if !is_active {
                        if let Ok(meta) = entry.metadata() {
                            let size = meta.len();
                            if fs::remove_file(&path).is_ok() {
                                files_deleted += 1;
                                bytes_freed += size;
                            }
                        }
                    }
                }
            }
        }

        Ok(CleanOrphanedResult {
            files_deleted,
            bytes_freed,
        })
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
        domain_rate_limiter: Arc<Mutex<HashMap<String, tokio::time::Instant>>>,
        app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
        job: &mut DownloadJob,
        mut cancel_rx: watch::Receiver<bool>,
    ) {
        // State transition: resolving
        job.status = "resolving".to_string();
        job.stage_message = "Waiting for concurrency slot and source connection...".to_string();
        job.updated_at = Utc::now().to_rfc3339();
        Self::persist_job_update(&db_opt, job);
        Self::emit_event(&app_handle, "paper:download_progress", job);

        // Wait for concurrency permit
        let _permit = match semaphore.acquire().await {
            Ok(p) => p,
            Err(_) => return,
        };

        // Check cancellation
        if *cancel_rx.borrow() {
            job.status = "cancelled".to_string();
            job.stage_message = "Download cancelled before connecting".to_string();
            job.error_category = Some("cancelled".to_string());
            job.completed_at = Some(Utc::now().to_rfc3339());
            job.updated_at = Utc::now().to_rfc3339();
            Self::persist_job_update(&db_opt, job);
            Self::emit_event(&app_handle, "paper:download_cancelled", job);
            let mut senders = cancel_senders.write().await;
            senders.remove(&job.id);
            return;
        }

        // Update status to downloading
        job.status = "downloading".to_string();
        job.stage_message = "Connecting to academic source...".to_string();
        job.started_at = Some(Utc::now().to_rfc3339());
        job.updated_at = Utc::now().to_rfc3339();
        Self::persist_job_update(&db_opt, job);
        Self::emit_event(&app_handle, "paper:download_started", job);

        let temp_filename = format!(".tmp_{}.part", job.id);
        let temp_path = storage_dir.join(&temp_filename);

        let mut result = Self::execute_stream_download(
            &client,
            job,
            &temp_path,
            &mut cancel_rx,
            &db_opt,
            &domain_rate_limiter,
            &app_handle,
        )
        .await;

        // If primary stream failed and user hasn't cancelled, fall back to alternative discovered candidates
        if result.is_err() && !*cancel_rx.borrow() {
            let alt_candidates: Vec<(String, String)> = if let Some(ref db) = db_opt {
                if let Ok(conn) = db.lock() {
                    PdfWorkspaceRepository::get_pdf_candidates(&conn, &job.paper_id)
                        .unwrap_or_default()
                        .into_iter()
                        .filter(|c| c.url != job.url)
                        .map(|c| (c.url, c.provider_id))
                        .collect()
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            for (alt_url, alt_provider) in alt_candidates {
                if *cancel_rx.borrow() {
                    break;
                }
                let _ = fs::remove_file(&temp_path);
                job.stage_message = format!("Primary source failed. Falling back to alternative mirror ({})", alt_provider);
                job.url = alt_url;
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                Self::emit_event(&app_handle, "paper:download_progress", job);

                result = Self::execute_stream_download(
                    &client,
                    job,
                    &temp_path,
                    &mut cancel_rx,
                    &db_opt,
                    &domain_rate_limiter,
                    &app_handle,
                )
                .await;

                if result.is_ok() {
                    info!(paper_id = %job.paper_id, provider = %alt_provider, "Download succeeded via alternative candidate mirror");
                    break;
                }
            }
        }

        match result {
            Ok((sha256, byte_count)) => {
                // Transition to validating
                job.status = "validating".to_string();
                job.stage_message = "Verifying PDF signature and structure...".to_string();
                job.speed_bps = Some(0);
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                Self::emit_event(&app_handle, "paper:download_progress", job);

                // Reject trivially small files (< 1024 bytes)
                if byte_count < 1024 {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message =
                        "File too small (< 1KB) to be a valid academic paper".to_string();
                    job.error_message =
                        Some("Downloaded payload failed minimum PDF size requirements".to_string());
                    job.error_category = Some("corrupt_pdf".to_string());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    Self::emit_event(&app_handle, "paper:download_failed", job);
                    return;
                }

                // Verify magic bytes & parse structural PDF metadata
                let mut meta = PdfProcessor::process_pdf_file(&temp_path);
                if meta.status == "corrupt" {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message =
                        "File corrupted: failed PDF structural verification".to_string();
                    job.error_message =
                        Some("Downloaded file failed PDF header and body validation".to_string());
                    job.error_category = Some("corrupt_pdf".to_string());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    Self::emit_event(&app_handle, "paper:download_failed", job);
                    return;
                }

                // Transition to verifying_identity
                job.status = "verifying_identity".to_string();
                job.stage_message =
                    "Verifying document identity against publication metadata...".to_string();
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                Self::emit_event(&app_handle, "paper:download_progress", job);

                // Fetch expected paper attributes for identity reconciliation
                let (expected_title, expected_doi, expected_authors) = if let Some(ref db) = db_opt {
                    if let Ok(conn) = db.lock() {
                        let info: std::result::Result<(String, Option<String>), _> = conn.query_row(
                            "SELECT title, canonical_doi FROM papers WHERE id = ?1",
                            [&job.paper_id],
                            |r| Ok((r.get(0)?, r.get(1)?)),
                        );
                        let (t, d) = info.unwrap_or_else(|_| (job.paper_title.clone(), None));
                        let mut authors = Vec::new();
                        if let Ok(mut stmt) = conn.prepare(
                            "SELECT a.name FROM paper_authors pa JOIN authors a ON pa.author_id = a.id WHERE pa.paper_id = ?1 ORDER BY pa.position"
                        ) {
                            if let Ok(rows) = stmt.query_map([&job.paper_id], |r| r.get::<_, String>(0)) {
                                for a in rows.flatten() {
                                    authors.push(a);
                                }
                            }
                        }
                        (t, d, authors)
                    } else {
                        (job.paper_title.clone(), None, Vec::new())
                    }
                } else {
                    (job.paper_title.clone(), None, Vec::new())
                };

                let _ = PdfProcessor::reconcile_identity(
                    &mut meta,
                    &expected_title,
                    &expected_authors,
                    expected_doi.as_deref(),
                );

                job.version_type = meta.version_type.clone().or_else(|| job.version_type.clone());
                job.identity_status = Some(meta.identity_status.clone());
                job.identity_score = Some(meta.identity_score);
                job.identity_notes = meta.reconciliation_notes.clone();

                // Check identity status rejection criteria
                if meta.identity_status == "wrong_document" {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message =
                        "Wrong document: extracted PDF content does not match requested publication".to_string();
                    job.error_message = Some(format!(
                        "Identity mismatch: {}",
                        meta.reconciliation_notes.as_deref().unwrap_or("wrong document")
                    ));
                    job.error_category = Some("wrong_document".to_string());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    Self::emit_event(&app_handle, "paper:download_failed", job);
                    warn!(paper_id = %job.paper_id, "Rejected wrong document download");
                    return;
                }

                if meta.identity_status == "invalid_pdf" || meta.identity_status == "encrypted_pdf" {
                    let _ = fs::remove_file(&temp_path);
                    job.status = "failed".to_string();
                    job.stage_message = format!("Document verification rejected: {}", meta.identity_status);
                    job.error_message = meta.reconciliation_notes.clone();
                    job.error_category = Some(meta.identity_status.clone());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    Self::emit_event(&app_handle, "paper:download_failed", job);
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
                    job.error_category = Some("storage".to_string());
                    job.completed_at = Some(Utc::now().to_rfc3339());
                    job.updated_at = Utc::now().to_rfc3339();
                    Self::persist_job_update(&db_opt, job);
                    Self::emit_event(&app_handle, "paper:download_failed", job);
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
                            job.version_type.as_deref(),
                            job.identity_status.as_deref(),
                            job.identity_score,
                            job.identity_notes.as_deref(),
                        );
                    }
                }

                job.status = "completed".to_string();
                job.bytes_downloaded = byte_count;
                job.total_bytes = byte_count;
                job.progress_percent = 100.0;
                job.speed_bps = Some(0);
                job.sha256_hash = Some(sha256);
                job.destination_path = Some(final_path.to_string_lossy().to_string());
                job.stage_message = if meta.identity_status == "identity_uncertain" {
                    "Downloaded PDF; identity uncertain (preserved for user review)".to_string()
                } else {
                    format!(
                        "Verified {} downloaded and linked to library",
                        job.version_type.as_deref().unwrap_or("document")
                    )
                };
                job.error_message = None;
                job.error_category = None;
                job.completed_at = Some(Utc::now().to_rfc3339());
                job.updated_at = Utc::now().to_rfc3339();
                Self::persist_job_update(&db_opt, job);
                Self::emit_event(&app_handle, "paper:download_completed", job);
                info!(paper_id = %job.paper_id, "PDF download completed and verified successfully");
            }
            Err(e) => {
                let _ = fs::remove_file(&temp_path);
                let err_str = e.to_string();
                job.speed_bps = Some(0);
                job.completed_at = Some(Utc::now().to_rfc3339());
                if *cancel_rx.borrow() || err_str.contains("Download cancelled") {
                    job.status = "cancelled".to_string();
                    job.stage_message = "Download cancelled by user".to_string();
                    job.error_category = Some("cancelled".to_string());
                    Self::emit_event(&app_handle, "paper:download_cancelled", job);
                } else {
                    let category = if err_str.contains("anti-SSRF") || err_str.contains("private host") {
                        "anti_ssrf"
                    } else if err_str.contains("HTML paywall") || err_str.contains("non-PDF content") {
                        "html_paywall"
                    } else if err_str.contains("exceeded maximum size") || err_str.contains("exceeds maximum allowed") {
                        "size_limit"
                    } else if err_str.contains("corrupt") || err_str.contains("header") {
                        "corrupt_pdf"
                    } else if err_str.contains("Storage error") {
                        "storage"
                    } else {
                        "network"
                    };
                    job.status = "failed".to_string();
                    job.stage_message = format!("Download failed: {}", e);
                    job.error_message = Some(err_str);
                    job.error_category = Some(category.to_string());
                    Self::emit_event(&app_handle, "paper:download_failed", job);
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
        domain_rate_limiter: &Arc<Mutex<HashMap<String, tokio::time::Instant>>>,
        app_handle: &Arc<RwLock<Option<tauri::AppHandle>>>,
    ) -> Result<(String, u64), AppError> {
        let mut download_url = job.url.clone();
        let mut referer = if download_url.contains("ieee.org") {
            "https://ieeexplore.ieee.org/".to_string()
        } else {
            download_url.clone()
        };

        // If the URL is an IEEE paper, resolve the direct ielx/xplorestaging PDF stream
        if crate::scrapers::ieee_fetcher::is_ieee_target(&download_url, None) {
            job.stage_message = "Resolving IEEE Open Access PDF stream...".to_string();
            Self::persist_job_update(db_opt, job);
            Self::emit_event(app_handle, "paper:download_progress", job);

            if let Ok(resolved_url) = crate::scrapers::ieee_fetcher::resolve_ieee_direct_pdf_url(
                &download_url,
                None,
                Some(&job.paper_title),
                client,
            )
            .await
            {
                referer = "https://ieeexplore.ieee.org/".to_string();
                download_url = resolved_url;
            }
        }

        // Enforce per-domain polite rate pacing
        let domain = url::Url::parse(&download_url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
            .unwrap_or_default();

        if !domain.is_empty() {
            let min_delay = if domain.contains("arxiv.org") {
                Duration::from_millis(1000)
            } else if domain.contains("biorxiv.org") || domain.contains("medrxiv.org") {
                Duration::from_millis(1000)
            } else if domain.contains("ieee.org") {
                Duration::from_millis(1000)
            } else if domain.contains("crossref.org") || domain.contains("unpaywall.org") {
                Duration::from_millis(600)
            } else {
                Duration::from_millis(400)
            };

            let wait_opt = {
                let mut limiter = domain_rate_limiter.lock().await;
                let now = tokio::time::Instant::now();
                if let Some(last) = limiter.get(&domain) {
                    let elapsed = now.duration_since(*last);
                    if elapsed < min_delay {
                        Some(min_delay - elapsed)
                    } else {
                        limiter.insert(domain.clone(), now);
                        None
                    }
                } else {
                    limiter.insert(domain.clone(), now);
                    None
                }
            };

            if let Some(delay) = wait_opt {
                tokio::time::sleep(delay).await;
                let mut limiter = domain_rate_limiter.lock().await;
                limiter.insert(domain, tokio::time::Instant::now());
            }
        }

        let req = client
            .get(&download_url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .header(
                "Accept",
                "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
            )
            .header("Referer", referer);

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
        Self::emit_event(app_handle, "paper:download_progress", job);

        let mut file = File::create(temp_path).map_err(|e| AppError::Storage(e.to_string()))?;
        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();
        let mut first_chunk = true;
        let mut last_progress_report = 0u64;
        let mut last_instant = tokio::time::Instant::now();
        let mut last_speed_bytes = 0u64;

        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
        {
            if *cancel_rx.borrow() {
                return Err(AppError::Validation("Download cancelled".to_string()));
            }

            let chunk_bytes = chunk.as_ref();

            // Validate PDF Magic Bytes in first chunk using BOM/comment-tolerant validator
            if first_chunk {
                first_chunk = false;
                if chunk_bytes.len() >= 4 {
                    let header = &chunk_bytes[..std::cmp::min(1024, chunk_bytes.len())];
                    if !CandidateVerifier::has_valid_pdf_magic_bytes(header) {
                        return Err(AppError::Validation(
                            "Server returned non-PDF content (likely an HTML paywall or access challenge)".to_string(),
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

            // Periodic progress update (every ~256 KB or at least 300ms)
            let now = tokio::time::Instant::now();
            let elapsed = now.duration_since(last_instant).as_secs_f64();
            if downloaded - last_progress_report >= 256 * 1024 || elapsed >= 0.3 {
                let speed = if elapsed > 0.05 {
                    ((downloaded - last_speed_bytes) as f64 / elapsed) as u64
                } else {
                    0
                };
                last_speed_bytes = downloaded;
                last_instant = now;
                last_progress_report = downloaded;
                job.bytes_downloaded = downloaded;
                job.speed_bps = Some(speed);
                if total_size > 0 {
                    job.progress_percent = (downloaded as f64 / total_size as f64) * 100.0;
                }
                Self::persist_job_update(db_opt, job);
                Self::emit_event(app_handle, "paper:download_progress", job);
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
                speed_bps: Some(0),
                version_type: Some("preprint".to_string()),
                identity_status: Some("verified_match".to_string()),
                identity_score: Some(1.0),
                identity_notes: None,
                started_at: None,
                completed_at: None,
                error_category: None,
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
        assert_eq!(jobs[0].error_category.as_deref(), Some("interrupted"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_storage_metrics_and_cleanup() {
        let temp_dir = std::env::temp_dir().join(format!("test_dl_metrics_{}", Uuid::new_v4()));
        let manager = DownloadManager::new(None, temp_dir.clone());

        // Create a fake PDF file
        let pdf_path = temp_dir.join("paper-123.pdf");
        fs::write(&pdf_path, b"%PDF-1.4 test content").unwrap();

        // Create an orphaned temp file
        let orphaned_path = temp_dir.join(".tmp_orphaned_job.part");
        fs::write(&orphaned_path, b"incomplete content").unwrap();

        let metrics = manager.get_storage_metrics().unwrap();
        assert_eq!(metrics.pdf_count, 1);
        assert!(metrics.total_bytes > 0);
        assert_eq!(metrics.temp_files_count, 1);
        assert!(metrics.temp_files_bytes > 0);

        // Run cleanup
        let cleaned = manager.clean_orphaned_downloads().await.unwrap();
        assert_eq!(cleaned.files_deleted, 1);
        assert!(cleaned.bytes_freed > 0);

        // Verify PDF still exists and was not touched
        assert!(pdf_path.exists());
        assert!(!orphaned_path.exists());

        let after_metrics = manager.get_storage_metrics().unwrap();
        assert_eq!(after_metrics.pdf_count, 1);
        assert_eq!(after_metrics.temp_files_count, 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
