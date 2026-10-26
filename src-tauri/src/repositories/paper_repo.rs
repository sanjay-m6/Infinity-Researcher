use crate::domain::pagination::PagedResponse;
use crate::domain::paper::{Author, Paper, PaperListQuery};
use rusqlite::{params, Connection, Result};

pub struct PaperRepository;

impl PaperRepository {
    pub const SELECT_COLUMNS: &'static str = "
        p.id, p.canonical_doi, p.title, p.clean_title_key, p.abstract, p.publication_date,
        p.publication_year, p.venue, p.venue_type, p.language, p.citation_count, p.reference_count,
        p.is_open_access, p.license, p.primary_landing_url, p.pdf_url, p.has_file,
        p.local_pdf_path, p.content_hash, p.metadata_confidence, p.is_saved,
        p.reading_status, p.reading_progress, p.created_at, p.updated_at,
        p.open_access_status, p.access_evidence_type, p.access_evidence_note,
        p.license_name, p.license_url, p.source_name, p.retrieval_method, p.access_confirmed_at
    ";

    /// Inserts a canonical paper record along with its authors, collections, and tags in an atomic transaction.
    pub fn create(conn: &mut Connection, paper: &Paper) -> Result<()> {
        let tx = conn.transaction()?;

        let is_oa = if paper.is_open_access { 1 } else { 0 };
        let has_file = if paper.has_file { 1 } else { 0 };
        let is_saved = if paper.is_saved { 1 } else { 0 };

        let params: &[&dyn rusqlite::ToSql] = &[
            &paper.id,
            &paper.canonical_doi,
            &paper.title,
            &paper.clean_title_key,
            &paper.abstract_text,
            &paper.publication_date,
            &paper.publication_year,
            &paper.venue,
            &paper.venue_type,
            &paper.language,
            &paper.citation_count,
            &paper.reference_count,
            &is_oa,
            &paper.license,
            &paper.primary_landing_url,
            &paper.pdf_url,
            &has_file,
            &paper.local_pdf_path,
            &paper.content_hash,
            &paper.metadata_confidence,
            &is_saved,
            &paper.reading_status,
            &paper.reading_progress,
            &paper.created_at,
            &paper.updated_at,
            &paper.open_access_status,
            &paper.access_evidence_type,
            &paper.access_evidence_note,
            &paper.license_name,
            &paper.license_url,
            &paper.source_name,
            &paper.retrieval_method,
            &paper.access_confirmed_at,
        ];

        tx.execute(
            "INSERT INTO papers (
                id, canonical_doi, title, clean_title_key, abstract, publication_date,
                publication_year, venue, venue_type, language, citation_count, reference_count,
                is_open_access, license, primary_landing_url, pdf_url, has_file,
                local_pdf_path, content_hash, metadata_confidence, is_saved,
                reading_status, reading_progress, created_at, updated_at,
                open_access_status, access_evidence_type, access_evidence_note,
                license_name, license_url, source_name, retrieval_method, access_confirmed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33)",
            params,
        )?;

        // Insert authors and join records
        for author in &paper.authors {
            tx.execute(
                "INSERT OR IGNORE INTO authors (id, full_name, family_name, given_name, orcid, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
                params![author.id, author.full_name, author.family_name, author.given_name, author.orcid],
            )?;

            tx.execute(
                "INSERT OR REPLACE INTO paper_authors (paper_id, author_id, author_order, affiliation, role)
                 VALUES (?1, ?2, ?3, ?4, 'author')",
                params![paper.id, author.id, author.author_order, author.affiliation],
            )?;
        }

        // Insert collection links
        for col_id in &paper.collection_ids {
            tx.execute(
                "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at, sort_order)
                 VALUES (?1, ?2, datetime('now'), 0)",
                params![col_id, paper.id],
            )?;
        }

        // Insert tags
        for tag_name in &paper.tags {
            let tag_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT OR IGNORE INTO tags (id, name, color_hex, created_at)
                 VALUES (?1, ?2, '#64748b', datetime('now'))",
                params![tag_id, tag_name],
            )?;

            tx.execute(
                "INSERT OR IGNORE INTO paper_tags (paper_id, tag_id, tagged_at)
                 SELECT ?1, id, datetime('now') FROM tags WHERE lower(name) = lower(?2)",
                params![paper.id, tag_name],
            )?;
        }

        // Synchronize FTS5 virtual table
        let author_names = paper
            .authors
            .iter()
            .map(|a| a.full_name.as_str())
            .collect::<Vec<_>>()
            .join(", ");

        tx.execute(
            "INSERT INTO papers_fts (paper_id, title, abstract, authors, venue)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                paper.id,
                paper.title,
                paper.abstract_text.as_deref().unwrap_or(""),
                author_names,
                paper.venue.as_deref().unwrap_or(""),
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    /// Updates supported fields on a paper and refreshes associations and FTS.
    pub fn update(conn: &mut Connection, paper: &Paper) -> Result<()> {
        let tx = conn.transaction()?;

        let is_oa = if paper.is_open_access { 1 } else { 0 };
        let is_saved = if paper.is_saved { 1 } else { 0 };

        let params: &[&dyn rusqlite::ToSql] = &[
            &paper.canonical_doi,
            &paper.title,
            &paper.clean_title_key,
            &paper.abstract_text,
            &paper.publication_date,
            &paper.publication_year,
            &paper.venue,
            &is_oa,
            &paper.primary_landing_url,
            &paper.pdf_url,
            &is_saved,
            &paper.reading_status,
            &paper.reading_progress,
            &paper.open_access_status,
            &paper.access_evidence_type,
            &paper.access_evidence_note,
            &paper.license_name,
            &paper.license_url,
            &paper.source_name,
            &paper.retrieval_method,
            &paper.access_confirmed_at,
            &paper.id,
        ];

        tx.execute(
            "UPDATE papers SET
                canonical_doi = ?1,
                title = ?2,
                clean_title_key = ?3,
                abstract = ?4,
                publication_date = ?5,
                publication_year = ?6,
                venue = ?7,
                is_open_access = ?8,
                primary_landing_url = ?9,
                pdf_url = ?10,
                is_saved = ?11,
                reading_status = ?12,
                reading_progress = ?13,
                open_access_status = ?14,
                access_evidence_type = ?15,
                access_evidence_note = ?16,
                license_name = ?17,
                license_url = ?18,
                source_name = ?19,
                retrieval_method = ?20,
                access_confirmed_at = ?21,
                updated_at = datetime('now')
             WHERE id = ?22",
            params,
        )?;

        // Refresh authors
        tx.execute(
            "DELETE FROM paper_authors WHERE paper_id = ?1",
            params![paper.id],
        )?;
        for author in &paper.authors {
            tx.execute(
                "INSERT OR IGNORE INTO authors (id, full_name, family_name, given_name, orcid, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
                params![author.id, author.full_name, author.family_name, author.given_name, author.orcid],
            )?;

            tx.execute(
                "INSERT INTO paper_authors (paper_id, author_id, author_order, affiliation, role)
                 VALUES (?1, ?2, ?3, ?4, 'author')",
                params![paper.id, author.id, author.author_order, author.affiliation],
            )?;
        }

        // Refresh collections
        tx.execute(
            "DELETE FROM collection_papers WHERE paper_id = ?1",
            params![paper.id],
        )?;
        for col_id in &paper.collection_ids {
            tx.execute(
                "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at)
                 VALUES (?1, ?2, datetime('now'))",
                params![col_id, paper.id],
            )?;
        }

        // Refresh tags
        tx.execute(
            "DELETE FROM paper_tags WHERE paper_id = ?1",
            params![paper.id],
        )?;
        for tag_name in &paper.tags {
            let tag_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT OR IGNORE INTO tags (id, name, color_hex, created_at)
                 VALUES (?1, ?2, '#64748b', datetime('now'))",
                params![tag_id, tag_name],
            )?;

            tx.execute(
                "INSERT OR IGNORE INTO paper_tags (paper_id, tag_id, tagged_at)
                 SELECT ?1, id, datetime('now') FROM tags WHERE lower(name) = lower(?2)",
                params![paper.id, tag_name],
            )?;
        }

        // Update FTS
        tx.execute(
            "DELETE FROM papers_fts WHERE paper_id = ?1",
            params![paper.id],
        )?;
        let author_names = paper
            .authors
            .iter()
            .map(|a| a.full_name.as_str())
            .collect::<Vec<_>>()
            .join(", ");

        tx.execute(
            "INSERT INTO papers_fts (paper_id, title, abstract, authors, venue)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                paper.id,
                paper.title,
                paper.abstract_text.as_deref().unwrap_or(""),
                author_names,
                paper.venue.as_deref().unwrap_or(""),
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    /// Fetches a single paper by primary ID, hydrating all associations.
    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Paper>> {
        let sql = format!(
            "SELECT {} FROM papers p WHERE p.id = ?1",
            Self::SELECT_COLUMNS
        );
        let mut stmt = conn.prepare(&sql)?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let paper = Self::hydrate_paper_from_row(conn, row)?;
            Ok(Some(paper))
        } else {
            Ok(None)
        }
    }

    /// Looks up paper by canonical DOI for deduplication
    pub fn get_by_doi(conn: &Connection, doi: &str) -> Result<Option<Paper>> {
        let sql = format!(
            "SELECT {} FROM papers p WHERE lower(p.canonical_doi) = lower(?1)",
            Self::SELECT_COLUMNS
        );
        let mut stmt = conn.prepare(&sql)?;

        let mut rows = stmt.query(params![doi.trim()])?;
        if let Some(row) = rows.next()? {
            let paper = Self::hydrate_paper_from_row(conn, row)?;
            Ok(Some(paper))
        } else {
            Ok(None)
        }
    }

    /// Looks up paper by clean title key for fuzzy title duplicate warning
    pub fn get_by_clean_title(conn: &Connection, clean_title: &str) -> Result<Option<Paper>> {
        let sql = format!(
            "SELECT {} FROM papers p WHERE p.clean_title_key = ?1",
            Self::SELECT_COLUMNS
        );
        let mut stmt = conn.prepare(&sql)?;

        let mut rows = stmt.query(params![clean_title])?;
        if let Some(row) = rows.next()? {
            let paper = Self::hydrate_paper_from_row(conn, row)?;
            Ok(Some(paper))
        } else {
            Ok(None)
        }
    }

    /// Looks up paper by SHA-256 content hash for duplicate PDF detection
    pub fn get_by_content_hash(conn: &Connection, hash: &str) -> Result<Option<Paper>> {
        let sql = format!(
            "SELECT {} FROM papers p WHERE p.content_hash = ?1 LIMIT 1",
            Self::SELECT_COLUMNS
        );
        let mut stmt = conn.prepare(&sql)?;

        let mut rows = stmt.query(params![hash.trim()])?;
        if let Some(row) = rows.next()? {
            let paper = Self::hydrate_paper_from_row(conn, row)?;
            Ok(Some(paper))
        } else {
            Ok(None)
        }
    }

    /// Queries papers with full-text search, filtering, and pagination.
    pub fn list(conn: &Connection, q: &PaperListQuery) -> Result<PagedResponse<Paper>> {
        let page = q.page.unwrap_or(1).max(1);
        let page_size = q.page_size.unwrap_or(20).clamp(1, 10_000);
        let offset = (page - 1) * page_size;

        let mut conditions: Vec<String> = Vec::new();
        let mut sql_params: Vec<rusqlite::types::Value> = Vec::new();

        // Saved filter
        if q.is_saved_only.unwrap_or(false) {
            conditions.push("p.is_saved = 1".to_string());
        }

        // Open access filter
        if q.open_access_only.unwrap_or(false) {
            conditions.push("p.is_open_access = 1".to_string());
        }

        // Open access status filter
        if let Some(ref oas) = q.open_access_status {
            let s = oas.trim();
            if !s.is_empty() && s != "all" {
                conditions.push("p.open_access_status = ?".to_string());
                sql_params.push(s.to_string().into());
            }
        }

        // Retrieval method filter
        if let Some(ref rm) = q.retrieval_method {
            let s = rm.trim();
            if !s.is_empty() && s != "all" {
                conditions.push("p.retrieval_method = ?".to_string());
                sql_params.push(s.to_string().into());
            }
        }

        // Has file filter
        if let Some(hf) = q.has_file {
            conditions.push(format!("p.has_file = {}", if hf { 1 } else { 0 }));
        }

        // Has DOI filter
        if let Some(hd) = q.has_doi {
            if hd {
                conditions.push(
                    "p.canonical_doi IS NOT NULL AND trim(p.canonical_doi) != ''".to_string(),
                );
            } else {
                conditions
                    .push("(p.canonical_doi IS NULL OR trim(p.canonical_doi) = '')".to_string());
            }
        }

        // Year range
        if let Some(start) = q.year_start {
            conditions.push("p.publication_year >= ?".to_string());
            sql_params.push(start.into());
        }
        if let Some(end) = q.year_end {
            conditions.push("p.publication_year <= ?".to_string());
            sql_params.push(end.into());
        }

        // Collection filter
        if let Some(ref col_id) = q.collection_id {
            if col_id != "all" && !col_id.is_empty() {
                conditions.push("EXISTS (SELECT 1 FROM collection_papers cp WHERE cp.paper_id = p.id AND cp.collection_id = ?)".to_string());
                sql_params.push(col_id.clone().into());
            }
        }

        // Tag filter
        if let Some(ref tag_val) = q.tag {
            let t = tag_val.trim();
            if !t.is_empty() && t != "all" {
                conditions.push("EXISTS (SELECT 1 FROM paper_tags pt JOIN tags tg ON tg.id = pt.tag_id WHERE pt.paper_id = p.id AND (lower(tg.name) = lower(?) OR tg.id = ?))".to_string());
                sql_params.push(t.to_string().into());
                sql_params.push(t.to_string().into());
            }
        }

        // Reading status filter
        if let Some(ref status_val) = q.reading_status {
            let s = status_val.trim().to_lowercase();
            if !s.is_empty() && s != "all" {
                conditions.push("p.reading_status = ?".to_string());
                sql_params.push(s.into());
            }
        }

        // Source filter
        if let Some(ref src_id) = q.source_id {
            if src_id != "all" && !src_id.is_empty() {
                conditions.push("EXISTS (SELECT 1 FROM paper_sources ps WHERE ps.paper_id = p.id AND ps.source_id = ?)".to_string());
                sql_params.push(src_id.clone().into());
            }
        }

        // FTS / Keyword query across metadata, extracted text, notes, title, DOI, and abstract
        if let Some(ref search_text) = q.query {
            let trimmed = search_text.trim();
            if !trimmed.is_empty() {
                let fts_query = trimmed
                    .split_whitespace()
                    .map(|w| format!("\"{}\"*", w.replace('"', "")))
                    .collect::<Vec<_>>()
                    .join(" AND ");

                conditions.push(
                    "(p.id IN (SELECT paper_id FROM papers_fts WHERE papers_fts MATCH ?)
                      OR p.id IN (SELECT paper_id FROM doc_text_fts WHERE doc_text_fts MATCH ?)
                      OR EXISTS (SELECT 1 FROM notes n WHERE n.paper_id = p.id AND (n.title LIKE ? OR n.content_markdown LIKE ?))
                      OR p.title LIKE ?
                      OR p.canonical_doi LIKE ?
                      OR p.abstract LIKE ?)"
                        .to_string(),
                );
                sql_params.push(fts_query.clone().into());
                sql_params.push(fts_query.into());
                sql_params.push(format!("%{}%", trimmed).into());
                sql_params.push(format!("%{}%", trimmed).into());
                sql_params.push(format!("%{}%", trimmed).into());
                sql_params.push(format!("%{}%", trimmed).into());
                sql_params.push(format!("%{}%", trimmed).into());
            }
        }

        let where_clause = if conditions.is_empty() {
            "".to_string()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Total count query
        let count_sql = format!("SELECT COUNT(*) FROM papers p {}", where_clause);
        let mut count_stmt = conn.prepare(&count_sql)?;
        let count_params_refs: Vec<&dyn rusqlite::ToSql> = sql_params
            .iter()
            .map(|v| v as &dyn rusqlite::ToSql)
            .collect();
        let total_count: i64 =
            count_stmt.query_row(count_params_refs.as_slice(), |row| row.get(0))?;

        // Sort order
        let order_clause = match q.sort_by.as_deref() {
            Some("oldest") => "ORDER BY p.publication_year ASC, p.created_at ASC, p.id ASC",
            Some("citations") => "ORDER BY p.citation_count DESC, p.created_at DESC, p.id ASC",
            Some("title") => "ORDER BY p.title ASC, p.id ASC",
            Some("title_desc") => "ORDER BY p.title DESC, p.id ASC",
            Some("reading_status") => "ORDER BY p.reading_status ASC, p.created_at DESC, p.id ASC",
            Some("added_desc") => "ORDER BY p.created_at DESC, p.id ASC",
            Some("added_asc") => "ORDER BY p.created_at ASC, p.id ASC",
            Some("relevance") => {
                if q.query
                    .as_ref()
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false)
                {
                    "ORDER BY p.has_file DESC, p.citation_count DESC, p.created_at DESC, p.id ASC"
                } else {
                    "ORDER BY p.created_at DESC, p.id ASC"
                }
            }
            _ => "ORDER BY p.publication_year DESC, p.created_at DESC, p.id ASC", // default newest
        };

        // Select query
        let select_sql = format!(
            "SELECT {}
             FROM papers p
             {}
             {}
             LIMIT ? OFFSET ?",
            Self::SELECT_COLUMNS,
            where_clause,
            order_clause
        );

        let mut select_stmt = conn.prepare(&select_sql)?;
        let mut full_params = sql_params;
        full_params.push((page_size as i64).into());
        full_params.push((offset as i64).into());

        let full_params_refs: Vec<&dyn rusqlite::ToSql> = full_params
            .iter()
            .map(|v| v as &dyn rusqlite::ToSql)
            .collect();
        let rows = select_stmt.query_map(full_params_refs.as_slice(), |row| {
            Self::hydrate_paper_from_row(conn, row)
        })?;

        let mut papers = Vec::new();
        for r in rows {
            papers.push(r?);
        }

        Ok(PagedResponse::new(papers, total_count, page, page_size))
    }

    /// Deletes paper and cascades cleanly to paper_authors, collection_papers, papers_fts, and doc_text_fts.
    pub fn delete(conn: &mut Connection, id: &str) -> Result<bool> {
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM papers_fts WHERE paper_id = ?1", params![id])?;
        tx.execute("DELETE FROM doc_text_fts WHERE paper_id = ?1", params![id])?;
        let rows = tx.execute("DELETE FROM papers WHERE id = ?1", params![id])?;
        tx.commit()?;
        Ok(rows > 0)
    }

    /// Sets the `is_saved` flag for a paper (toggling save to library).
    pub fn set_saved(conn: &Connection, id: &str, is_saved: bool) -> Result<bool> {
        let rows = conn.execute(
            "UPDATE papers SET is_saved = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![if is_saved { 1 } else { 0 }, id],
        )?;
        Ok(rows > 0)
    }

    /// Updates the reading status for a paper ('unread', 'reading', 'read').
    pub fn update_reading_status(conn: &Connection, id: &str, status: &str) -> Result<bool> {
        let rows = conn.execute(
            "UPDATE papers SET reading_status = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![status, id],
        )?;
        Ok(rows > 0)
    }

    /// Updates reading progress for a paper (0.0 to 1.0).
    pub fn update_reading_progress(conn: &Connection, id: &str, progress: f64) -> Result<bool> {
        let clamped = progress.clamp(0.0, 1.0);
        let rows = conn.execute(
            "UPDATE papers SET reading_progress = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![clamped, id],
        )?;
        Ok(rows > 0)
    }

    /// Bulk updates reading status across multiple papers.
    pub fn bulk_update_reading_status(
        conn: &Connection,
        ids: &[String],
        status: &str,
    ) -> Result<usize> {
        let mut count = 0;
        for id in ids {
            if Self::update_reading_status(conn, id, status)? {
                count += 1;
            }
        }
        Ok(count)
    }

    /// Rebuilds search indexes (`papers_fts` and `doc_text_fts`) from existing canonical records.
    pub fn rebuild_search_index(conn: &mut Connection) -> Result<usize> {
        let tx = conn.transaction()?;

        tx.execute_batch(
            "DELETE FROM papers_fts;
             DELETE FROM doc_text_fts;

             INSERT INTO papers_fts (paper_id, title, abstract, authors, venue)
             SELECT p.id, p.title, ifnull(p.abstract, ''),
                    ifnull((SELECT group_concat(a.full_name, ', ')
                            FROM authors a
                            JOIN paper_authors pa ON pa.author_id = a.id
                            WHERE pa.paper_id = p.id), ''),
                    ifnull(p.venue, '')
             FROM papers p;

             INSERT INTO doc_text_fts (file_id, paper_id, extracted_text)
             SELECT id, paper_id, extracted_text
             FROM paper_files
             WHERE extracted_text IS NOT NULL AND trim(extracted_text) != '';",
        )?;

        let total_indexed: i64 =
            tx.query_row("SELECT COUNT(*) FROM papers_fts", [], |r| r.get(0))?;
        tx.commit()?;
        Ok(total_indexed as usize)
    }

    /// Internal helper to hydrate associations on a paper row.
    fn hydrate_paper_from_row(conn: &Connection, row: &rusqlite::Row) -> Result<Paper> {
        let id: String = row.get(0)?;

        // Hydrate ordered authors
        let mut author_stmt = conn.prepare(
            "SELECT a.id, a.full_name, a.family_name, a.given_name, a.orcid, pa.affiliation, pa.author_order, a.created_at
             FROM authors a
             JOIN paper_authors pa ON pa.author_id = a.id
             WHERE pa.paper_id = ?1
             ORDER BY pa.author_order ASC",
        )?;
        let author_rows = author_stmt.query_map(params![id], |a_row| {
            Ok(Author {
                id: a_row.get(0)?,
                full_name: a_row.get(1)?,
                family_name: a_row.get(2)?,
                given_name: a_row.get(3)?,
                orcid: a_row.get(4)?,
                affiliation: a_row.get(5)?,
                author_order: a_row.get(6)?,
                created_at: a_row.get(7)?,
            })
        })?;
        let mut authors = Vec::new();
        for a in author_rows {
            authors.push(a?);
        }

        // Hydrate collection IDs
        let mut col_stmt =
            conn.prepare("SELECT collection_id FROM collection_papers WHERE paper_id = ?1")?;
        let col_rows = col_stmt.query_map(params![id], |r| r.get(0))?;
        let mut collection_ids = Vec::new();
        for c in col_rows {
            collection_ids.push(c?);
        }

        // Hydrate tags
        let mut tag_stmt = conn.prepare(
            "SELECT t.name FROM tags t
             JOIN paper_tags pt ON pt.tag_id = t.id
             WHERE pt.paper_id = ?1
             ORDER BY t.name ASC",
        )?;
        let tag_rows = tag_stmt.query_map(params![id], |r| r.get(0))?;
        let mut tags = Vec::new();
        for t in tag_rows {
            tags.push(t?);
        }

        // Hydrate source names
        let mut src_stmt = conn.prepare(
            "SELECT s.name FROM sources s
             JOIN paper_sources ps ON ps.source_id = s.id
             WHERE ps.paper_id = ?1",
        )?;
        let src_rows = src_stmt.query_map(params![id], |r| r.get(0))?;
        let mut source_names = Vec::new();
        for s in src_rows {
            source_names.push(s?);
        }

        let reading_status: String = row
            .get::<_, Option<String>>(21)?
            .unwrap_or_else(|| "unread".to_string());
        let reading_progress: f64 = row.get::<_, Option<f64>>(22)?.unwrap_or(0.0);
        let created_at: String = row.get(23)?;
        let updated_at: String = row.get(24)?;

        let open_access_status: String = row
            .get::<_, Option<String>>(25)?
            .unwrap_or_else(|| "pending_verification".to_string());
        let access_evidence_type: String = row
            .get::<_, Option<String>>(26)?
            .unwrap_or_else(|| "unknown".to_string());
        let access_evidence_note: Option<String> = row.get(27)?;
        let license_name: Option<String> = row.get(28)?;
        let license_url: Option<String> = row.get(29)?;
        let source_name: Option<String> = row.get(30)?;
        let retrieval_method: String = row
            .get::<_, Option<String>>(31)?
            .unwrap_or_else(|| "local_file_import".to_string());
        let access_confirmed_at: Option<String> = row.get(32)?;

        Ok(Paper {
            id,
            canonical_doi: row.get(1)?,
            title: row.get(2)?,
            clean_title_key: row.get(3)?,
            abstract_text: row.get(4)?,
            publication_date: row.get(5)?,
            publication_year: row.get(6)?,
            venue: row.get(7)?,
            venue_type: row.get(8)?,
            language: row
                .get::<_, Option<String>>(9)?
                .unwrap_or_else(|| "en".to_string()),
            citation_count: row.get(10)?,
            reference_count: row.get(11)?,
            is_open_access: row.get::<_, i32>(12)? == 1,
            license: row.get(13)?,
            primary_landing_url: row.get(14)?,
            pdf_url: row.get(15)?,
            has_file: row.get::<_, i32>(16)? == 1,
            local_pdf_path: row.get(17)?,
            content_hash: row.get(18)?,
            metadata_confidence: row.get(19)?,
            is_saved: row.get::<_, i32>(20)? == 1,
            reading_status,
            reading_progress,
            created_at,
            updated_at,
            open_access_status,
            access_evidence_type,
            access_evidence_note,
            license_name,
            license_url,
            source_name,
            retrieval_method,
            access_confirmed_at,
            authors,
            collection_ids,
            tags,
            source_names,
        })
    }

    /// Queries SQLite directly for live Open Access library statistics
    pub fn get_open_access_stats(
        conn: &Connection,
    ) -> Result<crate::domain::ieee::OpenAccessStats> {
        let total_oa_papers: i64 = conn.query_row(
            "SELECT COUNT(*) FROM papers WHERE is_open_access = 1 OR open_access_status IN ('verified_open_access', 'user_confirmed_open_access')",
            [],
            |r| r.get(0),
        )?;

        let ieee_imported_papers: i64 = conn.query_row(
            "SELECT COUNT(*) FROM papers WHERE retrieval_method = 'ieee_manual_download_import'",
            [],
            |r| r.get(0),
        )?;

        let permitted_downloads: i64 = conn.query_row(
            "SELECT COUNT(*) FROM papers WHERE retrieval_method = 'permitted_html_connector' AND has_file = 1",
            [],
            |r| r.get(0),
        )?;

        let pending_verification_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM papers WHERE open_access_status = 'pending_verification'",
            [],
            |r| r.get(0),
        )?;

        let missing_or_corrupt_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM papers WHERE has_file = 1 AND (local_pdf_path IS NULL OR trim(local_pdf_path) = '')",
            [],
            |r| r.get(0),
        )?;

        Ok(crate::domain::ieee::OpenAccessStats {
            total_oa_papers,
            ieee_imported_papers,
            permitted_downloads,
            pending_verification_count,
            missing_or_corrupt_count,
        })
    }
}
