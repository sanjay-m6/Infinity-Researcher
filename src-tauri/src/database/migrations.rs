use rusqlite::{Connection, Result};
use tracing::info;

pub const CURRENT_SCHEMA_VERSION: i32 = 1;

const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial_schema.sql");

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    // Ensure migrations tracking table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )?;

    let applied_version: Option<i32> = conn
        .query_row(
            "SELECT MAX(version) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let current = applied_version.unwrap_or(0);
    info!(
        current_version = current,
        target_version = CURRENT_SCHEMA_VERSION,
        "Checking database schema migrations"
    );

    if current < 1 {
        info!("Applying migration 0001: initial schema");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0001)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (1, "0001_initial_schema"),
        )?;
        tx.commit()?;
        info!("Migration 0001 applied successfully");
    }

    Ok(())
}

pub fn get_schema_version(conn: &Connection) -> Result<i32> {
    let version: Option<i32> = conn
        .query_row(
            "SELECT MAX(version) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(None);

    Ok(version.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_run_successfully_on_clean_db() {
        let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        run_migrations(&mut conn).expect("run_migrations failed");

        let version = get_schema_version(&conn).expect("get_schema_version failed");
        assert_eq!(version, 1);

        // Verify key tables exist
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('papers', 'authors', 'sources', 'collections', 'tags', 'notes', 'app_settings')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 7);

        // Verify seeded sources
        let source_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sources", [], |row| row.get(0))
            .unwrap();
        assert_eq!(source_count, 8);

        // Idempotency check: running again must succeed without error
        run_migrations(&mut conn).expect("second run_migrations must be idempotent");
        assert_eq!(get_schema_version(&conn).unwrap(), 1);
    }
}
