use tauri::State;
use crate::domain::note::{Note, NoteSaveInput};
use crate::errors::CommandError;
use crate::services::NoteService;
use crate::state::AppState;

#[tauri::command]
pub async fn get_notes_for_paper(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<Vec<Note>, CommandError> {
    let db = state.db()?;
    NoteService::get_notes_for_paper(db, &paper_id).map_err(Into::into)
}

#[tauri::command]
pub async fn save_note(
    state: State<'_, AppState>,
    input: NoteSaveInput,
) -> Result<Note, CommandError> {
    let db = state.db()?;
    NoteService::save_note(db, input).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    NoteService::delete_note(db, &id).map_err(Into::into)
}
