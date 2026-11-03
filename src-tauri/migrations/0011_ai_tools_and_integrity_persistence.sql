-- Migration 0011: AI Tools, Citation Audits & Integrity Persistence
-- Provides SQLite persistence for multi-dimensional research integrity reports,
-- citation audits, DOI resolution caching, background analysis jobs, and writing revisions.

-- 1. Analysis Jobs (Background processing, progress tracking, cancellation)
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'integrity_audit', 'citation_audit', 'readability_analysis', 'ai_signal_detection'
    document_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed', 'cancelled'
    progress_pct INTEGER NOT NULL DEFAULT 0,
    current_step TEXT,
    result_json TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_doc ON analysis_jobs(document_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);

-- 2. Saved Integrity Reports
CREATE TABLE IF NOT EXISTS saved_integrity_reports (
    id TEXT PRIMARY KEY,
    document_hash TEXT NOT NULL,
    file_name TEXT NOT NULL,
    title TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    dimensions_json TEXT NOT NULL DEFAULT '{}',
    ethical_disclaimer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_integrity_reports_hash ON saved_integrity_reports(document_hash);
CREATE INDEX IF NOT EXISTS idx_saved_integrity_reports_created ON saved_integrity_reports(created_at DESC);

-- 3. Integrity Report Findings
CREATE TABLE IF NOT EXISTS integrity_report_findings (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES saved_integrity_reports(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL, -- 'verified', 'concern', 'technical_error', 'inconclusive', 'reviewed'
    severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
    confidence TEXT NOT NULL,
    evidence TEXT NOT NULL,
    location TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    is_reviewed INTEGER NOT NULL DEFAULT 0,
    reviewed_at TEXT,
    reviewer_notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrity_findings_report ON integrity_report_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_integrity_findings_dim ON integrity_report_findings(dimension);
CREATE INDEX IF NOT EXISTS idx_integrity_findings_status ON integrity_report_findings(status);

-- 4. Citation Audits Persistence
CREATE TABLE IF NOT EXISTS citation_audits (
    id TEXT PRIMARY KEY,
    document_hash TEXT NOT NULL,
    document_title TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT 'manuscript.txt',
    total_in_text INTEGER NOT NULL DEFAULT 0,
    total_references INTEGER NOT NULL DEFAULT 0,
    matched_citations INTEGER NOT NULL DEFAULT 0,
    health_score INTEGER NOT NULL DEFAULT 100,
    summary_json TEXT NOT NULL DEFAULT '{}',
    issues_json TEXT NOT NULL DEFAULT '[]',
    references_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_citation_audits_hash ON citation_audits(document_hash);
CREATE INDEX IF NOT EXISTS idx_citation_audits_created ON citation_audits(created_at DESC);

-- 5. Readability Reports Persistence
CREATE TABLE IF NOT EXISTS readability_reports (
    id TEXT PRIMARY KEY,
    document_hash TEXT NOT NULL,
    document_title TEXT NOT NULL,
    language_code TEXT NOT NULL DEFAULT 'en',
    word_count INTEGER NOT NULL DEFAULT 0,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    flesch_reading_ease REAL NOT NULL DEFAULT 0.0,
    flesch_kincaid_grade REAL NOT NULL DEFAULT 0.0,
    gunning_fog_index REAL NOT NULL DEFAULT 0.0,
    metrics_json TEXT NOT NULL DEFAULT '{}',
    vocabulary_json TEXT NOT NULL DEFAULT '{}',
    paragraphs_json TEXT NOT NULL DEFAULT '[]',
    recommendations_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readability_reports_hash ON readability_reports(document_hash);

-- 6. DOI Canonical Cache (Prevents duplicate remote lookups)
CREATE TABLE IF NOT EXISTS doi_cache (
    doi TEXT PRIMARY KEY,
    canonical_doi TEXT NOT NULL,
    is_valid INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    last_verified_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doi_cache_expires ON doi_cache(expires_at);

