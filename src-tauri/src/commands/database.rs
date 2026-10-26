use crate::database::DatabaseInfo;
use crate::errors::CommandError;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_database_info(state: State<'_, AppState>) -> Result<DatabaseInfo, CommandError> {
    let db = state.db()?;
    db.get_info().map_err(Into::into)
}
