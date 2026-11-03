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

pub struct AcmAdapter;

impl Default for AcmAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AcmAdapter {
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
            .replace("&apos;", "'")
            .trim()
            .to_string()
    }

    pub fn parse_crossref_acm_json(
        json_str: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String> {
        let cr_val: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse Crossref ACM response: {e}"))?;

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
                authors.push("ACM Contributor".to_string());
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
                .or_else(|| {
                    item["short-container-title"]
                        .as_array()
                        .and_then(|c| c.first())
                        .and_then(|c| c.as_str())
                        .map(|s| s.trim().to_string())
                })
                .or(Some("ACM Digital Library".to_string()));

            let doi = item["DOI"]
                .as_str()
                .map(|d| d.trim().to_string())
                .filter(|d| !d.is_empty());

            let landing_url = doi
                .as_ref()
                .map(|d| format!("https://dl.acm.org/doi/{d}"))
                .or_else(|| item["URL"].as_str().map(|u| u.to_string()))
                .unwrap_or_else(|| {
                    format!(
                        "https://dl.acm.org/action/doSearch?AllField={}",
                        Self::url_encode(&title)
                    )
                });

            let abstract_text = item["abstract"]
                .as_str()
                .map(Self::strip_html_tags)
                .filter(|a| !a.is_empty());

            let is_oa = item["license"].as_array().map_or(false, |licenses| {
                licenses.iter().any(|lic| {
                    lic["URL"].as_str().map_or(false, |u| {
                        let u_lower = u.to_lowercase();
                        u_lower.contains("creativecommons.org")
                            || u_lower.contains("/open-access")
                            || u_lower.contains("/oa/")
                    })
                })
            });

            let pdf_url = doi
                .as_ref()
                .map(|d| format!("https://dl.acm.org/doi/pdf/{d}"));

            let raw_type = item["type"].as_str().unwrap_or("journal-article");
            let content_type = match raw_type {
                "proceedings-article" | "proceedings-series" | "proceedings" => "conference_paper",
                "book-chapter" | "book" => "book_chapter",
                _ => "journal_article",
            }
            .to_string();

            let paper_id = doi
                .as_ref()
                .map(|d| format!("acm-{}", d.replace(['/', '.'], "-")))
                .unwrap_or_else(|| format!("acm-{}", uuid::Uuid::new_v4().simple()));

            results.push(DiscoveredSearchResult {
                id: paper_id,
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue,
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "acm_dl".to_string(),
                source_name: "ACM Digital Library".to_string(),
                content_type,
                is_open_access: is_oa,
                license_name: if is_oa {
                    Some("ACM Open Access".to_string())
                } else {
                    None
                },
                peer_reviewed: Some(true),
                subject_tags: vec!["ACM".to_string(), "Computer Science".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.95),
            });
        }

        Ok(results)
    }
}

#[async_trait]
impl SourceAdapter for AcmAdapter {
    fn source_id(&self) -> &'static str {
        "acm_dl"
    }

    fn display_name(&self) -> &'static str {
        "ACM Digital Library"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "acm_dl".to_string(),
            name: "ACM Digital Library".to_string(),
            domain: "dl.acm.org".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://www.acm.org/about-acm/terms-of-use".to_string(),
            policy_notes: "ACM Digital Library publications and conference proceedings via Crossref prefix 10.1145 and ACM DL indexing.".to_string(),
            supports_native_years: true,
            request_delay_ms: 1000,
            content_types: vec!["conference_paper".to_string(), "journal_article".to_string()],
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
            rate_limit_ms: 1000,
            search_support: "supported".to_string(),
            requires_browser_rendering: false,
            max_pages_per_job: 20,
        }
    }

    fn build_search_plan(&self, query: &WebsiteSearchQuery) -> Result<SearchPlan, String> {
        let encoded_q = Self::url_encode(&query.query);
        Ok(SearchPlan {
            source_id: "acm_dl".to_string(),
            start_url: format!("https://dl.acm.org/action/doSearch?AllField={}", encoded_q),
            query: query.query.clone(),
            allowed_domain: "dl.acm.org".to_string(),
            max_pages: query.limit_per_source.unwrap_or(25).clamp(1, 100),
            max_depth: 1,
            delay_ms: 1000,
            pagination_strategy: PaginationStrategy::PageParam {
                param_name: "startPage".to_string(),
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let preview = HtmlExtractor::extract(html, page_url, None);
        if let Some(title) = preview.title {
            if !title.is_empty() {
                let id = format!("acm_{}", uuid::Uuid::new_v4().simple());
                return vec![DiscoveredSearchResult {
                    id,
                    title,
                    authors: if preview.authors.is_empty() {
                        vec!["ACM Contributor".to_string()]
                    } else {
                        preview.authors
                    },
                    publication_date: preview.publication_date,
                    publication_year: None,
                    venue: preview.venue.or(Some("ACM Digital Library".to_string())),
                    canonical_doi: preview.canonical_doi,
                    abstract_text: preview.abstract_text,
                    landing_url: page_url.to_string(),
                    pdf_url: preview.pdf_url,
                    source_id: "acm_dl".to_string(),
                    source_name: "ACM Digital Library".to_string(),
                    content_type: "conference_paper".to_string(),
                    is_open_access: false,
                    license_name: None,
                    peer_reviewed: Some(true),
                    subject_tags: vec!["Computer Science".to_string()],
                    language: Some("en".to_string()),
                    relevance_score: 1.0,
                    provenance_urls: vec![page_url.to_string()],
                    metadata_confidence: Some(0.9),
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

        let limit = query.limit_per_source.unwrap_or(25).min(50);
        info!(query = %query.query, "Querying Crossref index for ACM publications (prefix 10.1145)");

        let crossref_url = format!(
            "https://api.crossref.org/works?query={}&filter=prefix:10.1145&rows={}",
            Self::url_encode(&query.query),
            limit
        );

        let validated_crossref = UrlGuard::validate_url(&crossref_url)
            .map_err(|e| format!("Anti-SSRF blocked Crossref ACM URL: {e}"))?;

        let cr_resp = client
            .get(validated_crossref.as_str())
            .header(
                "User-Agent",
                "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            )
            .header("Accept", "application/json")
            .send()
            .await;

        match cr_resp {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                    if let Ok(results) = Self::parse_crossref_acm_json(&body, cancel.clone()) {
                        if !results.is_empty() {
                            info!(
                                count = results.len(),
                                "Successfully discovered ACM papers via Crossref ACM index"
                            );
                            return Ok(results);
                        }
                    }
                }
            }
            Ok(resp) => {
                tracing::warn!(
                    status = %resp.status(),
                    "Crossref ACM query returned non-success; attempting OpenAlex ACM fallback"
                );
            }
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Failed reaching Crossref for ACM; attempting OpenAlex ACM fallback"
                );
            }
        }

        if cancel.load(Ordering::Relaxed) {
            return Err("Search cancelled".to_string());
        }

        // Secondary Fallback: Query OpenAlex works for ACM works
        let oa_url = format!(
            "https://api.openalex.org/works?search={}&filter=doi:10.1145*&per_page={}",
            Self::url_encode(&query.query),
            limit
        );

        if let Ok(validated_oa) = UrlGuard::validate_url(&oa_url) {
            info!(query = %query.query, "Querying OpenAlex index for ACM publications");
            let oa_resp = client
                .get(validated_oa.as_str())
                .header(
                    "User-Agent",
                    "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
                )
                .header("Accept", "application/json")
                .send()
                .await;

            if let Ok(resp) = oa_resp {
                if resp.status().is_success() {
                    if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                            let empty_vec = Vec::new();
                            let works = val["results"].as_array().unwrap_or(&empty_vec);
                            let mut results = Vec::new();
                            for w in works {
                                if cancel.load(Ordering::Relaxed) {
                                    return Err("Search cancelled".to_string());
                                }
                                let title = w["title"]
                                    .as_str()
                                    .or_else(|| w["display_name"].as_str())
                                    .unwrap_or("")
                                    .trim()
                                    .to_string();
                                if title.is_empty() {
                                    continue;
                                }

                                let mut authors = Vec::new();
                                if let Some(authorships) = w["authorships"].as_array() {
                                    for a in authorships {
                                        if let Some(name) = a["author"]["display_name"].as_str() {
                                            authors.push(name.trim().to_string());
                                        }
                                    }
                                }
                                if authors.is_empty() {
                                    authors.push("ACM Contributor".to_string());
                                }

                                let pub_year = w["publication_year"].as_i64().map(|y| y as i32);
                                let doi = w["doi"]
                                    .as_str()
                                    .map(|d| d.replace("https://doi.org/", "").trim().to_string());

                                let landing_url = doi
                                    .as_ref()
                                    .map(|d| format!("https://dl.acm.org/doi/{d}"))
                                    .unwrap_or_else(|| {
                                        format!("https://doi.org/{}", doi.as_deref().unwrap_or(""))
                                    });

                                let pdf_url = w["open_access"]["oa_url"]
                                    .as_str()
                                    .map(|u| u.to_string())
                                    .or_else(|| {
                                        doi.as_ref()
                                            .map(|d| format!("https://dl.acm.org/doi/pdf/{d}"))
                                    });

                                let is_oa = w["open_access"]["is_oa"].as_bool().unwrap_or(false);

                                results.push(DiscoveredSearchResult {
                                    id: format!("acm-oa-{}", uuid::Uuid::new_v4().simple()),
                                    title,
                                    authors,
                                    publication_date: pub_year.map(|y| format!("{}-01-01", y)),
                                    publication_year: pub_year,
                                    venue: Some("ACM Digital Library".to_string()),
                                    canonical_doi: doi,
                                    abstract_text: None,
                                    landing_url: landing_url.clone(),
                                    pdf_url,
                                    source_id: "acm_dl".to_string(),
                                    source_name: "ACM Digital Library".to_string(),
                                    content_type: "conference_paper".to_string(),
                                    is_open_access: is_oa,
                                    license_name: if is_oa {
                                        Some("ACM Open Access".to_string())
                                    } else {
                                        None
                                    },
                                    peer_reviewed: Some(true),
                                    subject_tags: vec![
                                        "ACM".to_string(),
                                        "Computer Science".to_string(),
                                    ],
                                    language: Some("en".to_string()),
                                    relevance_score: 1.0,
                                    provenance_urls: vec![landing_url],
                                    metadata_confidence: Some(0.92),
                                });
                            }
                            if !results.is_empty() {
                                return Ok(results);
                            }
                        }
                    }
                }
            }
        }

        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_acm_descriptor_and_capabilities() {
        let adapter = AcmAdapter::new();
        assert_eq!(adapter.source_id(), "acm_dl");
        assert_eq!(adapter.display_name(), "ACM Digital Library");
        let desc = adapter.descriptor();
        assert_eq!(desc.id, "acm_dl");
        assert_eq!(desc.status, "enabled");
        assert_eq!(desc.domain, "dl.acm.org");

        let cap = adapter.capabilities();
        assert!(cap.supports_query);
        assert!(cap.provides_direct_pdf);
        assert!(cap.provides_doi);
    }

    #[test]
    fn test_acm_build_search_plan() {
        let adapter = AcmAdapter::new();
        let plan = adapter
            .build_search_plan(&WebsiteSearchQuery {
                query: "quantum computing algorithms".to_string(),
                sources: None,
                limit_per_source: Some(15),
                year_start: None,
                year_end: None,
                content_type: None,
                open_access_only: None,
                author: None,
            })
            .unwrap();

        assert_eq!(plan.source_id, "acm_dl");
        assert!(plan.start_url.contains("quantum+computing+algorithms"));
        assert_eq!(plan.max_pages, 15);
    }

    #[test]
    fn test_parse_crossref_acm_json() {
        let json_data = r#"{
            "status": "ok",
            "message": {
                "items": [
                    {
                        "DOI": "10.1145/3430030",
                        "title": ["Practical Quantum Computing: Solving the Wave Equation"],
                        "author": [
                            {"given": "Alice", "family": "Smith"},
                            {"given": "Bob", "family": "Jones"}
                        ],
                        "container-title": ["ACM Transactions on Quantum Computing"],
                        "published-print": {"date-parts": [[2021, 2, 10]]},
                        "abstract": "<jats:p>An experimental study of quantum algorithms.</jats:p>",
                        "type": "journal-article",
                        "license": [
                            {"URL": "https://creativecommons.org/licenses/by/4.0/"}
                        ]
                    }
                ]
            }
        }"#;

        let cancel = Arc::new(AtomicBool::new(false));
        let results = AcmAdapter::parse_crossref_acm_json(json_data, cancel).unwrap();
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.source_id, "acm_dl");
        assert_eq!(
            r.title,
            "Practical Quantum Computing: Solving the Wave Equation"
        );
        assert_eq!(r.authors, vec!["Alice Smith", "Bob Jones"]);
        assert_eq!(r.publication_year, Some(2021));
        assert_eq!(r.canonical_doi, Some("10.1145/3430030".to_string()));
        assert_eq!(r.landing_url, "https://dl.acm.org/doi/10.1145/3430030");
        assert_eq!(
            r.pdf_url,
            Some("https://dl.acm.org/doi/pdf/10.1145/3430030".to_string())
        );
        assert!(r.is_open_access);
        assert_eq!(
            r.abstract_text,
            Some("An experimental study of quantum algorithms.".to_string())
        );
    }
}
