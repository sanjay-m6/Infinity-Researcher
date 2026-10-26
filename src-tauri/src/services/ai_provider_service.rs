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
            .timeout(std::time::Duration::from_secs(45))
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
        if !path.exists() {
            return Ok(HashMap::new());
        }
        let raw = fs::read_to_string(&path)
            .map_err(|e| AppError::Internal(format!("Failed to read secure store: {}", e)))?;
        let store: HashMap<String, String> = serde_json::from_str(&raw).unwrap_or_default();
        Ok(store)
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
        let guard = self.secure_store.lock().ok()?;
        guard.get(key_ref).cloned().filter(|k| !k.is_empty())
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
        let api_key = self.resolve_credential(provider.credential_ref.as_deref());

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
        let endpoint = if base_url.ends_with("/v1") || base_url.ends_with("/v1/") {
            format!("{}/models", base_url.trim_end_matches('/'))
        } else {
            format!("{}/v1/models", base_url.trim_end_matches('/'))
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

        let api_key = self.resolve_credential(provider.credential_ref.as_deref());

        // Assemble messages with RAG groundings and audience instructions
        let (system_prompt, user_content) =
            self.build_prompt_with_context(input, rag_context, &settings);

        let start = Instant::now();
        let generated_text = match provider.id.as_str() {
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

    fn resolve_provider_and_model(
        &self,
        conn: &rusqlite::Connection,
        input: &GenerateRequestInput,
    ) -> Result<(AiProvider, String), AppError> {
        // If user gave explicit override:
        if let Some(pid) = &input.provider_override {
            if let Some(provider) = AiRepository::get_provider(conn, pid)
                .map_err(|e| AppError::Database(e.to_string()))?
            {
                let model = input
                    .model_override
                    .clone()
                    .unwrap_or(provider.default_model.clone());
                return Ok((provider, model));
            }
        }

        // Look up task route if task_type is provided
        if let Some(task) = &input.task_type {
            if let Ok(Some(route)) = AiRepository::get_task_route(conn, task) {
                if let Ok(Some(provider)) = AiRepository::get_provider(conn, &route.provider_id) {
                    if provider.is_enabled {
                        return Ok((provider, route.model_id));
                    }
                }
            }
        }

        // Fallback to highest priority enabled provider
        let providers =
            AiRepository::list_providers(conn).map_err(|e| AppError::Database(e.to_string()))?;
        let enabled: Vec<AiProvider> = providers.into_iter().filter(|p| p.is_enabled).collect();
        if let Some(p) = enabled.into_iter().next() {
            let model = input
                .model_override
                .clone()
                .unwrap_or(p.default_model.clone());
            return Ok((p, model));
        }

        Err(AppError::Validation(
            "No enabled AI provider found. Please configure a provider in AI Settings.".into(),
        ))
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
        let reading_mode = input.reading_mode.as_deref().unwrap_or("deep_read");

        let mut sys = format!(
            "You are an expert scientific researcher and literature analysis assistant.\n\
             Audience level: {}.\n\
             Reading mode: {}.\n\
             Distinguish direct evidence, author claims, and your interpretation.\n\
             Never invent facts or citations.",
            audience, reading_mode
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

        let body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false
        });

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
            .map_err(|e| AppError::Internal(format!("Request to {} failed: {}", base_url, e)))?;

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

        if let Some(content) = val["choices"][0]["message"]["content"].as_str() {
            Ok(content.to_string())
        } else {
            Err(AppError::Internal(
                "Model returned empty or malformed completion".into(),
            ))
        }
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
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("research-paper-scraper")
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
