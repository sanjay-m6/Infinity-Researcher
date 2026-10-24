use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color_hex: String,
    pub paper_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionCreateInput {
    pub name: String,
    pub description: Option<String>,
    pub color_hex: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionUpdateInput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color_hex: Option<String>,
}
