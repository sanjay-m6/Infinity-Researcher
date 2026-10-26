use tauri::State;

use crate::domain::integrity::*;
use crate::errors::CommandError;
use crate::services::IntegrityService;
use crate::state::AppState;

#[tauri::command]
pub async fn ingest_integrity_document(
    state: State<'_, AppState>,
    source_type: String,
    file_name: String,
    file_format: Option<String>,
    content_or_path: String,
) -> Result<IntegrityDocument, CommandError> {
    let db = state.db()?;
    IntegrityService::ingest_document(
        db,
        &source_type,
        &file_name,
        file_format.as_deref(),
        &content_or_path,
    )
    .map_err(Into::into)
}

#[tauri::command]
pub async fn get_integrity_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<IntegrityDocument>, CommandError> {
    let db = state.db()?;
    IntegrityService::get_document(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn list_integrity_documents(
    state: State<'_, AppState>,
) -> Result<Vec<IntegrityDocument>, CommandError> {
    let db = state.db()?;
    IntegrityService::list_documents(db).map_err(Into::into)
}

#[tauri::command]
pub async fn index_corpus_source(
    state: State<'_, AppState>,
    source_type: String,
    title: String,
    content: String,
    authors: Option<String>,
    doi: Option<String>,
    canonical_url: Option<String>,
    file_path: Option<String>,
) -> Result<CorpusSource, CommandError> {
    let db = state.db()?;
    IntegrityService::index_corpus_source(
        db,
        &source_type,
        &title,
        &content,
        authors.as_deref(),
        doi.as_deref(),
        canonical_url.as_deref(),
        file_path.as_deref(),
    )
    .map_err(Into::into)
}

#[tauri::command]
pub async fn index_saved_library_papers(
    state: State<'_, AppState>,
) -> Result<i64, CommandError> {
    let db = state.db()?;
    IntegrityService::index_library_papers(db).map_err(Into::into)
}

#[tauri::command]
pub async fn list_corpus_sources(
    state: State<'_, AppState>,
) -> Result<Vec<CorpusSource>, CommandError> {
    let db = state.db()?;
    IntegrityService::list_corpus_sources(db).map_err(Into::into)
}

#[tauri::command]
pub async fn delete_corpus_source(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    IntegrityService::delete_corpus_source(db, &id).map_err(Into::into)
}

#[tauri::command]
pub async fn run_similarity_check(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<SimilarityReport, CommandError> {
    let db = state.db()?;
    IntegrityService::run_similarity_check(db, &document_id).map_err(Into::into)
}

#[tauri::command]
pub async fn get_similarity_report(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<Option<SimilarityReport>, CommandError> {
    let db = state.db()?;
    IntegrityService::get_similarity_report(db, &run_id).map_err(Into::into)
}

#[tauri::command]
pub async fn update_match_review_status(
    state: State<'_, AppState>,
    match_id: String,
    status: String,
    notes: Option<String>,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    IntegrityService::update_match_review_status(db, &match_id, &status, notes.as_deref())
        .map_err(Into::into)
}

#[tauri::command]
pub async fn run_ai_signal_check(
    state: State<'_, AppState>,
    document_id: String,
    model_id: Option<String>,
) -> Result<AiSignalRun, CommandError> {
    let db = state.db()?;
    IntegrityService::run_ai_signal_check(db, &document_id, model_id.as_deref())
        .map_err(Into::into)
}

#[tauri::command]
pub async fn create_writing_session(
    state: State<'_, AppState>,
    document_id: String,
    title: String,
) -> Result<WritingSession, CommandError> {
    let db = state.db()?;
    IntegrityService::create_writing_session(db, &document_id, &title).map_err(Into::into)
}

#[tauri::command]
pub async fn generate_writing_revision(
    state: State<'_, AppState>,
    session_id: String,
    action_type: String,
    custom_revised_text: Option<String>,
) -> Result<WritingRevision, CommandError> {
    let db = state.db()?;
    IntegrityService::generate_writing_revision(
        db,
        &session_id,
        &action_type,
        custom_revised_text,
    )
    .map_err(Into::into)
}

#[tauri::command]
pub async fn accept_writing_revision(
    state: State<'_, AppState>,
    revision_id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    IntegrityService::accept_writing_revision(db, &revision_id).map_err(Into::into)
}

#[tauri::command]
pub async fn list_writing_revisions(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<WritingRevision>, CommandError> {
    let db = state.db()?;
    IntegrityService::list_writing_revisions(db, &session_id).map_err(Into::into)
}

#[tauri::command]
pub async fn get_integrity_dashboard_summary(
    state: State<'_, AppState>,
) -> Result<IntegrityDashboardSummary, CommandError> {
    let db = state.db()?;
    IntegrityService::get_dashboard_summary(db).map_err(Into::into)
}
