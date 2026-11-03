use crate::domain::saved_search::{SavedSearch, SavedSearchCreateInput, SavedSearchUpdateInput};
use crate::errors::CommandError;
use crate::services::SavedSearchService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_saved_searches(
    state: State<'_, AppState>,
) -> Result<Vec<SavedSearch>, CommandError> {
    let db = state.db()?;
    SavedSearchService::list_saved_searches(db).map_err(Into::into)
}

#[tauri::command]
pub async fn get_saved_search(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<SavedSearch>, CommandError> {
    let db = state.db()?;
    SavedSearchService::get_saved_search(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_saved_search(
    state: State<'_, AppState>,
    input: SavedSearchCreateInput,
) -> Result<SavedSearch, CommandError> {
    let db = state.db()?;
    SavedSearchService::create_saved_search(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn update_saved_search(
    state: State<'_, AppState>,
    input: SavedSearchUpdateInput,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    SavedSearchService::update_saved_search(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_saved_search(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    SavedSearchService::delete_saved_search(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn touch_saved_search(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    SavedSearchService::touch_saved_search(db, &id).map_err(Into::into)
}
