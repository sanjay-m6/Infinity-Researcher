use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::info;

use crate::scrapers::adapters::SourceAdapter;
use crate::scrapers::engine::CrawlEngine;
use crate::scrapers::extractor::HtmlExtractor;
use crate::scrapers::types::{
    DiscoveredSearchResult, PaginationStrategy, SearchPlan, SourceCapabilities, WebsiteSearchQuery,
    WebsiteSourceDescriptor,
};
use crate::scrapers::url_guard::UrlGuard;

pub struct PlosAdapter;

impl Default for PlosAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl PlosAdapter {
    pub fn new() -> Self {
        Self
    }

    fn strip_html_tags(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        let mut in_tag = false;
        for c in s.chars() {
            if c == '<' {
                in_tag = true;
            } else if c == '>' {
                in_tag = false;
            } else if !in_tag {
                out.push(c);
            }
        }
        out.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .trim()
            .to_string()
    }

    pub fn parse_plos_json(json_str: &str) -> Result<Vec<DiscoveredSearchResult>, String> {
        let val: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse PLOS search response: {e}"))?;

        let empty_vec = Vec::new();
        let docs = val["response"]["docs"].as_array().unwrap_or(&empty_vec);

        let mut results = Vec::new();
        for doc in docs {
            let doi = doc["id"].as_str().unwrap_or("").trim().to_string();
            if doi.is_empty() {
                continue;
            }

            let raw_title = doc["title"].as_str().unwrap_or("").trim();
            let title = Self::strip_html_tags(raw_title)
                .trim_end_matches('.')
                .trim()
                .to_string();
            if title.is_empty() {
                continue;
            }

            let authors: Vec<String> = if let Some(arr) = doc["author_display"].as_array() {
                arr.iter()
                    .filter_map(|a| a.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.is_empty())
                    .collect()
            } else {
                vec!["PLOS Author".to_string()]
            };

            let journal = doc["journal"]
                .as_str()
                .unwrap_or("PLOS ONE")
                .trim()
                .to_string();

            let pub_date = doc["publication_date"]
                .as_str()
                .map(|d| d.trim().to_string());
            let pub_year = pub_date.as_ref().and_then(|d| {
                if d.len() >= 4 {
                    d[0..4].parse::<i32>().ok()
                } else {
                    None
                }
            });

            let abstract_text = if let Some(arr) = doc["abstract"].as_array() {
                arr.iter()
                    .filter_map(|a| a.as_str().map(Self::strip_html_tags))
                    .find(|s| !s.is_empty())
            } else {
                doc["abstract"].as_str().map(Self::strip_html_tags)
            };

            let landing_url = format!("https://doi.org/{doi}");
            let pdf_url =
                format!("https://journals.plos.org/plosone/article/file?id={doi}&type=printable");
            let id = format!("plos_{}", doi.replace('/', "_"));

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue: Some(journal),
                canonical_doi: Some(doi),
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url: Some(pdf_url),
                source_id: "plos".to_string(),
                source_name: "PLOS Open Access Journals".to_string(),
                content_type: "journal_article".to_string(),
                is_open_access: true,
                license_name: Some("Creative Commons Attribution (CC-BY)".to_string()),
                peer_reviewed: Some(true),
                subject_tags: vec!["Open Access".to_string(), "Life Sciences".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(1.0),
            });
        }

        Ok(results)
    }
}

#[async_trait]
impl SourceAdapter for PlosAdapter {
    fn source_id(&self) -> &'static str {
        "plos"
    }

    fn display_name(&self) -> &'static str {
        "PLOS Open Access Journals"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "plos".to_string(),
            name: "PLOS Open Access Journals".to_string(),
            domain: "journals.plos.org".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://journals.plos.org/plosone/s/content-license".to_string(),
            policy_notes:
                "100% CC-BY open access scientific literature with visible public journal search."
                    .to_string(),
            supports_native_years: false,
            request_delay_ms: 1500,
            content_types: vec!["journal_article".to_string()],
        }
    }

    fn capabilities(&self) -> SourceCapabilities {
        SourceCapabilities {
            supports_query: true,
            supports_years: true,
            supports_authors: true,
            supports_open_access_filter: true,
            provides_direct_pdf: true,
            provides_doi: true,
            rate_limit_ms: 1500,
            search_support: "supported".to_string(),
            requires_browser_rendering: false,
            max_pages_per_job: 20,
        }
    }

    fn build_search_plan(&self, query: &WebsiteSearchQuery) -> Result<SearchPlan, String> {
        let encoded_q: String = query
            .query
            .chars()
            .map(|c| match c {
                ' ' => '+',
                c if c.is_alphanumeric() || c == '-' || c == '_' => c,
                _ => '+',
            })
            .collect();

        Ok(SearchPlan {
            source_id: "plos".to_string(),
            start_url: format!("https://journals.plos.org/plosone/search?q={}", encoded_q),
            query: query.query.clone(),
            allowed_domain: "journals.plos.org".to_string(),
            max_pages: query.limit_per_source.unwrap_or(50).clamp(1, 100),
            max_depth: 1,
            delay_ms: 1500,
            pagination_strategy: PaginationStrategy::PageParam {
                param_name: "page".to_string(),
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let preview = HtmlExtractor::extract(html, page_url, None);
        if let Some(title) = preview.title {
            if !title.is_empty() {
                let id = format!("plos_{}", uuid::Uuid::new_v4().simple());
                return vec![DiscoveredSearchResult {
                    id,
                    title,
                    authors: preview.authors,
                    publication_date: preview.publication_date,
                    publication_year: None,
                    venue: preview.venue.or(Some("PLOS ONE".to_string())),
                    canonical_doi: preview.canonical_doi,
                    abstract_text: preview.abstract_text,
                    landing_url: page_url.to_string(),
                    pdf_url: preview.pdf_url,
                    source_id: "plos".to_string(),
                    source_name: "PLOS Open Access Journals".to_string(),
                    content_type: "journal_article".to_string(),
                    is_open_access: true,
                    license_name: Some("Creative Commons Attribution (CC-BY)".to_string()),
                    peer_reviewed: Some(true),
                    subject_tags: vec!["Open Access".to_string()],
                    language: Some("en".to_string()),
                    relevance_score: 1.0,
                    provenance_urls: vec![page_url.to_string()],
                    metadata_confidence: Some(1.0),
                }];
            }
        }
        Vec::new()
    }

    async fn search(
        &self,
        client: &reqwest::Client,
        query: &WebsiteSearchQuery,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String> {
        if cancel.load(Ordering::Relaxed) {
            return Err("Search cancelled".to_string());
        }

        let limit = query.limit_per_source.unwrap_or(50);
        let encoded_q: String = query
            .query
            .chars()
            .map(|c| match c {
                ' ' => '+',
                c if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' => c,
                _ => '+',
            })
            .collect();

        // 1. Try public PLOS search API
        let plos_url = format!(
            "https://api.plos.org/search?q={}&fl=id,title,author_display,abstract,publication_date,journal&wt=json&rows={}",
            encoded_q, limit
        );

        if let Ok(validated_url) = UrlGuard::validate_url(&plos_url) {
            info!(url = %validated_url, "Querying public PLOS search API");
            let resp = client
                .get(validated_url.as_str())
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                )
                .header("Accept", "application/json")
                .send()
                .await;

            if let Ok(response) = resp {
                if response.status().is_success() {
                    if let Ok(body) = CrawlEngine::read_response_body_bounded(response).await {
                        if let Ok(results) = Self::parse_plos_json(&body) {
                            if !results.is_empty() {
                                return Ok(results);
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback to Europe PMC for PLOS open-access articles
        let epmc_query = format!(r#"JOURNAL:"PLoS*" AND ({})"#, query.query.trim());
        let epmc_encoded: String = epmc_query
            .chars()
            .map(|c| match c {
                ' ' => '+',
                c if c.is_alphanumeric()
                    || c == '-'
                    || c == '_'
                    || c == '.'
                    || c == ':'
                    || c == '"'
                    || c == '('
                    || c == ')' =>
                {
                    c
                }
                _ => '+',
            })
            .collect();

        let epmc_url = format!(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={}&resultType=core&format=json&pageSize={}",
            epmc_encoded, limit
        );

        let validated_epmc = UrlGuard::validate_url(&epmc_url)
            .map_err(|e| format!("Anti-SSRF blocked Europe PMC fallback: {e}"))?;

        let resp = client
            .get(validated_epmc.as_str())
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            )
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Failed to reach Europe PMC fallback for PLOS: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!(
                "PLOS fallback returned HTTP status: {}",
                resp.status()
            ));
        }

        let body = CrawlEngine::read_response_body_bounded(resp)
            .await
            .map_err(|e| format!("Failed reading response body: {e}"))?;

        let val: serde_json::Value = serde_json::from_str(&body)
            .map_err(|e| format!("Failed parsing Europe PMC JSON response: {e}"))?;

        let empty_vec = Vec::new();
        let items = val["resultList"]["result"].as_array().unwrap_or(&empty_vec);

        let mut results = Vec::new();
        for item in items {
            let raw_title = item["title"].as_str().unwrap_or("").trim();
            let title = Self::strip_html_tags(raw_title)
                .trim_end_matches('.')
                .trim()
                .to_string();
            if title.is_empty() {
                continue;
            }

            let authors: Vec<String> =
                if let Some(author_list) = item["authorList"]["author"].as_array() {
                    author_list
                        .iter()
                        .filter_map(|a| a["fullName"].as_str().map(|s| s.trim().to_string()))
                        .filter(|s| !s.is_empty())
                        .collect()
                } else {
                    vec!["PLOS Author".to_string()]
                };

            let pub_year = item["pubYear"].as_str().and_then(|y| y.parse::<i32>().ok());
            let pub_date = pub_year.map(|y| format!("{y}-01-01"));
            let doi = item["doi"].as_str().map(|d| d.trim().to_string());

            let abstract_text = item["abstractText"]
                .as_str()
                .map(Self::strip_html_tags)
                .filter(|a| !a.is_empty());

            let landing_url = if let Some(ref d) = doi {
                format!("https://doi.org/{d}")
            } else {
                "https://journals.plos.org".to_string()
            };

            let pdf_url = doi.as_ref().map(|d| {
                format!("https://journals.plos.org/plosone/article/file?id={d}&type=printable")
            });

            let id = format!("plos_{}", doi.as_deref().unwrap_or("doc").replace('/', "_"));

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue: Some("PLOS ONE".to_string()),
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "plos".to_string(),
                source_name: "PLOS Open Access Journals".to_string(),
                content_type: "journal_article".to_string(),
                is_open_access: true,
                license_name: Some("CC-BY".to_string()),
                peer_reviewed: Some(true),
                subject_tags: vec!["Open Access".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.95),
            });
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PLOS_SAMPLE_JSON: &str = r#"{
      "response": {
        "numFound": 1,
        "start": 0,
        "docs": [
          {
            "id": "10.1371/journal.pone.0298123",
            "journal": "PLoS ONE",
            "publication_date": "2024-02-14T00:00:00Z",
            "author_display": ["Jane Doe", "John Q. Public"],
            "title": "Machine Learning Approaches for Environmental Sensing",
            "abstract": ["We demonstrate novel algorithmic frameworks for remote environmental monitoring..."]
          }
        ]
      }
    }"#;

    #[test]
    fn test_parse_plos_json_fixture() {
        let results = PlosAdapter::parse_plos_json(PLOS_SAMPLE_JSON).unwrap();
        assert_eq!(results.len(), 1);
        let p = &results[0];
        assert_eq!(
            p.title,
            "Machine Learning Approaches for Environmental Sensing"
        );
        assert_eq!(
            p.canonical_doi,
            Some("10.1371/journal.pone.0298123".to_string())
        );
        assert_eq!(p.authors, vec!["Jane Doe", "John Q. Public"]);
        assert_eq!(p.publication_year, Some(2024));
        assert!(p.pdf_url.as_ref().unwrap().contains("type=printable"));
        assert!(p.is_open_access);
    }
}
