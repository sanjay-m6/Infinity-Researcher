# ADR-005: SQLite Persistence Architecture & Access Strategy

**Status:** Accepted  
**Date:** 2026-10-24  
**Context:** Phase 4 of 10 — Local Backend, SQLite Database & Persistent Research Library  

---

## 1. Context & Problem Statement

Research Paper Scraper is a local-first desktop application engineered for researchers. The product requires a reliable, local-only database layer to store bibliographic metadata, researcher authors, personal collections, tags, research notes, and application settings.

Key requirements:
1. Pure local storage inside the user's operating system app-data directory (`research-paper-scraper.sqlite3`). Zero remote databases or cloud dependencies.
2. Cross-platform compatibility on Windows, macOS, and Linux without external runtime C library installations.
3. ACID transactional guarantees, foreign key enforcement, WAL mode, and busy timeouts to prevent desktop write locks.
4. Full-text search (FTS5) for instant local querying over titles, abstracts, authors, and venues.
5. Parameterized SQL queries to eliminate SQL injection risks.
6. Safe additive migrations tracked in version control.

---

## 2. Decision

We choose **`rusqlite` with the `bundled` feature** as the primary database engine, combined with a thread-safe `Database` connection wrapper (`Arc<Mutex<rusqlite::Connection>>`) managed in `AppState`.

### Key Rationale:
- **Zero Runtime Dependencies:** The `bundled` feature compiles SQLite 3.46+ directly from source into the native executable using standard C/C++ toolchains. Users never need to install `sqlite3.dll` or system packages.
- **Full FTS5 & JSON Support:** The bundled SQLite source includes FTS5, JSON1, and unicode tokenizers by default.
- **Deterministic Transaction Safety:** `rusqlite` provides idiomatic RAII transactions (`conn.transaction()?`) with automatic rollback on error, ensuring multi-table writes (such as creating a paper along with ordered authors and collection assignments) are atomic.
- **Simplicity & Predictability:** Avoids compile-time async macro complexity or offline schema generation files while ensuring that all database calls occur on Tauri's worker threads rather than the UI thread.
- **SQLite Pragmas Configured on Startup:**
  - `PRAGMA foreign_keys = ON;` — Strict relational integrity on deletes and cascades.
  - `PRAGMA journal_mode = WAL;` — Write-Ahead Logging for high-concurrency desktop performance.
  - `PRAGMA busy_timeout = 5000;` — 5-second wait on lock contention before returning an error.
  - `PRAGMA synchronous = NORMAL;` — Optimal performance and crash resistance with WAL mode.

---

## 3. Migration Strategy

Migrations are written as standard, version-controlled `.sql` files in `src-tauri/migrations/`.
On startup:
1. A `schema_migrations` table records applied versions (`version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT`).
2. Migrations are executed in numeric order inside an explicit transaction.
3. If any migration statement fails, the transaction rolls back cleanly, preserving the prior database state without leaving partial schemas.

---

## 4. Consequences & Trade-offs

- **Positive:**
  - Fast, self-contained desktop builds with zero runtime DLL configuration.
  - Zero SQL injection vulnerability through mandatory parameter binding.
  - Complete testability with in-memory SQLite instances (`Connection::open_in_memory()`) in unit and integration tests.
- **Negative / Mitigations:**
  - `Mutex<Connection>` serializes writes and reads across Tauri worker threads. Because this is a single-user desktop application with sub-millisecond local SQLite queries, lock contention is negligible and WAL mode ensures non-blocking disk writes.
