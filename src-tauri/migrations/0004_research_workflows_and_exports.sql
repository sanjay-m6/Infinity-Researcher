-- Migration 0004: Research Workflows, Full-Text Search, Notes & Citation Exports
-- SQLite 3 (WAL mode, Foreign Keys ON, FTS5)

-- 1. Add reading_status and reading_progress to papers table if not present
ALTER TABLE papers ADD COLUMN reading_status TEXT NOT NULL DEFAULT 'unread'; -- 'unread', 'reading', 'read'
ALTER TABLE papers ADD COLUMN reading_progress REAL NOT NULL DEFAULT 0.0;   -- 0.0 to 1.0 (0% to 100%)

CREATE INDEX IF NOT EXISTS idx_papers_reading_status ON papers(reading_status);
CREATE INDEX IF NOT EXISTS idx_papers_reading_progress ON papers(reading_progress);

-- 2. In-Document PDF Full-Text Search Table (doc_text_fts)
CREATE VIRTUAL TABLE IF NOT EXISTS doc_text_fts USING fts5(
    file_id UNINDEXED,
    paper_id UNINDEXED,
    extracted_text,
    tokenize = 'unicode61 remove_diacritics 1'
);

-- 3. Populate doc_text_fts with any existing extracted PDF text
INSERT INTO doc_text_fts (file_id, paper_id, extracted_text)
SELECT id, paper_id, extracted_text
FROM paper_files
WHERE extracted_text IS NOT NULL AND trim(extracted_text) != '';

-- 4. Triggers to keep doc_text_fts in sync with paper_files
CREATE TRIGGER IF NOT EXISTS trg_paper_files_fts_insert
AFTER INSERT ON paper_files
WHEN NEW.extracted_text IS NOT NULL AND trim(NEW.extracted_text) != ''
BEGIN
    INSERT INTO doc_text_fts (file_id, paper_id, extracted_text)
    VALUES (NEW.id, NEW.paper_id, NEW.extracted_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_paper_files_fts_update
AFTER UPDATE OF extracted_text ON paper_files
BEGIN
    DELETE FROM doc_text_fts WHERE file_id = OLD.id;
    INSERT INTO doc_text_fts (file_id, paper_id, extracted_text)
    SELECT NEW.id, NEW.paper_id, NEW.extracted_text
    WHERE NEW.extracted_text IS NOT NULL AND trim(NEW.extracted_text) != '';
END;

CREATE TRIGGER IF NOT EXISTS trg_paper_files_fts_delete
AFTER DELETE ON paper_files
BEGIN
    DELETE FROM doc_text_fts WHERE file_id = OLD.id;
END;
