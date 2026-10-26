use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixColumnConfig {
    pub key: String,
    pub label: String,
    pub col_type: String,
    pub required: bool,
    pub width: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixWorkspace {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub columns_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixExtraction {
    pub id: String,
    pub workspace_id: String,
    pub paper_id: String,
    pub field_key: String,
    pub extracted_value: String,
    pub confidence: f64,
    pub page_number: Option<i64>,
    pub char_offset_start: Option<i64>,
    pub char_offset_end: Option<i64>,
    pub source_passage: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSource {
    pub paper_id: String,
    pub paper_title: String,
    pub page_number: Option<i64>,
    pub passage: String,
    pub confidence: f64,
    pub char_offset_start: Option<i64>,
    pub char_offset_end: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCopilotSession {
    pub id: String,
    pub title: String,
    pub target_scope: String,
    pub target_paper_id: Option<String>,
    pub workspace_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCopilotMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub evidence_sources_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixRow {
    pub paper_id: String,
    pub paper_title: String,
    pub authors: Vec<String>,
    pub year: Option<i64>,
    pub venue: Option<String>,
    pub doi: Option<String>,
    pub pdf_path: Option<String>,
    pub added_at: String,
    pub extractions: HashMap<String, MatrixExtraction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixWorkspaceDetail {
    pub workspace: MatrixWorkspace,
    pub columns: Vec<MatrixColumnConfig>,
    pub rows: Vec<MatrixRow>,
    pub total_papers: i64,
    pub total_extractions: i64,
}
