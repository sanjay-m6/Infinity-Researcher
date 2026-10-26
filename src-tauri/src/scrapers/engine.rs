use crate::academic_sources::ImportSummary;
use crate::database::Database;
use crate::domain::crawl::{
    CrawlJobPaper, CrawlJobStatus, CrawlProfile, CrawlQueueItemStatus, ExtractionPreviewResult,
};
use crate::domain::paper::PaperCreateInput;
use crate::repositories::CrawlRepository;
use crate::scrapers::extractor::HtmlExtractor;
use crate::scrapers::robots::RobotsCache;
use crate::scrapers::url_guard::UrlGuard;
use crate::services::PaperService;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Notify, RwLock};
use tracing::{error, info, warn};

pub struct JobController {
    pub is_cancelled: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub pause_notifier: Arc<Notify>,
}

#[derive(Clone)]
pub struct CrawlEngine {
    http_client: reqwest::Client,
    robots_cache: RobotsCache,
    job_controls: Arc<RwLock<HashMap<String, Arc<JobController>>>>,
}

impl Default for CrawlEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl CrawlEngine {
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    attempt.error("Too many redirects")
                } else if let Ok(url) = UrlGuard::validate_url(attempt.url().as_str()) {
                    let _ = url;
                    attempt.follow()
                } else {
                    attempt
                        .error("Redirect to private or disallowed URL blocked by Anti-SSRF guard")
                }
            }))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            http_client,
            robots_cache: RobotsCache::new(),
            job_controls: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Maximum response body size for HTML pages (10 MB) to prevent resource exhaustion / DoS
    pub const MAX_RESPONSE_BODY_BYTES: usize = 10 * 1024 * 1024;

    /// Reads an HTTP response body with streaming bounds to defend against decompression bombs and unbounded streams.
    pub async fn read_response_body_bounded(mut resp: reqwest::Response) -> Result<String, String> {
        if let Some(content_length) = resp.content_length() {
            if content_length > Self::MAX_RESPONSE_BODY_BYTES as u64 {
                return Err(format!(
                    "Response body exceeds maximum allowed size ({} bytes > {} bytes)",
                    content_length,
                    Self::MAX_RESPONSE_BODY_BYTES
                ));
            }
        }

        let mut bytes = Vec::new();
        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| format!("Error streaming response body: {e}"))?
        {
            if bytes.len() + chunk.len() > Self::MAX_RESPONSE_BODY_BYTES {
                return Err(format!(
                    "Streamed response exceeded maximum allowed limit of {} bytes",
                    Self::MAX_RESPONSE_BODY_BYTES
                ));
            }
            bytes.extend_from_slice(&chunk);
        }

        String::from_utf8(bytes).map_err(|e| format!("Response body contains invalid UTF-8: {e}"))
    }

    /// Previews metadata and paper link extraction for a single URL without launching a background crawl.
    pub async fn preview_url(
        &self,
        raw_url: &str,
        profile: Option<&CrawlProfile>,
    ) -> Result<ExtractionPreviewResult, String> {
        let validated_url = UrlGuard::validate_url(raw_url).map_err(|e| e.to_string())?;

        if let Some(prof) = profile {
            UrlGuard::matches_domain(&validated_url, &prof.domain).map_err(|e| e.to_string())?;
            UrlGuard::matches_patterns(
                validated_url.as_str(),
                &prof.allowed_patterns,
                &prof.disallowed_patterns,
            )
            .map_err(|e| e.to_string())?;
        }

        let user_agent = "ResearchPaperScraper/1.0 (+https://github.com/sanja/paper-scraper)";
        let resp = self
            .http_client
            .get(validated_url.as_str())
            .header("User-Agent", user_agent)
            .send()
            .await
            .map_err(|e| format!("HTTP request error: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!(
                "HTTP error {}: {}",
                resp.status(),
                resp.status().canonical_reason().unwrap_or("")
            ));
        }

        let html = Self::read_response_body_bounded(resp).await?;
        let preview = HtmlExtractor::extract(&html, validated_url.as_str(), profile);
        Ok(preview)
    }

    /// Starts or resumes a persistent background crawl job.
    pub async fn start_crawl_job(
        &self,
        db: Arc<Database>,
        job_id: String,
        profile: CrawlProfile,
    ) -> Result<(), String> {
        let is_cancelled = Arc::new(AtomicBool::new(false));
        let is_paused = Arc::new(AtomicBool::new(false));
        let pause_notifier = Arc::new(Notify::new());

        let controller = Arc::new(JobController {
            is_cancelled: is_cancelled.clone(),
            is_paused: is_paused.clone(),
            pause_notifier: pause_notifier.clone(),
        });

        {
            let mut controls = self.job_controls.write().await;
            controls.insert(job_id.clone(), controller.clone());
        }

        // Spawn async background worker
        let engine = self.clone();
        tokio::spawn(async move {
            engine
                .run_crawl_worker(db, job_id, profile, controller)
                .await;
        });

        Ok(())
    }

    /// Pauses an ongoing crawl job.
    pub async fn pause_crawl_job(&self, db: &Database, job_id: &str) -> Result<(), String> {
        let controls = self.job_controls.read().await;
        if let Some(ctrl) = controls.get(job_id) {
            ctrl.is_paused.store(true, Ordering::SeqCst);
            if let Ok(conn) = db.lock() {
                let _ =
                    CrawlRepository::update_job_status(&conn, job_id, CrawlJobStatus::Paused, None);
            }
            Ok(())
        } else {
            Err(format!("No running job found with ID {job_id}"))
        }
    }

    /// Resumes a paused crawl job.
    pub async fn resume_crawl_job(
        &self,
        db: Arc<Database>,
        job_id: &str,
        profile: CrawlProfile,
    ) -> Result<(), String> {
        let controls = self.job_controls.read().await;
        if let Some(ctrl) = controls.get(job_id) {
            ctrl.is_paused.store(false, Ordering::SeqCst);
            ctrl.pause_notifier.notify_waiters();
            if let Ok(conn) = db.lock() {
                let _ = CrawlRepository::update_job_status(
                    &conn,
                    job_id,
                    CrawlJobStatus::Running,
                    None,
                );
            }
            Ok(())
        } else {
            // If worker was terminated or restart occurred, restart background worker
            self.start_crawl_job(db, job_id.to_string(), profile).await
        }
    }

    /// Cancels a running or paused crawl job.
    pub async fn cancel_crawl_job(&self, db: &Database, job_id: &str) -> Result<(), String> {
        let controls = self.job_controls.read().await;
        if let Some(ctrl) = controls.get(job_id) {
            ctrl.is_cancelled.store(true, Ordering::SeqCst);
            ctrl.pause_notifier.notify_waiters();
        }

        if let Ok(conn) = db.lock() {
            let _ = CrawlRepository::update_job_status(
                &conn,
                job_id,
                CrawlJobStatus::Cancelled,
                Some("Crawl cancelled by user"),
            );
        }

        Ok(())
    }

    /// Imports papers discovered during a crawl job into the permanent library.
    pub fn import_crawled_papers(
        &self,
        db: &Database,
        job_id: &str,
        paper_ids: Option<Vec<String>>,
        target_collection_id: Option<String>,
    ) -> Result<ImportSummary, String> {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let crawled = CrawlRepository::list_crawled_papers_for_job(&conn, job_id)
            .map_err(|e| format!("Database error listing crawled papers: {e}"))?;
        drop(conn);

        let filtered: Vec<CrawlJobPaper> = match paper_ids {
            Some(ids) => crawled
                .into_iter()
                .filter(|p| ids.contains(&p.id))
                .collect(),
            None => crawled,
        };

        if filtered.is_empty() {
            return Ok(ImportSummary {
                added: 0,
                already_present: 0,
                updated: 0,
                failed: 0,
                errors: Vec::new(),
            });
        }

        let mut summary = ImportSummary {
            added: 0,
            already_present: 0,
            updated: 0,
            failed: 0,
            errors: Vec::new(),
        };

        for cp in &filtered {
            let authors = if cp.authors.is_empty() {
                vec!["Unknown Author".to_string()]
            } else {
                cp.authors.clone()
            };

            let year = cp
                .publication_date
                .as_deref()
                .and_then(|d| d.split('-').next())
                .and_then(|y| y.parse::<i32>().ok());

            let input = PaperCreateInput {
                title: cp.title.clone(),
                canonical_doi: cp.canonical_doi.clone(),
                abstract_text: cp.abstract_text.clone(),
                publication_date: cp.publication_date.clone(),
                publication_year: year,
                venue: cp.venue.clone(),
                venue_type: None,
                language: Some("en".to_string()),
                is_open_access: Some(true),
                primary_landing_url: Some(cp.url.clone()),
                pdf_url: cp.pdf_url.clone(),
                is_saved: Some(true),
                reading_status: None,
                reading_progress: None,
                open_access_status: Some("verified_open_access".to_string()),
                access_evidence_type: Some("explicit_source_label".to_string()),
                access_evidence_note: Some("Imported from website crawl job".to_string()),
                license_name: None,
                license_url: None,
                source_name: Some("Web Crawl".to_string()),
                retrieval_method: Some("permitted_html_connector".to_string()),
                access_confirmed_at: Some(chrono::Utc::now().to_rfc3339()),
                authors,
                collection_ids: target_collection_id.as_ref().map(|id| vec![id.clone()]),
                tags: None,
                source_id: None,
            };

            match PaperService::create_paper(db, input) {
                Ok(paper) => {
                    summary.added += 1;
                    if let Ok(conn) = db.lock() {
                        let _ =
                            CrawlRepository::mark_crawled_paper_imported(&conn, &cp.id, &paper.id);
                    }
                }
                Err(crate::errors::AppError::Validation(msg)) if msg.contains("already exists") => {
                    summary.already_present += 1;
                    if let Ok(conn) = db.lock() {
                        let _ = CrawlRepository::mark_crawled_paper_imported(&conn, &cp.id, &cp.id);
                    }
                }
                Err(e) => {
                    summary.failed += 1;
                    summary.errors.push(format!("{}: {}", cp.title, e));
                }
            }
        }

        Ok(summary)
    }

    /// Background worker loop processing queue items.
    async fn run_crawl_worker(
        &self,
        db: Arc<Database>,
        job_id: String,
        profile: CrawlProfile,
        ctrl: Arc<JobController>,
    ) {
        info!(job_id = %job_id, profile = %profile.name, "Starting website crawl worker");

        // Mark job running in DB
        if let Ok(conn) = db.lock() {
            let _ =
                CrawlRepository::update_job_status(&conn, &job_id, CrawlJobStatus::Running, None);
        }

        let user_agent = "ResearchPaperScraper/1.0 (+https://github.com/sanja/paper-scraper)";
        let base_delay = Duration::from_millis(profile.request_delay_ms.max(500) as u64);

        loop {
            // Check cancellation
            if ctrl.is_cancelled.load(Ordering::SeqCst) {
                info!(job_id = %job_id, "Crawl worker detected cancellation flag");
                if let Ok(conn) = db.lock() {
                    let _ = CrawlRepository::update_job_status(
                        &conn,
                        &job_id,
                        CrawlJobStatus::Cancelled,
                        Some("Cancelled by user"),
                    );
                }
                break;
            }

            // Check pause
            if ctrl.is_paused.load(Ordering::SeqCst) {
                info!(job_id = %job_id, "Crawl worker paused; awaiting resume signal");
                ctrl.pause_notifier.notified().await;
                if ctrl.is_cancelled.load(Ordering::SeqCst) {
                    break;
                }
            }

            // Check current job limits (visited pages vs max_pages) without holding lock across await
            let maybe_job = {
                if let Ok(conn) = db.lock() {
                    CrawlRepository::get_job(&conn, &job_id).ok().flatten()
                } else {
                    None
                }
            };

            let current_job = match maybe_job {
                Some(j) => j,
                None => {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    continue;
                }
            };

            if current_job.pages_visited >= profile.max_pages as i64 {
                info!(job_id = %job_id, visited = current_job.pages_visited, max = profile.max_pages, "Crawl job reached max_pages limit");
                if let Ok(conn) = db.lock() {
                    let _ = CrawlRepository::update_job_status(
                        &conn,
                        &job_id,
                        CrawlJobStatus::Completed,
                        None,
                    );
                }
                break;
            }

            // Dequeue next pending queue item
            let queue_item = {
                if let Ok(conn) = db.lock() {
                    CrawlRepository::get_next_queue_item(&conn, &job_id).unwrap_or(None)
                } else {
                    None
                }
            };

            let item = match queue_item {
                Some(it) => it,
                None => {
                    // Queue exhausted, job completed!
                    info!(job_id = %job_id, "Queue exhausted; crawl completed successfully");
                    if let Ok(conn) = db.lock() {
                        let _ = CrawlRepository::update_job_status(
                            &conn,
                            &job_id,
                            CrawlJobStatus::Completed,
                            None,
                        );
                    }
                    break;
                }
            };

            // Mark item processing
            if let Ok(conn) = db.lock() {
                let _ = CrawlRepository::update_queue_item_status(
                    &conn,
                    &item.id,
                    CrawlQueueItemStatus::Processing,
                    None,
                    None,
                );
            }

            // 1. Anti-SSRF and URL Validation
            let parsed_url = match UrlGuard::validate_url(&item.url) {
                Ok(u) => u,
                Err(e) => {
                    warn!(url = %item.url, error = %e, "Skipping invalid/unsafe URL");
                    if let Ok(conn) = db.lock() {
                        let _ = CrawlRepository::update_queue_item_status(
                            &conn,
                            &item.id,
                            CrawlQueueItemStatus::Failed,
                            None,
                            Some(&e.to_string()),
                        );
                        let _ = CrawlRepository::increment_job_counters(&conn, &job_id, 0, 1, 0);
                    }
                    continue;
                }
            };

            // 2. Domain and Pattern Restrictions
            if let Err(e) = UrlGuard::matches_domain(&parsed_url, &profile.domain) {
                if let Ok(conn) = db.lock() {
                    let _ = CrawlRepository::update_queue_item_status(
                        &conn,
                        &item.id,
                        CrawlQueueItemStatus::Skipped,
                        None,
                        Some(&e.to_string()),
                    );
                }
                continue;
            }

            if let Err(e) = UrlGuard::matches_patterns(
                &item.url,
                &profile.allowed_patterns,
                &profile.disallowed_patterns,
            ) {
                if let Ok(conn) = db.lock() {
                    let _ = CrawlRepository::update_queue_item_status(
                        &conn,
                        &item.id,
                        CrawlQueueItemStatus::Skipped,
                        None,
                        Some(&e.to_string()),
                    );
                }
                continue;
            }

            // 3. Robots.txt Compliance Check
            let origin = format!(
                "{}://{}",
                parsed_url.scheme(),
                parsed_url.host_str().unwrap_or("")
            );
            let robots = self
                .robots_cache
                .get_or_fetch(&origin, &self.http_client, user_agent)
                .await;

            if !robots.is_allowed(parsed_url.path(), user_agent) {
                warn!(url = %item.url, "URL disallowed by robots.txt; skipping");
                if let Ok(conn) = db.lock() {
                    let _ = CrawlRepository::update_queue_item_status(
                        &conn,
                        &item.id,
                        CrawlQueueItemStatus::Skipped,
                        None,
                        Some("Disallowed by robots.txt"),
                    );
                }
                continue;
            }

            // Rate-limiting delay (profile delay or robots.txt crawl-delay)
            let delay = robots
                .crawl_delay(user_agent)
                .map(|d| d.max(base_delay))
                .unwrap_or(base_delay);
            tokio::time::sleep(delay).await;

            // 4. HTTP Fetch
            let fetch_result = self
                .http_client
                .get(parsed_url.as_str())
                .header("User-Agent", user_agent)
                .send()
                .await;

            match fetch_result {
                Ok(resp) => {
                    let status_code = resp.status().as_u16() as i32;
                    if resp.status().is_success() {
                        let html = match Self::read_response_body_bounded(resp).await {
                            Ok(body) => body,
                            Err(e) => {
                                warn!(url = %item.url, error = %e, "Failed to read bounded response body; skipping item");
                                if let Ok(conn) = db.lock() {
                                    let _ = CrawlRepository::update_queue_item_status(
                                        &conn,
                                        &item.id,
                                        CrawlQueueItemStatus::Failed,
                                        Some(status_code),
                                        Some(&e),
                                    );
                                    let _ = CrawlRepository::increment_job_counters(
                                        &conn, &job_id, 0, 1, 0,
                                    );
                                }
                                continue;
                            }
                        };
                        let extracted = HtmlExtractor::extract(&html, &item.url, Some(&profile));

                        let mut paper_found = false;
                        if let Some(ref title) = extracted.title {
                            if let Ok(conn) = db.lock() {
                                let _ = CrawlRepository::save_crawled_paper(
                                    &conn,
                                    crate::repositories::crawl_repo::CrawledPaperInput {
                                        job_id: &job_id,
                                        url: &item.url,
                                        title,
                                        canonical_doi: extracted.canonical_doi.as_deref(),
                                        authors: &extracted.authors,
                                        abstract_text: extracted.abstract_text.as_deref(),
                                        publication_date: extracted.publication_date.as_deref(),
                                        venue: extracted.venue.as_deref(),
                                        pdf_url: extracted.pdf_url.as_deref(),
                                    },
                                );
                                paper_found = true;
                            }
                        }

                        // Enqueue discovered paper links if depth < max_depth
                        if item.depth < profile.max_depth {
                            if let Ok(conn) = db.lock() {
                                for link in extracted.discovered_paper_links {
                                    let _ = CrawlRepository::enqueue_url(
                                        &conn,
                                        &job_id,
                                        &link,
                                        item.depth + 1,
                                    );
                                }
                            }
                        }

                        if let Ok(conn) = db.lock() {
                            let _ = CrawlRepository::update_queue_item_status(
                                &conn,
                                &item.id,
                                CrawlQueueItemStatus::Completed,
                                Some(status_code),
                                None,
                            );
                            let _ = CrawlRepository::increment_job_counters(
                                &conn,
                                &job_id,
                                1,
                                0,
                                if paper_found { 1 } else { 0 },
                            );
                        }
                    } else {
                        // HTTP Error (4xx, 5xx)
                        if let Ok(conn) = db.lock() {
                            let _ = CrawlRepository::update_queue_item_status(
                                &conn,
                                &item.id,
                                CrawlQueueItemStatus::Failed,
                                Some(status_code),
                                Some(&format!("HTTP status {status_code}")),
                            );
                            let _ =
                                CrawlRepository::increment_job_counters(&conn, &job_id, 0, 1, 0);
                        }
                    }
                }
                Err(e) => {
                    error!(url = %item.url, error = %e, "Network fetch error during crawl");
                    if let Ok(conn) = db.lock() {
                        let _ = CrawlRepository::update_queue_item_status(
                            &conn,
                            &item.id,
                            CrawlQueueItemStatus::Failed,
                            None,
                            Some(&e.to_string()),
                        );
                        let _ = CrawlRepository::increment_job_counters(&conn, &job_id, 0, 1, 0);
                    }
                }
            }
        }

        // Cleanup controller from registry
        let mut controls = self.job_controls.write().await;
        controls.remove(&job_id);
    }
}
