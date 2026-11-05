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

pub struct NatureAdapter;

impl Default for NatureAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl NatureAdapter {
    pub fn new() -> Self {
        Self
    }

    pub fn url_encode(input: &str) -> String {
        let mut encoded = String::with_capacity(input.len() * 2);
        for byte in input.bytes() {
            match byte {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                b' ' => encoded.push('+'),
                _ => {
                    use std::fmt::Write;
                    let _ = write!(encoded, "%{:02X}", byte);
                }
            }
        }
        encoded
    }

    pub fn strip_html_tags(s: &str) -> String {
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

    pub fn parse_epmc_json(body: &str) -> Result<Vec<DiscoveredSearchResult>, String> {
        let val: serde_json::Value = serde_json::from_str(body)
            .map_err(|e| format!("Failed parsing Nature JSON response: {e}"))?;

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
                } else if let Some(author_str) = item["authorString"].as_str() {
                    author_str
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                } else {
                    vec!["Nature Portfolio Author".to_string()]
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
                "https://www.nature.com/srep".to_string()
            };

            let pdf_url = doi.as_ref().and_then(|d| {
                d.split('/')
                    .nth(1)
                    .map(|article_id| format!("https://www.nature.com/articles/{article_id}.pdf"))
            });

            let id = format!(
                "nature_{}",
                doi.as_deref().unwrap_or("art").replace('/', "_")
            );

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue: Some("Nature Scientific Reports".to_string()),
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "nature_srep".to_string(),
                source_name: "Nature Scientific Reports".to_string(),
                content_type: "journal_article".to_string(),
                is_open_access: true,
                license_name: Some("Creative Commons Attribution (CC-BY)".to_string()),
                peer_reviewed: Some(true),
                subject_tags: vec!["Multidisciplinary".to_string(), "Open Access".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(1.0),
            });
        }

        Ok(results)
    }

    pub fn parse_crossref_nature_json(
        json_str: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String> {
        let cr_val: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse Crossref Nature response: {e}"))?;

        let empty_vec = Vec::new();
        let items = cr_val["message"]["items"].as_array().unwrap_or(&empty_vec);

        let mut results = Vec::new();
        for item in items {
            if cancel.load(Ordering::Relaxed) {
                return Err("Search was cancelled by user.".to_string());
            }

            let raw_title = item["title"]
                .as_array()
                .and_then(|t| t.first())
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .trim();

            let title = Self::strip_html_tags(raw_title);
            if title.is_empty() {
                continue;
            }

            let mut authors = Vec::new();
            if let Some(author_list) = item["author"].as_array() {
                for a in author_list {
                    let full_name = match (a["given"].as_str(), a["family"].as_str()) {
                        (Some(g), Some(f)) => format!("{} {}", g.trim(), f.trim()),
                        (None, Some(f)) => f.trim().to_string(),
                        (Some(g), None) => g.trim().to_string(),
                        _ => a["name"].as_str().unwrap_or("").trim().to_string(),
                    };
                    if !full_name.is_empty() {
                        authors.push(full_name);
                    }
                }
            }
            if authors.is_empty() {
                authors.push("Nature Portfolio Author".to_string());
            }

            let pub_year = item["published-print"]["date-parts"][0][0]
                .as_i64()
                .or_else(|| item["published-online"]["date-parts"][0][0].as_i64())
                .or_else(|| item["created"]["date-parts"][0][0].as_i64())
                .map(|y| y as i32);

            let pub_date = pub_year.map(|y| format!("{}-01-01", y));

            let venue = item["container-title"]
                .as_array()
                .and_then(|c| c.first())
                .and_then(|c| c.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .or(Some("Nature Scientific Reports".to_string()));

            let doi = item["DOI"]
                .as_str()
                .map(|d| d.trim().to_string())
                .filter(|d| !d.is_empty());

            let landing_url = doi
                .as_ref()
                .map(|d| format!("https://doi.org/{d}"))
                .or_else(|| item["URL"].as_str().map(|u| u.to_string()))
                .unwrap_or_else(|| "https://www.nature.com".to_string());

            let pdf_url = doi.as_ref().and_then(|d| {
                d.split('/')
                    .nth(1)
                    .map(|article_id| format!("https://www.nature.com/articles/{article_id}.pdf"))
            });

            let abstract_text = item["abstract"]
                .as_str()
                .map(|a| Self::strip_html_tags(a))
                .filter(|a| !a.is_empty());

            let item_id = doi.as_deref().unwrap_or(&landing_url);
            let id_slug: String = item_id
                .chars()
                .filter(|c| c.is_alphanumeric())
                .take(12)
                .collect();
            let unique_part = uuid::Uuid::new_v4().to_string();

            results.push(DiscoveredSearchResult {
                id: format!(
                    "nature_{}_{}",
                    if id_slug.is_empty() { "work" } else { &id_slug },
                    &unique_part[..8]
                ),
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue,
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "nature_srep".to_string(),
                source_name: "Nature Scientific Reports".to_string(),
                content_type: "journal_article".to_string(),
                is_open_access: true,
                license_name: Some("Creative Commons Attribution (CC-BY)".to_string()),
                peer_reviewed: Some(true),
                subject_tags: vec!["Nature".to_string(), "Multidisciplinary".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.95),
            });
        }

        Ok(results)
    }

    pub async fn search_crossref_fallback(
        client: &reqwest::Client,
        query: &WebsiteSearchQuery,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String> {
        let limit = query.limit_per_source.unwrap_or(50).clamp(1, 100);
        let encoded_q = Self::url_encode(&query.query);
        let crossref_url = format!(
            "https://api.crossref.org/works?query={}&filter=prefix:10.1038&rows={}",
            encoded_q, limit
        );

        let validated_crossref = UrlGuard::validate_url(&crossref_url)
            .map_err(|e| format!("Anti-SSRF blocked Crossref Nature URL: {e}"))?;

        info!(query = %query.query, "Querying Crossref index fallback for Nature (prefix 10.1038)");

        let cr_resp = client
            .get(validated_crossref.as_str())
            .header(
                "User-Agent",
                "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            )
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Failed reaching Crossref for Nature fallback: {e}"))?;

        if !cr_resp.status().is_success() {
            return Err(format!("Crossref Nature returned HTTP status: {}", cr_resp.status()));
        }

        let body = CrawlEngine::read_response_body_bounded(cr_resp)
            .await
            .map_err(|e| format!("Failed reading Crossref Nature response body: {e}"))?;

        Self::parse_crossref_nature_json(&body, cancel)
    }
}

#[async_trait]
impl SourceAdapter for NatureAdapter {
    fn source_id(&self) -> &'static str {
        "nature"
    }

    fn display_name(&self) -> &'static str {
        "Nature Scientific Reports"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "nature_srep".to_string(),
            name: "Nature Scientific Reports".to_string(),
            domain: "nature.com".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://www.nature.com/nature-research/terms-and-conditions".to_string(),
            policy_notes: "Open access scientific reports journal with public article search pages; rate-limited requests.".to_string(),
            supports_native_years: false,
            request_delay_ms: 2500,
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
            rate_limit_ms: 2500,
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
            source_id: "nature".to_string(),
            start_url: format!("https://www.nature.com/search?q={}&journal=srep", encoded_q),
            query: query.query.clone(),
            allowed_domain: "nature.com".to_string(),
            max_pages: query.limit_per_source.unwrap_or(50).clamp(1, 100),
            max_depth: 1,
            delay_ms: 2500,
            pagination_strategy: PaginationStrategy::PageParam {
                param_name: "page".to_string(),
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let preview = HtmlExtractor::extract(html, page_url, None);
        if let Some(title) = preview.title {
            if !title.is_empty() {
                let id = format!("nature_{}", uuid::Uuid::new_v4().simple());
                return vec![DiscoveredSearchResult {
                    id,
                    title,
                    authors: preview.authors,
                    publication_date: preview.publication_date,
                    publication_year: None,
                    venue: preview
                        .venue
                        .or(Some("Nature Scientific Reports".to_string())),
                    canonical_doi: preview.canonical_doi,
                    abstract_text: preview.abstract_text,
                    landing_url: page_url.to_string(),
                    pdf_url: preview.pdf_url,
                    source_id: "nature".to_string(),
                    source_name: "Nature Scientific Reports".to_string(),
                    content_type: "journal_article".to_string(),
                    is_open_access: true,
                    license_name: Some("Creative Commons Attribution 4.0".to_string()),
                    peer_reviewed: Some(true),
                    subject_tags: vec!["Multidisciplinary".to_string(), "Open Access".to_string()],
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
        let epmc_query = format!(r#"JOURNAL:"Sci Rep" AND ({})"#, query.query.trim());

        let encoded_q: String = epmc_query
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

        let url_str = format!(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={}&resultType=core&format=json&pageSize={}",
            encoded_q, limit
        );

        if let Ok(validated_url) = UrlGuard::validate_url(&url_str) {
            info!(url = %validated_url, "Querying Nature Scientific Reports via open science index");

            let resp_res = client
                .get(validated_url.as_str())
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                )
                .header("Accept", "application/json")
                .send()
                .await;

            if let Ok(resp) = resp_res {
                if resp.status().is_success() {
                    if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                        if let Ok(results) = Self::parse_epmc_json(&body) {
                            if !results.is_empty() {
                                return Ok(results);
                            }
                        }
                    }
                }
            }
        }

        // Resilient Fallback: If Europe PMC is unreachable (HTTP 503/429/timeout), fallback to Crossref
        info!(query = %query.query, "Europe PMC unavailable or empty; executing resilient Crossref fallback for Nature (prefix 10.1038)");
        Self::search_crossref_fallback(client, query, cancel).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_crossref_nature_json() {
        let json_data = r#"{
            "status": "ok",
            "message": {
                "items": [
                    {
                        "title": ["Quantum inverse iteration algorithm for programmable quantum simulators"],
                        "author": [
                            {"given": "Jane", "family": "Scientist"}
                        ],
                        "published-print": {"date-parts": [[2023, 8, 20]]},
                        "container-title": ["npj Quantum Information"],
                        "DOI": "10.1038/s41534-019-0239-7",
                        "URL": "https://doi.org/10.1038/s41534-019-0239-7"
                    }
                ]
            }
        }"#;

        let cancel = Arc::new(AtomicBool::new(false));
        let results = NatureAdapter::parse_crossref_nature_json(json_data, cancel).unwrap();
        assert_eq!(results.len(), 1);
        let p = &results[0];
        assert_eq!(p.title, "Quantum inverse iteration algorithm for programmable quantum simulators");
        assert_eq!(p.authors, vec!["Jane Scientist"]);
        assert_eq!(p.publication_year, Some(2023));
        assert_eq!(p.canonical_doi, Some("10.1038/s41534-019-0239-7".to_string()));
        assert_eq!(p.pdf_url, Some("https://www.nature.com/articles/s41534-019-0239-7.pdf".to_string()));
        assert_eq!(p.source_id, "nature_srep");
        assert!(p.is_open_access);
    }
}
