# AI System Implementation Audit & Target Architecture

**Repository**: Research Paper Scraper Desktop Application  
**Target Environment**: Tauri 2 + Rust + React + TypeScript + SQLite + Python Local Sidecar  
**Audit Date**: October 25, 2026  
**Status**: Pre-Implementation Audit & Technical Architecture Plan  

---

## 1. Executive Summary & Current State Analysis

The Research Paper Scraper desktop application is a local-first scholarly workbench providing academic search across 5+ providers, safe web crawling, high-fidelity PDF inspection via an embedded viewer (`pdfjs-dist`), metadata normalization, deduplication, and SQLite 3 persistence with WAL mode and FTS5 full-text indexing.

### Current Architecture Inventory

| Subsystem | Existing Technology & Location | Current Capabilities | AI Upgrade Reusability |
| :--- | :--- | :--- | :--- |
| **Frontend Shell** | React 19 + TypeScript + Vite + Tailwind CSS (`src/`) | 3-pane Discover workspace, Embedded PDF Viewer, Collections, Settings, Diagnostics | High: Integrate AI Reading Assistant into 3-pane Reader & create dedicated AI Hub. |
| **Desktop Shell** | Tauri 2.x + Rust 2021 (`src-tauri/`) | Secure IPC, Async Tokio tasks, SQLite connection manager, URL security guard (Anti-SSRF) | High: Host secure credential manager, provider routing, background job lifecycle, and sidecar supervision. |
| **Relational Database** | SQLite 3 (`rusqlite` bundled, FTS5 enabled, Migrations 0001–0006) | Papers, collections, notes, paper_files, download_jobs, crawl_jobs, reader_state | High: Add Migration 0007 for AI provider metadata, task routing, section chunks, FTS5 index, chat sessions, recommendations, and evaluations. |
| **Python Sidecar** | Python 3.10+ (`python-engine/src/paper_scraper/`) | Scrapy crawling, HTTPX, PyMuPDF, Playwright browser engine, JSON Lines IPC protocol (`protocol.py`) | High: Reuse versioned JSON Lines IPC for paper text extraction, section chunking, local embeddings, RAG retrieval, and optional PEFT/LoRA fine-tuning. |
| **PDF Viewer** | `EmbeddedPdfViewer.tsx` using `pdfjs-dist` | In-panel canvas rendering, text-layer extraction, page navigation, zoom, rotation, search | High: Add page-level citation jump links that navigate directly to cited pages and highlight passages. |

---

## 2. Gap Analysis

| Requirement | Current Status | Required AI Implementation |
| :--- | :--- | :--- |
| **Multi-Provider AI Registry** | Missing | Modular adapter registry supporting local runtimes (Ollama, LM Studio, llama.cpp, Generic OpenAI-compatible) and cloud providers (NVIDIA NIM, GroqCloud, Cerebras, Hugging Face, OpenRouter, Google Gemini, Cloudflare Workers AI, OpenAI, Anthropic). |
| **Local LLMs Without Cloud Keys** | Missing | Zero-key local runtime auto-detection, local model listing, capability flags, and offline verification. |
| **Paper Reading Assistant** | Missing | Embedded context-aware assistant: quick read, deep read, critical appraisal, method/dataset extraction, limitation review, cross-paper comparison, and study cards. |
| **Page-Level Grounding & Citations**| Partial (`doc_text_fts` exists for whole file) | Section-aware chunking preserving exact page numbers, section headings, and clickable citations that navigate the PDF. |
| **Shared RAG for All Providers** | Missing | Provider-agnostic retrieval pipeline (SQLite FTS5 + local vector embeddings) ensuring all models query the identical library knowledge. |
| **AI Paper Recommendations** | Missing | Multi-signal recommendation engine with transparent "Why this was recommended", novelty/diversity reranking, and local user feedback loop. |
| **RAG vs. Fine-Tuning Distinction** | Missing | Strict conceptual separation: RAG is inference-time retrieval without weight changes; Fine-tuning is an optional, capability-checked local PEFT/LoRA workflow. |
| **Local-Only Privacy Controls** | Missing | Hardware-enforced backend boundary: "Local only — do not send paper content to cloud" blocking all remote network calls before transmission. |
| **AI Evaluation Center** | Missing | Local test harness measuring QA correctness, citation faithfulness, summarization quality, abstention when evidence is absent, and latency/token metrics. |

---

## 3. Detailed Architecture Plan

### 3.1 Database Migration (`0007_ai_workspace_and_knowledge.sql`)
1. `ai_providers`: Non-secret provider descriptors (id, category, display_name, endpoint_url, doc_url, auth_type, access_category, default_model, embedding_model, reranker_model, timeout_secs, max_tokens, temperature, context_length, streaming_enabled, is_local, is_enabled, priority, updated_at). **Zero plaintext secrets**.
2. `ai_provider_task_routes`: Task-to-provider mappings (`quick_summary`, `deep_analysis`, `qa_citations`, `cross_paper_compare`, `recommendations`, `embeddings`, `reranking`, `ocr_vision`, `local_private`).
3. `ai_paper_chunks`: Section & page-level extracted passages (`id`, `paper_id`, `chunk_index`, `page_number`, `section_heading`, `content_text`, `token_count`, `embedding_vector_json`, `created_at`).
4. `ai_chunks_fts`: SQLite FTS5 table indexing `ai_paper_chunks` for rapid BM25 lexical passage retrieval.
5. `ai_chat_sessions` & `ai_chat_messages`: Local conversation records with structured citation metadata (`id`, `paper_id`, `role`, `content`, `citations_json`, `model_id`, `provider_id`, `retrieval_mode`, `created_at`).
6. `ai_recommendations` & `ai_recommendation_feedback`: Cached recommendation items with transparent scores, matched concepts, and user feedback (`saved`, `dismissed`, `not_relevant`).
7. `ai_evaluation_results`: Benchmark test logs for prompt, retrieval, and model quality comparisons.
8. `ai_finetuning_jobs`: Local PEFT/LoRA job tracking, hardware readiness checks, dataset manifests, and adapter cards.
9. `ai_settings`: Global privacy toggles (`local_only_mode`, `never_use_paid_apis`, `cloud_paper_sharing_enabled`).

### 3.2 Secure Credential Storage Strategy
- Store only opaque credential identifiers or safe non-secret tokens in SQLite.
- In production, integrate with OS Keychain / Credential Vault where available.
- Fallback storage uses application-level encryption key isolated from the SQLite database.
- Strictly redact keys from:
  - Application logs (`tracing` subscriber filters)
  - Python engine stdout/stderr IPC messages
  - Frontend error toast payloads and React component state exports
  - Crash reports and diagnostic exports

### 3.3 Sidecar IPC Extension
Extend `python-engine/src/paper_scraper/protocol.py` and `runner.py`:
- `ai_extract_chunks`: PyMuPDF layout-aware page & section extraction with exact page boundaries.
- `ai_compute_embeddings`: Local sentence embeddings (using lightweight local embedding models like `all-MiniLM-L6-v2` or Ollama embeddings).
- `ai_hybrid_search`: Lexical + Vector cosine similarity merge with reciprocal rank fusion (RRF).
- `ai_generate_stream`: Direct local inference or provider invocation with structured token streaming.
- `ai_evaluate`: Held-out dataset benchmark execution for citation fidelity and abstention verification.
- `ai_finetune_job`: Optional, capability-checked LoRA trainer using Hugging Face PEFT on verified local hardware.

### 3.4 Frontend Integration
- **`AI Hub` View**: Full-screen workspace with tabs for Providers & Models, Reading Assistant, Research Chat, Recommendations, Library Indexing, Fine-Tuning Lab, Evaluations & Feedback, Privacy & Storage.
- **Embedded Reading Assistant**: Added directly to the third pane of `DiscoverView.tsx` alongside `EmbeddedPdfViewer.tsx`, with clickable citation jump-links.
- **Global Privacy Banner**: Permanent indicators for "Local Only" and "Never Use Paid APIs".

---

## 4. Migration Risks & Mitigation Strategies

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Accidental Cloud Content Transmission** | High | Hardcoded backend boundary check: if `local_only_mode == true`, reject any remote API request with `ERR_PRIVACY_LOCAL_ONLY` before opening any network socket. |
| **RAG Mistaken for Fine-Tuning** | High | Explicit UI badge taxonomy: "RAG enabled" vs "User preferences learned" vs "Fine-tuned model" vs "Not trained". Never show "Trained" unless a real PEFT/LoRA job completed. |
| **Provider API Rate Limits & Quotas** | Medium | Graceful error classification (429, 401, 402, 5xx), exponential backoff with `Retry-After` support, and prompt alternative model recommendations without silent content transfers. |
| **Heavy Dependency Bloat** | Medium | Optional Transformers/PEFT loading. The core desktop app, local Ollama/LM Studio access, and RAG lexical retrieval operate immediately without requiring a heavy PyTorch install. |
| **PDF Extraction Failures on Scanned Pages** | Low | Detect image-only pages and provide transparent feedback ("Scanned page - OCR required"). Never hallucinate claims on missing text. |

---

## 5. Verification & Test Commands

- **Rust Backend**:
  ```bash
  cargo test --lib
  ```
- **Frontend Vitest Suite**:
  ```bash
  npm test
  ```
- **Python Engine Pytest Suite**:
  ```bash
  python -m pytest tests
  ```
- **Production Bundle**:
  ```bash
  npm run build
  ```
