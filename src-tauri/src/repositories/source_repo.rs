use rusqlite::{params, Connection, Result};
use crate::domain::source::Source;

pub struct SourceRepository;

impl SourceRepository {
    pub fn list(conn: &Connection) -> Result<Vec<Source>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, source_type, tier, base_url, policy_url, notes,
                    is_enabled, rate_limit_rps, concurrency_limit, created_at, updated_at
             FROM sources
             ORDER BY name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Source {
                id: row.get(0)?,
                name: row.get(1)?,
                source_type: row.get(2)?,
                tier: row.get(3)?,
                base_url: row.get(4)?,
                policy_url: row.get(5)?,
                notes: row.get(6)?,
                is_enabled: row.get::<_, i32>(7)? == 1,
                rate_limit_rps: row.get(8)?,
                concurrency_limit: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut sources = Vec::new();
        for r in rows {
            sources.push(r?);
        }
        Ok(sources)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Source>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, source_type, tier, base_url, policy_url, notes,
                    is_enabled, rate_limit_rps, concurrency_limit, created_at, updated_at
             FROM sources
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Source {
                id: row.get(0)?,
                name: row.get(1)?,
                source_type: row.get(2)?,
                tier: row.get(3)?,
                base_url: row.get(4)?,
                policy_url: row.get(5)?,
                notes: row.get(6)?,
                is_enabled: row.get::<_, i32>(7)? == 1,
                rate_limit_rps: row.get(8)?,
                concurrency_limit: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            }))
        } else {
            Ok(None)
        }
    }
}
