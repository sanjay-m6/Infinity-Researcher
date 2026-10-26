use crate::domain::processing::{
    DuplicateCandidate, PaperFile, PaperIdentifier, PaperMergeHistory, ProcessingJob,
    ProcessingOverview,
};
use rusqlite::{params, Connection, Result};

pub struct ProcessingRepository;

impl ProcessingRepository {
    // -------------------------------------------------------------
    // Paper Identifiers
    // -------------------------------------------------------------
    pub fn insert_identifier(conn: &Connection, identifier: &PaperIdentifier) -> Result<()> {
        conn.execute(
            "INSERT INTO paper_identifiers (id, paper_id, identifier_type, canonical_value, raw_value, source_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                identifier.id,
                identifier.paper_id,
                identifier.identifier_type,
                identifier.canonical_value,
                identifier.raw_value,
                identifier.source_id,
                identifier.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_identifiers_for_paper(
        conn: &Connection,
        paper_id: &str,
    ) -> Result<Vec<PaperIdentifier>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, identifier_type, canonical_value, raw_value, source_id, created_at
             FROM paper_identifiers WHERE paper_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![paper_id], |row| {
            Ok(PaperIdentifier {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                identifier_type: row.get(2)?,
                canonical_value: row.get(3)?,
                raw_value: row.get(4)?,
                source_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------
    // Paper Files
    // -------------------------------------------------------------
    pub fn save_paper_file(conn: &Connection, file: &PaperFile) -> Result<()> {
        conn.execute(
            "INSERT INTO paper_files (
                id, paper_id, file_path, file_name, mime_type, byte_size, sha256_hash,
                verification_status, page_count, extracted_title, extracted_author,
                extracted_text_preview, extracted_text, is_primary, verified_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
            ON CONFLICT(id) DO UPDATE SET
                file_path = excluded.file_path,
                file_name = excluded.file_name,
                byte_size = excluded.byte_size,
                sha256_hash = excluded.sha256_hash,
                verification_status = excluded.verification_status,
                page_count = excluded.page_count,
                extracted_title = excluded.extracted_title,
                extracted_author = excluded.extracted_author,
                extracted_text_preview = excluded.extracted_text_preview,
                extracted_text = excluded.extracted_text,
                is_primary = excluded.is_primary,
                verified_at = excluded.verified_at,
                updated_at = excluded.updated_at",
            params![
                file.id,
                file.paper_id,
                file.file_path,
                file.file_name,
                file.mime_type,
                file.byte_size,
                file.sha256_hash,
                file.verification_status,
                file.page_count,
                file.extracted_title,
                file.extracted_author,
                file.extracted_text_preview,
                file.extracted_text,
                if file.is_primary { 1 } else { 0 },
                file.verified_at,
                file.created_at,
                file.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_files_for_paper(conn: &Connection, paper_id: &str) -> Result<Vec<PaperFile>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, file_path, file_name, mime_type, byte_size, sha256_hash,
                    verification_status, page_count, extracted_title, extracted_author,
                    extracted_text_preview, extracted_text, is_primary, verified_at, created_at, updated_at
             FROM paper_files WHERE paper_id = ?1 ORDER BY is_primary DESC, created_at ASC",
        )?;
        let rows = stmt.query_map(params![paper_id], |row| {
            let is_primary_int: i32 = row.get(13)?;
            Ok(PaperFile {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                mime_type: row.get(4)?,
                byte_size: row.get(5)?,
                sha256_hash: row.get(6)?,
                verification_status: row.get(7)?,
                page_count: row.get(8)?,
                extracted_title: row.get(9)?,
                extracted_author: row.get(10)?,
                extracted_text_preview: row.get(11)?,
                extracted_text: row.get(12)?,
                is_primary: is_primary_int == 1,
                verified_at: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn list_all_files(conn: &Connection, limit: u32, offset: u32) -> Result<Vec<PaperFile>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, file_path, file_name, mime_type, byte_size, sha256_hash,
                    verification_status, page_count, extracted_title, extracted_author,
                    extracted_text_preview, extracted_text, is_primary, verified_at, created_at, updated_at
             FROM paper_files ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        )?;
        let rows = stmt.query_map(params![limit, offset], |row| {
            let is_primary_int: i32 = row.get(13)?;
            Ok(PaperFile {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                mime_type: row.get(4)?,
                byte_size: row.get(5)?,
                sha256_hash: row.get(6)?,
                verification_status: row.get(7)?,
                page_count: row.get(8)?,
                extracted_title: row.get(9)?,
                extracted_author: row.get(10)?,
                extracted_text_preview: row.get(11)?,
                extracted_text: row.get(12)?,
                is_primary: is_primary_int == 1,
                verified_at: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------
    // Duplicate Candidates
    // -------------------------------------------------------------
    pub fn save_duplicate_candidate(
        conn: &Connection,
        candidate: &DuplicateCandidate,
    ) -> Result<()> {
        let evidence_str =
            serde_json::to_string(&candidate.evidence).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO duplicate_candidates (
                id, paper_a_id, paper_b_id, score, match_tier, evidence_json, status, decision_notes, decided_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(paper_a_id, paper_b_id) DO UPDATE SET
                score = excluded.score,
                match_tier = excluded.match_tier,
                evidence_json = excluded.evidence_json,
                updated_at = excluded.updated_at",
            params![
                candidate.id,
                candidate.paper_a_id,
                candidate.paper_b_id,
                candidate.score,
                candidate.match_tier,
                evidence_str,
                candidate.status,
                candidate.decision_notes,
                candidate.decided_at,
                candidate.created_at,
                candidate.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_duplicate_candidates(
        conn: &Connection,
        status: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<DuplicateCandidate>> {
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = match status {
            Some(s) => (
                "SELECT id, paper_a_id, paper_b_id, score, match_tier, evidence_json, status, decision_notes, decided_at, created_at, updated_at
                 FROM duplicate_candidates WHERE status = ?1 ORDER BY score DESC, created_at DESC LIMIT ?2 OFFSET ?3".to_string(),
                vec![Box::new(s.to_string()), Box::new(limit), Box::new(offset)],
            ),
            None => (
                "SELECT id, paper_a_id, paper_b_id, score, match_tier, evidence_json, status, decision_notes, decided_at, created_at, updated_at
                 FROM duplicate_candidates ORDER BY score DESC, created_at DESC LIMIT ?1 OFFSET ?2".to_string(),
                vec![Box::new(limit), Box::new(offset)],
            ),
        };

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
        let rows = stmt.query_map(&param_refs[..], |row| {
            let evidence_raw: String = row.get(5)?;
            let evidence: Vec<String> = serde_json::from_str(&evidence_raw).unwrap_or_default();
            Ok(DuplicateCandidate {
                id: row.get(0)?,
                paper_a_id: row.get(1)?,
                paper_b_id: row.get(2)?,
                score: row.get(3)?,
                match_tier: row.get(4)?,
                evidence,
                status: row.get(6)?,
                decision_notes: row.get(7)?,
                decided_at: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn update_candidate_status(
        conn: &Connection,
        candidate_id: &str,
        status: &str,
        notes: Option<&str>,
    ) -> Result<()> {
        conn.execute(
            "UPDATE duplicate_candidates SET status = ?1, decision_notes = ?2, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?3",
            params![status, notes, candidate_id],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------
    // Paper Merge History
    // -------------------------------------------------------------
    pub fn insert_merge_history(conn: &Connection, history: &PaperMergeHistory) -> Result<()> {
        conn.execute(
            "INSERT INTO paper_merge_history (id, canonical_paper_id, merged_paper_id, field_decisions_json, preserved_records_json, merged_by, merged_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                history.id,
                history.canonical_paper_id,
                history.merged_paper_id,
                history.field_decisions_json,
                history.preserved_records_json,
                history.merged_by,
                history.merged_at,
            ],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------
    // Processing Jobs
    // -------------------------------------------------------------
    pub fn create_processing_job(conn: &Connection, job: &ProcessingJob) -> Result<()> {
        conn.execute(
            "INSERT INTO processing_jobs (
                id, job_type, status, total_items, completed_items, failed_items,
                warnings_count, error_message, started_at, completed_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                job.id,
                job.job_type,
                job.status,
                job.total_items,
                job.completed_items,
                job.failed_items,
                job.warnings_count,
                job.error_message,
                job.started_at,
                job.completed_at,
                job.created_at,
                job.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_processing_job(conn: &Connection, job: &ProcessingJob) -> Result<()> {
        conn.execute(
            "UPDATE processing_jobs SET
                status = ?1,
                total_items = ?2,
                completed_items = ?3,
                failed_items = ?4,
                warnings_count = ?5,
                error_message = ?6,
                started_at = ?7,
                completed_at = ?8,
                updated_at = ?9
             WHERE id = ?10",
            params![
                job.status,
                job.total_items,
                job.completed_items,
                job.failed_items,
                job.warnings_count,
                job.error_message,
                job.started_at,
                job.completed_at,
                job.updated_at,
                job.id,
            ],
        )?;
        Ok(())
    }

    pub fn list_processing_jobs(conn: &Connection, limit: u32) -> Result<Vec<ProcessingJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, job_type, status, total_items, completed_items, failed_items,
                    warnings_count, error_message, started_at, completed_at, created_at, updated_at
             FROM processing_jobs ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(ProcessingJob {
                id: row.get(0)?,
                job_type: row.get(1)?,
                status: row.get(2)?,
                total_items: row.get(3)?,
                completed_items: row.get(4)?,
                failed_items: row.get(5)?,
                warnings_count: row.get(6)?,
                error_message: row.get(7)?,
                started_at: row.get(8)?,
                completed_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------
    // Processing Overview Diagnostics
    // -------------------------------------------------------------
    pub fn get_processing_overview(conn: &Connection) -> Result<ProcessingOverview> {
        let total_papers: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM papers WHERE merged_into_id IS NULL AND is_saved = 1",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let normalized_papers: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT paper_id) FROM paper_identifiers",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let total_files: i64 = conn
            .query_row("SELECT COUNT(*) FROM paper_files", [], |r| r.get(0))
            .unwrap_or(0);

        let verified_files: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM paper_files WHERE verification_status = 'verified'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let pending_duplicates_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM duplicate_candidates WHERE status = 'pending'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let active_jobs_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM processing_jobs WHERE status IN ('queued', 'running')",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let last_processing_time: Option<String> = conn
            .query_row(
                "SELECT MAX(completed_at) FROM processing_jobs WHERE status LIKE 'succeeded%'",
                [],
                |r| r.get(0),
            )
            .ok();

        Ok(ProcessingOverview {
            total_papers,
            normalized_papers,
            total_files,
            verified_files,
            pending_duplicates_count,
            active_jobs_count,
            last_processing_time,
        })
    }
}
