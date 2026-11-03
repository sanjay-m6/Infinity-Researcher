use async_trait::async_trait;
use scraper::{Html, Selector};
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

pub struct GoogleScholarAdapter;

impl Default for GoogleScholarAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GoogleScholarAdapter {
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

    fn clean_title_prefixes(title: &str) -> String {
        let mut cleaned = title.trim();
        let prefixes = [
            "[PDF]",
            "[HTML]",
            "[BOOK]",
            "[B]",
            "[CITATION]",
            "[C]",
            "[DOC]",
            "[PPT]",
            "[AUDIO]",
        ];
        for prefix in prefixes {
            if cleaned.starts_with(prefix) {
                cleaned = cleaned[prefix.len()..].trim();
            }
        }
        cleaned.to_string()
    }

    fn extract_year(text: &str) -> Option<i32> {
        let bytes = text.as_bytes();
        for i in 0..bytes.len().saturating_sub(3) {
            let slice = &bytes[i..i + 4];
            if (slice[0] == b'1' && slice[1] == b'9') || (slice[0] == b'2' && slice[1] == b'0') {
                if slice[2].is_ascii_digit() && slice[3].is_ascii_digit() {
                    if let Ok(year_str) = std::str::from_utf8(slice) {
                        if let Ok(y) = year_str.parse::<i32>() {
                            if (1900..=2035).contains(&y) {
                                return Some(y);
                            }
                        }
                    }
                }
            }
        }
        None
    }

    fn extract_doi_from_url(url: &str) -> Option<String> {
        if let Some(pos) = url.find("10.") {
            let candidate = &url[pos..];
            let end = candidate
                .find(|c: char| c.is_whitespace() || c == '?' || c == '#' || c == '"' || c == '\'')
                .unwrap_or(candidate.len());
            let doi = &candidate[..end];
            if doi.contains('/') && doi.len() > 6 {
                return Some(doi.trim_end_matches(['.', '/', ';', ')']).to_string());
            }
        }
        None
    }

    pub fn parse_scholar_html(html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let document = Html::parse_document(html);
        let card_sel = Selector::parse("div.gs_r.gs_or.gs_scl, div.gs_r").unwrap();
        let title_a_sel = Selector::parse("h3.gs_rt a").unwrap();
        let title_h3_sel = Selector::parse("h3.gs_rt").unwrap();
        let author_sel = Selector::parse("div.gs_a").unwrap();
        let snippet_sel = Selector::parse("div.gs_rs").unwrap();
        let pdf_sel = Selector::parse("div.gs_or_ggsm a, div.gs_ggs a").unwrap();

        let mut results = Vec::new();

        for card in document.select(&card_sel) {
            let link_elem = card.select(&title_a_sel).next();
            let raw_title = if let Some(a) = link_elem {
                a.text().collect::<Vec<_>>().join(" ")
            } else if let Some(h3) = card.select(&title_h3_sel).next() {
                h3.text().collect::<Vec<_>>().join(" ")
            } else {
                continue;
            };

            let title = Self::clean_title_prefixes(&Self::strip_html_tags(&raw_title));
            if title.is_empty() {
                continue;
            }

            let landing_url = link_elem
                .and_then(|a| a.value().attr("href"))
                .map(|h| h.trim().to_string())
                .filter(|h| !h.is_empty() && !h.starts_with("javascript:"))
                .unwrap_or_else(|| page_url.to_string());

            let pdf_url = card
                .select(&pdf_sel)
                .next()
                .and_then(|a| a.value().attr("href"))
                .map(|h| h.trim().to_string())
                .filter(|h| !h.is_empty() && !h.starts_with("javascript:"));

            let mut authors = Vec::new();
            let mut venue = None;
            let mut pub_year = None;

            if let Some(author_elem) = card.select(&author_sel).next() {
                let text = author_elem.text().collect::<Vec<_>>().join(" ");
                let parts: Vec<&str> = text.split(['-', '\u{2013}']).map(|s| s.trim()).collect();
                if !parts.is_empty() {
                    for a in parts[0].split(',') {
                        let cleaned_author = a.trim().trim_end_matches(['…', '.']).trim();
                        if !cleaned_author.is_empty() {
                            authors.push(cleaned_author.to_string());
                        }
                    }
                }
                if parts.len() >= 2 {
                    pub_year = Self::extract_year(parts[1]);
                    let clean_venue = parts[1].trim();
                    if !clean_venue.is_empty() {
                        venue = Some(clean_venue.to_string());
                    }
                }
                if pub_year.is_none() && parts.len() >= 3 {
                    pub_year = Self::extract_year(parts[2]);
                }
            }

            if authors.is_empty() {
                authors.push("Google Scholar Author".to_string());
            }

            let abstract_text = card
                .select(&snippet_sel)
                .next()
                .map(|s| s.text().collect::<Vec<_>>().join(" "))
                .map(|s| Self::strip_html_tags(&s))
                .filter(|s| !s.is_empty());

            let canonical_doi = Self::extract_doi_from_url(&landing_url)
                .or_else(|| pdf_url.as_ref().and_then(|p| Self::extract_doi_from_url(p)));

            let is_oa = pdf_url.is_some();
            let is_book = raw_title.contains("[BOOK]");

            let id = format!(
                "scholar-{}",
                canonical_doi
                    .as_ref()
                    .map(|d| d.replace(['/', '.'], "-"))
                    .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string())
            );

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors,
                publication_date: pub_year.map(|y| format!("{}-01-01", y)),
                publication_year: pub_year,
                venue: venue.or(Some("Google Scholar".to_string())),
                canonical_doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "google_scholar".to_string(),
                source_name: "Google Scholar".to_string(),
                content_type: if is_book { "book" } else { "journal_article" }.to_string(),
                is_open_access: is_oa,
                license_name: if is_oa {
                    Some("Open Access Repository".to_string())
                } else {
                    None
                },
                peer_reviewed: Some(!is_book),
                subject_tags: vec!["Google Scholar".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.92),
            });
        }

        results
    }
}

#[async_trait]
impl SourceAdapter for GoogleScholarAdapter {
    fn source_id(&self) -> &'static str {
        "google_scholar"
    }

    fn display_name(&self) -> &'static str {
        "Google Scholar"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "google_scholar".to_string(),
            name: "Google Scholar".to_string(),
            domain: "scholar.google.com".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://policies.google.com/terms".to_string(),
            policy_notes: "Google Scholar query discovery with live parsing and automated open scholarly catalog fallback.".to_string(),
            supports_native_years: true,
            request_delay_ms: 1500,
            content_types: vec![
                "all".to_string(),
                "journal_article".to_string(),
                "preprint".to_string(),
                "conference_paper".to_string(),
            ],
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
        let encoded_q = Self::url_encode(&query.query);
        Ok(SearchPlan {
            source_id: "google_scholar".to_string(),
            start_url: format!("https://scholar.google.com/scholar?q={}&hl=en", encoded_q),
            query: query.query.clone(),
            allowed_domain: "scholar.google.com".to_string(),
            max_pages: query.limit_per_source.unwrap_or(20).clamp(1, 50),
            max_depth: 1,
            delay_ms: 1500,
            pagination_strategy: PaginationStrategy::PageParam {
                param_name: "start".to_string(),
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let parsed = Self::parse_scholar_html(html, page_url);
        if !parsed.is_empty() {
            return parsed;
        }

        let preview = HtmlExtractor::extract(html, page_url, None);
        if let Some(title) = preview.title {
            if !title.is_empty() {
                let id = format!("scholar_{}", uuid::Uuid::new_v4().simple());
                return vec![DiscoveredSearchResult {
                    id,
                    title,
                    authors: if preview.authors.is_empty() {
                        vec!["Google Scholar Author".to_string()]
                    } else {
                        preview.authors
                    },
                    publication_date: preview.publication_date,
                    publication_year: None,
                    venue: preview.venue.or(Some("Google Scholar".to_string())),
                    canonical_doi: preview.canonical_doi,
                    abstract_text: preview.abstract_text,
                    landing_url: page_url.to_string(),
                    pdf_url: preview.pdf_url,
                    source_id: "google_scholar".to_string(),
                    source_name: "Google Scholar".to_string(),
                    content_type: "journal_article".to_string(),
                    is_open_access: false,
                    license_name: None,
                    peer_reviewed: Some(true),
                    subject_tags: vec!["Google Scholar".to_string()],
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

        let limit = query.limit_per_source.unwrap_or(20).min(50);
        let encoded_q = Self::url_encode(&query.query);

        let mut scholar_url = format!("https://scholar.google.com/scholar?q={}&hl=en", encoded_q);
        if let Some(ys) = query.year_start {
            scholar_url.push_str(&format!("&as_ylo={ys}"));
        }
        if let Some(ye) = query.year_end {
            scholar_url.push_str(&format!("&as_yhi={ye}"));
        }

        // Strategy 1: Direct Google Scholar search with standard browser headers
        if let Ok(validated_url) = UrlGuard::validate_url(&scholar_url) {
            info!(query = %query.query, "Attempting direct Google Scholar search");
            let resp = client
                .get(validated_url.as_str())
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                )
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .send()
                .await;

            if let Ok(response) = resp {
                if response.status().is_success() {
                    if let Ok(body) = CrawlEngine::read_response_body_bounded(response).await {
                        // Check for CAPTCHA or blocking markers
                        let lower_body = body.to_lowercase();
                        let is_blocked = lower_body.contains("recaptcha")
                            || lower_body.contains("/sorry/index")
                            || lower_body.contains("unusual traffic from your computer network");

                        if !is_blocked {
                            let results = Self::parse_scholar_html(&body, validated_url.as_str());
                            if !results.is_empty() {
                                info!(
                                    count = results.len(),
                                    "Successfully parsed papers directly from Google Scholar"
                                );
                                return Ok(results);
                            }
                        } else {
                            tracing::warn!("Google Scholar CAPTCHA/bot detection triggered; falling back to OpenAlex index");
                        }
                    }
                } else {
                    tracing::warn!(
                        status = %response.status(),
                        "Google Scholar returned non-200 status; falling back to OpenAlex index"
                    );
                }
            }
        }

        if cancel.load(Ordering::Relaxed) {
            return Err("Search cancelled".to_string());
        }

        // Strategy 2: Resilient Fallback to OpenAlex Scholarly Works Catalog
        info!(query = %query.query, "Executing resilient Google Scholar fallback via OpenAlex index");
        let mut oa_url = format!(
            "https://api.openalex.org/works?search={}&per_page={}",
            Self::url_encode(&query.query),
            limit
        );

        if let (Some(ys), Some(ye)) = (query.year_start, query.year_end) {
            oa_url.push_str(&format!("&filter=publication_year:{ys}-{ye}"));
        } else if let Some(ys) = query.year_start {
            oa_url.push_str(&format!("&filter=publication_year:{ys}-2030"));
        } else if let Some(ye) = query.year_end {
            oa_url.push_str(&format!("&filter=publication_year:1900-{ye}"));
        }

        if let Ok(validated_oa) = UrlGuard::validate_url(&oa_url) {
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
                                    authors.push("Google Scholar Author".to_string());
                                }

                                let pub_year = w["publication_year"].as_i64().map(|y| y as i32);
                                let doi = w["doi"]
                                    .as_str()
                                    .map(|d| d.replace("https://doi.org/", "").trim().to_string());

                                let landing_url = doi
                                    .as_ref()
                                    .map(|d| format!("https://doi.org/{d}"))
                                    .or_else(|| {
                                        w["primary_location"]["landing_page_url"]
                                            .as_str()
                                            .map(|u| u.to_string())
                                    })
                                    .unwrap_or_else(|| {
                                        format!(
                                            "https://scholar.google.com/scholar?q={}",
                                            Self::url_encode(&title)
                                        )
                                    });

                                let pdf_url = w["open_access"]["oa_url"]
                                    .as_str()
                                    .map(|u| u.to_string())
                                    .or_else(|| {
                                        w["primary_location"]["pdf_url"]
                                            .as_str()
                                            .map(|u| u.to_string())
                                    });

                                let is_oa = w["open_access"]["is_oa"].as_bool().unwrap_or(false)
                                    || pdf_url.is_some();

                                let venue = w["primary_location"]["source"]["display_name"]
                                    .as_str()
                                    .map(|s| s.to_string())
                                    .or(Some("Google Scholar".to_string()));

                                results.push(DiscoveredSearchResult {
                                    id: format!("scholar-oa-{}", uuid::Uuid::new_v4().simple()),
                                    title,
                                    authors,
                                    publication_date: pub_year.map(|y| format!("{}-01-01", y)),
                                    publication_year: pub_year,
                                    venue,
                                    canonical_doi: doi,
                                    abstract_text: None,
                                    landing_url: landing_url.clone(),
                                    pdf_url,
                                    source_id: "google_scholar".to_string(),
                                    source_name: "Google Scholar".to_string(),
                                    content_type: "journal_article".to_string(),
                                    is_open_access: is_oa,
                                    license_name: if is_oa {
                                        Some("Open Access Repository".to_string())
                                    } else {
                                        None
                                    },
                                    peer_reviewed: Some(true),
                                    subject_tags: vec!["Google Scholar".to_string()],
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
    fn test_scholar_descriptor_and_capabilities() {
        let adapter = GoogleScholarAdapter::new();
        assert_eq!(adapter.source_id(), "google_scholar");
        assert_eq!(adapter.display_name(), "Google Scholar");
        let desc = adapter.descriptor();
        assert_eq!(desc.id, "google_scholar");
        assert_eq!(desc.status, "enabled");
        assert_eq!(desc.domain, "scholar.google.com");

        let cap = adapter.capabilities();
        assert!(cap.supports_query);
        assert!(cap.provides_direct_pdf);
        assert!(cap.provides_doi);
    }

    #[test]
    fn test_scholar_build_search_plan() {
        let adapter = GoogleScholarAdapter::new();
        let plan = adapter
            .build_search_plan(&WebsiteSearchQuery {
                query: "deep learning representations".to_string(),
                sources: None,
                limit_per_source: Some(20),
                year_start: None,
                year_end: None,
                content_type: None,
                open_access_only: None,
                author: None,
            })
            .unwrap();

        assert_eq!(plan.source_id, "google_scholar");
        assert!(plan.start_url.contains("deep+learning+representations"));
        assert_eq!(plan.max_pages, 20);
    }

    #[test]
    fn test_parse_scholar_html() {
        let sample_html = r#"
        <div class="gs_r gs_or gs_scl" data-cid="aRCT0jKYjgIJ">
            <div class="gs_ggs gs_fl">
                <div class="gs_ggsd">
                    <div class="gs_or_ggsm">
                        <a href="https://arxiv.org/pdf/quant-ph/9708022"><span class="gs_ctg2">[PDF]</span> arxiv.org</a>
                    </div>
                </div>
            </div>
            <div class="gs_ri">
                <h3 class="gs_rt"><a href="https://iopscience.iop.org/article/10.1088/0034-4885/61/2/002/meta"><b>Quantum computing</b></a></h3>
                <div class="gs_a">A Steane - Reports on Progress in Physics, 1998 - iopscience.iop.org</div>
                <div class="gs_rs">Quantum error correction and quantum computation as a physical resource.</div>
            </div>
        </div>
        "#;

        let results = GoogleScholarAdapter::parse_scholar_html(
            sample_html,
            "https://scholar.google.com/scholar",
        );
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.source_id, "google_scholar");
        assert_eq!(r.title, "Quantum computing");
        assert_eq!(r.authors, vec!["A Steane"]);
        assert_eq!(r.publication_year, Some(1998));
        assert_eq!(
            r.venue,
            Some("Reports on Progress in Physics, 1998".to_string())
        );
        assert_eq!(
            r.landing_url,
            "https://iopscience.iop.org/article/10.1088/0034-4885/61/2/002/meta"
        );
        assert_eq!(
            r.pdf_url,
            Some("https://arxiv.org/pdf/quant-ph/9708022".to_string())
        );
        assert!(r.is_open_access);
        assert_eq!(
            r.canonical_doi,
            Some("10.1088/0034-4885/61/2/002/meta".to_string())
        );
    }
}
