use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::config::AppConfig;
use crate::database::Database;
use crate::errors::AppError;

/// Shared application state managed by the Tauri runtime.
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub start_time: Instant,
    pub database: Option<Arc<Database>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Arc::new(RwLock::new(AppConfig::default())),
            start_time: Instant::now(),
            database: None,
        }
    }
}

impl AppState {
    pub fn new(config: AppConfig, database: Option<Arc<Database>>) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            start_time: Instant::now(),
            database,
        }
    }

    /// Returns elapsed uptime in seconds.
    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Returns a reference to the active Database or errors if not initialized.
    pub fn db(&self) -> Result<&Arc<Database>, AppError> {
        self.database
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database is not initialized".to_string()))
    }
}
