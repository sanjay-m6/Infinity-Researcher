-- Migration 0009: Literature Review Matrix & Evidence-Linked Copilot
-- Supports multi-paper extraction tables, claim-to-page evidence linking, custom dimensions, and evidence-grounded QA sessions.

CREATE TABLE IF NOT EXISTS matrix_workspaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    columns_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matrix_workspace_papers (
    workspace_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, paper_id),
    FOREIGN KEY (workspace_id) REFERENCES matrix_workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matrix_extractions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    extracted_value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    page_number INTEGER,
    char_offset_start INTEGER,
    char_offset_end INTEGER,
    source_passage TEXT,
    status TEXT NOT NULL DEFAULT 'extracted',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (workspace_id, paper_id, field_key),
    FOREIGN KEY (workspace_id) REFERENCES matrix_workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matrix_extractions_paper ON matrix_extractions(paper_id);
CREATE INDEX IF NOT EXISTS idx_matrix_extractions_field ON matrix_extractions(workspace_id, field_key);

CREATE TABLE IF NOT EXISTS evidence_copilot_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_scope TEXT NOT NULL DEFAULT 'single_paper',
    target_paper_id TEXT,
    workspace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_copilot_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    evidence_sources_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES evidence_copilot_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_session ON evidence_copilot_messages(session_id);

-- Seed default initial literature review workspace
INSERT OR IGNORE INTO matrix_workspaces (id, title, description, columns_json, created_at, updated_at)
VALUES (
    'default_matrix',
    'Main Literature Review Matrix',
    'Comprehensive multi-paper comparison matrix capturing objectives, methods, datasets, sample sizes, metrics, findings, and limitations.',
    '[
        {"key": "research_question", "label": "Research Question", "type": "text", "required": true, "width": 240},
        {"key": "methodology", "label": "Methodology", "type": "text", "required": true, "width": 220},
        {"key": "dataset", "label": "Dataset / Benchmark", "type": "text", "required": false, "width": 180},
        {"key": "sample_size", "label": "Sample Size", "type": "text", "required": false, "width": 130},
        {"key": "model_architecture", "label": "Model / Architecture", "type": "text", "required": false, "width": 190},
        {"key": "eval_metrics", "label": "Key Metrics", "type": "text", "required": false, "width": 160},
        {"key": "main_findings", "label": "Main Findings", "type": "text", "required": true, "width": 260},
        {"key": "limitations", "label": "Limitations", "type": "text", "required": false, "width": 200},
        {"key": "future_work", "label": "Future Work", "type": "text", "required": false, "width": 180}
    ]',
    datetime('now'),
    datetime('now')
);
