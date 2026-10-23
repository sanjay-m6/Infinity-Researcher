use tauri::State;
use tracing::info;

use crate::errors::CommandError;
use crate::services::{HealthResponse, HealthService};
use crate::state::AppState;

/// Tauri IPC command to inspect desktop application health and diagnostics.
#[tauri::command]
pub async fn app_health(state: State<'_, AppState>) -> Result<HealthResponse, CommandError> {
    info!("Handling app_health command invocation");
    let response = HealthService::check_health(&state).await;
    Ok(response)
}

/// Simple lightweight round-trip connectivity probe.
#[tauri::command]
pub async fn app_ping() -> Result<String, CommandError> {
    info!("Handling app_ping command invocation");
    Ok("pong".to_string())
}
