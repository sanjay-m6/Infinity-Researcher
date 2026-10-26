use chrono::Utc;
use reqwest::Client;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;
use tracing::info;

pub use crate::scrapers::adapters::{
    ArxivAdapter, BiorxivAdapter, MedrxivAdapter, NatureAdapter, PlosAdapter, PmcAdapter,
    SourceAdapter, SourceRegistry,
};
pub use crate::scrapers::dedup::{
    compute_relevance_score, deduplicate_and_rank_results, normalize_doi, normalize_title,
};
pub use crate::scrapers::job_guard::SearchJobGuard;
pub use crate::scrapers::types::{
    DiscoveredSearchResult, EngineDiagnostics, SearchJobState, SearchJobSummary, SearchStreamEvent,
    SourceCapabilities, SourceDiagnosticInfo, SourceErrorCategory, SourceSearchStatus,
    WebsiteSearchQuery, WebsiteSearchResponse, WebsiteSourceDescriptor,
};
use crate::scrapers::url_guard::UrlGuard;

// ---------------------------------------------------------------------------
// Active Sessions Cancellation Registry
// ---------------------------------------------------------------------------

struct SessionControl {
    cancel_flag: Arc<AtomicBool>,
    abort_handle: Option<tokio::task::AbortHandle>,
}

static ACTIVE_SEARCH_SESSIONS: Mutex<Option<HashMap<String, SessionControl>>> = Mutex::new(None);

pub fn register_search_session(session_id: &str) -> Arc<AtomicBool> {
    let mut lock = ACTIVE_SEARCH_SESSIONS.lock().unwrap();
    let map = lock.get_or_insert_with(HashMap::new);
    let cancel = Arc::new(AtomicBool::new(false));
    map.insert(
        session_id.to_string(),
        SessionControl {
            cancel_flag: cancel.clone(),
            abort_handle: None,
        },
    );
    cancel
}

pub fn attach_session_abort_handle(session_id: &str, handle: tokio::task::AbortHandle) {
    let mut lock = ACTIVE_SEARCH_SESSIONS.lock().unwrap();
    if let Some(map) = lock.as_mut() {
        if let Some(ctrl) = map.get_mut(session_id) {
            ctrl.abort_handle = Some(handle);
        }
    }
}

pub fn cancel_search_session(session_id: &str) {
    let mut lock = ACTIVE_SEARCH_SESSIONS.lock().unwrap();
    if let Some(map) = lock.as_mut() {
        if let Some(ctrl) = map.remove(session_id) {
            ctrl.cancel_flag.store(true, Ordering::Relaxed);
            if let Some(handle) = ctrl.abort_handle {
                handle.abort();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Engine Observability & Metrics Store (Phase L)
// ---------------------------------------------------------------------------

static ENGINE_START_TIME: OnceLock<Instant> = OnceLock::new();
static TOTAL_SEARCHES: AtomicUsize = AtomicUsize::new(0);
static SUCCESSFUL_SEARCHES: AtomicUsize = AtomicUsize::new(0);
static FAILED_SEARCHES: AtomicUsize = AtomicUsize::new(0);
static CANCELLED_SEARCHES: AtomicUsize = AtomicUsize::new(0);

#[derive(Default, Clone)]
struct SourceMetricRecord {
    total_requests: usize,
    successful_requests: usize,
    failed_requests: usize,
    total_papers: usize,
    last_elapsed_ms: u64,
    last_error: Option<String>,
}

static SOURCE_METRICS: Mutex<Option<HashMap<String, SourceMetricRecord>>> = Mutex::new(None);
static RECENT_JOBS: Mutex<Option<VecDeque<SearchJobSummary>>> = Mutex::new(None);

fn record_source_metric(
    source_id: &str,
    success: bool,
    papers_count: usize,
    elapsed_ms: u64,
    error_msg: Option<String>,
) {
    let mut lock = SOURCE_METRICS.lock().unwrap();
    let map = lock.get_or_insert_with(HashMap::new);
    let record = map.entry(source_id.to_string()).or_default();
    record.total_requests += 1;
    if success {
        record.successful_requests += 1;
        record.total_papers += papers_count;
    } else {
        record.failed_requests += 1;
        record.last_error = error_msg;
    }
    record.last_elapsed_ms = elapsed_ms;
}

fn record_job_summary(summary: SearchJobSummary) {
    let mut lock = RECENT_JOBS.lock().unwrap();
    let queue = lock.get_or_insert_with(|| VecDeque::with_capacity(25));
    if queue.len() >= 25 {
        queue.pop_back();
    }
    queue.push_front(summary);
}

// ---------------------------------------------------------------------------
// Main Website Search Engine Orchestrator
// ---------------------------------------------------------------------------

pub struct WebsiteSearchEngine {
    client: Client,
    registry: SourceRegistry,
}

impl Default for WebsiteSearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl WebsiteSearchEngine {
    pub fn new() -> Self {
        ENGINE_START_TIME.get_or_init(Instant::now);

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(14))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 4 {
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
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            registry: SourceRegistry::new(),
        }
    }

    /// Lists supported academic website search sources and their current policy/automation status.
    pub fn list_sources() -> Vec<WebsiteSourceDescriptor> {
        let registry = SourceRegistry::new();
        registry.list_descriptors()
    }

    /// Returns structured engine diagnostics and metrics (Phase L).
    pub fn get_diagnostics() -> EngineDiagnostics {
        let uptime = ENGINE_START_TIME
            .get()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);

        let active_count = {
            let lock = ACTIVE_SEARCH_SESSIONS.lock().unwrap();
            lock.as_ref().map(|m| m.len()).unwrap_or(0)
        };

        let descriptors = Self::list_sources();
        let metrics_map = {
            let lock = SOURCE_METRICS.lock().unwrap();
            lock.clone().unwrap_or_default()
        };

        let sources_diag: Vec<SourceDiagnosticInfo> = descriptors
            .into_iter()
            .map(|d| {
                let m = metrics_map.get(&d.id).cloned().unwrap_or_default();
                SourceDiagnosticInfo {
                    source_id: d.id,
                    source_name: d.name,
                    status: d.status,
                    total_requests: m.total_requests,
                    successful_requests: m.successful_requests,
                    failed_requests: m.failed_requests,
                    total_papers_found: m.total_papers,
                    last_elapsed_ms: m.last_elapsed_ms,
                    last_error: m.last_error,
                }
            })
            .collect();

        let recent_jobs = {
            let lock = RECENT_JOBS.lock().unwrap();
            lock.as_ref()
                .map(|q| q.iter().cloned().collect())
                .unwrap_or_default()
        };

        EngineDiagnostics {
            engine_version: "2.1.0-spider-hardened".to_string(),
            engine_status: "ready".to_string(),
            uptime_seconds: uptime,
            total_searches: TOTAL_SEARCHES.load(Ordering::Relaxed),
            successful_searches: SUCCESSFUL_SEARCHES.load(Ordering::Relaxed),
            failed_searches: FAILED_SEARCHES.load(Ordering::Relaxed),
            cancelled_searches: CANCELLED_SEARCHES.load(Ordering::Relaxed),
            active_sessions: active_count,
            sources: sources_diag,
            recent_jobs,
        }
    }

    /// Synchronous multi-source search (used by standard command).
    pub async fn execute_search(&self, query: WebsiteSearchQuery) -> WebsiteSearchResponse {
        TOTAL_SEARCHES.fetch_add(1, Ordering::Relaxed);
        let clean_query = query.query.trim().to_string();
        if clean_query.is_empty() {
            return WebsiteSearchResponse {
                results: Vec::new(),
                source_statuses: Vec::new(),
                total_results: 0,
                completed_at: Utc::now().to_rfc3339(),
            };
        }

        let selected_source_ids: Vec<String> = match &query.sources {
            Some(srcs) if !srcs.is_empty() => srcs.clone(),
            _ => vec![
                "arxiv".to_string(),
                "biorxiv".to_string(),
                "medrxiv".to_string(),
                "plos".to_string(),
                "nature_srep".to_string(),
                "pmc".to_string(),
            ],
        };

        let mut statuses: Vec<SourceSearchStatus> = Vec::new();
        let mut all_results: Vec<DiscoveredSearchResult> = Vec::new();
        let cancel = Arc::new(AtomicBool::new(false));

        for source_id in &selected_source_ids {
            let adapter = match self.registry.get_adapter(source_id) {
                Some(a) => a,
                None => {
                    statuses.push(SourceSearchStatus {
                        source_id: source_id.clone(),
                        source_name: source_id.clone(),
                        status: "unsupported".to_string(),
                        message: Some(format!("Unrecognized search source: {source_id}")),
                        results_count: 0,
                        elapsed_ms: 0,
                        error_category: Some(SourceErrorCategory::Unsupported),
                    });
                    continue;
                }
            };

            let start = Instant::now();
            match adapter.search(&self.client, &query, cancel.clone()).await {
                Ok(papers) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    let count = papers.len();
                    record_source_metric(source_id, true, count, elapsed, None);
                    statuses.push(SourceSearchStatus {
                        source_id: source_id.clone(),
                        source_name: adapter.display_name().to_string(),
                        status: if count > 0 {
                            "completed".to_string()
                        } else {
                            "no_results".to_string()
                        },
                        message: None,
                        results_count: count,
                        elapsed_ms: elapsed,
                        error_category: None,
                    });
                    all_results.extend(papers);
                }
                Err(err_msg) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    let cat = adapter.classify_error(&err_msg);
                    record_source_metric(source_id, false, 0, elapsed, Some(err_msg.clone()));
                    statuses.push(SourceSearchStatus {
                        source_id: source_id.clone(),
                        source_name: adapter.display_name().to_string(),
                        status: match cat {
                            SourceErrorCategory::Timeout => "timeout".to_string(),
                            SourceErrorCategory::Blocked => "blocked".to_string(),
                            SourceErrorCategory::RateLimited => "rate_limited".to_string(),
                            SourceErrorCategory::Unsupported => "unsupported".to_string(),
                            _ => "failed".to_string(),
                        },
                        message: Some(err_msg),
                        results_count: 0,
                        elapsed_ms: elapsed,
                        error_category: Some(cat),
                    });
                }
            }
        }

        let ranked = deduplicate_and_rank_results(all_results, &clean_query);
        let total = ranked.len();
        SUCCESSFUL_SEARCHES.fetch_add(1, Ordering::Relaxed);

        WebsiteSearchResponse {
            results: ranked,
            source_statuses: statuses,
            total_results: total,
            completed_at: Utc::now().to_rfc3339(),
        }
    }

    /// Executes query-based academic search across enabled website sources, streaming each paper and source status live as events.
    pub async fn execute_streaming_search<F>(
        &self,
        session_id: String,
        query: WebsiteSearchQuery,
        cancel_signal: Arc<AtomicBool>,
        emit_event: F,
    ) where
        F: Fn(SearchStreamEvent) + Send + Sync + 'static + Clone,
    {
        TOTAL_SEARCHES.fetch_add(1, Ordering::Relaxed);
        let job_guard = SearchJobGuard::new(
            session_id.clone(),
            cancel_signal.clone(),
            emit_event.clone(),
        );

        let clean_query = query.query.trim().to_string();
        if clean_query.is_empty() {
            emit_event(SearchStreamEvent::SearchStarted {
                session_id: session_id.clone(),
                query: "".to_string(),
                sources: Vec::new(),
                schema_version: "2.1".to_string(),
            });
            job_guard.finalize_completed(0);
            return;
        }

        info!(session_id = %session_id, query = %clean_query, "Starting streaming search orchestrator");

        let selected_source_ids: Vec<String> = match &query.sources {
            Some(srcs) if !srcs.is_empty() => srcs.clone(),
            _ => vec![
                "arxiv".to_string(),
                "biorxiv".to_string(),
                "medrxiv".to_string(),
                "plos".to_string(),
                "nature_srep".to_string(),
                "pmc".to_string(),
            ],
        };

        job_guard.set_total_sources(selected_source_ids.len());

        emit_event(SearchStreamEvent::SearchStarted {
            session_id: session_id.clone(),
            query: clean_query.clone(),
            sources: selected_source_ids.clone(),
            schema_version: "2.1".to_string(),
        });

        let mut tasks = tokio::task::JoinSet::new();
        let semaphore = Arc::new(tokio::sync::Semaphore::new(4));

        for source_id in &selected_source_ids {
            let adapter = match self.registry.get_adapter(source_id) {
                Some(a) => a,
                None => {
                    emit_event(SearchStreamEvent::SourceStatus {
                        session_id: session_id.clone(),
                        source_id: source_id.clone(),
                        source_name: source_id.clone(),
                        status: "unsupported".to_string(),
                        message: Some(format!(
                            "Unknown or unconfigured academic search source: {source_id}"
                        )),
                        results_count: 0,
                        elapsed_ms: 0,
                    });
                    job_guard.record_source_failed(source_id, "Unsupported source");
                    continue;
                }
            };

            let descriptor = adapter.descriptor();
            if descriptor.status != "enabled" {
                emit_event(SearchStreamEvent::SourceStatus {
                    session_id: session_id.clone(),
                    source_id: descriptor.id.clone(),
                    source_name: descriptor.name.clone(),
                    status: descriptor.status.clone(),
                    message: Some(descriptor.policy_notes.clone()),
                    results_count: 0,
                    elapsed_ms: 0,
                });
                job_guard.record_source_completed(&descriptor.id);
                continue;
            }

            emit_event(SearchStreamEvent::SourceStarted {
                session_id: session_id.clone(),
                source_id: descriptor.id.clone(),
                source_name: descriptor.name.clone(),
            });

            emit_event(SearchStreamEvent::SourceStatus {
                session_id: session_id.clone(),
                source_id: descriptor.id.clone(),
                source_name: descriptor.name.clone(),
                status: "searching".to_string(),
                message: None,
                results_count: 0,
                elapsed_ms: 0,
            });

            let client = self.client.clone();
            let query_copy = query.clone();
            let sess_id = session_id.clone();
            let cancel = cancel_signal.clone();
            let emit = emit_event.clone();
            let src_id = descriptor.id.clone();
            let src_name = descriptor.name.clone();
            let sem = semaphore.clone();

            tasks.spawn(async move {
                let _permit = sem.acquire_owned().await.ok();

                if cancel.load(Ordering::Relaxed) {
                    return (src_id, src_name, Err("Search cancelled".to_string()), 0);
                }

                let s_time = Instant::now();
                let timeout_duration = std::time::Duration::from_secs(14);
                let timeout_res = tokio::time::timeout(
                    timeout_duration,
                    adapter.search(&client, &query_copy, cancel.clone()),
                ).await;
                let elapsed = s_time.elapsed().as_millis() as u64;

                if cancel.load(Ordering::Relaxed) {
                    emit(SearchStreamEvent::SourceStatus {
                        session_id: sess_id,
                        source_id: src_id.clone(),
                        source_name: src_name.clone(),
                        status: "cancelled".to_string(),
                        message: Some("Search cancelled by user".to_string()),
                        results_count: 0,
                        elapsed_ms: elapsed,
                    });
                    return (src_id, src_name, Err("Search cancelled".to_string()), elapsed);
                }

                let res = match timeout_res {
                    Ok(inner) => inner,
                    Err(_) => Err(format!(
                        "Search timed out after 14 seconds for {src_name}. Server did not respond in time."
                    )),
                };

                match res {
                    Ok(raw_papers) => {
                        let filtered_papers: Vec<DiscoveredSearchResult> = raw_papers
                            .into_iter()
                            .filter(|r| Self::matches_filter(r, &query_copy))
                            .collect();

                        let count = filtered_papers.len();
                        for paper in &filtered_papers {
                            if cancel.load(Ordering::Relaxed) {
                                return (src_id, src_name, Err("Search cancelled".to_string()), elapsed);
                            }
                            emit(SearchStreamEvent::PaperFound {
                                session_id: sess_id.clone(),
                                source_id: src_id.clone(),
                                paper: paper.clone(),
                            });
                        }

                        let status_label = if count > 0 { "completed" } else { "no_results" };
                        let msg = if count == 0 {
                            Some("No academic papers matching this query were returned by this source.".to_string())
                        } else {
                            None
                        };

                        emit(SearchStreamEvent::SourceStatus {
                            session_id: sess_id.clone(),
                            source_id: src_id.clone(),
                            source_name: src_name.clone(),
                            status: status_label.to_string(),
                            message: msg,
                            results_count: count,
                            elapsed_ms: elapsed,
                        });

                        emit(SearchStreamEvent::SourceCompleted {
                            session_id: sess_id.clone(),
                            source_id: src_id.clone(),
                            count,
                            elapsed_ms: elapsed,
                        });

                        (src_id, src_name, Ok(count), elapsed)
                    }
                    Err(err_msg) => {
                        let cat = adapter.classify_error(&err_msg);
                        let status_str = match cat {
                            SourceErrorCategory::Timeout => "timeout".to_string(),
                            SourceErrorCategory::Blocked => "blocked".to_string(),
                            SourceErrorCategory::RateLimited => "rate_limited".to_string(),
                            SourceErrorCategory::Unsupported => "unsupported".to_string(),
                            SourceErrorCategory::Cancelled => "cancelled".to_string(),
                            _ => "failed".to_string(),
                        };

                        emit(SearchStreamEvent::SourceStatus {
                            session_id: sess_id.clone(),
                            source_id: src_id.clone(),
                            source_name: src_name.clone(),
                            status: status_str,
                            message: Some(err_msg.clone()),
                            results_count: 0,
                            elapsed_ms: elapsed,
                        });

                        emit(SearchStreamEvent::SourceFailed {
                            session_id: sess_id,
                            source_id: src_id.clone(),
                            message: err_msg.clone(),
                            error_category: cat,
                            elapsed_ms: elapsed,
                        });

                        (src_id, src_name, Err(err_msg), elapsed)
                    }
                }
            });
        }

        let mut total_discovered = 0;
        let mut completed_sources_count = 0;
        let total_sources_count = tasks.len();

        // Enforce an overall search deadline (25 seconds) so the search job can never hang indefinitely
        let search_deadline = tokio::time::sleep(std::time::Duration::from_secs(25));
        tokio::pin!(search_deadline);

        loop {
            tokio::select! {
                _ = &mut search_deadline => {
                    tracing::warn!(session_id = %session_id, "Overall search deadline of 25s reached; aborting remaining in-flight tasks");
                    tasks.abort_all();
                    job_guard.finalize_timed_out(total_discovered);
                    return;
                }
                next_res = tasks.join_next() => {
                    match next_res {
                        Some(task_res) => {
                            if cancel_signal.load(Ordering::Relaxed) {
                                tasks.abort_all();
                                break;
                            }
                            completed_sources_count += 1;
                            match task_res {
                                Ok((src_id, _, Ok(count), elapsed)) => {
                                    total_discovered += count;
                                    job_guard.record_source_completed(&src_id);
                                    record_source_metric(&src_id, true, count, elapsed, None);
                                }
                                Ok((src_id, _, Err(err), elapsed)) => {
                                    job_guard.record_source_failed(&src_id, &err);
                                    record_source_metric(&src_id, false, 0, elapsed, Some(err));
                                }
                                Err(join_err) => {
                                    tracing::warn!("Source worker task join error (panic or abort): {join_err}");
                                }
                            }

                            emit_event(SearchStreamEvent::SearchProgress {
                                session_id: session_id.clone(),
                                completed_sources: completed_sources_count,
                                total_sources: total_sources_count,
                                total_papers: total_discovered,
                            });
                        }
                        None => {
                            // All spawned tasks have finished
                            break;
                        }
                    }
                }
            }
        }

        // Finalize state and metrics
        let had_errors = job_guard.failed_sources_count() > 0;
        let final_state = if cancel_signal.load(Ordering::Relaxed) {
            CANCELLED_SEARCHES.fetch_add(1, Ordering::Relaxed);
            SearchJobState::Cancelled
        } else if had_errors && total_discovered > 0 {
            SUCCESSFUL_SEARCHES.fetch_add(1, Ordering::Relaxed);
            SearchJobState::CompletedWithErrors
        } else if had_errors && total_discovered == 0 {
            FAILED_SEARCHES.fetch_add(1, Ordering::Relaxed);
            SearchJobState::Failed
        } else if total_discovered == 0 {
            SUCCESSFUL_SEARCHES.fetch_add(1, Ordering::Relaxed);
            SearchJobState::NoResults
        } else {
            SUCCESSFUL_SEARCHES.fetch_add(1, Ordering::Relaxed);
            SearchJobState::Completed
        };

        record_job_summary(SearchJobSummary {
            session_id: session_id.clone(),
            query: clean_query,
            sources: selected_source_ids,
            state: final_state,
            total_results: total_discovered,
            duration_ms: 0,
            timestamp: Utc::now().to_rfc3339(),
        });

        job_guard.finalize_completed(total_discovered);
    }

    fn matches_filter(r: &DiscoveredSearchResult, query: &WebsiteSearchQuery) -> bool {
        if let Some(ys) = query.year_start {
            if let Some(py) = r.publication_year {
                if py < ys {
                    return false;
                }
            }
        }
        if let Some(ye) = query.year_end {
            if let Some(py) = r.publication_year {
                if py > ye {
                    return false;
                }
            }
        }
        if let Some(ref ct) = query.content_type {
            if ct != "all" && !r.content_type.eq_ignore_ascii_case(ct) {
                return false;
            }
        }
        if let Some(true) = query.open_access_only {
            if !r.is_open_access {
                return false;
            }
        }
        if let Some(ref a_query) = query.author {
            let a_clean = a_query.trim().to_lowercase();
            if !a_clean.is_empty() {
                let matches_author = r
                    .authors
                    .iter()
                    .any(|a| a.to_lowercase().contains(&a_clean));
                if !matches_author {
                    return false;
                }
            }
        }
        true
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_list_sources_status() {
        let sources = WebsiteSearchEngine::list_sources();
        assert!(!sources.is_empty());
        let arxiv = sources.iter().find(|s| s.id == "arxiv");
        assert!(arxiv.is_some());
        assert_eq!(arxiv.unwrap().status, "enabled");

        let ieee = sources.iter().find(|s| s.id == "ieee_xplore");
        assert!(ieee.is_some());
        assert_eq!(ieee.unwrap().status, "manual_only");

        let scholar = sources.iter().find(|s| s.id == "google_scholar");
        assert!(scholar.is_some());
        assert_eq!(scholar.unwrap().status, "disabled");
    }

    #[tokio::test]
    async fn test_search_lifecycle_and_guard() {
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = events.clone();

        {
            let guard =
                SearchJobGuard::new("test_session_1".to_string(), cancel.clone(), move |ev| {
                    events_clone.lock().unwrap().push(ev);
                });
            guard.record_paper();
            // Drop guard without manual finalize -> must automatically emit SearchCompleted!
        }

        let evs = events.lock().unwrap();
        assert_eq!(evs.len(), 1);
        match &evs[0] {
            SearchStreamEvent::SearchCompleted {
                session_id,
                total_unique,
                ..
            } => {
                assert_eq!(session_id, "test_session_1");
                assert_eq!(*total_unique, 1);
            }
            other => panic!("Expected SearchCompleted, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_cancellation_lifecycle() {
        let cancel = Arc::new(AtomicBool::new(true)); // Already cancelled
        let events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = events.clone();

        {
            let _guard = SearchJobGuard::new(
                "test_session_cancelled".to_string(),
                cancel.clone(),
                move |ev| {
                    events_clone.lock().unwrap().push(ev);
                },
            );
            // Drop guard while cancelled -> must emit SearchCancelled!
        }

        let evs = events.lock().unwrap();
        assert_eq!(evs.len(), 1);
        match &evs[0] {
            SearchStreamEvent::SearchCancelled { session_id, .. } => {
                assert_eq!(session_id, "test_session_cancelled");
            }
            other => panic!("Expected SearchCancelled, got {other:?}"),
        }
    }

    #[test]
    fn test_diagnostics_report() {
        let diag = WebsiteSearchEngine::get_diagnostics();
        assert_eq!(diag.engine_status, "ready");
        assert!(!diag.sources.is_empty());
    }

    #[tokio::test]
    async fn test_live_search_sources() {
        let engine = WebsiteSearchEngine::new();
        let query = WebsiteSearchQuery {
            query: "transformer attention neural networks".to_string(),
            sources: Some(vec!["arxiv".to_string(), "plos".to_string()]),
            year_start: None,
            year_end: None,
            content_type: None,
            open_access_only: None,
            author: None,
            limit_per_source: Some(3),
        };

        let resp = engine.execute_search(query).await;
        assert!(!resp.source_statuses.is_empty());
    }
}
