use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Internal typed application errors categorized for domain tracking.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Command execution error: {0}")]
    Command(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Sanitized, serializable error representation exposed across the Tauri IPC boundary.
/// Internal stack traces, raw error causes, and system paths are stripped.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
        }
    }
}

impl From<AppError> for CommandError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::Config(msg) => Self::new("ERR_CONFIG", msg, false),
            AppError::Validation(msg) => Self::new("ERR_VALIDATION", msg, false),
            AppError::Command(msg) => Self::new("ERR_COMMAND", msg, true),
            AppError::Internal(_) => Self::new(
                "ERR_INTERNAL",
                "An unexpected internal error occurred. Please try again.",
                true,
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_to_command_error_conversion() {
        let val_err = AppError::Validation("Query cannot be empty".to_string());
        let cmd_err: CommandError = val_err.into();
        assert_eq!(cmd_err.code, "ERR_VALIDATION");
        assert_eq!(cmd_err.message, "Query cannot be empty");
        assert!(!cmd_err.retryable);

        let internal_err = AppError::Internal("sensitive database path failure".to_string());
        let cmd_err: CommandError = internal_err.into();
        assert_eq!(cmd_err.code, "ERR_INTERNAL");
        // Ensure sensitive details are not leaked
        assert!(!cmd_err.message.contains("database path"));
        assert!(cmd_err.retryable);
    }
}
