use crate::domain::saved_search::{
    SavedSearch, SavedSearchCreateInput, SavedSearchUpdateInput,
};
use rusqlite::{params, Connection, Result};

pub struct SavedSearchRepository;

impl SavedSearchRepository {
    pub fn list(conn: &Connection) -> Result<Vec<SavedSearch>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, raw_query, structured_query_json, selected_sources_json, filters_json,
                    sort_by, last_used_at, created_at, updated_at
             FROM saved_searches
             ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(SavedSearch {
                id: row.get(0)?,
                name: row.get(1)?,
                raw_query: row.get(2)?,
                structured_query_json: row.get(3)?,
                selected_sources_json: row.get(4)?,
                filters_json: row.get(5)?,
                sort_by: row.get(6)?,
                last_used_at: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<SavedSearch>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, raw_query, structured_query_json, selected_sources_json, filters_json,
                    sort_by, last_used_at, created_at, updated_at
             FROM saved_searches
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SavedSearch {
                id: row.get(0)?,
                name: row.get(1)?,
                raw_query: row.get(2)?,
                structured_query_json: row.get(3)?,
                selected_sources_json: row.get(4)?,
                filters_json: row.get(5)?,
                sort_by: row.get(6)?,
                last_used_at: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn create(conn: &Connection, input: SavedSearchCreateInput) -> Result<SavedSearch> {
        let id = format!("ss_{}", uuid::Uuid::new_v4());
        let sort_by = input.sort_by.unwrap_or_else(|| "relevance".to_string());

        conn.execute(
            "INSERT INTO saved_searches (
                id, name, raw_query, structured_query_json, selected_sources_json, filters_json,
                sort_by, last_used_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, datetime('now'), datetime('now'))",
            params![
                id,
                input.name,
                input.raw_query,
                input.structured_query_json,
                input.selected_sources_json,
                input.filters_json,
                sort_by,
            ],
        )?;

        Self::get_by_id(conn, &id).and_then(|opt| {
            opt.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
        })
    }

    pub fn update(conn: &Connection, input: SavedSearchUpdateInput) -> Result<bool> {
        let current = match Self::get_by_id(conn, &input.id)? {
            Some(s) => s,
            None => return Ok(false),
        };

        let name = input.name.unwrap_or(current.name);
        let raw_query = input.raw_query.unwrap_or(current.raw_query);
        let structured_query_json = input
            .structured_query_json
            .or(current.structured_query_json);
        let selected_sources_json = input
            .selected_sources_json
            .or(current.selected_sources_json);
        let filters_json = input.filters_json.or(current.filters_json);
        let sort_by = input.sort_by.unwrap_or(current.sort_by);

        let rows = conn.execute(
            "UPDATE saved_searches
             SET name = ?1,
                 raw_query = ?2,
                 structured_query_json = ?3,
                 selected_sources_json = ?4,
                 filters_json = ?5,
                 sort_by = ?6,
                 updated_at = datetime('now')
             WHERE id = ?7",
            params![
                name,
                raw_query,
                structured_query_json,
                selected_sources_json,
                filters_json,
                sort_by,
                input.id,
            ],
        )?;

        Ok(rows > 0)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<bool> {
        let rows = conn.execute("DELETE FROM saved_searches WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }

    pub fn touch(conn: &Connection, id: &str) -> Result<bool> {
        let rows = conn.execute(
            "UPDATE saved_searches
             SET last_used_at = datetime('now'),
                 updated_at = datetime('now')
             WHERE id = ?1",
            params![id],
        )?;
        Ok(rows > 0)
    }
}

