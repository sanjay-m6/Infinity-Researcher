use rusqlite::{params, Connection, Result};

use crate::domain::integrity::*;

pub struct IntegrityRepository;

impl IntegrityRepository {
    // -----------------------------------------------------------------------
    // Integrity Documents
    // -----------------------------------------------------------------------

    pub fn save_document(conn: &Connection, doc: &IntegrityDocument) -> Result<()> {
        conn.execute(
            "INSERT INTO integrity_documents (
                id, source_type, source_reference, file_hash, file_name, file_format,
                file_size_bytes, raw_content, normalized_content, word_count, page_count,
                extraction_metadata, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(id) DO UPDATE SET
                raw_content = excluded.raw_content,
                normalized_content = excluded.normalized_content,
                word_count = excluded.word_count,
                page_count = excluded.page_count,
                extraction_metadata = excluded.extraction_metadata,
                updated_at = excluded.updated_at",
            params![
                doc.id,
                doc.source_type,
                doc.source_reference,
                doc.file_hash,
                doc.file_name,
                doc.file_format,
                doc.file_size_bytes,
                doc.raw_content,
                doc.normalized_content,
                doc.word_count,
                doc.page_count,
                doc.extraction_metadata,
                doc.created_at,
                doc.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_document(conn: &Connection, id: &str) -> Result<Option<IntegrityDocument>> {
        let mut stmt = conn.prepare(
            "SELECT id, source_type, source_reference, file_hash, file_name, file_format,
                    file_size_bytes, raw_content, normalized_content, word_count, page_count,
                    extraction_metadata, created_at, updated_at
             FROM integrity_documents WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(IntegrityDocument {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_reference: row.get(2)?,
                file_hash: row.get(3)?,
                file_name: row.get(4)?,
                file_format: row.get(5)?,
                file_size_bytes: row.get(6)?,
                raw_content: row.get(7)?,
                normalized_content: row.get(8)?,
                word_count: row.get(9)?,
                page_count: row.get(10)?,
                extraction_metadata: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_documents(conn: &Connection) -> Result<Vec<IntegrityDocument>> {
        let mut stmt = conn.prepare(
            "SELECT id, source_type, source_reference, file_hash, file_name, file_format,
                    file_size_bytes, raw_content, normalized_content, word_count, page_count,
                    extraction_metadata, created_at, updated_at
             FROM integrity_documents ORDER BY updated_at DESC LIMIT 50",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(IntegrityDocument {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_reference: row.get(2)?,
                file_hash: row.get(3)?,
                file_name: row.get(4)?,
                file_format: row.get(5)?,
                file_size_bytes: row.get(6)?,
                raw_content: row.get(7)?,
                normalized_content: row.get(8)?,
                word_count: row.get(9)?,
                page_count: row.get(10)?,
                extraction_metadata: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -----------------------------------------------------------------------
    // Document Segments
    // -----------------------------------------------------------------------

    pub fn save_segments(conn: &mut Connection, document_id: &str, segments: &[DocumentSegment]) -> Result<()> {
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM document_segments WHERE document_id = ?1", params![document_id])?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO document_segments (
                    id, document_id, segment_index, segment_type, raw_text,
                    normalized_text, char_start, char_end, page_number, embedding_id, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )?;

            for seg in segments {
                stmt.execute(params![
                    seg.id,
                    seg.document_id,
                    seg.segment_index,
                    seg.segment_type,
                    seg.raw_text,
                    seg.normalized_text,
                    seg.char_start,
                    seg.char_end,
                    seg.page_number,
                    seg.embedding_id,
                    seg.created_at,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_segments_for_document(conn: &Connection, document_id: &str) -> Result<Vec<DocumentSegment>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, segment_index, segment_type, raw_text,
                    normalized_text, char_start, char_end, page_number, embedding_id, created_at
             FROM document_segments WHERE document_id = ?1 ORDER BY segment_index ASC",
        )?;

        let rows = stmt.query_map(params![document_id], |row| {
            Ok(DocumentSegment {
                id: row.get(0)?,
                document_id: row.get(1)?,
                segment_index: row.get(2)?,
                segment_type: row.get(3)?,
                raw_text: row.get(4)?,
                normalized_text: row.get(5)?,
                char_start: row.get(6)?,
                char_end: row.get(7)?,
                page_number: row.get(8)?,
                embedding_id: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -----------------------------------------------------------------------
    // Corpus Sources & Fingerprints
    // -----------------------------------------------------------------------

    pub fn save_corpus_source(conn: &Connection, src: &CorpusSource) -> Result<()> {
        conn.execute(
            "INSERT INTO corpus_sources (
                id, source_type, source_ref, title, authors, venue, year, doi,
                canonical_url, file_path, content_hash, raw_content, word_count,
                fingerprint_count, is_active, indexed_at, last_error
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                authors = excluded.authors,
                venue = excluded.venue,
                year = excluded.year,
                doi = excluded.doi,
                canonical_url = excluded.canonical_url,
                file_path = excluded.file_path,
                content_hash = excluded.content_hash,
                raw_content = excluded.raw_content,
                word_count = excluded.word_count,
                fingerprint_count = excluded.fingerprint_count,
                is_active = excluded.is_active,
                indexed_at = excluded.indexed_at,
                last_error = excluded.last_error",
            params![
                src.id,
                src.source_type,
                src.source_ref,
                src.title,
                src.authors,
                src.venue,
                src.year,
                src.doi,
                src.canonical_url,
                src.file_path,
                src.content_hash,
                src.raw_content,
                src.word_count,
                src.fingerprint_count,
                src.is_active,
                src.indexed_at,
                src.last_error,
            ],
        )?;
        Ok(())
    }

    pub fn get_corpus_source(conn: &Connection, id: &str) -> Result<Option<CorpusSource>> {
        let mut stmt = conn.prepare(
            "SELECT id, source_type, source_ref, title, authors, venue, year, doi,
                    canonical_url, file_path, content_hash, raw_content, word_count,
                    fingerprint_count, is_active, indexed_at, last_error
             FROM corpus_sources WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(CorpusSource {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_ref: row.get(2)?,
                title: row.get(3)?,
                authors: row.get(4)?,
                venue: row.get(5)?,
                year: row.get(6)?,
                doi: row.get(7)?,
                canonical_url: row.get(8)?,
                file_path: row.get(9)?,
                content_hash: row.get(10)?,
                raw_content: row.get(11)?,
                word_count: row.get(12)?,
                fingerprint_count: row.get(13)?,
                is_active: row.get(14)?,
                indexed_at: row.get(15)?,
                last_error: row.get(16)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_corpus_sources(conn: &Connection) -> Result<Vec<CorpusSource>> {
        let mut stmt = conn.prepare(
            "SELECT id, source_type, source_ref, title, authors, venue, year, doi,
                    canonical_url, file_path, content_hash, raw_content, word_count,
                    fingerprint_count, is_active, indexed_at, last_error
             FROM corpus_sources ORDER BY indexed_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(CorpusSource {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_ref: row.get(2)?,
                title: row.get(3)?,
                authors: row.get(4)?,
                venue: row.get(5)?,
                year: row.get(6)?,
                doi: row.get(7)?,
                canonical_url: row.get(8)?,
                file_path: row.get(9)?,
                content_hash: row.get(10)?,
                raw_content: row.get(11)?,
                word_count: row.get(12)?,
                fingerprint_count: row.get(13)?,
                is_active: row.get(14)?,
                indexed_at: row.get(15)?,
                last_error: row.get(16)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_corpus_source(conn: &mut Connection, id: &str) -> Result<bool> {
        let count = conn.execute("DELETE FROM corpus_sources WHERE id = ?1", params![id])?;
        Ok(count > 0)
    }

    pub fn save_fingerprints(conn: &mut Connection, source_id: &str, fingerprints: &[(i64, i64)]) -> Result<()> {
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM corpus_fingerprints WHERE corpus_source_id = ?1", params![source_id])?;

        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO corpus_fingerprints (hash_value, corpus_source_id, char_offset)
                 VALUES (?1, ?2, ?3)",
            )?;

            for &(hash_val, offset) in fingerprints {
                stmt.execute(params![hash_val, source_id, offset])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn query_fingerprint_overlaps(conn: &Connection, target_hashes: &[i64]) -> Result<Vec<CorpusFingerprint>> {
        if target_hashes.is_empty() {
            return Ok(Vec::new());
        }

        // Query in chunks of 500 hashes
        let mut results = Vec::new();
        for chunk in target_hashes.chunks(500) {
            let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT cf.hash_value, cf.corpus_source_id, cf.char_offset
                 FROM corpus_fingerprints cf
                 JOIN corpus_sources cs ON cf.corpus_source_id = cs.id
                 WHERE cs.is_active = 1 AND cf.hash_value IN ({placeholders})"
            );

            let mut stmt = conn.prepare(&sql)?;
            let params_vec: Vec<rusqlite::types::Value> = chunk.iter().map(|&h| h.into()).collect();
            let rows = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
                Ok(CorpusFingerprint {
                    hash_value: row.get(0)?,
                    corpus_source_id: row.get(1)?,
                    char_offset: row.get(2)?,
                })
            })?;

            for r in rows {
                results.push(r?);
            }
        }

        Ok(results)
    }

    // -----------------------------------------------------------------------
    // Similarity Runs & Matches
    // -----------------------------------------------------------------------

    pub fn create_similarity_run(conn: &Connection, run: &SimilarityRun) -> Result<()> {
        conn.execute(
            "INSERT INTO similarity_runs (
                id, document_id, status, total_body_words, matched_body_words,
                overall_similarity_ratio, corpus_sources_searched, matched_sources_count,
                matches_count, execution_duration_ms, error_message, created_at, completed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                run.id,
                run.document_id,
                run.status,
                run.total_body_words,
                run.matched_body_words,
                run.overall_similarity_ratio,
                run.corpus_sources_searched,
                run.matched_sources_count,
                run.matches_count,
                run.execution_duration_ms,
                run.error_message,
                run.created_at,
                run.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_similarity_run(conn: &Connection, run: &SimilarityRun) -> Result<()> {
        conn.execute(
            "UPDATE similarity_runs SET
                status = ?2,
                total_body_words = ?3,
                matched_body_words = ?4,
                overall_similarity_ratio = ?5,
                corpus_sources_searched = ?6,
                matched_sources_count = ?7,
                matches_count = ?8,
                execution_duration_ms = ?9,
                error_message = ?10,
                completed_at = ?11
             WHERE id = ?1",
            params![
                run.id,
                run.status,
                run.total_body_words,
                run.matched_body_words,
                run.overall_similarity_ratio,
                run.corpus_sources_searched,
                run.matched_sources_count,
                run.matches_count,
                run.execution_duration_ms,
                run.error_message,
                run.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_similarity_run(conn: &Connection, run_id: &str) -> Result<Option<SimilarityRun>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, status, total_body_words, matched_body_words,
                    overall_similarity_ratio, corpus_sources_searched, matched_sources_count,
                    matches_count, execution_duration_ms, error_message, created_at, completed_at
             FROM similarity_runs WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![run_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SimilarityRun {
                id: row.get(0)?,
                document_id: row.get(1)?,
                status: row.get(2)?,
                total_body_words: row.get(3)?,
                matched_body_words: row.get(4)?,
                overall_similarity_ratio: row.get(5)?,
                corpus_sources_searched: row.get(6)?,
                matched_sources_count: row.get(7)?,
                matches_count: row.get(8)?,
                execution_duration_ms: row.get(9)?,
                error_message: row.get(10)?,
                created_at: row.get(11)?,
                completed_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_similarity_runs(conn: &Connection, limit: usize) -> Result<Vec<SimilarityRun>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, status, total_body_words, matched_body_words,
                    overall_similarity_ratio, corpus_sources_searched, matched_sources_count,
                    matches_count, execution_duration_ms, error_message, created_at, completed_at
             FROM similarity_runs ORDER BY created_at DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(SimilarityRun {
                id: row.get(0)?,
                document_id: row.get(1)?,
                status: row.get(2)?,
                total_body_words: row.get(3)?,
                matched_body_words: row.get(4)?,
                overall_similarity_ratio: row.get(5)?,
                corpus_sources_searched: row.get(6)?,
                matched_sources_count: row.get(7)?,
                matches_count: row.get(8)?,
                execution_duration_ms: row.get(9)?,
                error_message: row.get(10)?,
                created_at: row.get(11)?,
                completed_at: row.get(12)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_similarity_matches(conn: &mut Connection, matches: &[SimilarityMatch]) -> Result<()> {
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO similarity_matches (
                    id, similarity_run_id, corpus_source_id, match_type,
                    target_char_start, target_char_end, target_page_number, target_passage,
                    source_char_start, source_char_end, source_page_number, source_passage,
                    overlap_chars, confidence_score, review_status, review_notes, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            )?;

            for m in matches {
                stmt.execute(params![
                    m.id,
                    m.similarity_run_id,
                    m.corpus_source_id,
                    m.match_type,
                    m.target_char_start,
                    m.target_char_end,
                    m.target_page_number,
                    m.target_passage,
                    m.source_char_start,
                    m.source_char_end,
                    m.source_page_number,
                    m.source_passage,
                    m.overlap_chars,
                    m.confidence_score,
                    m.review_status,
                    m.review_notes,
                    m.created_at,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_matches_for_run(conn: &Connection, run_id: &str) -> Result<Vec<SimilarityMatchWithSource>> {
        let mut stmt = conn.prepare(
            "SELECT sm.id, sm.similarity_run_id, sm.corpus_source_id, sm.match_type,
                    sm.target_char_start, sm.target_char_end, sm.target_page_number, sm.target_passage,
                    sm.source_char_start, sm.source_char_end, sm.source_page_number, sm.source_passage,
                    sm.overlap_chars, sm.confidence_score, sm.review_status, sm.review_notes, sm.created_at,
                    cs.title, cs.authors, cs.doi, cs.canonical_url
             FROM similarity_matches sm
             JOIN corpus_sources cs ON sm.corpus_source_id = cs.id
             WHERE sm.similarity_run_id = ?1
             ORDER BY sm.target_char_start ASC",
        )?;

        let rows = stmt.query_map(params![run_id], |row| {
            Ok(SimilarityMatchWithSource {
                match_data: SimilarityMatch {
                    id: row.get(0)?,
                    similarity_run_id: row.get(1)?,
                    corpus_source_id: row.get(2)?,
                    match_type: row.get(3)?,
                    target_char_start: row.get(4)?,
                    target_char_end: row.get(5)?,
                    target_page_number: row.get(6)?,
                    target_passage: row.get(7)?,
                    source_char_start: row.get(8)?,
                    source_char_end: row.get(9)?,
                    source_page_number: row.get(10)?,
                    source_passage: row.get(11)?,
                    overlap_chars: row.get(12)?,
                    confidence_score: row.get(13)?,
                    review_status: row.get(14)?,
                    review_notes: row.get(15)?,
                    created_at: row.get(16)?,
                },
                source_title: row.get(17)?,
                source_authors: row.get(18)?,
                source_doi: row.get(19)?,
                source_canonical_url: row.get(20)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn update_match_review(
        conn: &Connection,
        match_id: &str,
        review_status: &str,
        review_notes: Option<&str>,
    ) -> Result<bool> {
        let count = conn.execute(
            "UPDATE similarity_matches SET review_status = ?2, review_notes = ?3 WHERE id = ?1",
            params![match_id, review_status, review_notes],
        )?;
        Ok(count > 0)
    }

    // -----------------------------------------------------------------------
    // AI Signal Runs & Segments
    // -----------------------------------------------------------------------

    pub fn create_ai_signal_run(conn: &Connection, run: &AiSignalRun) -> Result<()> {
        conn.execute(
            "INSERT INTO ai_signal_runs (
                id, document_id, model_id, model_version, inference_mode, status,
                overall_signal_score, signal_classification, analyzed_characters,
                analyzed_paragraphs, uncertainty_caveat, created_at, completed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                run.id,
                run.document_id,
                run.model_id,
                run.model_version,
                run.inference_mode,
                run.status,
                run.overall_signal_score,
                run.signal_classification,
                run.analyzed_characters,
                run.analyzed_paragraphs,
                run.uncertainty_caveat,
                run.created_at,
                run.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_ai_signal_run(conn: &Connection, run_id: &str) -> Result<Option<AiSignalRun>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, model_id, model_version, inference_mode, status,
                    overall_signal_score, signal_classification, analyzed_characters,
                    analyzed_paragraphs, uncertainty_caveat, created_at, completed_at
             FROM ai_signal_runs WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![run_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(AiSignalRun {
                id: row.get(0)?,
                document_id: row.get(1)?,
                model_id: row.get(2)?,
                model_version: row.get(3)?,
                inference_mode: row.get(4)?,
                status: row.get(5)?,
                overall_signal_score: row.get(6)?,
                signal_classification: row.get(7)?,
                analyzed_characters: row.get(8)?,
                analyzed_paragraphs: row.get(9)?,
                uncertainty_caveat: row.get(10)?,
                created_at: row.get(11)?,
                completed_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_ai_signal_segments(conn: &mut Connection, segments: &[AiSignalSegment]) -> Result<()> {
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO ai_signal_segments (id, ai_signal_run_id, segment_id, paragraph_index, score, classification, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )?;

            for seg in segments {
                stmt.execute(params![
                    seg.id,
                    seg.ai_signal_run_id,
                    seg.segment_id,
                    seg.paragraph_index,
                    seg.score,
                    seg.classification,
                    seg.notes,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_ai_signal_segments(conn: &Connection, run_id: &str) -> Result<Vec<AiSignalSegment>> {
        let mut stmt = conn.prepare(
            "SELECT id, ai_signal_run_id, segment_id, paragraph_index, score, classification, notes
             FROM ai_signal_segments WHERE ai_signal_run_id = ?1 ORDER BY paragraph_index ASC",
        )?;

        let rows = stmt.query_map(params![run_id], |row| {
            Ok(AiSignalSegment {
                id: row.get(0)?,
                ai_signal_run_id: row.get(1)?,
                segment_id: row.get(2)?,
                paragraph_index: row.get(3)?,
                score: row.get(4)?,
                classification: row.get(5)?,
                notes: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -----------------------------------------------------------------------
    // Writing Sessions & Revisions
    // -----------------------------------------------------------------------

    pub fn create_writing_session(conn: &Connection, sess: &WritingSession) -> Result<()> {
        conn.execute(
            "INSERT INTO writing_sessions (id, document_id, title, active_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![sess.id, sess.document_id, sess.title, sess.active_mode, sess.created_at, sess.updated_at],
        )?;
        Ok(())
    }

    pub fn get_writing_session(conn: &Connection, id: &str) -> Result<Option<WritingSession>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, title, active_mode, created_at, updated_at
             FROM writing_sessions WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(WritingSession {
                id: row.get(0)?,
                document_id: row.get(1)?,
                title: row.get(2)?,
                active_mode: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_writing_sessions(conn: &Connection) -> Result<Vec<WritingSession>> {
        let mut stmt = conn.prepare(
            "SELECT id, document_id, title, active_mode, created_at, updated_at
             FROM writing_sessions ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(WritingSession {
                id: row.get(0)?,
                document_id: row.get(1)?,
                title: row.get(2)?,
                active_mode: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_writing_revision(conn: &Connection, rev: &WritingRevision) -> Result<()> {
        conn.execute(
            "INSERT INTO writing_revisions (
                id, session_id, revision_number, action_type, original_text, revised_text,
                diff_summary, preserved_numbers_ok, preserved_citations_ok, preserved_equations_ok,
                preserved_dois_ok, meaning_risk_flags, is_accepted, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                rev.id,
                rev.session_id,
                rev.revision_number,
                rev.action_type,
                rev.original_text,
                rev.revised_text,
                rev.diff_summary,
                rev.preserved_numbers_ok,
                rev.preserved_citations_ok,
                rev.preserved_equations_ok,
                rev.preserved_dois_ok,
                rev.meaning_risk_flags,
                rev.is_accepted,
                rev.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_revisions_for_session(conn: &Connection, session_id: &str) -> Result<Vec<WritingRevision>> {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, revision_number, action_type, original_text, revised_text,
                    diff_summary, preserved_numbers_ok, preserved_citations_ok, preserved_equations_ok,
                    preserved_dois_ok, meaning_risk_flags, is_accepted, created_at
             FROM writing_revisions WHERE session_id = ?1 ORDER BY revision_number ASC",
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(WritingRevision {
                id: row.get(0)?,
                session_id: row.get(1)?,
                revision_number: row.get(2)?,
                action_type: row.get(3)?,
                original_text: row.get(4)?,
                revised_text: row.get(5)?,
                diff_summary: row.get(6)?,
                preserved_numbers_ok: row.get(7)?,
                preserved_citations_ok: row.get(8)?,
                preserved_equations_ok: row.get(9)?,
                preserved_dois_ok: row.get(10)?,
                meaning_risk_flags: row.get(11)?,
                is_accepted: row.get(12)?,
                created_at: row.get(13)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn set_revision_accepted(conn: &Connection, revision_id: &str, accepted: bool) -> Result<bool> {
        let count = conn.execute(
            "UPDATE writing_revisions SET is_accepted = ?2 WHERE id = ?1",
            params![revision_id, accepted],
        )?;
        Ok(count > 0)
    }

    // -----------------------------------------------------------------------
    // Model Registry
    // -----------------------------------------------------------------------

    pub fn list_models(conn: &Connection) -> Result<Vec<IntegrityModelDescriptor>> {
        let mut stmt = conn.prepare(
            "SELECT id, model_name, task_type, hf_repo_id, revision, license,
                    is_local, is_available, size_mb, evaluation_summary, created_at
             FROM model_registry ORDER BY task_type ASC, model_name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(IntegrityModelDescriptor {
                id: row.get(0)?,
                model_name: row.get(1)?,
                task_type: row.get(2)?,
                hf_repo_id: row.get(3)?,
                revision: row.get(4)?,
                license: row.get(5)?,
                is_local: row.get(6)?,
                is_available: row.get(7)?,
                size_mb: row.get(8)?,
                evaluation_summary: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -----------------------------------------------------------------------
    // Dashboard Summary
    // -----------------------------------------------------------------------

    pub fn get_dashboard_summary(conn: &Connection) -> Result<IntegrityDashboardSummary> {
        let doc_count: i64 = conn.query_row("SELECT COUNT(*) FROM integrity_documents", [], |r| r.get(0)).unwrap_or(0);
        let corpus_count: i64 = conn.query_row("SELECT COUNT(*) FROM corpus_sources WHERE is_active = 1", [], |r| r.get(0)).unwrap_or(0);
        let fp_count: i64 = conn.query_row("SELECT COUNT(*) FROM corpus_fingerprints", [], |r| r.get(0)).unwrap_or(0);
        let session_count: i64 = conn.query_row("SELECT COUNT(*) FROM writing_sessions", [], |r| r.get(0)).unwrap_or(0);

        let recent_runs = Self::list_similarity_runs(conn, 5)?;
        let models = Self::list_models(conn)?;

        Ok(IntegrityDashboardSummary {
            total_documents_analyzed: doc_count,
            total_corpus_sources: corpus_count,
            total_fingerprints_indexed: fp_count,
            recent_similarity_runs: recent_runs,
            available_models: models,
            active_writing_sessions: session_count,
        })
    }
}
