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

pub struct CrossrefAdapter;

impl Default for CrossrefAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CrossrefAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct CrossrefAuthor {
    given: Option<String>,
    family: Option<String>,
    name: Option<String>,
    #[serde(rename = "ORCID")]
    orcid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CrossrefDateParts {
    #[serde(rename = "date-parts")]
    date_parts: Option<Vec<Vec<i32>>>,
}

#[derive(Debug, Deserialize)]
struct CrossrefWorkItem {
    #[serde(rename = "DOI")]
    doi: String,
    title: Option<Vec<String>>,
    author: Option<Vec<CrossrefAuthor>>,
    #[serde(rename = "container-title")]
    container_title: Option<Vec<String>>,
    #[serde(rename = "published-print")]
    published_print: Option<CrossrefDateParts>,
    #[serde(rename = "published-online")]
    published_online: Option<CrossrefDateParts>,
    issued: Option<CrossrefDateParts>,
    #[serde(rename = "URL")]
    url: Option<String>,
    #[serde(rename = "is-referenced-by-count")]
    citation_count: Option<u32>,
    #[serde(rename = "type")]
    work_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CrossrefMessage {
    #[serde(rename = "total-results")]
    total_results: Option<u64>,
    items: Option<Vec<CrossrefWorkItem>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct CrossrefResponse {
    status: Option<String>,
    message: Option<CrossrefMessage>,
}

fn extract_date_and_year(
    print_date: Option<&CrossrefDateParts>,
    online_date: Option<&CrossrefDateParts>,
    issued_date: Option<&CrossrefDateParts>,
) -> (Option<String>, Option<i32>) {
    let parts_opt = print_date
        .or(online_date)
        .or(issued_date)
        .and_then(|d| d.date_parts.as_ref())
        .and_then(|p| p.first());

    if let Some(parts) = parts_opt {
        if !parts.is_empty() {
            let year = parts[0];
            let date_str = match parts.len() {
                1 => format!("{:04}", year),
                2 => format!("{:04}-{:02}", year, parts[1]),
                _ => format!("{:04}-{:02}-{:02}", year, parts[1], parts[2]),
            };
            return (Some(date_str), Some(year));
        }
    }

    (None, None)
}

#[async_trait]
impl AcademicSourceAdapter for CrossrefAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::Crossref
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            provider_id: ProviderId::Crossref,
            display_name: "Crossref".to_string(),
            description: "Authoritative digital object identifier (DOI) registry and scholarly metadata infrastructure".to_string(),
            documentation_url: "https://api.crossref.org".to_string(),
            supports_year_filter: true,
            supports_open_access_filter: false,
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
        let mut url = Url::parse("https://api.crossref.org/works")
            .map_err(|e| AcademicError::Network(format!("Invalid Crossref URL: {}", e)))?;

        let page = query.page.unwrap_or(1).max(1);
        let rows = query.page_size.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * rows;

        url.query_pairs_mut()
            .append_pair("query.bibliographic", query.query.trim())
            .append_pair("rows", &rows.to_string())
            .append_pair("offset", &offset.to_string())
            .append_pair("mailto", "researcher@local-desktop.app");

        // Year filter
        if let (Some(start), Some(end)) = (query.year_start, query.year_end) {
            url.query_pairs_mut().append_pair(
                "filter",
                &format!(
                    "from-pub-date:{:04}-01-01,until-pub-date:{:04}-12-31",
                    start, end
                ),
            );
        } else if let Some(start) = query.year_start {
            url.query_pairs_mut()
                .append_pair("filter", &format!("from-pub-date:{:04}-01-01", start));
        } else if let Some(end) = query.year_end {
            url.query_pairs_mut()
                .append_pair("filter", &format!("until-pub-date:{:04}-12-31", end));
        }

        debug!(url = %url, "Issuing Crossref search request");

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
                "Crossref returned HTTP status {}",
                status
            )));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| AcademicError::Network(e.to_string()))?;
        let parsed: CrossrefResponse = serde_json::from_str(&body_text)
            .map_err(|e| AcademicError::ParseError(format!("Crossref JSON parse error: {}", e)))?;

        let message = parsed.message.ok_or_else(|| {
            AcademicError::ParseError("Crossref response missing 'message' envelope".to_string())
        })?;

        let total_results = message.total_results;
        let items = message.items.unwrap_or_default();
        let retrieved_at = chrono::Utc::now().to_rfc3339();

        let mut works = Vec::new();
        for item in items {
            let title = match item.title.and_then(|t| t.into_iter().next()) {
                Some(t) if !t.trim().is_empty() => t.trim().to_string(),
                _ => continue,
            };

            let clean_title_key = compute_clean_title_key(&title);
            let canonical_doi = normalize_doi(&item.doi);

            let (publication_date, publication_year) = extract_date_and_year(
                item.published_print.as_ref(),
                item.published_online.as_ref(),
                item.issued.as_ref(),
            );

            // Authors
            let authors: Vec<NormalizedAuthor> = item
                .author
                .unwrap_or_default()
                .into_iter()
                .filter_map(|a| {
                    let full_name = match (a.given, a.family) {
                        (Some(g), Some(f)) => format!("{} {}", g.trim(), f.trim()),
                        _ => a.name?.trim().to_string(),
                    };

                    if full_name.is_empty() {
                        return None;
                    }

                    Some(NormalizedAuthor {
                        name: full_name,
                        orcid: a.orcid,
                        affiliation: None,
                    })
                })
                .collect();

            let venue = item.container_title.and_then(|c| c.into_iter().next());
            let landing_url = item.url.or_else(|| {
                canonical_doi
                    .as_ref()
                    .map(|d| format!("https://doi.org/{}", d))
            });
            let work_id = format!("crossref-{}", item.doi.replace('/', "_"));

            works.push(NormalizedWork {
                id: work_id.clone(),
                canonical_doi,
                title,
                clean_title_key,
                abstract_text: None, // Crossref typically does not distribute abstracts
                publication_date,
                publication_year,
                venue,
                venue_type: item.work_type,
                authors,
                is_open_access: false, // Crossref metadata does not prove direct open access
                landing_url: landing_url.clone(),
                pdf_url: None,
                citation_count: item.citation_count,
                provider_id: ProviderId::Crossref,
                provider_record_id: item.doi.clone(),
                provenance: vec![ProviderProvenance {
                    provider_id: ProviderId::Crossref,
                    record_id: item.doi,
                    landing_url,
                    retrieved_at: retrieved_at.clone(),
                }],
            });
        }

        let next_cursor = if works.len() == rows as usize {
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
    fn test_crossref_date_extraction() {
        let print_date = CrossrefDateParts {
            date_parts: Some(vec![vec![2021, 6, 15]]),
        };
        let (date_str, year) = extract_date_and_year(Some(&print_date), None, None);
        assert_eq!(date_str.as_deref(), Some("2021-06-15"));
        assert_eq!(year, Some(2021));
    }

    #[test]
    fn test_crossref_deserialization_from_fixture() {
        let json = r#"{
            "status": "ok",
            "message": {
                "total-results": 1,
                "items": [
                    {
                        "DOI": "10.1145/3292500.3330962",
                        "title": ["Deep Learning Based Recommender System: A Survey and New Perspectives"],
                        "author": [
                            { "given": "Shuai", "family": "Zhang", "sequence": "first" },
                            { "given": "Lina", "family": "Yao", "sequence": "additional" }
                        ],
                        "container-title": ["ACM Computing Surveys"],
                        "published-print": { "date-parts": [[2019, 2, 28]] },
                        "URL": "http://dx.doi.org/10.1145/3292500.3330962",
                        "is-referenced-by-count": 2150,
                        "type": "journal-article"
                    }
                ]
            }
        }"#;

        let parsed: CrossrefResponse = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(parsed.status.as_deref(), Some("ok"));
        let msg = parsed.message.unwrap();
        assert_eq!(msg.total_results, Some(1));
        let item = &msg.items.unwrap()[0];
        assert_eq!(item.doi, "10.1145/3292500.3330962");
        assert_eq!(
            item.title.as_ref().unwrap()[0],
            "Deep Learning Based Recommender System: A Survey and New Perspectives"
        );
        assert_eq!(item.citation_count, Some(2150));
    }
}
