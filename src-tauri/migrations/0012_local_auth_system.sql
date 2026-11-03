-- Migration 0012: Local Authentication System & User Data Protection
-- Offline-first, secure user authentication with Argon2id password hashing,
-- session control, application locking, and user-scoped data protection.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    auto_lock_timeout_minutes INTEGER NOT NULL DEFAULT 10,
    remember_me INTEGER NOT NULL DEFAULT 0,
    theme TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- User-scoped data columns for research data protection (preserving existing data)
ALTER TABLE papers ADD COLUMN owner_id TEXT;
ALTER TABLE collections ADD COLUMN owner_id TEXT;
ALTER TABLE notes ADD COLUMN owner_id TEXT;
ALTER TABLE matrix_workspaces ADD COLUMN owner_id TEXT;
ALTER TABLE saved_integrity_reports ADD COLUMN owner_id TEXT;
ALTER TABLE citation_audits ADD COLUMN owner_id TEXT;
ALTER TABLE readability_reports ADD COLUMN owner_id TEXT;
ALTER TABLE writing_sessions ADD COLUMN owner_id TEXT;
ALTER TABLE writing_revisions ADD COLUMN owner_id TEXT;
ALTER TABLE download_jobs ADD COLUMN owner_id TEXT;
ALTER TABLE analysis_jobs ADD COLUMN owner_id TEXT;

