use tauri::State;
use crate::domain::settings::AppSetting;
use crate::errors::CommandError;
use crate::services::SettingsService;
use crate::state::AppState;

#[tauri::command]
pub async fn get_app_setting(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, CommandError> {
    let db = state.db()?;
    SettingsService::get_setting(db, &key).map_err(Into::into)
}

#[tauri::command]
pub async fn set_app_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    SettingsService::set_setting(db, &key, &value).map_err(Into::into)
}

#[tauri::command]
pub async fn list_app_settings(
    state: State<'_, AppState>,
) -> Result<Vec<AppSetting>, CommandError> {
    let db = state.db()?;
    SettingsService::list_settings(db).map_err(Into::into)
}
