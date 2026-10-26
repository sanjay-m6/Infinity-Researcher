use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchJobState {
    Created,
    Running,
    Completed,
    CompletedWithErrors,
    NoResults,
    Failed,
    Cancelling,
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceErrorCategory {
    Timeout,
    Blocked,
    RateLimited,
    Unsupported,
    Network,
    ParseError,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaginationStrategy {
    None,
    QueryOffset { param_name: String, step: usize },
    PageParam { param_name: String },
    FollowNextLink { selector: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPlan {
    pub source_id: String,
    pub start_url: String,
    pub query: String,
    pub allowed_domain: String,
    pub max_pages: usize,
    pub max_depth: usize,
    pub delay_ms: u64,
    pub pagination_strategy: PaginationStrategy,
}

#[derive(Debug, Clone)]
pub struct DiscoveredPage {
    pub url: String,
    pub html: String,
    pub status_code: u16,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCapabilities {
    pub supports_query: bool,
    pub supports_years: bool,
    pub supports_authors: bool,
    pub supports_open_access_filter: bool,
    pub provides_direct_pdf: bool,
    pub provides_doi: bool,
    pub rate_limit_ms: u64,
    #[serde(default = "default_search_support")]
    pub search_support: String, // "supported", "conditional", "url_only", "manual_only"
    #[serde(default)]
    pub requires_browser_rendering: bool,
    #[serde(default = "default_max_pages")]
    pub max_pages_per_job: usize,
}

fn default_search_support() -> String {
    "supported".to_string()
}

fn default_max_pages() -> usize {
    15
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteSearchQuery {
    pub query: String,
    pub sources: Option<Vec<String>>,
    pub year_start: Option<i32>,
    pub year_end: Option<i32>,
    pub content_type: Option<String>,
    pub open_access_only: Option<bool>,
    pub author: Option<String>,
    pub limit_per_source: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredSearchResult {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub canonical_doi: Option<String>,
    pub abstract_text: Option<String>,
    pub landing_url: String,
    pub pdf_url: Option<String>,
    pub source_id: String,
    pub source_name: String,
    pub content_type: String,
    pub is_open_access: bool,
    pub license_name: Option<String>,
    pub peer_reviewed: Option<bool>,
    pub subject_tags: Vec<String>,
    pub language: Option<String>,
    pub relevance_score: f32,
    #[serde(default)]
    pub provenance_urls: Vec<String>,
    #[serde(default)]
    pub metadata_confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteSourceDescriptor {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub status: String, // "enabled", "disabled", "manual_only"
    pub policy_url: String,
    pub policy_notes: String,
    pub supports_native_years: bool,
    pub request_delay_ms: u64,
    pub content_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSearchStatus {
    pub source_id: String,
    pub source_name: String,
    pub status: String, // "queued", "searching", "extracting", "completed", "failed", "blocked", "disabled", "manual_only", "no_results", "cancelled", "timeout"
    pub message: Option<String>,
    pub results_count: usize,
    pub elapsed_ms: u64,
    #[serde(default)]
    pub error_category: Option<SourceErrorCategory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteSearchResponse {
    pub results: Vec<DiscoveredSearchResult>,
    pub source_statuses: Vec<SourceSearchStatus>,
    pub total_results: usize,
    pub completed_at: String,
}

fn default_schema_version() -> String {
    "2.1".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(clippy::large_enum_variant)]
pub enum SearchStreamEvent {
    SearchStarted {
        session_id: String,
        query: String,
        sources: Vec<String>,
        #[serde(default = "default_schema_version")]
        schema_version: String,
    },
    SourceStarted {
        session_id: String,
        source_id: String,
        source_name: String,
    },
    SourceProgress {
        session_id: String,
        source_id: String,
        pages_crawled: usize,
        papers_found: usize,
    },
    SourceStatus {
        session_id: String,
        source_id: String,
        source_name: String,
        status: String,
        message: Option<String>,
        results_count: usize,
        elapsed_ms: u64,
    },
    PaperFound {
        session_id: String,
        source_id: String,
        paper: DiscoveredSearchResult,
    },
    PaperUpdated {
        session_id: String,
        source_id: String,
        paper_id: String,
    },
    SourceCompleted {
        session_id: String,
        source_id: String,
        count: usize,
        elapsed_ms: u64,
    },
    SourceFailed {
        session_id: String,
        source_id: String,
        message: String,
        error_category: SourceErrorCategory,
        elapsed_ms: u64,
    },
    SearchProgress {
        session_id: String,
        completed_sources: usize,
        total_sources: usize,
        total_papers: usize,
    },
    SearchCompleted {
        session_id: String,
        total_unique: usize,
        duration_ms: u64,
    },
    SearchCompletedWithErrors {
        session_id: String,
        total_unique: usize,
        failed_sources: Vec<String>,
        duration_ms: u64,
    },
    SearchNoResults {
        session_id: String,
        duration_ms: u64,
    },
    SearchFailed {
        session_id: String,
        error: String,
        duration_ms: u64,
    },
    SearchCancelled {
        session_id: String,
        total_unique: usize,
        duration_ms: u64,
    },
    SearchTimedOut {
        session_id: String,
        total_unique: usize,
        duration_ms: u64,
    },
    SearchError {
        session_id: String,
        source_id: Option<String>,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceDiagnosticInfo {
    pub source_id: String,
    pub source_name: String,
    pub status: String,
    pub total_requests: usize,
    pub successful_requests: usize,
    pub failed_requests: usize,
    pub total_papers_found: usize,
    pub last_elapsed_ms: u64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchJobSummary {
    pub session_id: String,
    pub query: String,
    pub sources: Vec<String>,
    pub state: SearchJobState,
    pub total_results: usize,
    pub duration_ms: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineDiagnostics {
    pub engine_version: String,
    pub engine_status: String,
    pub uptime_seconds: u64,
    pub total_searches: usize,
    pub successful_searches: usize,
    pub failed_searches: usize,
    pub cancelled_searches: usize,
    pub active_sessions: usize,
    pub sources: Vec<SourceDiagnosticInfo>,
    pub recent_jobs: Vec<SearchJobSummary>,
}
