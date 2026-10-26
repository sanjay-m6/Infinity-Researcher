use tauri::State;

use crate::domain::export::DocumentInspectionStatus;
use crate::domain::pdf_workspace::{
    BulkDownloadRequest, BulkDownloadSummary, DownloadJob, EnqueueDownloadInput, PaperPdfInfo,
    PdfResolutionResult, ReaderState,
};
use crate::errors::CommandError;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::services::{DocumentService, PdfResolverService};
use crate::state::AppState;

/// Inspects basic document status (legacy Phase 8 inspection)
#[tauri::command]
pub async fn get_paper_document_status(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<DocumentInspectionStatus, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    DocumentService::get_document_status(&conn, &paper_id).map_err(Into::into)
}

/// Secondary action: Launches system default application (Explorer/default PDF viewer)
#[tauri::command]
pub async fn open_paper_document(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<String, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    DocumentService::open_local_document(&conn, &paper_id).map_err(Into::into)
}

/// Primary embedded action: Securely reads local PDF bytes for embedded reader via binary IPC
#[tauri::command]
pub async fn read_paper_pdf(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<tauri::ipc::Response, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;

    let file_path_str: String = conn
        .query_row(
            "SELECT file_path FROM paper_files WHERE paper_id = ?1
             UNION ALL
             SELECT local_pdf_path FROM papers WHERE id = ?1 AND local_pdf_path IS NOT NULL
             LIMIT 1",
            [&paper_id],
            |r| r.get(0),
        )
        .map_err(|_| {
            CommandError::new(
                "FILE_MISSING",
                format!("No document attached to paper {}", paper_id),
                false,
            )
        })?;

    let candidate_path = std::path::PathBuf::from(&file_path_str);
    let resolved_path = if candidate_path.is_absolute() {
        candidate_path
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join(&candidate_path)
    };

    if !resolved_path.exists() {
        return Err(CommandError::new(
            "FILE_MISSING",
            format!(
                "PDF file does not exist on disk: {}",
                resolved_path.display()
            ),
            false,
        ));
    }

    let canonical = resolved_path.canonicalize().map_err(|e| {
        CommandError::new(
            "SECURITY_ERROR",
            format!("Cannot resolve canonical document path: {}", e),
            false,
        )
    })?;

    let bytes = std::fs::read(&canonical).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Failed to read PDF file bytes: {}", e),
            true,
        )
    })?;

    Ok(tauri::ipc::Response::new(bytes))
}

/// Retrieves consolidated PDF information (file details, verification status, reader state)
#[tauri::command]
pub async fn get_paper_pdf_info(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<PaperPdfInfo, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    PdfWorkspaceRepository::get_paper_pdf_info(&conn, &paper_id).map_err(Into::into)
}

/// Runs legal PDF resolution sequence across open-access providers and publisher metadata
#[tauri::command]
pub async fn resolve_paper_pdf(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<PdfResolutionResult, CommandError> {
    let db = state.db()?;
    let client = reqwest::Client::new();

    PdfResolverService::resolve_for_paper(db, &client, &paper_id)
        .await
        .map_err(Into::into)
}

/// Enqueues a single PDF download into the background queue
#[tauri::command]
pub async fn enqueue_pdf_download(
    state: State<'_, AppState>,
    input: EnqueueDownloadInput,
) -> Result<DownloadJob, CommandError> {
    state
        .download_manager
        .enqueue(input)
        .await
        .map_err(Into::into)
}

/// Enqueues multiple selected papers for batch PDF download
#[tauri::command]
pub async fn enqueue_bulk_pdf_downloads(
    state: State<'_, AppState>,
    request: BulkDownloadRequest,
) -> Result<BulkDownloadSummary, CommandError> {
    state
        .download_manager
        .enqueue_bulk(request.paper_ids)
        .await
        .map_err(Into::into)
}

/// Cancels an active or queued download job
#[tauri::command]
pub async fn cancel_pdf_download(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), CommandError> {
    state
        .download_manager
        .cancel(&job_id)
        .await
        .map_err(Into::into)
}

/// Retries a failed or cancelled download job
#[tauri::command]
pub async fn retry_pdf_download(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<DownloadJob, CommandError> {
    state
        .download_manager
        .retry(&job_id)
        .await
        .map_err(Into::into)
}

/// Lists all download jobs with their progress and status
#[tauri::command]
pub async fn list_pdf_download_jobs(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<DownloadJob>, CommandError> {
    state
        .download_manager
        .list_jobs(limit.unwrap_or(50))
        .map_err(Into::into)
}

/// Clears completed and cancelled jobs from the download history
#[tauri::command]
pub async fn clear_completed_pdf_downloads(
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    state.download_manager.clear_completed().map_err(Into::into)
}

/// Persists reading progress, page position, zoom, and rotation
#[tauri::command]
pub async fn save_reader_state(
    state: State<'_, AppState>,
    input: ReaderState,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    PdfWorkspaceRepository::save_reader_state(&conn, &input).map_err(Into::into)
}

/// Retrieves saved reading progress for a paper
#[tauri::command]
pub async fn get_reader_state(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<Option<ReaderState>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_LOCK", e.to_string(), true))?;
    PdfWorkspaceRepository::get_reader_state(&conn, &paper_id).map_err(Into::into)
}
