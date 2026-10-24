use tauri::State;
use crate::domain::collection::{Collection, CollectionCreateInput, CollectionUpdateInput};
use crate::errors::CommandError;
use crate::services::CollectionService;
use crate::state::AppState;

#[tauri::command]
pub async fn list_collections(
    state: State<'_, AppState>,
) -> Result<Vec<Collection>, CommandError> {
    let db = state.db()?;
    CollectionService::list_collections(db).map_err(Into::into)
}

#[tauri::command]
pub async fn create_collection(
    state: State<'_, AppState>,
    input: CollectionCreateInput,
) -> Result<Collection, CommandError> {
    let db = state.db()?;
    CollectionService::create_collection(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    input: CollectionUpdateInput,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    CollectionService::update_collection(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_collection(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    CollectionService::delete_collection(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn add_paper_to_collection(
    state: State<'_, AppState>,
    collection_id: String,
    paper_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    CollectionService::add_paper_to_collection(db, &collection_id, &paper_id).map_err(Into::into)
}

#[tauri::command]
pub async fn remove_paper_from_collection(
    state: State<'_, AppState>,
    collection_id: String,
    paper_id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    CollectionService::remove_paper_from_collection(db, &collection_id, &paper_id).map_err(Into::into)
}
