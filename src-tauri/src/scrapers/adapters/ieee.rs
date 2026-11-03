use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::info;

use crate::scrapers::adapters::SourceAdapter;
use crate::scrapers::engine::CrawlEngine;
use crate::scrapers::types::{
    DiscoveredSearchResult, PaginationStrategy, SearchPlan, SourceCapabilities, WebsiteSearchQuery,
    WebsiteSourceDescriptor,
};
use crate::scrapers::url_guard::UrlGuard;

pub struct IeeeAdapter;

impl Default for IeeeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl IeeeAdapter {
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
}

#[async_trait]
impl SourceAdapter for IeeeAdapter {
    fn source_id(&self) -> &'static str {
        "ieee_xplore"
    }

    fn display_name(&self) -> &'static str {
        "IEEE Xplore"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "ieee_xplore".to_string(),
            name: "IEEE Xplore".to_string(),
            domain: "ieeexplore.ieee.org".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://ieeexplore.ieee.org/XploreHelp/legal-terms".to_string(),
            policy_notes: "Query and discovery for IEEE scholarly conferences and journals via official REST and Crossref prefix index.".to_string(),
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
            max_pages_per_job: 15,
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
            source_id: self.source_id().to_string(),
            start_url: format!(
                "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={}",
                encoded_q
            ),
            query: query.query.clone(),
            allowed_domain: "ieeexplore.ieee.org".to_string(),
            max_pages: 5,
            max_depth: 2,
            delay_ms: 1000,
            pagination_strategy: PaginationStrategy::PageParam {
                param_name: "pageNumber".to_string(),
            },
        })
    }

    fn extract_papers_from_html(
        &self,
        _html: &str,
        _page_url: &str,
    ) -> Vec<DiscoveredSearchResult> {
        Vec::new()
    }

    async fn search(
        &self,
        client: &reqwest::Client,
        query: &WebsiteSearchQuery,
        cancel: Arc<AtomicBool>,
    ) -> Result<Vec<DiscoveredSearchResult>, String> {
        if cancel.load(Ordering::Relaxed) {
            return Err("Search was cancelled by user.".to_string());
        }

        let limit = query.limit_per_source.unwrap_or(25).min(50);

        // Strategy 1: Attempt official IEEE Xplore REST search API
        let ieee_url = "https://ieeexplore.ieee.org/rest/search";
        let mut payload = serde_json::json!({
            "queryText": query.query.trim(),
            "rowsPerPage": limit
        });

        if let Some(true) = query.open_access_only {
            payload["openAccess"] = serde_json::Value::Bool(true);
        }

        info!(query = %query.query, "Querying official IEEE Xplore REST search API");

        let ieee_resp = client
            .post(ieee_url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            )
            .header("Accept", "application/json, text/plain, */*")
            .header("Content-Type", "application/json")
            .header("Origin", "https://ieeexplore.ieee.org")
            .header(
                "Referer",
                format!(
                    "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={}",
                    Self::url_encode(&query.query)
                ),
            )
            .json(&payload)
            .send()
            .await;

        if let Ok(resp) = ieee_resp {
            if resp.status().is_success() {
                if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                        let empty_vec = Vec::new();
                        let records = val["records"].as_array().unwrap_or(&empty_vec);
                        if !records.is_empty() {
                            let mut results = Vec::new();
                            for rec in records {
                                if cancel.load(Ordering::Relaxed) {
                                    return Err("Search was cancelled by user.".to_string());
                                }

                                let raw_title = rec["articleTitle"].as_str().unwrap_or("").trim();
                                let title = Self::strip_html_tags(raw_title);
                                if title.is_empty() {
                                    continue;
                                }

                                let mut authors = Vec::new();
                                if let Some(author_list) = rec["authors"].as_array() {
                                    for a in author_list {
                                        if let Some(name) = a["preferredName"]
                                            .as_str()
                                            .or(a["normalizedName"].as_str())
                                        {
                                            let cleaned = name.trim().to_string();
                                            if !cleaned.is_empty() {
                                                authors.push(cleaned);
                                            }
                                        }
                                    }
                                }

                                let pub_year = rec["publicationYear"]
                                    .as_str()
                                    .and_then(|y| y.parse::<i32>().ok())
                                    .or_else(|| rec["publicationYear"].as_i64().map(|y| y as i32));

                                let venue = rec["publicationTitle"]
                                    .as_str()
                                    .map(|v| Self::strip_html_tags(v))
                                    .filter(|v| !v.is_empty());

                                let doi = rec["doi"]
                                    .as_str()
                                    .map(|d| d.trim().to_string())
                                    .filter(|d| !d.is_empty());

                                let doc_link = rec["documentLink"].as_str().unwrap_or("");
                                let landing_url = if doc_link.starts_with("http") {
                                    doc_link.to_string()
                                } else if !doc_link.is_empty() {
                                    format!("https://ieeexplore.ieee.org{}", doc_link)
                                } else if let Some(ref d) = doi {
                                    format!("https://doi.org/{}", d)
                                } else {
                                    format!("https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={}", Self::url_encode(&title))
                                };

                                let is_oa = rec["accessType"]["type"].as_str()
                                    == Some("open-access")
                                    || rec["isOpenAccess"].as_bool().unwrap_or(false);

                                if let Some(true) = query.open_access_only {
                                    if !is_oa {
                                        continue;
                                    }
                                }

                                let pdf_url = if is_oa {
                                    rec["pdfLink"].as_str().map(|pl| {
                                        if pl.starts_with("http") {
                                            pl.to_string()
                                        } else {
                                            format!("https://ieeexplore.ieee.org{}", pl)
                                        }
                                    })
                                } else {
                                    None
                                };

                                let abstract_text = rec["abstract"]
                                    .as_str()
                                    .map(|a| Self::strip_html_tags(a))
                                    .filter(|a| !a.is_empty());

                                let article_id = rec["articleNumber"]
                                    .as_str()
                                    .map(|n| n.to_string())
                                    .or_else(|| {
                                        rec["articleNumber"].as_i64().map(|n| n.to_string())
                                    })
                                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                                results.push(DiscoveredSearchResult {
                                    id: format!("ieee-{}", article_id),
                                    title,
                                    authors,
                                    publication_date: pub_year.map(|y| format!("{}-01-01", y)),
                                    publication_year: pub_year,
                                    venue: venue.or(Some("IEEE Xplore".to_string())),
                                    canonical_doi: doi,
                                    abstract_text,
                                    landing_url: landing_url.clone(),
                                    pdf_url,
                                    source_id: "ieee_xplore".to_string(),
                                    source_name: "IEEE Xplore".to_string(),
                                    content_type: rec["contentType"]
                                        .as_str()
                                        .unwrap_or("journal_article")
                                        .to_string(),
                                    is_open_access: is_oa,
                                    license_name: if is_oa {
                                        Some("IEEE Open Access".to_string())
                                    } else {
                                        None
                                    },
                                    peer_reviewed: Some(true),
                                    subject_tags: vec!["IEEE".to_string()],
                                    language: Some("en".to_string()),
                                    relevance_score: 1.0,
                                    provenance_urls: vec![landing_url],
                                    metadata_confidence: Some(0.95),
                                });
                            }

                            if !results.is_empty() {
                                info!(
                                    count = results.len(),
                                    "Successfully discovered IEEE papers via IEEE REST search"
                                );
                                return Ok(results);
                            }
                        }
                    }
                }
            }
        }

        // Strategy 2 (Robust Fallback): Query Crossref for IEEE publications (Prefix 10.1109)
        info!(query = %query.query, "Querying Crossref index for IEEE publications (prefix 10.1109)");

        let crossref_url = format!(
            "https://api.crossref.org/works?query={}&filter=prefix:10.1109&rows={}",
            Self::url_encode(&query.query),
            limit
        );

        let validated_crossref = UrlGuard::validate_url(&crossref_url)
            .map_err(|e| format!("Anti-SSRF blocked Crossref IEEE URL: {e}"))?;

        let cr_resp = client
            .get(validated_crossref.as_str())
            .header(
                "User-Agent",
                "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            )
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Failed reaching Crossref for IEEE index: {e}"))?;

        if !cr_resp.status().is_success() {
            return Err(format!(
                "IEEE search returned HTTP status: {}",
                cr_resp.status()
            ));
        }

        let cr_body = CrawlEngine::read_response_body_bounded(cr_resp)
            .await
            .map_err(|e| format!("Failed reading Crossref response body: {e}"))?;

        let cr_val: serde_json::Value = serde_json::from_str(&cr_body)
            .map_err(|e| format!("Failed parsing Crossref IEEE response: {e}"))?;

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

            let pub_year = item["published-print"]["date-parts"][0][0]
                .as_i64()
                .or_else(|| item["published-online"]["date-parts"][0][0].as_i64())
                .or_else(|| item["created"]["date-parts"][0][0].as_i64())
                .map(|y| y as i32);

            let venue = item["container-title"]
                .as_array()
                .and_then(|c| c.first())
                .and_then(|c| c.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .or(Some("IEEE".to_string()));

            let doi = item["DOI"].as_str().map(|d| d.trim().to_string());

            let landing_url = item["URL"]
                .as_str()
                .map(|u| u.to_string())
                .or_else(|| doi.as_ref().map(|d| format!("https://doi.org/{}", d)))
                .unwrap_or_else(|| {
                    format!(
                        "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={}",
                        Self::url_encode(&title)
                    )
                });

            let abstract_text = item["abstract"]
                .as_str()
                .map(|a| Self::strip_html_tags(a))
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

            if let Some(true) = query.open_access_only {
                if !is_oa {
                    continue;
                }
            }

            let item_id = doi.as_deref().unwrap_or(&landing_url);
            let id_slug: String = item_id
                .chars()
                .filter(|c| c.is_alphanumeric())
                .take(12)
                .collect();
            let unique_part = uuid::Uuid::new_v4().to_string();

            results.push(DiscoveredSearchResult {
                id: format!(
                    "ieee-{}-{}",
                    if id_slug.is_empty() { "work" } else { &id_slug },
                    &unique_part[..8]
                ),
                title,
                authors,
                publication_date: pub_year.map(|y| format!("{}-01-01", y)),
                publication_year: pub_year,
                venue,
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url: None,
                source_id: "ieee_xplore".to_string(),
                source_name: "IEEE Xplore".to_string(),
                content_type: item["type"]
                    .as_str()
                    .unwrap_or("journal_article")
                    .to_string(),
                is_open_access: is_oa,
                license_name: if is_oa {
                    Some("Open Access".to_string())
                } else {
                    None
                },
                peer_reviewed: Some(true),
                subject_tags: vec!["IEEE".to_string()],
                language: Some("en".to_string()),
                relevance_score: 0.9,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.9),
            });
        }

        info!(
            count = results.len(),
            "Successfully discovered IEEE papers via Crossref prefix index"
        );
        Ok(results)
    }
}
