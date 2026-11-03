-- Phase 16: Download Manager & PDF Acquisition Engine Modernization
-- Schema Version: 14

-- 1. Enhance download_jobs with throughput tracking, timestamps, and error taxonomy
ALTER TABLE download_jobs ADD COLUMN speed_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE download_jobs ADD COLUMN started_at TEXT;
ALTER TABLE download_jobs ADD COLUMN completed_at TEXT;
ALTER TABLE download_jobs ADD COLUMN error_category TEXT;

CREATE INDEX IF NOT EXISTS idx_download_jobs_error_category ON download_jobs(error_category);
CREATE INDEX IF NOT EXISTS idx_download_jobs_speed ON download_jobs(speed_bps);

