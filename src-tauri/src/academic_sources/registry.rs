use std::collections::HashMap;
use std::sync::Arc;

use crate::academic_sources::adapter::AcademicSourceAdapter;
use crate::academic_sources::providers::{
    ArxivAdapter, CrossrefAdapter, EuropePmcAdapter, OpenAlexAdapter, SemanticScholarAdapter,
};
use crate::academic_sources::types::{ProviderCapabilities, ProviderId};

/// Central registry holding all configured academic source adapters.
#[derive(Clone)]
pub struct ProviderRegistry {
    adapters: HashMap<ProviderId, Arc<dyn AcademicSourceAdapter>>,
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ProviderRegistry {
    /// Initializes the registry with the 5 core Tier A scholarly source adapters.
    pub fn new() -> Self {
        let mut adapters: HashMap<ProviderId, Arc<dyn AcademicSourceAdapter>> = HashMap::new();

        adapters.insert(ProviderId::OpenAlex, Arc::new(OpenAlexAdapter::new()));
        adapters.insert(ProviderId::Crossref, Arc::new(CrossrefAdapter::new()));
        adapters.insert(
            ProviderId::SemanticScholar,
            Arc::new(SemanticScholarAdapter::new()),
        );
        adapters.insert(ProviderId::Arxiv, Arc::new(ArxivAdapter::new()));
        adapters.insert(ProviderId::EuropePmc, Arc::new(EuropePmcAdapter::new()));

        Self { adapters }
    }

    /// Retrieves an adapter by provider ID.
    pub fn get_adapter(&self, id: ProviderId) -> Option<Arc<dyn AcademicSourceAdapter>> {
        self.adapters.get(&id).cloned()
    }

    /// Lists capability declarations for all registered providers.
    pub fn list_capabilities(&self) -> Vec<ProviderCapabilities> {
        let mut caps: Vec<ProviderCapabilities> = self
            .adapters
            .values()
            .map(|adapter| adapter.capabilities())
            .collect();

        // Sort predictably by display name
        caps.sort_by(|a, b| a.display_name.cmp(&b.display_name));
        caps
    }

    /// Checks if a provider is registered.
    pub fn is_supported(&self, id: ProviderId) -> bool {
        self.adapters.contains_key(&id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_initialization_and_capabilities() {
        let registry = ProviderRegistry::new();
        let capabilities = registry.list_capabilities();

        assert_eq!(
            capabilities.len(),
            5,
            "Expected 5 core providers in registry"
        );

        assert!(registry.is_supported(ProviderId::OpenAlex));
        assert!(registry.is_supported(ProviderId::Crossref));
        assert!(registry.is_supported(ProviderId::SemanticScholar));
        assert!(registry.is_supported(ProviderId::Arxiv));
        assert!(registry.is_supported(ProviderId::EuropePmc));

        let openalex_cap = capabilities
            .iter()
            .find(|c| c.provider_id == ProviderId::OpenAlex)
            .unwrap();
        assert_eq!(openalex_cap.display_name, "OpenAlex");
        assert!(openalex_cap.supports_year_filter);
        assert!(openalex_cap.supports_open_access_filter);
    }
}
