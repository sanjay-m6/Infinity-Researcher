use chrono::Utc;
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

use crate::domain::pdf_workspace::{
    DownloadJob, PaperPdfInfo, PdfAvailabilityStatus, PdfCandidate, ReaderState,
};

pub struct PdfWorkspaceRepository;

impl PdfWorkspaceRepository {
    // ------------------------------------------------------------------------
    // Download Jobs
    // ------------------------------------------------------------------------

    pub fn create_download_job(conn: &Connection, job: &DownloadJob) -> Result<()> {
        conn.execute(
            "INSERT INTO download_jobs (
                id, paper_id, paper_title, url, source_id, status,
                bytes_downloaded, total_bytes, progress_percent,
                stage_message, error_message, destination_path,
                sha256_hash, retry_count, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                job.id,
                job.paper_id,
                job.paper_title,
                job.url,
                job.source_id,
                job.status,
                job.bytes_downloaded as i64,
                job.total_bytes as i64,
                job.progress_percent,
                job.stage_message,
                job.error_message,
                job.destination_path,
                job.sha256_hash,
                job.retry_count as i32,
                job.created_at,
                job.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_download_job(conn: &Connection, job: &DownloadJob) -> Result<()> {
        conn.execute(
            "UPDATE download_jobs SET
                status = ?1,
                bytes_downloaded = ?2,
                total_bytes = ?3,
                progress_percent = ?4,
                stage_message = ?5,
                error_message = ?6,
                destination_path = ?7,
                sha256_hash = ?8,
                retry_count = ?9,
                updated_at = ?10
            WHERE id = ?11",
            params![
                job.status,
                job.bytes_downloaded as i64,
                job.total_bytes as i64,
                job.progress_percent,
                job.stage_message,
                job.error_message,
                job.destination_path,
                job.sha256_hash,
                job.retry_count as i32,
                job.updated_at,
                job.id,
            ],
        )?;
        Ok(())
    }

    pub fn get_download_job(conn: &Connection, id: &str) -> Result<Option<DownloadJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, paper_title, url, source_id, status,
                    bytes_downloaded, total_bytes, progress_percent,
                    stage_message, error_message, destination_path,
                    sha256_hash, retry_count, created_at, updated_at
             FROM download_jobs
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::map_download_job_row(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_active_download_for_paper(
        conn: &Connection,
        paper_id: &str,
    ) -> Result<Option<DownloadJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, paper_title, url, source_id, status,
                    bytes_downloaded, total_bytes, progress_percent,
                    stage_message, error_message, destination_path,
                    sha256_hash, retry_count, created_at, updated_at
             FROM download_jobs
             WHERE paper_id = ?1 AND status IN ('queued', 'downloading')
             ORDER BY created_at DESC
             LIMIT 1",
        )?;

        let mut rows = stmt.query([paper_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::map_download_job_row(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn list_download_jobs(conn: &Connection, limit: u32) -> Result<Vec<DownloadJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, paper_title, url, source_id, status,
                    bytes_downloaded, total_bytes, progress_percent,
                    stage_message, error_message, destination_path,
                    sha256_hash, retry_count, created_at, updated_at
             FROM download_jobs
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit as i64], Self::map_download_job_row)?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn clear_completed_download_jobs(conn: &Connection) -> Result<usize> {
        let count = conn.execute(
            "DELETE FROM download_jobs WHERE status IN ('completed', 'cancelled')",
            [],
        )?;
        Ok(count)
    }

    pub fn recover_interrupted_jobs(conn: &Connection) -> Result<usize> {
        let now = Utc::now().to_rfc3339();
        let count = conn.execute(
            "UPDATE download_jobs
             SET status = 'failed',
                 stage_message = 'Interrupted by application restart',
                 error_message = 'Process terminated before download completed',
                 updated_at = ?1
             WHERE status IN ('downloading', 'queued')",
            params![now],
        )?;
        Ok(count)
    }

    fn map_download_job_row(row: &rusqlite::Row) -> Result<DownloadJob> {
        let bytes_dl: i64 = row.get(6)?;
        let bytes_tot: i64 = row.get(7)?;
        let retries: i32 = row.get(13)?;

        Ok(DownloadJob {
            id: row.get(0)?,
            paper_id: row.get(1)?,
            paper_title: row.get(2)?,
            url: row.get(3)?,
            source_id: row.get(4)?,
            status: row.get(5)?,
            bytes_downloaded: bytes_dl as u64,
            total_bytes: bytes_tot as u64,
            progress_percent: row.get(8)?,
            stage_message: row.get(9)?,
            error_message: row.get(10)?,
            destination_path: row.get(11)?,
            sha256_hash: row.get(12)?,
            retry_count: retries as u32,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    }

    // ------------------------------------------------------------------------
    // PDF Candidates
    // ------------------------------------------------------------------------

    pub fn save_pdf_candidate(conn: &Connection, candidate: &PdfCandidate) -> Result<()> {
        conn.execute(
            "INSERT INTO pdf_candidates (
                id, paper_id, url, provider_id, source_type,
                access_status, evidence_notes, last_checked_at, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                candidate.id,
                candidate.paper_id,
                candidate.url,
                candidate.provider_id,
                candidate.source_type,
                candidate.access_status.as_str(),
                candidate.evidence_notes,
                candidate.last_checked_at,
                candidate.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_pdf_candidates(conn: &Connection, paper_id: &str) -> Result<Vec<PdfCandidate>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, url, provider_id, source_type,
                    access_status, evidence_notes, last_checked_at, created_at
             FROM pdf_candidates
             WHERE paper_id = ?1
             ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([paper_id], |row| {
            let status_str: String = row.get(5)?;
            let status = match status_str.as_str() {
                "open_access_available" => PdfAvailabilityStatus::OpenAccessAvailable,
                "download_queued" => PdfAvailabilityStatus::DownloadQueued,
                "downloading" => PdfAvailabilityStatus::Downloading,
                "downloaded" => PdfAvailabilityStatus::Downloaded,
                "metadata_only" => PdfAvailabilityStatus::MetadataOnly,
                "landing_page_only" => PdfAvailabilityStatus::LandingPageOnly,
                "restricted_or_subscription" => PdfAvailabilityStatus::RestrictedOrSubscription,
                "authentication_required" => PdfAvailabilityStatus::AuthenticationRequired,
                "blocked_by_policy" => PdfAvailabilityStatus::BlockedByPolicy,
                "failed_retryable" => PdfAvailabilityStatus::FailedRetryable,
                "failed_permanent" => PdfAvailabilityStatus::FailedPermanent,
                "local_file_missing" => PdfAvailabilityStatus::LocalFileMissing,
                "file_corrupt" => PdfAvailabilityStatus::FileCorrupt,
                "not_found" => PdfAvailabilityStatus::NotFound,
                _ => PdfAvailabilityStatus::Unknown,
            };

            Ok(PdfCandidate {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                url: row.get(2)?,
                provider_id: row.get(3)?,
                source_type: row.get(4)?,
                access_status: status,
                evidence_notes: row.get(6)?,
                last_checked_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // ------------------------------------------------------------------------
    // Reader State
    // ------------------------------------------------------------------------

    pub fn save_reader_state(conn: &Connection, state: &ReaderState) -> Result<()> {
        conn.execute(
            "INSERT INTO reader_state (paper_id, file_id, last_page, zoom_level, rotation, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(paper_id) DO UPDATE SET
                file_id = excluded.file_id,
                last_page = excluded.last_page,
                zoom_level = excluded.zoom_level,
                rotation = excluded.rotation,
                updated_at = excluded.updated_at",
            params![
                state.paper_id,
                state.file_id,
                state.last_page as i64,
                state.zoom_level,
                state.rotation,
                state.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_reader_state(conn: &Connection, paper_id: &str) -> Result<Option<ReaderState>> {
        let mut stmt = conn.prepare(
            "SELECT paper_id, file_id, last_page, zoom_level, rotation, updated_at
             FROM reader_state
             WHERE paper_id = ?1",
        )?;

        let mut rows = stmt.query([paper_id])?;
        if let Some(row) = rows.next()? {
            let last_page: i64 = row.get(2)?;
            Ok(Some(ReaderState {
                paper_id: row.get(0)?,
                file_id: row.get(1)?,
                last_page: last_page as u32,
                zoom_level: row.get(3)?,
                rotation: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    // ------------------------------------------------------------------------
    // Link Downloaded PDF to Paper Record & paper_files
    // ------------------------------------------------------------------------

    pub fn attach_downloaded_file(
        conn: &Connection,
        paper_id: &str,
        file_path: &str,
        file_name: &str,
        byte_size: u64,
        sha256_hash: &str,
        page_count: Option<i32>,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        let file_id = Uuid::new_v4().to_string();

        // 1. Mark existing files for this paper as non-primary
        conn.execute(
            "UPDATE paper_files SET is_primary = 0 WHERE paper_id = ?1",
            [paper_id],
        )?;

        // 2. Insert into paper_files
        conn.execute(
            "INSERT INTO paper_files (
                id, paper_id, file_path, file_name, mime_type,
                byte_size, sha256_hash, verification_status,
                page_count, is_primary, verified_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, 'application/pdf', ?5, ?6, 'verified', ?7, 1, ?8, ?8, ?8)",
            params![
                file_id,
                paper_id,
                file_path,
                file_name,
                byte_size as i64,
                sha256_hash,
                page_count,
                now,
            ],
        )?;

        // 3. Update papers table
        conn.execute(
            "UPDATE papers SET
                has_file = 1,
                local_pdf_path = ?1,
                content_hash = ?2,
                updated_at = ?3
             WHERE id = ?4",
            params![file_path, sha256_hash, now, paper_id],
        )?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    // Get Consolidated Paper PDF Info
    // ------------------------------------------------------------------------

    pub fn get_paper_pdf_info(conn: &Connection, paper_id: &str) -> Result<PaperPdfInfo> {
        // Query primary file
        let mut file_stmt = conn.prepare(
            "SELECT id, file_path, file_name, byte_size, sha256_hash,
                    verification_status, page_count
             FROM paper_files
             WHERE paper_id = ?1
             ORDER BY is_primary DESC, created_at DESC
             LIMIT 1",
        )?;

        let primary_file = file_stmt
            .query_row([paper_id], |row| {
                let size: i64 = row.get(3)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    size as u64,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, Option<i32>>(6)?,
                ))
            })
            .ok();

        // Query paper record fallback
        let mut paper_stmt = conn.prepare(
            "SELECT local_pdf_path, content_hash, pdf_url, has_file FROM papers WHERE id = ?1",
        )?;

        let (legacy_path, legacy_hash, download_url, has_file_flag) = paper_stmt
            .query_row([paper_id], |row| {
                let flag: i64 = row.get(3)?;
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    flag > 0,
                ))
            })
            .unwrap_or((None, None, None, false));

        // Query reader state
        let reader_state = Self::get_reader_state(conn, paper_id).unwrap_or(None);

        let (
            file_id,
            has_local_file,
            file_name,
            byte_size,
            sha256_hash,
            verification_status,
            page_count,
        ) = if let Some((f_id, f_path, f_name, f_size, f_hash, f_status, f_pages)) = primary_file {
            let exists = std::path::Path::new(&f_path).exists();
            (
                Some(f_id),
                exists,
                Some(f_name),
                Some(f_size),
                f_hash,
                f_status,
                f_pages,
            )
        } else if let Some(path) = legacy_path {
            let exists = std::path::Path::new(&path).exists();
            let name = std::path::Path::new(&path)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "document.pdf".to_string());
            (
                None,
                exists,
                Some(name),
                None,
                legacy_hash,
                if exists {
                    "verified".to_string()
                } else {
                    "missing".to_string()
                },
                None,
            )
        } else {
            (
                None,
                has_file_flag,
                None,
                None,
                None,
                "not_downloaded".to_string(),
                None,
            )
        };

        let is_text_indexed: bool = if let Some(ref fid) = file_id {
            conn.query_row(
                "SELECT COUNT(*) FROM doc_text_fts WHERE file_id = ?1",
                [fid],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false)
        } else {
            false
        };

        // Determine availability status
        let access_status = if has_local_file {
            PdfAvailabilityStatus::Downloaded
        } else if let Ok(Some(active_job)) = Self::get_active_download_for_paper(conn, paper_id) {
            if active_job.status == "downloading" {
                PdfAvailabilityStatus::Downloading
            } else {
                PdfAvailabilityStatus::DownloadQueued
            }
        } else if download_url.is_some() {
            PdfAvailabilityStatus::OpenAccessAvailable
        } else {
            PdfAvailabilityStatus::Unknown
        };

        Ok(PaperPdfInfo {
            paper_id: paper_id.to_string(),
            file_id,
            has_local_file,
            file_name,
            byte_size,
            sha256_hash,
            verification_status,
            page_count,
            is_text_indexed,
            last_page: reader_state.as_ref().map(|s| s.last_page).unwrap_or(1),
            zoom_level: reader_state.as_ref().map(|s| s.zoom_level).unwrap_or(1.0),
            rotation: reader_state.as_ref().map(|s| s.rotation).unwrap_or(0),
            access_status,
            download_url,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    fn insert_test_paper(conn: &Connection, id: &str, title: &str) {
        conn.execute(
            "INSERT INTO papers (id, title, clean_title_key, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
            rusqlite::params![id, title, title.to_lowercase()],
        )
        .unwrap();
    }

    #[test]
    fn test_pdf_workspace_download_job_lifecycle() {
        let db = Database::open_in_memory().unwrap();
        let conn = db.lock().unwrap();

        insert_test_paper(&conn, "paper-1", "Quantum Computation");

        let job = DownloadJob {
            id: "job-1".to_string(),
            paper_id: "paper-1".to_string(),
            paper_title: "Quantum Computation".to_string(),
            url: "https://arxiv.org/pdf/quant-ph/0000001.pdf".to_string(),
            source_id: "arxiv".to_string(),
            status: "downloading".to_string(),
            bytes_downloaded: 1024,
            total_bytes: 2048,
            progress_percent: 50.0,
            stage_message: "Transferring...".to_string(),
            error_message: None,
            destination_path: None,
            sha256_hash: None,
            retry_count: 0,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:01Z".to_string(),
        };

        // Create
        PdfWorkspaceRepository::create_download_job(&conn, &job).unwrap();

        // Get
        let fetched = PdfWorkspaceRepository::get_download_job(&conn, "job-1")
            .unwrap()
            .expect("Job should exist");
        assert_eq!(fetched.paper_title, "Quantum Computation");
        assert_eq!(fetched.status, "downloading");

        // Recover interrupted (downloading -> failed_retryable)
        let recovered = PdfWorkspaceRepository::recover_interrupted_jobs(&conn).unwrap();
        assert_eq!(recovered, 1);

        let recovered_job = PdfWorkspaceRepository::get_download_job(&conn, "job-1")
            .unwrap()
            .unwrap();
        assert_eq!(recovered_job.status, "failed");
        assert!(recovered_job.stage_message.contains("Interrupted"));
    }

    #[test]
    fn test_pdf_candidate_persistence() {
        let db = Database::open_in_memory().unwrap();
        let conn = db.lock().unwrap();

        insert_test_paper(&conn, "paper-123", "Deep Learning Foundations");

        let candidate = PdfCandidate {
            id: "cand-1".to_string(),
            paper_id: "paper-123".to_string(),
            url: "https://example.org/paper.pdf".to_string(),
            provider_id: "unpaywall".to_string(),
            source_type: "open_access_resolver".to_string(),
            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
            evidence_notes: Some("License: CC-BY".to_string()),
            last_checked_at: "2026-01-01T00:00:00Z".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
        };

        PdfWorkspaceRepository::save_pdf_candidate(&conn, &candidate).unwrap();
        let list = PdfWorkspaceRepository::get_pdf_candidates(&conn, "paper-123").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].url, "https://example.org/paper.pdf");
        assert_eq!(
            list[0].access_status,
            PdfAvailabilityStatus::OpenAccessAvailable
        );
    }

    #[test]
    fn test_reader_state_persistence() {
        let db = Database::open_in_memory().unwrap();
        let conn = db.lock().unwrap();

        insert_test_paper(&conn, "paper-456", "Transformer Architectures");

        let state = ReaderState {
            paper_id: "paper-456".to_string(),
            file_id: None,
            last_page: 7,
            zoom_level: 1.25,
            rotation: 90,
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        };

        PdfWorkspaceRepository::save_reader_state(&conn, &state).unwrap();
        let retrieved = PdfWorkspaceRepository::get_reader_state(&conn, "paper-456")
            .unwrap()
            .expect("Reader state should be saved");
        assert_eq!(retrieved.last_page, 7);
        assert_eq!(retrieved.zoom_level, 1.25);
        assert_eq!(retrieved.rotation, 90);
    }
}
