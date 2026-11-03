-- Migration 0010: IMARE Multi-Stage Academic Retrieval Engine State Persistence & Cache
-- SQLite 3 (WAL mode, Foreign Keys ON)

CREATE TABLE IF NOT EXISTS retrieval_state (
    paper_id TEXT PRIMARY KEY NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    query_hash TEXT,
    stage TEXT NOT NULL DEFAULT 'initialized', -- initialized, query_parsed, candidates_generated, verified, ranked, completed, failed
    candidates_json TEXT NOT NULL DEFAULT '[]',
    last_attempt TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_eligible_retry TEXT,
    error_code TEXT,
    is_terminal INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retrieval_state_stage ON retrieval_state(stage);
CREATE INDEX IF NOT EXISTS idx_retrieval_state_next_retry ON retrieval_state(next_eligible_retry);
CREATE INDEX IF NOT EXISTS idx_retrieval_state_expires ON retrieval_state(expires_at);
