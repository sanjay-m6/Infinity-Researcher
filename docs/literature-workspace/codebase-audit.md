# Codebase Audit: Infinity Researcher Three-Panel Literature Workspace

**Audit Timestamp:** 2026-10-29  
**Application Name:** Infinity Researcher  
**Target Architecture:** Unified Three-Panel Literature Survey, Research Paper Discovery, Academic Writing & Similarity Analysis Workspace  

---

## 1. Executive Summary

This audit examines the current state of Infinity Researcher across the desktop frontend (React 19 + TypeScript + Vite + Tailwind CSS v4), the desktop native core (Tauri v2 + Rust 2021 + SQLite with rusqlite), and the academic processing engine (Python 3.10+ / 3.14 + Scrapy + statistical NLP).

The repository contains extensive, production-grade subsystems for literature discovery, review matrix building, evidence-linked extraction, PDF reading, academic writing, citation auditing, stylometric detection, and SQLite persistence. However, these features are currently distributed across separate navigation sections (`discover`, `review_matrix`, `academic_writing_assistant`, `ai_humanizer`, `citation_checker`, `readability_analyzer`, `research_integrity`). 

The goal of the unified three-panel architecture is **not to rewrite these features from scratch**, but to consolidate them into a seamless, shared-state project workspace:
- **Panel 1 (Left):** Literature Collection & Discovery (Upload, search, filter, organize, track extraction).
- **Panel 2 (Center):** Literature Survey, Analysis & Academic Writing (Literature Survey Matrix, Multi-Paper Comparison, Research Gap Analysis, Structured Paper Writer, Research Notes, Figures & Tables).
- **Panel 3 (Right):** Details, Evidence & Similarity Review (Paper details, verbatim source evidence with page jump, plagiarism/similarity review, figure/table viewer).

---

## 2. Technology Stack & Environment

| Layer | Technologies & Dependencies | Version / Status |
|---|---|---|
| **Desktop Shell** | Tauri v2 (`@tauri-apps/api`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-process`, `@tauri-apps/plugin-updater`) | Tauri 2.0.0, Native window controls, IPC bridge |
| **Frontend Framework** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, Lucide React, GSAP | 0 TypeScript errors, 201/201 Vitest unit & integration tests passing |
| **Native Core (Rust)** | Rust 2021 Edition, Tokio 1.40, Rusqlite 0.40.2 (bundled + WAL), Lopdf 0.34, Reqwest 0.12, Sha2 0.10, Uuid 1.29 | Cargo check clean; SQLite schema version 11 with 52 tables verified |
| **Processing Engine (Python)** | Python 3.10+ (detected 3.14.3), Scrapy 2.19, Httpx, Pypdf, Pdfminer, Scikit-learn/NLTK heuristics | JSON Lines IPC (`PROTOCOL_VERSION = "1.0.0"`) over stdin/stdout |
| **PDF Rendering** | Mozilla PDF.js (`pdfjs-dist/legacy/build/pdf.mjs` + Web Worker) | Full embedded canvas viewer, zoom, page navigation, text selection |

---

## 3. Subsystem Audit & Reusability Analysis

### 3.1 Frontend Routing & Shell (`src/components/layout/`)
- **`AppShell.tsx`**: Central orchestrator managing `activeSection` state, theme toggling, toasts, command palette (`Ctrl+K`), and viewport rendering. Already keeps `DiscoverView` persistently mounted to prevent losing query results and reading states.
- **`Sidebar.tsx`**: Two-column sidebar featuring a primary icon rail (Research, AI Tools, Workspace, System) and a collapsible category sub-navigation flyout.
- **`TitleBar.tsx` & `Toolbar.tsx`**: Custom frameless window drag controls, global search input, light/dark theme switch, notifications.
- **Reusability Decision:** Keep the two-column sidebar and top bar. Create a dedicated top-level route/section `literature_workspace` or expand the `discover` / `review_matrix` view into the unified 3-panel workspace while keeping existing views accessible.

### 3.2 Literature Discovery & Query Engine (`src/features/discover/`)
- **`DiscoverView.tsx`**: Contains an existing 3-pane layout for searching, viewing PDFs, and viewing paper details/chat.
- **Source Providers Supported:** arXiv, bioRxiv, medRxiv, PubMed, PMC, PLOS, Nature Scientific Reports, IEEE Xplore.
- **Dual Query Engines:** Native Rust multi-source engine + Python Scrapy engine with live streaming events (`search.started`, `source.started`, `paper.discovered`, `source.completed`, `job.completed`).
- **`PaperImportModal.tsx`**: Local paper ingestion dialog.
- **Reusability Decision:** **Reuse 100% of the discovery pipelines, spiders, and stream handlers.** Panel 1 will embed this discovery engine alongside the project collection library.

### 3.3 Literature Review Matrix & Evidence Linking (`src/features/review-matrix/`)
- **`ReviewMatrixView.tsx`**: Full literature matrix spreadsheet supporting arbitrary paper rows and custom configured columns (`Objective`, `Methodology`, `Datasets`, `Evaluation Metrics`, `Reported Results`, `Limitations`, `Future Work`).
- **`EvidenceDrawer.tsx`**: Inspects individual cell extractions, showing the verbatim paper excerpt, confidence score, source page number, and verification state (`verified_by_user`, `extracted_by_ai`, `manual_edit`). Includes `onNavigateToDiscoverPdf(paperId, pageNumber)` to jump directly to the exact PDF page.
- **`EvidenceCopilotModal.tsx`**: Cross-paper synthesis copilot that answers research queries with page-attributed citations.
- **`ColumnConfigModal.tsx` & `AddPapersModal.tsx`**: Dynamic schema customization and batch ingestion from local library.
- **Backend Services:** `src-tauri/src/services/matrix_service.rs` and `matrix_repo.rs` backed by tables `review_matrix_workspaces`, `review_matrix_columns`, `review_matrix_papers`, and `review_matrix_extractions`.
- **Reusability Decision:** **Direct core foundation for Panel 2 (Tab 1: Literature Survey and Tab 2: Literature Comparison).** Its evidence schema already implements the exact paper-to-evidence connection required by the specification.

### 3.4 Academic Writing & Token Guard (`src/features/writing-workspace/`)
- **`AcademicWritingWorkspaceView.tsx`**: Academic manuscript editor supporting 12 Humanizer modes, 9 Academic Writing modes, and 6 Paraphrasing modes.
- **`tokenPreservationGuard.ts`**: Verbatim invariant extractor that strictly protects citations (`[1]`, `(Vaswani et al., 2017)`), canonical DOIs, equations, quantities, units, technical terminology, and detects semantic drift or hedging alterations.
- **`SideBySideDiffViewer.tsx`**: Side-by-side split editor, word-level diff computation, paragraph breakdown, word/character counts, and undo/redo stacks.
- **`PrivacyConfirmationModal.tsx` & `AttributionNoticeBanner.tsx`**: Enforces local-only execution and explicit user consent before any remote processing.
- **Reusability Decision:** **Core foundation for Panel 2 (Tab 4: Research Paper Writer).** Can be extended with configurable academic sections (Title, Abstract, Introduction, Related Work, Methodology, etc.) and direct claim-to-evidence linking.

### 3.5 Plagiarism & Similarity Scanner (`src/features/ai-tools/` & `python-engine/`)
- **`AiToolWorkspaceView.tsx`**: Implements a Winnowing 4-gram fingerprinting algorithm that scans draft text against all library papers, outputting overlap percentages, matching paper records, and sentence-level suspect highlighting.
- **`python-engine/src/paper_scraper/ai/signals.py`**: Computes sentence length variance, standard deviation, burstiness index, and lexical diversity (Type-Token Ratio) with honest uncertainty caveats.
- **Database Tables (Migration 0008):** `integrity_corpus`, `corpus_fingerprints`, `similarity_matches`.
- **Reusability Decision:** **Core engine for Panel 3 (Plagiarism and Similarity Review).** We will enhance interval merging to eliminate duplicate counting of overlapping intervals and provide side-by-side matching passage inspection.

### 3.6 Citation Auditing & Reference Verification (`src/features/citation-checker/`)
- **`CitationCheckerWorkspaceView.tsx` & `citationEngine.ts`**:
  - In-text citation parsing (numeric `[1]`, author-year, LaTeX `\cite{...}`).
  - Bibliography reference extraction and field parsing (authors, title, year, venue, volume, pages, DOI).
  - Cross-referencing: detects orphan in-text citations and uncited references.
  - Canonical DOI syntax verification and metadata resolution.
- **Reusability Decision:** **Core engine for Panel 3 (Citation and Reference Verification).**

### 3.7 PDF Viewer & Document Extraction (`src/components/pdf-viewer/` & `src-tauri/`)
- **`EmbeddedPdfViewer.tsx`**: Production PDF reader with page navigation, zoom, fit-width/page, text selection, and reader state persistence in `pdf_reader_states`.
- **`src-tauri/src/services/pdf_processor.rs`**: Structural PDF extraction via `lopdf`, extracting metadata, text preview, page count, and full text up to 50 pages, with rasterized/scanned PDF detection.
- **`python-engine/src/paper_scraper/ai/signals.py`**: Text extraction for PDF, DOCX, Markdown, and TXT.
- **Reusability Decision:** **Directly embeddable across both Panel 1 (Document Previews) and Panel 3 (Source Evidence Viewer).**

### 3.8 Database Schema & Migrations (`src-tauri/migrations/`)
- **11 Migrations Verified (52 Tables total):**
  - Project/Collection Management: `papers`, `collections`, `paper_collections`, `tags`, `paper_tags`, `notes`.
  - Processing & Deduplication: `paper_files`, `processing_jobs`, `duplicate_candidates`, `merge_history`.
  - Review Matrix & Evidence: `review_matrix_workspaces`, `review_matrix_columns`, `review_matrix_papers`, `review_matrix_extractions`, `evidence_copilot_sessions`, `evidence_copilot_messages`.
  - AI & Background Jobs: `analysis_jobs`, `saved_integrity_reports`, `integrity_report_findings`, `citation_audits`, `readability_reports`, `doi_cache`.
  - Integrity & Revisions: `integrity_documents`, `integrity_corpus`, `corpus_fingerprints`, `writing_sessions`, `writing_revisions`.
- **Reusability Decision:** The existing database schema already contains tables for papers, extractions, matrix columns, writing revisions, citation audits, and analysis jobs. We can build upon this schema without disruptive table drops.

---

## 4. Identified Gaps & Missing Functionality

1. **Unified Workspace Integration:** Currently, users must switch routes between Discover, Review Matrix, Academic Writing, Citation Checker, and AI Writing Detector. They do not share a single synchronized project context where clicking a claim in writing immediately displays supporting evidence in the adjacent panel.
2. **Three-Panel Layout Orchestration:** Need a flexible 3-panel container with independent panel resizing, collapsible panels, and persistent widths.
3. **Structured Academic Section Editor:** While `AcademicWritingWorkspaceView` provides rewriting modes and diffs, it needs a section-based manuscript editor (Title, Abstract, Introduction, Related Work, Methodology, Results, Discussion, Limitations, Conclusion, References) with claim-to-evidence binding.
4. **Research Gap Synthesis Engine:** We need an analysis module that analyzes repeated limitations, underexplored datasets, and conflicting findings across the matrix to surface potential research gaps with evidence citations.
5. **Figures and Tables Extraction:** Need visual and tabular asset extraction tracking associated with page numbers and source papers.

---

## 5. Architectural Recommendations

1. **Preserve Compatibility:** Do not replace Tauri, React 19, Rusqlite, or the Python Scrapy engine.
2. **Reuse Existing Components:**
   - Panel 1 reuses `DiscoverView` search streams and `LibraryView` collections.
   - Panel 2 reuses `ReviewMatrixView` for Literature Survey & Comparison, and `AcademicWritingWorkspaceView` diff viewer for the Paper Writer.
   - Panel 3 reuses `EvidenceDrawer`, `EmbeddedPdfViewer`, and `CitationCheckerWorkspaceView`.
3. **Shared Project Context:** Create a unified `ProjectWorkspaceContext` that synchronizes:
   - Selected Project / Collection
   - Selected Paper
   - Selected Matrix Cell / Finding
   - Selected Writing Claim / Text Segment
   - Active Evidence Target (Paper ID, Page, Excerpt, Bounding Box)
4. **Strict Local-First & Privacy Rule:** Maintain the local-first architecture. Any external LLM or cloud API call must continue to require explicit opt-in confirmation with privacy notices.

