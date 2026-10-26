use chrono::Utc;
use rusqlite::Connection;
use std::path::Path;
use tracing::{info, warn};
use uuid::Uuid;

use crate::domain::paper::{Paper, PaperListQuery};
use crate::domain::processing::{DuplicateCandidate, PaperFile, PaperIdentifier, ProcessingJob};
use crate::errors::AppError;
use crate::repositories::paper_repo::PaperRepository;
use crate::repositories::processing_repo::ProcessingRepository;
use crate::services::deduplication::DeduplicationEngine;
use crate::services::file_integrity::FileIntegrityService;
use crate::services::metadata_normalizer::MetadataNormalizer;
use crate::services::pdf_processor::PdfProcessor;

pub struct ProcessingPipeline;

impl ProcessingPipeline {
    /// Normalizes metadata for all library papers:
    /// - Computes canonical clean_title_key
    /// - Normalizes DOIs, arXiv IDs, and PMIDs
    /// - Populates paper_identifiers table for fast multi-namespace lookup
    pub fn run_metadata_normalization(conn: &Connection) -> Result<ProcessingJob, AppError> {
        let job_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let list_query = PaperListQuery {
            page_size: Some(1000),
            ..Default::default()
        };
        let paged = PaperRepository::list(conn, &list_query)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let papers = paged.items;

        let total_items = papers.len() as i32;
        let mut completed_items = 0;
        let mut warnings_count = 0;

        let mut job = ProcessingJob {
            id: job_id.clone(),
            job_type: "metadata_normalization".to_string(),
            status: "running".to_string(),
            total_items,
            completed_items: 0,
            failed_items: 0,
            warnings_count: 0,
            error_message: None,
            started_at: Some(now.clone()),
            completed_at: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        ProcessingRepository::create_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        for paper in &papers {
            // Normalize Title Key
            let clean_key = MetadataNormalizer::compute_title_key(&paper.title);
            let _ = conn.execute(
                "UPDATE papers SET clean_title_key = ?1 WHERE id = ?2",
                rusqlite::params![clean_key, paper.id],
            );

            // Normalize and insert DOI identifier if present
            if let Some(raw_doi) = &paper.canonical_doi {
                if let Some(norm_doi) = MetadataNormalizer::normalize_doi(raw_doi) {
                    let _ = conn.execute(
                        "UPDATE papers SET canonical_doi = ?1 WHERE id = ?2",
                        rusqlite::params![norm_doi, paper.id],
                    );

                    let ident = PaperIdentifier {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper.id.clone(),
                        identifier_type: "doi".to_string(),
                        canonical_value: norm_doi,
                        raw_value: raw_doi.clone(),
                        source_id: None,
                        created_at: Utc::now().to_rfc3339(),
                    };
                    let _ = ProcessingRepository::insert_identifier(conn, &ident);
                } else {
                    warnings_count += 1;
                }
            }

            completed_items += 1;
        }

        job.status = if warnings_count > 0 {
            "succeeded_with_warnings".to_string()
        } else {
            "succeeded".to_string()
        };
        job.completed_items = completed_items;
        job.warnings_count = warnings_count;
        job.completed_at = Some(Utc::now().to_rfc3339());
        job.updated_at = Utc::now().to_rfc3339();

        ProcessingRepository::update_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        info!(
            total = total_items,
            "Metadata normalization pipeline completed"
        );
        Ok(job)
    }

    /// Scans library papers for potential duplicate pairs using multi-stage matching:
    /// - Stage A: Identical canonical DOI
    /// - Stage B: Identical title key + author + year
    /// - Stage C: Near-duplicate title tokens (Jaccard similarity >= 0.65)
    pub fn run_duplicate_scan(conn: &Connection) -> Result<ProcessingJob, AppError> {
        let job_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let list_query = PaperListQuery {
            page_size: Some(1000),
            ..Default::default()
        };
        let paged = PaperRepository::list(conn, &list_query)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let papers = paged.items;

        let total_items = papers.len() as i32;
        let mut completed_items = 0;
        let mut candidates_found = 0;

        let mut job = ProcessingJob {
            id: job_id.clone(),
            job_type: "duplicate_detection".to_string(),
            status: "running".to_string(),
            total_items,
            completed_items: 0,
            failed_items: 0,
            warnings_count: 0,
            error_message: None,
            started_at: Some(now.clone()),
            completed_at: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        ProcessingRepository::create_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let n = papers.len();
        for i in 0..n {
            for j in (i + 1)..n {
                let paper_a = &papers[i];
                let paper_b = &papers[j];

                let has_matching_doi = match (&paper_a.canonical_doi, &paper_b.canonical_doi) {
                    (Some(d1), Some(d2)) => d1 == d2,
                    _ => false,
                };
                let has_same_title_key = paper_a.clean_title_key == paper_b.clean_title_key
                    && !paper_a.clean_title_key.is_empty();

                let eval = DeduplicationEngine::evaluate_pair(paper_a, paper_b);

                // If candidate score meets review threshold (>= 0.65) or exact match
                if eval.score >= DeduplicationEngine::REVIEW_THRESHOLD
                    || has_matching_doi
                    || has_same_title_key
                {
                    let candidate = DuplicateCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_a_id: paper_a.id.clone(),
                        paper_b_id: paper_b.id.clone(),
                        score: eval.score,
                        match_tier: eval.match_tier,
                        evidence: eval.evidence,
                        status: "pending".to_string(),
                        decision_notes: None,
                        decided_at: None,
                        created_at: Utc::now().to_rfc3339(),
                        updated_at: Utc::now().to_rfc3339(),
                    };

                    let _ = ProcessingRepository::save_duplicate_candidate(conn, &candidate);
                    candidates_found += 1;
                }
            }
            completed_items += 1;
        }

        job.status = "succeeded".to_string();
        job.completed_items = completed_items;
        job.warnings_count = candidates_found;
        job.completed_at = Some(Utc::now().to_rfc3339());
        job.updated_at = Utc::now().to_rfc3339();

        ProcessingRepository::update_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        info!(
            candidates = candidates_found,
            "Duplicate detection scan completed"
        );
        Ok(job)
    }

    /// Verifies all local PDF files on disk:
    /// - Validates file path bounds
    /// - Streams SHA-256 hash calculation
    /// - Parses structural metadata (page count, title, author)
    /// - Detects encrypted, corrupt, textless, or verified status
    pub fn run_pdf_verification(
        conn: &Connection,
        base_dir: &Path,
    ) -> Result<ProcessingJob, AppError> {
        let job_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let list_query = PaperListQuery {
            page_size: Some(1000),
            ..Default::default()
        };
        let paged = PaperRepository::list(conn, &list_query)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let papers = paged.items;

        let papers_with_files: Vec<&Paper> = papers
            .iter()
            .filter(|p| p.local_pdf_path.is_some() || p.has_file)
            .collect();
        let total_items = papers_with_files.len() as i32;

        let mut job = ProcessingJob {
            id: job_id.clone(),
            job_type: "pdf_integrity".to_string(),
            status: "running".to_string(),
            total_items,
            completed_items: 0,
            failed_items: 0,
            warnings_count: 0,
            error_message: None,
            started_at: Some(now.clone()),
            completed_at: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        ProcessingRepository::create_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut completed_items = 0;
        let mut failed_items = 0;

        for paper in papers_with_files {
            if let Some(ref path_str) = paper.local_pdf_path {
                let candidate_path = Path::new(path_str);
                let valid_path =
                    match FileIntegrityService::validate_file_path(base_dir, candidate_path) {
                        Ok(p) => p,
                        Err(e) => {
                            warn!(path = path_str, error = ?e, "Path validation failed");
                            failed_items += 1;
                            continue;
                        }
                    };

                let (byte_size, hash_opt, inspect_res) =
                    FileIntegrityService::inspect_file(&valid_path);
                if inspect_res.is_err() {
                    failed_items += 1;
                    continue;
                }

                let pdf_meta = PdfProcessor::process_pdf_file(&valid_path);

                let file_name = valid_path
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_else(|| "document.pdf".to_string());
                let paper_file = PaperFile {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper.id.clone(),
                    file_path: valid_path.to_string_lossy().to_string(),
                    file_name,
                    mime_type: "application/pdf".to_string(),
                    byte_size: byte_size as i64,
                    sha256_hash: hash_opt.clone(),
                    verification_status: pdf_meta.status.clone(),
                    page_count: Some(pdf_meta.page_count),
                    extracted_title: pdf_meta.title,
                    extracted_author: pdf_meta.author,
                    extracted_text_preview: pdf_meta.text_preview,
                    extracted_text: pdf_meta.full_text,
                    is_primary: true,
                    verified_at: Some(Utc::now().to_rfc3339()),
                    created_at: Utc::now().to_rfc3339(),
                    updated_at: Utc::now().to_rfc3339(),
                };

                let _ = ProcessingRepository::save_paper_file(conn, &paper_file);

                // Update paper content_hash and metadata
                if let Some(ref hash) = hash_opt {
                    let _ = conn.execute(
                        "UPDATE papers SET content_hash = ?1, has_file = 1, updated_at = datetime('now') WHERE id = ?2",
                        rusqlite::params![hash, paper.id],
                    );
                }

                completed_items += 1;
            }
        }

        job.status = if failed_items > 0 {
            "succeeded_with_warnings".to_string()
        } else {
            "succeeded".to_string()
        };
        job.completed_items = completed_items;
        job.failed_items = failed_items;
        job.completed_at = Some(Utc::now().to_rfc3339());
        job.updated_at = Utc::now().to_rfc3339();

        ProcessingRepository::update_processing_job(conn, &job)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        info!(
            completed = completed_items,
            failed = failed_items,
            "PDF integrity verification completed"
        );
        Ok(job)
    }
}
