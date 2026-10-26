use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProvider {
    pub id: String,
    pub display_name: String,
    pub category: String, // 'local_runtime', 'cloud_hosted', 'custom_endpoint'
    pub endpoint_url: String,
    pub doc_url: String,
    pub auth_type: String, // 'none', 'api_key', 'bearer_token', 'custom_header'
    pub access_category: String, // 'local', 'hosted_free_tier', 'hosted_free_models', 'trial_or_credit', 'paid', 'self_hosted'
    pub credential_ref: Option<String>,
    pub default_model: String,
    pub embedding_model: Option<String>,
    pub reranker_model: Option<String>,
    pub timeout_secs: i64,
    pub max_tokens: i64,
    pub temperature: f64,
    pub context_length: i64,
    pub streaming_enabled: bool,
    pub is_local: bool,
    pub is_enabled: bool,
    pub priority: i64,
    pub last_verified_at: String,
    pub last_health_status: String,
    pub last_health_message: Option<String>,
    pub supported_capabilities: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderTaskRoute {
    pub task_type: String,
    pub provider_id: String,
    pub model_id: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiPaperChunk {
    pub id: String,
    pub paper_id: String,
    pub chunk_index: i64,
    pub page_number: i64,
    pub section_heading: Option<String>,
    pub content_text: String,
    pub token_count: i64,
    pub embedding_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChunkCitation {
    pub chunk_id: String,
    pub paper_id: String,
    pub paper_title: String,
    pub page_number: i64,
    pub section_heading: Option<String>,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRagContext {
    pub query: String,
    pub scope: String, // 'paper', 'library', 'none'
    pub paper_id: Option<String>,
    pub passages: Vec<AiChunkCitation>,
    pub warnings: Vec<String>,
    pub is_grounded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatMessage {
    pub id: String,
    pub session_id: String,
    pub paper_id: Option<String>,
    pub role: String, // 'user', 'assistant', 'system'
    pub content: String,
    pub citations: Vec<AiChunkCitation>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub retrieval_mode: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRecommendation {
    pub id: String,
    pub paper_id: String,
    pub recommended_paper_id: String,
    pub recommended_title: String,
    pub recommended_authors: Vec<String>,
    pub recommended_year: Option<i64>,
    pub recommended_venue: Option<String>,
    pub recommended_doi: Option<String>,
    pub score: f64,
    pub reason: String,
    pub matched_concepts: Vec<String>,
    pub confidence_label: String,
    pub recommendation_mode: String,
    pub feedback_status: String,
    pub feedback_note: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiEvaluationResult {
    pub id: String,
    pub benchmark_suite: String,
    pub provider_id: String,
    pub model_id: String,
    pub total_tests: i64,
    pub passed_tests: i64,
    pub citation_accuracy: f64,
    pub abstention_accuracy: f64,
    pub avg_latency_ms: i64,
    pub details_json: Option<String>,
    pub evaluated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiFinetuningJob {
    pub id: String,
    pub model_name: String,
    pub adapter_name: String,
    pub hardware_check: String,
    pub dataset_size: i64,
    pub train_val_split_ratio: f64,
    pub epochs: i64,
    pub learning_rate: f64,
    pub status: String,
    pub progress_percent: f64,
    pub stage_message: Option<String>,
    pub adapter_path: Option<String>,
    pub eval_loss: Option<f64>,
    pub model_card_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub local_only_mode: bool,
    pub never_use_paid_apis: bool,
    pub cloud_paper_sharing_enabled: bool,
    pub active_rag_scope: String,
    pub default_audience_level: String,
    pub recommendations_diversity_weight: f64,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            local_only_mode: false,
            never_use_paid_apis: true,
            cloud_paper_sharing_enabled: false,
            active_rag_scope: "paper".to_string(),
            default_audience_level: "researcher".to_string(),
            recommendations_diversity_weight: 0.3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTestResult {
    pub provider_id: String,
    pub success: bool,
    pub latency_ms: i64,
    pub message: String,
    pub detected_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequestInput {
    pub prompt: String,
    pub system_instruction: Option<String>,
    pub paper_id: Option<String>,
    pub task_type: Option<String>, // 'quick_summary', 'deep_analysis', etc.
    pub audience_level: Option<String>, // 'beginner', 'researcher', 'expert'
    pub reading_mode: Option<String>,
    pub rag_scope: Option<String>, // 'paper', 'library', 'none'
    pub provider_override: Option<String>,
    pub model_override: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResponseOutput {
    pub text: String,
    pub citations: Vec<AiChunkCitation>,
    pub provider_id: String,
    pub model_id: String,
    pub latency_ms: i64,
    pub is_grounded: bool,
    pub warning: Option<String>,
}
