use serde::{Deserialize, Serialize};

/// Standardized PDF availability states matching legal discovery and retrieval logic
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PdfAvailabilityStatus {
    Unknown,
    Checking,
    OpenAccessAvailable,
    VerifiedOpenAccess,
    VerifiedAuthorizedAccess,
    DownloadQueued,
    Downloading,
    Downloaded,
    MetadataOnly,
    PublicMetadataOnly,
    LandingPageOnly,
    RestrictedOrSubscription,
    AccessRestricted,
    AuthenticationRequired,
    SourceUnverified,
    NotFound,
    BlockedByPolicy,
    FailedRetryable,
    FailedPermanent,
    RetrievalFailed,
    LocalFileMissing,
    FileCorrupt,
}

impl PdfAvailabilityStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Checking => "checking",
            Self::OpenAccessAvailable => "open_access_available",
            Self::VerifiedOpenAccess => "verified_open_access",
            Self::VerifiedAuthorizedAccess => "verified_authorized_access",
            Self::DownloadQueued => "download_queued",
            Self::Downloading => "downloading",
            Self::Downloaded => "downloaded",
            Self::MetadataOnly => "metadata_only",
            Self::PublicMetadataOnly => "public_metadata_only",
            Self::LandingPageOnly => "landing_page_only",
            Self::RestrictedOrSubscription => "restricted_or_subscription",
            Self::AccessRestricted => "access_restricted",
            Self::AuthenticationRequired => "authentication_required",
            Self::SourceUnverified => "source_unverified",
            Self::NotFound => "not_found",
            Self::BlockedByPolicy => "blocked_by_policy",
            Self::FailedRetryable => "failed_retryable",
            Self::FailedPermanent => "failed_permanent",
            Self::RetrievalFailed => "retrieval_failed",
            Self::LocalFileMissing => "local_file_missing",
            Self::FileCorrupt => "file_corrupt",
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::Unknown => "Status Unknown",
            Self::Checking => "Checking Availability...",
            Self::OpenAccessAvailable => "Open Access PDF Available",
            Self::VerifiedOpenAccess => "Verified Open Access",
            Self::VerifiedAuthorizedAccess => "Verified Authorized Access",
            Self::DownloadQueued => "Download Queued",
            Self::Downloading => "Downloading PDF...",
            Self::Downloaded => "Local PDF Ready",
            Self::MetadataOnly => "Metadata Only",
            Self::PublicMetadataOnly => "Public Metadata Only",
            Self::LandingPageOnly => "Landing Page Only",
            Self::RestrictedOrSubscription => "Access Restricted",
            Self::AccessRestricted => "Access Restricted (Publisher Closed)",
            Self::AuthenticationRequired => "Login Required",
            Self::SourceUnverified => "Source Unverified",
            Self::NotFound => "PDF Not Found from Checked Sources",
            Self::BlockedByPolicy => "Blocked by Policy",
            Self::FailedRetryable => "Download Failed (Retryable)",
            Self::FailedPermanent => "Download Failed",
            Self::RetrievalFailed => "Retrieval Failed",
            Self::LocalFileMissing => "Local File Missing",
            Self::FileCorrupt => "File Corrupted",
        }
    }
}

/// Durable Download Queue Job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadJob {
    pub id: String,
    pub paper_id: String,
    pub paper_title: String,
    pub url: String,
    pub source_id: String,
    pub status: String, // queued, resolving, downloading, validating, verifying_identity, completed, failed, cancelling, cancelled
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub progress_percent: f64,
    pub stage_message: String,
    pub error_message: Option<String>,
    pub destination_path: Option<String>,
    pub sha256_hash: Option<String>,
    pub retry_count: u32,
    pub speed_bps: Option<u64>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_category: Option<String>,
    #[serde(default)]
    pub version_type: Option<String>,
    #[serde(default)]
    pub identity_status: Option<String>,
    #[serde(default)]
    pub identity_score: Option<f64>,
    #[serde(default)]
    pub identity_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Discovered PDF candidate URL with provenance and access evidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfCandidate {
    pub id: String,
    pub paper_id: String,
    pub url: String,
    pub provider_id: String,
    pub source_type: String, // direct_api, open_access_resolver, landing_page_meta
    pub access_status: PdfAvailabilityStatus,
    pub evidence_notes: Option<String>,
    #[serde(default)]
    pub version_type: Option<String>,
    #[serde(default)]
    pub identity_status: Option<String>,
    #[serde(default)]
    pub identity_score: Option<f64>,
    #[serde(default)]
    pub provenance_json: Option<String>,
    pub last_checked_at: String,
    pub created_at: String,
}

/// Comprehensive outcome of a PDF resolution sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfResolutionResult {
    pub paper_id: String,
    pub status: PdfAvailabilityStatus,
    pub best_url: Option<String>,
    pub candidates: Vec<PdfCandidate>,
    pub evidence: Vec<String>,
    pub local_file_path: Option<String>,
    pub sha256_hash: Option<String>,
}

/// Persistent user reader state for embedded PDF viewer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReaderState {
    pub paper_id: String,
    pub file_id: Option<String>,
    pub last_page: u32,
    pub zoom_level: f64,
    pub rotation: i32,
    pub updated_at: String,
}

/// Safe file inspection metadata for embedded PDF viewer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperPdfInfo {
    pub paper_id: String,
    pub file_id: Option<String>,
    pub has_local_file: bool,
    pub file_name: Option<String>,
    pub byte_size: Option<u64>,
    pub sha256_hash: Option<String>,
    pub verification_status: String,
    pub page_count: Option<i32>,
    pub is_text_indexed: bool,
    pub last_page: u32,
    pub zoom_level: f64,
    pub rotation: i32,
    pub access_status: PdfAvailabilityStatus,
    pub download_url: Option<String>,
    #[serde(default)]
    pub version_type: Option<String>,
    #[serde(default)]
    pub identity_status: Option<String>,
    #[serde(default)]
    pub identity_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnqueueDownloadInput {
    pub paper_id: String,
    pub paper_title: String,
    pub url: String,
    pub source_id: String,
    #[serde(default)]
    pub version_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownloadRequest {
    pub paper_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownloadSummary {
    pub enqueued: usize,
    pub skipped: usize,
    pub failed: usize,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStorageMetrics {
    pub storage_path: String,
    pub total_bytes: u64,
    pub pdf_count: usize,
    pub temp_files_count: usize,
    pub temp_files_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanOrphanedResult {
    pub files_deleted: usize,
    pub bytes_freed: u64,
}
