use crate::domain::tag::Tag;
use crate::errors::CommandError;
use crate::services::TagService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, CommandError> {
    let db = state.db()?;
    TagService::list_tags(db).map_err(Into::into)
}

#[tauri::command]
pub async fn assign_tag_to_paper(
    state: State<'_, AppState>,
    paper_id: String,
    tag_name: String,
) -> Result<Tag, CommandError> {
    let db = state.db()?;
    TagService::assign_tag_to_paper(db, &paper_id, &tag_name).map_err(Into::into)
}

#[tauri::command]
pub async fn remove_tag_from_paper(
    state: State<'_, AppState>,
    paper_id: String,
    tag_id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    TagService::remove_tag_from_paper(db, &paper_id, &tag_id).map_err(Into::into)
}

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color_hex: Option<String>,
) -> Result<Tag, CommandError> {
    let db = state.db()?;
    TagService::create_tag(db, &name, color_hex.as_deref()).map_err(Into::into)
}

#[tauri::command]
pub async fn rename_tag(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    TagService::rename_tag(db, &id, &new_name).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_tag(state: State<'_, AppState>, id: String) -> Result<bool, CommandError> {
    let db = state.db()?;
    TagService::delete_tag(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn bulk_assign_tags(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
    tag_name: String,
) -> Result<usize, CommandError> {
    let db = state.db()?;
    TagService::bulk_assign_tags(db, &paper_ids, &tag_name).map_err(Into::into)
}

#[tauri::command]
pub async fn bulk_remove_tags(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
    tag_name: String,
) -> Result<usize, CommandError> {
    let db = state.db()?;
    TagService::bulk_remove_tags(db, &paper_ids, &tag_name).map_err(Into::into)
}
