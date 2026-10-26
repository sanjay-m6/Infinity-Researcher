use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use tracing::info;

use crate::academic_sources::{
    AcademicSearchQuery, ImportSummary, NormalizedWork, ProviderCapabilities, UnifiedSearchResponse,
};
use crate::errors::CommandError;
use crate::repositories::SettingsRepository;
use crate::services::SettingsService;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigStatus {
    pub provider_id: String,
    pub is_configured: bool,
    pub requires_api_key: bool,
}

/// Lists all supported academic sources, their descriptions, and supported filters.
#[tauri::command]
pub async fn list_academic_providers(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderCapabilities>, CommandError> {
    info!("Handling list_academic_providers command invocation");
    Ok(state.search_service.registry().list_capabilities())
}

/// Executes unified academic discovery across selected providers with isolated error handling.
#[tauri::command]
pub async fn search_academic_sources(
    state: State<'_, AppState>,
    query: AcademicSearchQuery,
) -> Result<UnifiedSearchResponse, CommandError> {
    info!(query = %query.query, "Handling search_academic_sources command invocation");

    let mut api_keys: HashMap<String, String> = HashMap::new();
    if let Ok(db) = state.db() {
        if let Ok(conn) = db.lock() {
            if let Ok(Some(s2_key)) = SettingsRepository::get(&conn, "semantic_scholar_api_key") {
                api_keys.insert("semantic_scholar".to_string(), s2_key);
            }
            if let Ok(Some(oa_key)) = SettingsRepository::get(&conn, "openalex_api_key") {
                api_keys.insert("openalex".to_string(), oa_key);
            }
        }
    }

    state
        .search_service
        .search(query, api_keys)
        .await
        .map_err(Into::into)
}

/// Imports selected search result works into the SQLite research library.
#[tauri::command]
pub async fn import_search_results(
    state: State<'_, AppState>,
    works: Vec<NormalizedWork>,
    target_collection_id: Option<String>,
) -> Result<ImportSummary, CommandError> {
    info!(count = works.len(), target_collection = ?target_collection_id, "Handling import_search_results command invocation");
    let db = state.db()?;
    crate::academic_sources::AcademicSearchService::import_works(db, works, target_collection_id)
        .map_err(Into::into)
}

/// Retrieves configuration status for API keys without returning secret values.
#[tauri::command]
pub async fn get_provider_config_status(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderConfigStatus>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;

    let s2_configured = SettingsRepository::get(&conn, "semantic_scholar_api_key")
        .map(|opt| opt.is_some())
        .unwrap_or(false);

    let oa_configured = SettingsRepository::get(&conn, "openalex_api_key")
        .map(|opt| opt.is_some())
        .unwrap_or(false);

    Ok(vec![
        ProviderConfigStatus {
            provider_id: "openalex".to_string(),
            is_configured: oa_configured,
            requires_api_key: false,
        },
        ProviderConfigStatus {
            provider_id: "crossref".to_string(),
            is_configured: true,
            requires_api_key: false,
        },
        ProviderConfigStatus {
            provider_id: "semantic_scholar".to_string(),
            is_configured: s2_configured,
            requires_api_key: false,
        },
        ProviderConfigStatus {
            provider_id: "arxiv".to_string(),
            is_configured: true,
            requires_api_key: false,
        },
        ProviderConfigStatus {
            provider_id: "europe_pmc".to_string(),
            is_configured: true,
            requires_api_key: false,
        },
    ])
}

/// Sets an optional provider API key securely in settings.
#[tauri::command]
pub async fn set_provider_api_key(
    state: State<'_, AppState>,
    provider_id: String,
    api_key: String,
) -> Result<(), CommandError> {
    info!(provider = %provider_id, "Saving provider API key");
    let db = state.db()?;
    let setting_key = format!("{}_api_key", provider_id.to_lowercase().trim());
    SettingsService::set_setting(db, &setting_key, api_key.trim()).map_err(Into::into)
}
