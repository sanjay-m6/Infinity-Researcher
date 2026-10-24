pub mod migrations;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub path: String,
    pub schema_version: i32,
    pub journal_mode: String,
    pub foreign_keys: bool,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

impl Database {
    /// Opens or creates the SQLite database at the specified path and runs migrations.
    pub fn open_file(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                error!(error = %e, path = %parent.display(), "Failed to create database parent directory");
                AppError::Internal(format!("Failed to create database directory: {}", e))
            })?;
        }

        let mut conn = Connection::open(path).map_err(|e| {
            error!(error = %e, path = %path.display(), "Failed to open SQLite database file");
            AppError::Internal(format!("Failed to open database: {}", e))
        })?;

        Self::configure_pragmas(&mut conn)?;
        migrations::run_migrations(&mut conn).map_err(|e| {
            error!(error = %e, "Failed to execute database migrations");
            AppError::Internal(format!("Database migration failed: {}", e))
        })?;

        info!(path = %path.display(), "SQLite database opened and migrated successfully");

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: path.to_path_buf(),
        })
    }

    /// Opens an in-memory SQLite database for unit and integration testing.
    pub fn open_in_memory() -> Result<Self, AppError> {
        let mut conn = Connection::open_in_memory().map_err(|e| {
            AppError::Internal(format!("Failed to open in-memory database: {}", e))
        })?;

        Self::configure_pragmas(&mut conn)?;
        migrations::run_migrations(&mut conn).map_err(|e| {
            AppError::Internal(format!("In-memory database migration failed: {}", e))
        })?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: PathBuf::from(":memory:"),
        })
    }

    /// Configures essential SQLite pragmas for single-user desktop performance and integrity.
    fn configure_pragmas(conn: &mut Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;
             PRAGMA synchronous = NORMAL;",
        )
        .map_err(|e| AppError::Internal(format!("Failed to set database pragmas: {}", e)))?;

        // In-memory databases do not use WAL mode, so we only enable WAL on disk
        let _: String = conn
            .query_row("PRAGMA journal_mode = WAL;", [], |row| row.get(0))
            .unwrap_or_else(|_| "memory".to_string());

        Ok(())
    }

    /// Locks the connection mutex and yields a scoped MutexGuard.
    pub fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.conn.lock().map_err(|_| {
            error!("Database connection mutex poisoned");
            AppError::Internal("Database connection lock poisoned".to_string())
        })
    }

    /// Retrieves diagnostic information about the active database.
    pub fn get_info(&self) -> Result<DatabaseInfo, AppError> {
        let conn = self.lock()?;
        let schema_version = migrations::get_schema_version(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to query schema version: {}", e)))?;

        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap_or_else(|_| "unknown".to_string());

        let foreign_keys: i64 = conn
            .query_row("PRAGMA foreign_keys;", [], |row| row.get(0))
            .unwrap_or(0);

        Ok(DatabaseInfo {
            path: self.db_path.to_string_lossy().to_string(),
            schema_version,
            journal_mode,
            foreign_keys: foreign_keys == 1,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory_and_diagnostics() {
        let db = Database::open_in_memory().expect("in-memory db initialization failed");
        let info = db.get_info().expect("get_info failed");

        assert_eq!(info.schema_version, 1);
        assert!(info.foreign_keys);
        assert_eq!(info.path, ":memory:");
    }
}
