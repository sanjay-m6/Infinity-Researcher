use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityDocument {
    pub id: String,
    pub source_type: String,     // "file", "library_paper", "pasted_text"
    pub source_reference: Option<String>,
    pub file_hash: String,
    pub file_name: String,
    pub file_format: String,    // "pdf", "docx", "txt", "tex", "raw"
    pub file_size_bytes: i64,
    pub raw_content: String,
    pub normalized_content: String,
    pub word_count: i64,
    pub page_count: i64,
    pub extraction_metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSegment {
    pub id: String,
    pub document_id: String,
    pub segment_index: i64,
    pub segment_type: String,   // "paragraph", "section_heading", "abstract", "methodology", "results", "discussion", "references", "boilerplate"
    pub raw_text: String,
    pub normalized_text: String,
    pub char_start: i64,
    pub char_end: i64,
    pub page_number: i64,
    pub embedding_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorpusSource {
    pub id: String,
    pub source_type: String,     // "library_paper", "local_folder", "imported_file", "external_open_access"
    pub source_ref: Option<String>,
    pub title: String,
    pub authors: Option<String>,
    pub venue: Option<String>,
    pub year: Option<i32>,
    pub doi: Option<String>,
    pub canonical_url: Option<String>,
    pub file_path: Option<String>,
    pub content_hash: String,
    pub raw_content: String,
    pub word_count: i64,
    pub fingerprint_count: i64,
    pub is_active: bool,
    pub indexed_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorpusFingerprint {
    pub hash_value: i64,
    pub corpus_source_id: String,
    pub char_offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityRun {
    pub id: String,
    pub document_id: String,
    pub status: String,          // "queued", "running", "completed", "completed_with_warnings", "failed", "cancelled"
    pub total_body_words: i64,
    pub matched_body_words: i64,
    pub overall_similarity_ratio: f32,
    pub corpus_sources_searched: i64,
    pub matched_sources_count: i64,
    pub matches_count: i64,
    pub execution_duration_ms: i64,
    pub error_message: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityMatch {
    pub id: String,
    pub similarity_run_id: String,
    pub corpus_source_id: String,
    pub match_type: String,      // "exact", "fingerprint", "fuzzy", "semantic_candidate"
    pub target_char_start: i64,
    pub target_char_end: i64,
    pub target_page_number: i64,
    pub target_passage: String,
    pub source_char_start: i64,
    pub source_char_end: i64,
    pub source_page_number: i64,
    pub source_passage: String,
    pub overlap_chars: i64,
    pub confidence_score: f32,
    pub review_status: String,   // "unreviewed", "marked_quote", "citation_present", "excluded_boilerplate", "not_a_match"
    pub review_notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityMatchWithSource {
    #[serde(flatten)]
    pub match_data: SimilarityMatch,
    pub source_title: String,
    pub source_authors: Option<String>,
    pub source_doi: Option<String>,
    pub source_canonical_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSignalRun {
    pub id: String,
    pub document_id: String,
    pub model_id: String,
    pub model_version: String,
    pub inference_mode: String,  // "local", "remote"
    pub status: String,          // "not_run", "insufficient_text", "running", "completed", "experimental", "model_unavailable", "failed"
    pub overall_signal_score: Option<f32>,
    pub signal_classification: String, // "unsupported", "insufficient_text", "low_ai_signal", "mixed_signals", "elevated_ai_signal"
    pub analyzed_characters: i64,
    pub analyzed_paragraphs: i64,
    pub uncertainty_caveat: String,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSignalSegment {
    pub id: String,
    pub ai_signal_run_id: String,
    pub segment_id: String,
    pub paragraph_index: i64,
    pub score: f32,
    pub classification: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WritingSession {
    pub id: String,
    pub document_id: String,
    pub title: String,
    pub active_mode: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WritingRevision {
    pub id: String,
    pub session_id: String,
    pub revision_number: i64,
    pub action_type: String,     // "clarity", "academic_tone", "concise", "grammar", "transitions", "structure", "abstract", "methodology", "results_discussion", "conclusion", "simplify"
    pub original_text: String,
    pub revised_text: String,
    pub diff_summary: String,    // JSON string containing count of additions, deletions, modified ranges
    pub preserved_numbers_ok: bool,
    pub preserved_citations_ok: bool,
    pub preserved_equations_ok: bool,
    pub preserved_dois_ok: bool,
    pub meaning_risk_flags: Option<String>,
    pub is_accepted: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityModelDescriptor {
    pub id: String,
    pub model_name: String,
    pub task_type: String,
    pub hf_repo_id: Option<String>,
    pub revision: Option<String>,
    pub license: String,
    pub is_local: bool,
    pub is_available: bool,
    pub size_mb: i64,
    pub evaluation_summary: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityDashboardSummary {
    pub total_documents_analyzed: i64,
    pub total_corpus_sources: i64,
    pub total_fingerprints_indexed: i64,
    pub recent_similarity_runs: Vec<SimilarityRun>,
    pub available_models: Vec<IntegrityModelDescriptor>,
    pub active_writing_sessions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityReport {
    pub run: SimilarityRun,
    pub document: IntegrityDocument,
    pub segments: Vec<DocumentSegment>,
    pub matches: Vec<SimilarityMatchWithSource>,
    pub corpus_coverage_note: String,
    pub formula_explanation: String,
}
