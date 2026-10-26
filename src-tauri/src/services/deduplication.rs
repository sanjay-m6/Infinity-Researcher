use crate::domain::paper::Paper;
use crate::services::metadata_normalizer::MetadataNormalizer;
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq)]
pub struct DeduplicationScore {
    pub score: f64,
    pub match_tier: String, // exact_match, high_confidence, review_required, distinct
    pub evidence: Vec<String>,
    pub can_auto_merge: bool,
}

pub struct DeduplicationEngine;

impl DeduplicationEngine {
    /// Threshold above which a candidate requires review
    pub const REVIEW_THRESHOLD: f64 = 0.65;
    /// Threshold above which high confidence is established (if no conflicts)
    pub const HIGH_CONFIDENCE_THRESHOLD: f64 = 0.90;

    /// Evaluates duplicate candidate signals between two Paper records:
    pub fn evaluate_pair(paper_a: &Paper, paper_b: &Paper) -> DeduplicationScore {
        let mut evidence = Vec::new();
        let mut score: f64 = 0.0;

        // 1. Stage A: Strong Identifiers (DOI)
        let norm_doi_a = paper_a
            .canonical_doi
            .as_deref()
            .and_then(MetadataNormalizer::normalize_doi);
        let norm_doi_b = paper_b
            .canonical_doi
            .as_deref()
            .and_then(MetadataNormalizer::normalize_doi);

        if let (Some(doi_a), Some(doi_b)) = (&norm_doi_a, &norm_doi_b) {
            if doi_a == doi_b {
                evidence.push(format!("Exact canonical DOI match: {}", doi_a));
                return DeduplicationScore {
                    score: 1.0,
                    match_tier: "exact_match".to_string(),
                    evidence,
                    can_auto_merge: true,
                };
            } else {
                evidence.push(format!(
                    "Conflicting DOIs detected: '{}' vs '{}'",
                    doi_a, doi_b
                ));
                // Conflicting DOIs strongly suggest distinct editions or different papers
                return DeduplicationScore {
                    score: 0.1,
                    match_tier: "distinct".to_string(),
                    evidence,
                    can_auto_merge: false,
                };
            }
        }

        // 2. Stage B: Content Digest / File Hash
        if let (Some(hash_a), Some(hash_b)) = (&paper_a.content_hash, &paper_b.content_hash) {
            if !hash_a.is_empty() && hash_a == hash_b {
                evidence.push(format!("Identical SHA-256 file content digest: {}", hash_a));
                score += 0.95;
            }
        }

        // 3. Stage C: Normalized Title Matching
        let title_key_a = MetadataNormalizer::compute_title_key(&paper_a.title);
        let title_key_b = MetadataNormalizer::compute_title_key(&paper_b.title);

        let title_similarity = Self::compute_title_similarity(&paper_a.title, &paper_b.title);

        if title_key_a == title_key_b && !title_key_a.is_empty() {
            evidence.push("Exact normalized title match".to_string());
            score += 0.60;
        } else if title_similarity >= 0.80 {
            evidence.push(format!(
                "High title token similarity: {:.0}%",
                title_similarity * 100.0
            ));
            score += 0.50 * title_similarity;
        } else if title_similarity >= 0.60 {
            evidence.push(format!(
                "Moderate title token similarity: {:.0}%",
                title_similarity * 100.0
            ));
            score += 0.30 * title_similarity;
        }

        // 4. Author Matching Heuristic
        let first_author_a = paper_a
            .authors
            .first()
            .map(|a| MetadataNormalizer::extract_family_name(&a.full_name));
        let first_author_b = paper_b
            .authors
            .first()
            .map(|a| MetadataNormalizer::extract_family_name(&a.full_name));

        if let (Some(fa_a), Some(fa_b)) = (first_author_a, first_author_b) {
            if !fa_a.is_empty() && fa_a == fa_b {
                evidence.push(format!("First author surname match: '{}'", fa_a));
                score += 0.25;
            }
        }

        // 5. Publication Year Proximity
        if let (Some(y_a), Some(y_b)) = (paper_a.publication_year, paper_b.publication_year) {
            let diff = (y_a - y_b).abs();
            if diff == 0 {
                evidence.push(format!("Identical publication year: {}", y_a));
                score += 0.15;
            } else if diff == 1 {
                evidence.push(format!(
                    "Close publication year difference (±1 year): {} vs {}",
                    y_a, y_b
                ));
                score += 0.05;
            } else if diff > 3 {
                evidence.push(format!(
                    "Large year discrepancy ({} vs {}): likely distinct publications",
                    y_a, y_b
                ));
                score -= 0.25;
            }
        }

        // Bound final score between 0.0 and 1.0
        let final_score = score.clamp(0.0, 1.0);

        let (match_tier, can_auto_merge) = if final_score >= Self::HIGH_CONFIDENCE_THRESHOLD
            && norm_doi_a.is_some()
            && norm_doi_a == norm_doi_b
        {
            ("exact_match".to_string(), true)
        } else if final_score >= Self::HIGH_CONFIDENCE_THRESHOLD {
            // High confidence, but without identical DOI, require human review to prevent accidental merges of different editions/preprints
            ("review_required".to_string(), false)
        } else if final_score >= Self::REVIEW_THRESHOLD {
            ("review_required".to_string(), false)
        } else {
            ("distinct".to_string(), false)
        };

        DeduplicationScore {
            score: (final_score * 100.0).round() / 100.0,
            match_tier,
            evidence,
            can_auto_merge,
        }
    }

    /// Computes token-level Jaccard similarity between two paper titles:
    pub fn compute_title_similarity(title_a: &str, title_b: &str) -> f64 {
        let tokens_a: HashSet<String> = title_a
            .to_lowercase()
            .split_whitespace()
            .map(|w| w.chars().filter(|c| c.is_alphanumeric()).collect())
            .filter(|w: &String| !w.is_empty())
            .collect();

        let tokens_b: HashSet<String> = title_b
            .to_lowercase()
            .split_whitespace()
            .map(|w| w.chars().filter(|c| c.is_alphanumeric()).collect())
            .filter(|w: &String| !w.is_empty())
            .collect();

        if tokens_a.is_empty() || tokens_b.is_empty() {
            return 0.0;
        }

        let intersection_count = tokens_a.intersection(&tokens_b).count();
        let union_count = tokens_a.union(&tokens_b).count();

        if union_count == 0 {
            0.0
        } else {
            intersection_count as f64 / union_count as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::paper::{Author, Paper};

    fn make_test_paper(
        id: &str,
        title: &str,
        doi: Option<&str>,
        year: Option<i32>,
        author: &str,
    ) -> Paper {
        Paper {
            id: id.to_string(),
            canonical_doi: doi.map(|d| d.to_string()),
            title: title.to_string(),
            clean_title_key: MetadataNormalizer::compute_title_key(title),
            abstract_text: None,
            publication_date: year.map(|y| format!("{}-01-01", y)),
            publication_year: year,
            venue: None,
            venue_type: None,
            language: "en".to_string(),
            citation_count: 0,
            reference_count: 0,
            is_open_access: true,
            license: None,
            primary_landing_url: None,
            pdf_url: None,
            has_file: false,
            local_pdf_path: None,
            content_hash: None,
            metadata_confidence: "verified".to_string(),
            is_saved: true,
            reading_status: "unread".to_string(),
            reading_progress: 0.0,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            open_access_status: "verified_open_access".to_string(),
            access_evidence_type: "explicit_source_label".to_string(),
            access_evidence_note: None,
            license_name: None,
            license_url: None,
            source_name: Some("OpenAlex".to_string()),
            retrieval_method: "permitted_html_connector".to_string(),
            access_confirmed_at: Some("2026-01-01T00:00:00Z".to_string()),
            authors: vec![Author {
                id: format!("author-{}", id),
                full_name: author.to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: 0,
                created_at: "2026-01-01T00:00:00Z".to_string(),
            }],
            collection_ids: vec![],
            tags: vec![],
            source_names: vec!["OpenAlex".to_string()],
        }
    }

    #[test]
    fn test_exact_doi_match_deduplication() {
        let p1 = make_test_paper(
            "p1",
            "Quantum Entanglement in Crystals",
            Some("10.1038/s41586-020-1"),
            Some(2020),
            "Alice Smith",
        );
        let p2 = make_test_paper(
            "p2",
            "Quantum Entanglement in Crystals (Preprint)",
            Some("https://doi.org/10.1038/s41586-020-1"),
            Some(2020),
            "Alice Smith",
        );

        let res = DeduplicationEngine::evaluate_pair(&p1, &p2);
        assert_eq!(res.match_tier, "exact_match");
        assert_eq!(res.score, 1.0);
        assert!(res.can_auto_merge);
    }

    #[test]
    fn test_conflicting_dois_are_distinct() {
        let p1 = make_test_paper(
            "p1",
            "Machine Learning in Genomics",
            Some("10.1000/182"),
            Some(2021),
            "John Doe",
        );
        let p2 = make_test_paper(
            "p2",
            "Machine Learning in Genomics",
            Some("10.1000/183"),
            Some(2021),
            "John Doe",
        );

        let res = DeduplicationEngine::evaluate_pair(&p1, &p2);
        assert_eq!(res.match_tier, "distinct");
        assert!(!res.can_auto_merge);
        assert!(res.evidence.iter().any(|e| e.contains("Conflicting DOIs")));
    }

    #[test]
    fn test_near_duplicate_requires_review() {
        let p1 = make_test_paper(
            "p1",
            "Deep Neural Networks for Visual Tracking",
            None,
            Some(2022),
            "Maria Garcia",
        );
        let p2 = make_test_paper(
            "p2",
            "Deep Neural Networks for Real-Time Visual Tracking",
            None,
            Some(2022),
            "Maria Garcia",
        );

        let res = DeduplicationEngine::evaluate_pair(&p1, &p2);
        assert_eq!(res.match_tier, "review_required");
        assert!(!res.can_auto_merge); // MUST NEVER auto-merge on title similarity alone!
        assert!(res.score >= 0.65);
    }
}
