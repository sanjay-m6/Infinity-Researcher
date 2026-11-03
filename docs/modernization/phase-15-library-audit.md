# Phase 15 Pre-Implementation Audit: Research Library & Knowledge Management

## 1. Audit Overview & Technology Baseline

Before designing and executing Phase 15, a comprehensive audit was performed across the Infinity Researcher codebase, spanning Rust backend services, SQLite migrations, domain models, React frontend views, state management, and test suites.

- **Desktop Framework**: Tauri 2 (Rust backend with rusqlite WAL mode).
- **Frontend Architecture**: React 19, TypeScript, Tailwind CSS v4, Lucide icons.
- **Data Persistence**: SQLite schema currently at version 12 (`schema_migrations` table).
- **Core Entities Available**: `papers`, `collections`, `collection_papers`, `tags`, `paper_tags`, `notes`, `paper_files`, `reader_state`, `download_jobs`, `duplicate_candidates`.

---

## 2. Component & Feature Audit

### 2.1 Research Library Workspace (`LibraryView.tsx`)
- **Current State**: `LibraryView.tsx` currently has 3 tabs: "Library Papers", "Duplicate Review", and "Document Integrity & Pipeline".
- **Limitations Identified**:
  - Displays only a single fixed list/table view. Grid/card view and compact table view are missing.
  - View preference is not persistent.
  - Search is purely client-side substring matching on title/authors/venue; does not search tags, notes, or DOI.
  - No filtering by reading status or tags in the main view.
  - Tags are not rendered on the paper rows.
  - Local PDF availability status is not indicated with direct "Open in PDF Reader" action.
  - Export action button was hardcoded disabled ("Export (Phase 9)").
  - No saved searches drawer or selector.
  - No direct inline metadata editing.

### 2.2 Collections (`CollectionsView.tsx`)
- **Current State**: Dedicated collections view with Create, Rename, Delete, paper list, and detail search.
- **Preserved Strengths**:
  - Deleting a collection safely unlinks papers without deleting the underlying paper records.
  - Paper counts are tracked.
- **Limitations**:
  - Filter by collection inside `LibraryView` only lists collection names in a dropdown without live counts or color tokens.
  - Nested collection support is not exposed.

### 2.3 Tags & Tag Management
- **Current State**: Backend has `tags` table and `paper_tags` junction table, plus `TagService` and commands (`list_tags`, `assign_tag_to_paper`, `remove_tag_from_paper`, `create_tag`, `rename_tag`, `delete_tag`, `bulk_assign_tags`, `bulk_remove_tags`).
- **Limitations**:
  - Frontend UI for tag management, color assignment, and multi-tag filtering is missing in the library view.
  - Tag normalization rules (case-insensitivity, trim, Unicode preservation) need strict enforcement.

### 2.4 Reading Status & Reading Progress
- **Current State**: SQLite migration 0004 added `reading_status` (`unread`, `reading`, `read`) and `reading_progress` (0.0 to 1.0) to `papers`.
- **Limitations**:
  - `reading_status` is not exposed in `AppContext` methods.
  - No UI chip or dropdown to change reading status directly from the library list or cards.
  - `last_opened_at` timestamp is missing from the database schema.

### 2.5 Research Notes
- **Current State**: SQLite has `notes` table (`id`, `paper_id`, `title`, `content_markdown`, `created_at`, `updated_at`).
- **Limitations**:
  - `page_number` and `highlighted_text` columns are missing from `notes`.
  - No global note search across the library.

### 2.6 Saved Searches
- **Current State**: No `saved_searches` table exists in SQLite.
- **Requirements**:
  - Must create migration `0013_research_library_and_knowledge.sql` to introduce `saved_searches` table (`id`, `name`, `raw_query`, `structured_query_json`, `selected_sources_json`, `filters_json`, `sort_by`, `last_used_at`, `created_at`, `updated_at`).

### 2.7 Import and Export
- **Current State**: Rust backend has `ExportService` supporting BibTeX, RIS, CSV, JSON citation export.
- **Limitations**:
  - Full portable library JSON import/export (with papers, collections, tags, notes, reading status, saved searches) is not yet wired to a user-facing modal in the library.

---

## 3. Feature Preservation Matrix

| Component | Existing Implementation | Phase 15 Planned Improvement | Status |
| :--- | :--- | :--- | :--- |
| **Library List** | Basic table in `LibraryView` | Multi-view (Table, Card Grid, Compact), sorting, tags | **Enhance** |
| **Collections** | `CollectionsView` & `collection_papers` | Enhanced collection drawer, live counts, color tokens | **Preserve & Enhance** |
| **Tags** | Rust commands exist, no library UI | Tag manager, multi-tag filter, semantic colors | **Add UI & Integrate** |
| **Reading Status** | Migration 0004 columns | Inline status badge/selector, filter by status, `last_opened_at` | **Integrate** |
| **Notes** | `notes` table in SQLite | Page references, quote anchors, search notes | **Upgrade Schema & UI** |
| **Saved Searches** | Absent | Migration 0013, Rust commands, reusable search pills | **New Module** |
| **Duplicates** | `duplicate_candidates` & Phase 7 review | Preserve existing merge flow, enhance conflict diff | **Preserve** |
| **Import/Export** | Backend `ExportService` | Full JSON library backup & restore + BibTeX/RIS export | **Integrate** |

