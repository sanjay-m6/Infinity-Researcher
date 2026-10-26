use std::path::PathBuf;
use tauri::State;

use crate::domain::processing::{
    DuplicateComparisonView, MergeRequest, MergeResult, PaperFile, PaperIdentifier, ProcessingJob,
    ProcessingOverview,
};
use crate::errors::{AppError, CommandError};
use crate::repositories::paper_repo::PaperRepository;
use crate::repositories::processing_repo::ProcessingRepository;
use crate::services::paper_merger::PaperMerger;
use crate::services::processing_pipeline::ProcessingPipeline;
use crate::state::AppState;

#[tauri::command]
pub async fn get_processing_overview(
    state: State<'_, AppState>,
) -> Result<ProcessingOverview, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingRepository::get_processing_overview(&conn)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

#[tauri::command]
pub async fn start_metadata_normalization(
    state: State<'_, AppState>,
) -> Result<ProcessingJob, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingPipeline::run_metadata_normalization(&conn)
        .map_err(|e| CommandError::new("ERR_PIPELINE", e.to_string(), false))
}

#[tauri::command]
pub async fn start_duplicate_scan(
    state: State<'_, AppState>,
) -> Result<ProcessingJob, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingPipeline::run_duplicate_scan(&conn)
        .map_err(|e| CommandError::new("ERR_PIPELINE", e.to_string(), false))
}

#[tauri::command]
pub async fn start_pdf_verification(
    state: State<'_, AppState>,
) -> Result<ProcessingJob, CommandError> {
    let base_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingPipeline::run_pdf_verification(&conn, &base_dir)
        .map_err(|e| CommandError::new("ERR_PIPELINE", e.to_string(), false))
}

#[tauri::command]
pub async fn list_duplicate_candidates(
    state: State<'_, AppState>,
    status: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<Vec<DuplicateComparisonView>, CommandError> {
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50).clamp(1, 100);
    let offset = (p - 1) * ps;

    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    let candidates =
        ProcessingRepository::list_duplicate_candidates(&conn, status.as_deref(), ps, offset)
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    let mut views = Vec::new();
    for c in candidates {
        let paper_a_opt = PaperRepository::get_by_id(&conn, &c.paper_a_id)
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
        let paper_b_opt = PaperRepository::get_by_id(&conn, &c.paper_b_id)
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

        if let (Some(paper_a), Some(paper_b)) = (paper_a_opt, paper_b_opt) {
            let mut conflicts = Vec::new();
            if paper_a.canonical_doi.is_some()
                && paper_b.canonical_doi.is_some()
                && paper_a.canonical_doi != paper_b.canonical_doi
            {
                conflicts.push("DOI Conflict".to_string());
            }
            if paper_a.publication_year.is_some()
                && paper_b.publication_year.is_some()
                && (paper_a.publication_year.unwrap() - paper_b.publication_year.unwrap()).abs() > 1
            {
                conflicts.push("Publication Year Mismatch".to_string());
            }
            if !paper_a.authors.is_empty()
                && !paper_b.authors.is_empty()
                && paper_a.authors[0].full_name != paper_b.authors[0].full_name
            {
                conflicts.push("First Author Discrepancy".to_string());
            }

            views.push(DuplicateComparisonView {
                candidate_id: c.id,
                score: c.score,
                match_tier: c.match_tier,
                evidence: c.evidence,
                status: c.status,
                paper_a,
                paper_b,
                conflicting_fields: conflicts,
            });
        }
    }

    Ok(views)
}

#[tauri::command]
pub async fn resolve_duplicate_candidate(
    state: State<'_, AppState>,
    candidate_id: String,
    decision: String, // "kept_separate", "deferred"
    notes: Option<String>,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingRepository::update_candidate_status(&conn, &candidate_id, &decision, notes.as_deref())
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

#[tauri::command]
pub async fn merge_papers(
    state: State<'_, AppState>,
    request: MergeRequest,
) -> Result<MergeResult, CommandError> {
    let db = state.db()?;
    let mut conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    PaperMerger::merge_papers(&mut conn, &request).map_err(|e| match e {
        AppError::Validation(m) => CommandError::new("ERR_VALIDATION", m, false),
        other => CommandError::new("ERR_MERGE", other.to_string(), false),
    })
}

#[tauri::command]
pub async fn list_paper_files(
    state: State<'_, AppState>,
    paper_id: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<Vec<PaperFile>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    if let Some(pid) = paper_id {
        ProcessingRepository::get_files_for_paper(&conn, &pid)
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
    } else {
        let p = page.unwrap_or(1).max(1);
        let ps = page_size.unwrap_or(50).clamp(1, 100);
        let offset = (p - 1) * ps;
        ProcessingRepository::list_all_files(&conn, ps, offset)
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
    }
}

#[tauri::command]
pub async fn list_processing_jobs(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<ProcessingJob>, CommandError> {
    let l = limit.unwrap_or(20).clamp(1, 50);
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingRepository::list_processing_jobs(&conn, l)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

#[tauri::command]
pub async fn get_paper_identifiers(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<Vec<PaperIdentifier>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    ProcessingRepository::get_identifiers_for_paper(&conn, &paper_id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}
