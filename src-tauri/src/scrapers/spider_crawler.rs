use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};

use crate::scrapers::engine::CrawlEngine;
use crate::scrapers::types::{DiscoveredPage, SearchPlan};
use crate::scrapers::url_guard::UrlGuard;

/// Spider crawler coordinator for concurrent website link discovery and page streaming.
pub struct SpiderCrawler;

#[derive(Debug, Clone)]
pub struct SpiderCrawlMetrics {
    pub pages_crawled: usize,
    pub bytes_processed: usize,
    pub elapsed_ms: u64,
    pub stopped_by_cancel: bool,
    pub error: Option<String>,
}

impl SpiderCrawler {
    /// Crawls a target academic search plan using the spider crawler engine with page streaming and bounded backpressure.
    pub async fn crawl_plan<F>(
        plan: &SearchPlan,
        cancel: Arc<AtomicBool>,
        mut on_page: F,
    ) -> SpiderCrawlMetrics
    where
        F: FnMut(DiscoveredPage) -> Result<(), String> + Send + 'static,
    {
        let start_time = Instant::now();
        let mut pages_crawled = 0;
        let mut bytes_processed = 0;

        if cancel.load(Ordering::Relaxed) {
            return SpiderCrawlMetrics {
                pages_crawled: 0,
                bytes_processed: 0,
                elapsed_ms: 0,
                stopped_by_cancel: true,
                error: Some("Crawl cancelled before start".to_string()),
            };
        }

        // Validate start URL through Anti-SSRF guard
        let start_url = match UrlGuard::validate_url(&plan.start_url) {
            Ok(u) => u,
            Err(e) => {
                return SpiderCrawlMetrics {
                    pages_crawled: 0,
                    bytes_processed: 0,
                    elapsed_ms: start_time.elapsed().as_millis() as u64,
                    stopped_by_cancel: false,
                    error: Some(format!("Start URL blocked by Anti-SSRF guard: {e}")),
                };
            }
        };

        info!(
            source_id = %plan.source_id,
            start_url = %start_url,
            max_pages = plan.max_pages,
            max_depth = plan.max_depth,
            "Initializing Spider crawler session"
        );

        let mut website = spider::website::Website::new(start_url.as_str());
        website.with_limit(plan.max_pages.clamp(1, 30) as u32);
        website.with_depth(plan.max_depth.clamp(1, 3));

        website.with_delay(plan.delay_ms);
        website.with_respect_robots_txt(true);

        // Subscribe to page streaming channel with bounded capacity
        let mut rx = website.subscribe(32);

        // Spawn spider crawl in background tokio task
        let crawl_task = tokio::spawn(async move {
            website.scrape().await;
        });

        let mut visited_urls: HashSet<String> = HashSet::new();
        visited_urls.insert(start_url.to_string());

        let mut stopped_by_cancel = false;
        let crawl_error = None;

        // Stream pages as they are discovered and downloaded
        while let Ok(page) = rx.recv().await {
            if cancel.load(Ordering::Relaxed) {
                stopped_by_cancel = true;
                crawl_task.abort();
                break;
            }

            let page_url = page.get_url().to_string();

            // Anti-SSRF check on discovered page URL
            if let Err(e) = UrlGuard::validate_url(&page_url) {
                warn!(url = %page_url, error = %e, "Discovered page blocked by Anti-SSRF guard");
                continue;
            }

            // Pagination cycle & duplicate detection
            if !visited_urls.insert(page_url.clone()) {
                continue;
            }

            let html = page.get_html();
            let body_len = html.len();

            // Enforce response body size limit (10MB)
            if body_len > CrawlEngine::MAX_RESPONSE_BODY_BYTES {
                warn!(
                    url = %page_url,
                    size = body_len,
                    "Spider page body exceeded 10MB limit; discarding"
                );
                continue;
            }

            bytes_processed += body_len;
            pages_crawled += 1;

            let disc_page = DiscoveredPage {
                url: page_url,
                html,
                status_code: 200,
                content_type: Some("text/html; charset=utf-8".to_string()),
            };

            if let Err(e) = on_page(disc_page) {
                warn!(error = %e, "Page extraction handler returned error");
            }

            if pages_crawled >= plan.max_pages {
                crawl_task.abort();
                break;
            }
        }

        if !stopped_by_cancel {
            // Await completion or timeout
            let _ = tokio::time::timeout(std::time::Duration::from_secs(10), crawl_task).await;
        }

        SpiderCrawlMetrics {
            pages_crawled,
            bytes_processed,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            stopped_by_cancel,
            error: crawl_error,
        }
    }
}
