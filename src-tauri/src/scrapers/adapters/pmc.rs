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

pub struct PmcAdapter;

impl Default for PmcAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl PmcAdapter {
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
}

#[async_trait]
impl SourceAdapter for PmcAdapter {
    fn source_id(&self) -> &'static str {
        "pmc"
    }

    fn display_name(&self) -> &'static str {
        "PubMed Central (PMC)"
    }

    fn descriptor(&self) -> WebsiteSourceDescriptor {
        WebsiteSourceDescriptor {
            id: "pmc".to_string(),
            name: "PubMed Central (PMC)".to_string(),
            domain: "pmc.ncbi.nlm.nih.gov".to_string(),
            status: "enabled".to_string(),
            policy_url: "https://pmc.ncbi.nlm.nih.gov/about/copyright/".to_string(),
            policy_notes: "Public biomedical and life sciences repository. Automated searching via public HTML pages permitted with polite request limits.".to_string(),
            supports_native_years: false,
            request_delay_ms: 2000,
            content_types: vec!["journal_article".to_string(), "review".to_string()],
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
            rate_limit_ms: 2000,
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
            source_id: "pmc".to_string(),
            start_url: format!("https://pmc.ncbi.nlm.nih.gov/search/?term={}", encoded_q),
            query: query.query.clone(),
            allowed_domain: "pmc.ncbi.nlm.nih.gov".to_string(),
            max_pages: query.limit_per_source.unwrap_or(50).clamp(1, 100),
            max_depth: 1,
            delay_ms: 2000,
            pagination_strategy: PaginationStrategy::QueryOffset {
                param_name: "page".to_string(),
                step: 1,
            },
        })
    }

    fn extract_papers_from_html(&self, html: &str, page_url: &str) -> Vec<DiscoveredSearchResult> {
        let preview = HtmlExtractor::extract(html, page_url, None);
        if let Some(title) = preview.title {
            if !title.is_empty() {
                let id = format!("pmc_{}", uuid::Uuid::new_v4().simple());
                return vec![DiscoveredSearchResult {
                    id,
                    title,
                    authors: preview.authors,
                    publication_date: preview.publication_date,
                    publication_year: None,
                    venue: preview.venue.or(Some("PubMed Central (PMC)".to_string())),
                    canonical_doi: preview.canonical_doi,
                    abstract_text: preview.abstract_text,
                    landing_url: page_url.to_string(),
                    pdf_url: preview.pdf_url,
                    source_id: "pmc".to_string(),
                    source_name: "PubMed Central (PMC)".to_string(),
                    content_type: "journal_article".to_string(),
                    is_open_access: true,
                    license_name: Some("Open Access (PMC)".to_string()),
                    peer_reviewed: Some(true),
                    subject_tags: vec!["Biomedical".to_string(), "PMC".to_string()],
                    language: Some("en".to_string()),
                    relevance_score: 1.0,
                    provenance_urls: vec![page_url.to_string()],
                    metadata_confidence: Some(0.95),
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
        let epmc_query = format!(
            r#"OPEN_ACCESS:Y AND (SRC:MED OR SRC:PMC) AND ({})"#,
            query.query.trim()
        );

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

        let validated_url = UrlGuard::validate_url(&url_str)
            .map_err(|e| format!("Anti-SSRF blocked Europe PMC URL: {e}"))?;

        info!(url = %validated_url, "Querying PubMed Central via Europe PMC index");

        let resp = client
            .get(validated_url.as_str())
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            )
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Failed reaching Europe PMC for PMC: {e}"))?;

        if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err("Europe PMC rate limit reached (HTTP 429).".to_string());
        }
        if !resp.status().is_success() {
            return Err(format!(
                "PMC search returned HTTP status: {}",
                resp.status()
            ));
        }

        let body = CrawlEngine::read_response_body_bounded(resp)
            .await
            .map_err(|e| format!("Failed reading PMC response body: {e}"))?;

        let val: serde_json::Value = serde_json::from_str(&body)
            .map_err(|e| format!("Failed parsing PMC JSON response: {e}"))?;

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
                    vec!["PMC Author".to_string()]
                };

            let pub_year = item["pubYear"].as_str().and_then(|y| y.parse::<i32>().ok());
            let pub_date = pub_year.map(|y| format!("{y}-01-01"));
            let doi = item["doi"].as_str().map(|d| d.trim().to_string());

            let abstract_text = item["abstractText"]
                .as_str()
                .map(Self::strip_html_tags)
                .filter(|a| !a.is_empty());

            let pmcid = item["pmcid"].as_str().map(|p| p.trim().to_string());

            let landing_url = if let Some(ref d) = doi {
                format!("https://doi.org/{d}")
            } else if let Some(ref p) = pmcid {
                format!("https://europepmc.org/article/PMC/{p}")
            } else {
                let id = item["id"].as_str().unwrap_or("");
                format!("https://europepmc.org/article/MED/{id}")
            };

            let pdf_url = pmcid.as_ref().map(|p| {
                format!("https://europepmc.org/backend/ptpmcrender.fcgi?accid={p}&blobtype=pdf")
            });

            let venue = item["journalTitle"]
                .as_str()
                .map(|j| j.trim().to_string())
                .or_else(|| Some("PubMed Central".to_string()));

            let id = format!(
                "pmc_{}",
                pmcid
                    .as_deref()
                    .or(doi.as_deref())
                    .unwrap_or("doc")
                    .replace('/', "_")
            );

            results.push(DiscoveredSearchResult {
                id,
                title,
                authors,
                publication_date: pub_date,
                publication_year: pub_year,
                venue,
                canonical_doi: doi,
                abstract_text,
                landing_url: landing_url.clone(),
                pdf_url,
                source_id: "pmc".to_string(),
                source_name: "PubMed Central (PMC)".to_string(),
                content_type: "journal_article".to_string(),
                is_open_access: true,
                license_name: Some("Open Access / Public PMC".to_string()),
                peer_reviewed: Some(true),
                subject_tags: vec!["Biomedical".to_string(), "PMC".to_string()],
                language: Some("en".to_string()),
                relevance_score: 1.0,
                provenance_urls: vec![landing_url],
                metadata_confidence: Some(1.0),
            });
        }

        Ok(results)
    }
}
