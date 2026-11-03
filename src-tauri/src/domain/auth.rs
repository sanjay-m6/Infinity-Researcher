use serde::{Deserialize, Serialize};

/// Public user profile representation safe for sending to frontend.
/// Notice: password_hash is strictly excluded.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: String,
    pub created_at: String,
    pub last_login_at: Option<String>,
}

/// Internal database representation containing the hashed password.
#[derive(Debug, Clone)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub username: String,
    pub password_hash: String,
    pub created_at: String,
    pub last_login_at: Option<String>,
}

impl UserRecord {
    pub fn to_public(&self) -> User {
        User {
            id: self.id.clone(),
            email: self.email.clone(),
            username: self.username.clone(),
            created_at: self.created_at.clone(),
            last_login_at: self.last_login_at.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UserPreferences {
    pub user_id: String,
    pub auto_lock_timeout_minutes: i64,
    pub remember_me: bool,
    pub theme: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            user_id: String::new(),
            auto_lock_timeout_minutes: 10,
            remember_me: false,
            theme: "system".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub username: String,
    pub password: String,
    pub confirm_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub identifier: String, // email or username
    pub password: String,
    pub remember_me: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
    pub remember_me: bool,
    pub auto_lock_timeout_minutes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub auto_lock_timeout_minutes: i64,
    pub remember_me: bool,
    pub theme: Option<String>,
}

