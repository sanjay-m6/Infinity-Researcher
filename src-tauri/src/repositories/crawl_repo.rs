use crate::domain::crawl::{
    CrawlJob, CrawlJobPaper, CrawlJobStatus, CrawlProfile, CrawlProfileCreateInput,
    CrawlProfileUpdateInput, CrawlQueueItem, CrawlQueueItemStatus,
};
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CrawledPaperInput<'a> {
    pub job_id: &'a str,
    pub url: &'a str,
    pub title: &'a str,
    pub canonical_doi: Option<&'a str>,
    pub authors: &'a [String],
    pub abstract_text: Option<&'a str>,
    pub publication_date: Option<&'a str>,
    pub venue: Option<&'a str>,
    pub pdf_url: Option<&'a str>,
}

pub struct CrawlRepository;

impl CrawlRepository {
    // ------------------------------------------------------------------------
    // Profiles
    // ------------------------------------------------------------------------

    pub fn list_profiles(conn: &Connection) -> Result<Vec<CrawlProfile>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, domain, description, allowed_patterns, disallowed_patterns,
                    paper_link_selectors, title_selector, authors_selector, abstract_selector,
                    doi_selector, date_selector, venue_selector, pdf_link_selector,
                    use_meta_tags, request_delay_ms, max_depth, max_pages, headers,
                    is_built_in, created_at, updated_at
             FROM crawl_profiles
             ORDER BY is_built_in DESC, name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let allowed_json: String = row.get(4)?;
            let disallowed_json: String = row.get(5)?;
            let selectors_json: String = row.get(6)?;
            let headers_json: Option<String> = row.get(18)?;

            let allowed_patterns = serde_json::from_str(&allowed_json).unwrap_or_default();
            let disallowed_patterns = serde_json::from_str(&disallowed_json).unwrap_or_default();
            let paper_link_selectors = serde_json::from_str(&selectors_json).unwrap_or_default();
            let headers = headers_json.and_then(|h| serde_json::from_str(&h).ok());

            Ok(CrawlProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                domain: row.get(2)?,
                description: row.get(3)?,
                allowed_patterns,
                disallowed_patterns,
                paper_link_selectors,
                title_selector: row.get(7)?,
                authors_selector: row.get(8)?,
                abstract_selector: row.get(9)?,
                doi_selector: row.get(10)?,
                date_selector: row.get(11)?,
                venue_selector: row.get(12)?,
                pdf_link_selector: row.get(13)?,
                use_meta_tags: row.get::<_, i32>(14)? == 1,
                request_delay_ms: row.get(15)?,
                max_depth: row.get(16)?,
                max_pages: row.get(17)?,
                headers,
                is_built_in: row.get::<_, i32>(19)? == 1,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_profile_by_id(conn: &Connection, id: &str) -> Result<Option<CrawlProfile>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, domain, description, allowed_patterns, disallowed_patterns,
                    paper_link_selectors, title_selector, authors_selector, abstract_selector,
                    doi_selector, date_selector, venue_selector, pdf_link_selector,
                    use_meta_tags, request_delay_ms, max_depth, max_pages, headers,
                    is_built_in, created_at, updated_at
             FROM crawl_profiles
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let allowed_json: String = row.get(4)?;
            let disallowed_json: String = row.get(5)?;
            let selectors_json: String = row.get(6)?;
            let headers_json: Option<String> = row.get(18)?;

            let allowed_patterns = serde_json::from_str(&allowed_json).unwrap_or_default();
            let disallowed_patterns = serde_json::from_str(&disallowed_json).unwrap_or_default();
            let paper_link_selectors = serde_json::from_str(&selectors_json).unwrap_or_default();
            let headers = headers_json.and_then(|h| serde_json::from_str(&h).ok());

            Ok(Some(CrawlProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                domain: row.get(2)?,
                description: row.get(3)?,
                allowed_patterns,
                disallowed_patterns,
                paper_link_selectors,
                title_selector: row.get(7)?,
                authors_selector: row.get(8)?,
                abstract_selector: row.get(9)?,
                doi_selector: row.get(10)?,
                date_selector: row.get(11)?,
                venue_selector: row.get(12)?,
                pdf_link_selector: row.get(13)?,
                use_meta_tags: row.get::<_, i32>(14)? == 1,
                request_delay_ms: row.get(15)?,
                max_depth: row.get(16)?,
                max_pages: row.get(17)?,
                headers,
                is_built_in: row.get::<_, i32>(19)? == 1,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_profile_for_url(conn: &Connection, url_str: &str) -> Result<Option<CrawlProfile>> {
        let domain = match url::Url::parse(url_str) {
            Ok(parsed) => parsed.host_str().unwrap_or("").to_lowercase(),
            Err(_) => return Ok(None),
        };

        let profiles = Self::list_profiles(conn)?;
        // Find best match: exact domain or suffix match
        for profile in &profiles {
            if profile.domain == domain || domain.ends_with(&format!(".{}", profile.domain)) {
                return Ok(Some(profile.clone()));
            }
        }

        // Fallback to "generic" profile if present
        for profile in profiles {
            if profile.id == "generic" {
                return Ok(Some(profile));
            }
        }

        Ok(None)
    }

    pub fn create_profile(
        conn: &Connection,
        input: &CrawlProfileCreateInput,
    ) -> Result<CrawlProfile> {
        let id = input
            .id
            .clone()
            .unwrap_or_else(|| format!("custom_{}", Uuid::new_v4().simple()));

        let allowed_json =
            serde_json::to_string(&input.allowed_patterns.clone().unwrap_or_default())
                .unwrap_or_else(|_| "[]".to_string());
        let disallowed_json =
            serde_json::to_string(&input.disallowed_patterns.clone().unwrap_or_default())
                .unwrap_or_else(|_| "[]".to_string());
        let selectors_json =
            serde_json::to_string(&input.paper_link_selectors.clone().unwrap_or_default())
                .unwrap_or_else(|_| "[]".to_string());
        let headers_json = input
            .headers
            .as_ref()
            .map(|h| serde_json::to_string(h).unwrap_or_default());

        conn.execute(
            "INSERT INTO crawl_profiles (
                id, name, domain, description, allowed_patterns, disallowed_patterns,
                paper_link_selectors, title_selector, authors_selector, abstract_selector,
                doi_selector, date_selector, venue_selector, pdf_link_selector,
                use_meta_tags, request_delay_ms, max_depth, max_pages, headers,
                is_built_in, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18, ?19, 0, datetime('now'), datetime('now')
            )",
            params![
                id,
                input.name,
                input.domain,
                input.description,
                allowed_json,
                disallowed_json,
                selectors_json,
                input.title_selector,
                input.authors_selector,
                input.abstract_selector,
                input.doi_selector,
                input.date_selector,
                input.venue_selector,
                input.pdf_link_selector,
                input.use_meta_tags.unwrap_or(true) as i32,
                input.request_delay_ms.unwrap_or(1000),
                input.max_depth.unwrap_or(2),
                input.max_pages.unwrap_or(50),
                headers_json,
            ],
        )?;

        Self::get_profile_by_id(conn, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn update_profile(
        conn: &Connection,
        id: &str,
        input: &CrawlProfileUpdateInput,
    ) -> Result<Option<CrawlProfile>> {
        let existing = match Self::get_profile_by_id(conn, id)? {
            Some(p) => p,
            None => return Ok(None),
        };

        let name = input.name.clone().unwrap_or(existing.name);
        let domain = input.domain.clone().unwrap_or(existing.domain);
        let description = input.description.clone().or(existing.description);

        let allowed_json = input
            .allowed_patterns
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default())
            .unwrap_or_else(|| {
                serde_json::to_string(&existing.allowed_patterns).unwrap_or_default()
            });

        let disallowed_json = input
            .disallowed_patterns
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default())
            .unwrap_or_else(|| {
                serde_json::to_string(&existing.disallowed_patterns).unwrap_or_default()
            });

        let selectors_json = input
            .paper_link_selectors
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default())
            .unwrap_or_else(|| {
                serde_json::to_string(&existing.paper_link_selectors).unwrap_or_default()
            });

        let title_selector = input.title_selector.clone().or(existing.title_selector);
        let authors_selector = input.authors_selector.clone().or(existing.authors_selector);
        let abstract_selector = input
            .abstract_selector
            .clone()
            .or(existing.abstract_selector);
        let doi_selector = input.doi_selector.clone().or(existing.doi_selector);
        let date_selector = input.date_selector.clone().or(existing.date_selector);
        let venue_selector = input.venue_selector.clone().or(existing.venue_selector);
        let pdf_link_selector = input
            .pdf_link_selector
            .clone()
            .or(existing.pdf_link_selector);

        let use_meta_tags = input.use_meta_tags.unwrap_or(existing.use_meta_tags) as i32;
        let request_delay_ms = input.request_delay_ms.unwrap_or(existing.request_delay_ms);
        let max_depth = input.max_depth.unwrap_or(existing.max_depth);
        let max_pages = input.max_pages.unwrap_or(existing.max_pages);

        let headers_json = input
            .headers
            .as_ref()
            .map(|h| serde_json::to_string(h).unwrap_or_default())
            .or_else(|| {
                existing
                    .headers
                    .as_ref()
                    .map(|h| serde_json::to_string(h).unwrap_or_default())
            });

        conn.execute(
            "UPDATE crawl_profiles SET
                name = ?1, domain = ?2, description = ?3, allowed_patterns = ?4,
                disallowed_patterns = ?5, paper_link_selectors = ?6, title_selector = ?7,
                authors_selector = ?8, abstract_selector = ?9, doi_selector = ?10,
                date_selector = ?11, venue_selector = ?12, pdf_link_selector = ?13,
                use_meta_tags = ?14, request_delay_ms = ?15, max_depth = ?16,
                max_pages = ?17, headers = ?18, updated_at = datetime('now')
             WHERE id = ?19",
            params![
                name,
                domain,
                description,
                allowed_json,
                disallowed_json,
                selectors_json,
                title_selector,
                authors_selector,
                abstract_selector,
                doi_selector,
                date_selector,
                venue_selector,
                pdf_link_selector,
                use_meta_tags,
                request_delay_ms,
                max_depth,
                max_pages,
                headers_json,
                id,
            ],
        )?;

        Self::get_profile_by_id(conn, id)
    }

    pub fn delete_profile(conn: &Connection, id: &str) -> Result<bool> {
        let rows_affected = conn.execute(
            "DELETE FROM crawl_profiles WHERE id = ?1 AND is_built_in = 0",
            params![id],
        )?;
        Ok(rows_affected > 0)
    }

    // ------------------------------------------------------------------------
    // Jobs
    // ------------------------------------------------------------------------

    pub fn create_job(conn: &Connection, profile_id: &str, start_url: &str) -> Result<CrawlJob> {
        let id = format!("job_{}", Uuid::new_v4().simple());
        conn.execute(
            "INSERT INTO crawl_jobs (
                id, profile_id, start_url, status, pages_queued, pages_visited,
                pages_failed, papers_found, current_depth, started_at, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, 'pending', 1, 0, 0, 0, 0, datetime('now'), datetime('now'), datetime('now')
            )",
            params![id, profile_id, start_url],
        )?;

        // Enqueue start URL
        let queue_id = format!("q_{}", Uuid::new_v4().simple());
        conn.execute(
            "INSERT INTO crawl_queue (
                id, job_id, url, depth, status, retry_count, discovered_at
            ) VALUES (
                ?1, ?2, ?3, 0, 'pending', 0, datetime('now')
            )",
            params![queue_id, id, start_url],
        )?;

        Self::get_job(conn, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_job(conn: &Connection, id: &str) -> Result<Option<CrawlJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, profile_id, start_url, status, pages_queued, pages_visited,
                    pages_failed, papers_found, current_depth, error_message,
                    started_at, completed_at, created_at, updated_at
             FROM crawl_jobs
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let status_str: String = row.get(3)?;
            let status = CrawlJobStatus::from_str(&status_str).unwrap_or(CrawlJobStatus::Failed);

            Ok(Some(CrawlJob {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                start_url: row.get(2)?,
                status,
                pages_queued: row.get(4)?,
                pages_visited: row.get(5)?,
                pages_failed: row.get(6)?,
                papers_found: row.get(7)?,
                current_depth: row.get(8)?,
                error_message: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_jobs(conn: &Connection, limit: Option<i64>) -> Result<Vec<CrawlJob>> {
        let limit_val = limit.unwrap_or(50);
        let mut stmt = conn.prepare(
            "SELECT id, profile_id, start_url, status, pages_queued, pages_visited,
                    pages_failed, papers_found, current_depth, error_message,
                    started_at, completed_at, created_at, updated_at
             FROM crawl_jobs
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit_val], |row| {
            let status_str: String = row.get(3)?;
            let status = CrawlJobStatus::from_str(&status_str).unwrap_or(CrawlJobStatus::Failed);

            Ok(CrawlJob {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                start_url: row.get(2)?,
                status,
                pages_queued: row.get(4)?,
                pages_visited: row.get(5)?,
                pages_failed: row.get(6)?,
                papers_found: row.get(7)?,
                current_depth: row.get(8)?,
                error_message: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
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

    pub fn update_job_status(
        conn: &Connection,
        id: &str,
        status: CrawlJobStatus,
        error: Option<&str>,
    ) -> Result<()> {
        let status_str = status.to_string();
        let completed_at = match status {
            CrawlJobStatus::Completed | CrawlJobStatus::Failed | CrawlJobStatus::Cancelled => {
                Some("datetime('now')")
            }
            _ => None,
        };

        if let Some(comp) = completed_at {
            conn.execute(
                &format!(
                    "UPDATE crawl_jobs SET status = ?1, error_message = ?2, completed_at = {}, updated_at = datetime('now') WHERE id = ?3",
                    comp
                ),
                params![status_str, error, id],
            )?;
        } else {
            conn.execute(
                "UPDATE crawl_jobs SET status = ?1, error_message = ?2, updated_at = datetime('now') WHERE id = ?3",
                params![status_str, error, id],
            )?;
        }

        Ok(())
    }

    pub fn increment_job_counters(
        conn: &Connection,
        id: &str,
        pages_visited_delta: i64,
        pages_failed_delta: i64,
        papers_found_delta: i64,
    ) -> Result<()> {
        conn.execute(
            "UPDATE crawl_jobs SET
                pages_visited = pages_visited + ?1,
                pages_failed = pages_failed + ?2,
                papers_found = papers_found + ?3,
                updated_at = datetime('now')
             WHERE id = ?4",
            params![
                pages_visited_delta,
                pages_failed_delta,
                papers_found_delta,
                id
            ],
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Queue
    // ------------------------------------------------------------------------

    pub fn enqueue_url(conn: &Connection, job_id: &str, url_str: &str, depth: i32) -> Result<bool> {
        let queue_id = format!("q_{}", Uuid::new_v4().simple());
        let res = conn.execute(
            "INSERT OR IGNORE INTO crawl_queue (
                id, job_id, url, depth, status, retry_count, discovered_at
            ) VALUES (
                ?1, ?2, ?3, ?4, 'pending', 0, datetime('now')
            )",
            params![queue_id, job_id, url_str, depth],
        )?;

        if res > 0 {
            // Also increment job pages_queued count
            conn.execute(
                "UPDATE crawl_jobs SET pages_queued = pages_queued + 1, updated_at = datetime('now') WHERE id = ?1",
                params![job_id],
            )?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn get_next_queue_item(conn: &Connection, job_id: &str) -> Result<Option<CrawlQueueItem>> {
        let mut stmt = conn.prepare(
            "SELECT id, job_id, url, depth, status, retry_count, http_status,
                    error_message, discovered_at, processed_at
             FROM crawl_queue
             WHERE job_id = ?1 AND status = 'pending'
             ORDER BY depth ASC, discovered_at ASC
             LIMIT 1",
        )?;

        let mut rows = stmt.query(params![job_id])?;
        if let Some(row) = rows.next()? {
            let status_str: String = row.get(4)?;
            let status =
                CrawlQueueItemStatus::from_str(&status_str).unwrap_or(CrawlQueueItemStatus::Failed);

            Ok(Some(CrawlQueueItem {
                id: row.get(0)?,
                job_id: row.get(1)?,
                url: row.get(2)?,
                depth: row.get(3)?,
                status,
                retry_count: row.get(5)?,
                http_status: row.get(6)?,
                error_message: row.get(7)?,
                discovered_at: row.get(8)?,
                processed_at: row.get(9)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_queue_item_status(
        conn: &Connection,
        id: &str,
        status: CrawlQueueItemStatus,
        http_status: Option<i32>,
        error_message: Option<&str>,
    ) -> Result<()> {
        let status_str = status.to_string();
        conn.execute(
            "UPDATE crawl_queue SET
                status = ?1, http_status = ?2, error_message = ?3, processed_at = datetime('now')
             WHERE id = ?4",
            params![status_str, http_status, error_message, id],
        )?;
        Ok(())
    }

    pub fn count_queue_by_status(conn: &Connection, job_id: &str) -> Result<HashMap<String, i64>> {
        let mut stmt = conn.prepare(
            "SELECT status, COUNT(*) FROM crawl_queue WHERE job_id = ?1 GROUP BY status",
        )?;
        let rows = stmt.query_map(params![job_id], |row| {
            let status: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            Ok((status, count))
        })?;

        let mut map = HashMap::new();
        for r in rows {
            let (status, count) = r?;
            map.insert(status, count);
        }
        Ok(map)
    }

    // ------------------------------------------------------------------------
    // Crawled Papers
    // ------------------------------------------------------------------------

    pub fn save_crawled_paper(
        conn: &Connection,
        input: CrawledPaperInput<'_>,
    ) -> Result<CrawlJobPaper> {
        let id = format!("cp_{}", Uuid::new_v4().simple());
        let authors_json =
            serde_json::to_string(input.authors).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT OR REPLACE INTO crawl_job_papers (
                id, job_id, url, title, canonical_doi, authors, abstract_text,
                publication_date, venue, pdf_url, is_imported, discovered_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, datetime('now')
            )",
            params![
                id,
                input.job_id,
                input.url,
                input.title,
                input.canonical_doi,
                authors_json,
                input.abstract_text,
                input.publication_date,
                input.venue,
                input.pdf_url,
            ],
        )?;

        // Return the saved crawled paper
        Ok(CrawlJobPaper {
            id,
            job_id: input.job_id.to_string(),
            paper_id: None,
            url: input.url.to_string(),
            title: input.title.to_string(),
            canonical_doi: input.canonical_doi.map(|s| s.to_string()),
            authors: input.authors.to_vec(),
            abstract_text: input.abstract_text.map(|s| s.to_string()),
            publication_date: input.publication_date.map(|s| s.to_string()),
            venue: input.venue.map(|s| s.to_string()),
            pdf_url: input.pdf_url.map(|s| s.to_string()),
            is_imported: false,
            discovered_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    pub fn list_crawled_papers_for_job(
        conn: &Connection,
        job_id: &str,
    ) -> Result<Vec<CrawlJobPaper>> {
        let mut stmt = conn.prepare(
            "SELECT id, job_id, paper_id, url, title, canonical_doi, authors,
                    abstract_text, publication_date, venue, pdf_url, is_imported, discovered_at
             FROM crawl_job_papers
             WHERE job_id = ?1
             ORDER BY discovered_at DESC",
        )?;

        let rows = stmt.query_map(params![job_id], |row| {
            let authors_json: String = row.get(6)?;
            let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();

            Ok(CrawlJobPaper {
                id: row.get(0)?,
                job_id: row.get(1)?,
                paper_id: row.get(2)?,
                url: row.get(3)?,
                title: row.get(4)?,
                canonical_doi: row.get(5)?,
                authors,
                abstract_text: row.get(7)?,
                publication_date: row.get(8)?,
                venue: row.get(9)?,
                pdf_url: row.get(10)?,
                is_imported: row.get::<_, i32>(11)? == 1,
                discovered_at: row.get(12)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn mark_crawled_paper_imported(conn: &Connection, id: &str, paper_id: &str) -> Result<()> {
        conn.execute(
            "UPDATE crawl_job_papers SET is_imported = 1, paper_id = ?1 WHERE id = ?2",
            params![paper_id, id],
        )?;
        Ok(())
    }
}
