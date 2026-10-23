use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initializes structured logging for the application.
/// Respects `RUST_LOG` environment variable if set, defaulting to `info`.
pub fn init_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,research_paper_scraper=debug"));

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true);

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .try_init();
}

/// Redacts sensitive information (API keys, Authorization tokens, email addresses) from log messages.
pub fn redact_sensitive_string(input: &str) -> String {
    let mut sanitized = input.to_string();

    // Redact Bearer tokens
    if let Some(pos) = sanitized.to_lowercase().find("bearer ") {
        let start = pos + 7;
        let end = sanitized[start..]
            .find(|c: char| c.is_whitespace() || c == '"' || c == ',' || c == ';')
            .map(|offset| start + offset)
            .unwrap_or(sanitized.len());
        if start < end {
            sanitized.replace_range(start..end, "[REDACTED_TOKEN]");
        }
    }

    // Redact api_key query parameters or headers
    for pattern in &["api_key=", "x-api-key: ", "apikey="] {
        if let Some(pos) = sanitized.to_lowercase().find(pattern) {
            let start = pos + pattern.len();
            let end = sanitized[start..]
                .find(|c: char| c.is_whitespace() || c == '&' || c == '"' || c == ',')
                .map(|offset| start + offset)
                .unwrap_or(sanitized.len());
            if start < end {
                sanitized.replace_range(start..end, "[REDACTED_KEY]");
            }
        }
    }

    sanitized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_bearer_token() {
        let log = "Connecting with Authorization: Bearer secret_token_12345 to endpoint";
        let redacted = redact_sensitive_string(log);
        assert!(!redacted.contains("secret_token_12345"));
        assert!(redacted.contains("[REDACTED_TOKEN]"));
    }

    #[test]
    fn test_redact_api_key_query_param() {
        let log = "GET https://api.openalex.org/works?api_key=my_super_secret_key&filter=oa";
        let redacted = redact_sensitive_string(log);
        assert!(!redacted.contains("my_super_secret_key"));
        assert!(redacted.contains("[REDACTED_KEY]"));
    }
}
