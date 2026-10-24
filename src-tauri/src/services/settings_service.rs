use crate::database::Database;
use crate::domain::settings::AppSetting;
use crate::errors::AppError;
use crate::repositories::SettingsRepository;

pub struct SettingsService;

impl SettingsService {
    pub fn get_setting(db: &Database, key: &str) -> Result<Option<String>, AppError> {
        let conn = db.lock()?;
        SettingsRepository::get(&conn, key)
            .map_err(|e| AppError::Internal(format!("Failed to retrieve setting: {}", e)))
    }

    pub fn set_setting(db: &Database, key: &str, value: &str) -> Result<(), AppError> {
        let conn = db.lock()?;
        SettingsRepository::set(&conn, key, value)
            .map_err(|e| AppError::Internal(format!("Failed to save setting: {}", e)))
    }

    pub fn list_settings(db: &Database) -> Result<Vec<AppSetting>, AppError> {
        let conn = db.lock()?;
        SettingsRepository::list(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to list settings: {}", e)))
    }
}
