use rusqlite::{params, Connection, OptionalExtension, Result};

use crate::domain::auth::{UserPreferences, UserRecord};

pub struct AuthRepository;

impl AuthRepository {
    pub fn create_user(conn: &Connection, record: &UserRecord) -> Result<()> {
        conn.execute(
            "INSERT INTO users (id, email, username, password_hash, created_at, last_login_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                record.id,
                record.email.trim(),
                record.username.trim(),
                record.password_hash,
                record.created_at,
                record.last_login_at
            ],
        )?;

        // Initialize default preferences
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR IGNORE INTO user_preferences (user_id, auto_lock_timeout_minutes, remember_me, theme, created_at, updated_at)
             VALUES (?1, 10, 0, 'system', ?2, ?3)",
            params![record.id, now, now],
        )?;

        Ok(())
    }

    pub fn find_by_identifier(conn: &Connection, identifier: &str) -> Result<Option<UserRecord>> {
        let clean = identifier.trim();
        let mut stmt = conn.prepare(
            "SELECT id, email, username, password_hash, created_at, last_login_at
             FROM users
             WHERE LOWER(email) = LOWER(?1) OR LOWER(username) = LOWER(?1)
             LIMIT 1",
        )?;

        stmt.query_row(params![clean], |row| {
            Ok(UserRecord {
                id: row.get(0)?,
                email: row.get(1)?,
                username: row.get(2)?,
                password_hash: row.get(3)?,
                created_at: row.get(4)?,
                last_login_at: row.get(5)?,
            })
        })
        .optional()
    }

    pub fn find_by_id(conn: &Connection, id: &str) -> Result<Option<UserRecord>> {
        let mut stmt = conn.prepare(
            "SELECT id, email, username, password_hash, created_at, last_login_at
             FROM users
             WHERE id = ?1
             LIMIT 1",
        )?;

        stmt.query_row(params![id], |row| {
            Ok(UserRecord {
                id: row.get(0)?,
                email: row.get(1)?,
                username: row.get(2)?,
                password_hash: row.get(3)?,
                created_at: row.get(4)?,
                last_login_at: row.get(5)?,
            })
        })
        .optional()
    }

    pub fn email_exists(conn: &Connection, email: &str) -> Result<bool> {
        let clean = email.trim();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?1)",
            params![clean],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn username_exists(conn: &Connection, username: &str) -> Result<bool> {
        let clean = username.trim();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?1)",
            params![clean],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn update_last_login(conn: &Connection, user_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE users SET last_login_at = ?1 WHERE id = ?2",
            params![now, user_id],
        )?;
        Ok(())
    }

    pub fn update_password_hash(conn: &Connection, user_id: &str, password_hash: &str) -> Result<()> {
        conn.execute(
            "UPDATE users SET password_hash = ?1 WHERE id = ?2",
            params![password_hash, user_id],
        )?;
        Ok(())
    }

    pub fn get_preferences(conn: &Connection, user_id: &str) -> Result<UserPreferences> {
        let mut stmt = conn.prepare(
            "SELECT user_id, auto_lock_timeout_minutes, remember_me, theme, created_at, updated_at
             FROM user_preferences
             WHERE user_id = ?1
             LIMIT 1",
        )?;

        let res = stmt.query_row(params![user_id], |row| {
            let rem: i64 = row.get(2)?;
            Ok(UserPreferences {
                user_id: row.get(0)?,
                auto_lock_timeout_minutes: row.get(1)?,
                remember_me: rem != 0,
                theme: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        }).optional()?;

        match res {
            Some(prefs) => Ok(prefs),
            None => {
                let now = chrono::Utc::now().to_rfc3339();
                let default_prefs = UserPreferences {
                    user_id: user_id.to_string(),
                    auto_lock_timeout_minutes: 10,
                    remember_me: false,
                    theme: "system".to_string(),
                    created_at: now.clone(),
                    updated_at: now,
                };
                let _ = Self::save_preferences(conn, &default_prefs);
                Ok(default_prefs)
            }
        }
    }

    pub fn save_preferences(conn: &Connection, prefs: &UserPreferences) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO user_preferences (user_id, auto_lock_timeout_minutes, remember_me, theme, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(user_id) DO UPDATE SET
                 auto_lock_timeout_minutes = excluded.auto_lock_timeout_minutes,
                 remember_me = excluded.remember_me,
                 theme = excluded.theme,
                 updated_at = excluded.updated_at",
            params![
                prefs.user_id,
                prefs.auto_lock_timeout_minutes,
                if prefs.remember_me { 1 } else { 0 },
                prefs.theme,
                prefs.created_at,
                now
            ],
        )?;
        Ok(())
    }

    pub fn count_users(conn: &Connection) -> Result<i64> {
        conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
    }

    /// Associates unassigned research data with this user to preserve existing records
    pub fn assign_unowned_records(conn: &Connection, user_id: &str) -> Result<()> {
        let tables = [
            "papers",
            "collections",
            "notes",
            "matrix_workspaces",
            "saved_integrity_reports",
            "citation_audits",
            "readability_reports",
            "writing_sessions",
            "writing_revisions",
            "download_jobs",
            "analysis_jobs",
        ];

        for table in tables {
            let sql = format!("UPDATE {} SET owner_id = ?1 WHERE owner_id IS NULL", table);
            let _ = conn.execute(&sql, params![user_id]);
        }
        Ok(())
    }
}

