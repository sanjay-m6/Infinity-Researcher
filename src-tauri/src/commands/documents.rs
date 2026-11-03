use tauri::State;

use crate::domain::export::DocumentInspectionStatus;
use crate::domain::pdf_workspace::{
    BulkDownloadRequest, BulkDownloadSummary, CleanOrphanedResult, DownloadJob,
    DownloadStorageMetrics, EnqueueDownloadInput, PaperPdfInfo, PdfResolutionResult, ReaderState,
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
    let direct_candidate = std::path::PathBuf::from(paper_id.trim());
    let resolved_path = if direct_candidate.exists() && direct_candidate.is_file() {
        direct_candidate
    } else {
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
        if candidate_path.is_absolute() {
            candidate_path
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join(&candidate_path)
        }
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

    // Verify %PDF- signature
    use std::io::Read;
    let mut f = std::fs::File::open(&canonical).map_err(|e| {
        CommandError::new(
            "IO_ERROR",
            format!("Cannot open file for reading: {}", e),
            false,
        )
    })?;
    let mut header = [0u8; 1024];
    let n = f.read(&mut header).map_err(|e| {
        CommandError::new("IO_ERROR", format!("Cannot read file header: {}", e), false)
    })?;
    let header_str = String::from_utf8_lossy(&header[..n]);
    if !header_str.contains("%PDF-") {
        return Err(CommandError::new(
            "INVALID_PDF_SIGNATURE",
            "The selected file does not contain a valid %PDF- header signature.",
            false,
        ));
    }

    let bytes = std::fs::read(&canonical).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Failed to read PDF file bytes: {}", e),
            true,
        )
    })?;

    Ok(tauri::ipc::Response::new(bytes))
}

/// Extracts rich metadata and structural text from a local PDF without mutating library state
#[tauri::command]
pub async fn extract_pdf_metadata(
    file_path: String,
) -> Result<crate::services::pdf_processor::ExtractedPdfMetadata, CommandError> {
    let clean_path = std::path::PathBuf::from(file_path.trim());
    if !clean_path.exists() || !clean_path.is_file() {
        return Err(CommandError::new(
            "FILE_NOT_FOUND",
            format!(
                "Specified PDF file does not exist: {}",
                clean_path.display()
            ),
            false,
        ));
    }

    // Verify %PDF- signature
    use std::io::Read;
    let mut f = std::fs::File::open(&clean_path).map_err(|e| {
        CommandError::new(
            "IO_ERROR",
            format!("Cannot open file for reading: {}", e),
            false,
        )
    })?;
    let mut header = [0u8; 1024];
    let n = f.read(&mut header).map_err(|e| {
        CommandError::new("IO_ERROR", format!("Cannot read file header: {}", e), false)
    })?;
    let header_str = String::from_utf8_lossy(&header[..n]);
    if !header_str.contains("%PDF-") {
        return Err(CommandError::new(
            "INVALID_PDF_SIGNATURE",
            "The selected file is not a valid PDF (%PDF- header missing).",
            false,
        ));
    }

    let meta = crate::services::pdf_processor::PdfProcessor::process_pdf_file(&clean_path);
    Ok(meta)
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: EnqueueDownloadInput,
) -> Result<DownloadJob, CommandError> {
    state.download_manager.set_app_handle(app).await;
    state
        .download_manager
        .enqueue(input)
        .await
        .map_err(Into::into)
}

/// Enqueues multiple selected papers for batch PDF download
#[tauri::command]
pub async fn enqueue_bulk_pdf_downloads(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: BulkDownloadRequest,
) -> Result<BulkDownloadSummary, CommandError> {
    state.download_manager.set_app_handle(app).await;
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

/// Deletes a single download job record from history
#[tauri::command]
pub async fn delete_pdf_download_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<usize, CommandError> {
    state
        .download_manager
        .delete_job(&job_id)
        .map_err(Into::into)
}

/// Retrieves disk storage metrics for downloaded PDFs and temporary parts
#[tauri::command]
pub async fn get_download_storage_metrics(
    state: State<'_, AppState>,
) -> Result<DownloadStorageMetrics, CommandError> {
    state
        .download_manager
        .get_storage_metrics()
        .map_err(Into::into)
}

/// Safely purges orphaned `.part` and temporary files not tied to active downloads
#[tauri::command]
pub async fn clean_orphaned_downloads(
    state: State<'_, AppState>,
) -> Result<CleanOrphanedResult, CommandError> {
    state
        .download_manager
        .clean_orphaned_downloads()
        .await
        .map_err(Into::into)
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
