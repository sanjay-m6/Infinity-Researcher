-- Migration 0013: Research Library, Collections & Knowledge Management
-- Introduces persistent saved searches, last opened tracking, and enhanced note anchors.

-- 1. Saved Searches Table (Reusable query presets with filters and source configurations)
CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    raw_query TEXT NOT NULL,
    structured_query_json TEXT,
    selected_sources_json TEXT,
    filters_json TEXT,
    sort_by TEXT NOT NULL DEFAULT 'relevance',
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_used ON saved_searches(last_used_at DESC);

-- 2. Add last_opened_at to papers table for recency sorting
ALTER TABLE papers ADD COLUMN last_opened_at TEXT;
CREATE INDEX IF NOT EXISTS idx_papers_last_opened ON papers(last_opened_at);

-- 3. Enhance notes table with page_number and highlighted_text anchors
ALTER TABLE notes ADD COLUMN page_number INTEGER;
ALTER TABLE notes ADD COLUMN highlighted_text TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_page ON notes(paper_id, page_number);

