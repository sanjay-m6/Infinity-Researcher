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

    pub fn merge_discovered(
        target: &mut Vec<DiscoveredSearchResult>,
        seen: &mut std::collections::HashSet<String>,
        incoming: Vec<DiscoveredSearchResult>,
    ) {
        for paper in incoming {
            let key = paper
                .canonical_doi
                .as_deref()
                .map(|d| d.to_lowercase())
                .unwrap_or_else(|| {
                    paper
                        .title
                        .to_lowercase()
                        .chars()
                        .filter(|c| c.is_alphanumeric())
                        .collect()
                });
            if !seen.contains(&key) {
                seen.insert(key);
                target.push(paper);
            }
        }
    }

    pub fn extract_keywords(query: &str) -> String {
        let stop_words = [
            "using", "ahead", "with", "from", "that", "this", "which", "into", "over", "than",
            "more", "then", "their", "about", "study", "based", "approach", "through", "under",
            "between", "these", "those", "such", "after", "before", "and", "the", "for", "in",
            "of", "to", "a", "an", "on", "at", "by",
        ];
        let words: Vec<&str> = query
            .split(|c: char| {
                c.is_whitespace() || c == '-' || c == '_' || c == ',' || c == ';' || c == ':'
            })
            .filter(|w| !w.is_empty())
            .collect();
        if words.len() <= 4 {
            return query.to_string();
        }
        let salient: Vec<&str> = words
            .into_iter()
            .filter(|w| w.len() > 3 && !stop_words.contains(&w.to_lowercase().as_str()))
            .collect();
        if salient.len() >= 3 {
            salient.join(" ")
        } else {
            query.to_string()
        }
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

            // Note: dl.acm.org/doi/pdf/{doi} returns HTTP 403 / Cloudflare challenge on direct
            // automated GET requests without a browser session. We leave pdf_url as None
            // so the UI presents the accurate Publisher Landing / OA Mirror workflow
            // instead of failing on a broken direct stream.
            let pdf_url: Option<String> = None;

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
        let mut results: Vec<DiscoveredSearchResult> = Vec::new();
        let mut seen_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Pass 1: Crossref ACM with verbatim query (filter prefix:10.1145)
        let crossref_url = format!(
            "https://api.crossref.org/works?query={}&filter=prefix:10.1145&rows={}",
            Self::url_encode(&query.query),
            limit
        );

        if let Ok(validated_crossref) = UrlGuard::validate_url(&crossref_url) {
            info!(query = %query.query, "Querying Crossref index for ACM publications (prefix 10.1145)");
            let cr_resp = client
                .get(validated_crossref.as_str())
                .header(
                    "User-Agent",
                    "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
                )
                .header("Accept", "application/json")
                .send()
                .await;

            if let Ok(resp) = cr_resp {
                if resp.status().is_success() {
                    if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                        if let Ok(parsed) = Self::parse_crossref_acm_json(&body, cancel.clone()) {
                            Self::merge_discovered(&mut results, &mut seen_keys, parsed);
                        }
                    }
                }
            }
        }

        if cancel.load(Ordering::Relaxed) {
            return Err("Search cancelled".to_string());
        }

        // Pass 2: If fewer than limit, relax query keywords to extract salient terms
        if results.len() < limit {
            let relaxed = Self::extract_keywords(&query.query);
            if relaxed != query.query {
                let relaxed_url = format!(
                    "https://api.crossref.org/works?query={}&filter=prefix:10.1145&rows={}",
                    Self::url_encode(&relaxed),
                    limit
                );
                if let Ok(validated_relaxed) = UrlGuard::validate_url(&relaxed_url) {
                    info!(relaxed = %relaxed, "Querying Crossref index for ACM with relaxed keywords");
                    if let Ok(resp) = client
                        .get(validated_relaxed.as_str())
                        .header(
                            "User-Agent",
                            "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
                        )
                        .header("Accept", "application/json")
                        .send()
                        .await
                    {
                        if resp.status().is_success() {
                            if let Ok(body) = CrawlEngine::read_response_body_bounded(resp).await {
                                if let Ok(parsed) =
                                    Self::parse_crossref_acm_json(&body, cancel.clone())
                                {
                                    Self::merge_discovered(&mut results, &mut seen_keys, parsed);
                                }
                            }
                        }
                    }
                }
            }
        }

        if cancel.load(Ordering::Relaxed) {
            return Err("Search cancelled".to_string());
        }

        // Pass 3: Secondary Fallback to OpenAlex works for ACM works
        if results.len() < limit {
            let oa_url = format!(
                "https://api.openalex.org/works?search={}&per_page={}",
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
                                for w in works {
                                    if cancel.load(Ordering::Relaxed) {
                                        return Err("Search cancelled".to_string());
                                    }
                                    let doi = w["doi"].as_str().map(|d| {
                                        d.replace("https://doi.org/", "").trim().to_string()
                                    });

                                    let is_acm =
                                        doi.as_deref().map_or(false, |d| d.starts_with("10.1145"))
                                            || w["primary_location"]["source"]["display_name"]
                                                .as_str()
                                                .map_or(false, |s| s.contains("ACM"));
                                    if !is_acm {
                                        continue;
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
                                            if let Some(name) = a["author"]["display_name"].as_str()
                                            {
                                                authors.push(name.trim().to_string());
                                            }
                                        }
                                    }
                                    if authors.is_empty() {
                                        authors.push("ACM Contributor".to_string());
                                    }

                                    let pub_year = w["publication_year"].as_i64().map(|y| y as i32);
                                    let landing_url = doi
                                        .as_ref()
                                        .map(|d| format!("https://dl.acm.org/doi/{d}"))
                                        .unwrap_or_else(|| {
                                            format!(
                                                "https://doi.org/{}",
                                                doi.as_deref().unwrap_or("")
                                            )
                                        });

                                    // Only keep pdf_url if it does NOT point to dl.acm.org (which blocks bots)
                                    let pdf_url = w["open_access"]["oa_url"]
                                        .as_str()
                                        .filter(|u| !u.contains("dl.acm.org"))
                                        .map(|u| u.to_string());

                                    let is_oa =
                                        w["open_access"]["is_oa"].as_bool().unwrap_or(false);

                                    let paper = DiscoveredSearchResult {
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
                                    };

                                    let key = paper
                                        .canonical_doi
                                        .as_deref()
                                        .map(|d| d.to_lowercase())
                                        .unwrap_or_else(|| {
                                            paper
                                                .title
                                                .to_lowercase()
                                                .chars()
                                                .filter(|c| c.is_alphanumeric())
                                                .collect()
                                        });
                                    if !seen_keys.contains(&key) {
                                        seen_keys.insert(key);
                                        results.push(paper);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        info!(
            count = results.len(),
            "Total discovered ACM publications after query expansion"
        );
        Ok(results)
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
        assert_eq!(r.pdf_url, None);
        assert!(r.is_open_access);
        assert_eq!(
            r.abstract_text,
            Some("An experimental study of quantum algorithms.".to_string())
        );
    }
}
