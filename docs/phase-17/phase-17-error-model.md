# Phase 17 — Academic Connector Error Model & Fault Taxonomy

**Subsystem**: Error Handling Architecture  
**Module**: `src-tauri/src/academic_sources/errors.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Error Handling Philosophy

Academic source connectors interact with unauthenticated public APIs subject to transient downtime, publisher paywalls, aggressive rate limiting, and arbitrary schema modifications. 

Our core error handling principles:
1. **Never Fail Silently**: Upstream rejections must be accurately translated into domain error variants.
2. **Never Cascade Failures**: One provider failure must not crash or abort the multi-source search pipeline.
3. **Actionable User Guidance**: Error messages must inform the user why the failure occurred and what concrete steps will resolve it (e.g. wait $N$ seconds, enter API key, check internet connection).

---

## 2. Rust `AcademicError` Taxonomy

```rust
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

    #[error("Internal academic search error: {0}")]
    Internal(String),
}
```

---

## 3. Mapping to Application Error & Frontend Status

| `AcademicError` Variant | Mapped `AppError` | Mapped `ProviderStatusCategory` | User Facing Status Text |
| :--- | :--- | :--- | :--- |
| `InvalidQuery(msg)` | `AppError::Validation(msg)` | `Failed` | "Query validation error: {msg}" |
| `UnsupportedFilter` | `AppError::Validation(msg)` | `SucceededWithWarnings` | "Filter post-filtered locally" |
| `AuthRequired(prov)` | `AppError::Auth(prov)` | `AuthenticationRequired` | "API key required or expired for {prov}" |
| `RateLimited { secs }` | `AppError::Network(...)` | `RateLimited` | "Rate limited. Retry after {secs}s" |
| `Unavailable(msg)` | `AppError::Network(msg)` | `Unavailable` | "Provider service unavailable: {msg}" |
| `Network(msg)` | `AppError::Network(msg)` | `Unavailable` | "Network error contacting provider" |
| `Timeout` | `AppError::Network(...)` | `Unavailable` | "Request timed out after 15s" |
| `ParseError(msg)` | `AppError::Internal(...)` | `Failed` | "Failed to parse provider response" |
| `Cancelled` | `AppError::Internal(...)` | `Cancelled` | "Search cancelled by user" |

---

## 4. UI Display & Retry UX

When one or more providers experience errors:
- The search view displays an alert banner summarizing the partial results:  
  *"Search completed with partial results: 3 providers succeeded, 1 rate-limited, 1 timed out."*
- A prominent button **"Retry Failed Sources"** appears, allowing the researcher to re-query only the affected providers without losing already-loaded works.

