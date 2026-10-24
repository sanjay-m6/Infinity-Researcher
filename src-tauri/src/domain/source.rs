use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    pub name: String,
    pub source_type: String,
    pub tier: String,
    pub base_url: String,
    pub policy_url: Option<String>,
    pub notes: Option<String>,
    pub is_enabled: bool,
    pub rate_limit_rps: i32,
    pub concurrency_limit: i32,
    pub created_at: String,
    pub updated_at: String,
}
