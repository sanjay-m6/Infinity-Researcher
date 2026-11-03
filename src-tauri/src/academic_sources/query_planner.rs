use crate::academic_sources::registry::ProviderRegistry;
use crate::academic_sources::types::{
    AcademicSearchPlan, AcademicSearchQuery, NormalizedWork, ProviderId, ProviderQueryPlan,
};
use crate::services::metadata_normalizer::MetadataNormalizer;

/// Capability-aware academic query planner and analyzer.
/// Inspects search inputs and reconciles them against provider capabilities,
/// translating filters, flagging unsupported criteria, and driving client-side fallback post-filtering.
pub struct AcademicQueryPlanner;

impl Default for AcademicQueryPlanner {
    fn default() -> Self {
        Self::new()
    }
}

impl AcademicQueryPlanner {
    pub fn new() -> Self {
        Self
    }

    /// Evaluates search query against selected providers to produce an execution plan.
    pub fn plan(
        &self,
        query: &AcademicSearchQuery,
        registry: &ProviderRegistry,
    ) -> AcademicSearchPlan {
        let trimmed_query = query.query.trim();

        // 1. Detect query identifier semantics
        let (detected_identifier_type, cleaned_identifier) =
            if let Some(doi) = MetadataNormalizer::normalize_doi(trimmed_query) {
                (Some("doi".to_string()), Some(doi))
            } else if let Some((arxiv_id, version)) =
                MetadataNormalizer::normalize_arxiv_id(trimmed_query)
            {
                let clean_id = match version {
                    Some(v) => format!("{}{}", arxiv_id, v),
                    None => arxiv_id,
                };
                (Some("arxiv_id".to_string()), Some(clean_id))
            } else {
                (Some("title_keywords".to_string()), None)
            };

        let mut provider_plans = Vec::new();
        let mut global_warnings = Vec::new();

        // 2. Build per-provider query adaptation plans
        for &provider_id in &query.providers {
            let Some(adapter) = registry.get_adapter(provider_id) else {
                continue;
            };

            let caps = adapter.capabilities();
            let mut warnings = Vec::new();
            let mut pushes_year = false;
            let mut pushes_oa = false;
            let mut requires_client_filtering = false;

            // Analyze year filter compatibility
            if query.year_start.is_some() || query.year_end.is_some() {
                if caps.supports_year_filter {
                    pushes_year = true;
                } else {
                    requires_client_filtering = true;
                    warnings.push(format!(
                        "{} does not support server-side publication year filtering; results will be post-filtered locally.",
                        caps.display_name
                    ));
                }
            }

            // Analyze open-access filter compatibility
            if let Some(true) = query.open_access_only {
                if caps.supports_open_access_filter {
                    pushes_oa = true;
                } else if provider_id == ProviderId::Arxiv {
                    // arXiv papers are open-access preprints by default
                    pushes_oa = false;
                } else {
                    requires_client_filtering = true;
                    warnings.push(format!(
                        "{} does not support native open-access filtering; results will be post-filtered locally.",
                        caps.display_name
                    ));
                }
            }

            // Analyze DOI lookup optimization
            if detected_identifier_type.as_deref() == Some("doi") && !caps.supports_doi_lookup {
                warnings.push(format!(
                    "{} does not support direct DOI resolution; query will be executed as bibliographic text.",
                    caps.display_name
                ));
            }

            // Adapt native query string if an identifier was extracted
            let native_query = if let Some(ref clean_id) = cleaned_identifier {
                clean_id.clone()
            } else {
                trimmed_query.to_string()
            };

            provider_plans.push(ProviderQueryPlan {
                provider_id,
                native_query,
                pushes_year_filter: pushes_year,
                pushes_oa_filter: pushes_oa,
                requires_client_filtering,
                warnings,
            });
        }

        // Global warnings
        if query.providers.is_empty() {
            global_warnings.push("No academic sources selected.".to_string());
        }

        AcademicSearchPlan {
            raw_query: trimmed_query.to_string(),
            detected_identifier_type,
            cleaned_identifier,
            provider_plans,
            global_warnings,
        }
    }

    /// Applies client-side fallback post-filtering to guarantee query constraint fidelity
    /// when upstream providers lack server-side filter support.
    pub fn filter_post_search(
        &self,
        works: Vec<NormalizedWork>,
        query: &AcademicSearchQuery,
    ) -> Vec<NormalizedWork> {
        works
            .into_iter()
            .filter(|work| {
                // Year constraint validation
                if let Some(start) = query.year_start {
                    if let Some(year) = work.publication_year {
                        if year < start {
                            return false;
                        }
                    }
                }
                if let Some(end) = query.year_end {
                    if let Some(year) = work.publication_year {
                        if year > end {
                            return false;
                        }
                    }
                }

                // Open-access constraint validation
                if let Some(true) = query.open_access_only {
                    if !work.is_open_access {
                        return false;
                    }
                }

                true
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_plan_doi_detection() {
        let planner = AcademicQueryPlanner::new();
        let registry = ProviderRegistry::new();

        let q = AcademicSearchQuery {
            query: "https://doi.org/10.1038/s41586-020-2649-2".to_string(),
            providers: vec![ProviderId::OpenAlex, ProviderId::Crossref],
            year_start: None,
            year_end: None,
            open_access_only: None,
            page: None,
            page_size: None,
            cursor_tokens: None,
        };

        let plan = planner.plan(&q, &registry);
        assert_eq!(plan.detected_identifier_type.as_deref(), Some("doi"));
        assert_eq!(
            plan.cleaned_identifier.as_deref(),
            Some("10.1038/s41586-020-2649-2")
        );
    }

    #[test]
    fn test_query_plan_arxiv_year_warning() {
        let planner = AcademicQueryPlanner::new();
        let registry = ProviderRegistry::new();

        let q = AcademicSearchQuery {
            query: "attention mechanism".to_string(),
            providers: vec![ProviderId::Arxiv, ProviderId::OpenAlex],
            year_start: Some(2020),
            year_end: Some(2024),
            open_access_only: Some(true),
            page: None,
            page_size: None,
            cursor_tokens: None,
        };

        let plan = planner.plan(&q, &registry);
        let arxiv_plan = plan
            .provider_plans
            .iter()
            .find(|p| p.provider_id == ProviderId::Arxiv)
            .unwrap();

        assert!(!arxiv_plan.pushes_year_filter);
        assert!(arxiv_plan.requires_client_filtering);
        assert!(!arxiv_plan.warnings.is_empty());
    }
}

