-- Migration 0006: IEEE Open Access Manual Import & Strict Open Access Policy Workflow
-- SQLite 3 (WAL mode, Foreign Keys ON)

-- 1. Extend papers table with strict Open Access policy and provenance fields
ALTER TABLE papers ADD COLUMN open_access_status TEXT NOT NULL DEFAULT 'pending_verification'; -- verified_open_access, user_confirmed_open_access, pending_verification, not_open_access, access_denied
ALTER TABLE papers ADD COLUMN access_evidence_type TEXT NOT NULL DEFAULT 'unknown'; -- user_confirmation, explicit_source_label, license_metadata, repository_policy, unknown
ALTER TABLE papers ADD COLUMN access_evidence_note TEXT;
ALTER TABLE papers ADD COLUMN license_name TEXT;
ALTER TABLE papers ADD COLUMN license_url TEXT;
ALTER TABLE papers ADD COLUMN source_name TEXT;
ALTER TABLE papers ADD COLUMN retrieval_method TEXT NOT NULL DEFAULT 'local_file_import'; -- ieee_manual_download_import, permitted_html_connector, local_file_import
ALTER TABLE papers ADD COLUMN access_confirmed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_papers_oa_status ON papers(open_access_status);
CREATE INDEX IF NOT EXISTS idx_papers_retrieval_method ON papers(retrieval_method);

-- 2. Backfill existing open-access records
UPDATE papers SET open_access_status = 'verified_open_access', access_evidence_type = 'explicit_source_label' WHERE is_open_access = 1;
