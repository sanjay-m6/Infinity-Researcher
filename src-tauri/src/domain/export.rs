use super::paper::PaperListQuery;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Bibtex,
    Ris,
    Csv,
    Json,
}

impl std::str::FromStr for ExportFormat {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "bibtex" | "bib" => Ok(ExportFormat::Bibtex),
            "ris" => Ok(ExportFormat::Ris),
            "csv" => Ok(ExportFormat::Csv),
            "json" => Ok(ExportFormat::Json),
            other => Err(format!("Unsupported export format: {}", other)),
        }
    }
}

impl ExportFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::Bibtex => "bib",
            ExportFormat::Ris => "ris",
            ExportFormat::Csv => "csv",
            ExportFormat::Json => "json",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportScope {
    Selected,
    Filtered,
    Collection,
    All,
}

impl std::str::FromStr for ExportScope {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "selected" => Ok(ExportScope::Selected),
            "filtered" => Ok(ExportScope::Filtered),
            "collection" => Ok(ExportScope::Collection),
            "all" => Ok(ExportScope::All),
            other => Err(format!("Unsupported export scope: {}", other)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportPreview {
    pub format: String,
    pub scope: String,
    pub total_records: usize,
    pub missing_doi_count: usize,
    pub missing_authors_count: usize,
    pub missing_year_count: usize,
    pub missing_abstract_count: usize,
    pub target_filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub format: String,
    pub scope: String,
    pub paper_ids: Option<Vec<String>>,
    pub collection_id: Option<String>,
    pub query: Option<PaperListQuery>,
    pub destination_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub format: String,
    pub output_path: String,
    pub exported_count: usize,
    pub file_size_bytes: u64,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentInspectionStatus {
    pub paper_id: String,
    pub has_local_file: bool,
    pub local_path: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub verification_status: String,
    pub page_count: Option<i32>,
    pub is_text_indexed: bool,
    pub extracted_text_snippet: Option<String>,
}
