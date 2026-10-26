-- Migration 0003: Paper Processing, Deduplication & Document Integrity
-- SQLite 3 (WAL mode, Foreign Keys ON)

-- 1. Add merged_into_id and is_manually_edited to papers table if not present
ALTER TABLE papers ADD COLUMN merged_into_id TEXT REFERENCES papers(id) ON DELETE SET NULL;
ALTER TABLE papers ADD COLUMN is_manually_edited INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- 2. Paper Identifiers Table (Typed persistent identifier tracking)
CREATE TABLE IF NOT EXISTS paper_identifiers (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL, -- doi, arxiv, pmid, pmcid, openalex, semantic_scholar, url
    canonical_value TEXT NOT NULL,
    raw_value TEXT NOT NULL,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paper_identifiers_lookup ON paper_identifiers(identifier_type, canonical_value);
CREATE INDEX IF NOT EXISTS idx_paper_identifiers_paper ON paper_identifiers(paper_id);

-- 3. Paper Files Table (Local files, streaming cryptographic hashes, and PDF parsing status)
CREATE TABLE IF NOT EXISTS paper_files (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    byte_size INTEGER NOT NULL DEFAULT 0,
    sha256_hash TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified', -- verified, unverified, corrupt, no_text, encrypted, missing, oversized, failed
    page_count INTEGER,
    extracted_title TEXT,
    extracted_author TEXT,
    extracted_text_preview TEXT,
    extracted_text TEXT,
    is_primary INTEGER NOT NULL DEFAULT 1,
    verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paper_files_paper ON paper_files(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_files_hash ON paper_files(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paper_files_status ON paper_files(verification_status);

-- 4. Duplicate Candidates Table (Explainable duplicate detection pairs)
CREATE TABLE IF NOT EXISTS duplicate_candidates (
    id TEXT PRIMARY KEY NOT NULL,
    paper_a_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    paper_b_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    score REAL NOT NULL, -- 0.00 to 1.00
    match_tier TEXT NOT NULL, -- exact_match, high_confidence, review_required, distinct
    evidence_json TEXT NOT NULL DEFAULT '[]', -- Array of human-readable evidence reasons
    status TEXT NOT NULL DEFAULT 'pending', -- pending, merged, kept_separate, deferred
    decision_notes TEXT,
    decided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (paper_a_id, paper_b_id)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_status ON duplicate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_tier ON duplicate_candidates(match_tier);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_paper_a ON duplicate_candidates(paper_a_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_paper_b ON duplicate_candidates(paper_b_id);

-- 5. Paper Merge History Table (Audit trail and undo metadata)
CREATE TABLE IF NOT EXISTS paper_merge_history (
    id TEXT PRIMARY KEY NOT NULL,
    canonical_paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    merged_paper_id TEXT NOT NULL,
    field_decisions_json TEXT NOT NULL DEFAULT '{}',
    preserved_records_json TEXT NOT NULL DEFAULT '{}',
    merged_by TEXT NOT NULL DEFAULT 'user', -- user, auto_pipeline
    merged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merge_history_canonical ON paper_merge_history(canonical_paper_id);

-- 6. Processing Jobs Table (Durable background pipeline tasks)
CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    job_type TEXT NOT NULL, -- metadata_normalization, duplicate_detection, pdf_integrity, batch_pipeline
    status TEXT NOT NULL DEFAULT 'queued', -- queued, running, succeeded, succeeded_with_warnings, failed, cancelled
    total_items INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(job_type);

-- 7. Processing Job Items Table (Per-item tracking with retry and error summaries)
CREATE TABLE IF NOT EXISTS processing_job_items (
    id TEXT PRIMARY KEY NOT NULL,
    job_id TEXT NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- paper, file
    item_id TEXT NOT NULL,
    stage TEXT NOT NULL, -- normalization, deduplication, hash_verification, text_extraction
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, skipped
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    result_summary_json TEXT,
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_processing_job_items_job ON processing_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_processing_job_items_status ON processing_job_items(job_id, status);
