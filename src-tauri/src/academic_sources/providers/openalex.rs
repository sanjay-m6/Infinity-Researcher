use async_trait::async_trait;
use serde::Deserialize;
use std::collections::HashMap;
use tracing::debug;
use url::Url;

use crate::academic_sources::adapter::{AcademicSourceAdapter, AdapterSearchResult};
use crate::academic_sources::errors::AcademicError;
use crate::academic_sources::types::{
    AcademicSearchQuery, NormalizedAuthor, NormalizedWork, ProviderCapabilities, ProviderId,
    ProviderProvenance,
};
use crate::domain::paper::{compute_clean_title_key, normalize_doi};

pub struct OpenAlexAdapter;

impl Default for OpenAlexAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenAlexAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct OpenAlexWorkLocationSource {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OpenAlexWorkLocation {
    source: Option<OpenAlexWorkLocationSource>,
    landing_page_url: Option<String>,
    pdf_url: Option<String>,
    is_oa: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexOpenAccess {
    is_oa: Option<bool>,
    oa_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexAuthorInfo {
    display_name: Option<String>,
    orcid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexInstitution {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexAuthorship {
    author: Option<OpenAlexAuthorInfo>,
    institutions: Option<Vec<OpenAlexInstitution>>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexWorkItem {
    id: String,
    doi: Option<String>,
    title: Option<String>,
    display_name: Option<String>,
    publication_year: Option<i32>,
    publication_date: Option<String>,
    primary_location: Option<OpenAlexWorkLocation>,
    open_access: Option<OpenAlexOpenAccess>,
    authorships: Option<Vec<OpenAlexAuthorship>>,
    cited_by_count: Option<u32>,
    abstract_inverted_index: Option<HashMap<String, Vec<usize>>>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexMeta {
    count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexResponse {
    meta: Option<OpenAlexMeta>,
    results: Option<Vec<OpenAlexWorkItem>>,
}

/// Reconstructs a full linear abstract string from OpenAlex's inverted index representation.
pub fn reconstruct_abstract(inverted_index: &HashMap<String, Vec<usize>>) -> Option<String> {
    if inverted_index.is_empty() {
        return None;
    }

    let mut max_pos = 0;
    for positions in inverted_index.values() {
        for &pos in positions {
            if pos > max_pos {
                max_pos = pos;
            }
        }
    }

    if max_pos > 5000 {
        // Guard against pathologically large position numbers
        return None;
    }

    let mut words: Vec<Option<&str>> = vec![None; max_pos + 1];
    for (word, positions) in inverted_index {
        for &pos in positions {
            if pos < words.len() {
                words[pos] = Some(word.as_str());
            }
        }
    }

    let reconstructed = words
        .into_iter()
        .map(|w| w.unwrap_or(""))
        .collect::<Vec<&str>>()
        .join(" ");

    let trimmed = reconstructed.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[async_trait]
impl AcademicSourceAdapter for OpenAlexAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::OpenAlex
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            provider_id: ProviderId::OpenAlex,
            display_name: "OpenAlex".to_string(),
            description:
                "Global open scholarly catalog indexing ~250M works with open-access tracking"
                    .to_string(),
            documentation_url: "https://docs.openalex.org/api-entities/works/search-works"
                .to_string(),
            supports_year_filter: true,
            supports_open_access_filter: true,
            supports_doi_lookup: true,
            supports_pagination: true,
            requires_api_key: false,
            rate_limit_rps: 10.0,
        }
    }

    async fn search(
        &self,
        client: &reqwest::Client,
        query: &AcademicSearchQuery,
        api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError> {
        let mut url = Url::parse("https://api.openalex.org/works")
            .map_err(|e| AcademicError::Network(format!("Invalid base URL: {}", e)))?;

        // Query params
        let page = query.page.unwrap_or(1);
        let per_page = query.page_size.unwrap_or(20).clamp(1, 100);

        url.query_pairs_mut()
            .append_pair("search", query.query.trim())
            .append_pair("page", &page.to_string())
            .append_pair("per-page", &per_page.to_string())
            .append_pair("mailto", "researcher@local-desktop.app");

        // Dynamic filters
        let mut filters = Vec::new();
        if let Some(true) = query.open_access_only {
            filters.push("is_oa:true".to_string());
        }
        if let (Some(start), Some(end)) = (query.year_start, query.year_end) {
            filters.push(format!("publication_year:{}-{}", start, end));
        } else if let Some(start) = query.year_start {
            filters.push(format!("publication_year:>{}-01-01", start - 1));
        } else if let Some(end) = query.year_end {
            filters.push(format!("publication_year:<{}-12-31", end + 1));
        }

        if !filters.is_empty() {
            url.query_pairs_mut()
                .append_pair("filter", &filters.join(","));
        }

        if let Some(key) = api_key {
            if !key.trim().is_empty() {
                url.query_pairs_mut().append_pair("api_key", key.trim());
            }
        }

        debug!(url = %url, "Issuing OpenAlex search request");

        let response = client
            .get(url)
            .header("User-Agent", "ResearchPaperScraper/0.1.0 (Academic Desktop; mailto:researcher@local-desktop.app)")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    AcademicError::Timeout
                } else {
                    AcademicError::Network(e.to_string())
                }
            })?;

        let status = response.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(AcademicError::RateLimited {
                retry_after_secs: Some(5),
            });
        }
        if !status.is_success() {
            return Err(AcademicError::Unavailable(format!(
                "OpenAlex returned HTTP status {}",
                status
            )));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| AcademicError::Network(e.to_string()))?;
        let parsed: OpenAlexResponse = serde_json::from_str(&body_text).map_err(|e| {
            AcademicError::ParseError(format!("OpenAlex JSON deserialize failed: {}", e))
        })?;

        let total_results = parsed.meta.as_ref().and_then(|m| m.count);
        let items = parsed.results.unwrap_or_default();
        let retrieved_at = chrono::Utc::now().to_rfc3339();

        let mut works = Vec::new();
        for item in items {
            let title = match item.title.or(item.display_name) {
                Some(t) if !t.trim().is_empty() => t.trim().to_string(),
                _ => continue, // Discard records without a usable title
            };

            let clean_title_key = compute_clean_title_key(&title);
            let canonical_doi = item.doi.as_deref().and_then(normalize_doi);

            // Reconstruct abstract
            let abstract_text = item
                .abstract_inverted_index
                .as_ref()
                .and_then(reconstruct_abstract);

            // Extract Authors
            let authors: Vec<NormalizedAuthor> = item
                .authorships
                .unwrap_or_default()
                .into_iter()
                .filter_map(|a| {
                    let info = a.author?;
                    let name = info.display_name?.trim().to_string();
                    if name.is_empty() {
                        return None;
                    }
                    let affiliation = a
                        .institutions
                        .and_then(|insts| insts.into_iter().next())
                        .and_then(|inst| inst.display_name);

                    Some(NormalizedAuthor {
                        name,
                        orcid: info.orcid,
                        affiliation,
                    })
                })
                .collect();

            // Extract Venue
            let venue = item
                .primary_location
                .as_ref()
                .and_then(|loc| loc.source.as_ref())
                .and_then(|src| src.display_name.clone());

            // Extract OA and Landing URLs
            let is_open_access = item
                .open_access
                .as_ref()
                .and_then(|oa| oa.is_oa)
                .unwrap_or(false);

            let pdf_url = if is_open_access {
                item.open_access
                    .as_ref()
                    .and_then(|oa| oa.oa_url.clone())
                    .or_else(|| {
                        item.primary_location
                            .as_ref()
                            .and_then(|loc| loc.pdf_url.clone())
                    })
            } else {
                None
            };

            let landing_url = item
                .primary_location
                .as_ref()
                .and_then(|loc| loc.landing_page_url.clone())
                .or_else(|| {
                    canonical_doi
                        .as_ref()
                        .map(|d| format!("https://doi.org/{}", d))
                })
                .or_else(|| Some(item.id.clone()));

            let work_id = format!(
                "openalex-{}",
                item.id
                    .strip_prefix("https://openalex.org/")
                    .unwrap_or(&item.id)
            );

            works.push(NormalizedWork {
                id: work_id.clone(),
                canonical_doi,
                title,
                clean_title_key,
                abstract_text,
                publication_date: item.publication_date,
                publication_year: item.publication_year,
                venue,
                venue_type: Some("journal".to_string()),
                authors,
                is_open_access,
                landing_url: landing_url.clone(),
                pdf_url,
                citation_count: item.cited_by_count,
                provider_id: ProviderId::OpenAlex,
                provider_record_id: item.id.clone(),
                provenance: vec![ProviderProvenance {
                    provider_id: ProviderId::OpenAlex,
                    record_id: item.id,
                    landing_url,
                    retrieved_at: retrieved_at.clone(),
                }],
            });
        }

        let next_cursor = if works.len() == per_page as usize {
            Some((page + 1).to_string())
        } else {
            None
        };

        Ok(AdapterSearchResult {
            works,
            next_cursor,
            total_results,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconstruct_abstract_from_inverted_index() {
        let mut map = HashMap::new();
        map.insert("Attention".to_string(), vec![0]);
        map.insert("is".to_string(), vec![1]);
        map.insert("all".to_string(), vec![2]);
        map.insert("you".to_string(), vec![3]);
        map.insert("need.".to_string(), vec![4]);

        let result = reconstruct_abstract(&map);
        assert_eq!(result.as_deref(), Some("Attention is all you need."));
    }

    #[test]
    fn test_openalex_deserialization_from_fixture() {
        let json = r#"{
            "meta": { "count": 1 },
            "results": [
                {
                    "id": "https://openalex.org/W2741809807",
                    "doi": "https://doi.org/10.48550/arxiv.1706.03762",
                    "title": "Attention Is All You Need",
                    "publication_year": 2017,
                    "publication_date": "2017-06-12",
                    "primary_location": {
                        "source": { "display_name": "arXiv" },
                        "landing_page_url": "https://arxiv.org/abs/1706.03762",
                        "pdf_url": "https://arxiv.org/pdf/1706.03762.pdf",
                        "is_oa": true
                    },
                    "open_access": {
                        "is_oa": true,
                        "oa_url": "https://arxiv.org/pdf/1706.03762.pdf"
                    },
                    "authorships": [
                        {
                            "author": { "display_name": "Ashish Vaswani", "orcid": "https://orcid.org/0000-0001-2345-6789" },
                            "institutions": [{ "display_name": "Google Brain" }]
                        }
                    ],
                    "cited_by_count": 98500,
                    "abstract_inverted_index": {
                        "Transformers": [0],
                        "are": [1],
                        "great.": [2]
                    }
                }
            ]
        }"#;

        let parsed: OpenAlexResponse = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(parsed.meta.unwrap().count, Some(1));
        let results = parsed.results.unwrap();
        assert_eq!(results.len(), 1);
        let work = &results[0];
        assert_eq!(work.title.as_deref(), Some("Attention Is All You Need"));
        assert_eq!(work.publication_year, Some(2017));
        assert_eq!(work.cited_by_count, Some(98500));

        let abstract_text = reconstruct_abstract(work.abstract_inverted_index.as_ref().unwrap());
        assert_eq!(abstract_text.as_deref(), Some("Transformers are great."));
    }
}
