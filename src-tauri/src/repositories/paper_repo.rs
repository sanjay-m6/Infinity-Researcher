use rusqlite::{params, Connection, Result};
use crate::domain::pagination::PagedResponse;
use crate::domain::paper::{Author, Paper, PaperListQuery};

pub struct PaperRepository;

impl PaperRepository {
    /// Inserts a canonical paper record along with its authors, collections, and tags in an atomic transaction.
    pub fn create(conn: &mut Connection, paper: &Paper) -> Result<()> {
        let tx = conn.transaction()?;

        tx.execute(
            "INSERT INTO papers (
                id, canonical_doi, title, clean_title_key, abstract, publication_date,
                publication_year, venue, venue_type, language, citation_count, reference_count,
                is_open_access, license, primary_landing_url, pdf_url, has_file,
                local_pdf_path, content_hash, metadata_confidence, is_saved, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)",
            params![
                paper.id,
                paper.canonical_doi,
                paper.title,
                paper.clean_title_key,
                paper.abstract_text,
                paper.publication_date,
                paper.publication_year,
                paper.venue,
                paper.venue_type,
                paper.language,
                paper.citation_count,
                paper.reference_count,
                if paper.is_open_access { 1 } else { 0 },
                paper.license,
                paper.primary_landing_url,
                paper.pdf_url,
                if paper.has_file { 1 } else { 0 },
                paper.local_pdf_path,
                paper.content_hash,
                paper.metadata_confidence,
                if paper.is_saved { 1 } else { 0 },
                paper.created_at,
                paper.updated_at,
            ],
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
                updated_at = datetime('now')
             WHERE id = ?12",
            params![
                paper.canonical_doi,
                paper.title,
                paper.clean_title_key,
                paper.abstract_text,
                paper.publication_date,
                paper.publication_year,
                paper.venue,
                if paper.is_open_access { 1 } else { 0 },
                paper.primary_landing_url,
                paper.pdf_url,
                if paper.is_saved { 1 } else { 0 },
                paper.id,
            ],
        )?;

        // Refresh authors
        tx.execute("DELETE FROM paper_authors WHERE paper_id = ?1", params![paper.id])?;
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
        tx.execute("DELETE FROM collection_papers WHERE paper_id = ?1", params![paper.id])?;
        for col_id in &paper.collection_ids {
            tx.execute(
                "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at)
                 VALUES (?1, ?2, datetime('now'))",
                params![col_id, paper.id],
            )?;
        }

        // Refresh tags
        tx.execute("DELETE FROM paper_tags WHERE paper_id = ?1", params![paper.id])?;
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
        tx.execute("DELETE FROM papers_fts WHERE paper_id = ?1", params![paper.id])?;
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
        let mut stmt = conn.prepare(
            "SELECT id, canonical_doi, title, clean_title_key, abstract, publication_date,
                    publication_year, venue, venue_type, language, citation_count, reference_count,
                    is_open_access, license, primary_landing_url, pdf_url, has_file,
                    local_pdf_path, content_hash, metadata_confidence, is_saved, created_at, updated_at
             FROM papers
             WHERE id = ?1",
        )?;

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
        let mut stmt = conn.prepare(
            "SELECT id, canonical_doi, title, clean_title_key, abstract, publication_date,
                    publication_year, venue, venue_type, language, citation_count, reference_count,
                    is_open_access, license, primary_landing_url, pdf_url, has_file,
                    local_pdf_path, content_hash, metadata_confidence, is_saved, created_at, updated_at
             FROM papers
             WHERE lower(canonical_doi) = lower(?1)",
        )?;

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
        let mut stmt = conn.prepare(
            "SELECT id, canonical_doi, title, clean_title_key, abstract, publication_date,
                    publication_year, venue, venue_type, language, citation_count, reference_count,
                    is_open_access, license, primary_landing_url, pdf_url, has_file,
                    local_pdf_path, content_hash, metadata_confidence, is_saved, created_at, updated_at
             FROM papers
             WHERE clean_title_key = ?1",
        )?;

        let mut rows = stmt.query(params![clean_title])?;
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
        let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
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

        // Source filter
        if let Some(ref src_id) = q.source_id {
            if src_id != "all" && !src_id.is_empty() {
                conditions.push("EXISTS (SELECT 1 FROM paper_sources ps WHERE ps.paper_id = p.id AND ps.source_id = ?)".to_string());
                sql_params.push(src_id.clone().into());
            }
        }

        // FTS / Keyword query
        if let Some(ref search_text) = q.query {
            let trimmed = search_text.trim();
            if !trimmed.is_empty() {
                // Use FTS table or fallback LIKE if punctuation causes syntax issues
                let fts_query = trimmed
                    .split_whitespace()
                    .map(|w| format!("\"{}\"*", w.replace('"', "")))
                    .collect::<Vec<_>>()
                    .join(" AND ");

                conditions.push(
                    "(p.id IN (SELECT paper_id FROM papers_fts WHERE papers_fts MATCH ?)
                      OR p.title LIKE ?
                      OR p.abstract LIKE ?)"
                        .to_string(),
                );
                sql_params.push(fts_query.into());
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
        let count_params_refs: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        let total_count: i64 = count_stmt.query_row(count_params_refs.as_slice(), |row| row.get(0))?;

        // Sort order
        let order_clause = match q.sort_by.as_deref() {
            Some("oldest") => "ORDER BY p.publication_year ASC, p.created_at ASC",
            Some("citations") => "ORDER BY p.citation_count DESC, p.created_at DESC",
            Some("title") => "ORDER BY p.title ASC",
            _ => "ORDER BY p.publication_year DESC, p.created_at DESC", // default newest
        };

        // Select query
        let select_sql = format!(
            "SELECT p.id, p.canonical_doi, p.title, p.clean_title_key, p.abstract, p.publication_date,
                    p.publication_year, p.venue, p.venue_type, p.language, p.citation_count, p.reference_count,
                    p.is_open_access, p.license, p.primary_landing_url, p.pdf_url, p.has_file,
                    p.local_pdf_path, p.content_hash, p.metadata_confidence, p.is_saved, p.created_at, p.updated_at
             FROM papers p
             {}
             {}
             LIMIT ? OFFSET ?",
            where_clause, order_clause
        );

        let mut select_stmt = conn.prepare(&select_sql)?;
        let mut full_params = sql_params;
        full_params.push((page_size as i64).into());
        full_params.push((offset as i64).into());

        let full_params_refs: Vec<&dyn rusqlite::ToSql> = full_params.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        let rows = select_stmt.query_map(full_params_refs.as_slice(), |row| {
            Self::hydrate_paper_from_row(conn, row)
        })?;

        let mut papers = Vec::new();
        for r in rows {
            papers.push(r?);
        }

        Ok(PagedResponse::new(papers, total_count, page, page_size))
    }

    /// Deletes paper and cascades cleanly to paper_authors, collection_papers, and papers_fts.
    pub fn delete(conn: &mut Connection, id: &str) -> Result<bool> {
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM papers_fts WHERE paper_id = ?1", params![id])?;
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
        let mut col_stmt = conn.prepare("SELECT collection_id FROM collection_papers WHERE paper_id = ?1")?;
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
            language: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "en".to_string()),
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
            created_at: row.get(21)?,
            updated_at: row.get(22)?,
            authors,
            collection_ids,
            tags,
            source_names,
        })
    }
}
