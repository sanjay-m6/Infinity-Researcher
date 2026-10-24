# Phase 4 Repository Audit & Implementation Plan

**Project:** Research Paper Scraper — Local-First Academic Research Desktop Application  
**Phase:** 4 of 10 — Local Backend, SQLite Database & Persistent Research Library  
**Date:** 2026-10-24  

---

## 1. Current Architecture Summary

The repository currently contains:
- **Tauri 2 + Rust Core:** Managed in `src-tauri/` with native IPC commands (`app_health`, `app_ping`), strict CSP, scoped capabilities (`capabilities/default.json`), and structured `AppError` -> `CommandError` conversion.
- **React 19 + TypeScript Frontend:** Built with Vite 8 and Tailwind CSS v4 in `src/`, featuring a complete 8-screen scholarly application shell (`AppShell`, `Sidebar`, `Toolbar`, `PageHeader`, `Drawer`, `CommandPalette`, `ToastContainer`).
- **Domain Models & Demo Fixtures:** Documented in Phase 1 (`docs/phase-1/domain-model.md`), structured in `src/types/domain.ts`, and backed by in-memory fixtures in `src/data/demo-data.ts`.
- **Quality Gates:** 100% green CI test suite (`npm run check:all` passes typecheck, lint, 21 vitest tests, and Vite build; `cargo test` passes all native Rust unit tests).

---

## 2. Existing Screens Requiring Persistent Data

1. **Saved Library (`LibraryView.tsx`):** Requires persistent SQLite storage for saved papers, search queries, filtering by collection/source, sorting, and paper deletion.
2. **Collections (`CollectionsView.tsx`):** Requires SQLite CRUD (`collections` table, `collection_papers` junction table) with name validation, duplicate prevention, and color assignment.
3. **Paper Details (`PaperDetailDrawer.tsx`):** Requires retrieving full paper details, author relationships in order, notes, and collection membership toggles.
4. **Discover (`DiscoverView.tsx`):** Requires saving discovered papers directly into the local SQLite database.
5. **Dashboard (`DashboardView.tsx`):** Requires real counts (total papers in SQLite, collections count, saved count) instead of hardcoded numbers.
6. **Settings (`SettingsView.tsx`):** Requires persistent key-value configuration (`app_settings` table) for theme mode and library preferences.
7. **Sources (`SourcesView.tsx`):** Seeds the approved Phase 1 academic providers in the `sources` table.

---

## 3. Reusable Assets & Foundation Code

- **Phase 1 Specifications:** Full schema definitions in [`docs/phase-1/domain-model.md`](file:///d:/Paper/docs/phase-1/domain-model.md) and PRD in [`docs/phase-1/product-requirements.md`](file:///d:/Paper/docs/phase-1/product-requirements.md).
- **Phase 2 Error & Logging Infrastructure:** [`src-tauri/src/errors/mod.rs`](file:///d:/Paper/src-tauri/src/errors/mod.rs) and [`src-tauri/src/logging/mod.rs`](file:///d:/Paper/src-tauri/src/logging/mod.rs) provide sanitized `CommandError` and credential redaction.
- **Phase 3 UI Components:** Fully responsive desktop components in `src/components/` and `src/features/` consume context via `useApp()`, allowing seamless transition from demo state to real SQLite-backed state.

---

## 4. Architectural Conflicts & Deviations

- **No Conflicts:** The Phase 1 domain schema cleanly maps to SQLite 3 with FTS5 and WAL mode.
- **Database Access Strategy:** `rusqlite` (v0.40 with `bundled`, `uuid`, `chrono`) is chosen for native MSVC static compilation with zero runtime DLL dependencies. A thread-safe `Database` connection struct (`Arc<Mutex<rusqlite::Connection>>`) with strict SQLite PRAGMAs (`foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`) prevents lock contention and provides safe transaction boundaries.

---

## 5. Planned Files & Modules to Add or Modify

### Rust Backend (`src-tauri/`):
- `migrations/0001_initial_schema.sql`: Version-controlled initial schema creating `papers`, `authors`, `paper_authors`, `sources`, `paper_sources`, `collections`, `collection_papers`, `tags`, `paper_tags`, `notes`, `app_settings`, `schema_migrations`, and FTS5 virtual table `papers_fts`.
- `src/database/mod.rs`: Database initialization, path resolution via Tauri app-data dir, connection pragmas, and migration runner.
- `src/database/schema.rs`: Migration execution and schema version verification.
- `src/domain/`: Rust structs matching domain models (`paper.rs`, `author.rs`, `collection.rs`, `tag.rs`, `note.rs`, `settings.rs`, `source.rs`).
- `src/repositories/`: Parameterized SQL repositories (`paper_repo.rs`, `collection_repo.rs`, `tag_repo.rs`, `note_repo.rs`, `settings_repo.rs`, `source_repo.rs`).
- `src/services/`: Business logic, transaction orchestration, duplicate detection, and search services.
- `src/commands/`: Typed Tauri commands (`papers.rs`, `collections.rs`, `tags.rs`, `notes.rs`, `settings.rs`, `sources.rs`, `database.rs`).
- `src/state/mod.rs`: Integrate `Arc<Database>` into `AppState`.
- `src/lib.rs`: Register new commands and initialize the database on startup.
- `capabilities/default.json`: Allow the new command names.

### Frontend (`src/`):
- `src/lib/desktop-api/`: Typed client invoking Rust commands (`papers.ts`, `collections.ts`, `tags.ts`, `notes.ts`, `settings.ts`, `sources.ts`, `index.ts`).
- `src/context/AppContext.tsx`: Switch from static fixture state to loading and mutating real records through `desktop-api`.
- `src/test/`: Unit and integration tests validating persistence, migrations, duplicate prevention, and deletion safety.
