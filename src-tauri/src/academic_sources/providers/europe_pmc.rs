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

pub struct EuropePmcAdapter;

impl Default for EuropePmcAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl EuropePmcAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct EuropePmcAuthor {
    #[serde(rename = "fullName")]
    full_name: Option<String>,
    #[serde(rename = "authorId")]
    author_id: Option<EuropePmcAuthorId>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcAuthorId {
    #[serde(rename = "type")]
    id_type: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcAuthorList {
    author: Option<Vec<EuropePmcAuthor>>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcFullTextUrl {
    #[serde(rename = "documentStyle")]
    document_style: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcFullTextUrlList {
    #[serde(rename = "fullTextUrl")]
    full_text_url: Option<Vec<EuropePmcFullTextUrl>>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcResultItem {
    id: String,
    doi: Option<String>,
    title: Option<String>,
    #[serde(rename = "authorList")]
    author_list: Option<EuropePmcAuthorList>,
    #[serde(rename = "authorString")]
    author_string: Option<String>,
    #[serde(rename = "journalTitle")]
    journal_title: Option<String>,
    #[serde(rename = "pubYear")]
    pub_year: Option<String>,
    #[serde(rename = "isOpenAccess")]
    is_open_access: Option<String>,
    #[serde(rename = "citedByCount")]
    cited_by_count: Option<u32>,
    #[serde(rename = "abstractText")]
    abstract_text: Option<String>,
    #[serde(rename = "fullTextUrlList")]
    full_text_url_list: Option<EuropePmcFullTextUrlList>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcResultList {
    result: Option<Vec<EuropePmcResultItem>>,
}

#[derive(Debug, Deserialize)]
struct EuropePmcResponse {
    #[serde(rename = "hitCount")]
    hit_count: Option<u64>,
    #[serde(rename = "nextCursorMark")]
    next_cursor_mark: Option<String>,
    #[serde(rename = "resultList")]
    result_list: Option<EuropePmcResultList>,
}

#[async_trait]
impl AcademicSourceAdapter for EuropePmcAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::EuropePmc
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            provider_id: ProviderId::EuropePmc,
            display_name: "Europe PMC".to_string(),
            description: "Biomedical and life sciences scholarly literature index aggregating PubMed and PMC open access records".to_string(),
            documentation_url: "https://europepmc.org/RestfulWebService".to_string(),
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
        _api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError> {
        let mut url = Url::parse("https://europepmc.org/RestfulWebService/rest/search")
            .map_err(|e| AcademicError::Network(format!("Invalid Europe PMC URL: {}", e)))?;

        let page_size = query.page_size.unwrap_or(20).clamp(1, 100);

        let mut query_builder = query.query.trim().to_string();

        if let Some(true) = query.open_access_only {
            query_builder.push_str(" (OPEN_ACCESS:y)");
        }

        if let (Some(start), Some(end)) = (query.year_start, query.year_end) {
            query_builder.push_str(&format!(" (PUB_YEAR:[{} TO {}])", start, end));
        } else if let Some(start) = query.year_start {
            query_builder.push_str(&format!(" (PUB_YEAR:[{} TO 2100])", start));
        } else if let Some(end) = query.year_end {
            query_builder.push_str(&format!(" (PUB_YEAR:[1900 TO {}])", end));
        }

        let cursor_mark = query
            .cursor_tokens
            .as_ref()
            .and_then(|c| c.get("europe_pmc").cloned())
            .unwrap_or_else(|| "*".to_string());

        url.query_pairs_mut()
            .append_pair("query", &query_builder)
            .append_pair("format", "json")
            .append_pair("resultType", "core")
            .append_pair("pageSize", &page_size.to_string())
            .append_pair("cursorMark", &cursor_mark);

        debug!(url = %url, "Issuing Europe PMC search request");

        let response = client
            .get(url)
            .header(
                "User-Agent",
                "ResearchPaperScraper/0.1.0 (Desktop Academic Research App; mailto:researcher@local-desktop.app)",
            )
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
                "Europe PMC returned HTTP status {}",
                status
            )));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| AcademicError::Network(e.to_string()))?;

        let parsed: EuropePmcResponse = serde_json::from_str(&body_text).map_err(|e| {
            AcademicError::ParseError(format!("Europe PMC JSON parse error: {}", e))
        })?;

        let total_results = parsed.hit_count;
        let items = parsed
            .result_list
            .and_then(|r| r.result)
            .unwrap_or_default();

        let retrieved_at = chrono::Utc::now().to_rfc3339();
        let mut works = Vec::new();

        for item in items {
            let title = match item.title {
                Some(t) if !t.trim().is_empty() => t.trim().to_string(),
                _ => continue,
            };

            let clean_title_key = compute_clean_title_key(&title);
            let canonical_doi = item.doi.as_deref().and_then(normalize_doi);

            // Authors
            let authors: Vec<NormalizedAuthor> = if let Some(author_list) = item.author_list {
                author_list
                    .author
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|a| {
                        let name = a.full_name?.trim().to_string();
                        if name.is_empty() {
                            return None;
                        }
                        let orcid = a
                            .author_id
                            .filter(|aid| aid.id_type.as_deref() == Some("ORCID"))
                            .and_then(|aid| aid.value);

                        Some(NormalizedAuthor {
                            name,
                            orcid,
                            affiliation: None,
                        })
                    })
                    .collect()
            } else if let Some(author_str) = item.author_string {
                author_str
                    .split(',')
                    .map(|s| NormalizedAuthor {
                        name: s.trim().to_string(),
                        orcid: None,
                        affiliation: None,
                    })
                    .filter(|a| !a.name.is_empty())
                    .collect()
            } else {
                Vec::new()
            };

            let is_oa = item.is_open_access.as_deref() == Some("Y");

            let pdf_url = item
                .full_text_url_list
                .and_then(|f| f.full_text_url)
                .and_then(|urls| {
                    urls.into_iter()
                        .find(|u| u.document_style.as_deref() == Some("pdf"))
                        .and_then(|u| u.url)
                });

            let landing_url = canonical_doi
                .as_ref()
                .map(|d| format!("https://doi.org/{}", d))
                .or_else(|| Some(format!("https://europepmc.org/article/MED/{}", item.id)));

            let publication_year = item.pub_year.and_then(|y| y.parse::<i32>().ok());
            let publication_date = publication_year.map(|y| format!("{:04}-01-01", y));

            let work_id = format!("epmc-{}", item.id);

            works.push(NormalizedWork {
                id: work_id.clone(),
                canonical_doi,
                title,
                clean_title_key,
                abstract_text: item.abstract_text,
                publication_date,
                publication_year,
                venue: item.journal_title,
                venue_type: Some("journal".to_string()),
                authors,
                is_open_access: is_oa,
                landing_url: landing_url.clone(),
                pdf_url,
                citation_count: item.cited_by_count,
                provider_id: ProviderId::EuropePmc,
                provider_record_id: item.id.clone(),
                provenance: vec![ProviderProvenance {
                    provider_id: ProviderId::EuropePmc,
                    record_id: item.id,
                    landing_url,
                    retrieved_at: retrieved_at.clone(),
                }],
            });
        }

        let next_cursor = parsed.next_cursor_mark.filter(|c| c != &cursor_mark);

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
    fn test_europe_pmc_deserialization_from_fixture() {
        let json = r#"{
            "hitCount": 1,
            "nextCursorMark": "cursor123",
            "resultList": {
                "result": [
                    {
                        "id": "31548721",
                        "doi": "10.1038/s41586-019-1587-5",
                        "title": "Search-and-replace genome editing without double-strand breaks or donor DNA",
                        "pubYear": "2019",
                        "journalTitle": "Nature",
                        "isOpenAccess": "Y",
                        "citedByCount": 1850,
                        "abstractText": "Most genetic variants that contribute to human disease...",
                        "authorList": {
                            "author": [
                                { "fullName": "Anzalone AV" },
                                { "fullName": "Randolph PB" }
                            ]
                        },
                        "fullTextUrlList": {
                            "fullTextUrl": [
                                { "documentStyle": "pdf", "url": "https://europepmc.org/articles/PMC6814421?pdf=render" }
                            ]
                        }
                    }
                ]
            }
        }"#;

        let parsed: EuropePmcResponse = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(parsed.hit_count, Some(1));
        assert_eq!(parsed.next_cursor_mark.as_deref(), Some("cursor123"));
        let item = &parsed.result_list.unwrap().result.unwrap()[0];
        assert_eq!(item.id, "31548721");
        assert_eq!(item.doi.as_deref(), Some("10.1038/s41586-019-1587-5"));
        assert_eq!(item.pub_year.as_deref(), Some("2019"));
        assert_eq!(item.is_open_access.as_deref(), Some("Y"));
        assert_eq!(item.cited_by_count, Some(1850));
    }
}
