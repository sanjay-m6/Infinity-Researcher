use async_trait::async_trait;
use scraper::{Html, Selector};
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

pub struct ArxivAdapter;

impl Default for ArxivAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ArxivAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Parses arXiv public search result HTML into DiscoveredSearchResult records.
    pub fn parse_arxiv_html(html: &str) -> Vec<DiscoveredSearchResult> {
        let document = Html::parse_document(html);
        let result_sel = Selector::parse("li.arxiv-result").unwrap();
        let title_sel = Selector::parse("p.title").unwrap();
        let authors_sel = Selector::parse("p.authors a").unwrap();
        let abstract_sel = Selector::parse("span.abstract-full").unwrap();
        let short_abstract_sel = Selector::parse("span.abstract-short").unwrap();
        let link_sel = Selector::parse(
            "p.list-title a[href*=\"/abs/\"], a[href*=\"/abs/\"], a[href*=\"arxiv.org/abs/\"]",
        )
        .unwrap();
        let pdf_sel = Selector::parse(
            "p.list-title a[href*=\"/pdf/\"], a[href*=\"/pdf/\"], a[href*=\".pdf\"]",
        )
        .unwrap();
        let doi_sel = Selector::parse("p.doi a, a[href*=\"doi.org/\"]").unwrap();
        let tag_sel = Selector::parse("span.tag.is-small").unwrap();

        let mut results = Vec::new();

        for item in document.select(&result_sel) {
            let mut title = item
                .select(&title_sel)
                .next()
                .map(|e| e.text().collect::<Vec<_>>().join(" "))
                .unwrap_or_default()
                .trim()
                .to_string();

            if title.starts_with("Title:") {
                title = title["Title:".len()..].trim().to_string();
            }

            if title.is_empty() {
                continue;
            }

            let authors: Vec<String> = item
                .select(&authors_sel)
                .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|a| !a.is_empty())
                .collect();

            let full_abs = item
                .select(&abstract_sel)
                .next()
                .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string());

            let abstract_text = full_abs.or_else(|| {
                item.select(&short_abstract_sel)
                    .next()
                    .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
            });

            let landing_url = item
                .select(&link_sel)
                .next()
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://arxiv.org{href}")
                    }
                })
                .unwrap_or_else(|| "https://arxiv.org".to_string());

            let mut pdf_url = item
                .select(&pdf_sel)
                .next()
                .and_then(|e| e.value().attr("href"))
                .map(|href| {
                    if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://arxiv.org{href}")
                    }
                });

            // Ensure proper .pdf suffix
            if let Some(ref mut p) = pdf_url {
                if !p.ends_with(".pdf") {
                    p.push_str(".pdf");
                }
            } else if landing_url.contains("/abs/") {
                let candidate = landing_url.replace("/abs/", "/pdf/") + ".pdf";
                pdf_url = Some(candidate);
            }

            let canonical_doi = item
                .select(&doi_sel)
                .next()
                .and_then(|e| e.value().attr("href"))
                .and_then(|h| h.find("10.").map(|idx| h[idx..].trim().to_string()));

            let subject_tags: Vec<String> = item
                .select(&tag_sel)
                .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|t| !t.is_empty())
                .collect();

            let mut pub_year = None;
            let mut pub_date = None;
            let item_text = item.text().collect::<Vec<_>>().join(" ");
            let item_text_lower = item_text.to_lowercase();
            if let Some(pos) = item_text_lower.find("submitted") {
                let sub_slice = &item_text[pos..item_text.len().min(pos + 60)];
                for token in sub_slice.split_whitespace() {
                    let clean_num: String = token.chars().filter(|c| c.is_ascii_digit()).collect();
                    if clean_num.len() == 4 {
                        if let Ok(y) = clean_num.parse::<i32>() {
                            if (1990..=2030).contains(&y) {
                                pub_year = Some(y);
                                pub_date = Some(format!("{y}-01-01"));
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback: derive year from arXiv id (e.g. "2301.00001" -> 2023)
            if pub_year.is_none() {
                if let Some(pos) = landing_url.find("/abs/") {
                    let abs_id = &landing_url[pos + 5..];
                    if abs_id.len() >= 4 && abs_id.chars().take(2).all(|c| c.is_ascii_digit()) {
                        if let Ok(yy) = abs_id[0..2].parse::<i32>() {
                            let full_year = if yy > 80 { 1900 + yy } else { 2000 + yy };
                            pub_year = Some(full_year);
                            pub_date = Some(format!("{full_year}-01-01"));
                        }
                    }
                }
            }

            // Derive ID from arXiv URL or title hash
            let id = if let Some(pos) = landing_url.find("/abs/") {
                format!("arxiv_{}", landing_url[pos + 5..].replace('/', "_"))
            } else {
                format!("arxiv_{}", uuid::Uuid::new_v4().simple())
            };

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors: if authors.is_empty() {
                    vec!["arXiv Author".to_string()]
                } else {
                    authors
                },
                publication_date: pub_date,
                publication_year: pub_year,
                venue: Some("arXiv Preprints".to_string()),
                canonical_doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "arxiv".to_string(),
                source_name: "arXiv Preprints".to_string(),
                content_type: "preprint".to_string(),
                is_open_access: true,
                license_name: Some("arXiv.org non-exclusive license".to_string()),
                peer_reviewed: Some(false),
                subject_tags,
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(0.95),
            });
        }

        results
    }
}

#[async_trait]
impl SourceAdapter for ArxivAdapter {
    fn source_id(&self) -> &'static str {
        "arxiv"
    }

    fn display_name(&self) -> &'static str {
        "arXiv Preprints"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "arxiv".to_string(),
            name: "arXiv Preprints".to_string(),
            domain: "arxiv.org".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://arxiv.org/help/robots".to_string(),
            policy_notes: "Public website search permitted at conservative request rate (3s interval). Highwire and visible metadata extracted from HTML.".to_string(),
            supports_native_years: false,
            request_delay_ms: 3000,
            content_types: vec!["preprint".to_string()],
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
            rate_limit_ms: 3000,
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
                c if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' => c,
                _ => '+',
            })
            .collect();

        let start_url = format!(
            "https://arxiv.org/search/?query={}&searchtype=all&source=header",
            encoded_q
        );

        Ok(SearchPlan {
            source_id: "arxiv".to_string(),
            start_url,
            query: query.query.clone(),
            allowed_domain: "arxiv.org".to_string(),
            max_pages: query.limit_per_source.unwrap_or(50).clamp(1, 100),
            max_depth: 2,
            delay_ms: 3000,
            pagination_strategy: PaginationStrategy::FollowNextLink {
                selector: "a.pagination-next".to_string(),
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, _page_url: &str) -> Vec<DiscoveredSearchResult> {
        Self::parse_arxiv_html(html)
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

        let encoded_q: String = query
            .query
            .chars()
            .map(|c| match c {
                ' ' => '+',
                c if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' => c,
                _ => '+',
            })
            .collect();

        let limit = query.limit_per_source.unwrap_or(50);
        let size_param = if limit > 50 {
            "&size=100"
        } else if limit > 25 {
            "&size=50"
        } else {
            ""
        };

        let search_url = format!(
            "https://arxiv.org/search/?query={}&searchtype=all&source=header{}",
            encoded_q, size_param
        );

        let validated_url = UrlGuard::validate_url(&search_url)
            .map_err(|e| format!("Anti-SSRF blocked arXiv URL: {e}"))?;

        info!(url = %validated_url, "Querying arXiv website search");

        let resp = client
            .get(validated_url.as_str())
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            )
            .header("Accept", "text/html,application/xhtml+xml")
            .send()
            .await
            .map_err(|e| format!("Failed to reach arXiv server: {e}"))?;

        if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(
                "arXiv rate limit reached (HTTP 429). Please wait before querying again."
                    .to_string(),
            );
        }
        if !resp.status().is_success() {
            return Err(format!(
                "arXiv responded with HTTP status {}",
                resp.status()
            ));
        }

        let body = CrawlEngine::read_response_body_bounded(resp)
            .await
            .map_err(|e| format!("Failed reading arXiv response body: {e}"))?;

        let results = Self::parse_arxiv_html(&body);
        let truncated = results.into_iter().take(limit).collect();
        Ok(truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ARXIV_SAMPLE_HTML: &str = r#"
    <ol class="breathe-horizontal">
      <li class="arxiv-result">
        <p class="list-title is-inline-block"><a href="https://arxiv.org/abs/2301.00001">arXiv:2301.00001</a> [pdf]</p>
        <p class="title is-5 mathjax">Title: Deep Reinforcement Learning for Robotic Navigation in Complex Environments</p>
        <p class="authors">Authors: <a href="/search/?searchtype=author">Alice Walker</a>, <a href="/search/?searchtype=author">Bob Smith</a></p>
        <p class="abstract mathjax"><span class="abstract-full">Autonomous robotic navigation in dense, dynamic environments requires robust real-time decision making...</span></p>
        <p class="is-size-7">Submitted 15 January, 2023; originally announced January 2023.</p>
        <span class="tag is-small">cs.RO</span>
        <span class="tag is-small">cs.AI</span>
      </li>
    </ol>
    "#;

    #[test]
    fn test_parse_arxiv_html_fixture() {
        let results = ArxivAdapter::parse_arxiv_html(ARXIV_SAMPLE_HTML);
        assert_eq!(results.len(), 1);
        let p = &results[0];
        assert_eq!(
            p.title,
            "Deep Reinforcement Learning for Robotic Navigation in Complex Environments"
        );
        assert_eq!(p.authors, vec!["Alice Walker", "Bob Smith"]);
        assert_eq!(p.landing_url, "https://arxiv.org/abs/2301.00001");
        assert_eq!(
            p.pdf_url,
            Some("https://arxiv.org/pdf/2301.00001.pdf".to_string())
        );
        assert_eq!(p.publication_year, Some(2023));
        assert!(p.is_open_access);
    }
}
