use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisJob {
    pub id: String,
    pub job_type: String,
    pub document_hash: String,
    pub status: String,
    pub progress_pct: i32,
    pub current_step: Option<String>,
    pub result_json: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestedDocumentMeta {
    pub document_hash: String,
    pub file_name: String,
    pub file_format: String,
    pub word_count: i64,
    pub char_count: i64,
    pub is_clean_encoding: bool,
    pub existing_report_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedIntegrityReport {
    pub id: String,
    pub document_hash: String,
    pub file_name: String,
    pub title: String,
    pub word_count: i64,
    pub dimensions_json: String,
    pub ethical_disclaimer: String,
    pub findings_count: i64,
    pub unreviewed_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub findings: Vec<IntegrityReportFinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityReportFinding {
    pub id: String,
    pub report_id: String,
    pub dimension: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub severity: String,
    pub confidence: String,
    pub evidence: String,
    pub location: String,
    pub suggested_action: String,
    pub is_reviewed: bool,
    pub reviewed_at: Option<String>,
    pub reviewer_notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedCitationAudit {
    pub id: String,
    pub document_hash: String,
    pub document_title: String,
    pub file_name: String,
    pub total_in_text: i64,
    pub total_references: i64,
    pub matched_citations: i64,
    pub health_score: i64,
    pub summary_json: String,
    pub issues_json: String,
    pub references_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedReadabilityReport {
    pub id: String,
    pub document_hash: String,
    pub document_title: String,
    pub language_code: String,
    pub word_count: i64,
    pub sentence_count: i64,
    pub flesch_reading_ease: f64,
    pub flesch_kincaid_grade: f64,
    pub gunning_fog_index: f64,
    pub metrics_json: String,
    pub vocabulary_json: String,
    pub paragraphs_json: String,
    pub recommendations_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WritingRevisionItem {
    pub id: String,
    pub session_id: String,
    pub revision_number: i64,
    pub action_type: String,
    pub original_text: String,
    pub revised_text: String,
    pub diff_summary: String,
    pub preserved_numbers_ok: bool,
    pub preserved_citations_ok: bool,
    pub preserved_equations_ok: bool,
    pub preserved_dois_ok: bool,
    pub is_accepted: bool,
    pub created_at: String,
}
