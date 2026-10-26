use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Author {
    pub id: String,
    pub full_name: String,
    pub family_name: Option<String>,
    pub given_name: Option<String>,
    pub orcid: Option<String>,
    pub affiliation: Option<String>,
    pub author_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Paper {
    pub id: String,
    pub canonical_doi: Option<String>,
    pub title: String,
    pub clean_title_key: String,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub venue_type: Option<String>,
    pub language: String,
    pub citation_count: i32,
    pub reference_count: i32,
    pub is_open_access: bool,
    pub license: Option<String>,
    pub primary_landing_url: Option<String>,
    pub pdf_url: Option<String>,
    pub has_file: bool,
    pub local_pdf_path: Option<String>,
    pub content_hash: Option<String>,
    pub metadata_confidence: String,
    pub is_saved: bool,
    #[serde(default = "default_reading_status")]
    pub reading_status: String,
    #[serde(default)]
    pub reading_progress: f64,
    pub created_at: String,
    pub updated_at: String,

    // Open Access & Provenance fields (Migration 0006)
    #[serde(default = "default_open_access_status")]
    pub open_access_status: String,
    #[serde(default = "default_access_evidence_type")]
    pub access_evidence_type: String,
    #[serde(default)]
    pub access_evidence_note: Option<String>,
    #[serde(default)]
    pub license_name: Option<String>,
    #[serde(default)]
    pub license_url: Option<String>,
    #[serde(default)]
    pub source_name: Option<String>,
    #[serde(default = "default_retrieval_method")]
    pub retrieval_method: String,
    #[serde(default)]
    pub access_confirmed_at: Option<String>,

    // Joined associations
    pub authors: Vec<Author>,
    pub collection_ids: Vec<String>,
    pub tags: Vec<String>,
    pub source_names: Vec<String>,
}

pub const OA_STATUS_VERIFIED: &str = "verified_open_access";
pub const OA_STATUS_USER_CONFIRMED: &str = "user_confirmed_open_access";
pub const OA_STATUS_PENDING: &str = "pending_verification";
pub const OA_STATUS_NOT_OA: &str = "not_open_access";
pub const OA_STATUS_DENIED: &str = "access_denied";

pub const EVIDENCE_USER_CONFIRMATION: &str = "user_confirmation";
pub const EVIDENCE_EXPLICIT_SOURCE_LABEL: &str = "explicit_source_label";
pub const EVIDENCE_LICENSE_METADATA: &str = "license_metadata";
pub const EVIDENCE_REPOSITORY_POLICY: &str = "repository_policy";
pub const EVIDENCE_UNKNOWN: &str = "unknown";

pub const RETRIEVAL_IEEE_MANUAL: &str = "ieee_manual_download_import";
pub const RETRIEVAL_PERMITTED_HTML: &str = "permitted_html_connector";
pub const RETRIEVAL_LOCAL_IMPORT: &str = "local_file_import";

fn default_reading_status() -> String {
    "unread".to_string()
}

fn default_open_access_status() -> String {
    OA_STATUS_PENDING.to_string()
}

fn default_access_evidence_type() -> String {
    EVIDENCE_UNKNOWN.to_string()
}

fn default_retrieval_method() -> String {
    RETRIEVAL_LOCAL_IMPORT.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaperCreateInput {
    pub title: String,
    pub canonical_doi: Option<String>,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub venue_type: Option<String>,
    pub language: Option<String>,
    pub is_open_access: Option<bool>,
    pub primary_landing_url: Option<String>,
    pub pdf_url: Option<String>,
    pub is_saved: Option<bool>,
    pub reading_status: Option<String>,
    pub reading_progress: Option<f64>,
    pub open_access_status: Option<String>,
    pub access_evidence_type: Option<String>,
    pub access_evidence_note: Option<String>,
    pub license_name: Option<String>,
    pub license_url: Option<String>,
    pub source_name: Option<String>,
    pub retrieval_method: Option<String>,
    pub access_confirmed_at: Option<String>,
    pub authors: Vec<String>, // names in order
    pub collection_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaperUpdateInput {
    pub id: String,
    pub title: Option<String>,
    pub canonical_doi: Option<String>,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub is_open_access: Option<bool>,
    pub primary_landing_url: Option<String>,
    pub pdf_url: Option<String>,
    pub is_saved: Option<bool>,
    pub reading_status: Option<String>,
    pub reading_progress: Option<f64>,
    pub open_access_status: Option<String>,
    pub access_evidence_type: Option<String>,
    pub access_evidence_note: Option<String>,
    pub license_name: Option<String>,
    pub license_url: Option<String>,
    pub source_name: Option<String>,
    pub retrieval_method: Option<String>,
    pub access_confirmed_at: Option<String>,
    pub authors: Option<Vec<String>>,
    pub collection_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaperListQuery {
    pub query: Option<String>,
    pub collection_id: Option<String>,
    pub tag: Option<String>,
    pub reading_status: Option<String>,
    pub source_id: Option<String>,
    pub year_start: Option<i32>,
    pub year_end: Option<i32>,
    pub open_access_only: Option<bool>,
    pub open_access_status: Option<String>,
    pub retrieval_method: Option<String>,
    pub is_saved_only: Option<bool>,
    pub has_file: Option<bool>,
    pub has_doi: Option<bool>,
    pub sort_by: Option<String>, // "newest", "oldest", "citations", "title", "relevance", "reading_status"
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

/// Helper function to create clean alphanumeric title keys for deduplication
pub fn compute_clean_title_key(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

/// Normalizes DOIs: trims whitespace, removes URL prefixes (e.g. 'https://doi.org/'), converts to lowercase
pub fn normalize_doi(doi: &str) -> Option<String> {
    let trimmed = doi.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_prefix = trimmed
        .strip_prefix("https://doi.org/")
        .or_else(|| trimmed.strip_prefix("http://doi.org/"))
        .or_else(|| trimmed.strip_prefix("doi:"))
        .unwrap_or(trimmed)
        .trim();

    if without_prefix.starts_with("10.") {
        Some(without_prefix.to_lowercase())
    } else {
        Some(without_prefix.to_string())
    }
}
