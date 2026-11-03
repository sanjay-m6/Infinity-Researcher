# Infinity Researcher — Current AI Model & Provider Inventory

**Date:** 2026-10-29  
**Version:** 0.1.0  
**Scope:** Configured AI Providers, Task Routing, Models, Privacy Guards, and Failure Modes

---

## 1. Provider Catalog

The application maintains an extensible provider registry in SQLite (`ai_providers` table created in Migration 0007). All providers are inspected and dispatched through Rust in `src-tauri/src/services/ai_provider_service.rs`.

| Provider ID | Display Name | Category | Access Tier | Default Model | Embedding Model | Context Window | Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ollama_local` | Ollama Local Runtime | `local_runtime` | `local` | `llama3.2:latest` | `nomic-embed-text:latest` | 8,192 | `["chat", "streaming", "embeddings", "local"]` |
| `lm_studio_local` | LM Studio Local Server | `local_runtime` | `local` | `default` | None | 8,192 | `["chat", "streaming", "local"]` |
| `llama_cpp_local` | llama.cpp Server | `local_runtime` | `local` | `default` | None | 8,192 | `["chat", "streaming", "local"]` |
| `generic_openai_endpoint`| Custom OpenAI-Compatible | `custom_endpoint`| `self_hosted`| `default` | None | 8,192 | `["chat", "streaming"]` |
| `nvidia_nim` | NVIDIA NIM / API Catalog | `cloud_hosted` | `hosted_free_tier` | `meta/llama-3.1-70b-instruct` | None | 16,384 | `["chat", "streaming", "open_weight"]` |
| `groqcloud` | GroqCloud | `cloud_hosted` | `hosted_free_tier` | `llama-3.3-70b-versatile` | None | 32,768 | `["chat", "streaming", "open_weight"]` |
| `cerebras` | Cerebras Inference | `cloud_hosted` | `hosted_free_tier` | `llama3.1-70b` | None | 8,192 | `["chat", "streaming", "open_weight"]` |
| `huggingface_inference` | Hugging Face Providers | `cloud_hosted` | `trial_or_credit` | `meta-llama/Llama-3.2-3B-Instruct` | None | 8,192 | `["chat", "streaming", "open_weight"]` |
| `openrouter` | OpenRouter (Free Tier) | `cloud_hosted` | `hosted_free_models`| `meta-llama/llama-3.2-3b-instruct:free` | None | 16,384 | `["chat", "streaming", "free_route"]` |
| `gemini` | Google Gemini Developer API| `cloud_hosted` | `hosted_free_tier` | `gemini-2.0-flash-exp` | None | 32,768 | `["chat", "streaming", "vision"]` |
| `cloudflare_workers_ai`| Cloudflare Workers AI | `cloud_hosted` | `hosted_free_tier` | `@cf/meta/llama-3-8b-instruct` | None | 8,192 | `["chat", "streaming", "open_weight"]` |
| `openai` | OpenAI | `cloud_hosted` | `paid` | `gpt-4o-mini` | `text-embedding-3-small` | 16,384 | `["chat", "streaming", "embeddings"]` |
| `anthropic` | Anthropic Claude | `cloud_hosted` | `paid` | `claude-3-5-haiku-latest` | None | 16,384 | `["chat", "streaming"]` |

---

## 2. Default Task Routing Matrix

Configured in `ai_provider_task_routes` (Migration 0007):

| Task Type | Assigned Provider | Assigned Model | Fallback Strategy |
| :--- | :--- | :--- | :--- |
| `quick_summary` | `ollama_local` | `llama3.2:latest` | `lm_studio_local` -> Local private notice |
| `deep_analysis` | `ollama_local` | `llama3.2:latest` | `groqcloud` (only if cloud sharing enabled) |
| `qa_citations` | `ollama_local` | `llama3.2:latest` | Grounded passages only; no ungrounded hallucination |
| `cross_paper_compare`| `ollama_local` | `llama3.2:latest` | Structured extraction across multiple papers |
| `recommendations` | `ollama_local` | `llama3.2:latest` | Deterministic BM25 / concept overlap |
| `embeddings` | `ollama_local` | `nomic-embed-text:latest` | Lexical FTS5 fallback if embedding unavailable |

---

## 3. Privacy Guards & Enforced Constraints

Enforced in Rust by `AiProviderService::verify_privacy_guards()` before any socket or HTTP request is initiated:

1. **Local-Only Mode (`local_only_mode = true`)**:
   - If enabled in `ai_settings`, any outbound request to a provider where `is_local == false` is immediately aborted with `AppError::Validation("Local-only mode is active in AI Settings. All outbound cloud requests are strictly blocked.")`.
2. **Paid API Guard (`never_use_paid_apis = true`)**:
   - Blocks providers marked with `access_category == "paid"` (e.g., paid OpenAI or Anthropic endpoints) to prevent unexpected usage charges.
3. **Paper Content Privacy (`cloud_paper_sharing_enabled = false`)**:
   - If paper excerpts or full texts are included in the request payload and `is_local == false`, the request is blocked unless explicit user consent has been saved.

---

## 4. Current Failure Modes & Handling

1. **Local Runtime Unreachable**:
   - When Ollama or LM Studio is not running, `test_connection` reports `disconnected` with actionable troubleshooting steps ("Check if `ollama serve` is running on port 11434").
2. **Context Window Exceeded**:
   - Long research papers (20+ pages) exceed 8k token windows if unchunked. Current mitigation: `AiRagService` chunks text into ~300-token blocks with 150-char overlaps and retrieves top-$k$ relevant passages.
3. **Structured Output Invalidation**:
   - Free-tier cloud models sometimes interject markdown commentary (`Here is your JSON:`). Required mitigation: Strict JSON repair, schema enforcement, or fallback.
4. **Credential Security**:
   - API keys are never stored in SQLite. Instead, an opaque token reference (`credential_ref = "cred:ai_groqcloud:v1"`) is stored in the database, while the encrypted secret resides in the OS app data vault (`.vault.dat`).

