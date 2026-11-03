# Comprehensive Frontend Audit: Research Tools Module
**Repository**: `infinity-researcher` (`d:\Paper`)  
**Auditor**: `explorer_survey_1` (Teamwork Explorer Agent)  
**Date**: November 3, 2026  
**Status**: Read-Only Survey Complete  

---

## Executive Summary

A comprehensive frontend investigation of the Infinity Researcher **Research Tools** module was conducted across navigation menus, tools hubs, individual tool workspaces, shared UI components, document upload pipelines, PDF viewer integrations, global theme/loading systems, reporting views, backend connections (Tauri IPC, Python engine, SQLite, local LLM sidecars), and the Vitest automated test suite.

### Key Audit Findings
1. **Tool Page Inventory & Dual-Implementation Phenomenon**:
   The repository contains **two generations** of tool implementations:
   - An earlier multi-tool workspace in `src/features/ai-tools/AiToolWorkspaceView.tsx` (1,322 lines) that contains embedded logic for 8 tools.
   - Dedicated, modularized, high-fidelity feature modules created for specific tools (`writing-workspace/`, `citation-checker/`, `readability/`, and `integrity/`).
   - `src/components/layout/AppShell.tsx` routes `ai_writing_detector` and `plagiarism_checker` to `AiToolWorkspaceView.tsx`, while routing `ai_humanizer`, `academic_writing_assistant`, and `paraphrasing_tool` to `AcademicWritingWorkspaceView.tsx`, `citation_checker` to `CitationCheckerWorkspaceView.tsx`, `readability_analyzer` to `ReadabilityAnalyzerView.tsx`, and `research_integrity` to `ResearchIntegrityView.tsx`.
2. **Identification of the 9th Tool**:
   - In the Sidebar navigation group `Research Tools` (`Sidebar.tsx:121-167`) and `domain.ts:13-22`, exactly 9 navigation sections exist:
     1) `ai_tools` — **Tools Hub** (`AiToolsHubView.tsx`)
     2) `ai_writing_detector` — **AI Writing Detector**
     3) `plagiarism_checker` — **Plagiarism Checker**
     4) `ai_humanizer` — **AI Humanizer**
     5) `academic_writing_assistant` — **Academic Writing Assistant**
     6) `paraphrasing_tool` — **Paraphrasing Tool**
     7) `citation_checker` — **Citation Checker**
     8) `readability_analyzer` — **Readability Analyzer**
     9) `research_integrity` — **Research Integrity**
   - The 9th item in the Research Tools suite is **Tools Hub** (`ai_tools`), which acts as the central dashboard, hardware profiler, sidecar manager, and catalog.
   - In addition, adjacent research tools exist in the workspace: **Saved Reports & Exports** (`SavedReportsView.tsx`), **Literature Review Matrix** (`ReviewMatrixView.tsx`), **3-Pane Literature Workspace** (`LiteratureWorkspaceView.tsx`), and **AI Diagnostics** (`AiDiagnosticsView.tsx`).
3. **Mock Data, Simulated Processing & Heuristic Fabrications**:
   - `ai_writing_detector`: Sentence burstiness & probability calculations are purely client-side heuristics clamping between 8% and 96%, with any sentence of 16–22 words arbitrarily flagged as suspect machine text. Background jobs in `start_analysis_job` (`ai_tools.rs:126-157`) use hardcoded `tokio::time::sleep` (100ms, 150ms, 100ms) with hardcoded progress percentages (`15%`, `35%`, `60%`, `100%`) returning dummy JSON. The desktop IPC fallback returns hardcoded 35%.
   - `plagiarism_checker`: Claims n-gram comparison against "saved library papers and open academic reference corpus", but in reality only checks 4-grams against in-memory `papers` state. No external corpus or database full-text search is connected. It lacks a manual "Run" button and runs only reactively in `useMemo`.
   - `SavedReportsView.tsx`: The entire reports list is a static mock array (`useState<SavedReportItem[]>([...])`) with hardcoded dates ("Oct 28, 2026") and fake file sizes, completely disconnected from the SQLite database.
4. **Critical Binary File Upload Defect**:
   - Across `CitationCheckerWorkspaceView.tsx:111`, `ReadabilityAnalyzerView.tsx:144`, and `ResearchIntegrityView.tsx:185`, file inputs accept `.pdf` and `.docx`, but read files via browser `FileReader.readAsText(file)`. This results in binary garbage being read into memory rather than invoking backend document text extraction (`extract_document_text` / `extract_document_file`).
5. **Python Engine Latent Bug**:
   - In `python-engine/src/paper_scraper/ai/signals.py:59`, `is_clean = replacement_count < 5` references an undefined variable `replacement_count` (defined as `replacement_chars` on line 58), causing a runtime `NameError` if invoked.
6. **Frontend Test Suite Status**:
   - Offline Test Runner: Vitest v5.0.5 with jsdom. Tests execute completely offline without cloud API keys.
   - Test Results: **46 test suites passed (567 tests passed)**; **6 test suites failed (11 tests failed)**.
   - All tool-specific test suites (`academic-writing-workspace.test.tsx`, `citation-checker.test.tsx`, `readability-and-integrity.test.tsx`, `phase9-backend-integration.test.tsx`) pass 100%. The 6 failing test files are caused by navigation rail title / heading text label mismatches.

---

## 1. Inventory of Research Tools Frontend Components

| # | Tool / View Name | Navigation ID | File Path | Route Component | Current Status |
|---|---|---|---|---|---|
| **0** | **Tools Hub (Suite Cockpit)** | `ai_tools` | `src/features/ai-tools/AiToolsHubView.tsx` | `<AiToolsHubView />` | **Functional** (UI & Hardware query functional; label mismatch in tests) |
| **1** | **AI Writing Detector** | `ai_writing_detector` | `src/features/ai-tools/AiToolWorkspaceView.tsx` | `<AiToolWorkspaceView toolId="ai_writing_detector" />` | **Incomplete / Heuristic / Simulated** (Heuristic formulas, simulated progress, hardcoded IPC fallback) |
| **2** | **Plagiarism Checker** | `plagiarism_checker` | `src/features/ai-tools/AiToolWorkspaceView.tsx` | `<AiToolWorkspaceView toolId="plagiarism_checker" />` | **Broken / Incomplete** (No Run button, checks only in-memory papers, no external corpus) |
| **3** | **AI Humanizer** | `ai_humanizer` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | `<AcademicWritingWorkspaceView toolId="ai_humanizer" />` | **Functional** (12 modes, invariant token guard, local heuristics & LLM, SQLite history) |
| **4** | **Academic Writing Assistant** | `academic_writing_assistant` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | `<AcademicWritingWorkspaceView toolId="academic_writing_assistant" />` | **Functional** (9 modes, invariant token guard, local heuristics & LLM, SQLite history) |
| **5** | **Paraphrasing Tool** | `paraphrasing_tool` | `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` | `<AcademicWritingWorkspaceView toolId="paraphrasing_tool" />` | **Functional** (8 modes, citation locking, attribution banner, local heuristics & LLM) |
| **6** | **Citation Checker** | `citation_checker` | `src/features/citation-checker/CitationCheckerWorkspaceView.tsx` | `<CitationCheckerWorkspaceView />` | **Functional / Defect in Upload** (Comprehensive crossref & offline DOI registry; binary upload broken) |
| **7** | **Readability Analyzer** | `readability_analyzer` | `src/features/readability/ReadabilityAnalyzerView.tsx` | `<ReadabilityAnalyzerView />` | **Functional / Defect in Upload** (6 classical formulas, language detection, SQLite caching; binary upload broken) |
| **8** | **Research Integrity** | `research_integrity` | `src/features/integrity/ResearchIntegrityView.tsx` | `<ResearchIntegrityView />` | **Functional / Defect in Upload** (7 dimensions, traceable findings, reviewer sign-off, SQLite persistence; binary upload broken) |
| **9** | **Saved Reports & Exports (Extended Suite)** | `saved_reports` | `src/features/reports/SavedReportsView.tsx` | `<SavedReportsView />` | **Mock Implementation** (Hardcoded mock array in `useState`, not wired to SQLite tables) |

---

## 2. In-Depth Component Analysis & Audit Findings

### 2.1 Navigation & Routing Architecture
- **Sidebar (`src/components/layout/Sidebar.tsx`)**:
  - Implements a Two-Column Navigation architecture: 56px primary rail + 216px secondary category sub-navigation panel.
  - Category `ai_tools` (lines 116–167) contains 9 navigation items:
    1. `ai_tools` -> "Tools Hub" (`Layers` icon)
    2. `ai_writing_detector` -> "AI Writing Detector" (`ScanEye` icon)
    3. `plagiarism_checker` -> "Plagiarism Checker" (`FileSearch` icon)
    4. `ai_humanizer` -> "AI Humanizer" (`RefreshCw` icon)
    5. `academic_writing_assistant` -> "Academic Writing Assistant" (`PenTool` icon)
    6. `paraphrasing_tool` -> "Paraphrasing Tool" (`RefreshCw` icon)
    7. `citation_checker` -> "Citation Checker" (`CheckCircle2` icon)
    8. `readability_analyzer` -> "Readability Analyzer" (`BarChart2` icon)
    9. `research_integrity` -> "Research Integrity" (`ShieldCheck` icon)
  - **Issue**: Line 119 sets `shortLabel: "Tools"`. Consequently, button tooltip is `Tools (Click to open)`, whereas unit tests in `src/test/two-column-sidebar-and-navigation.test.tsx` and `phase7-app-shell.test.tsx` expect `AI Tools (Click to open)`.
- **AppShell Router (`src/components/layout/AppShell.tsx:110-124`)**:
  - `ai_tools` renders `<AiToolsHubView />`.
  - `ai_humanizer`, `academic_writing_assistant`, `paraphrasing_tool` render `<AcademicWritingWorkspaceView toolId={activeSection} />`.
  - `citation_checker` renders `<CitationCheckerWorkspaceView />`.
  - `readability_analyzer` renders `<ReadabilityAnalyzerView />`.
  - `research_integrity` renders `<ResearchIntegrityView />`.
  - `ai_writing_detector`, `plagiarism_checker` render `<AiToolWorkspaceView toolId={activeSection} />`.
- **Command Palette (`src/lib/search/commandRegistry.ts`)**:
  - Commands registered for quick switching (`Ctrl+K`): `cmd_tools_hub`, `cmd_ai_detector`, `cmd_plagiarism`, `cmd_humanizer`, `cmd_writing_assistant`, `cmd_paraphraser`, `cmd_citation_checker`, `cmd_readability`, `cmd_research_integrity`.

---

### 2.2 Tools Hub (`src/features/ai-tools/AiToolsHubView.tsx`)
- **Purpose**: Central catalog and hardware monitor for the Research Tools suite.
- **Backend Connection**:
  - Invokes `getAiEngineStatus()` (`ai_tools.rs:get_ai_engine_status` or local HTTP check on port 11435).
  - Invokes `getHardwareProfile()` (`system.rs:get_hardware_profile` returning RAM, GPU, CPU, recommended tier).
  - Opens `InAppModelManagerModal.tsx` for managing compact local GGUF models.
- **Defects & Discrepancies**:
  - Lines 257 & 261: Badge is `"Research Tools Suite"`, heading is `"Professional Academic Research Tools"`. The tests in `two-column-sidebar-and-navigation.test.tsx:147` expect `"AI Research & Writing Suite"` and `"Professional AI Academic Tools"`.
  - Line 272: Text displays `"8 Specialized Academic Tools"`, referring to the 8 analytical tools launched from the hub.

---

### 2.3 AI Writing Detector (`src/features/ai-tools/AiToolWorkspaceView.tsx`)
- **Purpose**: Empirical stylometric analysis evaluating sentence length variance, uniformity, and lexical cadence.
- **Backend Connection**:
  - `ingestDocumentContent("detector_doc.txt", "txt", inputText)`: Hashes document via SHA-256 and stores in SQLite `integrity_documents`.
  - `startAnalysisJob("ai_writing_detection", docHash)`: Creates row in `analysis_jobs`.
  - `detectAiSignals(inputText)`: Invokes Tauri `detect_ai_signals`, which delegates to Python `PythonEngineService::detect_ai_signals`.
- **Defects & Fabrications**:
  - **Crude Heuristics (lines 315–372)**:
    - Probability score is calculated using `aiProb = Math.min(96, Math.max(8, Math.round(uniformityScore * 0.5 + clicheCount * 12 + 15)))`.
    - Only checks a static list of 10 clichés (`"in recent years"`, `"it is important to note"`, etc.).
    - Line 358: Any sentence with between 16 and 22 words (`len >= 16 && len <= 22`) is arbitrarily marked `isSuspect: true`.
  - **Simulated Progress (lines 539–560)**:
    - Frontend steps progress: `setJobProgress(15)` -> `setJobProgress(35)` -> `setJobProgress(60)` -> `setJobProgress(100)`.
    - Backend `start_analysis_job` (`ai_tools.rs:126-157`) spawns a tokio task that sleeps 100ms, sets 35%, sleeps 150ms, sets 70%, sleeps 100ms, and emits a dummy JSON payload `{ "status": "ready" }`.
  - **Mock Fallback (`desktop-api/index.ts:2345`)**:
    - Non-Tauri fallback returns fixed mock: `overall_signal_score: 0.35`, `variance: 2.5`, `burstiness: 0.15`.

---

### 2.4 Plagiarism Checker (`src/features/ai-tools/AiToolWorkspaceView.tsx`)
- **Purpose**: Winnowing n-gram text overlap scanner.
- **Backend Connection**: None.
- **Defects & Misleading Claims**:
  - **Missing External Corpus**: Hub claims comparison against "your saved library papers and open academic reference corpus." In reality, lines 375–418 compare 4-grams strictly against `useApp().papers`. If the user has 0 papers in library, plagiarism score is always 0%.
  - **Missing Execute Handler**: There is no button to execute or trigger the plagiarism scanner. It executes unconditionally in a React `useMemo` as the user types.
  - **Missing File Upload**: No file upload input or file reader is integrated.

---

### 2.5 Academic Writing Workspace (AI Humanizer, Academic Writing Assistant, Paraphrasing Tool)
- **File**: `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx` (775 lines).
- **Architecture**:
  - Mode registry in `writingEngine.ts`:
    - `HUMANIZER_MODES`: 12 modes (Natural Flow, Clarity, Formal Tone, Sentence Variety, Redundancy, Transitions, etc.).
    - `ACADEMIC_WRITING_MODES`: 9 modes (Abstract Drafting, Intro, Lit Review, Methodology, Results, Discussion, Conclusion, Grammar, Academic Tone).
    - `PARAPHRASING_MODES`: 8 modes (Academic Restatement, Sentence Level, Paragraph Level, Technical Paraphrase, Expand, Simplification, Dense Summary, Formal Scholarly).
  - **Token Preservation Guard (`tokenPreservationGuard.ts`)**:
    - Uses regex extraction to detect and lock invariant tokens: citations (`[1]`, `(Vaswani et al., 2017)`), canonical DOIs (`10.1109/...`), LaTeX math formulas (`$...$`, `$$...$$`), numbers/percentages (`14.2%`), statistical expressions (`p < 0.05`).
    - Detects semantic drift: correlation turned into causation (`drift_correlation_causation`), statistical non-significance altered to significant (`drift_significance_inverted`), and stripping of hedging/limitations (`drift_limitation_removed`).
  - **Backend Connection & Persistence**:
    - Rewriting executes via `generateAiResponse` (Tauri invoke `generate_ai_response` contacting Ollama, NIM, or local sidecar) or `applyLocalHeuristicRewriting` (0 MB RAM offline rule-based transformation).
    - Snapshots and accepted revisions persist to SQLite `writing_revisions` table via `saveWritingRevisionDb` and `listWritingRevisionsDb`.
  - **UI Capabilities**:
    - Undo/Redo stack with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).
    - `SideBySideDiffViewer.tsx`: Word-level diff (`computeWordDiff`), synchronized scrolling, editable panes.
    - `RevisionHistoryDrawer.tsx`: History drawer with restore capabilities.
    - `PrivacyConfirmationModal.tsx`: Warning modal prior to sending text to cloud providers.
    - `AttributionNoticeBanner.tsx`: Academic attribution reminder for paraphrasing.
    - Export options: `.md`, `.txt`, `.json` validation report.
  - **Redundancy Note**:
    - `AiToolWorkspaceView.tsx` also contains legacy stub implementations of writing assistant (lines 491-497), humanizer (lines 498-499), and paraphraser (lines 500-502), which are superseded by `AcademicWritingWorkspaceView.tsx`.

---

### 2.6 Citation Checker (`src/features/citation-checker/CitationCheckerWorkspaceView.tsx`)
- **File**: `src/features/citation-checker/CitationCheckerWorkspaceView.tsx` (522 lines).
- **Core Modules**:
  - `consistencyEngine.ts`: Splits document into body and bibliography; extracts in-text citations; parses bibliography references; cross-references citation markers against bibliography keys; identifies missing references, uncited bibliography items, duplicate entries, and metadata discrepancies.
  - `doiValidator.ts`: Validates DOI syntax strictly against Crossref/IDF specifications; cross-checks against offline ground-truth benchmark registry (`CANONICAL_DOI_REGISTRY` covering attention, BERT, ResNet, etc.).
  - `styleFormatters.ts`: Auto-formats parsed references into IEEE, APA, MLA, Chicago, Harvard, and BibTeX.
- **Backend Connection & Persistence**:
  - `saveCitationAuditDb`: Persists audit report to SQLite `saved_citation_audits` table.
  - `ingestDocumentContent`: Hashes and records document in `integrity_documents`.
- **Defects**:
  - **Binary File Upload Corruption (line 111)**:
    ```typescript
    reader.readAsText(file);
    ```
    The file input accepts `.pdf` and `.docx`, but `readAsText` decodes raw binary data as UTF-8, filling the document with corrupt replacement characters (`\uFFFD`). It fails to invoke the backend `extract_document_text` Tauri command.

---

### 2.7 Readability Analyzer (`src/features/readability/ReadabilityAnalyzerView.tsx`)
- **File**: `src/features/readability/ReadabilityAnalyzerView.tsx` (670 lines).
- **Core Modules**:
  - `readabilityEngine.ts`: Calculates 6 classical formulas:
    - Flesch Reading Ease: `206.835 - (1.015 * ASL) - (84.6 * ASW)`
    - Flesch-Kincaid Grade Level: `(0.39 * ASL) + (11.8 * ASW) - 15.59`
    - Gunning Fog Index: `0.4 * (ASL + complex_percentage)`
    - Coleman-Liau Index: `0.0588 * L - 0.296 * S - 15.8`
    - SMOG Index: `1.0430 * sqrt(complex_count * (30 / sentence_count)) + 3.1291`
    - Automated Readability Index (ARI): `4.71 * (characters / words) + 0.5 * ASL - 21.43`
  - Language detection with limitation caveats for non-English documents.
  - Syllable counting, polysyllabic complex word identification, passive voice ratio, lexical diversity (TTR), and frequent repeated phrases.
- **Backend Connection & Persistence**:
  - Hashes document via `ingestDocumentContent`.
  - Checks SQLite cache via `getReadabilityReportByHashDb`.
  - Saves new reports to SQLite via `saveReadabilityReportDb`.
- **Defects**:
  - **Binary File Upload Corruption (line 144)**:
    Calls `reader.readAsText(file)` on `.pdf` and `.docx`, corrupting binary files into raw text strings instead of routing through `extract_document_text`.

---

### 2.8 Research Integrity Suite (`src/features/integrity/ResearchIntegrityView.tsx`)
- **File**: `src/features/integrity/ResearchIntegrityView.tsx` (549 lines).
- **Core Modules**:
  - `integrityEngine.ts`: Evaluates 7 independent dimensions without arbitrary aggregate scores:
    1. Similarity & Text Overlap
    2. Stylometric AI Signal Extraction
    3. Citation & DOI Verification
    4. Bibliographic Metadata Consistency
    5. Structural Rigor & Methodological Reproducibility
    6. Author Disclosures & Ethics Compliance (COI, IRB)
    7. Data & Code Availability Statements
  - `reportStore.ts`: Local storage backup cache.
- **Backend Connection & Persistence**:
  - Ingests document via `ingestDocumentContent`.
  - Saves reports to SQLite via `saveIntegrityReportDb`.
  - Persists human reviewer status and notes via `updateIntegrityFindingReviewDb`.
  - Queries saved reports via `listSavedIntegrityReportsDb`.
- **Defects**:
  - **Binary File Upload Corruption (line 185)**:
    Calls `reader.readAsText(file)` on `.docx` and `.rtf`.

---

### 2.9 The 9th Tool & Extended Suite Views

#### The 9th Tool: Tools Hub (`src/features/ai-tools/AiToolsHubView.tsx`)
In the sidebar menu under "Research Tools", there are 9 items:
1. **Tools Hub** (`ai_tools`)
2. AI Writing Detector (`ai_writing_detector`)
3. Plagiarism Checker (`plagiarism_checker`)
4. AI Humanizer (`ai_humanizer`)
5. Academic Writing Assistant (`academic_writing_assistant`)
6. Paraphrasing Tool (`paraphrasing_tool`)
7. Citation Checker (`citation_checker`)
8. Readability Analyzer (`readability_analyzer`)
9. Research Integrity (`research_integrity`)

Tools Hub is the 9th item that binds the suite together with model management and hardware diagnostics.

#### Extended Research Views in the Workspace:
1. **Saved Reports & Exports (`src/features/reports/SavedReportsView.tsx`)**:
   - Status: **Mock Implementation**.
   - Lines 29–63 hold a static array in React state:
     - "Deep Learning Load Forecasting Review Matrix" (CSV, Oct 28, 2026)
     - "IEEE Open Access Synthesis & Provenance Summary" (Markdown, Oct 27, 2026)
     - "Master Bibliography Export" (BibTeX, Oct 26, 2026)
   - Does NOT read from `listSavedIntegrityReportsDb()` or SQLite tables.
2. **Review Matrix (`src/features/review-matrix/ReviewMatrixView.tsx`)**:
   - Status: **Functional**.
   - Literature review comparison matrix with evidence copilot, cell-level claim inspector, and SQLite workspace persistence.
3. **Literature Workspace (`src/features/literature-workspace/LiteratureWorkspaceView.tsx`)**:
   - Status: **Functional**.
   - 3-pane resizable layout (Collection, Matrix, PDF Evidence).
4. **AI Diagnostics (`src/features/ai-hub/AiDiagnosticsView.tsx`)**:
   - Status: **Functional**.
   - Real-time latency, credential, and health checks for Ollama, NIM, OpenRouter, and local sidecar.

---

### 2.10 Shared Components, Theme Engine, PDF Reader, and Global Loading

#### PDF Reader Integration (`src/components/pdf-viewer/EmbeddedPdfViewer.tsx`)
- Full-featured viewer powered by `pdfjs-dist` v6.4.299 with Vite-bundled worker (`pdf.worker.min.mjs?url`).
- 12-state finite state machine (`IDLE`, `RESOLVING_SOURCE`, `CHECKING_ACCESS`, `FETCHING_DOCUMENT`, `VALIDATING_DOCUMENT`, `PARSING_DOCUMENT`, `RENDERING_FIRST_PAGE`, `READY`, etc.).
- Features: Text selection floating menu (`TextSelectionMenu.tsx`), outline navigation, bookmarks, in-document search with highlights, side-by-side AI copilot panel (`PdfRightPanel.tsx`), reader state persistence to SQLite via `saveReaderState`.
- Modal launch: Rendered via portal in `AppShell.tsx:216-229` whenever `readingPaper` is active in `AppContext`.

#### Theme Engine (`src/components/theme/ThemeProvider.tsx`)
- Supports `light`, `dark`, and `system` modes.
- Curated presets (Midnight Blue, Emerald, Crimson, Amber, Slate, etc.), custom accent hex codes, interface density (compact, normal, spacious), motion preferences, and particle intensity.
- Circular splash animation on theme toggle (`executeThemeSplash`).
- Persists to both localStorage and SQLite backend (`loadDbThemeSettings`, `persistThemeSettings`).

#### Global Loading & Animations
- `AITypingIndicator.tsx`: Animated typing pulse with configurable speed.
- `GlobalLoadingOverlay.tsx`: Full-screen overlay with status steps.
- `ParticleField.tsx`: Three.js / Canvas particle effect with graceful CPU fallback.
- `PageTransition.tsx`: Framer-motion page transition wrapper.

---

## 3. Frontend Testing Setup & Execution Audit

### 3.1 Test Configuration
- **Test Runner**: Vitest v5.0.5 (`vitest run`).
- **Environment**: `jsdom` v29.1.1.
- **Setup File**: `src/test/setup.ts` (configures `@testing-library/jest-dom`, mocks `window.matchMedia`, `IntersectionObserver`, `ResizeObserver`, canvas context).
- **Offline Capability**: **100% Offline-capable**. All tests mock or fallback when Tauri IPC or cloud APIs are absent. No tests require active internet connectivity.

### 3.2 Full Test Suite Run Results (`npm test`)
- Total Test Files: **52**
- Total Tests: **578**
- **Passed Test Files**: **46** (567 tests passed)
- **Failed Test Files**: **6** (11 tests failed)

### 3.3 Root Cause Analysis of the 6 Failing Test Files

| Failed Test File | Failed Test Description | Root Cause |
|---|---|---|
| `src/test/two-column-sidebar-and-navigation.test.tsx` (4 failures) | 1. Renders sidebar rail<br>2. Switches category<br>3. Collapses/re-expands<br>4. Renders AI Tools Hub | • In `Sidebar.tsx:119`, `shortLabel` was changed to `"Tools"` instead of `"AI Tools"`, causing `getByTitle(/AI Tools \(Click to open\)/i)` to fail.<br>• In `AiToolsHubView.tsx:257,261`, text is `"Research Tools Suite"` and `"Professional Academic Research Tools"`, while test expects `"AI Research & Writing Suite"` and `"Professional AI Academic Tools"`. |
| `src/test/phase7-app-shell.test.tsx` (3 failures) | 1. Primary rail categories<br>2. Active indicator line<br>3. Associated sub-nav items | In `Sidebar.tsx:119`, category rail button title is `Tools (Click to open)` instead of `AI Tools (Click to open)`. |
| `src/test/crawl-engine.test.tsx` (1 failure) | Renders DownloadsView & displays crawl jobs | `DownloadsView` renders heading `"Download Manager & Retrieval"`, but test expects `"Downloads & Retrieval Jobs"`. |
| `src/test/phase14-ai-engine.test.tsx` (1 failure) | Renders MultiPaperComparisonPanel & displays Novelty Alert Banner | Test searches for `/Select Papers to Compare/`, which was rephrased in `MultiPaperComparisonPanel.tsx`. |
| `src/test/phase8-page-transitions.test.tsx` (1 failure) | Preserves DiscoverView mounted state across tab switching | Query `getByRole("button", { name: /Discover Papers/i })` matches multiple elements (in rail, toolbar, and sidebar subnav). |
| `src/test/AppShell.test.tsx` (1 failure) | Navigates across main sections via sidebar | Query `getByRole("heading", { name: "Research Collections" })` matches multiple elements (page title and collection card). |

**Note**: All dedicated Research Tools tests (`academic-writing-workspace.test.tsx`, `citation-checker.test.tsx`, `readability-and-integrity.test.tsx`, and `phase9-backend-integration.test.tsx`) **pass cleanly**.

---

## 4. Reusable Frontend Components & Design Patterns

1. **`SideBySideDiffViewer`** (`src/features/writing-workspace/components/SideBySideDiffViewer.tsx`):
   - Dual-pane layout displaying original text side-by-side with revision.
   - Computes word-level diff (`computeWordDiff`) highlighting added (green) and removed (red) phrases.
   - Synchronized scroll locking and paragraph-level inspection.
2. **`TokenGuardBanner`** (`src/features/writing-workspace/components/TokenGuardBanner.tsx`):
   - Real-time indicator displaying preservation score (0–100) and flagging dropped citations, equations, numbers, or semantic hedging drift.
   - Includes quick-fix action buttons to restore lost tokens.
3. **`DimensionCards`** (`src/features/integrity/components/DimensionCards.tsx`):
   - Reusable multi-dimensional metric cards with status badges (compliant, concern, review needed) and score meters.
4. **`FindingsTable`** (`src/features/integrity/components/FindingsTable.tsx`):
   - Traceable findings list showing snippet evidence, line/paragraph location, severity chips, and human reviewer toggle.
5. **`CitationSummaryCards`** (`src/features/citation-checker/components/CitationSummaryCards.tsx`):
   - High-impact KPI grid for overall health score, orphan citation count, uncited bibliography entries, and DOI resolution rates.
6. **`ReferenceInspectorDrawer`** (`src/features/citation-checker/components/ReferenceInspectorDrawer.tsx`):
   - Slide-over inspector displaying parsed bibliographic metadata, live DOI verification badge, backlink locations of in-text citations, and one-click citation reformatting (IEEE, APA, MLA, Chicago, Harvard, BibTeX).
7. **`ConfirmDialog`** (`src/components/ui/ConfirmDialog.tsx`):
   - Accessible modal dialog for destructive or irreversible actions (e.g., overwriting original drafts, discarding revisions).
8. **`LiveOrb`** (`src/components/ui/live-orb.tsx`):
   - WebGL / Canvas interactive orb used to provide visual feedback during background AI generation.

---

## 5. Prioritized Frontend Remediation Recommendations

1. **Fix Binary Document Upload in Research Tools**:
   - Update `CitationCheckerWorkspaceView.tsx`, `ReadabilityAnalyzerView.tsx`, and `ResearchIntegrityView.tsx` to detect file extensions (`.pdf`, `.docx`).
   - For binary files, invoke the Tauri backend command `extract_document_text` (which delegates to the Python extractor) rather than calling browser `FileReader.readAsText`.
2. **Connect Saved Reports View to Real SQLite Tables**:
   - Replace the hardcoded mock array in `SavedReportsView.tsx` with calls to `listSavedIntegrityReportsDb()`, `listCitationAuditsDb()`, and `listWorkspaces()`.
3. **Stabilize Plagiarism Checker**:
   - Add an explicit "Run Plagiarism Scan" button in `AiToolWorkspaceView.tsx`.
   - Wire the scanner to search saved local paper texts in SQLite and clarify UI messaging regarding corpus scope.
4. **Fix Python Engine `signals.py` Variable Typo**:
   - Fix line 59 in `python-engine/src/paper_scraper/ai/signals.py` from `replacement_count < 5` to `replacement_chars < 5`.
5. **Harmonize Navigation Labels with Automated Tests**:
   - Align `Sidebar.tsx` shortLabel (`"AI Tools"` vs `"Tools"`) and `AiToolsHubView.tsx` header text (`"Professional AI Academic Tools"`) so that all 6 failing test suites pass.
6. **Replace Simulated Background Jobs**:
   - Replace the `tokio::time::sleep` loop in `start_analysis_job` with actual statistical calculation events.
