use crate::domain::note::Note;
use rusqlite::{params, Connection, Result};

pub struct NoteRepository;

impl NoteRepository {
    pub fn get_by_paper_id(conn: &Connection, paper_id: &str) -> Result<Vec<Note>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, title, content_markdown, page_number, highlighted_text, created_at, updated_at
             FROM notes
             WHERE paper_id = ?1
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map(params![paper_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                title: row.get(2)?,
                content_markdown: row.get(3)?,
                page_number: row.get(4)?,
                highlighted_text: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for r in rows {
            notes.push(r?);
        }
        Ok(notes)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Note>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, title, content_markdown, page_number, highlighted_text, created_at, updated_at
             FROM notes
             WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Note {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                title: row.get(2)?,
                content_markdown: row.get(3)?,
                page_number: row.get(4)?,
                highlighted_text: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save(conn: &Connection, note: &Note) -> Result<()> {
        conn.execute(
            "INSERT INTO notes (id, paper_id, title, content_markdown, page_number, highlighted_text, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content_markdown = excluded.content_markdown,
                page_number = excluded.page_number,
                highlighted_text = excluded.highlighted_text,
                updated_at = excluded.updated_at",
            params![
                note.id,
                note.paper_id,
                note.title,
                note.content_markdown,
                note.page_number,
                note.highlighted_text,
                note.created_at,
                note.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn search_notes(conn: &Connection, query: &str) -> Result<Vec<Note>> {
        let pattern = format!("%{}%", query.trim().to_lowercase());
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, title, content_markdown, page_number, highlighted_text, created_at, updated_at
             FROM notes
             WHERE lower(title) LIKE ?1 OR lower(content_markdown) LIKE ?1 OR lower(coalesce(highlighted_text, '')) LIKE ?1
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map(params![pattern], |row| {
            Ok(Note {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                title: row.get(2)?,
                content_markdown: row.get(3)?,
                page_number: row.get(4)?,
                highlighted_text: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for r in rows {
            notes.push(r?);
        }
        Ok(notes)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<bool> {
        let rows = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }
}
