# Local Database Architecture: SQLite & FTS5 in Rust

## Overview

The Research Paper Scraper desktop application adopts a strictly local-first persistence architecture powered by SQLite 3, compiled natively into the Rust backend via `rusqlite` with the `bundled` feature flag. This guarantees 100% offline functionality, immediate low-latency read/write operations, and absolute user privacy without remote database synchronization or data telemetry.

---

## 1. Operating System App Data Path Resolution

To comply with operating system file layout conventions and preserve user data across desktop application updates, the SQLite database file is stored in the user-specific, non-roaming application data directory:

- **Windows:** `%LOCALAPPDATA%\research-paper-scraper\research-paper-scraper.sqlite3`
- **macOS:** `~/Library/Application Support/research-paper-scraper/research-paper-scraper.sqlite3`
- **Linux:** `~/.local/share/research-paper-scraper/research-paper-scraper.sqlite3`

In Tauri 2, this path is resolved at application startup inside the `setup` hook via `app.path().app_data_dir()`. The database engine automatically creates any missing parent directories (`std::fs::create_dir_all`) prior to establishing the SQLite connection.

---

## 2. SQLite Connection Pragmas & Concurrency

Every SQLite database connection established by the engine executes a mandatory initialization batch to enforce data integrity and single-user desktop performance:

```sql
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA journal_mode = WAL;
```

### Rationale:
- **`PRAGMA foreign_keys = ON;`**: SQLite disables foreign key constraints by default. Explicitly enabling foreign keys ensures relational integrity and executes cascading deletion rules (e.g. deleting a paper automatically removes its join records in `paper_authors` and `collection_papers`).
- **`PRAGMA busy_timeout = 5000;`**: Configures SQLite to wait up to 5,000 milliseconds when acquiring locks before returning an `SQLITE_BUSY` error, preventing transient lock contention during concurrent background tasks.
- **`PRAGMA journal_mode = WAL;`**: Write-Ahead Logging allows concurrent readers to proceed uninterrupted while a writer executes a transaction, drastically improving UI responsiveness.
- **`PRAGMA synchronous = NORMAL;`**: In WAL mode, `NORMAL` synchronization provides full durability against application crashes and operating system crashes without the heavy disk I/O cost of `FULL` synchronization.

---

## 3. Automated Migration Framework

Database schema evolution is managed through sequential, versioned SQL migration scripts tracked in a dedicated `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migration Execution Lifecycle:
1. When `Database::open_file(&path)` or `Database::open_in_memory()` is called, it verifies or creates `schema_migrations`.
2. It queries `MAX(version)` to determine the currently applied schema version.
3. Any migration script whose version exceeds the current database version is executed sequentially inside an atomic transaction (`conn.transaction()`).
4. If any migration step fails, the entire transaction is rolled back, preventing half-migrated database corruption.

### Active Migrations:
- **Migration 0001 (`0001_initial_schema.sql`):** Establishes the core entities:
  - `papers`, `authors`, `paper_authors`
  - `sources`, `paper_sources`
  - `collections`, `collection_papers`
  - `tags`, `paper_tags`
  - `notes`
  - `app_settings`
  - `papers_fts` (FTS5 virtual table)
  - Seeds 8 academic source definitions according to the Phase 1 source support matrix.

---

## 4. Full-Text Search (FTS5) Strategy

Fast local keyword search across tens of thousands of academic paper titles, abstracts, author names, and publication venues is powered by SQLite's native FTS5 extension.

### Schema Definition:
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
    paper_id UNINDEXED,
    title,
    abstract,
    authors,
    venue,
    tokenize = 'unicode61 remove_diacritics 1'
);
```

### Tokenizer Configuration:
- `unicode61`: Full Unicode tokenization supporting non-ASCII author names, accents, and international scholarly terms.
- `remove_diacritics 1`: Automatically folds diacritics (e.g. "Schrödinger" matches "Schrodinger", "LeCun" matches "lecun").

### Index Synchronization:
Whenever a paper is created or updated through `PaperRepository`, the repository synchronizes the `papers_fts` virtual table within the same transaction:
- On `PaperRepository::create`: An `INSERT INTO papers_fts` record is written.
- On `PaperRepository::update`: `DELETE FROM papers_fts WHERE paper_id = ?` followed by `INSERT INTO papers_fts`.
- On `PaperRepository::delete`: `DELETE FROM papers_fts WHERE paper_id = ?` ensures zero orphaned FTS records.

---

## 5. In-Memory Testing Architecture

To support fast, isolated, and deterministic testing without touching user disks:
- `Database::open_in_memory()` creates a private `:memory:` SQLite connection.
- All migrations and pragmas run against the in-memory connection identically to disk databases.
- Integration tests in `src-tauri/tests/database_integration_tests.rs` execute against in-memory instances, completing a full 5-test integration suite in **0.02 seconds**.

---

## 6. Backup and Recovery Guidelines

Because the application runs in SQLite WAL mode, database files consist of:
1. `research-paper-scraper.sqlite3` (main database file)
2. `research-paper-scraper.sqlite3-wal` (write-ahead log file)
3. `research-paper-scraper.sqlite3-shm` (shared memory index)

### Creating Safe Online Backups:
To back up the database while the application is active:
- Use the SQLite online backup API (`rusqlite::backup::Backup`) or execute `VACUUM INTO 'backup-path.sqlite3'`, which produces a single, fully checkpointed, consistent database copy without stopping application operation.
