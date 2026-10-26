use serde::{Deserialize, Serialize};

use crate::state::AppState;

/// Diagnostic status for core application subsystems.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubsystemHealth {
    pub database: String,
    pub network_engine: String,
    pub scraper_pipeline: String,
    pub pdf_processor: String,
}

/// Comprehensive health check payload returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HealthResponse {
    pub status: String,
    pub app_version: String,
    pub platform: String,
    pub backend_ready: bool,
    pub uptime_secs: u64,
    pub default_storage_dir: String,
    pub subsystems: SubsystemHealth,
}

pub struct HealthService;

impl HealthService {
    pub async fn check_health(state: &AppState) -> HealthResponse {
        let config = state.config.read().await;
        let platform = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);

        let db_status = match state.database {
            Some(ref db) => match db.get_info() {
                Ok(info) => format!(
                    "ready (SQLite 3, schema v{}, {})",
                    info.schema_version, info.journal_mode
                ),
                Err(e) => format!("error ({})", e),
            },
            None => "uninitialized".to_string(),
        };

        HealthResponse {
            status: "healthy".to_string(),
            app_version: config.app_version.clone(),
            platform,
            backend_ready: true,
            uptime_secs: state.uptime_secs(),
            default_storage_dir: config.default_library_dir.to_string_lossy().to_string(),
            subsystems: SubsystemHealth {
                database: db_status,
                network_engine: "ready (Base HTTP Client)".to_string(),
                scraper_pipeline: "not_implemented (Scheduled for Phase 5-6)".to_string(),
                pdf_processor: "not_implemented (Scheduled for Phase 7)".to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check_returns_valid_response() {
        let state = AppState::default();
        let health = HealthService::check_health(&state).await;

        assert_eq!(health.status, "healthy");
        assert!(health.backend_ready);
        assert!(!health.platform.is_empty());
        assert_eq!(health.subsystems.database, "uninitialized");
    }
}
