use tauri::State;
use crate::domain::tag::Tag;
use crate::errors::CommandError;
use crate::services::TagService;
use crate::state::AppState;

#[tauri::command]
pub async fn list_tags(
    state: State<'_, AppState>,
) -> Result<Vec<Tag>, CommandError> {
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
