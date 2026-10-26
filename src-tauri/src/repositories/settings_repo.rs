use crate::domain::settings::AppSetting;
use rusqlite::{params, Connection, Result};

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get(conn: &Connection, key: &str) -> Result<Option<String>> {
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set(conn: &Connection, key: &str, value: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn list(conn: &Connection) -> Result<Vec<AppSetting>> {
        let mut stmt =
            conn.prepare("SELECT key, value, updated_at FROM app_settings ORDER BY key ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(AppSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;

        let mut settings = Vec::new();
        for r in rows {
            settings.push(r?);
        }
        Ok(settings)
    }
}
