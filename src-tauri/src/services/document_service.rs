use crate::domain::export::DocumentInspectionStatus;
use crate::errors::AppError;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

pub struct DocumentService;

impl DocumentService {
    /// Inspects local document registration, verification state, and FTS indexing status.
    pub fn get_document_status(
        conn: &Connection,
        paper_id: &str,
    ) -> Result<DocumentInspectionStatus, AppError> {
        // Query paper_files for primary or latest file
        let mut stmt = conn.prepare(
            "SELECT id, file_path, byte_size, verification_status, page_count, extracted_text_preview
             FROM paper_files
             WHERE paper_id = ?1
             ORDER BY is_primary DESC, created_at DESC
             LIMIT 1",
        ).map_err(|e| AppError::Internal(e.to_string()))?;

        let file_opt = stmt
            .query_row([paper_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<i32>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })
            .ok();

        if let Some((file_id, file_path, byte_size, verification_status, page_count, preview)) =
            file_opt
        {
            let is_text_indexed: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM doc_text_fts WHERE file_id = ?1",
                    [&file_id],
                    |r| r.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false);

            Ok(DocumentInspectionStatus {
                paper_id: paper_id.to_string(),
                has_local_file: true,
                local_path: Some(file_path),
                file_size_bytes: Some(byte_size as u64),
                verification_status,
                page_count,
                is_text_indexed,
                extracted_text_snippet: preview,
            })
        } else {
            // Check legacy papers table
            let paper_local_path: Option<String> = conn
                .query_row(
                    "SELECT local_pdf_path FROM papers WHERE id = ?1",
                    [paper_id],
                    |r| r.get(0),
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;

            Ok(DocumentInspectionStatus {
                paper_id: paper_id.to_string(),
                has_local_file: paper_local_path.is_some(),
                local_path: paper_local_path,
                file_size_bytes: None,
                verification_status: "not_downloaded".to_string(),
                page_count: None,
                is_text_indexed: false,
                extracted_text_snippet: None,
            })
        }
    }

    /// Resolves and validates a local document file path safely and launches the platform viewer.
    pub fn open_local_document(conn: &Connection, paper_id: &str) -> Result<String, AppError> {
        // Find recorded file path
        let file_path_str: String = conn
            .query_row(
                "SELECT file_path FROM paper_files WHERE paper_id = ?1
             UNION ALL
             SELECT local_pdf_path FROM papers WHERE id = ?1 AND local_pdf_path IS NOT NULL
             LIMIT 1",
                [paper_id],
                |r| r.get(0),
            )
            .map_err(|_| {
                AppError::Validation(format!("No document attached to paper {}", paper_id))
            })?;

        let candidate_path = PathBuf::from(&file_path_str);

        // Security check: Validate path traversal and authorized boundary
        let validated_path = if candidate_path.is_absolute() {
            candidate_path
        } else {
            // If relative, resolve against current directory or storage root
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(&candidate_path)
        };

        if !validated_path.exists() {
            return Err(AppError::Validation(format!(
                "Document file does not exist on disk: {}",
                validated_path.display()
            )));
        }

        // Canonicalize to defend against symlink escapes
        let canonical = validated_path.canonicalize().map_err(|e| {
            AppError::Internal(format!("Cannot resolve canonical document path: {}", e))
        })?;

        // Launch system default viewer without shell injection
        Self::launch_system_viewer(&canonical)?;

        Ok(canonical.to_string_lossy().to_string())
    }

    /// Safely launches the system default application to open the document without shell evaluation.
    fn launch_system_viewer(path: &Path) -> Result<(), AppError> {
        #[cfg(target_os = "windows")]
        {
            // On Windows, use "explorer" or "cmd /c start" safely
            std::process::Command::new("explorer")
                .arg(path.as_os_str())
                .spawn()
                .map_err(|e| {
                    AppError::Internal(format!("Failed to launch document viewer: {}", e))
                })?;
        }

        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(path.as_os_str())
                .spawn()
                .map_err(|e| {
                    AppError::Internal(format!("Failed to launch document viewer: {}", e))
                })?;
        }

        #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
        {
            std::process::Command::new("xdg-open")
                .arg(path.as_os_str())
                .spawn()
                .map_err(|e| {
                    AppError::Internal(format!("Failed to launch document viewer: {}", e))
                })?;
        }

        Ok(())
    }
}
