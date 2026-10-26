use crate::domain::crawl::{CrawlProfile, ExtractionPreviewResult};
use crate::scrapers::url_guard::UrlGuard;
use scraper::{Html, Selector};
use std::collections::HashMap;
use url::Url;

pub struct HtmlExtractor;

impl HtmlExtractor {
    /// Extracts structured scholarly metadata and discovered paper links from an HTML document.
    pub fn extract(
        html_content: &str,
        base_url_str: &str,
        profile: Option<&CrawlProfile>,
    ) -> ExtractionPreviewResult {
        let base_url = Url::parse(base_url_str).ok();
        let document = Html::parse_document(html_content);

        let mut meta_tags: HashMap<String, String> = HashMap::new();
        let mut meta_authors: Vec<String> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();
        let mut methods_used: Vec<String> = Vec::new();

        // --------------------------------------------------------------------
        // 1. Collect all <meta> tags
        // --------------------------------------------------------------------
        if let Ok(meta_sel) = Selector::parse("meta") {
            for element in document.select(&meta_sel) {
                let name = element
                    .value()
                    .attr("name")
                    .or_else(|| element.value().attr("property"))
                    .or_else(|| element.value().attr("itemprop"));

                let content = element.value().attr("content");

                if let (Some(n), Some(c)) = (name, content) {
                    let key = n.trim().to_lowercase();
                    let val = c.trim().to_string();

                    if !val.is_empty() {
                        if key == "citation_author"
                            || key == "dc.creator"
                            || key == "dc.contributor"
                            || key == "author"
                        {
                            meta_authors.push(val.clone());
                        }
                        meta_tags.insert(key, val);
                    }
                }
            }
        }

        let mut title: Option<String> = None;
        let mut authors: Vec<String> = Vec::new();
        let mut abstract_text: Option<String> = None;
        let mut canonical_doi: Option<String> = None;
        let mut publication_date: Option<String> = None;
        let mut venue: Option<String> = None;
        let mut pdf_url: Option<String> = None;

        let use_meta = profile.map(|p| p.use_meta_tags).unwrap_or(true);

        // --------------------------------------------------------------------
        // 2. Highwire Press Meta Tags (Gold standard for academic journals)
        // --------------------------------------------------------------------
        if use_meta {
            let mut highwire_used = false;

            if let Some(t) = meta_tags.get("citation_title") {
                title = Some(Self::clean_text(t));
                highwire_used = true;
            }

            if !meta_authors.is_empty() {
                authors = meta_authors.clone();
                highwire_used = true;
            }

            if let Some(doi) = meta_tags.get("citation_doi") {
                canonical_doi = Some(Self::clean_doi(doi));
                highwire_used = true;
            }

            if let Some(date) = meta_tags
                .get("citation_publication_date")
                .or_else(|| meta_tags.get("citation_date"))
                .or_else(|| meta_tags.get("citation_online_date"))
            {
                publication_date = Some(date.clone());
                highwire_used = true;
            }

            if let Some(j) = meta_tags
                .get("citation_journal_title")
                .or_else(|| meta_tags.get("citation_conference_title"))
                .or_else(|| meta_tags.get("citation_publisher"))
            {
                venue = Some(j.clone());
                highwire_used = true;
            }

            if let Some(pdf) = meta_tags.get("citation_pdf_url") {
                if let Some(ref base) = base_url {
                    pdf_url = UrlGuard::resolve_link(base, pdf);
                } else {
                    pdf_url = Some(pdf.clone());
                }
                highwire_used = true;
            }

            if highwire_used {
                methods_used.push("highwire_press_meta".to_string());
            }

            // ----------------------------------------------------------------
            // 3. Dublin Core Fallbacks
            // ----------------------------------------------------------------
            let mut dc_used = false;

            if title.is_none() {
                if let Some(t) = meta_tags
                    .get("dc.title")
                    .or_else(|| meta_tags.get("dcterms.title"))
                {
                    title = Some(Self::clean_text(t));
                    dc_used = true;
                }
            }

            if abstract_text.is_none() {
                if let Some(a) = meta_tags
                    .get("dc.description")
                    .or_else(|| meta_tags.get("dcterms.abstract"))
                    .or_else(|| meta_tags.get("description"))
                    .or_else(|| meta_tags.get("og:description"))
                {
                    abstract_text = Some(Self::clean_text(a));
                    dc_used = true;
                }
            }

            if canonical_doi.is_none() {
                if let Some(id) = meta_tags.get("dc.identifier") {
                    if id.starts_with("10.") || id.to_lowercase().starts_with("doi:") {
                        canonical_doi = Some(Self::clean_doi(id));
                        dc_used = true;
                    }
                }
            }

            if publication_date.is_none() {
                if let Some(d) = meta_tags
                    .get("dc.date")
                    .or_else(|| meta_tags.get("dcterms.issued"))
                {
                    publication_date = Some(d.clone());
                    dc_used = true;
                }
            }

            if venue.is_none() {
                if let Some(s) = meta_tags.get("dc.source") {
                    venue = Some(s.clone());
                    dc_used = true;
                }
            }

            if dc_used {
                methods_used.push("dublin_core_meta".to_string());
            }
        }

        // --------------------------------------------------------------------
        // 4. Schema.org JSON-LD parsing
        // --------------------------------------------------------------------
        if let Ok(script_sel) = Selector::parse(r#"script[type="application/ld+json"]"#) {
            let mut json_ld_used = false;
            for script_el in document.select(&script_sel) {
                let inner_text = script_el.text().collect::<String>();
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&inner_text) {
                    let objects = match json {
                        serde_json::Value::Array(arr) => arr,
                        serde_json::Value::Object(_) => vec![json],
                        _ => Vec::new(),
                    };

                    for obj in objects {
                        let type_str = obj.get("@type").and_then(|t| t.as_str()).unwrap_or("");
                        if type_str.contains("ScholarlyArticle")
                            || type_str.contains("Article")
                            || type_str.contains("TechArticle")
                            || type_str.contains("MedicalScholarlyArticle")
                        {
                            if title.is_none() {
                                if let Some(t) = obj
                                    .get("headline")
                                    .or_else(|| obj.get("name"))
                                    .and_then(|v| v.as_str())
                                {
                                    title = Some(Self::clean_text(t));
                                    json_ld_used = true;
                                }
                            }
                            if abstract_text.is_none() {
                                if let Some(a) = obj.get("description").and_then(|v| v.as_str()) {
                                    abstract_text = Some(Self::clean_text(a));
                                    json_ld_used = true;
                                }
                            }
                            if authors.is_empty() {
                                if let Some(auth_val) = obj.get("author") {
                                    let mut parsed_authors = Vec::new();
                                    if let Some(arr) = auth_val.as_array() {
                                        for a in arr {
                                            if let Some(name) =
                                                a.get("name").and_then(|n| n.as_str())
                                            {
                                                parsed_authors.push(name.to_string());
                                            } else if let Some(name) = a.as_str() {
                                                parsed_authors.push(name.to_string());
                                            }
                                        }
                                    } else if let Some(name) =
                                        auth_val.get("name").and_then(|n| n.as_str())
                                    {
                                        parsed_authors.push(name.to_string());
                                    }
                                    if !parsed_authors.is_empty() {
                                        authors = parsed_authors;
                                        json_ld_used = true;
                                    }
                                }
                            }
                            if publication_date.is_none() {
                                if let Some(d) = obj.get("datePublished").and_then(|v| v.as_str()) {
                                    publication_date = Some(d.to_string());
                                    json_ld_used = true;
                                }
                            }
                            if canonical_doi.is_none() {
                                if let Some(id) = obj.get("identifier").and_then(|v| v.as_str()) {
                                    if id.contains("10.") {
                                        canonical_doi = Some(Self::clean_doi(id));
                                        json_ld_used = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if json_ld_used {
                methods_used.push("json_ld".to_string());
            }
        }

        // --------------------------------------------------------------------
        // 5. CSS Selectors (from CrawlProfile if specified)
        // --------------------------------------------------------------------
        if let Some(prof) = profile {
            let mut css_used = false;

            if let Some(ref sel_str) = prof.title_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        let text = el.text().collect::<String>();
                        if !text.trim().is_empty() {
                            title = Some(Self::clean_text(&text));
                            css_used = true;
                        }
                    }
                }
            }

            if let Some(ref sel_str) = prof.authors_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    let mut found_authors = Vec::new();
                    for el in document.select(&sel) {
                        let text = el.text().collect::<String>().trim().to_string();
                        if !text.is_empty() {
                            found_authors.push(text);
                        }
                    }
                    if !found_authors.is_empty() {
                        authors = found_authors;
                        css_used = true;
                    }
                }
            }

            if let Some(ref sel_str) = prof.abstract_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        let text = el.text().collect::<String>();
                        if !text.trim().is_empty() {
                            abstract_text = Some(Self::clean_text(&text));
                            css_used = true;
                        }
                    }
                }
            }

            if let Some(ref sel_str) = prof.doi_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        let text = el.text().collect::<String>();
                        if !text.trim().is_empty() {
                            canonical_doi = Some(Self::clean_doi(&text));
                            css_used = true;
                        }
                    }
                }
            }

            if let Some(ref sel_str) = prof.date_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        let text = el
                            .value()
                            .attr("datetime")
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| el.text().collect::<String>().trim().to_string());
                        if !text.is_empty() {
                            publication_date = Some(text);
                            css_used = true;
                        }
                    }
                }
            }

            if let Some(ref sel_str) = prof.venue_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        let text = el.text().collect::<String>().trim().to_string();
                        if !text.is_empty() {
                            venue = Some(text);
                            css_used = true;
                        }
                    }
                }
            }

            if let Some(ref sel_str) = prof.pdf_link_selector {
                if let Ok(sel) = Selector::parse(sel_str) {
                    if let Some(el) = document.select(&sel).next() {
                        if let Some(href) = el.value().attr("href") {
                            if let Some(ref base) = base_url {
                                pdf_url = UrlGuard::resolve_link(base, href);
                                css_used = true;
                            }
                        }
                    }
                }
            }

            if css_used {
                methods_used.push("custom_css_selectors".to_string());
            }
        }

        // --------------------------------------------------------------------
        // 6. Generic HTML Title Fallback (if still missing)
        // --------------------------------------------------------------------
        if title.is_none() {
            if let Ok(title_sel) = Selector::parse("title") {
                if let Some(el) = document.select(&title_sel).next() {
                    let text = el.text().collect::<String>();
                    if !text.trim().is_empty() {
                        title = Some(Self::clean_text(&text));
                        methods_used.push("html_title_fallback".to_string());
                    }
                }
            }
        }

        // --------------------------------------------------------------------
        // 7. Paper Link Discovery
        // --------------------------------------------------------------------
        let mut discovered_paper_links = Vec::new();
        if let Some(ref base) = base_url {
            let mut selectors = Vec::new();

            if let Some(prof) = profile {
                for s in &prof.paper_link_selectors {
                    if let Ok(parsed) = Selector::parse(s) {
                        selectors.push(parsed);
                    }
                }
            }

            // Default academic link patterns if no profile selectors provided
            if selectors.is_empty() {
                let default_selectors = [
                    r#"a[href*="/content/10."]"#,
                    r#"a[href*="/article/"]"#,
                    r#"a[href*="/abs/"]"#,
                    r#"a[href*="/doi/10."]"#,
                    r#"a.highwire-cite-linked-title"#,
                    r#"a[data-article-id]"#,
                ];
                for s in default_selectors {
                    if let Ok(parsed) = Selector::parse(s) {
                        selectors.push(parsed);
                    }
                }
            }

            let mut link_set = std::collections::HashSet::new();
            for sel in selectors {
                for el in document.select(&sel) {
                    if let Some(href) = el.value().attr("href") {
                        if let Some(resolved) = UrlGuard::resolve_link(base, href) {
                            // Verify link belongs to domain / patterns if profile exists
                            if let Some(prof) = profile {
                                if let Ok(parsed_resolved) = Url::parse(&resolved) {
                                    if UrlGuard::matches_domain(&parsed_resolved, &prof.domain)
                                        .is_ok()
                                        && UrlGuard::matches_patterns(
                                            &resolved,
                                            &prof.allowed_patterns,
                                            &prof.disallowed_patterns,
                                        )
                                        .is_ok()
                                    {
                                        link_set.insert(resolved);
                                    }
                                }
                            } else {
                                link_set.insert(resolved);
                            }
                        }
                    }
                }
            }

            discovered_paper_links = link_set.into_iter().collect();
            discovered_paper_links.sort();
        }

        // Validate findings and produce warnings
        if title.is_none() {
            warnings.push("No research paper title could be identified on this page.".to_string());
        }
        if canonical_doi.is_none() {
            warnings.push("No standard DOI identifier was detected.".to_string());
        }
        if authors.is_empty() {
            warnings.push("No author information was detected.".to_string());
        }

        ExtractionPreviewResult {
            url: base_url_str.to_string(),
            profile_id: profile.map(|p| p.id.clone()),
            title,
            authors,
            abstract_text,
            canonical_doi,
            publication_date,
            venue,
            pdf_url,
            discovered_paper_links,
            extraction_methods_used: methods_used,
            meta_tags_found: meta_tags,
            warnings,
        }
    }

    fn clean_text(s: &str) -> String {
        s.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn clean_doi(raw: &str) -> String {
        let trimmed = raw.trim();
        let cleaned = if let Some(stripped) = trimmed.strip_prefix("https://doi.org/") {
            stripped
        } else if let Some(stripped) = trimmed.strip_prefix("http://doi.org/") {
            stripped
        } else if let Some(stripped) = trimmed.strip_prefix("https://dx.doi.org/") {
            stripped
        } else if let Some(stripped) = trimmed.strip_prefix("http://dx.doi.org/") {
            stripped
        } else if let Some(stripped) = trimmed.strip_prefix("doi:") {
            stripped
        } else {
            trimmed
        };
        cleaned.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_BIORXIV_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>High-throughput genomic sequencing reveals novel transcriptional dynamics | bioRxiv</title>
    <meta name="citation_title" content="High-throughput genomic sequencing reveals novel transcriptional dynamics" />
    <meta name="citation_author" content="Jane Doe" />
    <meta name="citation_author" content="John Smith" />
    <meta name="citation_doi" content="10.1101/2026.03.15.589123" />
    <meta name="citation_publication_date" content="2026-03-15" />
    <meta name="citation_journal_title" content="bioRxiv" />
    <meta name="citation_pdf_url" content="https://www.biorxiv.org/content/10.1101/2026.03.15.589123v1.full.pdf" />
    <meta name="dc.description" content="We demonstrate single-cell RNA sequencing methods for high-precision transcriptional quantification." />
</head>
<body>
    <h1>Article Title</h1>
    <a href="/content/10.1101/2026.03.15.589123v1.full.pdf" class="pdf-link">Download PDF</a>
    <a href="/content/10.1101/2026.03.16.589124" class="highwire-cite-linked-title">Next Paper in Series</a>
</body>
</html>
"#;

    #[test]
    fn test_extract_highwire_press_metadata() {
        let result = HtmlExtractor::extract(
            SAMPLE_BIORXIV_HTML,
            "https://www.biorxiv.org/content/10.1101/2026.03.15.589123",
            None,
        );

        assert_eq!(
            result.title.as_deref(),
            Some("High-throughput genomic sequencing reveals novel transcriptional dynamics")
        );
        assert_eq!(result.authors, vec!["Jane Doe", "John Smith"]);
        assert_eq!(
            result.canonical_doi.as_deref(),
            Some("10.1101/2026.03.15.589123")
        );
        assert_eq!(result.publication_date.as_deref(), Some("2026-03-15"));
        assert_eq!(result.venue.as_deref(), Some("bioRxiv"));
        assert_eq!(
            result.pdf_url.as_deref(),
            Some("https://www.biorxiv.org/content/10.1101/2026.03.15.589123v1.full.pdf")
        );
        assert_eq!(
            result.abstract_text.as_deref(),
            Some("We demonstrate single-cell RNA sequencing methods for high-precision transcriptional quantification.")
        );
        assert!(result
            .extraction_methods_used
            .contains(&"highwire_press_meta".to_string()));
        assert!(result
            .discovered_paper_links
            .contains(&"https://www.biorxiv.org/content/10.1101/2026.03.16.589124".to_string()));
    }

    #[test]
    fn test_extract_json_ld_metadata() {
        let json_ld_html = r#"
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "ScholarlyArticle",
        "headline": "Advances in Quantum Neural Algorithms",
        "author": [{"@type": "Person", "name": "Alice Turing"}],
        "description": "A study of variational quantum circuits.",
        "datePublished": "2026-04-01",
        "identifier": "https://doi.org/10.1007/s11128-026-04100-x"
    }
    </script>
</head>
<body></body>
</html>
"#;

        let result = HtmlExtractor::extract(
            json_ld_html,
            "https://link.springer.com/article/10.1007/sample",
            None,
        );
        assert_eq!(
            result.title.as_deref(),
            Some("Advances in Quantum Neural Algorithms")
        );
        assert_eq!(result.authors, vec!["Alice Turing"]);
        assert_eq!(
            result.canonical_doi.as_deref(),
            Some("10.1007/s11128-026-04100-x")
        );
        assert_eq!(
            result.abstract_text.as_deref(),
            Some("A study of variational quantum circuits.")
        );
        assert!(result
            .extraction_methods_used
            .contains(&"json_ld".to_string()));
    }
}
