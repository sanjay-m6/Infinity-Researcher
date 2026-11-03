use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Identifiers for supported scholarly API sources.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProviderId {
    #[serde(rename = "openalex", alias = "open_alex")]
    OpenAlex,
    #[serde(rename = "crossref", alias = "cross_ref")]
    Crossref,
    #[serde(rename = "semantic_scholar", alias = "semanticscholar")]
    SemanticScholar,
    #[serde(rename = "arxiv")]
    Arxiv,
    #[serde(rename = "europe_pmc", alias = "europepmc")]
    EuropePmc,
}

impl ProviderId {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProviderId::OpenAlex => "openalex",
            ProviderId::Crossref => "crossref",
            ProviderId::SemanticScholar => "semantic_scholar",
            ProviderId::Arxiv => "arxiv",
            ProviderId::EuropePmc => "europe_pmc",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ProviderId::OpenAlex => "OpenAlex",
            ProviderId::Crossref => "Crossref",
            ProviderId::SemanticScholar => "Semantic Scholar",
            ProviderId::Arxiv => "arXiv",
            ProviderId::EuropePmc => "Europe PMC",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.to_lowercase().trim() {
            "openalex" | "open_alex" => Some(ProviderId::OpenAlex),
            "crossref" | "cross_ref" => Some(ProviderId::Crossref),
            "semantic_scholar" | "semanticscholar" => Some(ProviderId::SemanticScholar),
            "arxiv" => Some(ProviderId::Arxiv),
            "europe_pmc" | "europepmc" => Some(ProviderId::EuropePmc),
            _ => None,
        }
    }
}

pub fn default_all_providers() -> Vec<ProviderId> {
    vec![
        ProviderId::OpenAlex,
        ProviderId::Crossref,
        ProviderId::SemanticScholar,
        ProviderId::Arxiv,
        ProviderId::EuropePmc,
    ]
}

fn deserialize_providers_tolerant<'de, D>(deserializer: D) -> Result<Vec<ProviderId>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct ProvidersVisitor;

    impl<'de> serde::de::Visitor<'de> for ProvidersVisitor {
        type Value = Vec<ProviderId>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a list of provider names or null")
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let mut providers = Vec::new();
            while let Some(elem) = seq.next_element::<Option<serde_json::Value>>()? {
                if let Some(serde_json::Value::String(s)) = elem {
                    if let Some(pid) = ProviderId::parse(&s) {
                        if !providers.contains(&pid) {
                            providers.push(pid);
                        }
                    }
                }
            }
            if providers.is_empty() {
                Ok(default_all_providers())
            } else {
                Ok(providers)
            }
        }

        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(default_all_providers())
        }

        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(default_all_providers())
        }
    }

    deserializer.deserialize_any(ProvidersVisitor)
}

/// Metadata exposing what filters, features, and limits each provider supports.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub provider_id: ProviderId,
    pub display_name: String,
    pub description: String,
    pub documentation_url: String,
    pub supports_year_filter: bool,
    pub supports_open_access_filter: bool,
    pub supports_doi_lookup: bool,
    #[serde(default)]
    pub supports_author_search: bool,
    #[serde(default)]
    pub supports_abstracts: bool,
    #[serde(default)]
    pub supports_pdf_discovery: bool,
    pub supports_pagination: bool,
    #[serde(default)]
    pub supports_cursor_pagination: bool,
    pub requires_api_key: bool,
    pub rate_limit_rps: f64,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String,
    #[serde(default = "default_preferred_identifier")]
    pub preferred_identifier: String,
}

fn default_category() -> String {
    "General Scholarly".to_string()
}

fn default_auth_type() -> String {
    "none".to_string()
}

fn default_preferred_identifier() -> String {
    "doi".to_string()
}

/// Health status classification for academic source connectors.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderHealthStatus {
    Healthy,
    Degraded,
    Unavailable,
    RateLimited,
    AuthRequired,
}

impl ProviderHealthStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProviderHealthStatus::Healthy => "healthy",
            ProviderHealthStatus::Degraded => "degraded",
            ProviderHealthStatus::Unavailable => "unavailable",
            ProviderHealthStatus::RateLimited => "rate_limited",
            ProviderHealthStatus::AuthRequired => "auth_required",
        }
    }
}

/// Diagnostic health check result for an academic connector.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealthCheck {
    pub provider_id: ProviderId,
    pub status: ProviderHealthStatus,
    pub latency_ms: u64,
    pub message: Option<String>,
    pub checked_at: String,
}

/// Status categories for individual provider searches.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStatusCategory {
    Idle,
    Queued,
    Running,
    Succeeded,
    SucceededWithWarnings,
    NoResults,
    RateLimited,
    AuthenticationRequired,
    Unavailable,
    Failed,
    Cancelled,
}

/// Execution status reported for each provider in a search request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub provider_id: ProviderId,
    pub status: ProviderStatusCategory,
    pub message: Option<String>,
    pub result_count: usize,
    pub total_results: Option<u64>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
    pub elapsed_ms: u64,
}

/// Standardized input query parameters for academic discovery.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicSearchQuery {
    pub query: String,
    #[serde(
        default = "default_all_providers",
        deserialize_with = "deserialize_providers_tolerant"
    )]
    pub providers: Vec<ProviderId>,
    #[serde(default)]
    pub year_start: Option<i32>,
    #[serde(default)]
    pub year_end: Option<i32>,
    #[serde(default)]
    pub open_access_only: Option<bool>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub page_size: Option<u32>,
    #[serde(default)]
    pub cursor_tokens: Option<HashMap<String, String>>,
}

/// Normalized author representation across providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedAuthor {
    pub name: String,
    pub orcid: Option<String>,
    pub affiliation: Option<String>,
}

/// Records where an academic paper was retrieved and upstream record IDs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProvenance {
    pub provider_id: ProviderId,
    pub record_id: String,
    pub landing_url: Option<String>,
    pub retrieved_at: String,
}

fn default_metadata_score() -> u8 {
    0
}

/// Metadata completeness assessment for a normalized scholarly work.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetadataCompleteness {
    pub score: u8,
    pub has_doi: bool,
    pub has_abstract: bool,
    pub has_pdf: bool,
    pub has_authors: bool,
    pub has_venue: bool,
    pub has_date: bool,
}

/// Unified scholarly work model across all academic connectors.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedWork {
    pub id: String,
    pub canonical_doi: Option<String>,
    pub title: String,
    pub clean_title_key: String,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub venue_type: Option<String>,
    pub authors: Vec<NormalizedAuthor>,
    pub is_open_access: bool,
    pub landing_url: Option<String>,
    pub pdf_url: Option<String>,
    pub citation_count: Option<u32>,
    pub provider_id: ProviderId,
    pub provider_record_id: String,
    pub provenance: Vec<ProviderProvenance>,
    #[serde(default = "default_metadata_score")]
    pub metadata_score: u8,
    #[serde(default)]
    pub completeness: MetadataCompleteness,
    #[serde(default)]
    pub version_type: Option<String>,
    #[serde(default)]
    pub pdf_status: Option<String>,
}

impl NormalizedWork {
    pub fn compute_completeness(&mut self) {
        let has_doi = self
            .canonical_doi
            .as_ref()
            .map_or(false, |d| !d.trim().is_empty());
        let has_abstract = self
            .abstract_text
            .as_ref()
            .map_or(false, |a| !a.trim().is_empty());
        let has_pdf = self
            .pdf_url
            .as_ref()
            .map_or(false, |p| !p.trim().is_empty());
        let has_authors = !self.authors.is_empty();
        let has_venue = self.venue.as_ref().map_or(false, |v| !v.trim().is_empty());
        let has_date = self.publication_date.is_some() || self.publication_year.is_some();

        let mut score: u8 = 0;
        if has_doi {
            score += 25;
        }
        if !self.title.trim().is_empty() {
            score += 20;
        }
        if has_abstract {
            score += 20;
        }
        if has_authors {
            score += 15;
        }
        if has_date {
            score += 10;
        }
        if has_venue {
            score += 5;
        }
        if has_pdf || self.is_open_access {
            score += 5;
        }

        self.metadata_score = score.min(100);
        self.completeness = MetadataCompleteness {
            score: self.metadata_score,
            has_doi,
            has_abstract,
            has_pdf,
            has_authors,
            has_venue,
            has_date,
        };
    }
}

/// Execution plan for an individual provider in an academic search request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderQueryPlan {
    pub provider_id: ProviderId,
    pub native_query: String,
    pub pushes_year_filter: bool,
    pub pushes_oa_filter: bool,
    pub requires_client_filtering: bool,
    pub warnings: Vec<String>,
}

/// Capability-aware query plan across all requested providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicSearchPlan {
    pub raw_query: String,
    pub detected_identifier_type: Option<String>,
    pub cleaned_identifier: Option<String>,
    pub provider_plans: Vec<ProviderQueryPlan>,
    pub global_warnings: Vec<String>,
}

/// Response returned to the frontend by the unified search coordinator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedSearchResponse {
    pub works: Vec<NormalizedWork>,
    pub provider_statuses: Vec<ProviderStatus>,
    pub total_found: usize,
    pub completed_at: String,
    #[serde(default)]
    pub query_plan: Option<AcademicSearchPlan>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

/// Summary returned after importing search results into the SQLite library.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    pub added: usize,
    pub already_present: usize,
    pub updated: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}
