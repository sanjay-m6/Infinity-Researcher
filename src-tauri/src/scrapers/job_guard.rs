use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tracing::info;

use crate::scrapers::types::SearchStreamEvent;

/// RAII finalization guard for streaming search jobs.
/// Guarantees that EVERY accepted search job reaches exactly one terminal event:
/// (SearchCompleted, SearchCompletedWithErrors, SearchNoResults, SearchFailed,
/// SearchCancelled, or SearchTimedOut) even in the presence of early returns, errors, or panics.
pub struct SearchJobGuard {
    session_id: String,
    emit: Arc<dyn Fn(SearchStreamEvent) + Send + Sync>,
    start_time: Instant,
    is_finalized: Arc<AtomicBool>,
    is_cancelled: Arc<AtomicBool>,
    total_papers: Arc<AtomicUsize>,
    completed_sources: Arc<AtomicUsize>,
    failed_sources: Arc<Mutex<Vec<String>>>,
    total_sources: Arc<AtomicUsize>,
}

impl SearchJobGuard {
    pub fn new<F>(session_id: String, cancel_signal: Arc<AtomicBool>, emit_fn: F) -> Self
    where
        F: Fn(SearchStreamEvent) + Send + Sync + 'static,
    {
        Self {
            session_id,
            emit: Arc::new(emit_fn),
            start_time: Instant::now(),
            is_finalized: Arc::new(AtomicBool::new(false)),
            is_cancelled: cancel_signal,
            total_papers: Arc::new(AtomicUsize::new(0)),
            completed_sources: Arc::new(AtomicUsize::new(0)),
            failed_sources: Arc::new(Mutex::new(Vec::new())),
            total_sources: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn set_total_sources(&self, count: usize) {
        self.total_sources.store(count, Ordering::Relaxed);
    }

    pub fn record_paper(&self) {
        self.total_papers.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_source_completed(&self, _source_id: &str) {
        self.completed_sources.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_source_failed(&self, source_id: &str, _error: &str) {
        let mut lock = self.failed_sources.lock().unwrap();
        if !lock.iter().any(|s| s == source_id) {
            lock.push(source_id.to_string());
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.is_cancelled.load(Ordering::Relaxed)
    }

    pub fn failed_sources_count(&self) -> usize {
        self.failed_sources.lock().unwrap().len()
    }

    /// Explicitly mark the search job as completed and determine the exact terminal state.
    pub fn finalize_completed(&self, total_unique: usize) {
        if !self.is_finalized.swap(true, Ordering::SeqCst) {
            let duration_ms = self.start_time.elapsed().as_millis() as u64;
            let failed = { self.failed_sources.lock().unwrap().clone() };

            if self.is_cancelled() {
                info!(
                    session_id = %self.session_id,
                    duration_ms,
                    "Search job finalized as CANCELLED"
                );
                (self.emit)(SearchStreamEvent::SearchCancelled {
                    session_id: self.session_id.clone(),
                    total_unique,
                    duration_ms,
                });
            } else if !failed.is_empty() && total_unique > 0 {
                info!(
                    session_id = %self.session_id,
                    total_unique,
                    failed_sources = ?failed,
                    duration_ms,
                    "Search job finalized as COMPLETED_WITH_ERRORS"
                );
                (self.emit)(SearchStreamEvent::SearchCompletedWithErrors {
                    session_id: self.session_id.clone(),
                    total_unique,
                    failed_sources: failed,
                    duration_ms,
                });
            } else if !failed.is_empty() && total_unique == 0 {
                info!(
                    session_id = %self.session_id,
                    failed_sources = ?failed,
                    duration_ms,
                    "Search job finalized as FAILED"
                );
                (self.emit)(SearchStreamEvent::SearchFailed {
                    session_id: self.session_id.clone(),
                    error: format!(
                        "All active sources encountered errors: {}",
                        failed.join(", ")
                    ),
                    duration_ms,
                });
            } else if total_unique == 0 {
                info!(
                    session_id = %self.session_id,
                    duration_ms,
                    "Search job finalized as NO_RESULTS"
                );
                (self.emit)(SearchStreamEvent::SearchNoResults {
                    session_id: self.session_id.clone(),
                    duration_ms,
                });
            } else {
                info!(
                    session_id = %self.session_id,
                    total_unique,
                    duration_ms,
                    "Search job finalized as COMPLETED"
                );
                (self.emit)(SearchStreamEvent::SearchCompleted {
                    session_id: self.session_id.clone(),
                    total_unique,
                    duration_ms,
                });
            }
        }
    }

    /// Explicitly mark the search job as cancelled.
    pub fn finalize_cancelled(&self, total_unique: usize) {
        if !self.is_finalized.swap(true, Ordering::SeqCst) {
            let duration_ms = self.start_time.elapsed().as_millis() as u64;
            info!(
                session_id = %self.session_id,
                duration_ms,
                "Search job finalized as CANCELLED"
            );
            (self.emit)(SearchStreamEvent::SearchCancelled {
                session_id: self.session_id.clone(),
                total_unique,
                duration_ms,
            });
        }
    }

    /// Explicitly mark the search job as failed.
    pub fn finalize_failed(&self, message: &str) {
        if !self.is_finalized.swap(true, Ordering::SeqCst) {
            let duration_ms = self.start_time.elapsed().as_millis() as u64;
            info!(
                session_id = %self.session_id,
                error = %message,
                "Search job finalized as FAILED"
            );
            (self.emit)(SearchStreamEvent::SearchFailed {
                session_id: self.session_id.clone(),
                error: message.to_string(),
                duration_ms,
            });
        }
    }

    /// Explicitly mark the search job as timed out.
    pub fn finalize_timed_out(&self, total_unique: usize) {
        if !self.is_finalized.swap(true, Ordering::SeqCst) {
            let duration_ms = self.start_time.elapsed().as_millis() as u64;
            info!(
                session_id = %self.session_id,
                duration_ms,
                "Search job finalized as TIMED_OUT"
            );
            (self.emit)(SearchStreamEvent::SearchTimedOut {
                session_id: self.session_id.clone(),
                total_unique,
                duration_ms,
            });
        }
    }
}

impl Drop for SearchJobGuard {
    fn drop(&mut self) {
        // If not already finalized, emit terminal completion to guarantee zero stuck spinners
        if !self.is_finalized.swap(true, Ordering::SeqCst) {
            let duration_ms = self.start_time.elapsed().as_millis() as u64;
            let papers = self.total_papers.load(Ordering::Relaxed);
            let failed = self.failed_sources.lock().unwrap().clone();

            if self.is_cancelled() {
                (self.emit)(SearchStreamEvent::SearchCancelled {
                    session_id: self.session_id.clone(),
                    total_unique: papers,
                    duration_ms,
                });
            } else if !failed.is_empty() && papers > 0 {
                (self.emit)(SearchStreamEvent::SearchCompletedWithErrors {
                    session_id: self.session_id.clone(),
                    total_unique: papers,
                    failed_sources: failed,
                    duration_ms,
                });
            } else if !failed.is_empty() && papers == 0 {
                (self.emit)(SearchStreamEvent::SearchFailed {
                    session_id: self.session_id.clone(),
                    error: format!("Search failed: {}", failed.join(", ")),
                    duration_ms,
                });
            } else if papers == 0 {
                (self.emit)(SearchStreamEvent::SearchNoResults {
                    session_id: self.session_id.clone(),
                    duration_ms,
                });
            } else {
                (self.emit)(SearchStreamEvent::SearchCompleted {
                    session_id: self.session_id.clone(),
                    total_unique: papers,
                    duration_ms,
                });
            }
        }
    }
}
