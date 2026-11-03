use tauri::State;

use crate::domain::auth::{
    AuthResponse, ChangePasswordRequest, LoginRequest, SignupRequest, UpdatePreferencesRequest,
    UserPreferences,
};
use crate::state::AppState;

#[tauri::command]
pub async fn auth_signup(
    state: State<'_, AppState>,
    request: SignupRequest,
) -> Result<AuthResponse, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.signup(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    request: LoginRequest,
) -> Result<AuthResponse, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.login(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AppState>, token: String) -> Result<(), String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.logout(&token).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_lock(state: State<'_, AppState>, token: String) -> Result<(), String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.lock_session(&token).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_unlock(
    state: State<'_, AppState>,
    token: String,
    password: String,
) -> Result<AuthResponse, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.unlock_session(&token, &password)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_get_current_session(
    state: State<'_, AppState>,
    token: Option<String>,
) -> Result<Option<AuthResponse>, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    Ok(auth.get_current_session(token.as_deref()).await)
}

#[tauri::command]
pub async fn auth_restore_remembered_session(
    state: State<'_, AppState>,
) -> Result<Option<AuthResponse>, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    auth.restore_remembered_session()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_get_preferences(
    state: State<'_, AppState>,
    token: String,
) -> Result<UserPreferences, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    let user = auth
        .validate_active_session(&token)
        .await
        .map_err(|e| e.to_string())?;
    auth.get_preferences(&user.id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_update_preferences(
    state: State<'_, AppState>,
    token: String,
    request: UpdatePreferencesRequest,
) -> Result<UserPreferences, String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    let user = auth
        .validate_active_session(&token)
        .await
        .map_err(|e| e.to_string())?;
    auth.update_preferences(&user.id, &token, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, AppState>,
    token: String,
    request: ChangePasswordRequest,
) -> Result<(), String> {
    let auth = state.auth().map_err(|e| e.to_string())?;
    let user = auth
        .validate_active_session(&token)
        .await
        .map_err(|e| e.to_string())?;
    auth.change_password(&user.id, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn auth_touch_activity(state: State<'_, AppState>, token: String) -> Result<(), String> {
    if let Ok(auth) = state.auth() {
        auth.touch_activity(&token).await;
    }
    Ok(())
}
