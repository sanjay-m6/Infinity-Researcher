use rusqlite::{params, Connection, Result};

use crate::domain::review_matrix::*;

pub struct MatrixRepository;

impl MatrixRepository {
    // -----------------------------------------------------------------------
    // Matrix Workspaces
    // -----------------------------------------------------------------------

    pub fn list_workspaces(conn: &Connection) -> Result<Vec<MatrixWorkspace>> {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, columns_json, created_at, updated_at
             FROM matrix_workspaces
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(MatrixWorkspace {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                columns_json: row.get(3)?,
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

    pub fn get_workspace(conn: &Connection, id: &str) -> Result<Option<MatrixWorkspace>> {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, columns_json, created_at, updated_at
             FROM matrix_workspaces
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(MatrixWorkspace {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                columns_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_workspace(conn: &Connection, ws: &MatrixWorkspace) -> Result<()> {
        conn.execute(
            "INSERT INTO matrix_workspaces (id, title, description, columns_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                 title = excluded.title,
                 description = excluded.description,
                 columns_json = excluded.columns_json,
                 updated_at = excluded.updated_at",
            params![
                ws.id,
                ws.title,
                ws.description,
                ws.columns_json,
                ws.created_at,
                ws.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_workspace(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM matrix_workspaces WHERE id = ?1", params![id])?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Workspace Papers
    // -----------------------------------------------------------------------

    pub fn add_paper_to_workspace(conn: &Connection, workspace_id: &str, paper_id: &str) -> Result<()> {
        conn.execute(
            "INSERT OR IGNORE INTO matrix_workspace_papers (workspace_id, paper_id, added_at)
             VALUES (?1, ?2, datetime('now'))",
            params![workspace_id, paper_id],
        )?;
        // Bump workspace updated_at
        conn.execute(
            "UPDATE matrix_workspaces SET updated_at = datetime('now') WHERE id = ?1",
            params![workspace_id],
        )?;
        Ok(())
    }

    pub fn remove_paper_from_workspace(conn: &Connection, workspace_id: &str, paper_id: &str) -> Result<()> {
        conn.execute(
            "DELETE FROM matrix_workspace_papers WHERE workspace_id = ?1 AND paper_id = ?2",
            params![workspace_id, paper_id],
        )?;
        // Also delete associated extractions in this workspace
        conn.execute(
            "DELETE FROM matrix_extractions WHERE workspace_id = ?1 AND paper_id = ?2",
            params![workspace_id, paper_id],
        )?;
        conn.execute(
            "UPDATE matrix_workspaces SET updated_at = datetime('now') WHERE id = ?1",
            params![workspace_id],
        )?;
        Ok(())
    }

    pub fn get_workspace_papers(conn: &Connection, workspace_id: &str) -> Result<Vec<(String, String)>> {
        let mut stmt = conn.prepare(
            "SELECT paper_id, added_at FROM matrix_workspace_papers WHERE workspace_id = ?1 ORDER BY added_at ASC",
        )?;

        let rows = stmt.query_map(params![workspace_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -----------------------------------------------------------------------
    // Matrix Extractions
    // -----------------------------------------------------------------------

    pub fn get_extractions(
        conn: &Connection,
        workspace_id: &str,
        paper_id: Option<&str>,
    ) -> Result<Vec<MatrixExtraction>> {
        let (sql, params_vec): (&str, Vec<Box<dyn rusqlite::ToSql>>) = match paper_id {
            Some(pid) => (
                "SELECT id, workspace_id, paper_id, field_key, extracted_value, confidence,
                        page_number, char_offset_start, char_offset_end, source_passage, status,
                        created_at, updated_at
                 FROM matrix_extractions
                 WHERE workspace_id = ?1 AND paper_id = ?2
                 ORDER BY created_at ASC",
                vec![Box::new(workspace_id.to_string()), Box::new(pid.to_string())],
            ),
            None => (
                "SELECT id, workspace_id, paper_id, field_key, extracted_value, confidence,
                        page_number, char_offset_start, char_offset_end, source_passage, status,
                        created_at, updated_at
                 FROM matrix_extractions
                 WHERE workspace_id = ?1
                 ORDER BY created_at ASC",
                vec![Box::new(workspace_id.to_string())],
            ),
        };

        let mut stmt = conn.prepare(sql)?;
        let mut borrowed_params = Vec::new();
        for p in &params_vec {
            borrowed_params.push(p.as_ref());
        }

        let rows = stmt.query_map(borrowed_params.as_slice(), |row| {
            Ok(MatrixExtraction {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                paper_id: row.get(2)?,
                field_key: row.get(3)?,
                extracted_value: row.get(4)?,
                confidence: row.get(5)?,
                page_number: row.get(6)?,
                char_offset_start: row.get(7)?,
                char_offset_end: row.get(8)?,
                source_passage: row.get(9)?,
                status: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_extraction(conn: &Connection, ext: &MatrixExtraction) -> Result<()> {
        conn.execute(
            "INSERT INTO matrix_extractions (
                id, workspace_id, paper_id, field_key, extracted_value, confidence,
                page_number, char_offset_start, char_offset_end, source_passage, status,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            ON CONFLICT(workspace_id, paper_id, field_key) DO UPDATE SET
                extracted_value = excluded.extracted_value,
                confidence = excluded.confidence,
                page_number = excluded.page_number,
                char_offset_start = excluded.char_offset_start,
                char_offset_end = excluded.char_offset_end,
                source_passage = excluded.source_passage,
                status = excluded.status,
                updated_at = excluded.updated_at",
            params![
                ext.id,
                ext.workspace_id,
                ext.paper_id,
                ext.field_key,
                ext.extracted_value,
                ext.confidence,
                ext.page_number,
                ext.char_offset_start,
                ext.char_offset_end,
                ext.source_passage,
                ext.status,
                ext.created_at,
                ext.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_extraction(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM matrix_extractions WHERE id = ?1", params![id])?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Evidence Copilot Sessions & Messages
    // -----------------------------------------------------------------------

    pub fn create_copilot_session(conn: &Connection, s: &EvidenceCopilotSession) -> Result<()> {
        conn.execute(
            "INSERT INTO evidence_copilot_sessions (id, title, target_scope, target_paper_id, workspace_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                s.id,
                s.title,
                s.target_scope,
                s.target_paper_id,
                s.workspace_id,
                s.created_at,
                s.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_copilot_sessions(
        conn: &Connection,
        workspace_id: Option<&str>,
        target_paper_id: Option<&str>,
    ) -> Result<Vec<EvidenceCopilotSession>> {
        let (sql, params_vec): (&str, Vec<Box<dyn rusqlite::ToSql>>) = match (workspace_id, target_paper_id) {
            (Some(ws), _) => (
                "SELECT id, title, target_scope, target_paper_id, workspace_id, created_at, updated_at
                 FROM evidence_copilot_sessions WHERE workspace_id = ?1 ORDER BY updated_at DESC",
                vec![Box::new(ws.to_string())],
            ),
            (None, Some(pid)) => (
                "SELECT id, title, target_scope, target_paper_id, workspace_id, created_at, updated_at
                 FROM evidence_copilot_sessions WHERE target_paper_id = ?1 ORDER BY updated_at DESC",
                vec![Box::new(pid.to_string())],
            ),
            (None, None) => (
                "SELECT id, title, target_scope, target_paper_id, workspace_id, created_at, updated_at
                 FROM evidence_copilot_sessions ORDER BY updated_at DESC LIMIT 50",
                vec![],
            ),
        };

        let mut stmt = conn.prepare(sql)?;
        let mut borrowed_params = Vec::new();
        for p in &params_vec {
            borrowed_params.push(p.as_ref());
        }

        let rows = stmt.query_map(borrowed_params.as_slice(), |row| {
            Ok(EvidenceCopilotSession {
                id: row.get(0)?,
                title: row.get(1)?,
                target_scope: row.get(2)?,
                target_paper_id: row.get(3)?,
                workspace_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_copilot_message(conn: &Connection, msg: &EvidenceCopilotMessage) -> Result<()> {
        conn.execute(
            "INSERT INTO evidence_copilot_messages (id, session_id, role, content, evidence_sources_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                msg.id,
                msg.session_id,
                msg.role,
                msg.content,
                msg.evidence_sources_json,
                msg.created_at,
            ],
        )?;
        conn.execute(
            "UPDATE evidence_copilot_sessions SET updated_at = datetime('now') WHERE id = ?1",
            params![msg.session_id],
        )?;
        Ok(())
    }

    pub fn get_copilot_messages(conn: &Connection, session_id: &str) -> Result<Vec<EvidenceCopilotMessage>> {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, evidence_sources_json, created_at
             FROM evidence_copilot_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(EvidenceCopilotMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                evidence_sources_json: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }
}
