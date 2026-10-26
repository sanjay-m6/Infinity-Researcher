use std::collections::HashSet;
use uuid::Uuid;

use crate::database::Database;
use crate::domain::ai::AiRecommendation;
use crate::domain::paper::{Paper, PaperListQuery};
use crate::errors::AppError;
use crate::repositories::{AiRepository, PaperRepository};

pub struct AiRecommendationService;

impl AiRecommendationService {
    /// Generates transparent recommendations based on paper similarity, user feedback, and diversity.
    pub fn get_recommendations(
        db: &Database,
        paper_id: &str,
        mode: &str,
        limit: usize,
    ) -> Result<Vec<AiRecommendation>, AppError> {
        let conn = db.lock()?;

        let source_paper = PaperRepository::get_by_id(&conn, paper_id)
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| {
                AppError::Validation(format!("Paper '{}' not found in library", paper_id))
            })?;

        let query = PaperListQuery {
            page: Some(1),
            page_size: Some(100),
            ..Default::default()
        };
        let paged =
            PaperRepository::list(&conn, &query).map_err(|e| AppError::Database(e.to_string()))?;

        // Collect existing feedback
        let existing_recs =
            AiRepository::list_recommendations(&conn, Some(paper_id), 100).unwrap_or_default();
        let dismissed_ids: HashSet<String> = existing_recs
            .iter()
            .filter(|r| r.feedback_status == "dismissed")
            .map(|r| r.recommended_paper_id.clone())
            .collect();

        let source_keywords = Self::extract_keywords(&source_paper);
        let settings = AiRepository::get_ai_settings(&conn).unwrap_or_else(|_| {
            crate::domain::ai::AiSettings {
                local_only_mode: false,
                never_use_paid_apis: true,
                cloud_paper_sharing_enabled: false,
                active_rag_scope: "paper".into(),
                default_audience_level: "researcher".into(),
                recommendations_diversity_weight: 0.35,
            }
        });

        let mut scored_candidates: Vec<(f64, Vec<String>, String, String, Paper)> = Vec::new();

        for candidate in paged.items {
            if candidate.id == source_paper.id || dismissed_ids.contains(&candidate.id) {
                continue;
            }

            let cand_keywords = Self::extract_keywords(&candidate);
            let intersection: Vec<String> = source_keywords
                .intersection(&cand_keywords)
                .cloned()
                .collect();

            let union_size =
                (source_keywords.len() + cand_keywords.len() - intersection.len()).max(1);
            let mut jaccard = intersection.len() as f64 / union_size as f64;

            // Recency / year signal
            if let (Some(src_yr), Some(cand_yr)) =
                (source_paper.publication_year, candidate.publication_year)
            {
                match mode {
                    "recent_developments" if cand_yr >= src_yr => {
                        jaccard += 0.25;
                    }
                    "foundational" if cand_yr < src_yr => {
                        jaccard += 0.25;
                    }
                    _ => {}
                }
            }

            // Venue overlap
            if let (Some(ref sv), Some(ref cv)) = (&source_paper.venue, &candidate.venue) {
                if !sv.is_empty() && sv.eq_ignore_ascii_case(cv) {
                    jaccard += 0.15;
                }
            }

            // Mode adjustments
            let (label, reason) =
                Self::build_reason(&intersection, mode, &candidate, &source_paper, jaccard);
            let final_score = jaccard.clamp(0.05, 0.99);

            scored_candidates.push((final_score, intersection, label, reason, candidate));
        }

        // Sort descending by initial score
        scored_candidates
            .sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Diversity reranking (penalize subsequent items with too much author/venue repetition)
        let mut final_recs: Vec<AiRecommendation> = Vec::new();
        let mut seen_authors: HashSet<String> = HashSet::new();

        for (score, matched_concepts, conf_label, reason, cand) in scored_candidates {
            if final_recs.len() >= limit {
                break;
            }

            let mut div_penalty = 0.0;
            for a in &cand.authors {
                if seen_authors.contains(&a.full_name) {
                    div_penalty += settings.recommendations_diversity_weight * 0.2;
                }
            }

            let adjusted_score = (score - div_penalty).max(0.1);

            for a in &cand.authors {
                seen_authors.insert(a.full_name.clone());
            }

            let author_names: Vec<String> = cand.authors.into_iter().map(|a| a.full_name).collect();

            final_recs.push(AiRecommendation {
                id: Uuid::new_v4().to_string(),
                paper_id: paper_id.to_string(),
                recommended_paper_id: cand.id,
                recommended_title: cand.title,
                recommended_authors: author_names,
                recommended_year: cand.publication_year.map(|y| y as i64),
                recommended_venue: cand.venue,
                recommended_doi: cand.canonical_doi,
                score: (adjusted_score * 100.0).round() / 100.0,
                reason,
                matched_concepts,
                confidence_label: conf_label,
                recommendation_mode: mode.to_string(),
                feedback_status: "none".into(),
                feedback_note: None,
                updated_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        // Cache recommendations
        let _ = AiRepository::save_recommendations(&conn, &final_recs);

        Ok(final_recs)
    }

    fn extract_keywords(paper: &Paper) -> HashSet<String> {
        let mut set = HashSet::new();
        let stop_words: HashSet<&str> = [
            "the", "and", "for", "with", "from", "this", "that", "using", "based", "via", "over",
            "into", "through", "under", "study", "analysis", "paper",
        ]
        .into_iter()
        .collect();

        let mut text = paper.title.to_lowercase();
        if let Some(ref abs) = paper.abstract_text {
            text.push(' ');
            text.push_str(&abs.to_lowercase());
        }

        for word in text.split(|c: char| !c.is_alphanumeric()) {
            let clean = word.trim();
            if clean.len() > 3 && !stop_words.contains(clean) {
                set.insert(clean.to_string());
            }
        }

        for tag in &paper.tags {
            set.insert(tag.to_lowercase());
        }

        set
    }

    fn build_reason(
        intersection: &[String],
        mode: &str,
        candidate: &Paper,
        _source: &Paper,
        score: f64,
    ) -> (String, String) {
        let top_concepts: Vec<&str> = intersection.iter().take(3).map(|s| s.as_str()).collect();
        let concepts_str = if top_concepts.is_empty() {
            "complementary scientific topics".to_string()
        } else {
            top_concepts.join(", ")
        };

        let conf_pct = (score * 100.0).clamp(40.0, 96.0) as i64;

        match mode {
            "methodology_match" => (
                format!("Methodology Match ({}%)", conf_pct),
                format!(
                    "Uses similar experimental methods and shared concepts: {}.",
                    concepts_str
                ),
            ),
            "recent_developments" => (
                format!("Recent Development ({}%)", conf_pct),
                format!(
                    "Builds upon recent work ({:?}) addressing {}.",
                    candidate.publication_year.unwrap_or(2024),
                    concepts_str
                ),
            ),
            "foundational" => (
                format!("Foundational Paper ({}%)", conf_pct),
                format!(
                    "Seminal prior literature establishing key ideas in {}.",
                    concepts_str
                ),
            ),
            "diversify" => (
                format!("Cross-Domain Discovery ({}%)", conf_pct),
                format!(
                    "Applies {} from an alternative research angle.",
                    concepts_str
                ),
            ),
            _ => (
                format!("Strong Relevance ({}%)", conf_pct),
                format!(
                    "Recommended next reading sharing {} and related problem formulations.",
                    concepts_str
                ),
            ),
        }
    }
}
