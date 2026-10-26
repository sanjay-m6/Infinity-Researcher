use crate::domain::export::{
    ExportFormat, ExportPreview, ExportRequest, ExportResult, ExportScope,
};
use crate::domain::paper::PaperListQuery;
use crate::errors::CommandError;
use crate::services::ExportService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn prepare_citation_export(
    state: State<'_, AppState>,
    format: String,
    scope: String,
    paper_ids: Option<Vec<String>>,
    collection_id: Option<String>,
    query: Option<PaperListQuery>,
) -> Result<ExportPreview, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    let fmt: ExportFormat = format
        .parse()
        .map_err(|e| CommandError::new("ERR_VALIDATION", e, false))?;
    let sc: ExportScope = scope
        .parse()
        .map_err(|e| CommandError::new("ERR_VALIDATION", e, false))?;

    ExportService::prepare_preview(
        &conn,
        sc,
        paper_ids.as_deref(),
        collection_id.as_deref(),
        query.as_ref(),
        fmt,
    )
    .map_err(Into::into)
}

#[tauri::command]
pub async fn execute_citation_export(
    state: State<'_, AppState>,
    request: ExportRequest,
) -> Result<ExportResult, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    ExportService::execute_export(&conn, &request).map_err(Into::into)
}
