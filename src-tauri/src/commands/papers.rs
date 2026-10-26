use crate::domain::pagination::PagedResponse;
use crate::domain::paper::{Paper, PaperCreateInput, PaperListQuery, PaperUpdateInput};
use crate::errors::CommandError;
use crate::services::PaperService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_papers(
    state: State<'_, AppState>,
    query: PaperListQuery,
) -> Result<PagedResponse<Paper>, CommandError> {
    let db = state.db()?;
    PaperService::list_papers(db, query).map_err(Into::into)
}

#[tauri::command]
pub async fn get_paper(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Paper>, CommandError> {
    let db = state.db()?;
    PaperService::get_paper(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_paper(
    state: State<'_, AppState>,
    input: PaperCreateInput,
) -> Result<Paper, CommandError> {
    let db = state.db()?;
    PaperService::create_paper(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn update_paper(
    state: State<'_, AppState>,
    input: PaperUpdateInput,
) -> Result<Paper, CommandError> {
    let db = state.db()?;
    PaperService::update_paper(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_paper(state: State<'_, AppState>, id: String) -> Result<bool, CommandError> {
    let db = state.db()?;
    PaperService::delete_paper(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn toggle_save_paper(
    state: State<'_, AppState>,
    id: String,
    is_saved: bool,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    PaperService::toggle_save_paper(db, &id, is_saved).map_err(Into::into)
}

#[tauri::command]
pub async fn set_paper_reading_status(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    PaperService::update_reading_status(db, &id, &status).map_err(Into::into)
}

#[tauri::command]
pub async fn set_paper_reading_progress(
    state: State<'_, AppState>,
    id: String,
    progress: f64,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    PaperService::update_reading_progress(db, &id, progress).map_err(Into::into)
}

#[tauri::command]
pub async fn bulk_update_reading_status(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
    status: String,
) -> Result<usize, CommandError> {
    let db = state.db()?;
    PaperService::bulk_update_reading_status(db, &paper_ids, &status).map_err(Into::into)
}

#[tauri::command]
pub async fn rebuild_search_index(state: State<'_, AppState>) -> Result<usize, CommandError> {
    let db = state.db()?;
    PaperService::rebuild_search_index(db).map_err(Into::into)
}
