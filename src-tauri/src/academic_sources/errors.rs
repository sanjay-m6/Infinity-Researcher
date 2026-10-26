use crate::errors::{AppError, CommandError};
use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum AcademicError {
    #[error("Invalid search query: {0}")]
    InvalidQuery(String),

    #[error("Provider '{provider}' does not support filter '{filter}'")]
    UnsupportedFilter { provider: String, filter: String },

    #[error("Authentication required for provider '{0}'")]
    AuthRequired(String),

    #[error("Rate limit exceeded for provider. Retry after {retry_after_secs:?} seconds")]
    RateLimited { retry_after_secs: Option<u64> },

    #[error("Provider temporarily unavailable: {0}")]
    Unavailable(String),

    #[error("Network error communicating with provider: {0}")]
    Network(String),

    #[error("Network request timed out")]
    Timeout,

    #[error("Failed to parse provider response: {0}")]
    ParseError(String),

    #[error("Provider response payload too large: {0}")]
    PayloadTooLarge(String),

    #[error("Search operation was cancelled by user")]
    Cancelled,

    #[error("Unknown or unsupported provider: {0}")]
    UnknownProvider(String),

    #[error("Database error during import: {0}")]
    Database(String),
}

impl From<AcademicError> for AppError {
    fn from(err: AcademicError) -> Self {
        match err {
            AcademicError::InvalidQuery(msg) => AppError::Validation(msg),
            AcademicError::UnsupportedFilter { provider, filter } => AppError::Validation(format!(
                "Provider '{}' does not support filter '{}'",
                provider, filter
            )),
            AcademicError::AuthRequired(p) => {
                AppError::Validation(format!("Authentication credentials required for '{}'", p))
            }
            AcademicError::RateLimited { .. } => AppError::Network(err.to_string()),
            AcademicError::Unavailable(msg) => AppError::Network(msg),
            AcademicError::Network(msg) => AppError::Network(msg),
            AcademicError::Timeout => AppError::Network("Request timed out".to_string()),
            AcademicError::ParseError(msg) => AppError::Internal(format!("Parse error: {}", msg)),
            AcademicError::PayloadTooLarge(msg) => AppError::Network(msg),
            AcademicError::Cancelled => AppError::Internal("Operation cancelled".to_string()),
            AcademicError::UnknownProvider(p) => {
                AppError::Validation(format!("Unknown provider '{}'", p))
            }
            AcademicError::Database(msg) => AppError::Internal(msg),
        }
    }
}

impl From<AcademicError> for CommandError {
    fn from(err: AcademicError) -> Self {
        let app_err: AppError = err.into();
        app_err.into()
    }
}
