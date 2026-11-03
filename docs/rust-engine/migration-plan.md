# Infinity Researcher — Rust Engine Migration Plan

**Date:** 2026-10-29  
**Version:** 0.1.0  
**Target:** Phased migration of backend workloads from Python sidecar to Rust-native core

---

## 1. Migration Strategy Principles

1. **Rust as Primary Backend**: All application orchestration, file operations, background scheduling, database persistence, similarity matching, and AI routing run in Rust.
2. **Preserve Working Functionality**: Do not disable working features or remove Python adapters until their Rust-native replacements are implemented, verified with automated tests, and integrated.
3. **Bounded Concurrency & Cancellation**: Every long-running job must support async cancellation tokens and structured progress events.
4. **No External Mock Data**: Replace simulated workflows with real SQLite persistence and verified local execution.

---

## 2. Workload Classification & Migration Targets

| Subsystem / Capability | Current Implementation | Migration Action | Target Rust Location |
| :--- | :--- | :--- | :--- |
| **Web Crawling & Spiders** | Python Scrapy (`engine/crawler.py`, spiders for Nature, bioRxiv, arXiv, etc.) | **Keep in Python temporarily**. Scrapy provides robust proxy handling, robots parsers, and throttling that already work. | Isolated behind `PythonEngineService` sidecar adapter. |
| **Background Job Manager** | Basic simulated tokio sleep tasks in `ai_tools.rs` | **Migrate to Rust Native**. Build a unified `JobManager` with job IDs, states (`queued`, `running`, `completed`, `failed`, `cancelled`), progress channels, and thread pools. | `src-tauri/src/engine/job_manager.rs` |
| **Document Ingestion & Parsing** | `lopdf` in `pdf_processor.rs` (PDF only); text fallback. | **Migrate to Rust Native**. Expand to PDF (`lopdf`), TXT, Markdown, and DOCX (via zip/xml parsing) with page-coordinate mapping. | `src-tauri/src/documents/extraction.rs` |
| **Winnowing Fingerprinting** | Split between SQLite tables (`0008`) and Python test script. | **Migrate to Rust Native**. High-performance rolling hash and winnowing algorithm in Rust with interval merging. | `src-tauri/src/similarity/fingerprints.rs` |
| **Literature Matrix Service** | Initial SQLite schema in `0009`; basic extraction commands. | **Expand in Rust Native**. Full matrix extraction linking cells to source passages, with cross-paper comparison and gap candidates. | `src-tauri/src/services/matrix_service.rs` |
| **Citation & DOI Verification** | Frontend heuristics; table `doi_cache` in `0011`. | **Migrate to Rust Native**. Crossref/DOI resolution via `reqwest` with cached metadata validation. | `src-tauri/src/citations/doi_verification.rs` |
| **AI Orchestration & Routing** | `AiProviderService` in Rust (13 providers). | **Enhance in Rust Native**. Add streaming responses to frontend, structured schema enforcement, and token budget limits. | `src-tauri/src/services/ai_provider_service.rs` |

---

## 3. Phased Implementation Roadmap

### Phase 1 — Repository & AI Audit (COMPLETED)
- Inspect existing frontend, Rust backend, Python engine, database migrations, and AI models.
- Produce architecture audit, current AI inventory, migration plan, security plan, and test plan.

### Phase 2 — Rust Engine Foundation & Job Manager
- Implement `JobManager` in Rust with bounded concurrency, async channels, progress reporting, and cancellation tokens.
- Add typed error taxonomy (`AppError` / `CommandError`).

### Phase 3 — Enhanced AI Orchestration Layer
- Integrate streaming inference across local (Ollama/LM Studio) and cloud endpoints.
- Implement structured output validation against JSON schemas with bounded repair attempts.
- Enforce token budget and context-window chunking.

### Phase 4 — Rust-Native Document Ingestion Engine
- Text extraction for PDF (`lopdf`), DOCX, Markdown, and TXT.
- Page number and section heading coordinate mapping.
- SHA-256 tamper-evident document hashing.

### Phase 5 — Research Discovery & Provenance
- Unify open-access API connectors (arXiv, OpenAlex, Semantic Scholar, Europe PMC, Crossref) in Rust with rate limiting.
- Deduplication and identity reconciliation.

### Phase 6 — Literature Intelligence & Research Gaps
- Evidence-linked literature survey matrix extraction.
- Cross-paper multi-dimensional comparison.
- Candidate research gap analysis with caveat notices.

### Phase 7 — Evidence-Grounded Academic Writer
- Section drafting with claim-to-source linking.
- Token preservation guard protecting formulas, citations, and numbers.
- Revision snapshot history.

### Phase 8 — Advanced Similarity & Plagiarism Engine
- Rust-native Winnowing n-gram fingerprinting.
- Exact and approximate matching against local library corpus.
- Non-overlapping interval merging for accurate coverage percentage.

### Phase 9 — Citation Audit & Visual Assets
- DOI syntax and metadata consistency checking.
- Extracted figures and tables inspection.

### Phase 10 — End-to-End 3-Panel Integration & Release
- Wire the 3-panel Literature Hub to active Rust commands.
- Verify full test suite and packaging.

