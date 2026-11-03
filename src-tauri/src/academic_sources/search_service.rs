use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

use crate::academic_sources::adapter::AdapterSearchResult;
use crate::academic_sources::errors::AcademicError;
use crate::academic_sources::query_planner::AcademicQueryPlanner;
use crate::academic_sources::rate_limit::RateLimiter;
use crate::academic_sources::registry::ProviderRegistry;
use crate::academic_sources::types::{
    AcademicSearchQuery, ImportSummary, NormalizedWork, ProviderHealthCheck, ProviderId,
    ProviderStatus, ProviderStatusCategory, UnifiedSearchResponse,
};
use crate::database::Database;
use crate::domain::paper::{Author, Paper};
use crate::repositories::{CollectionRepository, PaperRepository};
use crate::services::metadata_normalizer::MetadataNormalizer;

type SearchTaskHandle = JoinHandle<(ProviderId, Result<AdapterSearchResult, AcademicError>, u64)>;

/// Coordinator for concurrent multi-source academic discovery and database import.
pub struct AcademicSearchService {
    registry: ProviderRegistry,
    rate_limiter: RateLimiter,
    http_client: reqwest::Client,
}

impl Default for AcademicSearchService {
    fn default() -> Self {
        Self::new()
    }
}

impl AcademicSearchService {
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        Self {
            registry: ProviderRegistry::new(),
            rate_limiter: RateLimiter::new(),
            http_client,
        }
    }

    pub fn registry(&self) -> &ProviderRegistry {
        &self.registry
    }

    /// Validates search query input bounds.
    pub fn validate_query(&self, q: &AcademicSearchQuery) -> Result<(), AcademicError> {
        let trimmed = q.query.trim();
        if trimmed.is_empty() {
            return Err(AcademicError::InvalidQuery(
                "Search query cannot be empty.".to_string(),
            ));
        }

        if trimmed.len() > 500 {
            return Err(AcademicError::InvalidQuery(
                "Search query exceeds maximum length of 500 characters.".to_string(),
            ));
        }

        if q.providers.is_empty() {
            return Err(AcademicError::InvalidQuery(
                "At least one academic source provider must be selected.".to_string(),
            ));
        }

        if let (Some(start), Some(end)) = (q.year_start, q.year_end) {
            if start > end {
                return Err(AcademicError::InvalidQuery(format!(
                    "Start year ({}) cannot be greater than end year ({}).",
                    start, end
                )));
            }
            if start < 1600 || end > 2100 {
                return Err(AcademicError::InvalidQuery(
                    "Year filter must be between 1600 and 2100.".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// Executes unified search across all requested providers concurrently with isolated error handling.
    pub async fn search(
        &self,
        query: AcademicSearchQuery,
        api_keys: HashMap<String, String>,
    ) -> Result<UnifiedSearchResponse, AcademicError> {
        self.validate_query(&query)?;

        // Plan and validate query adaptation across providers
        let query_planner = AcademicQueryPlanner::new();
        let query_plan = query_planner.plan(&query, &self.registry);

        let mut all_warnings = query_plan.global_warnings.clone();
        for p in &query_plan.provider_plans {
            all_warnings.extend(p.warnings.clone());
        }

        info!(
            query = %query.query,
            providers = ?query.providers,
            "Initiating unified capability-aware academic search"
        );

        let concurrency_semaphore = Arc::new(Semaphore::new(5));
        let mut tasks: Vec<SearchTaskHandle> = Vec::new();

        for &provider_id in &query.providers {
            let adapter_opt = self.registry.get_adapter(provider_id);
            let client = self.http_client.clone();
            let rate_limiter = self.rate_limiter.clone();
            let sem = concurrency_semaphore.clone();

            // Locate provider-adapted query if available
            let native_query_str = query_plan
                .provider_plans
                .iter()
                .find(|p| p.provider_id == provider_id)
                .map(|p| p.native_query.clone())
                .unwrap_or_else(|| query.query.clone());

            let mut provider_query = query.clone();
            provider_query.query = native_query_str;

            let api_key = api_keys.get(provider_id.as_str()).cloned();

            let handle = tokio::spawn(async move {
                let start = Instant::now();

                let Some(adapter) = adapter_opt else {
                    return (
                        provider_id,
                        Err(AcademicError::UnknownProvider(
                            provider_id.as_str().to_string(),
                        )),
                        0,
                    );
                };

                let _permit = match sem.acquire().await {
                    Ok(permit) => permit,
                    Err(_) => {
                        return (
                            provider_id,
                            Err(AcademicError::Internal(
                                "Concurrency semaphore closed".to_string(),
                            )),
                            0,
                        );
                    }
                };

                // Pacing / rate control
                rate_limiter.wait_for_slot(provider_id).await;

                let result = adapter
                    .search(&client, &provider_query, api_key.as_deref())
                    .await;
                let elapsed_ms = start.elapsed().as_millis() as u64;

                (provider_id, result, elapsed_ms)
            });

            tasks.push(handle);
        }

        let mut provider_statuses = Vec::new();
        let mut raw_works = Vec::new();

        for handle in tasks {
            match handle.await {
                Ok((provider_id, result, elapsed_ms)) => match result {
                    Ok(search_result) => {
                        let count = search_result.works.len();
                        let has_more = search_result.next_cursor.is_some();

                        provider_statuses.push(ProviderStatus {
                            provider_id,
                            status: if count > 0 {
                                ProviderStatusCategory::Succeeded
                            } else {
                                ProviderStatusCategory::NoResults
                            },
                            message: if count == 0 {
                                Some("No records matched your search terms.".to_string())
                            } else {
                                None
                            },
                            result_count: count,
                            total_results: search_result.total_results,
                            has_more,
                            next_cursor: search_result.next_cursor,
                            elapsed_ms,
                        });

                        raw_works.extend(search_result.works);
                    }
                    Err(err) => {
                        warn!(provider = ?provider_id, error = %err, "Provider search failed");

                        let (status_cat, message) = match &err {
                            AcademicError::RateLimited { retry_after_secs } => (
                                ProviderStatusCategory::RateLimited,
                                format!(
                                    "Rate limit reached. Please wait {}s before searching again.",
                                    retry_after_secs.unwrap_or(5)
                                ),
                            ),
                            AcademicError::AuthRequired(msg) => (
                                ProviderStatusCategory::AuthenticationRequired,
                                format!("API Key required or invalid: {}", msg),
                            ),
                            AcademicError::Timeout => (
                                ProviderStatusCategory::Unavailable,
                                "Request timed out while contacting provider.".to_string(),
                            ),
                            AcademicError::Unavailable(msg) => (
                                ProviderStatusCategory::Unavailable,
                                format!("Service unavailable: {}", msg),
                            ),
                            _ => (ProviderStatusCategory::Failed, err.to_string()),
                        };

                        provider_statuses.push(ProviderStatus {
                            provider_id,
                            status: status_cat,
                            message: Some(message),
                            result_count: 0,
                            total_results: None,
                            has_more: false,
                            next_cursor: None,
                            elapsed_ms,
                        });
                    }
                },
                Err(join_err) => {
                    error!(error = %join_err, "Provider search task panicked or cancelled");
                }
            }
        }

        // Apply client-side fallback post-filtering for providers lacking native filter support
        let filtered_works = query_planner.filter_post_search(raw_works, &query);

        // Deduplicate and merge results across providers using conservative hierarchy
        let merged_works = Self::deduplicate_and_merge_works(filtered_works);
        let total_found = merged_works.len();

        Ok(UnifiedSearchResponse {
            works: merged_works,
            provider_statuses,
            total_found,
            completed_at: chrono::Utc::now().to_rfc3339(),
            query_plan: Some(query_plan),
            warnings: all_warnings,
        })
    }

    /// Deduplicates results across multiple providers based on a conservative hierarchy:
    /// Tier 1: Exact canonical DOI
    /// Tier 2: Provider ID + Provider Record ID
    /// Tier 3: Clean title key (>= 10 chars) + publication year within 1 year + author surname overlap
    /// Preserves all source provenances and safely merges metadata.
    pub fn deduplicate_and_merge_works(works: Vec<NormalizedWork>) -> Vec<NormalizedWork> {
        let mut by_doi: HashMap<String, usize> = HashMap::new();
        let mut by_provider_record: HashMap<(ProviderId, String), usize> = HashMap::new();
        let mut by_title: HashMap<String, Vec<usize>> = HashMap::new();
        let mut merged: Vec<NormalizedWork> = Vec::new();

        for work in works {
            let mut existing_idx = None;

            // Tier 1: Canonical DOI match (highest confidence)
            if let Some(ref doi) = work.canonical_doi {
                if let Some(&idx) = by_doi.get(doi) {
                    existing_idx = Some(idx);
                }
            }

            // Tier 2: Provider specific record match
            if existing_idx.is_none() {
                let prov_key = (work.provider_id, work.provider_record_id.clone());
                if let Some(&idx) = by_provider_record.get(&prov_key) {
                    existing_idx = Some(idx);
                }
            }

            // Tier 3: Clean Title + Year Compatibility + Author Overlap
            if existing_idx.is_none() && work.clean_title_key.len() >= 10 {
                if let Some(candidate_indices) = by_title.get(&work.clean_title_key) {
                    for &c_idx in candidate_indices {
                        let candidate = &merged[c_idx];

                        // Year compatibility check: exact, +/- 1 year, or either is unknown
                        let year_compat = match (work.publication_year, candidate.publication_year)
                        {
                            (Some(y1), Some(y2)) => (y1 - y2).abs() <= 1,
                            _ => true,
                        };
                        if !year_compat {
                            continue;
                        }

                        // Author compatibility check
                        let author_compat =
                            if work.authors.is_empty() || candidate.authors.is_empty() {
                                // If either has no authors, allow merge only if years match exactly
                                work.publication_year == candidate.publication_year
                            } else {
                                let surnames_work: Vec<String> = work
                                    .authors
                                    .iter()
                                    .map(|a| MetadataNormalizer::extract_family_name(&a.name))
                                    .filter(|s| s.len() >= 3)
                                    .collect();
                                let surnames_cand: Vec<String> = candidate
                                    .authors
                                    .iter()
                                    .map(|a| MetadataNormalizer::extract_family_name(&a.name))
                                    .filter(|s| s.len() >= 3)
                                    .collect();

                                surnames_work.iter().any(|s1| surnames_cand.contains(s1))
                            };

                        if author_compat {
                            existing_idx = Some(c_idx);
                            break;
                        }
                    }
                }
            }

            if let Some(idx) = existing_idx {
                let target = &mut merged[idx];

                // Merge provenance
                for prov in work.provenance {
                    if !target
                        .provenance
                        .iter()
                        .any(|p| p.provider_id == prov.provider_id && p.record_id == prov.record_id)
                    {
                        target.provenance.push(prov);
                    }
                }

                // Safe non-destructive field merge
                if target.canonical_doi.is_none() && work.canonical_doi.is_some() {
                    target.canonical_doi = work.canonical_doi;
                }
                if target.abstract_text.is_none() && work.abstract_text.is_some() {
                    target.abstract_text = work.abstract_text;
                }
                if target.pdf_url.is_none() && work.pdf_url.is_some() {
                    target.pdf_url = work.pdf_url;
                }
                if target.landing_url.is_none() && work.landing_url.is_some() {
                    target.landing_url = work.landing_url;
                }
                if work.authors.len() > target.authors.len() {
                    target.authors = work.authors;
                }
                if target.publication_date.is_none() && work.publication_date.is_some() {
                    target.publication_date = work.publication_date;
                }
                if target.venue.is_none() && work.venue.is_some() {
                    target.venue = work.venue;
                }
                if target.venue_type.is_none() && work.venue_type.is_some() {
                    target.venue_type = work.venue_type;
                }
                if let (Some(cur_c), Some(new_c)) = (target.citation_count, work.citation_count) {
                    target.citation_count = Some(cur_c.max(new_c));
                } else if target.citation_count.is_none() {
                    target.citation_count = work.citation_count;
                }
                if !target.is_open_access && work.is_open_access {
                    target.is_open_access = true;
                }

                // Recompute completeness score
                target.compute_completeness();
            } else {
                let new_idx = merged.len();
                if let Some(ref doi) = work.canonical_doi {
                    by_doi.insert(doi.clone(), new_idx);
                }
                by_provider_record
                    .insert((work.provider_id, work.provider_record_id.clone()), new_idx);
                by_title
                    .entry(work.clean_title_key.clone())
                    .or_default()
                    .push(new_idx);

                let mut new_work = work;
                new_work.compute_completeness();
                merged.push(new_work);
            }
        }

        // Sort results: works with PDF URLs first, then highest citation count, then newest year
        merged.sort_by(|a, b| {
            let a_has_pdf = a.pdf_url.is_some();
            let b_has_pdf = b.pdf_url.is_some();
            b_has_pdf
                .cmp(&a_has_pdf)
                .then_with(|| {
                    b.citation_count
                        .unwrap_or(0)
                        .cmp(&a.citation_count.unwrap_or(0))
                })
                .then_with(|| {
                    b.publication_year
                        .unwrap_or(0)
                        .cmp(&a.publication_year.unwrap_or(0))
                })
        });

        merged
    }

    /// Runs health checks on requested providers.
    pub async fn check_provider_health(
        &self,
        target_provider: Option<ProviderId>,
    ) -> Vec<ProviderHealthCheck> {
        self.registry
            .run_health_checks(&self.http_client, target_provider)
            .await
    }

    /// Enriches an existing paper record in SQLite with external metadata from OpenAlex.
    pub async fn enrich_paper_by_id(
        &self,
        db: &Database,
        paper_id: &str,
    ) -> Result<Paper, AcademicError> {
        let (paper, canonical_doi) = {
            let conn = db
                .lock()
                .map_err(|e| AcademicError::Database(e.to_string()))?;
            let p = PaperRepository::get_by_id(&conn, paper_id)
                .map_err(|e| AcademicError::Database(e.to_string()))?
                .ok_or_else(|| AcademicError::Database("Paper not found".to_string()))?;
            let doi = p.canonical_doi.clone();
            (p, doi)
        };

        let Some(doi) = canonical_doi else {
            return Err(AcademicError::InvalidQuery(
                "Paper does not have a canonical DOI for external metadata enrichment.".to_string(),
            ));
        };

        // Query OpenAlex for enrichment
        let openalex_url = format!("https://api.openalex.org/works/https://doi.org/{}", doi);
        let resp = self
            .http_client
            .get(&openalex_url)
            .header(
                "User-Agent",
                "ResearchPaperScraper/0.1.0 (Desktop Academic Research App; mailto:researcher@local-desktop.app)",
            )
            .send()
            .await;

        let mut enriched_abstract = None;
        let mut enriched_venue = None;
        let mut enriched_citation_count = None;
        let mut enriched_pdf_url = None;
        let mut enriched_oa = false;
        let mut openalex_record_id = None;

        if let Ok(res) = resp {
            if res.status().is_success() {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    openalex_record_id = json
                        .get("id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    // Reconstruct abstract from inverted index if present
                    if let Some(inv_idx) = json
                        .get("abstract_inverted_index")
                        .and_then(|v| v.as_object())
                    {
                        let mut words: Vec<(usize, &str)> = Vec::new();
                        for (word, positions) in inv_idx {
                            if let Some(pos_array) = positions.as_array() {
                                for p in pos_array {
                                    if let Some(idx) = p.as_u64() {
                                        words.push((idx as usize, word.as_str()));
                                    }
                                }
                            }
                        }
                        words.sort_by_key(|&(idx, _)| idx);
                        let reconstructed: String = words
                            .into_iter()
                            .map(|(_, w)| w)
                            .collect::<Vec<_>>()
                            .join(" ");
                        if !reconstructed.trim().is_empty() {
                            enriched_abstract = Some(reconstructed);
                        }
                    }

                    if let Some(host) = json
                        .get("primary_location")
                        .and_then(|loc| loc.get("source"))
                    {
                        enriched_venue = host
                            .get("display_name")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }

                    if let Some(c) = json.get("cited_by_count").and_then(|v| v.as_u64()) {
                        enriched_citation_count = Some(c as i32);
                    }

                    if let Some(oa) = json
                        .get("open_access")
                        .and_then(|v| v.get("is_oa"))
                        .and_then(|v| v.as_bool())
                    {
                        enriched_oa = oa;
                    }

                    if let Some(pdf) = json
                        .get("primary_location")
                        .and_then(|loc| loc.get("pdf_url"))
                        .and_then(|v| v.as_str())
                    {
                        enriched_pdf_url = Some(pdf.to_string());
                    }
                }
            }
        }

        // Apply enrichment to database
        let mut conn = db
            .lock()
            .map_err(|e| AcademicError::Database(e.to_string()))?;
        let mut updated_paper = paper;

        if updated_paper.abstract_text.is_none() && enriched_abstract.is_some() {
            updated_paper.abstract_text = enriched_abstract;
        }
        if updated_paper.venue.is_none() && enriched_venue.is_some() {
            updated_paper.venue = enriched_venue;
        }
        if let Some(c) = enriched_citation_count {
            if c > updated_paper.citation_count {
                updated_paper.citation_count = c;
            }
        }
        if updated_paper.pdf_url.is_none() && enriched_pdf_url.is_some() {
            updated_paper.pdf_url = enriched_pdf_url.clone();
        }
        if enriched_oa && !updated_paper.is_open_access {
            updated_paper.is_open_access = true;
            updated_paper.open_access_status = crate::domain::paper::OA_STATUS_VERIFIED.to_string();
        }
        updated_paper.metadata_confidence = "high".to_string();
        updated_paper.updated_at = chrono::Utc::now().to_rfc3339();

        let _ = PaperRepository::update(&mut conn, &updated_paper);

        // Record provenance if OpenAlex record found
        if let Some(oa_id) = openalex_record_id {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO paper_sources (paper_id, source_id, source_record_id, source_url, open_access_pdf_url, retrieved_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    paper_id,
                    "openalex",
                    oa_id,
                    format!("https://openalex.org/{}", oa_id),
                    enriched_pdf_url,
                    chrono::Utc::now().to_rfc3339(),
                ],
            );
        }

        Ok(updated_paper)
    }

    /// Imports selected search results into the Phase 4 SQLite database with duplicate awareness.
    /// Preserves all user notes, tags, collections, and provenance.
    pub fn import_works(
        db: &Database,
        works: Vec<NormalizedWork>,
        target_collection_id: Option<String>,
    ) -> Result<ImportSummary, AcademicError> {
        let mut added = 0;
        let mut already_present = 0;
        let mut updated = 0;
        let mut failed = 0;
        let mut errors = Vec::new();

        let mut conn = db
            .lock()
            .map_err(|e| AcademicError::Database(e.to_string()))?;

        for work in works {
            // Check if paper already exists in library
            let existing_paper_opt = if let Some(ref doi) = work.canonical_doi {
                match PaperRepository::get_by_doi(&conn, doi) {
                    Ok(opt) => opt,
                    Err(e) => {
                        errors.push(format!("Error querying DOI '{}': {}", doi, e));
                        failed += 1;
                        continue;
                    }
                }
            } else {
                match PaperRepository::get_by_clean_title(&conn, &work.clean_title_key) {
                    Ok(opt) => opt,
                    Err(e) => {
                        errors.push(format!("Error querying title key: {}", e));
                        failed += 1;
                        continue;
                    }
                }
            };

            let paper_id = if let Some(existing) = existing_paper_opt {
                already_present += 1;

                // If existing paper was not marked saved, mark it saved
                if !existing.is_saved {
                    if let Err(e) = PaperRepository::set_saved(&conn, &existing.id, true) {
                        errors.push(format!("Failed to save existing paper: {}", e));
                    } else {
                        updated += 1;
                    }
                }

                existing.id
            } else {
                // Insert new paper
                let new_id = uuid::Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();

                let authors: Vec<Author> = work
                    .authors
                    .into_iter()
                    .enumerate()
                    .map(|(idx, a)| Author {
                        id: uuid::Uuid::new_v4().to_string(),
                        full_name: a.name,
                        family_name: None,
                        given_name: None,
                        orcid: a.orcid,
                        affiliation: a.affiliation,
                        author_order: idx as i32,
                        created_at: now.clone(),
                    })
                    .collect();

                let new_paper = Paper {
                    id: new_id.clone(),
                    canonical_doi: work.canonical_doi,
                    title: work.title,
                    clean_title_key: work.clean_title_key,
                    abstract_text: work.abstract_text,
                    publication_date: work.publication_date,
                    publication_year: work.publication_year,
                    venue: work.venue,
                    venue_type: work.venue_type,
                    language: "en".to_string(),
                    citation_count: work.citation_count.unwrap_or(0) as i32,
                    reference_count: 0,
                    is_open_access: work.is_open_access,
                    license: None,
                    primary_landing_url: work.landing_url,
                    pdf_url: work.pdf_url,
                    has_file: false,
                    local_pdf_path: None,
                    content_hash: None,
                    metadata_confidence: "high".to_string(),
                    is_saved: true,
                    reading_status: "unread".to_string(),
                    reading_progress: 0.0,
                    last_opened_at: None,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    open_access_status: if work.is_open_access {
                        crate::domain::paper::OA_STATUS_VERIFIED.to_string()
                    } else {
                        crate::domain::paper::OA_STATUS_PENDING.to_string()
                    },
                    access_evidence_type: if work.is_open_access {
                        crate::domain::paper::EVIDENCE_EXPLICIT_SOURCE_LABEL.to_string()
                    } else {
                        crate::domain::paper::EVIDENCE_UNKNOWN.to_string()
                    },
                    access_evidence_note: Some(format!(
                        "Discovered via academic provider {}",
                        work.provider_id.display_name()
                    )),
                    license_name: None,
                    license_url: None,
                    source_name: Some(work.provider_id.display_name().to_string()),
                    retrieval_method: crate::domain::paper::RETRIEVAL_PERMITTED_HTML.to_string(),
                    access_confirmed_at: if work.is_open_access {
                        Some(now.clone())
                    } else {
                        None
                    },
                    authors,
                    collection_ids: Vec::new(),
                    tags: Vec::new(),
                    source_names: vec![work.provider_id.display_name().to_string()],
                };

                if let Err(e) = PaperRepository::create(&mut conn, &new_paper) {
                    errors.push(format!(
                        "Failed to insert paper '{}': {}",
                        new_paper.title, e
                    ));
                    failed += 1;
                    continue;
                }

                added += 1;
                new_id
            };

            // Associate with target collection if specified
            if let Some(ref col_id) = target_collection_id {
                let _ = CollectionRepository::add_paper(&conn, col_id, &paper_id);
            }

            // Save source provenance
            for prov in work.provenance {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO paper_sources (paper_id, source_id, source_record_id, source_url, retrieved_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        paper_id,
                        prov.provider_id.as_str(),
                        prov.record_id,
                        prov.landing_url,
                        prov.retrieved_at,
                    ],
                );
            }
        }

        Ok(ImportSummary {
            added,
            already_present,
            updated,
            failed,
            errors,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::academic_sources::types::{MetadataCompleteness, ProviderProvenance};

    #[test]
    fn test_query_validation_rules() {
        let service = AcademicSearchService::new();

        // Empty query
        let empty_q = AcademicSearchQuery {
            query: "   ".to_string(),
            providers: vec![ProviderId::OpenAlex],
            year_start: None,
            year_end: None,
            open_access_only: None,
            page: None,
            page_size: None,
            cursor_tokens: None,
        };
        assert!(service.validate_query(&empty_q).is_err());

        // No providers
        let no_prov_q = AcademicSearchQuery {
            query: "quantum".to_string(),
            providers: vec![],
            year_start: None,
            year_end: None,
            open_access_only: None,
            page: None,
            page_size: None,
            cursor_tokens: None,
        };
        assert!(service.validate_query(&no_prov_q).is_err());

        // Inverted year bounds
        let inverted_years_q = AcademicSearchQuery {
            query: "quantum".to_string(),
            providers: vec![ProviderId::OpenAlex],
            year_start: Some(2024),
            year_end: Some(2018),
            open_access_only: None,
            page: None,
            page_size: None,
            cursor_tokens: None,
        };
        assert!(service.validate_query(&inverted_years_q).is_err());

        // Valid query
        let valid_q = AcademicSearchQuery {
            query: "quantum computing".to_string(),
            providers: vec![ProviderId::OpenAlex, ProviderId::Crossref],
            year_start: Some(2018),
            year_end: Some(2024),
            open_access_only: Some(true),
            page: Some(1),
            page_size: Some(20),
            cursor_tokens: None,
        };
        assert!(service.validate_query(&valid_q).is_ok());
    }

    #[test]
    fn test_deduplicate_and_merge_works() {
        let work1 = NormalizedWork {
            id: "openalex-w1".to_string(),
            canonical_doi: Some("10.1000/182".to_string()),
            title: "Digital Object Identifier Handbook".to_string(),
            clean_title_key: "digitalobjectidentifierhandbook".to_string(),
            abstract_text: Some("First abstract".to_string()),
            publication_date: Some("2020-01-01".to_string()),
            publication_year: Some(2020),
            venue: None,
            venue_type: None,
            authors: vec![],
            is_open_access: false,
            landing_url: None,
            pdf_url: None,
            pdf_status: Some("unknown".to_string()),
            version_type: Some("unknown_version".to_string()),
            citation_count: Some(50),
            provider_id: ProviderId::OpenAlex,
            provider_record_id: "W1".to_string(),
            provenance: vec![ProviderProvenance {
                provider_id: ProviderId::OpenAlex,
                record_id: "W1".to_string(),
                landing_url: None,
                retrieved_at: "2026-10-24T00:00:00Z".to_string(),
            }],
            metadata_score: 0,
            completeness: MetadataCompleteness::default(),
        };

        let work2 = NormalizedWork {
            id: "crossref-w1".to_string(),
            canonical_doi: Some("10.1000/182".to_string()), // Exact same DOI
            title: "Digital Object Identifier Handbook".to_string(),
            clean_title_key: "digitalobjectidentifierhandbook".to_string(),
            abstract_text: None,
            publication_date: Some("2020-01-01".to_string()),
            publication_year: Some(2020),
            venue: Some("DOI Foundation".to_string()),
            venue_type: None,
            authors: vec![],
            is_open_access: true,
            landing_url: Some("https://doi.org/10.1000/182".to_string()),
            pdf_url: Some("https://doi.org/10.1000/182.pdf".to_string()),
            pdf_status: Some("open_access_available".to_string()),
            version_type: Some("published_version".to_string()),
            citation_count: None,
            provider_id: ProviderId::Crossref,
            provider_record_id: "10.1000/182".to_string(),
            provenance: vec![ProviderProvenance {
                provider_id: ProviderId::Crossref,
                record_id: "10.1000/182".to_string(),
                landing_url: Some("https://doi.org/10.1000/182".to_string()),
                retrieved_at: "2026-10-24T00:00:00Z".to_string(),
            }],
            metadata_score: 0,
            completeness: MetadataCompleteness::default(),
        };

        let merged = AcademicSearchService::deduplicate_and_merge_works(vec![work1, work2]);
        assert_eq!(
            merged.len(),
            1,
            "Expected duplicate DOI works to merge into 1 record"
        );
        let result = &merged[0];
        assert_eq!(
            result.provenance.len(),
            2,
            "Expected provenance from both OpenAlex and Crossref"
        );
        assert!(result.is_open_access, "Expected OA flag merged");
        assert_eq!(result.citation_count, Some(50));
        assert_eq!(
            result.pdf_url.as_deref(),
            Some("https://doi.org/10.1000/182.pdf")
        );
    }
}
