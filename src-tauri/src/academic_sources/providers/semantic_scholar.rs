use async_trait::async_trait;
use serde::Deserialize;
use tracing::debug;
use url::Url;

use crate::academic_sources::adapter::{AcademicSourceAdapter, AdapterSearchResult};
use crate::academic_sources::errors::AcademicError;
use crate::academic_sources::types::{
    AcademicSearchQuery, NormalizedAuthor, NormalizedWork, ProviderCapabilities, ProviderId,
    ProviderProvenance,
};
use crate::domain::paper::{compute_clean_title_key, normalize_doi};

pub struct SemanticScholarAdapter;

impl Default for SemanticScholarAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SemanticScholarAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct S2Author {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct S2OpenAccessPdf {
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct S2ExternalIds {
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(rename = "ArXiv")]
    arxiv: Option<String>,
}

#[derive(Debug, Deserialize)]
struct S2PaperItem {
    #[serde(rename = "paperId")]
    paper_id: String,
    title: Option<String>,
    #[serde(rename = "abstract")]
    abstract_text: Option<String>,
    year: Option<i32>,
    #[serde(rename = "publicationDate")]
    publication_date: Option<String>,
    venue: Option<String>,
    url: Option<String>,
    #[serde(rename = "isOpenAccess")]
    is_open_access: Option<bool>,
    #[serde(rename = "openAccessPdf")]
    open_access_pdf: Option<S2OpenAccessPdf>,
    authors: Option<Vec<S2Author>>,
    #[serde(rename = "externalIds")]
    external_ids: Option<S2ExternalIds>,
    #[serde(rename = "citationCount")]
    citation_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct S2SearchResponse {
    total: Option<u64>,
    offset: Option<u64>,
    data: Option<Vec<S2PaperItem>>,
}

#[async_trait]
impl AcademicSourceAdapter for SemanticScholarAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::SemanticScholar
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            provider_id: ProviderId::SemanticScholar,
            display_name: "Semantic Scholar".to_string(),
            description: "Allen Institute for AI academic graph with citation intelligence and open access PDF detection".to_string(),
            documentation_url: "https://api.semanticscholar.org/api-docs/graph".to_string(),
            supports_year_filter: true,
            supports_open_access_filter: true,
            supports_doi_lookup: true,
            supports_pagination: true,
            requires_api_key: false,
            rate_limit_rps: 1.0,
        }
    }

    async fn search(
        &self,
        client: &reqwest::Client,
        query: &AcademicSearchQuery,
        api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError> {
        let mut url = Url::parse("https://api.semanticscholar.org/graph/v1/paper/search")
            .map_err(|e| AcademicError::Network(format!("Invalid Semantic Scholar URL: {}", e)))?;

        let page = query.page.unwrap_or(1).max(1);
        let limit = query.page_size.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * limit;

        url.query_pairs_mut()
            .append_pair("query", query.query.trim())
            .append_pair("offset", &offset.to_string())
            .append_pair("limit", &limit.to_string())
            .append_pair(
                "fields",
                "paperId,title,abstract,authors,year,publicationDate,venue,externalIds,url,isOpenAccess,openAccessPdf,citationCount",
            );

        if let (Some(start), Some(end)) = (query.year_start, query.year_end) {
            url.query_pairs_mut()
                .append_pair("year", &format!("{}-{}", start, end));
        } else if let Some(start) = query.year_start {
            url.query_pairs_mut()
                .append_pair("year", &format!("{}-", start));
        } else if let Some(end) = query.year_end {
            url.query_pairs_mut()
                .append_pair("year", &format!("-{}", end));
        }

        if let Some(true) = query.open_access_only {
            url.query_pairs_mut().append_pair("openAccessPdf", "");
        }

        debug!(url = %url, "Issuing Semantic Scholar search request");

        let mut req = client.get(url).header(
            "User-Agent",
            "ResearchPaperScraper/0.1.0 (Desktop Academic Research App; mailto:researcher@local-desktop.app)",
        );

        if let Some(key) = api_key {
            if !key.trim().is_empty() {
                req = req.header("x-api-key", key.trim());
            }
        }

        let response = req.send().await.map_err(|e| {
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
        if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AcademicError::AuthRequired(
                "Semantic Scholar API key required or invalid quota".to_string(),
            ));
        }
        if !status.is_success() {
            return Err(AcademicError::Unavailable(format!(
                "Semantic Scholar returned HTTP status {}",
                status
            )));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| AcademicError::Network(e.to_string()))?;

        let parsed: S2SearchResponse = serde_json::from_str(&body_text).map_err(|e| {
            AcademicError::ParseError(format!("Semantic Scholar JSON parse error: {}", e))
        })?;

        let total_results = parsed.total;
        let items = parsed.data.unwrap_or_default();
        let retrieved_at = chrono::Utc::now().to_rfc3339();

        let mut works = Vec::new();
        for item in items {
            let title = match item.title {
                Some(t) if !t.trim().is_empty() => t.trim().to_string(),
                _ => continue,
            };

            let clean_title_key = compute_clean_title_key(&title);
            let canonical_doi = item
                .external_ids
                .as_ref()
                .and_then(|ids| ids.doi.as_deref())
                .and_then(normalize_doi);

            let authors: Vec<NormalizedAuthor> = item
                .authors
                .unwrap_or_default()
                .into_iter()
                .filter_map(|a| {
                    let name = a.name?.trim().to_string();
                    if name.is_empty() {
                        return None;
                    }
                    Some(NormalizedAuthor {
                        name,
                        orcid: None,
                        affiliation: None,
                    })
                })
                .collect();

            let is_open_access =
                item.is_open_access.unwrap_or(false) || item.open_access_pdf.is_some();

            let pdf_url = item.open_access_pdf.as_ref().and_then(|oa| oa.url.clone());

            let landing_url = item.url.or_else(|| {
                canonical_doi
                    .as_ref()
                    .map(|d| format!("https://doi.org/{}", d))
            });

            let work_id = format!("s2-{}", item.paper_id);

            works.push(NormalizedWork {
                id: work_id.clone(),
                canonical_doi,
                title,
                clean_title_key,
                abstract_text: item.abstract_text,
                publication_date: item.publication_date,
                publication_year: item.year,
                venue: item.venue,
                venue_type: Some("conference".to_string()),
                authors,
                is_open_access,
                landing_url: landing_url.clone(),
                pdf_url,
                citation_count: item.citation_count,
                provider_id: ProviderId::SemanticScholar,
                provider_record_id: item.paper_id.clone(),
                provenance: vec![ProviderProvenance {
                    provider_id: ProviderId::SemanticScholar,
                    record_id: item.paper_id,
                    landing_url,
                    retrieved_at: retrieved_at.clone(),
                }],
            });
        }

        let next_cursor = if works.len() == limit as usize {
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
    fn test_semanticscholar_deserialization_from_fixture() {
        let json = r#"{
            "total": 1,
            "offset": 0,
            "data": [
                {
                    "paperId": "649def34f8be52c8b66281af98ae884c09aef38b",
                    "title": "Attention Is All You Need",
                    "abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
                    "year": 2017,
                    "publicationDate": "2017-06-12",
                    "venue": "NeurIPS",
                    "url": "https://www.semanticscholar.org/paper/649def34f8be52c8b66281af98ae884c09aef38b",
                    "isOpenAccess": true,
                    "openAccessPdf": {
                        "url": "https://arxiv.org/pdf/1706.03762.pdf",
                        "status": "GREEN"
                    },
                    "authors": [
                        { "authorId": "1741101", "name": "Ashish Vaswani" },
                        { "authorId": "1741102", "name": "Noam Shazeer" }
                    ],
                    "externalIds": {
                        "DOI": "10.48550/arXiv.1706.03762",
                        "ArXiv": "1706.03762"
                    },
                    "citationCount": 98500
                }
            ]
        }"#;

        let parsed: S2SearchResponse = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(parsed.total, Some(1));
        let item = &parsed.data.unwrap()[0];
        assert_eq!(item.paper_id, "649def34f8be52c8b66281af98ae884c09aef38b");
        assert_eq!(item.title.as_deref(), Some("Attention Is All You Need"));
        assert_eq!(item.year, Some(2017));
        assert!(item.is_open_access.unwrap());
        assert_eq!(
            item.open_access_pdf.as_ref().unwrap().url.as_deref(),
            Some("https://arxiv.org/pdf/1706.03762.pdf")
        );
        assert_eq!(
            item.external_ids.as_ref().unwrap().doi.as_deref(),
            Some("10.48550/arXiv.1706.03762")
        );
    }
}
