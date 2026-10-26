-- Migration 0008: Research Integrity & Academic Writing Suite
-- Provides local persistence for document ingestion, segments, local corpus indexing,
-- winnowing fingerprints, similarity runs and reviews, AI-writing signals, and writing revisions.

CREATE TABLE IF NOT EXISTS integrity_documents (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL, -- 'file', 'library_paper', 'pasted_text'
    source_reference TEXT,     -- file path or library paper id
    file_hash TEXT NOT NULL,   -- SHA-256 hash of raw content
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL, -- 'pdf', 'docx', 'txt', 'tex', 'raw'
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    raw_content TEXT NOT NULL,
    normalized_content TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    extraction_metadata TEXT,  -- JSON string of warnings, OCR flag, extraction tool
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_segments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES integrity_documents(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    segment_type TEXT NOT NULL, -- 'paragraph', 'section_heading', 'abstract', 'methodology', 'results', 'discussion', 'references', 'boilerplate'
    raw_text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    char_start INTEGER NOT NULL,
    char_end INTEGER NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    embedding_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corpus_sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL, -- 'library_paper', 'local_folder', 'imported_file', 'external_open_access'
    source_ref TEXT,
    title TEXT NOT NULL,
    authors TEXT,
    venue TEXT,
    year INTEGER,
    doi TEXT,
    canonical_url TEXT,
    file_path TEXT,
    content_hash TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    fingerprint_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    indexed_at TEXT NOT NULL,
    last_error TEXT
);

CREATE TABLE IF NOT EXISTS corpus_fingerprints (
    hash_value INTEGER NOT NULL,
    corpus_source_id TEXT NOT NULL REFERENCES corpus_sources(id) ON DELETE CASCADE,
    char_offset INTEGER NOT NULL,
    PRIMARY KEY (hash_value, corpus_source_id, char_offset)
);

CREATE TABLE IF NOT EXISTS similarity_runs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES integrity_documents(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'queued', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled'
    total_body_words INTEGER NOT NULL DEFAULT 0,
    matched_body_words INTEGER NOT NULL DEFAULT 0,
    overall_similarity_ratio REAL NOT NULL DEFAULT 0.0,
    corpus_sources_searched INTEGER NOT NULL DEFAULT 0,
    matched_sources_count INTEGER NOT NULL DEFAULT 0,
    matches_count INTEGER NOT NULL DEFAULT 0,
    execution_duration_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS similarity_matches (
    id TEXT PRIMARY KEY,
    similarity_run_id TEXT NOT NULL REFERENCES similarity_runs(id) ON DELETE CASCADE,
    corpus_source_id TEXT NOT NULL REFERENCES corpus_sources(id) ON DELETE CASCADE,
    match_type TEXT NOT NULL, -- 'exact', 'fingerprint', 'fuzzy', 'semantic_candidate'
    target_char_start INTEGER NOT NULL,
    target_char_end INTEGER NOT NULL,
    target_page_number INTEGER NOT NULL DEFAULT 1,
    target_passage TEXT NOT NULL,
    source_char_start INTEGER NOT NULL DEFAULT 0,
    source_char_end INTEGER NOT NULL DEFAULT 0,
    source_page_number INTEGER NOT NULL DEFAULT 1,
    source_passage TEXT NOT NULL,
    overlap_chars INTEGER NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 1.0,
    review_status TEXT NOT NULL DEFAULT 'unreviewed', -- 'unreviewed', 'marked_quote', 'citation_present', 'excluded_boilerplate', 'not_a_match'
    review_notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_signal_runs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES integrity_documents(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    inference_mode TEXT NOT NULL, -- 'local', 'remote'
    status TEXT NOT NULL, -- 'not_run', 'insufficient_text', 'running', 'completed', 'experimental', 'model_unavailable', 'failed'
    overall_signal_score REAL,
    signal_classification TEXT NOT NULL, -- 'unsupported', 'insufficient_text', 'low_ai_signal', 'mixed_signals', 'elevated_ai_signal'
    analyzed_characters INTEGER NOT NULL DEFAULT 0,
    analyzed_paragraphs INTEGER NOT NULL DEFAULT 0,
    uncertainty_caveat TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_signal_segments (
    id TEXT PRIMARY KEY,
    ai_signal_run_id TEXT NOT NULL REFERENCES ai_signal_runs(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL REFERENCES document_segments(id) ON DELETE CASCADE,
    paragraph_index INTEGER NOT NULL,
    score REAL NOT NULL,
    classification TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS writing_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES integrity_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    active_mode TEXT NOT NULL DEFAULT 'clarity',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS writing_revisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL DEFAULT 1,
    action_type TEXT NOT NULL,
    original_text TEXT NOT NULL,
    revised_text TEXT NOT NULL,
    diff_summary TEXT NOT NULL,
    preserved_numbers_ok INTEGER NOT NULL DEFAULT 1,
    preserved_citations_ok INTEGER NOT NULL DEFAULT 1,
    preserved_equations_ok INTEGER NOT NULL DEFAULT 1,
    preserved_dois_ok INTEGER NOT NULL DEFAULT 1,
    meaning_risk_flags TEXT,
    is_accepted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_registry (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    task_type TEXT NOT NULL, -- 'embedding', 'ai_signal_classifier', 'writing_assistant'
    hf_repo_id TEXT,
    revision TEXT,
    license TEXT NOT NULL,
    is_local INTEGER NOT NULL DEFAULT 1,
    is_available INTEGER NOT NULL DEFAULT 0,
    size_mb INTEGER NOT NULL DEFAULT 0,
    evaluation_summary TEXT,
    created_at TEXT NOT NULL
);

-- Seed initial model metadata
INSERT OR IGNORE INTO model_registry (id, model_name, task_type, hf_repo_id, revision, license, is_local, is_available, size_mb, evaluation_summary, created_at)
VALUES 
('all-minilm-l6-v2', 'MiniLM L6 v2 (Semantic Retrieval)', 'embedding', 'sentence-transformers/all-MiniLM-L6-v2', 'e4ce9877abf3ed59ced85d227e74ce20d01f49e6', 'Apache-2.0', 1, 1, 90, 'Evaluated for academic paragraph candidate retrieval. 384 dimensions.', datetime('now')),
('roberta-openai-detector', 'RoBERTa Origin Signal (Experimental)', 'ai_signal_classifier', 'openai-community/roberta-base-openai-detector', 'main', 'MIT', 1, 0, 498, 'Trained on GPT-2 outputs. Not calibrated for modern LLMs or academic prose; flagged experimental.', datetime('now')),
('academic-assistant-local', 'Local Academic Style Assistant', 'writing_assistant', 'local-rule-engine', '1.0.0', 'MIT', 1, 1, 0, 'Deterministic academic tone, transition, and clarity enhancer preserving numbers and citations.', datetime('now'));

-- Indexing for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_corpus_fingerprints_hash ON corpus_fingerprints(hash_value);
CREATE INDEX IF NOT EXISTS idx_corpus_fingerprints_source ON corpus_fingerprints(corpus_source_id);
CREATE INDEX IF NOT EXISTS idx_document_segments_doc ON document_segments(document_id);
CREATE INDEX IF NOT EXISTS idx_similarity_runs_doc ON similarity_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_similarity_matches_run ON similarity_matches(similarity_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_signal_runs_doc ON ai_signal_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_doc ON writing_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_writing_revisions_sess ON writing_revisions(session_id);
