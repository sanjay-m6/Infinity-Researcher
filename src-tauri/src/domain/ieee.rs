use crate::domain::paper::Paper;
use serde::{Deserialize, Serialize};

/// Input payload for manual import of an IEEE Xplore Open Access PDF.
/// Note: Under IEEE Xplore terms, intelligent agents are prohibited from automated crawling/downloading.
/// This manual import requires `user_confirmed_oa: true` indicating the user has verified Open Access status in IEEE Xplore.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IeeeManualImportInput {
    pub file_path: String,
    pub title: String,
    pub authors: Vec<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub canonical_doi: Option<String>,
    pub source_page_url: Option<String>,
    pub license_name: Option<String>,
    pub license_url: Option<String>,
    pub user_confirmed_oa: bool,
    pub user_notes: Option<String>,
    pub target_collection_id: Option<String>,
}

/// Generic input payload for manual local PDF import with Open Access confirmation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalOaPdfImportInput {
    pub file_path: String,
    pub title: String,
    pub authors: Vec<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub canonical_doi: Option<String>,
    pub source_name: Option<String>,
    pub source_page_url: Option<String>,
    pub license_name: Option<String>,
    pub license_url: Option<String>,
    pub user_confirmed_oa: bool,
    pub user_notes: Option<String>,
    pub target_collection_id: Option<String>,
}

/// Statistics covering Open Access papers, provenance, and integrity in the library.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAccessStats {
    pub total_oa_papers: i64,
    pub ieee_imported_papers: i64,
    pub permitted_downloads: i64,
    pub pending_verification_count: i64,
    pub missing_or_corrupt_count: i64,
}

/// Result returned following a successful or duplicate PDF import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPdfResult {
    pub paper: Paper,
    pub is_duplicate: bool,
    pub duplicate_paper_id: Option<String>,
    pub file_size_bytes: u64,
    pub content_hash: String,
    pub storage_path: String,
}
