use std::io::Read;
use tauri::State;

use crate::domain::ieee::{
    IeeeManualImportInput, ImportPdfResult, LocalOaPdfImportInput, OpenAccessStats,
};
use crate::domain::note::NoteSaveInput;
use crate::domain::paper::{
    compute_clean_title_key, normalize_doi, Author, Paper, PaperListQuery,
    EVIDENCE_USER_CONFIRMATION, OA_STATUS_USER_CONFIRMED, RETRIEVAL_IEEE_MANUAL,
    RETRIEVAL_LOCAL_IMPORT,
};
use crate::errors::CommandError;
use crate::repositories::paper_repo::PaperRepository;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::services::{FileIntegrityService, NoteService, PdfProcessor};
use crate::state::AppState;

/// Mode A: Imports an IEEE Xplore Open Access PDF manually downloaded by the user.
///
/// COMPLIANCE POLICY GUARANTEE:
/// 1. Zero network requests are made to IEEE Xplore (`https://ieeexplore.ieee.org/`).
/// 2. Requires `input.user_confirmed_oa == true` affirming the user has verified Open Access status in IEEE Xplore.
/// 3. Validates file integrity, enforces size limits (<= 100MB), and verifies `%PDF-` signature.
/// 4. Computes SHA-256 for cryptographic deduplication.
/// 5. Stores paper with status strictly as `user_confirmed_open_access` (evidence: `user_confirmation`).
#[tauri::command]
pub async fn import_ieee_paper(
    state: State<'_, AppState>,
    input: IeeeManualImportInput,
) -> Result<ImportPdfResult, CommandError> {
    // 1. Enforce strict Open Access user confirmation policy
    if !input.user_confirmed_oa {
        return Err(CommandError::new(
            "OA_CONFIRMATION_REQUIRED",
            "You must confirm that this paper is marked as Open Access on IEEE Xplore. Under IEEE terms, intelligent agents are restricted from automated scraping or downloads, and users must verify Open Access status before local import.",
            false,
        ));
    }

    // 2. Validate file existence and file characteristics
    let raw_path = std::path::PathBuf::from(input.file_path.trim());
    if !raw_path.exists() {
        return Err(CommandError::new(
            "FILE_NOT_FOUND",
            format!(
                "The specified PDF file was not found: {}",
                raw_path.display()
            ),
            false,
        ));
    }
    if !raw_path.is_file() {
        return Err(CommandError::new(
            "INVALID_PATH",
            format!(
                "The specified path is not a regular file: {}",
                raw_path.display()
            ),
            false,
        ));
    }

    // 3. Inspect file size and compute streaming SHA-256
    let (file_size, hash_opt, inspect_res) = FileIntegrityService::inspect_file(&raw_path);
    if let Err(err) = inspect_res {
        return Err(CommandError::new("FILE_INSPECTION_FAILED", err, false));
    }
    let content_hash = hash_opt.ok_or_else(|| {
        CommandError::new("HASH_ERROR", "Failed to compute SHA-256 hash of PDF", false)
    })?;

    // 4. Verify %PDF- magic signature to reject non-PDFs (e.g. HTML error pages)
    let mut f = std::fs::File::open(&raw_path).map_err(|e| {
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
            "The selected file does not contain a valid %PDF- header signature. Non-PDF files (e.g. paywall HTML or corrupt downloads) cannot be imported.",
            false,
        ));
    }

    let db = state.db()?;

    // 5. Cryptographic SHA-256 deduplication check
    {
        let conn = db
            .lock()
            .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

        if let Some(existing) = PaperRepository::get_by_content_hash(&conn, &content_hash)
            .map_err(|e| CommandError::new("DB_ERROR", e.to_string(), true))?
        {
            tracing::info!(
                existing_id = %existing.id,
                hash = %content_hash,
                "Duplicate PDF detected via SHA-256 match"
            );
            return Ok(ImportPdfResult {
                paper: existing.clone(),
                is_duplicate: true,
                duplicate_paper_id: Some(existing.id),
                file_size_bytes: file_size,
                content_hash,
                storage_path: existing.local_pdf_path.unwrap_or_default(),
            });
        }
    }

    // 6. Safe local PDF storage directory setup
    let config = state.config.read().await;
    let storage_dir = config.default_library_dir.clone();
    drop(config);

    std::fs::create_dir_all(&storage_dir).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Failed to create paper storage directory: {}", e),
            true,
        )
    })?;

    let paper_id = uuid::Uuid::new_v4().to_string();
    let target_filename = format!("{}.pdf", paper_id);
    let dest_path = storage_dir.join(&target_filename);

    std::fs::copy(&raw_path, &dest_path).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Failed to copy PDF into application storage: {}", e),
            true,
        )
    })?;

    // 7. Extract structural metadata from PDF
    let pdf_meta = PdfProcessor::process_pdf_file(&dest_path);
    let page_count = if pdf_meta.page_count > 0 {
        Some(pdf_meta.page_count)
    } else {
        None
    };

    let title = if input.title.trim().is_empty() {
        pdf_meta.title.unwrap_or_else(|| {
            raw_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        })
    } else {
        input.title.trim().to_string()
    };

    let clean_title = compute_clean_title_key(&title);
    let normalized_doi = input.canonical_doi.as_deref().and_then(normalize_doi);
    let now = chrono::Utc::now().to_rfc3339();

    let authors: Vec<Author> = if input.authors.is_empty() {
        if let Some(a_name) = pdf_meta.author {
            vec![Author {
                id: uuid::Uuid::new_v4().to_string(),
                full_name: a_name.trim().to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: 0,
                created_at: now.clone(),
            }]
        } else {
            Vec::new()
        }
    } else {
        input
            .authors
            .into_iter()
            .enumerate()
            .map(|(idx, name)| Author {
                id: uuid::Uuid::new_v4().to_string(),
                full_name: name.trim().to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: idx as i32,
                created_at: now.clone(),
            })
            .collect()
    };

    let paper = Paper {
        id: paper_id.clone(),
        canonical_doi: normalized_doi,
        title,
        clean_title_key: clean_title,
        abstract_text: None,
        publication_date: input.publication_year.map(|y| format!("{}-01-01", y)),
        publication_year: input.publication_year,
        venue: input.venue.map(|v| v.trim().to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: true,
        license: input.license_name.clone(),
        primary_landing_url: input.source_page_url.clone(),
        pdf_url: None,
        has_file: true,
        local_pdf_path: Some(dest_path.to_string_lossy().to_string()),
        content_hash: Some(content_hash.clone()),
        metadata_confidence: "user_verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: OA_STATUS_USER_CONFIRMED.to_string(),
        access_evidence_type: EVIDENCE_USER_CONFIRMATION.to_string(),
        access_evidence_note: Some(
            "Imported via IEEE Open Access manual discovery workflow with user confirmation"
                .to_string(),
        ),
        license_name: input.license_name,
        license_url: input.license_url,
        source_name: Some("IEEE Xplore (Manual OA Import)".to_string()),
        retrieval_method: RETRIEVAL_IEEE_MANUAL.to_string(),
        access_confirmed_at: Some(now.clone()),
        authors,
        collection_ids: input.target_collection_id.into_iter().collect(),
        tags: vec!["IEEE".to_string(), "Open Access".to_string()],
        source_names: vec!["IEEE Xplore".to_string()],
    };

    // 8. Atomic insertion and document registration
    {
        let mut conn = db
            .lock()
            .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

        PaperRepository::create(&mut conn, &paper).map_err(|e| {
            CommandError::new("DB_ERROR", format!("Failed to create paper: {}", e), true)
        })?;

        PdfWorkspaceRepository::attach_downloaded_file(
            &conn,
            &paper_id,
            &dest_path.to_string_lossy(),
            &target_filename,
            file_size,
            &content_hash,
            page_count,
        )
        .map_err(|e| {
            CommandError::new("DB_ERROR", format!("Failed to attach file: {}", e), true)
        })?;

        // Optional user notes insertion
        if let Some(ref note_content) = input.user_notes {
            if !note_content.trim().is_empty() {
                let note_input = NoteSaveInput {
                    id: None,
                    paper_id: paper_id.clone(),
                    title: Some("Import Notes".to_string()),
                    content_markdown: note_content.trim().to_string(),
                };
                let _ = NoteService::save_note(db, note_input);
            }
        }
    }

    Ok(ImportPdfResult {
        paper,
        is_duplicate: false,
        duplicate_paper_id: None,
        file_size_bytes: file_size,
        content_hash,
        storage_path: dest_path.to_string_lossy().to_string(),
    })
}

/// Mode C: General manual local PDF import with user Open Access confirmation.
#[tauri::command]
pub async fn import_local_oa_pdf(
    state: State<'_, AppState>,
    input: LocalOaPdfImportInput,
) -> Result<ImportPdfResult, CommandError> {
    if !input.user_confirmed_oa {
        return Err(CommandError::new(
            "OA_CONFIRMATION_REQUIRED",
            "Open Access confirmation is required to import this paper into your Open Access workspace.",
            false,
        ));
    }

    let raw_path = std::path::PathBuf::from(input.file_path.trim());
    if !raw_path.exists() {
        return Err(CommandError::new(
            "FILE_NOT_FOUND",
            format!(
                "The specified PDF file was not found: {}",
                raw_path.display()
            ),
            false,
        ));
    }
    if !raw_path.is_file() {
        return Err(CommandError::new(
            "INVALID_PATH",
            format!("The specified path is not a file: {}", raw_path.display()),
            false,
        ));
    }

    let (file_size, hash_opt, inspect_res) = FileIntegrityService::inspect_file(&raw_path);
    if let Err(err) = inspect_res {
        return Err(CommandError::new("FILE_INSPECTION_FAILED", err, false));
    }
    let content_hash = hash_opt
        .ok_or_else(|| CommandError::new("HASH_ERROR", "Failed to compute SHA-256 hash", false))?;

    // Verify %PDF- signature
    let mut f = std::fs::File::open(&raw_path)
        .map_err(|e| CommandError::new("IO_ERROR", format!("Cannot open file: {}", e), false))?;
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

    let db = state.db()?;

    // Check duplicate
    {
        let conn = db
            .lock()
            .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

        if let Some(existing) = PaperRepository::get_by_content_hash(&conn, &content_hash)
            .map_err(|e| CommandError::new("DB_ERROR", e.to_string(), true))?
        {
            return Ok(ImportPdfResult {
                paper: existing.clone(),
                is_duplicate: true,
                duplicate_paper_id: Some(existing.id),
                file_size_bytes: file_size,
                content_hash,
                storage_path: existing.local_pdf_path.unwrap_or_default(),
            });
        }
    }

    // Storage
    let config = state.config.read().await;
    let storage_dir = config.default_library_dir.clone();
    drop(config);

    std::fs::create_dir_all(&storage_dir).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Cannot create storage dir: {}", e),
            true,
        )
    })?;

    let paper_id = uuid::Uuid::new_v4().to_string();
    let target_filename = format!("{}.pdf", paper_id);
    let dest_path = storage_dir.join(&target_filename);

    std::fs::copy(&raw_path, &dest_path).map_err(|e| {
        CommandError::new(
            "STORAGE_ERROR",
            format!("Failed to copy PDF file: {}", e),
            true,
        )
    })?;

    let pdf_meta = PdfProcessor::process_pdf_file(&dest_path);
    let page_count = if pdf_meta.page_count > 0 {
        Some(pdf_meta.page_count)
    } else {
        None
    };

    let title = if input.title.trim().is_empty() {
        pdf_meta.title.unwrap_or_else(|| {
            raw_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        })
    } else {
        input.title.trim().to_string()
    };

    let clean_title = compute_clean_title_key(&title);
    let normalized_doi = input.canonical_doi.as_deref().and_then(normalize_doi);
    let now = chrono::Utc::now().to_rfc3339();

    let authors: Vec<Author> = if input.authors.is_empty() {
        if let Some(a_name) = pdf_meta.author {
            vec![Author {
                id: uuid::Uuid::new_v4().to_string(),
                full_name: a_name.trim().to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: 0,
                created_at: now.clone(),
            }]
        } else {
            Vec::new()
        }
    } else {
        input
            .authors
            .into_iter()
            .enumerate()
            .map(|(idx, name)| Author {
                id: uuid::Uuid::new_v4().to_string(),
                full_name: name.trim().to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: idx as i32,
                created_at: now.clone(),
            })
            .collect()
    };

    let src_label = input
        .source_name
        .unwrap_or_else(|| "Local PDF Import".to_string());

    let paper = Paper {
        id: paper_id.clone(),
        canonical_doi: normalized_doi,
        title,
        clean_title_key: clean_title,
        abstract_text: None,
        publication_date: input.publication_year.map(|y| format!("{}-01-01", y)),
        publication_year: input.publication_year,
        venue: input.venue.map(|v| v.trim().to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: true,
        license: input.license_name.clone(),
        primary_landing_url: input.source_page_url.clone(),
        pdf_url: None,
        has_file: true,
        local_pdf_path: Some(dest_path.to_string_lossy().to_string()),
        content_hash: Some(content_hash.clone()),
        metadata_confidence: "user_verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: OA_STATUS_USER_CONFIRMED.to_string(),
        access_evidence_type: EVIDENCE_USER_CONFIRMATION.to_string(),
        access_evidence_note: Some(
            "Imported via local PDF file import with user Open Access confirmation".to_string(),
        ),
        license_name: input.license_name,
        license_url: input.license_url,
        source_name: Some(src_label.clone()),
        retrieval_method: RETRIEVAL_LOCAL_IMPORT.to_string(),
        access_confirmed_at: Some(now.clone()),
        authors,
        collection_ids: input.target_collection_id.into_iter().collect(),
        tags: vec!["Open Access".to_string(), "Local Import".to_string()],
        source_names: vec![src_label],
    };

    {
        let mut conn = db
            .lock()
            .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

        PaperRepository::create(&mut conn, &paper).map_err(|e| {
            CommandError::new("DB_ERROR", format!("Failed to create paper: {}", e), true)
        })?;

        PdfWorkspaceRepository::attach_downloaded_file(
            &conn,
            &paper_id,
            &dest_path.to_string_lossy(),
            &target_filename,
            file_size,
            &content_hash,
            page_count,
        )
        .map_err(|e| {
            CommandError::new("DB_ERROR", format!("Failed to attach file: {}", e), true)
        })?;

        if let Some(ref note_content) = input.user_notes {
            if !note_content.trim().is_empty() {
                let note_input = NoteSaveInput {
                    id: None,
                    paper_id: paper_id.clone(),
                    title: Some("Import Notes".to_string()),
                    content_markdown: note_content.trim().to_string(),
                };
                let _ = NoteService::save_note(db, note_input);
            }
        }
    }

    Ok(ImportPdfResult {
        paper,
        is_duplicate: false,
        duplicate_paper_id: None,
        file_size_bytes: file_size,
        content_hash,
        storage_path: dest_path.to_string_lossy().to_string(),
    })
}

/// Retrieves aggregate Open Access counts and repository integrity statistics.
#[tauri::command]
pub async fn get_open_access_stats(
    state: State<'_, AppState>,
) -> Result<OpenAccessStats, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

    PaperRepository::get_open_access_stats(&conn).map_err(CommandError::from)
}

/// Lists all Open Access papers, optionally filtering by status (`verified_open_access`, `user_confirmed_open_access`, etc.)
#[tauri::command]
pub async fn list_open_access_papers(
    state: State<'_, AppState>,
    status_filter: Option<String>,
) -> Result<Vec<Paper>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("DB_LOCK", e.to_string(), true))?;

    let query = PaperListQuery {
        open_access_only: Some(true),
        open_access_status: status_filter,
        page_size: Some(1000),
        ..Default::default()
    };

    let paged = PaperRepository::list(&conn, &query).map_err(CommandError::from)?;
    Ok(paged.items)
}
