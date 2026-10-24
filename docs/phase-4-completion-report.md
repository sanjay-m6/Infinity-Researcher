# Phase 4 Completion Report: Local Backend, SQLite Database & Persistent Research Library

## 1. Executive Summary

Phase 4 successfully delivers a robust, secure, local-first SQLite persistence layer for the **Research Paper Scraper** desktop application. Built natively into the Rust backend using `rusqlite` (v0.40.2 bundled) with Write-Ahead Logging (WAL) and foreign keys enabled, the database runs directly from the operating system's application data directory.

All scholarly papers, authors, publication sources, collections, tags, research notes, and application settings are persisted in SQLite and accessed through typed Tauri 2 IPC commands. The React 19 frontend design system established in Phase 3 remains completely intact, seamlessly wired to the database with safe fallback capabilities for web previews and test runners.

---

## 2. Architecture Decision Record (ADR-005)

- **Document:** [`docs/decisions/ADR-005-database-access.md`](file:///d:/Paper/docs/decisions/ADR-005-database-access.md)
- **Decision:** Selected `rusqlite` with the `bundled` feature flag over ORMs (SeaORM, Diesel) or asynchronous wrappers (sqlx).
- **Justification:**
  - Zero external dynamic link library (DLL) dependencies on Windows, macOS, or Linux. Compiles SQLite directly from source.
  - Full native access to SQLite's native C API and FTS5 extension with `unicode61` tokenization.
  - Atomic transactions, thread safety via `Arc<Mutex<rusqlite::Connection>>`, and predictable synchronous queries without async runtime bloat.

---

## 3. Database Engine & File Layout

- **Operating System Path Resolution:** Resolved via `app.path().app_data_dir()` inside the Tauri `setup` hook.
  - Windows: `%LOCALAPPDATA%\research-paper-scraper\research-paper-scraper.sqlite3`
  - macOS: `~/Library/Application Support/research-paper-scraper/research-paper-scraper.sqlite3`
  - Linux: `~/.local/share/research-paper-scraper/research-paper-scraper.sqlite3`
- **Connection Pragmas Configured on Every Connection:**
  - `PRAGMA foreign_keys = ON;` (Strict relational cascading and constraints)
  - `PRAGMA busy_timeout = 5000;` (Wait up to 5s before busy error)
  - `PRAGMA synchronous = NORMAL;` (High write throughput with full crash safety)
  - `PRAGMA journal_mode = WAL;` (Concurrent readers during writes)
- **In-Memory Testing Support:** `Database::open_in_memory()` provisions isolated `:memory:` instances for unit and integration testing.

---

## 4. Migration Framework & Applied Schema

- **Migration Engine:** [`src-tauri/src/database/migrations.rs`](file:///d:/Paper/src-tauri/src/database/migrations.rs) executes sequential SQL migration scripts inside atomic transactions, tracked in `schema_migrations`.
- **Migration 0001 (`0001_initial_schema.sql`):**
  - Creates tables: `schema_migrations`, `papers`, `authors`, `paper_authors`, `sources`, `paper_sources`, `collections`, `collection_papers`, `tags`, `paper_tags`, `notes`, `app_settings`.
  - Creates FTS5 virtual table: `papers_fts` with `unicode61 remove_diacritics 1`.
  - Creates indexes: `idx_papers_doi`, `idx_papers_title_key`, `idx_papers_year`, `idx_papers_saved`, `idx_collections_name`, `idx_tags_name`, `idx_notes_paper_id`.
  - Seeds initial academic sources: 8 scholarly services from Phase 1 matrix (OpenAlex, Crossref, arXiv, Semantic Scholar, Europe PMC, DOAJ, IEEE Xplore, ScienceDirect).

---

## 5. Domain Models & Relational Normalization

Structured Rust domain models in [`src-tauri/src/domain/`](file:///d:/Paper/src-tauri/src/domain/):
- **`Paper` (`paper.rs`):** Canonical metadata (DOI, clean title key, abstract, publication date, year, venue, language, citations, open access, file path, confidence, is_saved) plus hydrated associations (authors, collections, tags, source names).
- **`Author` (`paper.rs`):** Master author entity with family/given names, ORCID, and ordering.
- **`Collection` (`collection.rs`):** Custom organizational folders with parent hierarchy, accent color, and paper count.
- **`Tag` (`tag.rs`):** Multi-dimensional classification labels with paper count.
- **`Note` (`note.rs`):** Attached markdown annotations per paper.
- **`Source` (`source.rs`):** Academic service provider configurations, rate limits, and tiers.
- **`AppSetting` (`settings.rs`):** Key-value application settings.
- **`PagedResponse<T>` (`pagination.rs`):** Universal pagination wrapper with page, page_size, total_count, total_pages.

---

## 6. Data Integrity & Cascading Rules

Relational cascading is enforced at the database level:
- **Collection Deletion Safety:** `ON DELETE CASCADE` on `collection_papers` removes the link between the collection and paper. **Deleting a collection NEVER deletes paper records.**
- **Paper Deletion Cascades:** Deleting a paper automatically removes its join rows in `paper_authors`, `collection_papers`, `paper_tags`, and deletes attached `notes`, but leaves the master `authors` and `tags` tables intact.

---

## 7. Deduplication Engine (DOI & Title Keys)

- **Canonical DOI Normalization:** `normalize_doi` removes URL prefixes (`https://doi.org/`, `http://doi.org/`, `doi:`), trims whitespace, and normalizes to lowercase. A unique database index prevents duplicate DOI insertions.
- **Fuzzy Title Key Normalization:** `compute_clean_title_key` strips all whitespace and punctuation and lowers case (`"Attention Is All You Need!"` -> `"attentionisallyouneed"`). The service layer verifies uniqueness before insertion to prevent duplicate paper records.

---

## 8. Full-Text Search (FTS5) Engine

- **Virtual Table:** `papers_fts USING fts5(paper_id UNINDEXED, title, abstract, authors, venue, tokenize = 'unicode61 remove_diacritics 1')`.
- **Search Capabilities:** Prefix searching (`comput*`), exact phrases (`"deep learning"`), author queries (`Kaiming He`), and abstract keywords.
- **Index Synchronization:** `PaperRepository` synchronizes `papers_fts` during `create`, `update`, and `delete` within the same transaction.

---

## 9. Repository Layer Architecture

Implemented in [`src-tauri/src/repositories/`](file:///d:/Paper/src-tauri/src/repositories/):
- **`PaperRepository` (`paper_repo.rs`):** Atomic insertion of papers and associations, FTS synchronization, dynamic parameterized listing with pagination and filters (`collection_id`, `year_start`, `year_end`, `open_access_only`, `is_saved_only`, `sort_by`), DOI and title key queries.
- **`CollectionRepository` (`collection_repo.rs`):** Collection CRUD, unique name validation, join table operations (`add_paper`, `remove_paper`), and dynamic paper counts.
- **`TagRepository` (`tag_repo.rs`):** Tag assignment, listing with paper count, and disassociation.
- **`NoteRepository` (`note_repo.rs`):** Note creation, retrieval by paper, and deletion.
- **`SettingsRepository` (`settings_repo.rs`):** Key-value upserts, retrieval, and listing.
- **`SourceRepository` (`source_repo.rs`):** Lists seeded source configurations.

---

## 10. Service Layer & Input Validation

Implemented in [`src-tauri/src/services/`](file:///d:/Paper/src-tauri/src/services/):
- **`PaperService` (`paper_service.rs`):** Title non-blank validation, publication year boundary checks (1600-2100), duplicate DOI verification, clean title key deduplication, UUID generation, and timestamp management.
- **`CollectionService` (`collection_service.rs`):** Name trimming, 50-character limit, case-insensitive duplicate name checks, default `#6366f1` accent color.
- **`NoteService` (`note_service.rs`):** Markdown content validation and note management.
- **`TagService` (`tag_service.rs`):** Tag assignment and cleanup.
- **`SettingsService` (`settings_service.rs`):** Application settings management.
- **`SourceService` (`source_service.rs`):** Source provider queries.
- **`HealthService` (`health.rs`):** Queries database info and reports SQLite schema version, WAL mode, and subsystem readiness.

---

## 11. Typed Tauri Commands & Desktop API

### Rust Commands Registered in `tauri::generate_handler!`:
- **Papers:** `list_papers`, `get_paper`, `create_paper`, `update_paper`, `delete_paper`, `toggle_save_paper`
- **Collections:** `list_collections`, `create_collection`, `update_collection`, `delete_collection`, `add_paper_to_collection`, `remove_paper_from_collection`
- **Tags:** `list_tags`, `assign_tag_to_paper`, `remove_tag_from_paper`
- **Notes:** `get_notes_for_paper`, `save_note`, `delete_note`
- **Settings:** `get_app_setting`, `set_app_setting`, `list_app_settings`
- **Sources:** `list_sources`
- **Diagnostics:** `get_database_info`, `app_health`, `app_ping`

### Frontend Desktop API:
- Located in [`src/lib/desktop-api/`](file:///d:/Paper/src/lib/desktop-api/):
  - `types.ts`: TypeScript interfaces mirroring Rust DTOs.
  - `adapters.ts`: `dbPaperToPaper` and `dbCollectionToCollection` adapters mapping raw SQLite records to UI models.
  - `index.ts`: Strongly-typed invoke wrappers with error normalization.

---

## 12. Frontend State & UI Persistence

- In [`src/context/AppContext.tsx`](file:///d:/Paper/src/context/AppContext.tsx):
  - On startup in Tauri, queries `getDatabaseInfo()`, `listCollections()`, and `listPapers()`.
  - Loads persistent settings (`theme_mode`) directly from SQLite `app_settings`.
  - All collection creations, renames, and deletions execute both in SQLite and in local state.
  - Paper save toggling updates SQLite `is_saved` column.
  - In browser mode, falls back gracefully to in-memory fixtures.
  - Provides a one-click `seedSampleData()` helper to populate a clean SQLite database with foundational research papers.

---

## 13. Diagnostic View & Settings Integration

- **Settings View:** Updated [`src/features/settings/SettingsView.tsx`](file:///d:/Paper/src/features/settings/SettingsView.tsx) now displays:
  - Database file path
  - Schema version (`v1`)
  - Journal mode (`WAL`)
  - Foreign keys status (`ENABLED (ON)`)
  - Full-Text Search status (`FTS5 Unicode`)
  - "Refresh DB" and "Seed Sample Papers" actions.
- **Diagnostic View:** [`src/components/DiagnosticView.tsx`](file:///d:/Paper/src/components/DiagnosticView.tsx) dynamically reports live SQLite database subsystem status.

---

## 14. Automated Test Suite & Quality Verification

All quality gates passed with zero warnings or errors:
- **Rust Unit Tests:** 8 passed, 0 failed.
- **Rust Database Integration Tests:** 5 passed, 0 failed (testing initialization, CRUD, duplicate DOI/title rejection, FTS5 search, collections, cascading deletion rules, notes, tags, and settings).
- **Vitest Frontend Tests:** 27 passed across 4 test suites (`desktop-api.test.ts`, `domain-logic.test.ts`, `DiagnosticView.test.tsx`, `AppShell.test.tsx`).
- **TypeScript Typecheck:** `tsc --noEmit` exited 0.
- **ESLint:** Clean, 0 errors, 0 warnings.
- **Vite Production Build:** Successfully built in 1.50s.

---

## 15. Readiness for Phase 5 (Academic Connectors)

The database schema and service layer are fully prepared for Phase 5:
- The `sources` table contains all 8 academic providers with rate limits and concurrency limits.
- The `paper_sources` join table is ready to receive upstream provider IDs and raw JSON responses.
- The `papers` table schema cleanly supports normalized ingestion from OpenAlex, Crossref, and arXiv APIs.
- Deduplication indexes on DOI and `clean_title_key` ensure incoming API records will not create duplicates in the user's research library.
