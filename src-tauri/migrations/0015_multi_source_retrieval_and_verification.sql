-- Phase 17: Multi-Source Paper Fetching, Alternative Full-Text Discovery, and Document Identity Verification
-- Schema Version: 15

-- 1. Enhance pdf_candidates with academic version taxonomy and identity verification scores
ALTER TABLE pdf_candidates ADD COLUMN version_type TEXT DEFAULT 'unknown_version';
ALTER TABLE pdf_candidates ADD COLUMN identity_status TEXT DEFAULT 'unknown';
ALTER TABLE pdf_candidates ADD COLUMN identity_score REAL DEFAULT 0.0;
ALTER TABLE pdf_candidates ADD COLUMN provenance_json TEXT;

-- 2. Enhance download_jobs with identity verification lifecycle tracking
ALTER TABLE download_jobs ADD COLUMN version_type TEXT DEFAULT 'unknown_version';
ALTER TABLE download_jobs ADD COLUMN identity_status TEXT DEFAULT 'unknown';
ALTER TABLE download_jobs ADD COLUMN identity_score REAL DEFAULT 0.0;
ALTER TABLE download_jobs ADD COLUMN identity_notes TEXT;

-- 3. Enhance paper_files with version categorization and document reconciliation data
ALTER TABLE paper_files ADD COLUMN version_type TEXT DEFAULT 'unknown_version';
ALTER TABLE paper_files ADD COLUMN identity_status TEXT DEFAULT 'unknown';
ALTER TABLE paper_files ADD COLUMN identity_score REAL DEFAULT 0.0;
ALTER TABLE paper_files ADD COLUMN identity_notes TEXT;

-- 4. Enhance papers table with primary PDF version and verification status
ALTER TABLE papers ADD COLUMN pdf_version_type TEXT DEFAULT 'unknown_version';
ALTER TABLE papers ADD COLUMN pdf_identity_status TEXT DEFAULT 'unknown';
ALTER TABLE papers ADD COLUMN pdf_identity_score REAL DEFAULT 0.0;

-- 5. Indexes for fast filtering and diagnostics
CREATE INDEX IF NOT EXISTS idx_pdf_candidates_version ON pdf_candidates(version_type);
CREATE INDEX IF NOT EXISTS idx_pdf_candidates_identity ON pdf_candidates(identity_status);
CREATE INDEX IF NOT EXISTS idx_download_jobs_version ON download_jobs(version_type);
CREATE INDEX IF NOT EXISTS idx_download_jobs_identity ON download_jobs(identity_status);
CREATE INDEX IF NOT EXISTS idx_paper_files_version ON paper_files(version_type);
CREATE INDEX IF NOT EXISTS idx_papers_pdf_version ON papers(pdf_version_type);

