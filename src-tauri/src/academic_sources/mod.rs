pub mod adapter;
pub mod errors;
pub mod providers;
pub mod query_planner;
pub mod rate_limit;
pub mod registry;
pub mod search_service;
pub mod types;

pub use adapter::AcademicSourceAdapter;
pub use errors::AcademicError;
pub use query_planner::AcademicQueryPlanner;
pub use registry::ProviderRegistry;
pub use search_service::AcademicSearchService;
pub use types::{
    AcademicSearchPlan, AcademicSearchQuery, ImportSummary, MetadataCompleteness, NormalizedAuthor,
    NormalizedWork, ProviderCapabilities, ProviderHealthCheck, ProviderHealthStatus, ProviderId,
    ProviderProvenance, ProviderQueryPlan, ProviderStatus, ProviderStatusCategory,
    UnifiedSearchResponse,
};
