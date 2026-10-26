pub mod adapter;
pub mod errors;
pub mod providers;
pub mod rate_limit;
pub mod registry;
pub mod search_service;
pub mod types;

pub use adapter::AcademicSourceAdapter;
pub use errors::AcademicError;
pub use registry::ProviderRegistry;
pub use search_service::AcademicSearchService;
pub use types::{
    AcademicSearchQuery, ImportSummary, NormalizedAuthor, NormalizedWork, ProviderCapabilities,
    ProviderId, ProviderProvenance, ProviderStatus, ProviderStatusCategory, UnifiedSearchResponse,
};
