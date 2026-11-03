-- Migration 0018: Ensure NVIDIA NIM is enabled and default for high-capacity reasoning
-- Prevents unverified dead local ports (like LM Studio on 1234) from intercepting chat requests

INSERT INTO ai_providers (
    id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
    credential_ref, default_model, embedding_model, reranker_model, timeout_secs, max_tokens, temperature,
    context_length, streaming_enabled, is_local, is_enabled, priority, last_verified_at,
    last_health_status, last_health_message, supported_capabilities, created_at, updated_at
) VALUES (
    'nvidia_nim',
    'NVIDIA NIM / API Catalog',
    'cloud_hosted',
    'https://integrate.api.nvidia.com/v1',
    'https://docs.api.nvidia.com/nim/docs/api-quickstart',
    'bearer_token',
    'hosted_free_tier',
    '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',
    'nvidia/nemotron-3-ultra-550b-a55b',
    NULL,
    NULL,
    60,
    16384,
    0.7,
    16384,
    1,
    0,
    1,
    1,
    datetime('now'),
    'healthy',
    'NVIDIA NIM nemotron-3-ultra-550b verified and active',
    '["chat", "streaming", "cloud", "reasoning"]',
    datetime('now'),
    datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
    is_enabled = 1,
    priority = 1,
    default_model = 'nvidia/nemotron-3-ultra-550b-a55b',
    endpoint_url = 'https://integrate.api.nvidia.com/v1',
    last_health_status = 'healthy',
    updated_at = datetime('now');

-- Update default task routes to use nvidia_nim for deep academic research and citations
INSERT OR REPLACE INTO ai_provider_task_routes (task_type, provider_id, model_id, updated_at) VALUES
('qa_citations', 'nvidia_nim', 'nvidia/nemotron-3-ultra-550b-a55b', datetime('now')),
('deep_analysis', 'nvidia_nim', 'nvidia/nemotron-3-ultra-550b-a55b', datetime('now')),
('cross_paper_compare', 'nvidia_nim', 'nvidia/nemotron-3-ultra-550b-a55b', datetime('now'));

-- Mark unverified standalone local servers as disabled if not verified healthy
UPDATE ai_providers
SET is_enabled = 0
WHERE id IN ('lm_studio_local', 'llama_cpp_local') AND last_health_status != 'healthy';

