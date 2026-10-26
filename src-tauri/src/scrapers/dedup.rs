use crate::scrapers::types::DiscoveredSearchResult;
use std::collections::HashMap;

/// Cleans and normalizes DOI strings: removes URL prefixes (https://doi.org/, dx.doi.org, doi:),
/// trims whitespace and trailing punctuation, and lowercases.
pub fn normalize_doi(doi: &str) -> String {
    let clean = doi.trim();
    let lower = clean.to_lowercase();
    let stripped = if let Some(pos) = lower.find("10.") {
        &clean[pos..]
    } else {
        clean
    };
    stripped
        .trim_end_matches(['.', ';', '/', ' '])
        .to_lowercase()
}

/// Normalizes titles for fuzzy/phonetic comparison: strips punctuation, extra whitespace, and lowercases.
pub fn normalize_title(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Computes an explainable, deterministic relevance score for a discovered paper relative to user query.
pub fn compute_relevance_score(paper: &DiscoveredSearchResult, query_text: &str) -> f32 {
    let clean_query = query_text.trim().to_lowercase();
    if clean_query.is_empty() {
        return 1.0;
    }

    let query_terms: Vec<&str> = clean_query
        .split_whitespace()
        .filter(|w| w.len() > 2)
        .collect();

    if query_terms.is_empty() {
        return 1.0;
    }

    let title_lower = paper.title.to_lowercase();
    let abstract_lower = paper.abstract_text.as_deref().unwrap_or("").to_lowercase();

    let mut score = 0.5f32;

    // Exact full query match in title
    if title_lower.contains(&clean_query) {
        score += 3.0;
    }

    // Exact full query match in abstract
    if !abstract_lower.is_empty() && abstract_lower.contains(&clean_query) {
        score += 1.5;
    }

    // Term-by-term overlap
    let mut title_term_matches = 0;
    let mut abstract_term_matches = 0;

    for term in &query_terms {
        if title_lower.contains(term) {
            title_term_matches += 1;
        }
        if abstract_lower.contains(term) {
            abstract_term_matches += 1;
        }
    }

    score += (title_term_matches as f32 / query_terms.len() as f32) * 2.0;
    score += (abstract_term_matches as f32 / query_terms.len() as f32) * 1.0;

    // DOI presence boost (verified scholarly publication)
    if paper.canonical_doi.is_some() {
        score += 0.5;
    }

    // Direct PDF availability boost
    if paper.pdf_url.is_some() {
        score += 0.5;
    }

    // Open access evidence boost
    if paper.is_open_access {
        score += 0.3;
    }

    // Recency bonus: within last 5 years
    if let Some(year) = paper.publication_year {
        if year >= 2024 {
            score += 0.4;
        } else if year >= 2020 {
            score += 0.2;
        }
    }

    score
}

/// Deduplicates discovered paper records across multiple sources while strictly preserving provenance.
/// If duplicate records are found:
/// - Canonical DOI is merged
/// - All discovery URLs and source identifiers are recorded in `provenance_urls`
/// - Richest metadata (authors, abstract, PDF URL, license) is retained
/// - Results are sorted deterministically by relevance score descending
pub fn deduplicate_and_rank_results(
    mut papers: Vec<DiscoveredSearchResult>,
    query: &str,
) -> Vec<DiscoveredSearchResult> {
    // 1. First compute relevance scores
    for paper in &mut papers {
        paper.relevance_score = compute_relevance_score(paper, query);
        if paper.provenance_urls.is_empty() && !paper.landing_url.is_empty() {
            paper.provenance_urls.push(paper.landing_url.clone());
        }
    }

    let mut merged: Vec<DiscoveredSearchResult> = Vec::new();
    let mut doi_to_idx: HashMap<String, usize> = HashMap::new();
    let mut title_year_to_idx: HashMap<(String, Option<i32>), usize> = HashMap::new();

    for paper in papers {
        let normalized_doi_opt = paper.canonical_doi.as_deref().map(normalize_doi);
        let normalized_title = normalize_title(&paper.title);
        let year = paper.publication_year;

        // Check for existing record by DOI
        let existing_idx = if let Some(ref d) = normalized_doi_opt {
            if !d.is_empty() {
                doi_to_idx.get(d).copied()
            } else {
                None
            }
        } else {
            None
        };

        // If not found by DOI, check by strong normalized title + publication year
        let existing_idx = existing_idx.or_else(|| {
            if normalized_title.len() > 15 {
                title_year_to_idx
                    .get(&(normalized_title.clone(), year))
                    .copied()
            } else {
                None
            }
        });

        if let Some(idx) = existing_idx {
            let existing = &mut merged[idx];

            // Preserve provenance: append landing URL if not already present
            if !paper.landing_url.is_empty()
                && !existing.provenance_urls.contains(&paper.landing_url)
            {
                existing.provenance_urls.push(paper.landing_url.clone());
            }

            // Fill missing canonical DOI
            if existing.canonical_doi.is_none() && paper.canonical_doi.is_some() {
                existing.canonical_doi = paper.canonical_doi;
            }

            // Retain PDF URL if existing did not have one
            if existing.pdf_url.is_none() && paper.pdf_url.is_some() {
                existing.pdf_url = paper.pdf_url;
            }

            // Retain richer abstract
            if existing.abstract_text.as_deref().unwrap_or("").len()
                < paper.abstract_text.as_deref().unwrap_or("").len()
            {
                existing.abstract_text = paper.abstract_text;
            }

            // Combine authors if missing or shorter
            if existing.authors.len() < paper.authors.len() && !paper.authors.is_empty() {
                existing.authors = paper.authors;
            }

            // Keep max relevance score
            if paper.relevance_score > existing.relevance_score {
                existing.relevance_score = paper.relevance_score;
            }

            // Open access upgrade if any source verified it
            if paper.is_open_access {
                existing.is_open_access = true;
            }
        } else {
            let new_idx = merged.len();
            if let Some(ref d) = normalized_doi_opt {
                if !d.is_empty() {
                    doi_to_idx.insert(d.clone(), new_idx);
                }
            }
            if normalized_title.len() > 15 {
                title_year_to_idx.insert((normalized_title, year), new_idx);
            }
            merged.push(paper);
        }
    }

    // Sort deterministically: highest relevance score first, then newest year first
    merged.sort_by(|a, b| {
        b.relevance_score
            .partial_cmp(&a.relevance_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.publication_year.cmp(&a.publication_year))
    });

    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_doi_variations() {
        assert_eq!(
            normalize_doi("10.1038/s41598-024-001"),
            "10.1038/s41598-024-001"
        );
        assert_eq!(
            normalize_doi("https://doi.org/10.1038/s41598-024-001"),
            "10.1038/s41598-024-001"
        );
        assert_eq!(
            normalize_doi("http://dx.doi.org/10.1038/s41598-024-001."),
            "10.1038/s41598-024-001"
        );
        assert_eq!(
            normalize_doi("doi:10.1038/S41598-024-001"),
            "10.1038/s41598-024-001"
        );
    }

    #[test]
    fn test_deduplicate_and_preserve_provenance() {
        let p1 = DiscoveredSearchResult {
            id: "src1_01".to_string(),
            title: "Attention Is All You Need".to_string(),
            authors: vec!["Ashish Vaswani".to_string()],
            publication_date: Some("2017-06-12".to_string()),
            publication_year: Some(2017),
            venue: Some("arXiv".to_string()),
            canonical_doi: Some("10.48550/arXiv.1706.03762".to_string()),
            abstract_text: Some("The dominant sequence models...".to_string()),
            landing_url: "https://arxiv.org/abs/1706.03762".to_string(),
            pdf_url: Some("https://arxiv.org/pdf/1706.03762.pdf".to_string()),
            source_id: "arxiv".to_string(),
            source_name: "arXiv Preprints".to_string(),
            content_type: "preprint".to_string(),
            is_open_access: true,
            license_name: None,
            peer_reviewed: Some(false),
            subject_tags: vec![],
            language: Some("en".to_string()),
            relevance_score: 0.0,
            provenance_urls: vec!["https://arxiv.org/abs/1706.03762".to_string()],
            metadata_confidence: None,
        };

        let p2 = DiscoveredSearchResult {
            id: "src2_01".to_string(),
            title: "Attention Is All You Need".to_string(),
            authors: vec!["A. Vaswani".to_string(), "Noam Shazeer".to_string()],
            publication_date: Some("2017-06-12".to_string()),
            publication_year: Some(2017),
            venue: Some("NeurIPS 2017".to_string()),
            canonical_doi: Some("10.48550/arxiv.1706.03762".to_string()),
            abstract_text: Some("The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...".to_string()),
            landing_url: "https://europepmc.org/article/MED/12345".to_string(),
            pdf_url: None,
            source_id: "pmc".to_string(),
            source_name: "PubMed Central".to_string(),
            content_type: "conference_paper".to_string(),
            is_open_access: true,
            license_name: None,
            peer_reviewed: Some(true),
            subject_tags: vec![],
            language: Some("en".to_string()),
            relevance_score: 0.0,
            provenance_urls: vec!["https://europepmc.org/article/MED/12345".to_string()],
            metadata_confidence: None,
        };

        let merged = deduplicate_and_rank_results(vec![p1, p2], "attention");
        assert_eq!(merged.len(), 1);
        let m = &merged[0];
        assert_eq!(
            m.canonical_doi,
            Some("10.48550/arXiv.1706.03762".to_string())
        );
        assert_eq!(
            m.pdf_url,
            Some("https://arxiv.org/pdf/1706.03762.pdf".to_string())
        );
        assert_eq!(m.provenance_urls.len(), 2);
        assert!(m
            .provenance_urls
            .contains(&"https://arxiv.org/abs/1706.03762".to_string()));
        assert!(m
            .provenance_urls
            .contains(&"https://europepmc.org/article/MED/12345".to_string()));
        assert_eq!(m.authors.len(), 2);
    }
}
