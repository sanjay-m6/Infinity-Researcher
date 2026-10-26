pub mod adapters;
pub mod dedup;
pub mod engine;
pub mod extractor;
pub mod job_guard;
pub mod query_search;
pub mod robots;
pub mod spider_crawler;
pub mod types;
pub mod url_guard;

pub use adapters::{SourceAdapter, SourceRegistry};
pub use dedup::{
    compute_relevance_score, deduplicate_and_rank_results, normalize_doi, normalize_title,
};
pub use engine::CrawlEngine;
pub use extractor::HtmlExtractor;
pub use job_guard::SearchJobGuard;
pub use query_search::*;
pub use robots::{RobotsCache, RobotsTxt};
pub use spider_crawler::{SpiderCrawlMetrics, SpiderCrawler};
pub use types::*;
pub use url_guard::{UrlGuard, UrlValidationError};
