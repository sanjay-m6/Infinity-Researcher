use tauri::State;
use uuid::Uuid;

use crate::domain::review_matrix::*;
use crate::errors::{AppError, CommandError};
use crate::repositories::MatrixRepository;
use crate::services::MatrixService;
use crate::state::AppState;

#[tauri::command]
pub async fn list_matrix_workspaces(
    state: State<'_, AppState>,
) -> Result<Vec<MatrixWorkspace>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    MatrixRepository::list_workspaces(&conn).map_err(Into::into)
}

#[tauri::command]
pub async fn get_matrix_workspace_detail(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<MatrixWorkspaceDetail, CommandError> {
    let db = state.db()?;
    MatrixService::get_workspace_detail(db, &workspace_id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_matrix_workspace(
    state: State<'_, AppState>,
    title: String,
    description: Option<String>,
    columns_json: Option<String>,
) -> Result<MatrixWorkspace, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    let now = chrono::Utc::now().to_rfc3339();
    let cols = columns_json.unwrap_or_else(|| {
        serde_json::to_string(&MatrixService::default_columns()).unwrap_or_else(|_| "[]".to_string())
    });

    let ws = MatrixWorkspace {
        id: Uuid::new_v4().to_string(),
        title,
        description,
        columns_json: cols,
        created_at: now.clone(),
        updated_at: now,
    };

    MatrixRepository::save_workspace(&conn, &ws)?;
    Ok(ws)
}

#[tauri::command]
pub async fn update_matrix_columns(
    state: State<'_, AppState>,
    workspace_id: String,
    columns_json: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    let mut ws = MatrixRepository::get_workspace(&conn, &workspace_id)?
        .ok_or_else(|| AppError::Validation(format!("Workspace '{}' not found", workspace_id)))?;
    ws.columns_json = columns_json;
    ws.updated_at = chrono::Utc::now().to_rfc3339();
    MatrixRepository::save_workspace(&conn, &ws)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_matrix_workspace(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    MatrixRepository::delete_workspace(&conn, &workspace_id).map_err(Into::into)
}

#[tauri::command]
pub async fn add_paper_to_matrix(
    state: State<'_, AppState>,
    workspace_id: String,
    paper_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    MatrixService::add_paper_and_extract(db, &workspace_id, &paper_id).map_err(Into::into)
}

#[tauri::command]
pub async fn remove_paper_from_matrix(
    state: State<'_, AppState>,
    workspace_id: String,
    paper_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    MatrixService::remove_paper_from_workspace(db, &workspace_id, &paper_id).map_err(Into::into)
}

#[tauri::command]
pub async fn upsert_matrix_extraction(
    state: State<'_, AppState>,
    extraction: MatrixExtraction,
) -> Result<MatrixExtraction, CommandError> {
    let db = state.db()?;
    MatrixService::upsert_extraction(db, extraction).map_err(Into::into)
}

#[tauri::command]
pub async fn extract_matrix_fields(
    state: State<'_, AppState>,
    workspace_id: String,
    paper_id: String,
) -> Result<Vec<MatrixExtraction>, CommandError> {
    let db = state.db()?;
    MatrixService::extract_fields_for_paper(db, &workspace_id, &paper_id).map_err(Into::into)
}

#[tauri::command]
pub async fn export_matrix_csv(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Result<String, CommandError> {
    let db = state.db()?;
    MatrixService::export_csv(db, &workspace_id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_evidence_copilot_session(
    state: State<'_, AppState>,
    title: String,
    target_scope: String,
    target_paper_id: Option<String>,
    workspace_id: Option<String>,
) -> Result<EvidenceCopilotSession, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    let now = chrono::Utc::now().to_rfc3339();
    let session = EvidenceCopilotSession {
        id: Uuid::new_v4().to_string(),
        title,
        target_scope,
        target_paper_id,
        workspace_id,
        created_at: now.clone(),
        updated_at: now,
    };
    MatrixRepository::create_copilot_session(&conn, &session)?;
    Ok(session)
}

#[tauri::command]
pub async fn list_evidence_copilot_sessions(
    state: State<'_, AppState>,
    workspace_id: Option<String>,
    target_paper_id: Option<String>,
) -> Result<Vec<EvidenceCopilotSession>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    MatrixRepository::list_copilot_sessions(&conn, workspace_id.as_deref(), target_paper_id.as_deref())
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_evidence_copilot_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<EvidenceCopilotMessage>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    MatrixRepository::get_copilot_messages(&conn, &session_id).map_err(Into::into)
}

#[tauri::command]
pub async fn ask_evidence_copilot(
    state: State<'_, AppState>,
    session_id: String,
    question: String,
    workspace_id: Option<String>,
    target_paper_id: Option<String>,
) -> Result<EvidenceCopilotMessage, CommandError> {
    let db = state.db()?;
    let (msg, _evidence) = MatrixService::ask_copilot(
        db,
        &session_id,
        &question,
        workspace_id.as_deref(),
        target_paper_id.as_deref(),
    )?;
    Ok(msg)
}
