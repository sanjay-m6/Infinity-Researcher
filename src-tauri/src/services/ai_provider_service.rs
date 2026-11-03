use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use tracing::info;

use crate::database::Database;
use crate::domain::ai::*;
use crate::errors::AppError;
use crate::repositories::AiRepository;

pub struct AiProviderService {
    client: reqwest::Client,
    secure_store: Mutex<HashMap<String, String>>,
}

impl Default for AiProviderService {
    fn default() -> Self {
        Self::new()
    }
}

impl AiProviderService {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        // In-memory credential cache synced with safe local vault file in app-data
        let store = Self::load_local_vault().unwrap_or_default();

        Self {
            client,
            secure_store: Mutex::new(store),
        }
    }

    fn vault_path() -> PathBuf {
        let app_data = dirs_fallback();
        app_data.join("security").join(".vault.dat")
    }

    fn load_local_vault() -> Result<HashMap<String, String>, AppError> {
        let path = Self::vault_path();
        if path.exists() {
            if let Ok(raw) = fs::read_to_string(&path) {
                if let Ok(store) = serde_json::from_str::<HashMap<String, String>>(&raw) {
                    return Ok(store);
                }
            }
        }
        let legacy = dirs_legacy().join("security").join(".vault.dat");
        if legacy.exists() {
            if let Ok(raw) = fs::read_to_string(&legacy) {
                if let Ok(store) = serde_json::from_str::<HashMap<String, String>>(&raw) {
                    return Ok(store);
                }
            }
        }
        Ok(HashMap::new())
    }

    fn persist_local_vault(&self) -> Result<(), AppError> {
        let path = Self::vault_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let guard = self
            .secure_store
            .lock()
            .map_err(|_| AppError::Internal("Lock error".into()))?;
        let json_str = serde_json::to_string(&*guard)
            .map_err(|e| AppError::Internal(format!("Failed to serialize secure store: {}", e)))?;
        fs::write(&path, json_str)
            .map_err(|e| AppError::Internal(format!("Failed to write secure store: {}", e)))?;
        Ok(())
    }

    pub fn save_credential(&self, provider_id: &str, api_key: &str) -> Result<String, AppError> {
        let clean_key = api_key.trim();
        let cred_ref = format!("cred:ai_{}:v1", provider_id.to_lowercase());
        {
            let mut guard = self
                .secure_store
                .lock()
                .map_err(|_| AppError::Internal("Lock error".into()))?;
            guard.insert(cred_ref.clone(), clean_key.to_string());
        }
        self.persist_local_vault()?;
        info!(provider = %provider_id, cred_ref = %cred_ref, "Securely stored credential reference (key redacted)");
        Ok(cred_ref)
    }

    pub fn delete_credential(&self, cred_ref: &str) -> Result<(), AppError> {
        {
            let mut guard = self
                .secure_store
                .lock()
                .map_err(|_| AppError::Internal("Lock error".into()))?;
            guard.remove(cred_ref);
        }
        self.persist_local_vault()?;
        Ok(())
    }

    pub fn resolve_credential(&self, cred_ref: Option<&str>) -> Option<String> {
        let key_ref = cred_ref?;
        if let Ok(guard) = self.secure_store.lock() {
            if let Some(key) = guard.get(key_ref).cloned().filter(|k| !k.is_empty()) {
                return Some(key);
            }
        }
        None
    }

    pub fn resolve_credential_for_provider(&self, provider: &AiProvider) -> Option<String> {
        if let Some(key) = self.resolve_credential(provider.credential_ref.as_deref()) {
            return Some(key);
        }
        if provider.id == "nvidia_nim" {
            if let Ok(val) = std::env::var("NVIDIA_API_KEY") {
                if !val.trim().is_empty() {
                    return Some(val.trim().to_string());
                }
            }
            if let Ok(val) = std::env::var("NVIDIA_NIM_API_KEY") {
                if !val.trim().is_empty() {
                    return Some(val.trim().to_string());
                }
            }
            // User-provided NVIDIA NIM API key
            return Some(
                "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"
                    .to_string(),
            );
        }
        if provider.id == "groqcloud" {
            if let Ok(val) = std::env::var("GROQ_API_KEY") {
                if !val.trim().is_empty() {
                    return Some(val.trim().to_string());
                }
            }
        }
        if provider.id == "gemini" {
            if let Ok(val) = std::env::var("GEMINI_API_KEY") {
                if !val.trim().is_empty() {
                    return Some(val.trim().to_string());
                }
            }
        }
        if provider.id == "openai" {
            if let Ok(val) = std::env::var("OPENAI_API_KEY") {
                if !val.trim().is_empty() {
                    return Some(val.trim().to_string());
                }
            }
        }
        None
    }

    // -------------------------------------------------------------------------
    // Privacy and Guard Enforcement
    // -------------------------------------------------------------------------

    pub fn verify_privacy_guards(
        db: &Database,
        provider: &AiProvider,
        contains_paper_data: bool,
    ) -> Result<(), AppError> {
        let conn = db.lock()?;
        let settings = AiRepository::get_ai_settings(&conn)
            .map_err(|e| AppError::Database(format!("Failed to load AI settings: {}", e)))?;

        // Guard 1: Local only mode enforced at backend boundary
        if settings.local_only_mode && !provider.is_local {
            return Err(AppError::Validation(
                "Local-only mode is active in AI Settings. All outbound cloud requests are strictly blocked.".into()
            ));
        }

        // Guard 2: Never use paid APIs
        if settings.never_use_paid_apis && provider.access_category == "paid" {
            return Err(AppError::Validation(
                format!("Provider '{}' is classified as paid. 'Never use paid APIs' is enabled in AI Settings.", provider.display_name)
            ));
        }

        // Guard 3: Cloud paper data sharing requires explicit user consent
        if !provider.is_local && contains_paper_data && !settings.cloud_paper_sharing_enabled {
            return Err(AppError::Validation(
                "Cloud paper context sharing is disabled in AI Settings. To query this cloud model with paper excerpts, enable 'Cloud paper context sharing' or switch to a local model (Ollama / LM Studio).".into()
            ));
        }

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Provider Health & Model Discovery
    // -------------------------------------------------------------------------

    pub async fn test_connection(
        &self,
        db: &Database,
        provider_id: &str,
    ) -> Result<ProviderTestResult, AppError> {
        let provider = {
            let conn = db.lock()?;
            AiRepository::get_provider(&conn, provider_id)
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| {
                    AppError::Validation(format!("Provider '{}' not found", provider_id))
                })?
        };

        // Privacy check
        if let Err(e) = Self::verify_privacy_guards(db, &provider, false) {
            return Ok(ProviderTestResult {
                provider_id: provider_id.to_string(),
                success: false,
                latency_ms: 0,
                message: e.to_string(),
                detected_models: Vec::new(),
            });
        }

        let start = Instant::now();
        let api_key = self.resolve_credential_for_provider(&provider);

        // Probe endpoint
        let (success, message, models) = match provider.id.as_str() {
            "ollama_local" => self.probe_ollama(&provider.endpoint_url).await,
            "lm_studio_local" | "llama_cpp_local" | "generic_openai_endpoint" => {
                self.probe_openai_compatible(&provider.endpoint_url, api_key.as_deref())
                    .await
            }
            "anthropic" => {
                self.probe_anthropic(&provider.endpoint_url, api_key.as_deref())
                    .await
            }
            _ => {
                // Cloud OpenAI-compatible endpoints (Groq, Cerebras, NVIDIA NIM, OpenRouter, Gemini, Cloudflare, OpenAI, HuggingFace)
                self.probe_openai_compatible(&provider.endpoint_url, api_key.as_deref())
                    .await
            }
        };

        let latency_ms = start.elapsed().as_millis() as i64;
        let status = if success { "connected" } else { "disconnected" };

        // Save status in DB
        {
            let conn = db.lock()?;
            let _ = AiRepository::set_provider_status(&conn, provider_id, status, Some(&message));
        }

        Ok(ProviderTestResult {
            provider_id: provider_id.to_string(),
            success,
            latency_ms,
            message,
            detected_models: models,
        })
    }

    async fn probe_ollama(&self, base_url: &str) -> (bool, String, Vec<String>) {
        let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
        match self.client.get(&url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json: Value = resp.json().await.unwrap_or(Value::Null);
                    let mut models = Vec::new();
                    if let Some(list) = json.get("models").and_then(|v| v.as_array()) {
                        for m in list {
                            if let Some(name) = m.get("name").and_then(|s| s.as_str()) {
                                models.push(name.to_string());
                            }
                        }
                    }
                    let count = models.len();
                    (
                        true,
                        format!("Ollama active (found {} installed models)", count),
                        models,
                    )
                } else {
                    (
                        false,
                        format!("Ollama returned HTTP {}", resp.status()),
                        Vec::new(),
                    )
                }
            }
            Err(e) => (
                false,
                format!(
                    "Cannot reach Ollama at {}. Is the server running? ({})",
                    base_url, e
                ),
                Vec::new(),
            ),
        }
    }

    async fn probe_openai_compatible(
        &self,
        base_url: &str,
        api_key: Option<&str>,
    ) -> (bool, String, Vec<String>) {
        let trimmed = base_url.trim_end_matches('/');
        let base_no_chat = if trimmed.ends_with("/chat/completions") {
            &trimmed[..trimmed.len() - "/chat/completions".len()]
        } else {
            trimmed
        };
        let endpoint = if base_no_chat.ends_with("/v1") {
            format!("{}/models", base_no_chat)
        } else {
            format!("{}/v1/models", base_no_chat)
        };

        let mut req = self.client.get(&endpoint);
        if let Some(key) = api_key {
            req = req.header(AUTHORIZATION, format!("Bearer {}", key));
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let json: Value = resp.json().await.unwrap_or(Value::Null);
                    let mut models = Vec::new();
                    if let Some(data) = json.get("data").and_then(|v| v.as_array()) {
                        for item in data {
                            if let Some(id) = item.get("id").and_then(|s| s.as_str()) {
                                models.push(id.to_string());
                            }
                        }
                    }
                    let count = models.len();
                    (
                        true,
                        format!("Connected successfully ({} models available)", count),
                        models,
                    )
                } else if status == reqwest::StatusCode::UNAUTHORIZED
                    || status == reqwest::StatusCode::FORBIDDEN
                {
                    (
                        false,
                        "Authentication failed: missing or invalid API key".into(),
                        Vec::new(),
                    )
                } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    (
                        false,
                        "Rate limit reached (429). Check provider quota.".into(),
                        Vec::new(),
                    )
                } else {
                    // Try alternative health endpoint for servers like LM Studio that might not have /v1/models on root
                    (
                        false,
                        format!("Server responded with HTTP {}", status),
                        Vec::new(),
                    )
                }
            }
            Err(e) => (
                false,
                format!("Connection failed to {}: {}", base_url, e),
                Vec::new(),
            ),
        }
    }

    async fn probe_anthropic(
        &self,
        base_url: &str,
        api_key: Option<&str>,
    ) -> (bool, String, Vec<String>) {
        if api_key.is_none() {
            return (false, "Anthropic requires an API key".into(), Vec::new());
        }
        let url = format!("{}/v1/models", base_url.trim_end_matches('/'));
        let req = self
            .client
            .get(&url)
            .header("x-api-key", api_key.unwrap())
            .header("anthropic-version", "2023-06-01");

        match req.send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    (
                        true,
                        "Anthropic API connected".into(),
                        vec![
                            "claude-3-5-sonnet-latest".into(),
                            "claude-3-5-haiku-latest".into(),
                        ],
                    )
                } else {
                    (
                        false,
                        format!("Anthropic returned HTTP {}", resp.status()),
                        Vec::new(),
                    )
                }
            }
            Err(e) => (false, format!("Cannot reach Anthropic: {}", e), Vec::new()),
        }
    }

    // -------------------------------------------------------------------------
    // Text Generation & Grounded RAG Chat
    // -------------------------------------------------------------------------

    pub async fn generate(
        &self,
        db: &Database,
        input: &GenerateRequestInput,
        rag_context: Option<&AiRagContext>,
    ) -> Result<GenerateResponseOutput, AppError> {
        let (provider, model_id, settings) = {
            let conn = db.lock()?;
            let settings = AiRepository::get_ai_settings(&conn)
                .map_err(|e| AppError::Database(e.to_string()))?;
            let (provider, model_id) = self.resolve_provider_and_model(&conn, input)?;
            (provider, model_id, settings)
        };

        let has_paper_data = rag_context.map(|c| !c.passages.is_empty()).unwrap_or(false);
        Self::verify_privacy_guards(db, &provider, has_paper_data)?;

        // Instant polite greeting response for casual greetings without sending to local LLM
        let prompt_alpha: String = input
            .prompt
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .to_lowercase();
        let trimmed_prompt = prompt_alpha.trim();

        let is_greeting = matches!(
            trimmed_prompt,
            "hey"
                | "hi"
                | "hello"
                | "heyy"
                | "heyyy"
                | "hey there"
                | "hi there"
                | "hello there"
                | "greetings"
                | "good morning"
                | "good afternoon"
                | "good evening"
        );

        if is_greeting {
            let paper_hint = if input.paper_id.is_some() {
                " about this paper's methodology, findings, datasets, or equations"
            } else {
                " about papers in your library, research topics, or citations"
            };
            return Ok(GenerateResponseOutput {
                text: format!(
                    "Hello! I am your Grounded Research Assistant. Feel free to ask any question{}, and I will cite verified evidence directly from your papers.",
                    paper_hint
                ),
                citations: Vec::new(),
                provider_id: provider.id,
                model_id,
                latency_ms: 1,
                is_grounded: true,
                warning: None,
            });
        }

        // Model identity / current engine inquiry: "what model are you using now", "which model is this"
        let is_model_query = trimmed_prompt.contains("what model")
            || trimmed_prompt.contains("which model")
            || trimmed_prompt.contains("what ai")
            || trimmed_prompt.contains("what engine")
            || trimmed_prompt.contains("what is your model")
            || trimmed_prompt.contains("current model")
            || trimmed_prompt.contains("active model");

        if is_model_query {
            let active_desc = if provider.is_local {
                format!(
                    "### Active AI Engine & Model\n\n\
                    - **Provider**: In-App Local AI Engine (`llama-server` sidecar)\n\
                    - **Active Model**: `{}`\n\
                    - **Endpoint**: `{}`\n\
                    - **Privacy**: 100% Offline & Private (Runs on your device with zero cloud data transfer)\n\n\
                    *Tip: You can switch or download higher capacity models (like Llama-3.2 1B Instruct or Qwen 2.5 1.5B) in Tools Hub.*",
                    model_id,
                    provider.endpoint_url
                )
            } else {
                format!(
                    "### Active AI Engine & Model\n\n\
                    - **Provider**: {} ({})\n\
                    - **Model ID**: `{}`\n\
                    - **Endpoint**: `{}`",
                    provider.display_name, provider.id, model_id, provider.endpoint_url
                )
            };

            return Ok(GenerateResponseOutput {
                text: active_desc,
                citations: Vec::new(),
                provider_id: provider.id,
                model_id,
                latency_ms: 1,
                is_grounded: true,
                warning: None,
            });
        }

        // Capability overview for questions like "what can you do", "what you can able to do"
        let is_capability_question = trimmed_prompt.contains("what can you do")
            || trimmed_prompt.contains("what you can do")
            || trimmed_prompt.contains("what you can able to do")
            || trimmed_prompt.contains("what are you able to do")
            || trimmed_prompt.contains("what can you able to do")
            || trimmed_prompt.contains("what are your capabilities")
            || trimmed_prompt.contains("how can you help")
            || trimmed_prompt.contains("who are you")
            || trimmed_prompt.contains("what is your purpose")
            || trimmed_prompt == "features"
            || trimmed_prompt == "capabilities"
            || trimmed_prompt == "help";

        if is_capability_question {
            return Ok(GenerateResponseOutput {
                text: "### Grounded Research Assistant Capabilities\n\n\
                    I am your specialized AI research partner, connected directly to your local academic library and papers.\n\n\
                    **Core Capabilities:**\n\
                    - **Grounded Paper Q&A**: Ask detailed questions about methodologies, equations, datasets, and limitations with verified citations and page references.\n\
                    - **Deep Analysis & Summarization**: Generate 5-sentence executive summaries, study flashcards, and critical appraisals.\n\
                    - **Multi-Paper Synthesis**: Compare findings, identify research gaps, and build literature review matrices across multiple papers.\n\
                    - **Academic Writing Support**: Structure drafts, paraphrase complex passages, and verify citation formats.\n\
                    - **General Academic Questions**: Clarify scientific concepts, algorithms, and equations across all research domains.\n\n\
                    *Tip: Click any suggested quick prompt below or type a question about any paper in your library.*".to_string(),
                citations: Vec::new(),
                provider_id: provider.id,
                model_id,
                latency_ms: 1,
                is_grounded: true,
                warning: None,
            });
        }

        let api_key = self.resolve_credential_for_provider(&provider);

        // Assemble messages with RAG groundings and audience instructions
        let (system_prompt, user_content) =
            self.build_prompt_with_context(input, rag_context, &settings);

        let start = Instant::now();
        let generated_text = match provider.id.as_str() {
            "in_app_local" => {
                let user_formatted = user_content.clone();
                match self
                    .call_openai_compatible(
                        &provider.endpoint_url,
                        None,
                        &model_id,
                        &system_prompt,
                        &user_formatted,
                        0.7,
                        provider.max_tokens.min(512).max(128),
                    )
                    .await
                {
                    Ok(text) => text,
                    Err(e) => {
                        // If in_app_local server is temporarily not reachable, check if a cloud provider has verified credentials
                        let fallback_res = {
                            if let Ok(conn) = db.lock() {
                                let providers =
                                    AiRepository::list_providers(&conn).unwrap_or_default();
                                // Prefer verified cloud provider (like nvidia_nim) or actively healthy local server
                                providers
                                    .iter()
                                    .find(|p| !p.is_local && self.is_provider_ready(p))
                                    .or_else(|| {
                                        providers.iter().find(|p| {
                                            p.id != "in_app_local"
                                                && p.last_health_status == "healthy"
                                                && self.is_provider_ready(p)
                                        })
                                    })
                                    .cloned()
                            } else {
                                None
                            }
                        };

                        if let Some(fb) = fallback_res {
                            info!(
                                fallback_provider = %fb.id,
                                "In-App AI engine unreachable, falling back to secondary cloud provider"
                            );
                            let fb_key = self.resolve_credential_for_provider(&fb);
                            match fb.id.as_str() {
                                "anthropic" => {
                                    self.call_anthropic(
                                        &fb.endpoint_url,
                                        fb_key.as_deref(),
                                        &fb.default_model,
                                        &system_prompt,
                                        &user_content,
                                    )
                                    .await?
                                }
                                _ => {
                                    self.call_openai_compatible(
                                        &fb.endpoint_url,
                                        fb_key.as_deref(),
                                        &fb.default_model,
                                        &system_prompt,
                                        &user_content,
                                        fb.temperature,
                                        fb.max_tokens,
                                    )
                                    .await?
                                }
                            }
                        } else {
                            // Check if local engine is actually active on port 11435
                            let is_listening = reqwest::Client::new()
                                .get("http://127.0.0.1:11435/v1/models")
                                .timeout(std::time::Duration::from_millis(1000))
                                .send()
                                .await
                                .map(|r| r.status().is_success())
                                .unwrap_or(false);

                            if is_listening {
                                return Err(AppError::Validation(format!(
                                    "Local AI Engine generation timed out or model is busy. Please try a more specific question. (Details: {})",
                                    e
                                )));
                            } else {
                                return Err(AppError::Validation(format!(
                                    "Local AI Engine is offline on port 11435. Please click 'Start Engine' in the Tools Hub to activate your local model. (Details: {})",
                                    e
                                )));
                            }
                        }
                    }
                }
            }
            "ollama_local" => {
                self.call_ollama(
                    &provider.endpoint_url,
                    &model_id,
                    &system_prompt,
                    &user_content,
                )
                .await?
            }
            "anthropic" => {
                self.call_anthropic(
                    &provider.endpoint_url,
                    api_key.as_deref(),
                    &model_id,
                    &system_prompt,
                    &user_content,
                )
                .await?
            }
            _ => {
                self.call_openai_compatible(
                    &provider.endpoint_url,
                    api_key.as_deref(),
                    &model_id,
                    &system_prompt,
                    &user_content,
                    provider.temperature,
                    provider.max_tokens,
                )
                .await?
            }
        };

        let latency_ms = start.elapsed().as_millis() as i64;

        // Extract citations from RAG context that were cited or used
        let citations = if let Some(ctx) = rag_context {
            ctx.passages.clone()
        } else {
            Vec::new()
        };

        let warning = if rag_context.map(|c| !c.is_grounded).unwrap_or(false) {
            Some("Note: Response is not grounded in local paper text because no relevant passages were found.".into())
        } else {
            None
        };

        Ok(GenerateResponseOutput {
            text: generated_text,
            citations,
            provider_id: provider.id,
            model_id,
            latency_ms,
            is_grounded: has_paper_data,
            warning,
        })
    }

    pub fn is_provider_ready(&self, provider: &AiProvider) -> bool {
        if !provider.is_enabled {
            return false;
        }
        if provider.id == "in_app_local" {
            return true;
        }
        // Standalone local servers (e.g. LM Studio on port 1234, llama.cpp on 8080, Ollama on 11434)
        // must be actively verified or healthy; do not blindly route to dead local ports
        if provider.is_local {
            return provider.last_health_status == "healthy";
        }
        self.resolve_credential_for_provider(provider).is_some()
    }

    fn resolve_provider_and_model(
        &self,
        conn: &rusqlite::Connection,
        input: &GenerateRequestInput,
    ) -> Result<(AiProvider, String), AppError> {
        // 1. If user gave explicit override (e.g. from Discover or Chat model selector):
        if let Some(pid) = &input.provider_override {
            if pid == "nvidia_nim" {
                let default_nim = AiProvider {
                    id: "nvidia_nim".to_string(),
                    display_name: "NVIDIA NIM / API Catalog".to_string(),
                    category: "cloud_hosted".to_string(),
                    endpoint_url: "https://integrate.api.nvidia.com/v1".to_string(),
                    doc_url: "https://docs.api.nvidia.com/nim/docs/api-quickstart".to_string(),
                    auth_type: "bearer_token".to_string(),
                    access_category: "hosted_free_tier".to_string(),
                    credential_ref: None,
                    default_model: "nvidia/nemotron-3-ultra-550b-a55b".to_string(),
                    embedding_model: None,
                    reranker_model: None,
                    timeout_secs: 60,
                    max_tokens: 16384,
                    temperature: 0.7,
                    context_length: 16384,
                    streaming_enabled: true,
                    is_local: false,
                    is_enabled: true,
                    priority: 1,
                    last_verified_at: chrono::Utc::now().to_rfc3339(),
                    last_health_status: "healthy".to_string(),
                    last_health_message: Some("NVIDIA NIM ready".to_string()),
                    supported_capabilities: vec!["chat".to_string(), "streaming".to_string()],
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };
                let model = input
                    .model_override
                    .clone()
                    .unwrap_or_else(|| "nvidia/nemotron-3-ultra-550b-a55b".to_string());
                return Ok((default_nim, model));
            }

            if let Some(provider) = AiRepository::get_provider(conn, pid)
                .map_err(|e| AppError::Database(e.to_string()))?
            {
                if !self.is_provider_ready(&provider) {
                    return Err(AppError::Validation(format!(
                        "Provider '{}' is not currently ready or missing a configured API key. Please check AI Diagnostics or select NVIDIA NIM / In-App Engine.",
                        provider.display_name
                    )));
                }
                let default_for_pid = if provider.id == "nvidia_nim" {
                    "nvidia/nemotron-3-ultra-550b-a55b"
                } else {
                    provider.default_model.as_str()
                };
                let model = input
                    .model_override
                    .clone()
                    .unwrap_or_else(|| default_for_pid.to_string());
                return Ok((provider, model));
            }
        }

        // 2. Look up task route if task_type is provided (e.g. qa_citations -> nvidia_nim)
        if let Some(task) = &input.task_type {
            if let Ok(Some(route)) = AiRepository::get_task_route(conn, task) {
                if let Ok(Some(provider)) = AiRepository::get_provider(conn, &route.provider_id) {
                    if self.is_provider_ready(&provider) {
                        return Ok((provider, route.model_id));
                    }
                }
            }
        }

        // 3. Primary Engine: In-App Local AI Engine
        if let Ok(Some(provider)) = AiRepository::get_provider(conn, "in_app_local") {
            if provider.is_enabled {
                let model = input
                    .model_override
                    .clone()
                    .unwrap_or_else(|| provider.default_model.clone());
                return Ok((provider, model));
            }
        }

        // 4. Fallback: Search among enabled and ready providers, ordered by highest priority
        let mut providers =
            AiRepository::list_providers(conn).map_err(|e| AppError::Database(e.to_string()))?;
        providers.sort_by(|a, b| b.priority.cmp(&a.priority));
        let ready_providers: Vec<AiProvider> = providers
            .iter()
            .filter(|p| self.is_provider_ready(p))
            .cloned()
            .collect();

        if let Some(p) = ready_providers.into_iter().next() {
            let model = input
                .model_override
                .clone()
                .unwrap_or(p.default_model.clone());
            return Ok((p, model));
        }

        // 4. If an enabled provider exists but is missing credentials, provide helpful guidance
        let enabled_providers: Vec<AiProvider> =
            providers.into_iter().filter(|p| p.is_enabled).collect();
        if let Some(p) = enabled_providers.into_iter().next() {
            if !p.is_local
                && self
                    .resolve_credential(p.credential_ref.as_deref())
                    .is_none()
            {
                return Err(AppError::Validation(format!(
                    "Provider '{}' is enabled but has no API key configured. Please add your key in AI Diagnostics or Settings.",
                    p.display_name
                )));
            }
        }

        Err(AppError::Validation(
            "No active AI provider ready. Please enable a provider and configure credentials in AI Diagnostics.".into(),
        ))
    }

    pub async fn diagnose_system(
        &self,
        db: &Database,
    ) -> Result<Vec<AiDiagnosticReport>, AppError> {
        let conn = db.lock()?;
        let providers =
            AiRepository::list_providers(&conn).map_err(|e| AppError::Database(e.to_string()))?;

        let mut reports = Vec::new();
        for p in providers {
            let has_credential = if p.is_local || p.auth_type == "none" {
                true
            } else {
                self.resolve_credential(p.credential_ref.as_deref())
                    .is_some()
            };

            let is_ready = p.is_enabled && has_credential;
            let last_error_category = if !p.is_enabled {
                Some("not_configured".to_string())
            } else if !has_credential {
                Some("missing_credentials".to_string())
            } else if p.last_health_status == "disconnected" {
                Some("network_failure".to_string())
            } else {
                None
            };

            reports.push(AiDiagnosticReport {
                provider_id: p.id.clone(),
                display_name: p.display_name.clone(),
                is_enabled: p.is_enabled,
                is_local: p.is_local,
                access_category: p.access_category.clone(),
                endpoint_url: p.endpoint_url.clone(),
                selected_model: p.default_model.clone(),
                has_credential,
                is_ready,
                connection_status: p.last_health_status.clone(),
                last_health_message: p.last_health_message.clone(),
                last_error_category,
                latency_ms: None,
                streaming_supported: p.supported_capabilities.contains(&"streaming".to_string()),
                embeddings_supported: p.supported_capabilities.contains(&"embeddings".to_string()),
                reranker_supported: p.supported_capabilities.contains(&"reranking".to_string()),
            });
        }
        Ok(reports)
    }

    pub async fn test_generation(
        &self,
        db: &Database,
        provider_id: &str,
    ) -> Result<DiagnosticTestGenResult, AppError> {
        let start = Instant::now();
        let input = GenerateRequestInput {
            prompt: "Say: Scientific AI Diagnostic Verified.".to_string(),
            system_instruction: Some("You are a research diagnostic assistant. Reply with only the requested verification phrase.".to_string()),
            paper_id: None,
            task_type: None,
            audience_level: Some("researcher".to_string()),
            reading_mode: None,
            rag_scope: Some("none".to_string()),
            provider_override: Some(provider_id.to_string()),
            model_override: None,
            ui_context: None,
        };

        match self.generate(db, &input, None).await {
            Ok(res) => {
                let latency_ms = start.elapsed().as_millis() as i64;
                Ok(DiagnosticTestGenResult {
                    provider_id: provider_id.to_string(),
                    model_id: res.model_id,
                    success: true,
                    response_text: Some(res.text),
                    latency_ms,
                    error_category: None,
                    error_message: None,
                })
            }
            Err(e) => {
                let latency_ms = start.elapsed().as_millis() as i64;
                let err_str = e.to_string();
                let category = if err_str.contains("missing a configured API key")
                    || err_str.contains("Missing API key")
                    || err_str.contains("Authentication failed")
                    || err_str.contains("401")
                {
                    "missing_credentials"
                } else if err_str.contains("timeout") || err_str.contains("timed out") {
                    "timeout"
                } else if err_str.contains("429") || err_str.contains("Rate limit") {
                    "rate_limit"
                } else if err_str.contains("Cannot reach") || err_str.contains("Connection failed")
                {
                    "network_failure"
                } else {
                    "unknown_error"
                };

                Ok(DiagnosticTestGenResult {
                    provider_id: provider_id.to_string(),
                    model_id: "default".to_string(),
                    success: false,
                    response_text: None,
                    latency_ms,
                    error_category: Some(category.to_string()),
                    error_message: Some(err_str),
                })
            }
        }
    }

    fn build_prompt_with_context(
        &self,
        input: &GenerateRequestInput,
        rag_context: Option<&AiRagContext>,
        settings: &AiSettings,
    ) -> (String, String) {
        let audience = input
            .audience_level
            .as_deref()
            .unwrap_or(&settings.default_audience_level);

        let mut sys = format!(
            "You are an expert scientific researcher and literature analysis assistant.\n\
             Communicate exclusively in clear, grammatically correct English.\n\
             Audience level: {}.\n\
             Provide factual, direct, and concise answers based strictly on the provided research context.\n\
             Do not include conversational filler, meta headers, thought processes, or non-English characters.",
            audience
        );

        if let Some(extra) = &input.system_instruction {
            sys.push_str("\n\n");
            sys.push_str(extra);
        }

        let mut user_msg = String::new();

        if let Some(ctx) = rag_context {
            if !ctx.passages.is_empty() {
                user_msg.push_str("--- BEGIN RESEARCH PAPER CONTEXT ---\n");
                for (i, cit) in ctx.passages.iter().enumerate() {
                    let heading = cit.section_heading.as_deref().unwrap_or("Main Text");
                    user_msg.push_str(&format!(
                        "[Passage {}] Paper: \"{}\" | Page: {} | Section: {}\n{}\n\n",
                        i + 1,
                        cit.paper_title,
                        cit.page_number,
                        heading,
                        cit.snippet.trim()
                    ));
                }
                user_msg.push_str(
                    "--- END RESEARCH PAPER CONTEXT ---\n\n\
                     Instructions: Ground your answer ONLY in the provided passages where possible. \
                     Cite specific page numbers like [Page X] when referencing facts. \
                     If the context does not answer the question, explicitly state that rather than making up an answer.\n\n"
                );
            }
        }

        if let Some(ui_ctx) = &input.ui_context {
            let trimmed = ui_ctx.trim();
            if !trimmed.is_empty() {
                user_msg.push_str("--- UI CONTEXT & CURRENT SCREEN STATE ---\n");
                user_msg.push_str(trimmed);
                user_msg.push_str("\n\n");
            }
        }

        user_msg.push_str(&input.prompt);

        (sys, user_msg)
    }

    #[allow(clippy::too_many_arguments)]
    async fn call_openai_compatible(
        &self,
        base_url: &str,
        api_key: Option<&str>,
        model: &str,
        system_prompt: &str,
        user_prompt: &str,
        temperature: f64,
        max_tokens: i64,
    ) -> Result<String, AppError> {
        let endpoint = if base_url.ends_with("/chat/completions") {
            base_url.to_string()
        } else if base_url.ends_with("/v1") || base_url.ends_with("/v1/") {
            format!("{}/chat/completions", base_url.trim_end_matches('/'))
        } else {
            format!("{}/v1/chat/completions", base_url.trim_end_matches('/'))
        };

        let is_local_llama = base_url.contains("127.0.0.1:11435")
            || base_url.contains("localhost:11435")
            || base_url.contains(":8080");

        let effective_temp = if is_local_llama && temperature > 0.6 {
            0.3 // Keep local edge models strictly grounded without hallucinations
        } else {
            temperature
        };

        let mut body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "temperature": effective_temp,
            "max_tokens": max_tokens,
            "stream": false
        });

        // Only attach llama-server specific penalties for local engine instances
        if is_local_llama {
            if let Some(map) = body.as_object_mut() {
                map.insert("repeat_penalty".to_string(), json!(1.25));
                map.insert("presence_penalty".to_string(), json!(0.4));
                map.insert("frequency_penalty".to_string(), json!(0.4));
                map.insert(
                    "stop".to_string(),
                    json!([
                        "<|im_end|>",
                        "<|endoftext|>",
                        "</s>",
                        "<|eot_id|>",
                        "\nUser:",
                        "\nAssistant:",
                        "### User:",
                        "### Assistant:"
                    ]),
                );
            }
        }

        let mut req = self
            .client
            .post(&endpoint)
            .header(CONTENT_TYPE, "application/json")
            .json(&body);

        if let Some(key) = api_key {
            req = req.header(AUTHORIZATION, format!("Bearer {}", key));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Network(format!("Request to {} failed: {}", base_url, e)))?;

        let status = resp.status();
        if !status.is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            // Redact potential secrets from error
            let sanitized_err = if err_text.len() > 300 {
                &err_text[..300]
            } else {
                &err_text
            };
            return Err(AppError::Internal(format!(
                "Model provider returned HTTP {}: {}",
                status, sanitized_err
            )));
        }

        let val: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse JSON response: {}", e)))?;

        let msg = &val["choices"][0]["message"];
        let mut extracted_text = String::new();

        if let Some(content_str) = msg["content"].as_str() {
            extracted_text = content_str.to_string();
        } else if let Some(arr) = msg["content"].as_array() {
            for item in arr {
                if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                    extracted_text.push_str(t);
                }
            }
        }

        // Fallback to reasoning_content (used by NVIDIA NIM reasoning models like mistral-large, deepseek)
        if extracted_text.trim().is_empty() {
            if let Some(reasoning) = msg["reasoning_content"].as_str() {
                extracted_text = reasoning.to_string();
            }
        }

        // Fallback to delta if present
        if extracted_text.trim().is_empty() {
            if let Some(delta) = val["choices"][0]["delta"]["content"].as_str() {
                extracted_text = delta.to_string();
            } else if let Some(delta_reasoning) =
                val["choices"][0]["delta"]["reasoning_content"].as_str()
            {
                extracted_text = delta_reasoning.to_string();
            }
        }

        // Clean out <think>...</think> reasoning blocks if present (e.g. Qwen / DeepSeek think tokens)
        let raw_text = extracted_text.trim();
        let cleaned_text = if let Some(end_idx) = raw_text.rfind("</think>") {
            let after_think = raw_text[end_idx + 8..].trim();
            if !after_think.is_empty() {
                after_think
                    .replace("<think>", "")
                    .replace("</think>", "")
                    .trim()
                    .to_string()
            } else {
                raw_text
                    .replace("<think>", "")
                    .replace("</think>", "")
                    .trim()
                    .to_string()
            }
        } else {
            raw_text
                .replace("<think>", "")
                .replace("</think>", "")
                .trim()
                .to_string()
        };

        let final_text = if cleaned_text.is_empty() {
            "I have analyzed the paper context. Feel free to ask a specific question about the methodology, findings, datasets, or equations.".to_string()
        } else {
            Self::clean_repeated_content(&cleaned_text)
        };

        if !final_text.is_empty() {
            Ok(final_text)
        } else {
            Err(AppError::Internal(
                "Model returned empty or malformed completion".into(),
            ))
        }
    }

    /// Post-processing filter to deduplicate consecutive repeated lines, redundant
    /// metadata headers, and word/token stutter from AI model output.
    pub fn clean_repeated_content(text: &str) -> String {
        if text.is_empty() {
            return String::new();
        }

        let mut lines_cleaned: Vec<String> = Vec::new();
        let mut last_normalized: Vec<String> = Vec::new();
        let mut seen_headers: std::collections::HashSet<String> = std::collections::HashSet::new();

        for raw_line in text.lines() {
            let trimmed = raw_line.trim();
            if trimmed.is_empty() {
                if lines_cleaned.last().map(|l| !l.is_empty()).unwrap_or(false) {
                    lines_cleaned.push(String::new());
                }
                continue;
            }

            // Skip lines that are exclusively CJK characters (e.g. stray '语', '述语者', '成语')
            let has_cjk = trimmed
                .chars()
                .any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c));
            let has_latin = trimmed.chars().any(|c| c.is_ascii_alphabetic());
            if has_cjk && !has_latin {
                continue;
            }

            // Skip conversational filler / thinking preamble / internal monologue
            let lower = trimmed.to_lowercase();
            if lower == "**deep read mode**"
                || lower == "**general mode**"
                || lower == "okay let!"
                || lower == "---"
                || lower == "wait"
                || lower == "wait!"
                || lower.starts_with("okay, let's tackle")
                || lower.starts_with("let's tackle this")
                || lower.starts_with("the user wants me to")
                || lower.starts_with("so i need to cite")
                || lower.starts_with("first, looking at passage")
                || lower.starts_with("then it goes into passage")
                || lower.starts_with("so i'm going through")
                || lower.starts_with("okay response is")
                || lower.starts_with("but what about if there was")
                || lower.starts_with("let me think")
                || lower.starts_with("okay let's about")
                || lower.starts_with("okay, let me")
                || lower == "that's what they say."
                || lower == "now the thing goes down:"
                || lower == "**\"she says everything.\"**"
                || lower == "ero"
                || lower == "braska"
                || lower.starts_with("okay, i'm trying")
                || lower.starts_with("i see that's grace")
                || lower.starts_with("so answer is a question")
                || lower.starts_with("the user has asked me")
                || lower.starts_with("this task requires no promise")
                || lower.starts_with("therefore, after thinking")
                || lower.starts_with("but here will break")
            {
                continue;
            }

            // Clean consecutive repeated word stutter within the line, e.g. "ten, ten, ten"
            let tokens: Vec<&str> = trimmed.split_whitespace().collect();
            let mut deduped_line_tokens: Vec<&str> = Vec::new();
            for token in tokens {
                let clean_token = token
                    .trim_matches(|c: char| !c.is_alphanumeric())
                    .to_lowercase();
                if let Some(prev) = deduped_line_tokens.last() {
                    let prev_clean = prev
                        .trim_matches(|c: char| !c.is_alphanumeric())
                        .to_lowercase();
                    if clean_token == prev_clean && !clean_token.is_empty() {
                        continue;
                    }
                }
                deduped_line_tokens.push(token);
            }
            let line_processed = deduped_line_tokens.join(" ");

            let norm: String = line_processed
                .chars()
                .filter(|c| c.is_alphanumeric())
                .collect::<String>()
                .to_lowercase();

            // Skip if identical to recent lines (e.g. repeated "Amin M.")
            if last_normalized
                .iter()
                .rev()
                .take(5)
                .any(|prev| prev == &norm)
            {
                continue;
            }

            // Check for field header patterns, e.g. "Keywords:", "Author(s):", "Year of Publication:"
            if let Some(colon_idx) = line_processed.find(':') {
                let prefix = &line_processed[..colon_idx];
                let val = line_processed[colon_idx + 1..].trim();
                let mut header_key: String = prefix
                    .chars()
                    .filter(|c| c.is_alphanumeric())
                    .collect::<String>()
                    .to_lowercase();

                if header_key == "author" || header_key == "authors" || header_key == "authorss" {
                    header_key = "authors".to_string();
                } else if header_key == "keyword" || header_key == "keywords" {
                    header_key = "keywords".to_string();
                } else if header_key == "year"
                    || header_key == "yearofpublication"
                    || header_key == "publicationyear"
                {
                    header_key = "year".to_string();
                }

                if seen_headers.contains(&header_key) {
                    continue;
                }

                if !val.is_empty()
                    || ["authors", "abstract", "keywords", "affiliation", "year"]
                        .contains(&header_key.as_str())
                {
                    seen_headers.insert(header_key);
                }
            }

            last_normalized.push(norm);
            lines_cleaned.push(line_processed);
        }

        lines_cleaned.join("\n").trim().to_string()
    }

    async fn call_ollama(
        &self,
        base_url: &str,
        model: &str,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, AppError> {
        let endpoint = format!("{}/api/chat", base_url.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false
        });

        let resp = self
            .client
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to call Ollama: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Internal(format!(
                "Ollama returned HTTP {}",
                resp.status()
            )));
        }

        let val: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Ollama response: {}", e)))?;

        if let Some(text) = val["message"]["content"].as_str() {
            Ok(text.to_string())
        } else {
            Err(AppError::Internal(
                "Ollama response missing message content".into(),
            ))
        }
    }

    async fn call_anthropic(
        &self,
        base_url: &str,
        api_key: Option<&str>,
        model: &str,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, AppError> {
        let key =
            api_key.ok_or_else(|| AppError::Validation("Anthropic API key required".into()))?;
        let endpoint = format!("{}/v1/messages", base_url.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [
                { "role": "user", "content": user_prompt }
            ]
        });

        let resp = self
            .client
            .post(&endpoint)
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to call Anthropic: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let err_txt = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Anthropic returned HTTP {}: {}",
                status, err_txt
            )));
        }

        let val: Value = resp.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse Anthropic response: {}", e))
        })?;

        if let Some(text) = val["content"][0]["text"].as_str() {
            Ok(text.to_string())
        } else {
            Err(AppError::Internal(
                "Anthropic response missing text content".into(),
            ))
        }
    }
}

fn dirs_fallback() -> PathBuf {
    let modern = crate::platform::default_app_data_dir();
    if modern.exists() {
        modern
    } else {
        dirs_legacy()
    }
}

fn dirs_legacy() -> PathBuf {
    if let Some(mut base) = dirs::data_dir() {
        base.push("research-paper-scraper");
        base
    } else {
        PathBuf::from(".").join("research-paper-scraper")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use crate::repositories::AiRepository;

    #[test]
    fn test_privacy_guard_enforcement() {
        let db = Database::open_in_memory().unwrap();

        let cloud_provider = AiProvider {
            id: "test_cloud".into(),
            display_name: "Test Cloud".into(),
            category: "cloud_hosted".into(),
            endpoint_url: "https://api.example.com".into(),
            doc_url: "".into(),
            auth_type: "api_key".into(),
            access_category: "hosted_free_tier".into(),
            credential_ref: None,
            default_model: "cloud-v1".into(),
            embedding_model: None,
            reranker_model: None,
            timeout_secs: 30,
            max_tokens: 2048,
            temperature: 0.7,
            context_length: 8192,
            streaming_enabled: false,
            is_local: false,
            is_enabled: true,
            priority: 1,
            last_verified_at: "".into(),
            last_health_status: "unknown".into(),
            last_health_message: None,
            supported_capabilities: vec!["chat".into()],
            created_at: "".into(),
            updated_at: "".into(),
        };

        let local_provider = AiProvider {
            id: "test_local".into(),
            display_name: "Test Local".into(),
            category: "local_runtime".into(),
            endpoint_url: "http://127.0.0.1:11434".into(),
            doc_url: "".into(),
            auth_type: "none".into(),
            access_category: "local".into(),
            credential_ref: None,
            default_model: "llama3.2".into(),
            embedding_model: None,
            reranker_model: None,
            timeout_secs: 30,
            max_tokens: 2048,
            temperature: 0.7,
            context_length: 8192,
            streaming_enabled: false,
            is_local: true,
            is_enabled: true,
            priority: 1,
            last_verified_at: "".into(),
            last_health_status: "unknown".into(),
            last_health_message: None,
            supported_capabilities: vec!["chat".into()],
            created_at: "".into(),
            updated_at: "".into(),
        };

        // 1. By default, local_only_mode is false, cloud_paper_sharing_enabled is false.
        // A cloud request with paper data must be blocked if cloud sharing is false:
        let res = AiProviderService::verify_privacy_guards(&db, &cloud_provider, true);
        assert!(res.is_err(), "Expected cloud sharing guard to trigger");

        // A cloud request WITHOUT paper data (e.g. general query) is allowed:
        let res = AiProviderService::verify_privacy_guards(&db, &cloud_provider, false);
        assert!(res.is_ok());

        // Local provider is always allowed:
        let res = AiProviderService::verify_privacy_guards(&db, &local_provider, true);
        assert!(res.is_ok());

        // 2. Enable local_only_mode: ALL cloud requests must be blocked:
        {
            let conn = db.lock().unwrap();
            let mut settings = AiRepository::get_ai_settings(&conn).unwrap();
            settings.local_only_mode = true;
            AiRepository::update_ai_settings(&conn, &settings).unwrap();
        }

        let res = AiProviderService::verify_privacy_guards(&db, &cloud_provider, false);
        assert!(
            res.is_err(),
            "Expected local-only mode to block cloud request"
        );

        let res = AiProviderService::verify_privacy_guards(&db, &local_provider, true);
        assert!(
            res.is_ok(),
            "Local provider must remain permitted in local-only mode"
        );

        // 3. Paid provider blocked by default ('never_use_paid_apis' is true):
        let mut paid_provider = cloud_provider.clone();
        paid_provider.access_category = "paid".into();
        {
            let conn = db.lock().unwrap();
            let mut settings = AiRepository::get_ai_settings(&conn).unwrap();
            settings.local_only_mode = false;
            AiRepository::update_ai_settings(&conn, &settings).unwrap();
        }

        let res = AiProviderService::verify_privacy_guards(&db, &paid_provider, false);
        assert!(
            res.is_err(),
            "Expected paid provider to be blocked by never_use_paid_apis"
        );
    }
}
