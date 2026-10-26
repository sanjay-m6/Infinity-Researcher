-- Migration 0005: Unified Academic Paper Discovery, PDF Retrieval & Embedded PDF Workspace
-- SQLite 3 (WAL mode, Foreign Keys ON)

-- 1. Download Jobs Table (Persistent queue & tracking for PDF downloads)
CREATE TABLE IF NOT EXISTS download_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    paper_title TEXT NOT NULL,
    url TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, downloading, paused, completed, failed, cancelled
    bytes_downloaded INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    progress_percent REAL NOT NULL DEFAULT 0.0,
    stage_message TEXT NOT NULL DEFAULT 'Queued for download',
    error_message TEXT,
    destination_path TEXT,
    sha256_hash TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_download_jobs_paper ON download_jobs(paper_id);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_download_jobs_created ON download_jobs(created_at);

-- 2. PDF Candidates Table (Multi-evidence resolution tracking per paper)
CREATE TABLE IF NOT EXISTS pdf_candidates (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'direct_api', -- direct_api, open_access_resolver, landing_page_meta
    access_status TEXT NOT NULL DEFAULT 'unknown',   -- unknown, checking, open_access_available, restricted_or_subscription, landing_page_only, not_found, blocked_by_policy, failed_retryable, failed_permanent, downloaded
    evidence_notes TEXT,
    last_checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pdf_candidates_paper ON pdf_candidates(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_candidates_status ON pdf_candidates(access_status);

-- 3. Reader State Table (Persistent reading progress, page position, zoom, rotation)
CREATE TABLE IF NOT EXISTS reader_state (
    paper_id TEXT PRIMARY KEY NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    file_id TEXT REFERENCES paper_files(id) ON DELETE SET NULL,
    last_page INTEGER NOT NULL DEFAULT 1,
    zoom_level REAL NOT NULL DEFAULT 1.0,
    rotation INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reader_state_paper ON reader_state(paper_id);
