use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperIdentifier {
    pub id: String,
    pub paper_id: String,
    pub identifier_type: String, // doi, arxiv, pmid, pmcid, openalex, semantic_scholar, url
    pub canonical_value: String,
    pub raw_value: String,
    pub source_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperFile {
    pub id: String,
    pub paper_id: String,
    pub file_path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_size: i64,
    pub sha256_hash: Option<String>,
    pub verification_status: String, // verified, unverified, corrupt, no_text, encrypted, missing, oversized, failed
    pub page_count: Option<i32>,
    pub extracted_title: Option<String>,
    pub extracted_author: Option<String>,
    pub extracted_text_preview: Option<String>,
    pub extracted_text: Option<String>,
    pub is_primary: bool,
    pub verified_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateCandidate {
    pub id: String,
    pub paper_a_id: String,
    pub paper_b_id: String,
    pub score: f64,
    pub match_tier: String, // exact_match, high_confidence, review_required, distinct
    pub evidence: Vec<String>,
    pub status: String, // pending, merged, kept_separate, deferred
    pub decision_notes: Option<String>,
    pub decided_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateComparisonView {
    pub candidate_id: String,
    pub score: f64,
    pub match_tier: String,
    pub evidence: Vec<String>,
    pub status: String,
    pub paper_a: crate::domain::paper::Paper,
    pub paper_b: crate::domain::paper::Paper,
    pub conflicting_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub candidate_id: Option<String>,
    pub canonical_paper_id: String,
    pub merged_paper_id: String,
    pub preferred_title_source: Option<String>, // "canonical", "incoming", or manual string
    pub preserve_notes: bool,
    pub preserve_tags: bool,
    pub preserve_collections: bool,
    pub merge_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub success: bool,
    pub canonical_paper_id: String,
    pub merged_paper_id: String,
    pub fields_updated: Vec<String>,
    pub files_reassigned: usize,
    pub sources_reassigned: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperMergeHistory {
    pub id: String,
    pub canonical_paper_id: String,
    pub merged_paper_id: String,
    pub field_decisions_json: String,
    pub preserved_records_json: String,
    pub merged_by: String,
    pub merged_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingJob {
    pub id: String,
    pub job_type: String, // metadata_normalization, duplicate_detection, pdf_integrity, batch_pipeline
    pub status: String,   // queued, running, succeeded, succeeded_with_warnings, failed, cancelled
    pub total_items: i32,
    pub completed_items: i32,
    pub failed_items: i32,
    pub warnings_count: i32,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingJobItem {
    pub id: String,
    pub job_id: String,
    pub item_type: String, // paper, file
    pub item_id: String,
    pub stage: String, // normalization, deduplication, hash_verification, text_extraction
    pub status: String, // pending, running, completed, failed, skipped
    pub attempt_count: i32,
    pub error_message: Option<String>,
    pub result_summary_json: Option<String>,
    pub processed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingOverview {
    pub total_papers: i64,
    pub normalized_papers: i64,
    pub total_files: i64,
    pub verified_files: i64,
    pub pending_duplicates_count: i64,
    pub active_jobs_count: i64,
    pub last_processing_time: Option<String>,
}
