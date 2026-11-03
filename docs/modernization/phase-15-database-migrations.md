# Phase 15: Database Migrations & Schema Evolution Report

## 1. Executive Summary

Phase 15 advances the SQLite database schema to version 13 via migration script `0013_research_library_and_knowledge.sql`. The migration adds the `saved_searches` table, page/quote anchor columns to `notes`, and `last_opened_at` tracking to `papers`, along with high-performance query indices.

---

## 2. Migration Script: `0013_research_library_and_knowledge.sql`

```sql
-- Migration 0013: Research Library, Collections, and Knowledge Management Enhancements
-- Upgrades schema to version 13.

-- 1. Create saved_searches table for storing reusable query configurations
CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query_text TEXT,
    structured_query_json TEXT,
    selected_sources_json TEXT,
    filters_json TEXT,
    sort_by TEXT,
    result_count_estimate INTEGER NOT NULL DEFAULT 0,
    last_executed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_executed ON saved_searches(last_executed_at);

-- 2. Add last_opened_at to papers for tracking reading recency
ALTER TABLE papers ADD COLUMN last_opened_at TEXT;
CREATE INDEX IF NOT EXISTS idx_papers_last_opened ON papers(last_opened_at);

-- 3. Add page_number and highlighted_text to notes for anchored citations
ALTER TABLE notes ADD COLUMN page_number INTEGER;
ALTER TABLE notes ADD COLUMN highlighted_text TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_page_number ON notes(paper_id, page_number);
```

---

## 3. Migration Runner Registration

In `src-tauri/src/database/migrations.rs`:
- Bumped `CURRENT_SCHEMA_VERSION = 13`.
- Registered `MIGRATION_0013` in the sequential migration array.
- Updated automated unit test `test_migrations_run_successfully` to verify target schema version 13 and total table count of 55 tables across all subsystems.

```rust
pub const CURRENT_SCHEMA_VERSION: i32 = 13;

const MIGRATIONS: &[Migration] = &[
    // Migrations 0001 through 0012 ...
    Migration {
        version: 13,
        description: "research_library_and_knowledge",
        sql: include_str!("../../migrations/0013_research_library_and_knowledge.sql"),
    },
];
```

