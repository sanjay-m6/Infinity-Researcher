# Phase 15: Research Library Architecture Report

## 1. Executive Summary

Phase 15 transforms Infinity Researcher's local library from a basic table into a professional academic knowledge-management workspace. The modernized architecture integrates multiple display modes (Table, Card Grid, and Compact), persistent view preferences, real-time SQLite synchronization, comprehensive tag and collection management, reading progress tracking, cross-document note search, reusable saved search queries, and portable bibliographic backup/export.

---

## 2. Architecture Overview & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LibraryView (React 19)                         │
├────────────────────────────────────────────────────────────────────────┤
│  PageHeader (Global Search, Saved Queries, Tag Manager, Backup/Export) │
├────────────────────────────────────────────────────────────────────────┤
│  Tab Navigation: [Library Papers] | [Duplicate Review] | [Integrity]   │
├────────────────────────────────────────────────────────────────────────┤
│  Toolbar: SearchInput | ViewModeSelector | Collections | Status | Sort │
├────────────────────────────────────────────────────────────────────────┤
│  Dynamic View Layer:                                                   │
│    - PaperTableView   (Sortable columns, inline status, tag badges)   │
│    - PaperGridView    (Rich cards, abstract previews, progress bars)   │
│    - PaperCompactView (High-density rows for power researchers)        │
├────────────────────────────────────────────────────────────────────────┤
│  Modal Subsystems:                                                     │
│    - SavedSearchesDrawer     (Reusable query configurations)           │
│    - TagManagerModal         (Normalized Unicode tags, semantic tokens)│
│    - PaperEditModal          (User metadata editor)                    │
│    - NotesSearchModal        (Cross-document annotation discovery)     │
│    - LibraryImportExportModal (Versioned JSON, BibTeX, RIS)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC Invoke (Tauri 2)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Rust Command & Service Layer                     │
├────────────────────────────────────────────────────────────────────────┤
│  Commands: list_papers, touch_paper_opened, set_paper_reading_status,  │
│            search_notes, list_saved_searches, create_saved_search      │
├────────────────────────────────────────────────────────────────────────┤
│  Services: PaperService, NoteService, SavedSearchService, TagService   │
├────────────────────────────────────────────────────────────────────────┤
│  Repositories: PaperRepository, NoteRepository, SavedSearchRepository  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL (rusqlite)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SQLite Database (Schema Version 13)                 │
│  Tables: papers, collections, paper_collections, tags, paper_tags,     │
│          notes, saved_searches, paper_files, duplicate_candidates      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Principles

1. **True SQLite Persistence & Zero Mocking:**
   - Every user mutation (reading status, notes, tags, collection associations, saved searches) immediately commits to SQLite transactionally.
   - Initial library hydration reads directly from `list_papers` and `list_collections`.

2. **Multi-View Modularity:**
   - The view layout is decoupled into distinct presentation components (`PaperTableView`, `PaperGridView`, `PaperCompactView`) with a unified interface.
   - User layout preference is persisted in `localStorage` under `infinity_library_view_mode`, avoiding layout jumps across app reloads.

3. **Safe Dissociation Semantics:**
   - Deleting a collection or a tag never deletes the paper entity, downloaded PDF binary, or associated SQLite notes.
   - Unlinking safely removes junction records in `paper_collections` or `paper_tags`.

4. **Bi-directional Reader Handoff:**
   - Directly launching "Read" from any library view updates `papers.last_opened_at`, switches active navigation to `literature_workspace`, and loads the target PDF or landing preview in the embedded reader.

