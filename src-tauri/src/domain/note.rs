use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub paper_id: String,
    pub title: String,
    pub content_markdown: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteSaveInput {
    pub id: Option<String>,
    pub paper_id: String,
    pub title: Option<String>,
    pub content_markdown: String,
}
