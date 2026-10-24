use tauri::State;
use crate::domain::pagination::PagedResponse;
use crate::domain::paper::{Paper, PaperCreateInput, PaperListQuery, PaperUpdateInput};
use crate::errors::CommandError;
use crate::services::PaperService;
use crate::state::AppState;

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
pub async fn delete_paper(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
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
