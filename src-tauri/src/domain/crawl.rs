use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlProfile {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub description: Option<String>,
    pub allowed_patterns: Vec<String>,
    pub disallowed_patterns: Vec<String>,
    pub paper_link_selectors: Vec<String>,
    pub title_selector: Option<String>,
    pub authors_selector: Option<String>,
    pub abstract_selector: Option<String>,
    pub doi_selector: Option<String>,
    pub date_selector: Option<String>,
    pub venue_selector: Option<String>,
    pub pdf_link_selector: Option<String>,
    pub use_meta_tags: bool,
    pub request_delay_ms: i64,
    pub max_depth: i32,
    pub max_pages: i32,
    pub headers: Option<serde_json::Value>,
    pub is_built_in: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlProfileCreateInput {
    pub id: Option<String>,
    pub name: String,
    pub domain: String,
    pub description: Option<String>,
    pub allowed_patterns: Option<Vec<String>>,
    pub disallowed_patterns: Option<Vec<String>>,
    pub paper_link_selectors: Option<Vec<String>>,
    pub title_selector: Option<String>,
    pub authors_selector: Option<String>,
    pub abstract_selector: Option<String>,
    pub doi_selector: Option<String>,
    pub date_selector: Option<String>,
    pub venue_selector: Option<String>,
    pub pdf_link_selector: Option<String>,
    pub use_meta_tags: Option<bool>,
    pub request_delay_ms: Option<i64>,
    pub max_depth: Option<i32>,
    pub max_pages: Option<i32>,
    pub headers: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlProfileUpdateInput {
    pub name: Option<String>,
    pub domain: Option<String>,
    pub description: Option<String>,
    pub allowed_patterns: Option<Vec<String>>,
    pub disallowed_patterns: Option<Vec<String>>,
    pub paper_link_selectors: Option<Vec<String>>,
    pub title_selector: Option<String>,
    pub authors_selector: Option<String>,
    pub abstract_selector: Option<String>,
    pub doi_selector: Option<String>,
    pub date_selector: Option<String>,
    pub venue_selector: Option<String>,
    pub pdf_link_selector: Option<String>,
    pub use_meta_tags: Option<bool>,
    pub request_delay_ms: Option<i64>,
    pub max_depth: Option<i32>,
    pub max_pages: Option<i32>,
    pub headers: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CrawlJobStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl fmt::Display for CrawlJobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Running => write!(f, "running"),
            Self::Paused => write!(f, "paused"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl FromStr for CrawlJobStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "running" => Ok(Self::Running),
            "paused" => Ok(Self::Paused),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Unknown crawl job status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlJob {
    pub id: String,
    pub profile_id: String,
    pub start_url: String,
    pub status: CrawlJobStatus,
    pub pages_queued: i64,
    pub pages_visited: i64,
    pub pages_failed: i64,
    pub papers_found: i64,
    pub current_depth: i32,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CrawlQueueItemStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Skipped,
}

impl fmt::Display for CrawlQueueItemStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Processing => write!(f, "processing"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Skipped => write!(f, "skipped"),
        }
    }
}

impl FromStr for CrawlQueueItemStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "processing" => Ok(Self::Processing),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "skipped" => Ok(Self::Skipped),
            _ => Err(format!("Unknown crawl queue item status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlQueueItem {
    pub id: String,
    pub job_id: String,
    pub url: String,
    pub depth: i32,
    pub status: CrawlQueueItemStatus,
    pub retry_count: i32,
    pub http_status: Option<i32>,
    pub error_message: Option<String>,
    pub discovered_at: String,
    pub processed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlJobPaper {
    pub id: String,
    pub job_id: String,
    pub paper_id: Option<String>,
    pub url: String,
    pub title: String,
    pub canonical_doi: Option<String>,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub venue: Option<String>,
    pub pdf_url: Option<String>,
    pub is_imported: bool,
    pub discovered_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionPreviewResult {
    pub url: String,
    pub profile_id: Option<String>,
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub canonical_doi: Option<String>,
    pub publication_date: Option<String>,
    pub venue: Option<String>,
    pub pdf_url: Option<String>,
    pub discovered_paper_links: Vec<String>,
    pub extraction_methods_used: Vec<String>,
    pub meta_tags_found: HashMap<String, String>,
    pub warnings: Vec<String>,
}
