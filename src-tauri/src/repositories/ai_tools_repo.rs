use rusqlite::{params, Connection, Result};

use crate::domain::ai_tools::*;

pub struct AiToolsRepository;

impl AiToolsRepository {
    // -----------------------------------------------------------------------
    // Document Ingestion & Deduplication
    // -----------------------------------------------------------------------

    pub fn find_document_by_hash(conn: &Connection, doc_hash: &str) -> Result<Option<String>> {
        let mut stmt = conn.prepare("SELECT id FROM integrity_documents WHERE file_hash = ?1")?;
        let mut rows = stmt.query(params![doc_hash])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_document_content_by_hash(
        conn: &Connection,
        doc_hash: &str,
    ) -> Result<Option<(String, String, i64)>> {
        let mut stmt = conn.prepare(
            "SELECT file_name, raw_content, word_count FROM integrity_documents WHERE file_hash = ?1 LIMIT 1",
        )?;
        let mut rows = stmt.query(params![doc_hash])?;
        if let Some(row) = rows.next()? {
            Ok(Some((row.get(0)?, row.get(1)?, row.get(2)?)))
        } else {
            Ok(None)
        }
    }

    pub fn ingest_document(
        conn: &Connection,
        id: &str,
        doc_hash: &str,
        file_name: &str,
        file_format: &str,
        word_count: i64,
        raw_content: &str,
        normalized_content: &str,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO integrity_documents (
                id, source_type, file_hash, file_name, file_format,
                file_size_bytes, raw_content, normalized_content,
                word_count, page_count, created_at, updated_at
            ) VALUES (?1, 'file', ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                updated_at = datetime('now'),
                word_count = excluded.word_count",
            params![
                id,
                doc_hash,
                file_name,
                file_format,
                raw_content.len() as i64,
                raw_content,
                normalized_content,
                word_count
            ],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Analysis Jobs (Background Tasks, Cancellation, Progress)
    // -----------------------------------------------------------------------

    pub fn find_active_job_for_hash(
        conn: &Connection,
        doc_hash: &str,
        job_type: &str,
    ) -> Result<Option<AnalysisJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, job_type, document_hash, status, progress_pct,
                    current_step, result_json, error_code, error_message,
                    created_at, updated_at
             FROM analysis_jobs
             WHERE document_hash = ?1 AND job_type = ?2 AND status IN ('queued', 'running')
             ORDER BY created_at DESC LIMIT 1",
        )?;

        let mut rows = stmt.query(params![doc_hash, job_type])?;
        if let Some(row) = rows.next()? {
            Ok(Some(AnalysisJob {
                id: row.get(0)?,
                job_type: row.get(1)?,
                document_hash: row.get(2)?,
                status: row.get(3)?,
                progress_pct: row.get(4)?,
                current_step: row.get(5)?,
                result_json: row.get(6)?,
                error_code: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn create_analysis_job(
        conn: &Connection,
        id: &str,
        job_type: &str,
        doc_hash: &str,
    ) -> Result<AnalysisJob> {
        conn.execute(
            "INSERT INTO analysis_jobs (
                id, job_type, document_hash, status, progress_pct,
                current_step, created_at, updated_at
            ) VALUES (?1, ?2, ?3, 'running', 10, 'Initializing pipeline', datetime('now'), datetime('now'))",
            params![id, job_type, doc_hash],
        )?;

        Self::get_analysis_job(conn, id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn update_job_progress(
        conn: &Connection,
        id: &str,
        progress_pct: i32,
        current_step: &str,
    ) -> Result<()> {
        conn.execute(
            "UPDATE analysis_jobs
             SET progress_pct = ?1, current_step = ?2, updated_at = datetime('now')
             WHERE id = ?3 AND status = 'running'",
            params![progress_pct, current_step, id],
        )?;
        Ok(())
    }

    pub fn complete_analysis_job(conn: &Connection, id: &str, result_json: &str) -> Result<()> {
        conn.execute(
            "UPDATE analysis_jobs
             SET status = 'completed', progress_pct = 100, current_step = 'Done',
                 result_json = ?1, updated_at = datetime('now')
             WHERE id = ?2",
            params![result_json, id],
        )?;
        Ok(())
    }

    pub fn fail_analysis_job(
        conn: &Connection,
        id: &str,
        error_code: &str,
        error_message: &str,
    ) -> Result<()> {
        conn.execute(
            "UPDATE analysis_jobs
             SET status = 'failed', error_code = ?1, error_message = ?2, updated_at = datetime('now')
             WHERE id = ?3",
            params![error_code, error_message, id],
        )?;
        Ok(())
    }

    pub fn cancel_analysis_job(conn: &Connection, id: &str) -> Result<bool> {
        let affected = conn.execute(
            "UPDATE analysis_jobs
             SET status = 'cancelled', current_step = 'Cancelled by user', updated_at = datetime('now')
             WHERE id = ?1 AND status IN ('queued', 'running')",
            params![id],
        )?;
        Ok(affected > 0)
    }

    pub fn get_analysis_job(conn: &Connection, id: &str) -> Result<Option<AnalysisJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, job_type, document_hash, status, progress_pct,
                    current_step, result_json, error_code, error_message,
                    created_at, updated_at
             FROM analysis_jobs
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(AnalysisJob {
                id: row.get(0)?,
                job_type: row.get(1)?,
                document_hash: row.get(2)?,
                status: row.get(3)?,
                progress_pct: row.get(4)?,
                current_step: row.get(5)?,
                result_json: row.get(6)?,
                error_code: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    // -----------------------------------------------------------------------
    // Saved Integrity Reports & Findings
    // -----------------------------------------------------------------------

    pub fn save_integrity_report(
        conn: &mut Connection,
        report: &SavedIntegrityReport,
    ) -> Result<()> {
        let tx = conn.transaction()?;

        tx.execute(
            "INSERT INTO saved_integrity_reports (
                id, document_hash, file_name, title, word_count,
                dimensions_json, ethical_disclaimer, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                file_name = excluded.file_name,
                word_count = excluded.word_count,
                dimensions_json = excluded.dimensions_json,
                updated_at = datetime('now')",
            params![
                report.id,
                report.document_hash,
                report.file_name,
                report.title,
                report.word_count,
                report.dimensions_json,
                report.ethical_disclaimer
            ],
        )?;

        // Clear existing findings for report and insert updated
        tx.execute(
            "DELETE FROM integrity_report_findings WHERE report_id = ?1",
            params![report.id],
        )?;

        for f in &report.findings {
            tx.execute(
                "INSERT INTO integrity_report_findings (
                    id, report_id, dimension, title, description,
                    status, severity, confidence, evidence, location,
                    suggested_action, is_reviewed, reviewed_at, reviewer_notes, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    f.id,
                    report.id,
                    f.dimension,
                    f.title,
                    f.description,
                    f.status,
                    f.severity,
                    f.confidence,
                    f.evidence,
                    f.location,
                    f.suggested_action,
                    if f.is_reviewed { 1 } else { 0 },
                    f.reviewed_at,
                    f.reviewer_notes
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_integrity_report(conn: &Connection, id: &str) -> Result<Option<SavedIntegrityReport>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_hash, file_name, title, word_count,
                    dimensions_json, ethical_disclaimer, created_at, updated_at
             FROM saved_integrity_reports
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let report_id: String = row.get(0)?;
            let findings = Self::get_findings_for_report(conn, &report_id)?;
            let unreviewed = findings.iter().filter(|f| !f.is_reviewed).count() as i64;
            let findings_count = findings.len() as i64;

            Ok(Some(SavedIntegrityReport {
                id: report_id,
                document_hash: row.get(1)?,
                file_name: row.get(2)?,
                title: row.get(3)?,
                word_count: row.get(4)?,
                dimensions_json: row.get(5)?,
                ethical_disclaimer: row.get(6)?,
                findings_count,
                unreviewed_count: unreviewed,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                findings,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_findings_for_report(conn: &Connection, report_id: &str) -> Result<Vec<IntegrityReportFinding>> {
        let mut stmt = conn.prepare(
            "SELECT id, report_id, dimension, title, description,
                    status, severity, confidence, evidence, location,
                    suggested_action, is_reviewed, reviewed_at, reviewer_notes, created_at
             FROM integrity_report_findings
             WHERE report_id = ?1
             ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![report_id], |row| {
            let is_rev: i64 = row.get(11)?;
            Ok(IntegrityReportFinding {
                id: row.get(0)?,
                report_id: row.get(1)?,
                dimension: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                severity: row.get(6)?,
                confidence: row.get(7)?,
                evidence: row.get(8)?,
                location: row.get(9)?,
                suggested_action: row.get(10)?,
                is_reviewed: is_rev == 1,
                reviewed_at: row.get(12)?,
                reviewer_notes: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn list_saved_integrity_reports(
        conn: &Connection,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<SavedIntegrityReport>> {
        let mut stmt = conn.prepare(
            "SELECT r.id, r.document_hash, r.file_name, r.title, r.word_count,
                    r.dimensions_json, r.ethical_disclaimer, r.created_at, r.updated_at,
                    COUNT(f.id) as total_findings,
                    COALESCE(SUM(CASE WHEN f.is_reviewed = 0 THEN 1 ELSE 0 END), 0) as unreviewed_findings
             FROM saved_integrity_reports r
             LEFT JOIN integrity_report_findings f ON f.report_id = r.id
             GROUP BY r.id
             ORDER BY r.created_at DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let rows = stmt.query_map(params![limit, offset], |row| {
            Ok(SavedIntegrityReport {
                id: row.get(0)?,
                document_hash: row.get(1)?,
                file_name: row.get(2)?,
                title: row.get(3)?,
                word_count: row.get(4)?,
                dimensions_json: row.get(5)?,
                ethical_disclaimer: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                findings_count: row.get(9)?,
                unreviewed_count: row.get(10)?,
                findings: Vec::new(),
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_integrity_report(conn: &Connection, id: &str) -> Result<bool> {
        let affected = conn.execute(
            "DELETE FROM saved_integrity_reports WHERE id = ?1",
            params![id],
        )?;
        Ok(affected > 0)
    }

    pub fn update_finding_review(
        conn: &Connection,
        finding_id: &str,
        is_reviewed: bool,
        notes: Option<&str>,
    ) -> Result<bool> {
        let now = chrono::Utc::now().to_rfc3339();
        let affected = conn.execute(
            "UPDATE integrity_report_findings
             SET is_reviewed = ?1,
                 status = CASE WHEN ?1 = 1 THEN 'reviewed' ELSE 'concern' END,
                 reviewed_at = CASE WHEN ?1 = 1 THEN ?2 ELSE NULL END,
                 reviewer_notes = COALESCE(?3, reviewer_notes)
             WHERE id = ?4",
            params![if is_reviewed { 1 } else { 0 }, now, notes, finding_id],
        )?;
        Ok(affected > 0)
    }

    // -----------------------------------------------------------------------
    // Citation Audits
    // -----------------------------------------------------------------------

    pub fn save_citation_audit(conn: &Connection, audit: &SavedCitationAudit) -> Result<()> {
        conn.execute(
            "INSERT INTO citation_audits (
                id, document_hash, document_title, file_name,
                total_in_text, total_references, matched_citations, health_score,
                summary_json, issues_json, references_json, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                document_title = excluded.document_title,
                file_name = excluded.file_name,
                total_in_text = excluded.total_in_text,
                total_references = excluded.total_references,
                matched_citations = excluded.matched_citations,
                health_score = excluded.health_score,
                summary_json = excluded.summary_json,
                issues_json = excluded.issues_json,
                references_json = excluded.references_json",
            params![
                audit.id,
                audit.document_hash,
                audit.document_title,
                audit.file_name,
                audit.total_in_text,
                audit.total_references,
                audit.matched_citations,
                audit.health_score,
                audit.summary_json,
                audit.issues_json,
                audit.references_json
            ],
        )?;
        Ok(())
    }

    pub fn list_citation_audits(
        conn: &Connection,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<SavedCitationAudit>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_hash, document_title, file_name,
                    total_in_text, total_references, matched_citations, health_score,
                    summary_json, issues_json, references_json, created_at
             FROM citation_audits
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let rows = stmt.query_map(params![limit, offset], |row| {
            Ok(SavedCitationAudit {
                id: row.get(0)?,
                document_hash: row.get(1)?,
                document_title: row.get(2)?,
                file_name: row.get(3)?,
                total_in_text: row.get(4)?,
                total_references: row.get(5)?,
                matched_citations: row.get(6)?,
                health_score: row.get(7)?,
                summary_json: row.get(8)?,
                issues_json: row.get(9)?,
                references_json: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_citation_audit(conn: &Connection, id: &str) -> Result<Option<SavedCitationAudit>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_hash, document_title, file_name,
                    total_in_text, total_references, matched_citations, health_score,
                    summary_json, issues_json, references_json, created_at
             FROM citation_audits
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SavedCitationAudit {
                id: row.get(0)?,
                document_hash: row.get(1)?,
                document_title: row.get(2)?,
                file_name: row.get(3)?,
                total_in_text: row.get(4)?,
                total_references: row.get(5)?,
                matched_citations: row.get(6)?,
                health_score: row.get(7)?,
                summary_json: row.get(8)?,
                issues_json: row.get(9)?,
                references_json: row.get(10)?,
                created_at: row.get(11)?,
            }))
        } else {
            Ok(None)
        }
    }

    // -----------------------------------------------------------------------
    // Readability Reports Persistence
    // -----------------------------------------------------------------------

    pub fn save_readability_report(
        conn: &Connection,
        report: &SavedReadabilityReport,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO readability_reports (
                id, document_hash, document_title, language_code,
                word_count, sentence_count, flesch_reading_ease, flesch_kincaid_grade, gunning_fog_index,
                metrics_json, vocabulary_json, paragraphs_json, recommendations_json, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                document_title = excluded.document_title,
                flesch_reading_ease = excluded.flesch_reading_ease,
                metrics_json = excluded.metrics_json,
                paragraphs_json = excluded.paragraphs_json",
            params![
                report.id,
                report.document_hash,
                report.document_title,
                report.language_code,
                report.word_count,
                report.sentence_count,
                report.flesch_reading_ease,
                report.flesch_kincaid_grade,
                report.gunning_fog_index,
                report.metrics_json,
                report.vocabulary_json,
                report.paragraphs_json,
                report.recommendations_json
            ],
        )?;
        Ok(())
    }

    pub fn get_readability_report_by_hash(
        conn: &Connection,
        doc_hash: &str,
    ) -> Result<Option<SavedReadabilityReport>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_hash, document_title, language_code,
                    word_count, sentence_count, flesch_reading_ease, flesch_kincaid_grade, gunning_fog_index,
                    metrics_json, vocabulary_json, paragraphs_json, recommendations_json, created_at
             FROM readability_reports
             WHERE document_hash = ?1
             ORDER BY created_at DESC LIMIT 1",
        )?;

        let mut rows = stmt.query(params![doc_hash])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SavedReadabilityReport {
                id: row.get(0)?,
                document_hash: row.get(1)?,
                document_title: row.get(2)?,
                language_code: row.get(3)?,
                word_count: row.get(4)?,
                sentence_count: row.get(5)?,
                flesch_reading_ease: row.get(6)?,
                flesch_kincaid_grade: row.get(7)?,
                gunning_fog_index: row.get(8)?,
                metrics_json: row.get(9)?,
                vocabulary_json: row.get(10)?,
                paragraphs_json: row.get(11)?,
                recommendations_json: row.get(12)?,
                created_at: row.get(13)?,
            }))
        } else {
            Ok(None)
        }
    }

    // -----------------------------------------------------------------------
    // Writing Revisions
    // -----------------------------------------------------------------------

    pub fn save_writing_revision(conn: &Connection, rev: &WritingRevisionItem) -> Result<()> {
        // Ensure parent rows exist to prevent foreign key constraint violations
        // under PRAGMA foreign_keys = ON;
        conn.execute(
            "INSERT OR IGNORE INTO integrity_documents (
                id, source_type, file_hash, file_name, file_format,
                raw_content, normalized_content, created_at, updated_at
            ) VALUES ('doc_default_session', 'pasted_text', 'default_hash', 'default.txt', 'txt', '', '', datetime('now'), datetime('now'))",
            [],
        )?;

        conn.execute(
            "INSERT OR IGNORE INTO writing_sessions (
                id, document_id, title, active_mode, created_at, updated_at
            ) VALUES (?1, 'doc_default_session', 'Default Session', 'clarity', datetime('now'), datetime('now'))",
            params![rev.session_id],
        )?;

        conn.execute(
            "INSERT INTO writing_revisions (
                id, session_id, revision_number, action_type,
                original_text, revised_text, diff_summary,
                preserved_numbers_ok, preserved_citations_ok, preserved_equations_ok, preserved_dois_ok,
                is_accepted, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
            params![
                rev.id,
                rev.session_id,
                rev.revision_number,
                rev.action_type,
                rev.original_text,
                rev.revised_text,
                rev.diff_summary,
                if rev.preserved_numbers_ok { 1 } else { 0 },
                if rev.preserved_citations_ok { 1 } else { 0 },
                if rev.preserved_equations_ok { 1 } else { 0 },
                if rev.preserved_dois_ok { 1 } else { 0 },
                if rev.is_accepted { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn list_writing_revisions(
        conn: &Connection,
        session_id: &str,
    ) -> Result<Vec<WritingRevisionItem>> {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, revision_number, action_type,
                    original_text, revised_text, diff_summary,
                    preserved_numbers_ok, preserved_citations_ok, preserved_equations_ok, preserved_dois_ok,
                    is_accepted, created_at
             FROM writing_revisions
             WHERE session_id = ?1
             ORDER BY revision_number DESC",
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            let n_ok: i64 = row.get(7)?;
            let c_ok: i64 = row.get(8)?;
            let e_ok: i64 = row.get(9)?;
            let d_ok: i64 = row.get(10)?;
            let acc: i64 = row.get(11)?;

            Ok(WritingRevisionItem {
                id: row.get(0)?,
                session_id: row.get(1)?,
                revision_number: row.get(2)?,
                action_type: row.get(3)?,
                original_text: row.get(4)?,
                revised_text: row.get(5)?,
                diff_summary: row.get(6)?,
                preserved_numbers_ok: n_ok == 1,
                preserved_citations_ok: c_ok == 1,
                preserved_equations_ok: e_ok == 1,
                preserved_dois_ok: d_ok == 1,
                is_accepted: acc == 1,
                created_at: row.get(12)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }
}

