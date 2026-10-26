use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::errors::AppError;

/// Core application configuration defaults and preferences.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppConfig {
    pub app_name: String,
    pub app_version: String,
    pub default_library_dir: PathBuf,
    pub max_file_size_bytes: u64,
    pub default_concurrency_limit: usize,
    pub request_timeout_secs: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home_dir = std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));

        let default_library_dir = home_dir.join("Documents").join("ResearchPapers");

        Self {
            app_name: "Infinity Researcher".to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            default_library_dir,
            max_file_size_bytes: 100 * 1024 * 1024, // 100 MB ceiling
            default_concurrency_limit: 4,
            request_timeout_secs: 15,
        }
    }
}

impl AppConfig {
    /// Validates configuration bounds to prevent resource exhaustion or invalid parameters.
    pub fn validate(&self) -> Result<(), AppError> {
        if self.app_name.trim().is_empty() {
            return Err(AppError::Validation("App name cannot be empty".to_string()));
        }

        if self.default_concurrency_limit == 0 || self.default_concurrency_limit > 20 {
            return Err(AppError::Validation(
                "Concurrency limit must be between 1 and 20".to_string(),
            ));
        }

        if self.max_file_size_bytes < 1024 * 1024 || self.max_file_size_bytes > 500 * 1024 * 1024 {
            return Err(AppError::Validation(
                "Max file size must be between 1 MB and 500 MB".to_string(),
            ));
        }

        if self.request_timeout_secs == 0 || self.request_timeout_secs > 120 {
            return Err(AppError::Validation(
                "Request timeout must be between 1 and 120 seconds".to_string(),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_is_valid() {
        let config = AppConfig::default();
        assert!(config.validate().is_ok());
        assert_eq!(config.default_concurrency_limit, 4);
        assert_eq!(config.max_file_size_bytes, 100 * 1024 * 1024);
    }

    #[test]
    fn test_invalid_concurrency_rejected() {
        let mut config = AppConfig {
            default_concurrency_limit: 0,
            ..Default::default()
        };
        assert!(config.validate().is_err());

        config.default_concurrency_limit = 50;
        assert!(config.validate().is_err());
    }
}
