-- Migration 0017: Register In-App Local AI Engine as System-Wide Primary Model
-- Bypasses requirement for external Ollama installation, running ultra-low-RAM GGUF sidecar on port 11435

INSERT INTO ai_providers (
    id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
    credential_ref, default_model, embedding_model, reranker_model, timeout_secs, max_tokens, temperature,
    context_length, streaming_enabled, is_local, is_enabled, priority, last_verified_at,
    last_health_status, last_health_message, supported_capabilities, created_at, updated_at
) VALUES (
    'in_app_local',
    'In-App Local AI Engine (Qwen GGUF)',
    'local_runtime',
    'http://127.0.0.1:11435/v1',
    'http://127.0.0.1:11435',
    'none',
    'local',
    NULL,
    'qwen',
    NULL,
    NULL,
    120,
    4096,
    0.7,
    4096,
    1,
    1,
    1,
    0,
    datetime('now'),
    'active',
    'Local low-RAM Qwen sidecar active on port 11435',
    '["chat", "streaming", "local", "low_ram", "academic_polish"]',
    datetime('now'),
    datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
    priority = 0,
    is_enabled = 1,
    endpoint_url = 'http://127.0.0.1:11435/v1',
    updated_at = datetime('now');

-- Update all AI task routes to default to in_app_local
INSERT OR REPLACE INTO ai_provider_task_routes (task_type, provider_id, model_id, updated_at) VALUES
('quick_summary', 'in_app_local', 'qwen', datetime('now')),
('deep_analysis', 'in_app_local', 'qwen', datetime('now')),
('qa_citations', 'in_app_local', 'qwen', datetime('now')),
('cross_paper_compare', 'in_app_local', 'qwen', datetime('now')),
('recommendations', 'in_app_local', 'qwen', datetime('now')),
('project_planning', 'in_app_local', 'qwen', datetime('now')),
('tasks_generation', 'in_app_local', 'qwen', datetime('now')),
('writing_assistant', 'in_app_local', 'qwen', datetime('now')),
('humanizer', 'in_app_local', 'qwen', datetime('now')),
('paraphrase', 'in_app_local', 'qwen', datetime('now'));

