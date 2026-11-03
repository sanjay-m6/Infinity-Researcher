use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use argon2::password_hash::{Error as PasswordHashError, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::rngs::OsRng;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use crate::database::Database;
use crate::domain::auth::{
    AuthResponse, ChangePasswordRequest, LoginRequest, SignupRequest, UpdatePreferencesRequest,
    User, UserPreferences, UserRecord,
};
use crate::errors::AppError;
use crate::repositories::auth_repo::AuthRepository;

const MAX_FAILED_ATTEMPTS: u32 = 5;
const LOCKOUT_DURATION_SECS: u64 = 300; // 5 minutes
const KEYRING_SERVICE: &str = "infinity-researcher";
const KEYRING_ACCOUNT: &str = "active_session_v1";

#[derive(Debug, Clone)]
pub struct ActiveSession {
    pub token: String,
    pub user: User,
    pub is_locked: bool,
    pub remember_me: bool,
    pub auto_lock_timeout_minutes: i64,
    pub created_at: Instant,
    pub last_active_at: Instant,
}

#[derive(Debug, Clone)]
struct FailedLoginTracker {
    count: u32,
    last_failure: Instant,
}

pub struct AuthService {
    db: Arc<Database>,
    sessions: Arc<RwLock<HashMap<String, ActiveSession>>>,
    failed_attempts: Arc<RwLock<HashMap<String, FailedLoginTracker>>>,
}

impl AuthService {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            failed_attempts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // -----------------------------------------------------------------------
    // Password Hashing & Verification via Argon2id
    // -----------------------------------------------------------------------

    pub fn hash_password(password: &str) -> Result<String, AppError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Failed to hash password with Argon2id: {}", e)))?
            .to_string();
        Ok(hash)
    }

    pub fn verify_password(password: &str, stored_hash: &str) -> Result<bool, AppError> {
        let parsed_hash = match PasswordHash::new(stored_hash) {
            Ok(h) => h,
            Err(e) => {
                warn!("Malformed password hash in database: {}", e);
                return Ok(false);
            }
        };

        let argon2 = Argon2::default();
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(PasswordHashError::Password) => Ok(false),
            Err(e) => {
                warn!("Argon2 password verification failed with error: {}", e);
                Ok(false)
            }
        }
    }

    // -----------------------------------------------------------------------
    // Rate Limiting / Login Throttling
    // -----------------------------------------------------------------------

    async fn check_throttling(&self, identifier: &str) -> Result<(), AppError> {
        let tracker = self.failed_attempts.read().await;
        let key = identifier.trim().to_lowercase();
        if let Some(entry) = tracker.get(&key) {
            if entry.count >= MAX_FAILED_ATTEMPTS {
                let elapsed = entry.last_failure.elapsed();
                if elapsed < Duration::from_secs(LOCKOUT_DURATION_SECS) {
                    let remaining_secs = LOCKOUT_DURATION_SECS - elapsed.as_secs();
                    let minutes = (remaining_secs + 59) / 60;
                    return Err(AppError::Validation(format!(
                        "Too many failed login attempts. Account temporarily locked. Please try again in {} minute(s).",
                        minutes
                    )));
                }
            }
        }
        Ok(())
    }

    async fn record_failed_attempt(&self, identifier: &str) {
        let mut tracker = self.failed_attempts.write().await;
        let key = identifier.trim().to_lowercase();
        let entry = tracker.entry(key).or_insert(FailedLoginTracker {
            count: 0,
            last_failure: Instant::now(),
        });
        if entry.last_failure.elapsed() > Duration::from_secs(LOCKOUT_DURATION_SECS) {
            entry.count = 1;
        } else {
            entry.count += 1;
        }
        entry.last_failure = Instant::now();
    }

    async fn clear_failed_attempts(&self, identifier: &str) {
        let mut tracker = self.failed_attempts.write().await;
        let key = identifier.trim().to_lowercase();
        tracker.remove(&key);
    }

    // -----------------------------------------------------------------------
    // Signup Logic
    // -----------------------------------------------------------------------

    pub async fn signup(&self, req: SignupRequest) -> Result<AuthResponse, AppError> {
        let email = req.email.trim();
        let username = req.username.trim();

        // 1. Validation
        if email.is_empty() {
            return Err(AppError::Validation("Email address is required.".to_string()));
        }
        if !email.contains('@') || !email.contains('.') {
            return Err(AppError::Validation("Please enter a valid email address.".to_string()));
        }
        if username.is_empty() {
            return Err(AppError::Validation("User ID is required.".to_string()));
        }
        if username.len() < 3 {
            return Err(AppError::Validation("User ID must be at least 3 characters long.".to_string()));
        }
        if req.password.is_empty() {
            return Err(AppError::Validation("Password is required.".to_string()));
        }
        if req.password.len() < 8 {
            return Err(AppError::Validation("Password must be at least 8 characters long.".to_string()));
        }
        if req.password != req.confirm_password {
            return Err(AppError::Validation("Passwords do not match.".to_string()));
        }

        let user = {
            let conn = self.db.lock()?;
            if AuthRepository::email_exists(&conn, email)? {
                return Err(AppError::Validation(format!(
                    "An account with email '{}' already exists.",
                    email
                )));
            }
            if AuthRepository::username_exists(&conn, username)? {
                return Err(AppError::Validation(format!(
                    "User ID '{}' is already taken. Please choose another.",
                    username
                )));
            }

            let password_hash = Self::hash_password(&req.password)?;
            let now = chrono::Utc::now().to_rfc3339();
            let user_id = format!("usr_{}", Uuid::new_v4().simple());

            let record = UserRecord {
                id: user_id.clone(),
                email: email.to_string(),
                username: username.to_string(),
                password_hash,
                created_at: now.clone(),
                last_login_at: Some(now.clone()),
            };

            AuthRepository::create_user(&conn, &record)?;
            let _ = AuthRepository::assign_unowned_records(&conn, &user_id);
            record.to_public()
        }; // conn dropped here

        let token = Uuid::new_v4().to_string();

        let session = ActiveSession {
            token: token.clone(),
            user: user.clone(),
            is_locked: false,
            remember_me: false,
            auto_lock_timeout_minutes: 10,
            created_at: Instant::now(),
            last_active_at: Instant::now(),
        };

        self.sessions.write().await.insert(token.clone(), session);
        info!(user_id = %user.id, username = %user.username, "New user registered and authenticated");

        Ok(AuthResponse {
            user,
            token,
            remember_me: false,
            auto_lock_timeout_minutes: 10,
        })
    }

    // -----------------------------------------------------------------------
    // Login Logic
    // -----------------------------------------------------------------------

    pub async fn login(&self, req: LoginRequest) -> Result<AuthResponse, AppError> {
        let identifier = req.identifier.trim();
        if identifier.is_empty() {
            return Err(AppError::Validation("Email or User ID is required.".to_string()));
        }
        if req.password.is_empty() {
            return Err(AppError::Validation("Password is required.".to_string()));
        }

        self.check_throttling(identifier).await?;

        enum LoginLookup {
            Success(User, bool, i64),
            InvalidCredentials,
            DbError(AppError),
        }

        let lookup = {
            match self.db.lock() {
                Err(e) => LoginLookup::DbError(e),
                Ok(conn) => match AuthRepository::find_by_identifier(&conn, identifier) {
                    Err(e) => LoginLookup::DbError(e.into()),
                    Ok(None) => LoginLookup::InvalidCredentials,
                    Ok(Some(record)) => match Self::verify_password(&req.password, &record.password_hash) {
                        Err(e) => LoginLookup::DbError(e),
                        Ok(false) => LoginLookup::InvalidCredentials,
                        Ok(true) => {
                            let _ = AuthRepository::update_last_login(&conn, &record.id);
                            match AuthRepository::get_preferences(&conn, &record.id) {
                                Err(e) => LoginLookup::DbError(e.into()),
                                Ok(prefs) => {
                                    let rem = req.remember_me.unwrap_or(prefs.remember_me);
                                    LoginLookup::Success(record.to_public(), rem, prefs.auto_lock_timeout_minutes)
                                }
                            }
                        }
                    },
                },
            }
        }; // conn strictly dropped here

        let (user, remember, timeout) = match lookup {
            LoginLookup::DbError(e) => return Err(e),
            LoginLookup::InvalidCredentials => {
                self.record_failed_attempt(identifier).await;
                return Err(AppError::Validation("Invalid email/User ID or password.".to_string()));
            }
            LoginLookup::Success(user, rem, timeout) => (user, rem, timeout),
        };

        self.clear_failed_attempts(identifier).await;

        let token = Uuid::new_v4().to_string();

        let session = ActiveSession {
            token: token.clone(),
            user: user.clone(),
            is_locked: false,
            remember_me: remember,
            auto_lock_timeout_minutes: timeout,
            created_at: Instant::now(),
            last_active_at: Instant::now(),
        };

        self.sessions.write().await.insert(token.clone(), session);

        if remember {
            self.save_remembered_session(&user.id, &token).await;
        } else {
            self.clear_remembered_session().await;
        }

        info!(user_id = %user.id, username = %user.username, "User logged in successfully");

        Ok(AuthResponse {
            user,
            token,
            remember_me: remember,
            auto_lock_timeout_minutes: timeout,
        })
    }

    // -----------------------------------------------------------------------
    // Lock, Unlock & Session Inactivity
    // -----------------------------------------------------------------------

    pub async fn lock_session(&self, token: &str) -> Result<(), AppError> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(token) {
            session.is_locked = true;
            info!(user_id = %session.user.id, "Session locked");
            Ok(())
        } else {
            Err(AppError::Validation("Session not found.".to_string()))
        }
    }

    pub async fn unlock_session(&self, token: &str, password: &str) -> Result<AuthResponse, AppError> {
        let (user_id, remember, timeout) = {
            let sessions = self.sessions.read().await;
            let session = sessions
                .get(token)
                .ok_or_else(|| AppError::Validation("Session expired or invalid.".to_string()))?;
            (
                session.user.id.clone(),
                session.remember_me,
                session.auto_lock_timeout_minutes,
            )
        };

        {
            let conn = self.db.lock()?;
            let record = AuthRepository::find_by_id(&conn, &user_id)?
                .ok_or_else(|| AppError::Validation("User not found.".to_string()))?;

            let is_valid = Self::verify_password(password, &record.password_hash)?;
            if !is_valid {
                return Err(AppError::Validation("Incorrect password.".to_string()));
            }
        } // conn dropped here

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(token) {
            session.is_locked = false;
            session.last_active_at = Instant::now();
            info!(user_id = %session.user.id, "Session unlocked successfully");
            Ok(AuthResponse {
                user: session.user.clone(),
                token: token.to_string(),
                remember_me: remember,
                auto_lock_timeout_minutes: timeout,
            })
        } else {
            Err(AppError::Validation("Session expired during unlock.".to_string()))
        }
    }

    pub async fn logout(&self, token: &str) -> Result<(), AppError> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(token);
        drop(sessions);
        self.clear_remembered_session().await;
        info!("Session logged out and cleared");
        Ok(())
    }

    pub async fn touch_activity(&self, token: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(token) {
            if !session.is_locked {
                session.last_active_at = Instant::now();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Session Verification & Authorization Guard
    // -----------------------------------------------------------------------

    pub async fn validate_active_session(&self, token: &str) -> Result<User, AppError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(token)
            .ok_or_else(|| AppError::Validation("Authentication required. Please sign in.".to_string()))?;

        if session.is_locked {
            return Err(AppError::Validation(
                "Application is locked. Please unlock with your password to continue.".to_string(),
            ));
        }

        // Check inactivity timeout
        let max_idle = Duration::from_secs((session.auto_lock_timeout_minutes as u64) * 60);
        if session.auto_lock_timeout_minutes > 0 && session.last_active_at.elapsed() > max_idle {
            session.is_locked = true;
            return Err(AppError::Validation(
                "Application locked due to inactivity. Please enter your password to unlock.".to_string(),
            ));
        }

        session.last_active_at = Instant::now();
        Ok(session.user.clone())
    }

    pub async fn get_current_session(&self, token: Option<&str>) -> Option<AuthResponse> {
        let tok = token?;
        let sessions = self.sessions.read().await;
        let session = sessions.get(tok)?;
        Some(AuthResponse {
            user: session.user.clone(),
            token: session.token.clone(),
            remember_me: session.remember_me,
            auto_lock_timeout_minutes: session.auto_lock_timeout_minutes,
        })
    }

    // -----------------------------------------------------------------------
    // OS Keyring Remember Me Management
    // -----------------------------------------------------------------------

    async fn save_remembered_session(&self, user_id: &str, token: &str) {
        let payload = format!("{}:{}", user_id, token);
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT);
        if let Ok(entry) = entry {
            if let Err(e) = entry.set_password(&payload) {
                warn!("Failed to store session in OS keyring: {}", e);
            }
        }
    }

    async fn clear_remembered_session(&self) {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT);
        if let Ok(entry) = entry {
            let _ = entry.delete_credential();
        }
    }

    pub async fn restore_remembered_session(&self) -> Result<Option<AuthResponse>, AppError> {
        let entry = match keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT) {
            Ok(e) => e,
            Err(_) => return Ok(None),
        };

        let stored = match entry.get_password() {
            Ok(p) => p,
            Err(_) => return Ok(None),
        };

        let parts: Vec<&str> = stored.split(':').collect();
        if parts.len() != 2 {
            return Ok(None);
        }

        let user_id = parts[0];
        let (user, prefs) = {
            let conn = self.db.lock()?;
            let record = match AuthRepository::find_by_id(&conn, user_id)? {
                Some(r) => r,
                None => {
                    drop(conn);
                    let _ = entry.delete_credential();
                    return Ok(None);
                }
            };

            let prefs = AuthRepository::get_preferences(&conn, &record.id)?;
            if !prefs.remember_me {
                drop(conn);
                let _ = entry.delete_credential();
                return Ok(None);
            }

            (record.to_public(), prefs)
        }; // conn dropped here

        let new_token = Uuid::new_v4().to_string();

        let session = ActiveSession {
            token: new_token.clone(),
            user: user.clone(),
            is_locked: false,
            remember_me: true,
            auto_lock_timeout_minutes: prefs.auto_lock_timeout_minutes,
            created_at: Instant::now(),
            last_active_at: Instant::now(),
        };

        self.sessions.write().await.insert(new_token.clone(), session);
        self.save_remembered_session(&user.id, &new_token).await;
        info!(user_id = %user.id, "Restored active session from OS secure storage");

        Ok(Some(AuthResponse {
            user,
            token: new_token,
            remember_me: true,
            auto_lock_timeout_minutes: prefs.auto_lock_timeout_minutes,
        }))
    }

    // -----------------------------------------------------------------------
    // Account Preferences & Password Change
    // -----------------------------------------------------------------------

    pub async fn get_preferences(&self, user_id: &str) -> Result<UserPreferences, AppError> {
        let conn = self.db.lock()?;
        let prefs = AuthRepository::get_preferences(&conn, user_id)?;
        Ok(prefs)
    }

    pub async fn update_preferences(
        &self,
        user_id: &str,
        token: &str,
        req: UpdatePreferencesRequest,
    ) -> Result<UserPreferences, AppError> {
        let prefs = {
            let conn = self.db.lock()?;
            let mut prefs = AuthRepository::get_preferences(&conn, user_id)?;
            prefs.auto_lock_timeout_minutes = req.auto_lock_timeout_minutes;
            prefs.remember_me = req.remember_me;
            if let Some(t) = req.theme {
                prefs.theme = t;
            }

            AuthRepository::save_preferences(&conn, &prefs)?;
            prefs
        }; // conn dropped here

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(token) {
            session.auto_lock_timeout_minutes = prefs.auto_lock_timeout_minutes;
            session.remember_me = prefs.remember_me;
        }

        if prefs.remember_me {
            self.save_remembered_session(user_id, token).await;
        } else {
            self.clear_remembered_session().await;
        }

        Ok(prefs)
    }

    pub async fn change_password(
        &self,
        user_id: &str,
        req: ChangePasswordRequest,
    ) -> Result<(), AppError> {
        if req.new_password.is_empty() {
            return Err(AppError::Validation("New password is required.".to_string()));
        }
        if req.new_password.len() < 8 {
            return Err(AppError::Validation(
                "New password must be at least 8 characters long.".to_string(),
            ));
        }

        {
            let conn = self.db.lock()?;
            let record = AuthRepository::find_by_id(&conn, user_id)?
                .ok_or_else(|| AppError::Validation("User account not found.".to_string()))?;

            let is_valid = Self::verify_password(&req.current_password, &record.password_hash)?;
            if !is_valid {
                return Err(AppError::Validation("Current password is incorrect.".to_string()));
            }

            let new_hash = Self::hash_password(&req.new_password)?;
            AuthRepository::update_password_hash(&conn, user_id, &new_hash)?;
        } // conn dropped here

        info!(user_id = %user_id, "User password updated successfully");
        Ok(())
    }
}
