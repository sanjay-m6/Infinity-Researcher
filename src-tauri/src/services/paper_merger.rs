use crate::domain::processing::{MergeRequest, MergeResult};
use crate::errors::AppError;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub struct PaperMerger;

impl PaperMerger {
    /// Merges an incoming paper into a canonical paper record atomically within a transaction:
    /// - Fills missing canonical metadata from incoming
    /// - Reassigns sources, files, collections, tags, notes, and identifiers
    /// - Soft-merges incoming paper by pointing its merged_into_id to canonical
    /// - Creates durable audit history in paper_merge_history
    /// - Updates duplicate candidate status if candidate_id was provided
    pub fn merge_papers(
        conn: &mut Connection,
        req: &MergeRequest,
    ) -> Result<MergeResult, AppError> {
        if req.canonical_paper_id == req.merged_paper_id {
            return Err(AppError::Validation(
                "Cannot merge a paper into itself".to_string(),
            ));
        }

        let tx = conn
            .transaction()
            .map_err(|e| AppError::Internal(format!("Failed to begin transaction: {}", e)))?;

        // 1. Verify existence of both papers
        let canonical_exists: bool = tx
            .query_row(
                "SELECT 1 FROM papers WHERE id = ?1 AND merged_into_id IS NULL",
                params![req.canonical_paper_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !canonical_exists {
            return Err(AppError::Validation(
                "Canonical paper record not found or already merged".to_string(),
            ));
        }

        let incoming_exists: bool = tx
            .query_row(
                "SELECT 1 FROM papers WHERE id = ?1 AND merged_into_id IS NULL",
                params![req.merged_paper_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !incoming_exists {
            return Err(AppError::Validation(
                "Incoming paper record not found or already merged".to_string(),
            ));
        }

        // 2. Fetch missing fields from incoming to supplement canonical
        let mut fields_updated = Vec::new();

        struct IncomingPaperFields {
            doi: Option<String>,
            abstract_text: Option<String>,
            venue: Option<String>,
            pdf_url: Option<String>,
            year: Option<i32>,
            date: Option<String>,
        }

        let incoming_fields = tx.query_row(
            "SELECT canonical_doi, abstract, venue, pdf_url, publication_year, publication_date FROM papers WHERE id = ?1",
            params![req.merged_paper_id],
            |row| Ok(IncomingPaperFields {
                doi: row.get(0)?,
                abstract_text: row.get(1)?,
                venue: row.get(2)?,
                pdf_url: row.get(3)?,
                year: row.get(4)?,
                date: row.get(5)?,
            }),
        ).map_err(|e| AppError::Internal(format!("Failed to query incoming paper: {}", e)))?;

        // Fill canonical fields if null
        if let Some(doi) = incoming_fields.doi {
            let canon_has_doi: bool = tx
                .query_row(
                    "SELECT canonical_doi IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_doi {
                tx.execute(
                    "UPDATE papers SET canonical_doi = ?1 WHERE id = ?2",
                    params![doi, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;

                fields_updated.push("canonical_doi".to_string());
            }
        }

        if let Some(abs) = incoming_fields.abstract_text {
            let canon_has_abs: bool = tx
                .query_row(
                    "SELECT abstract IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_abs {
                tx.execute(
                    "UPDATE papers SET abstract = ?1 WHERE id = ?2",
                    params![abs, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
                fields_updated.push("abstract".to_string());
            }
        }

        if let Some(venue) = incoming_fields.venue {
            let canon_has_venue: bool = tx
                .query_row(
                    "SELECT venue IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_venue {
                tx.execute(
                    "UPDATE papers SET venue = ?1 WHERE id = ?2",
                    params![venue, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
                fields_updated.push("venue".to_string());
            }
        }

        if let Some(pdf) = incoming_fields.pdf_url {
            let canon_has_pdf: bool = tx
                .query_row(
                    "SELECT pdf_url IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_pdf {
                tx.execute(
                    "UPDATE papers SET pdf_url = ?1 WHERE id = ?2",
                    params![pdf, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
                fields_updated.push("pdf_url".to_string());
            }
        }

        if let Some(year) = incoming_fields.year {
            let canon_has_year: bool = tx
                .query_row(
                    "SELECT publication_year IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_year {
                tx.execute(
                    "UPDATE papers SET publication_year = ?1 WHERE id = ?2",
                    params![year, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
                fields_updated.push("publication_year".to_string());
            }
        }

        if let Some(date) = incoming_fields.date {
            let canon_has_date: bool = tx
                .query_row(
                    "SELECT publication_date IS NOT NULL FROM papers WHERE id = ?1",
                    params![req.canonical_paper_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !canon_has_date {
                tx.execute(
                    "UPDATE papers SET publication_date = ?1 WHERE id = ?2",
                    params![date, req.canonical_paper_id],
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
                fields_updated.push("publication_date".to_string());
            }
        }

        // 3. Reassign paper_sources
        let sources_count = tx.execute(
            "INSERT OR IGNORE INTO paper_sources (paper_id, source_id, source_record_id, source_url, raw_payload_json, open_access_pdf_url, retrieved_at)
             SELECT ?1, source_id, source_record_id, source_url, raw_payload_json, open_access_pdf_url, retrieved_at
             FROM paper_sources WHERE paper_id = ?2",
            params![req.canonical_paper_id, req.merged_paper_id],
        ).map_err(|e| AppError::Internal(format!("Failed to reassign sources: {}", e)))?;
        tx.execute(
            "DELETE FROM paper_sources WHERE paper_id = ?1",
            params![req.merged_paper_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // 4. Reassign paper_files
        let files_count = tx.execute(
            "UPDATE paper_files SET paper_id = ?1, updated_at = datetime('now') WHERE paper_id = ?2",
            params![req.canonical_paper_id, req.merged_paper_id],
        ).map_err(|e| AppError::Internal(format!("Failed to reassign files: {}", e)))?;

        // 5. Reassign paper_identifiers
        tx.execute(
            "UPDATE paper_identifiers SET paper_id = ?1 WHERE paper_id = ?2",
            params![req.canonical_paper_id, req.merged_paper_id],
        )
        .map_err(|e| AppError::Internal(format!("Failed to reassign identifiers: {}", e)))?;

        // 6. Reassign collections
        if req.preserve_collections {
            tx.execute(
                "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at, sort_order)
                 SELECT collection_id, ?1, added_at, sort_order FROM collection_papers WHERE paper_id = ?2",
                params![req.canonical_paper_id, req.merged_paper_id],
            ).map_err(|e| AppError::Internal(e.to_string()))?;
            tx.execute(
                "DELETE FROM collection_papers WHERE paper_id = ?1",
                params![req.merged_paper_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // 7. Reassign tags
        if req.preserve_tags {
            tx.execute(
                "INSERT OR IGNORE INTO paper_tags (paper_id, tag_id, tagged_at)
                 SELECT ?1, tag_id, tagged_at FROM paper_tags WHERE paper_id = ?2",
                params![req.canonical_paper_id, req.merged_paper_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
            tx.execute(
                "DELETE FROM paper_tags WHERE paper_id = ?1",
                params![req.merged_paper_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // 8. Reassign notes
        if req.preserve_notes {
            tx.execute(
                "UPDATE notes SET paper_id = ?1, updated_at = datetime('now') WHERE paper_id = ?2",
                params![req.canonical_paper_id, req.merged_paper_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // 9. Soft-merge incoming record
        tx.execute(
            "UPDATE papers SET merged_into_id = ?1, is_saved = 0, updated_at = datetime('now') WHERE id = ?2",
            params![req.canonical_paper_id, req.merged_paper_id],
        ).map_err(|e| AppError::Internal(format!("Failed to soft-merge paper: {}", e)))?;

        // 10. Record merge audit history
        let history_id = Uuid::new_v4().to_string();
        let decisions_json = json!({
            "fields_updated": fields_updated,
            "preserve_notes": req.preserve_notes,
            "preserve_tags": req.preserve_tags,
            "preserve_collections": req.preserve_collections,
            "notes": req.merge_notes,
        })
        .to_string();

        let preserved_json = json!({
            "sources_reassigned": sources_count,
            "files_reassigned": files_count,
        })
        .to_string();

        tx.execute(
            "INSERT INTO paper_merge_history (id, canonical_paper_id, merged_paper_id, field_decisions_json, preserved_records_json, merged_by, merged_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'user', datetime('now'))",
            params![history_id, req.canonical_paper_id, req.merged_paper_id, decisions_json, preserved_json],
        ).map_err(|e| AppError::Internal(e.to_string()))?;

        // 11. Update duplicate candidate if specified
        if let Some(ref cand_id) = req.candidate_id {
            tx.execute(
                "UPDATE duplicate_candidates SET status = 'merged', decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
                params![cand_id],
            ).map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // 12. Commit transaction
        tx.commit().map_err(|e| {
            AppError::Internal(format!("Failed to commit merge transaction: {}", e))
        })?;

        Ok(MergeResult {
            success: true,
            canonical_paper_id: req.canonical_paper_id.clone(),
            merged_paper_id: req.merged_paper_id.clone(),
            fields_updated,
            files_reassigned: files_count,
            sources_reassigned: sources_count,
            message: format!(
                "Successfully merged paper {} into canonical paper {}",
                req.merged_paper_id, req.canonical_paper_id
            ),
        })
    }
}
