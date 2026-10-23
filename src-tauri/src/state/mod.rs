use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::config::AppConfig;

/// Shared application state managed by the Tauri runtime.
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub start_time: Instant,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Arc::new(RwLock::new(AppConfig::default())),
            start_time: Instant::now(),
        }
    }
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            start_time: Instant::now(),
        }
    }

    /// Returns elapsed uptime in seconds.
    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
}
