-- Migration 0007: AI Workspace, Provider Registry, Section Chunks, Shared RAG, Recommendations, and Evaluations
-- SQLite 3 (WAL mode, Foreign Keys ON, FTS5)

-- 1. AI Provider Catalog Table (Non-secret metadata)
CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,                  -- 'local_runtime', 'cloud_hosted', 'custom_endpoint'
    endpoint_url TEXT NOT NULL,
    doc_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'none',  -- 'none', 'api_key', 'bearer_token', 'custom_header'
    access_category TEXT NOT NULL DEFAULT 'local', -- 'local', 'hosted_free_tier', 'hosted_free_models', 'trial_or_credit', 'paid', 'self_hosted'
    credential_ref TEXT,                     -- Opaque secure reference or masked token; never plaintext secret
    default_model TEXT NOT NULL,
    embedding_model TEXT,
    reranker_model TEXT,
    timeout_secs INTEGER NOT NULL DEFAULT 30,
    max_tokens INTEGER NOT NULL DEFAULT 4096,
    temperature REAL NOT NULL DEFAULT 0.2,
    context_length INTEGER NOT NULL DEFAULT 8192,
    streaming_enabled INTEGER NOT NULL DEFAULT 1,
    is_local INTEGER NOT NULL DEFAULT 1,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 10,
    last_verified_at TEXT NOT NULL,
    last_health_status TEXT NOT NULL DEFAULT 'untested',
    last_health_message TEXT,
    supported_capabilities TEXT NOT NULL DEFAULT '["chat", "streaming"]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_category ON ai_providers(category);
CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled ON ai_providers(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_providers_is_local ON ai_providers(is_local);

-- 2. AI Task Route Mappings (Which provider/model serves which research task)
CREATE TABLE IF NOT EXISTS ai_provider_task_routes (
    task_type TEXT PRIMARY KEY NOT NULL,     -- 'quick_summary', 'deep_analysis', 'qa_citations', 'cross_paper_compare', 'recommendations', 'embeddings', 'reranking', 'ocr_vision', 'local_private'
    provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Paper Section Chunks Table (Page-level and section-level RAG units)
CREATE TABLE IF NOT EXISTS ai_paper_chunks (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    section_heading TEXT,
    content_text TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding_json TEXT,                     -- JSON array of float dimensions when vector embedding computed
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_paper ON ai_paper_chunks(paper_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_page ON ai_paper_chunks(paper_id, page_number);

-- 4. In-Document Passage FTS5 Table for BM25 Lexical Hybrid Retrieval
CREATE VIRTUAL TABLE IF NOT EXISTS ai_chunks_fts USING fts5(
    chunk_id UNINDEXED,
    paper_id UNINDEXED,
    page_number UNINDEXED,
    section_heading,
    content_text,
    tokenize = 'unicode61 remove_diacritics 1'
);

CREATE TRIGGER IF NOT EXISTS trg_ai_chunks_insert
AFTER INSERT ON ai_paper_chunks
BEGIN
    INSERT INTO ai_chunks_fts (chunk_id, paper_id, page_number, section_heading, content_text)
    VALUES (NEW.id, NEW.paper_id, NEW.page_number, coalesce(NEW.section_heading, ''), NEW.content_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_chunks_update
AFTER UPDATE OF content_text, section_heading ON ai_paper_chunks
BEGIN
    DELETE FROM ai_chunks_fts WHERE chunk_id = OLD.id;
    INSERT INTO ai_chunks_fts (chunk_id, paper_id, page_number, section_heading, content_text)
    VALUES (NEW.id, NEW.paper_id, NEW.page_number, coalesce(NEW.section_heading, ''), NEW.content_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_chunks_delete
AFTER DELETE ON ai_paper_chunks
BEGIN
    DELETE FROM ai_chunks_fts WHERE chunk_id = OLD.id;
END;

-- 5. AI Research Chat Sessions and Messages
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
    role TEXT NOT NULL,                      -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations_json TEXT,                     -- JSON array of cited {paper_id, title, page_number, section_heading, quote}
    provider_id TEXT,
    model_id TEXT,
    retrieval_mode TEXT NOT NULL DEFAULT 'paper', -- 'paper', 'library', 'none'
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_paper ON ai_chat_messages(paper_id);

-- 6. Research Recommendations and User Preference Feedback
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    recommended_paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    score REAL NOT NULL DEFAULT 0.0,
    reason TEXT NOT NULL,
    matched_concepts_json TEXT,              -- JSON array of shared topics/methods
    confidence_label TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'exploratory'
    recommendation_mode TEXT NOT NULL DEFAULT 'next_paper',
    feedback_status TEXT NOT NULL DEFAULT 'none',    -- 'none', 'saved', 'dismissed', 'not_relevant'
    feedback_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (paper_id, recommended_paper_id, recommendation_mode)
);

CREATE INDEX IF NOT EXISTS idx_ai_recs_paper ON ai_recommendations(paper_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_feedback ON ai_recommendations(feedback_status);

-- 7. Local AI Evaluation Center Benchmarks & Logs
CREATE TABLE IF NOT EXISTS ai_evaluation_results (
    id TEXT PRIMARY KEY NOT NULL,
    benchmark_suite TEXT NOT NULL,           -- 'qa_citations', 'summarization', 'extraction', 'abstention'
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    total_tests INTEGER NOT NULL,
    passed_tests INTEGER NOT NULL,
    citation_accuracy REAL NOT NULL DEFAULT 0.0,
    abstention_accuracy REAL NOT NULL DEFAULT 0.0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    details_json TEXT,
    evaluated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_provider ON ai_evaluation_results(provider_id);

-- 8. Optional Local Fine-Tuning Workspace (PEFT / LoRA Job Tracking)
CREATE TABLE IF NOT EXISTS ai_finetuning_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    model_name TEXT NOT NULL,
    adapter_name TEXT NOT NULL,
    hardware_check_json TEXT NOT NULL,       -- RAM, GPU, VRAM, Disk requirements & available
    dataset_size INTEGER NOT NULL DEFAULT 0,
    train_val_split_ratio REAL NOT NULL DEFAULT 0.8,
    epochs INTEGER NOT NULL DEFAULT 3,
    learning_rate REAL NOT NULL DEFAULT 0.0002,
    status TEXT NOT NULL DEFAULT 'draft',    -- 'draft', 'ready', 'running', 'completed', 'failed', 'cancelled'
    progress_percent REAL NOT NULL DEFAULT 0.0,
    stage_message TEXT,
    adapter_path TEXT,
    eval_loss REAL,
    model_card_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 9. AI Global Configuration & Privacy Switches
CREATE TABLE IF NOT EXISTS ai_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Seed Initial Default Privacy Settings
INSERT OR IGNORE INTO ai_settings (key, value, updated_at) VALUES
('local_only_mode', 'false', datetime('now')),
('never_use_paid_apis', 'true', datetime('now')),
('cloud_paper_sharing_enabled', 'false', datetime('now')),
('active_rag_scope', 'paper', datetime('now')),
('default_audience_level', 'researcher', datetime('now')),
('recommendations_diversity_weight', '0.3', datetime('now'));

-- Seed Initial Provider Catalog (Verified Metadata & Documentation Links)
INSERT OR IGNORE INTO ai_providers (
    id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
    default_model, embedding_model, reranker_model, timeout_secs, max_tokens, temperature,
    context_length, streaming_enabled, is_local, is_enabled, priority, last_verified_at,
    last_health_status, supported_capabilities, created_at, updated_at
) VALUES
('ollama_local', 'Ollama Local Runtime', 'local_runtime', 'http://127.0.0.1:11434', 'https://docs.ollama.com/api', 'none', 'local', 'llama3.2:latest', 'nomic-embed-text:latest', NULL, 60, 4096, 0.2, 8192, 1, 1, 1, 1, '2026-10-25', 'untested', '["chat", "streaming", "embeddings", "local"]', datetime('now'), datetime('now')),
('lm_studio_local', 'LM Studio Local Server', 'local_runtime', 'http://127.0.0.1:1234/v1', 'https://lmstudio.ai/docs/developer/core/server', 'none', 'local', 'default', NULL, NULL, 60, 4096, 0.2, 8192, 1, 1, 1, 2, '2026-10-25', 'untested', '["chat", "streaming", "local"]', datetime('now'), datetime('now')),
('llama_cpp_local', 'llama.cpp Server', 'local_runtime', 'http://127.0.0.1:8080/v1', 'https://github.com/ggerganov/llama.cpp', 'none', 'local', 'default', NULL, NULL, 60, 4096, 0.2, 8192, 1, 1, 0, 3, '2026-10-25', 'untested', '["chat", "streaming", "local"]', datetime('now'), datetime('now')),
('generic_openai_endpoint', 'Custom OpenAI-Compatible Endpoint', 'custom_endpoint', 'http://127.0.0.1:8000/v1', 'https://developers.openai.com/api/docs/', 'api_key', 'self_hosted', 'default', NULL, NULL, 60, 4096, 0.2, 8192, 1, 1, 0, 4, '2026-10-25', 'untested', '["chat", "streaming"]', datetime('now'), datetime('now')),
('nvidia_nim', 'NVIDIA NIM / API Catalog', 'cloud_hosted', 'https://integrate.api.nvidia.com/v1', 'https://docs.api.nvidia.com/nim/docs/api-quickstart', 'bearer_token', 'hosted_free_tier', 'meta/llama-3.1-70b-instruct', NULL, NULL, 45, 4096, 0.2, 16384, 1, 0, 1, 5, '2026-10-25', 'untested', '["chat", "streaming", "open_weight"]', datetime('now'), datetime('now')),
('groqcloud', 'GroqCloud', 'cloud_hosted', 'https://api.groq.com/openai/v1', 'https://console.groq.com/docs', 'api_key', 'hosted_free_tier', 'llama-3.3-70b-versatile', NULL, NULL, 30, 8192, 0.2, 32768, 1, 0, 1, 6, '2026-10-25', 'untested', '["chat", "streaming", "open_weight"]', datetime('now'), datetime('now')),
('cerebras', 'Cerebras Inference', 'cloud_hosted', 'https://api.cerebras.ai/v1', 'https://inference-docs.cerebras.ai/', 'api_key', 'hosted_free_tier', 'llama3.1-70b', NULL, NULL, 30, 4096, 0.2, 8192, 1, 0, 1, 7, '2026-10-25', 'untested', '["chat", "streaming", "open_weight"]', datetime('now'), datetime('now')),
('huggingface_inference', 'Hugging Face Inference Providers', 'cloud_hosted', 'https://api-inference.huggingface.co/v1', 'https://huggingface.co/docs/inference-providers/index', 'bearer_token', 'trial_or_credit', 'meta-llama/Llama-3.2-3B-Instruct', NULL, NULL, 45, 4096, 0.2, 8192, 1, 0, 0, 8, '2026-10-25', 'untested', '["chat", "streaming", "open_weight"]', datetime('now'), datetime('now')),
('openrouter', 'OpenRouter (Free Models)', 'cloud_hosted', 'https://openrouter.ai/api/v1', 'https://openrouter.ai/docs', 'api_key', 'hosted_free_models', 'meta-llama/llama-3.2-3b-instruct:free', NULL, NULL, 45, 4096, 0.2, 16384, 1, 0, 1, 9, '2026-10-25', 'untested', '["chat", "streaming", "free_route"]', datetime('now'), datetime('now')),
('gemini', 'Google Gemini Developer API', 'cloud_hosted', 'https://generativelanguage.googleapis.com/v1beta/openai', 'https://ai.google.dev/gemini-api/docs', 'api_key', 'hosted_free_tier', 'gemini-2.0-flash-exp', NULL, NULL, 45, 8192, 0.2, 32768, 1, 0, 1, 10, '2026-10-25', 'untested', '["chat", "streaming", "vision"]', datetime('now'), datetime('now')),
('cloudflare_workers_ai', 'Cloudflare Workers AI', 'cloud_hosted', 'https://api.cloudflare.com/client/v4', 'https://developers.cloudflare.com/workers-ai/', 'bearer_token', 'hosted_free_tier', '@cf/meta/llama-3-8b-instruct', NULL, NULL, 45, 4096, 0.2, 8192, 1, 0, 0, 11, '2026-10-25', 'untested', '["chat", "streaming", "open_weight"]', datetime('now'), datetime('now')),
('openai', 'OpenAI', 'cloud_hosted', 'https://api.openai.com/v1', 'https://developers.openai.com/api/docs/', 'api_key', 'paid', 'gpt-4o-mini', 'text-embedding-3-small', NULL, 45, 4096, 0.2, 16384, 1, 0, 0, 20, '2026-10-25', 'untested', '["chat", "streaming", "embeddings"]', datetime('now'), datetime('now')),
('anthropic', 'Anthropic Claude', 'cloud_hosted', 'https://api.anthropic.com', 'https://platform.claude.com/docs/en/api/overview', 'api_key', 'paid', 'claude-3-5-haiku-latest', NULL, NULL, 45, 4096, 0.2, 16384, 1, 0, 0, 21, '2026-10-25', 'untested', '["chat", "streaming"]', datetime('now'), datetime('now'));

-- Seed Default Task Route Mappings
INSERT OR IGNORE INTO ai_provider_task_routes (task_type, provider_id, model_id, updated_at) VALUES
('quick_summary', 'ollama_local', 'llama3.2:latest', datetime('now')),
('deep_analysis', 'ollama_local', 'llama3.2:latest', datetime('now')),
('qa_citations', 'ollama_local', 'llama3.2:latest', datetime('now')),
('cross_paper_compare', 'ollama_local', 'llama3.2:latest', datetime('now')),
('recommendations', 'ollama_local', 'llama3.2:latest', datetime('now')),
('embeddings', 'ollama_local', 'nomic-embed-text:latest', datetime('now'));

