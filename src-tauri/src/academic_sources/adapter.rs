use crate::academic_sources::errors::AcademicError;
use crate::academic_sources::types::{
    AcademicSearchQuery, NormalizedWork, ProviderCapabilities, ProviderId,
};
use async_trait::async_trait;

/// Result returned by an individual provider adapter.
#[derive(Debug, Clone)]
pub struct AdapterSearchResult {
    pub works: Vec<NormalizedWork>,
    pub next_cursor: Option<String>,
    pub total_results: Option<u64>,
}

/// Abstract contract implemented by every academic API connector.
#[async_trait]
pub trait AcademicSourceAdapter: Send + Sync {
    /// Returns the unique identifier for this provider.
    fn provider_id(&self) -> ProviderId;

    /// Returns the documented capability matrix for this provider.
    fn capabilities(&self) -> ProviderCapabilities;

    /// Executes a search against the provider API, returning normalized works.
    async fn search(
        &self,
        client: &reqwest::Client,
        query: &AcademicSearchQuery,
        api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError>;
}
