use rusqlite::{params, Connection, Result};
use crate::domain::tag::Tag;

pub struct TagRepository;

impl TagRepository {
    pub fn create_or_get(conn: &Connection, name: &str, color_hex: &str) -> Result<Tag> {
        let trimmed = name.trim();
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, color_hex, created_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
            params![uuid::Uuid::new_v4().to_string(), trimmed, color_hex],
        )?;

        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color_hex,
                    (SELECT COUNT(*) FROM paper_tags pt WHERE pt.tag_id = t.id) as paper_count,
                    t.created_at
             FROM tags t
             WHERE lower(t.name) = lower(?1)",
        )?;

        stmt.query_row(params![trimmed], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color_hex: row.get(2)?,
                paper_count: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
    }

    pub fn list(conn: &Connection) -> Result<Vec<Tag>> {
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color_hex,
                    (SELECT COUNT(*) FROM paper_tags pt WHERE pt.tag_id = t.id) as paper_count,
                    t.created_at
             FROM tags t
             ORDER BY t.name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color_hex: row.get(2)?,
                paper_count: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut tags = Vec::new();
        for r in rows {
            tags.push(r?);
        }
        Ok(tags)
    }

    pub fn assign_tag(conn: &Connection, paper_id: &str, tag_id: &str) -> Result<()> {
        conn.execute(
            "INSERT OR IGNORE INTO paper_tags (paper_id, tag_id, tagged_at)
             VALUES (?1, ?2, datetime('now'))",
            params![paper_id, tag_id],
        )?;
        Ok(())
    }

    pub fn remove_tag(conn: &Connection, paper_id: &str, tag_id: &str) -> Result<bool> {
        let rows = conn.execute(
            "DELETE FROM paper_tags WHERE paper_id = ?1 AND tag_id = ?2",
            params![paper_id, tag_id],
        )?;
        Ok(rows > 0)
    }

    pub fn get_tags_for_paper(conn: &Connection, paper_id: &str) -> Result<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT t.name FROM tags t
             JOIN paper_tags pt ON pt.tag_id = t.id
             WHERE pt.paper_id = ?1
             ORDER BY t.name ASC",
        )?;
        let rows = stmt.query_map(params![paper_id], |row| row.get(0))?;
        let mut names = Vec::new();
        for r in rows {
            names.push(r?);
        }
        Ok(names)
    }
}
