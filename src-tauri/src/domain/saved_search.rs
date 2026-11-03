use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub raw_query: String,
    pub structured_query_json: Option<String>,
    pub selected_sources_json: Option<String>,
    pub filters_json: Option<String>,
    pub sort_by: String,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearchCreateInput {
    pub name: String,
    pub raw_query: String,
    pub structured_query_json: Option<String>,
    pub selected_sources_json: Option<String>,
    pub filters_json: Option<String>,
    pub sort_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearchUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub raw_query: Option<String>,
    pub structured_query_json: Option<String>,
    pub selected_sources_json: Option<String>,
    pub filters_json: Option<String>,
    pub sort_by: Option<String>,
}

