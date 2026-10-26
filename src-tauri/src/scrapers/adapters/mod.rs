use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub mod arxiv;
pub mod biorxiv;
pub mod medrxiv;
pub mod nature;
pub mod plos;
pub mod pmc;

pub use arxiv::ArxivAdapter;
pub use biorxiv::BiorxivAdapter;
pub use medrxiv::MedrxivAdapter;
pub use nature::NatureAdapter;
pub use plos::PlosAdapter;
pub use pmc::PmcAdapter;

use crate::scrapers::types::{
    DiscoveredSearchResult, SearchPlan, SourceCapabilities, SourceErrorCategory,
    WebsiteSearchQuery, WebsiteSourceDescriptor,
};

/// Common contract for an academic research paper source adapter.
#[async_trait]
pub trait SourceAdapter: Send + Sync {
    /// Canonical source identifier (e.g. "arxiv", "biorxiv", "plos")
    fn source_id(&self) -> &'static str;

    /// Human-readable display name
    fn display_name(&self) -> &'static str;

    /// Declarative source descriptor (domain, policy, delay, content types)
    fn descriptor(&self) -> WebsiteSourceDescriptor;

    /// Source search and extraction capabilities
    fn capabilities(&self) -> SourceCapabilities;

    /// Validates adapter-specific configuration or preconditions
    fn validate_config(&self) -> Result<(), String> {
        Ok(())
    }

    /// Verifies if the source adapter supports the given query
    fn supports_query(&self, query: &str) -> bool {
        !query.trim().is_empty()
    }

    /// Builds a source-specific search and link discovery crawl plan
    fn build_search_plan(&self, query: &WebsiteSearchQuery) -> Result<SearchPlan, String>;

    /// Extracts structured scholarly records from an HTML page for this source
    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult>;

    /// Executes query-based paper discovery against this source with cancellation check.
    async fn search(
        &self,
        client: &reqwest::Client,
        query: &WebsiteSearchQuery,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String>;

    /// Classifies an error message into a structured category for UI diagnostics.
    fn classify_error(&self, err_msg: &str) -> SourceErrorCategory {
        let lower = err_msg.to_lowercase();
        if lower.contains("timeout") || lower.contains("timed out") {
            SourceErrorCategory::Timeout
        } else if lower.contains("cloudflare")
            || lower.contains("challenge")
            || lower.contains("403")
            || lower.contains("captcha")
        {
            SourceErrorCategory::Blocked
        } else if lower.contains("429") || lower.contains("rate limit") {
            SourceErrorCategory::RateLimited
        } else if lower.contains("javascript") || lower.contains("unsupported") {
            SourceErrorCategory::Unsupported
        } else if lower.contains("cancelled") {
            SourceErrorCategory::Cancelled
        } else if lower.contains("parse") || lower.contains("json") || lower.contains("html") {
            SourceErrorCategory::ParseError
        } else {
            SourceErrorCategory::Network
        }
    }
}

/// Registry managing all available academic search adapters and compliance descriptors.
pub struct SourceRegistry {
    adapters: HashMap<String, Arc<dyn SourceAdapter>>,
    descriptors: Vec<WebsiteSourceDescriptor>,
}

impl Default for SourceRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SourceRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            adapters: HashMap::new(),
            descriptors: Vec::new(),
        };

        // Register active enabled adapters
        registry.register(Arc::new(ArxivAdapter::new()));
        registry.register(Arc::new(BiorxivAdapter::new()));
        registry.register(Arc::new(MedrxivAdapter::new()));
        registry.register(Arc::new(PlosAdapter::new()));
        registry.register(Arc::new(NatureAdapter::new()));
        registry.register(Arc::new(PmcAdapter::new()));

        // Add compliance & manual-only descriptors (IEEE Xplore, Google Scholar)
        registry.descriptors.push(WebsiteSourceDescriptor {
            id: "ieee_xplore".to_string(),
            name: "IEEE Xplore".to_string(),
            domain: "ieeexplore.ieee.org".to_string(),
            status: "manual_only".to_string(),
            policy_url: "https://www.ieee.org/about/help/terms-conditions.html".to_string(),
            policy_notes: "IEEE Terms of Use Section 4 strictly prohibits automated robots/crawlers from querying or systematically harvesting papers. Dedicated IEEE Mode A manual browser workflow is required.".to_string(),
            supports_native_years: false,
            request_delay_ms: 0,
            content_types: vec!["conference_paper".to_string(), "journal_article".to_string()],
        });

        registry.descriptors.push(WebsiteSourceDescriptor {
            id: "google_scholar".to_string(),
            name: "Google Scholar".to_string(),
            domain: "scholar.google.com".to_string(),
            status: "disabled".to_string(),
            policy_url: "https://policies.google.com/terms".to_string(),
            policy_notes: "Google Scholar prohibits automated access and employs CAPTCHA protections. Automated scraping is disabled to guarantee compliance.".to_string(),
            supports_native_years: false,
            request_delay_ms: 0,
            content_types: vec!["all".to_string()],
        });

        registry
    }

    pub fn register(&mut self, adapter: Arc<dyn SourceAdapter>) {
        let desc = adapter.descriptor();
        self.adapters
            .insert(adapter.source_id().to_string(), adapter.clone());
        self.descriptors.push(desc);
    }

    pub fn get_adapter(&self, source_id: &str) -> Option<Arc<dyn SourceAdapter>> {
        // Resolve aliases: nature_srep <-> nature
        let normalized = match source_id {
            "nature_srep" => "nature",
            other => other,
        };
        self.adapters.get(normalized).cloned()
    }

    pub fn list_descriptors(&self) -> Vec<WebsiteSourceDescriptor> {
        let mut list = self.descriptors.clone();
        // Add alias for nature_srep if nature is present
        if list.iter().any(|d| d.id == "nature") && !list.iter().any(|d| d.id == "nature_srep") {
            list.push(WebsiteSourceDescriptor {
                id: "nature_srep".to_string(),
                name: "Nature Scientific Reports".to_string(),
                domain: "nature.com".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.nature.com/nature-research/terms-and-conditions".to_string(),
                policy_notes: "Open access scientific reports journal from Nature Portfolio; verified peer-reviewed research.".to_string(),
                supports_native_years: false,
                request_delay_ms: 2500,
                content_types: vec!["journal_article".to_string()],
            });
        }
        list
    }
}
