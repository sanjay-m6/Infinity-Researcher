# Infinity Researcher — Backend Architecture Audit

**Date:** 2026-10-29  
**Version:** 0.1.0 (Phase 1 Audit)  
**Authors:** Principal Systems & AI Infrastructure Architect

---

## 1. Executive Summary

Infinity Researcher is a high-performance, local-first research workspace built on **Tauri 2**, with a **Rust** backend engine and a **React 19 / TypeScript / Tailwind CSS v4** frontend. The application integrates document ingestion, full-text extraction, literature review matrix workflows, evidence-grounded academic paper drafting, multi-provider AI orchestration, and Winnowing-based similarity analysis.

This audit assesses the state of the existing codebase across the frontend, Rust core, Python sidecar, SQLite database schema, and AI integrations to guide the evolution toward a unified, Rust-native research intelligence engine.

---

## 2. Frontend Architecture Audit

### 2.1 Technology Stack & Organization
- **Core Framework:** React 19.0.0, TypeScript 5.8, Vite 8.3.
- **Styling & Design System:** Tailwind CSS v4 with custom design tokens (`--surface`, `--border`, `--text`, `--primary`) mapped in `src/styles/index.css`. Fully responsive two-column sidebar (`Sidebar.tsx`) and light/dark theme switching.
- **State Management:**
  - `AppContext.tsx`: Global application state, active navigation section, toast notifications, system health, and theme management (`light`, `dark`, `system`).
  - `ProjectWorkspaceContext.tsx`: Dedicated domain context managing the 3-panel Literature Hub (`Panel1Collection`, `Panel2Workspace`, `Panel3Evidence`).
  - Local session stores (e.g. `discoverSessionStore.ts`, `reportStore.ts`).

### 2.2 Views and Routing
Routed dynamically via `src/components/layout/AppShell.tsx`:
1. **Research Category:**
   - `dashboard` (`DashboardView.tsx`)
   - `discover` (`DiscoverView.tsx` with live streaming search, PDF page jumps, embedded viewer)
   - `literature_workspace` (`LiteratureWorkspaceView.tsx` — 3-panel Literature Hub)
   - `library` (`LibraryView.tsx`)
   - `paper_comparison` / `review_matrix` (`ReviewMatrixView.tsx`)
   - `ieee` (`IeeeOpenAccessView.tsx`)
2. **AI Tools Category:**
   - `ai_tools` (`AiToolsHubView.tsx` — registry of 8 specialized tools)
   - `ai_writing_detector` (`AiToolWorkspaceView.tsx`)
   - `plagiarism_checker` (`AiToolWorkspaceView.tsx`)
   - `ai_humanizer`, `academic_writing_assistant`, `paraphrasing_tool` (`AcademicWritingWorkspaceView.tsx`)
   - `citation_checker` (`CitationCheckerWorkspaceView.tsx`)
   - `readability_analyzer` (`ReadabilityAnalyzerView.tsx`)
   - `research_integrity` (`ResearchIntegrityView.tsx`)
3. **Workspace & System Categories:**
   - `projects` / `collections` (`CollectionsView.tsx`)
   - `saved_reports` (`SavedReportsView.tsx`)
   - `history` / `downloads` (`DownloadsView.tsx`)
   - `activity` (`ActivityView.tsx`)
   - `ai_models` / `ai_hub` (`AiHubView.tsx`)
   - `sources` (`SourcesView.tsx`)
   - `settings` (`SettingsView.tsx`)
   - `privacy_security` (`PrivacySecurityView.tsx`)

---

## 3. Rust Backend Core Audit (`src-tauri/`)

### 3.1 Architecture Overview
- **Framework:** Tauri v2 (`tauri = "2"`) with `tauri-plugin-opener`, `tauri-plugin-updater`, `tauri-plugin-process`.
- **Runtime:** `tokio` (full asynchronous multi-threaded runtime).
- **Database:** `rusqlite` bundled SQLite 3 with WAL mode, foreign keys, and FTS5 full-text search.
- **Entry Point:** `src-tauri/src/lib.rs` registers 85+ Tauri IPC commands under `invoke_handler!`.

### 3.2 Key Rust Modules & Responsibilities
- `academic_sources/`:
  - Rate-limited search adapters for open academic repositories (`arxiv.rs`, `crossref.rs`, `europe_pmc.rs`, `openalex.rs`, `semantic_scholar.rs`).
- `scrapers/`:
  - Native Rust scraping engine, URL guards, robots.txt validator, job deduplication, and specialized adapters (`arxiv`, `biorxiv`, `ieee`, `medrxiv`, `nature`, `plos`, `pmc`).
- `services/`:
  - `ai_provider_service.rs`: Manages HTTP dispatch, connection probing, privacy guard enforcement, and secure credential storage for 13 AI providers.
  - `ai_rag_service.rs`: Native PDF chunking using `lopdf`, section heading extraction via regex, and BM25 hybrid lexical retrieval over `ai_chunks_fts`.
  - `ai_eval_service.rs`: Runs local deterministic evaluation benchmarks against test suites.
  - `pdf_processor.rs`: Structural PDF inspection, page counting, encryption detection, metadata parsing, and text extraction up to 50 pages.
  - `matrix_service.rs`: Coordinates literature review matrix extraction and workspace definitions.
  - `download_manager.rs`: Async queue for PDF background downloads with retry limits.
  - `file_integrity.rs`: Computes SHA-256 document checksums for provenance.
  - `python_engine.rs`: Process manager spawning the Python sidecar binary or module via async stdio pipes.
- `commands/`:
  - Bridges frontend calls to service handlers with standardized error mappings (`CommandError`).

---

## 4. Database Architecture & Migrations

The SQLite database (`infinity-researcher.sqlite3` / `research-paper-scraper.sqlite3`) contains **52 tables** across 11 structured migrations:
- `0001_initial_schema.sql`: Papers, authors, sources, collections, tags, notes, settings.
- `0002_website_scraping_engine.sql`: Crawl profiles, crawl jobs, crawl queue, paper mappings.
- `0003_processing_and_deduplication.sql`: Paper identifiers (DOI, ArXiv, CorpusId), file paths, duplicate candidate scoring, processing jobs.
- `0004_research_workflows_and_exports.sql`: Export templates and citation tracking.
- `0005_unified_pdf_workspace.sql`: Download jobs, PDF candidates, reader state (last viewed page, zoom, scroll).
- `0006_ieee_open_access_workflow.sql`: Terms compliance, Mode A tracking.
- `0007_ai_workspace_and_knowledge.sql`: AI providers, task routing, section chunks (`ai_paper_chunks`), FTS5 trigger-maintained search index (`ai_chunks_fts`), chat messages, recommendations, hardware diagnostics.
- `0008_research_integrity_and_writing.sql`: Ingested documents, segments, corpus fingerprints, similarity runs, AI signal runs, writing sessions, and revisions.
- `0009_literature_review_matrix_and_copilot.sql`: Review matrix workspaces, matrix extractions with confidence, evidence copilot sessions and messages.
- `0010_imare_retrieval_state.sql`: Discovery session caching and query state.
- `0011_ai_tools_and_integrity_persistence.sql`: Async analysis jobs (`analysis_jobs`), saved integrity reports with individual findings review, citation audits, readability reports, and DOI cache.

---

## 5. Python Sidecar Engine Audit (`python-engine/`)

### 5.1 Architecture & Role
- Built with Python 3.10+, Scrapy 2.19, `httpx`, and `pydantic`.
- Packaged as a standalone PyInstaller sidecar binary (`paper-scraper-x86_64-pc-windows-msvc.exe`) or run as a local module (`python -m paper_scraper`).
- Communicates with Rust via async stdin/stdout JSON protocol (`protocol.py`, `runner.py`).

### 5.2 Python Subsystems
1. **Scrapy Crawler (`engine/crawler.py`)**: Executes multi-source web crawls across academic publishers with robots compliance and download throttling.
2. **Spiders (`spiders/`)**: Handles publisher search scraping (Nature, PLOS, bioRxiv, medRxiv, arXiv, PubMed, IEEE).
3. **Identity & Query Intelligence (`discovery/`)**: Query term expansion and search term normalization.
4. **AI & Text Extraction (`ai/`)**: Statistical text analysis (entropy, perplexity approximation, sentence variance) and PDF text extraction fallback.

---

## 6. Current Strengths and Architectural Gaps

| Dimension | Current State | Architectural Target |
| :--- | :--- | :--- |
| **Orchestration** | Dual-engine (Rust core + Python sidecar for scraping/signals). | Unified Rust background engine with bounded concurrency. Python isolated strictly for scraping. |
| **AI Integration** | 13 providers registered in SQLite, basic RAG with `lopdf` chunking. | Capability-aware Rust AI router with schema validation, streaming, and context budget management. |
| **Document Processing** | `lopdf` for PDF text and metadata; Python fallback for DOCX/TXT. | Rust-native multi-format extraction (PDF, DOCX, TXT, Markdown, LaTeX) with exact page mapping. |
| **Literature Matrix** | Matrix workspaces in SQLite (`0009`); 3-panel UI with sample data bus. | Full end-to-end backend connection linking extracted passages to matrix cells and writing claims. |
| **Similarity Engine** | Database tables created (`0008`); Winnowing algorithm implemented. | Rust-native Winnowing index, non-overlapping interval merging, and local-only library corpus comparison. |
| **Local-Only Privacy** | Flag in `ai_settings` checked in `AiProviderService`. | Strict Rust networking barrier blocking outbound connections when local-only mode is active. |

