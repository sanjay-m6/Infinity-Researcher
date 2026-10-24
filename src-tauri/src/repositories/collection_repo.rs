use rusqlite::{params, Connection, Result};
use crate::domain::collection::Collection;

pub struct CollectionRepository;

impl CollectionRepository {
    pub fn create(conn: &Connection, col: &Collection) -> Result<()> {
        conn.execute(
            "INSERT INTO collections (id, parent_id, name, description, color_hex, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                col.id,
                col.parent_id,
                col.name,
                col.description,
                col.color_hex,
                col.created_at,
                col.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Collection>> {
        let mut stmt = conn.prepare(
            "SELECT c.id, c.parent_id, c.name, c.description, c.color_hex,
                    (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
                    c.created_at, c.updated_at
             FROM collections c
             WHERE c.id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Collection {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                color_hex: row.get(4)?,
                paper_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_by_name(conn: &Connection, name: &str) -> Result<Option<Collection>> {
        let mut stmt = conn.prepare(
            "SELECT c.id, c.parent_id, c.name, c.description, c.color_hex,
                    (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
                    c.created_at, c.updated_at
             FROM collections c
             WHERE lower(c.name) = lower(?1)",
        )?;

        let mut rows = stmt.query(params![name.trim()])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Collection {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                color_hex: row.get(4)?,
                paper_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list(conn: &Connection) -> Result<Vec<Collection>> {
        let mut stmt = conn.prepare(
            "SELECT c.id, c.parent_id, c.name, c.description, c.color_hex,
                    (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
                    c.created_at, c.updated_at
             FROM collections c
             ORDER BY c.created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                color_hex: row.get(4)?,
                paper_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut collections = Vec::new();
        for r in rows {
            collections.push(r?);
        }
        Ok(collections)
    }

    pub fn update(
        conn: &Connection,
        id: &str,
        name: &str,
        description: Option<&str>,
        color_hex: &str,
    ) -> Result<bool> {
        let rows = conn.execute(
            "UPDATE collections
             SET name = ?1, description = ?2, color_hex = ?3, updated_at = datetime('now')
             WHERE id = ?4",
            params![name, description, color_hex, id],
        )?;
        Ok(rows > 0)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<bool> {
        // Cascade removes entries from collection_papers, but leaves papers intact!
        let rows = conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }

    pub fn add_paper(conn: &Connection, collection_id: &str, paper_id: &str) -> Result<()> {
        conn.execute(
            "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at, sort_order)
             VALUES (?1, ?2, datetime('now'), 0)",
            params![collection_id, paper_id],
        )?;
        Ok(())
    }

    pub fn remove_paper(conn: &Connection, collection_id: &str, paper_id: &str) -> Result<bool> {
        let rows = conn.execute(
            "DELETE FROM collection_papers WHERE collection_id = ?1 AND paper_id = ?2",
            params![collection_id, paper_id],
        )?;
        Ok(rows > 0)
    }

    pub fn get_collections_for_paper(conn: &Connection, paper_id: &str) -> Result<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT collection_id FROM collection_papers WHERE paper_id = ?1",
        )?;
        let rows = stmt.query_map(params![paper_id], |row| row.get(0))?;
        let mut ids = Vec::new();
        for r in rows {
            ids.push(r?);
        }
        Ok(ids)
    }
}
