use crate::domain::source::Source;
use crate::errors::CommandError;
use crate::services::SourceService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_sources(state: State<'_, AppState>) -> Result<Vec<Source>, CommandError> {
    let db = state.db()?;
    SourceService::list_sources(db).map_err(Into::into)
}
