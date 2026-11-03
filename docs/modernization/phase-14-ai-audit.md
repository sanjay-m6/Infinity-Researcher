# Phase 14: AI Research Assistant and Paper Understanding Engine — Pre-Implementation Audit Report

## 1. Executive Summary

An audit of the Infinity Researcher repository was conducted to inspect the existing AI infrastructure across Tauri 2 / Rust, SQLite, the Python document-processing engine, and the React/TypeScript frontend.

The audit confirms that a strong architectural foundation was established in Phases 1–13. Rather than introducing new external AI frameworks or duplicating database tables, Phase 14 focuses on:
1. Enhancing extraction quality and page-aware chunking with paragraph/sentence boundary detection and scanned PDF detection.
2. Implementing an evidence-validation layer that strictly verifies cited chunks against source paper text.
3. Adding lightweight, deterministic research query classification.
4. Providing standardized research analysis tools (Structured Summary, Methodology Analysis, Results Analysis, Limitations Analysis, Terminology Explanation).
5. Implementing multi-paper comparison and collection-scoped research-gap analysis with explicit novelty caveats.
6. Enforcing privacy, context bounds, and result caching.

---

## 2. Inventory of Existing AI Capabilities

### 2.1 Backend Architecture (Rust / Tauri 2)
- **`AiProviderService` (`src-tauri/src/services/ai_provider_service.rs`)**:
  - Implements provider management, health probes, model discovery, and prompt execution.
  - Supports local endpoints (`ollama_local`, `lm_studio_local`, `llama_cpp_local`), Anthropic (`anthropic`), and generic OpenAI-compatible APIs (Groq, Cerebras, NVIDIA NIM, OpenAI, Gemini).
  - Secure credential storage: Masked tokens over IPC; local vault in app-data directory.
  - Privacy guards: `local_only_mode`, `never_use_paid_apis`, `cloud_paper_sharing_enabled`.
- **`AiRagService` (`src-tauri/src/services/ai_rag_service.rs`)**:
  - Ingestion via `lopdf::Document` page-by-page.
  - Section heading detection via regex.
  - Hybrid retrieval using SQLite FTS5 BM25 search.
- **`AiRepository` (`src-tauri/src/repositories/ai_repo.rs`)**:
  - CRUD operations for providers, task routes, chunks, chat sessions, recommendations, evaluations, fine-tuning jobs.

### 2.2 SQLite Schema (`migrations/0007_ai_workspace_and_knowledge.sql`)
- Tables:
  - `ai_providers`: Provider endpoints, capabilities, credentials ref, model mappings.
  - `ai_provider_task_routes`: Task-specific model routing.
  - `ai_paper_chunks`: Page-level and section-level RAG units with `paper_id`, `chunk_index`, `page_number`, `section_heading`, `content_text`, `token_count`.
  - `ai_chunks_fts`: FTS5 virtual table with insert/update/delete triggers for BM25 retrieval.
  - `ai_chat_sessions` & `ai_chat_messages`: Conversation logging with citation JSON.
  - `ai_settings`: Privacy preferences (`local_only_mode`, `never_use_paid_apis`, `cloud_paper_sharing_enabled`, `active_rag_scope`).

### 2.3 Python Document Engine (`python-engine/src/paper_scraper/ai/`)
- `chunker.py`: PyMuPDF (`fitz`) page extraction and character chunking.
- `pdf.py`: PDF signature validation (`%PDF-`), HTML error redirect detection, Anti-SSRF streaming guards.
- `signals.py`: Document text loading and statistical cadence analysis.

### 2.4 Frontend Layer (React 19 / TypeScript)
- `src/features/ai-hub/AiHubView.tsx`: Comprehensive hub with Provider Management, Chat, Recommendations, Indexing, and Privacy controls.
- `src/features/discover/DiscoverPaperAssistant.tsx`: In-pane assistant with 8 research insights and grounded chat.
- `src/components/pdf-viewer/PdfRightPanel.tsx`: Embedded PDF reader assistant with Grounding Context switcher (`Selection`, `Page`, `Full Paper`) and page jump tags.
- `src/lib/desktop-api/`: Strongly-typed IPC bridge (`generateAiResponse`, `indexPaperForRag`, `getPaperRagChunks`, `searchRagPassages`).

---

## 3. Identified Gaps and Reliability Opportunities

| Component | Existing Implementation | Gaps & Opportunities | Phase 14 Solution |
|---|---|---|---|
| **Text Chunking** | Fixed character chunks (1200 chars) with 150 char overlap. | Can split across mid-sentence boundaries; heading detection only checks top of block. | Paragraph & sentence-aware boundary chunking with hash versioning. |
| **Evidence Validation** | LLM citations returned based on RAG context. | Model can hallucinate a citation snippet or page number not in the retrieved passages. | Deterministic citation validator: verifies chunk ID, paper ID, and fuzzy text match against source text. |
| **Query Classification** | Free-form prompt sent directly to LLM. | Redundant expensive LLM calls for ordinary intents (summarize, explain, compare). | Lightweight rule-based query classifier (deterministic regex + intent routing). |
| **Structured Output** | Free-form markdown text response. | Inconsistent section headers when parsing analysis (summary, methods, results). | Typed structured output parser with schema validation and markdown fallback. |
| **Multi-Paper Comparison** | Scope supports 'library', but mixes chunks from all papers indiscriminately. | Chunks from Paper A can be attributed to Paper B; no side-by-side comparison matrix. | Isolated multi-paper comparison engine preserving per-paper evidence partitions. |
| **Research Gap Analysis** | Single-paper gap prompt. | Unscoped novelty claims; no explicit boundary between collection gap vs field gap. | Evidence-backed gap analysis with strict uncertainty caveats and scope boundaries. |
| **Result Caching** | No caching; every identical query re-executes model. | High token cost and unnecessary latency for repeated paper summaries. | Content-hashed, model-aware analysis cache in SQLite/memory. |

---

## 4. Reusability Strategy

- **DO NOT** create a second AI provider service or duplicate database tables.
- **REUSE** `AiProviderService`, `AiRagService`, `ai_paper_chunks`, and `ai_chunks_fts`.
- **EXTEND** the Rust backend and TypeScript domain model with:
  1. A structured paper understanding module (`PaperUnderstandingService`).
  2. A deterministic query classifier (`classifyResearchQuery`).
  3. Structured analysis generators (Summary, Methodology, Results, Limitations, Terminology).
  4. Multi-paper comparison and gap analysis with strict evidence isolation.
  5. Citation verification and content hash validation.

