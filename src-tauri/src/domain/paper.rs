use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub created_at: String,
    pub updated_at: String,

    // Joined associations
    pub authors: Vec<Author>,
    pub collection_ids: Vec<String>,
    pub tags: Vec<String>,
    pub source_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub authors: Vec<String>, // names in order
    pub collection_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub authors: Option<Vec<String>>,
    pub collection_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaperListQuery {
    pub query: Option<String>,
    pub collection_id: Option<String>,
    pub source_id: Option<String>,
    pub year_start: Option<i32>,
    pub year_end: Option<i32>,
    pub open_access_only: Option<bool>,
    pub is_saved_only: Option<bool>,
    pub sort_by: Option<String>, // "newest", "oldest", "citations", "title"
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
