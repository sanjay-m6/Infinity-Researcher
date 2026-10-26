use async_trait::async_trait;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use tracing::debug;
use url::Url;

use crate::academic_sources::adapter::{AcademicSourceAdapter, AdapterSearchResult};
use crate::academic_sources::errors::AcademicError;
use crate::academic_sources::types::{
    AcademicSearchQuery, NormalizedAuthor, NormalizedWork, ProviderCapabilities, ProviderId,
    ProviderProvenance,
};
use crate::domain::paper::{compute_clean_title_key, normalize_doi};

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
}

/// Normalizes whitespace in raw arXiv titles and abstracts (which often have line breaks from LaTeX).
fn clean_arxiv_text(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Parses an Atom 1.0 XML feed from arXiv into a list of normalized works.
pub fn parse_arxiv_atom_feed(xml_str: &str) -> Result<Vec<NormalizedWork>, AcademicError> {
    let mut reader = Reader::from_str(xml_str);
    reader.config_mut().trim_text(true);

    let mut works = Vec::new();
    let mut in_entry = false;
    let mut current_tag = String::new();
    let mut in_author = false;

    // Temporary entry buffers
    let mut entry_id = String::new();
    let mut entry_title = String::new();
    let mut entry_summary = String::new();
    let mut entry_published = String::new();
    let mut entry_doi = Option::<String>::None;
    let mut entry_pdf_url = Option::<String>::None;
    let mut entry_landing_url = Option::<String>::None;
    let mut entry_authors = Vec::<NormalizedAuthor>::new();
    let mut current_author_name = String::new();

    let retrieved_at = chrono::Utc::now().to_rfc3339();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                if tag_name == "entry" {
                    in_entry = true;
                    entry_id.clear();
                    entry_title.clear();
                    entry_summary.clear();
                    entry_published.clear();
                    entry_doi = None;
                    entry_pdf_url = None;
                    entry_landing_url = None;
                    entry_authors.clear();
                } else if in_entry && tag_name == "author" {
                    in_author = true;
                    current_author_name.clear();
                }
                current_tag = tag_name;
            }
            Ok(Event::Empty(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                if in_entry && tag_name == "link" {
                    let mut href = None;
                    let mut is_pdf = false;
                    let mut is_alternate = false;

                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_lowercase();
                        let val = String::from_utf8_lossy(&attr.value).to_string();
                        if key == "href" {
                            href = Some(val);
                        } else if (key == "title" && val.to_lowercase() == "pdf")
                            || (key == "type" && val.contains("pdf"))
                        {
                            is_pdf = true;
                        } else if key == "rel" && val == "alternate" {
                            is_alternate = true;
                        }
                    }

                    if is_pdf && href.is_some() {
                        entry_pdf_url = href;
                    } else if is_alternate && href.is_some() {
                        entry_landing_url = href;
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_entry {
                    let text = e.unescape().map(|c| c.to_string()).unwrap_or_default();
                    match current_tag.as_str() {
                        "id" => entry_id.push_str(&text),
                        "title" => entry_title.push_str(&text),
                        "summary" => entry_summary.push_str(&text),
                        "published" => entry_published.push_str(&text),
                        "arxiv:doi" | "doi" => entry_doi = Some(text.trim().to_string()),
                        "name" if in_author => current_author_name.push_str(&text),
                        _ => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                if tag_name == "author" && in_author {
                    let name = clean_arxiv_text(&current_author_name);
                    if !name.is_empty() {
                        entry_authors.push(NormalizedAuthor {
                            name,
                            orcid: None,
                            affiliation: None,
                        });
                    }
                    in_author = false;
                } else if tag_name == "entry" && in_entry {
                    in_entry = false;
                    let title = clean_arxiv_text(&entry_title);
                    if !title.is_empty() {
                        let clean_title_key = compute_clean_title_key(&title);
                        let canonical_doi = entry_doi.as_deref().and_then(normalize_doi);

                        let publication_date = if entry_published.len() >= 10 {
                            Some(entry_published[0..10].to_string())
                        } else {
                            None
                        };

                        let publication_year = publication_date
                            .as_ref()
                            .and_then(|d| d[0..4].parse::<i32>().ok());

                        // Canonical arXiv landing page
                        let raw_id = entry_id.trim();
                        let arxiv_record_id = raw_id
                            .strip_prefix("http://arxiv.org/abs/")
                            .or_else(|| raw_id.strip_prefix("https://arxiv.org/abs/"))
                            .unwrap_or(raw_id)
                            .to_string();

                        let landing_url = entry_landing_url
                            .clone()
                            .or_else(|| Some(format!("https://arxiv.org/abs/{}", arxiv_record_id)));

                        let pdf_url = entry_pdf_url.clone().or_else(|| {
                            Some(format!("https://arxiv.org/pdf/{}.pdf", arxiv_record_id))
                        });

                        let abstract_text = clean_arxiv_text(&entry_summary);
                        let abstract_opt = if abstract_text.is_empty() {
                            None
                        } else {
                            Some(abstract_text)
                        };

                        works.push(NormalizedWork {
                            id: format!("arxiv-{}", arxiv_record_id.replace('/', "_")),
                            canonical_doi,
                            title,
                            clean_title_key,
                            abstract_text: abstract_opt,
                            publication_date,
                            publication_year,
                            venue: Some("arXiv".to_string()),
                            venue_type: Some("preprint".to_string()),
                            authors: entry_authors.clone(),
                            is_open_access: true, // arXiv is 100% open access preprint
                            landing_url: landing_url.clone(),
                            pdf_url,
                            citation_count: None, // arXiv Atom feeds do not track citation counts
                            provider_id: ProviderId::Arxiv,
                            provider_record_id: arxiv_record_id.clone(),
                            provenance: vec![ProviderProvenance {
                                provider_id: ProviderId::Arxiv,
                                record_id: arxiv_record_id,
                                landing_url,
                                retrieved_at: retrieved_at.clone(),
                            }],
                        });
                    }
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AcademicError::ParseError(format!("XML parse error: {}", e)));
            }
            _ => {}
        }
    }

    Ok(works)
}

#[async_trait]
impl AcademicSourceAdapter for ArxivAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::Arxiv
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            provider_id: ProviderId::Arxiv,
            display_name: "arXiv".to_string(),
            description: "Open-access archive for 2+ million preprints in physics, math, and computer science".to_string(),
            documentation_url: "https://arxiv.org/help/api/user-manual".to_string(),
            supports_year_filter: false, // arXiv API search_query syntax does not have a clean year range filter without complex boolean terms
            supports_open_access_filter: false, // All arXiv preprints are open access by definition
            supports_doi_lookup: true,
            supports_pagination: true,
            requires_api_key: false,
            rate_limit_rps: 0.33, // 1 request per 3 seconds
        }
    }

    async fn search(
        &self,
        client: &reqwest::Client,
        query: &AcademicSearchQuery,
        _api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError> {
        let mut url = Url::parse("https://export.arxiv.org/api/query")
            .map_err(|e| AcademicError::Network(format!("Invalid arXiv URL: {}", e)))?;

        let page = query.page.unwrap_or(1).max(1);
        let max_results = query.page_size.unwrap_or(20).clamp(1, 100);
        let start = (page - 1) * max_results;

        // arXiv search_query syntax: e.g. "all:attention"
        let clean_q = query.query.trim().replace('"', "");
        let search_query = format!("all:{}", clean_q);

        url.query_pairs_mut()
            .append_pair("search_query", &search_query)
            .append_pair("start", &start.to_string())
            .append_pair("max_results", &max_results.to_string())
            .append_pair("sortBy", "relevance")
            .append_pair("sortOrder", "descending");

        debug!(url = %url, "Issuing arXiv search request");

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
                retry_after_secs: Some(10),
            });
        }
        if !status.is_success() {
            return Err(AcademicError::Unavailable(format!(
                "arXiv returned HTTP status {}",
                status
            )));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| AcademicError::Network(e.to_string()))?;

        let works = parse_arxiv_atom_feed(&body_text)?;

        let next_cursor = if works.len() == max_results as usize {
            Some((page + 1).to_string())
        } else {
            None
        };

        Ok(AdapterSearchResult {
            works,
            next_cursor,
            total_results: None, // arXiv does not provide total match count in standard Atom feeds
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_arxiv_atom_feed_from_fixture() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
          <entry>
            <id>http://arxiv.org/abs/1706.03762v7</id>
            <published>2017-06-12T17:57:34Z</published>
            <title>
              Attention Is All You Need
            </title>
            <summary>
              The dominant sequence transduction models are based on complex recurrent or
              convolutional neural networks.
            </summary>
            <author>
              <name>Ashish Vaswani</name>
            </author>
            <author>
              <name>Noam Shazeer</name>
            </author>
            <arxiv:doi>10.48550/arXiv.1706.03762</arxiv:doi>
            <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
          </entry>
        </feed>"#;

        let works = parse_arxiv_atom_feed(xml).expect("parse failed");
        assert_eq!(works.len(), 1);
        let work = &works[0];
        assert_eq!(work.title, "Attention Is All You Need");
        assert_eq!(work.provider_record_id, "1706.03762v7");
        assert_eq!(
            work.canonical_doi.as_deref(),
            Some("10.48550/arxiv.1706.03762")
        );
        assert_eq!(work.authors.len(), 2);
        assert_eq!(work.authors[0].name, "Ashish Vaswani");
        assert_eq!(work.publication_year, Some(2017));
        assert!(work.is_open_access);
        assert_eq!(
            work.pdf_url.as_deref(),
            Some("http://arxiv.org/pdf/1706.03762v7")
        );
    }
}
