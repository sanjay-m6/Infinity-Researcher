# Handoff Report — Frontend Audit for Research Tools Module

**Agent**: `explorer_survey_1` (Teamwork Explorer)  
**Parent Conversation ID**: `b0eaf2ef-a808-46f4-a060-5d8f0f6729a2`  
**Working Directory**: `d:\Paper\.agents\teamwork\explorer_survey_1\`  
**Date**: 2026-11-03  
**Deliverables Produced**:
- Comprehensive Survey: `d:\Paper\.agents\teamwork\explorer_survey_1\survey_frontend.md`
- Handoff Report: `d:\Paper\.agents\teamwork\explorer_survey_1\handoff.md`

---

## 1. Observation

1. **Routing and Menu Navigation Layout**:
   - In `src/components/layout/Sidebar.tsx` lines 116–167, the category `ai_tools` ("Research Tools") defines exactly 9 sub-navigation items:
     - `ai_tools` ("Tools Hub")
     - `ai_writing_detector` ("AI Writing Detector")
     - `plagiarism_checker` ("Plagiarism Checker")
     - `ai_humanizer` ("AI Humanizer")
     - `academic_writing_assistant` ("Academic Writing Assistant")
     - `paraphrasing_tool` ("Paraphrasing Tool")
     - `citation_checker` ("Citation Checker")
     - `readability_analyzer` ("Readability Analyzer")
     - `research_integrity` ("Research Integrity")
   - In `src/types/domain.ts` lines 13–22, `NavSection` lists exactly the same 9 entries under `// AI Tools`.
   - In `src/components/layout/AppShell.tsx` lines 110–124, `renderActiveScreen` maps:
     - `ai_tools` -> `<AiToolsHubView />`
     - `ai_humanizer`, `academic_writing_assistant`, `paraphrasing_tool` -> `<AcademicWritingWorkspaceView toolId={activeSection} />`
     - `citation_checker` -> `<CitationCheckerWorkspaceView />`
     - `readability_analyzer` -> `<ReadabilityAnalyzerView />`
     - `research_integrity` -> `<ResearchIntegrityView />`
     - `ai_writing_detector`, `plagiarism_checker` -> `<AiToolWorkspaceView toolId={activeSection} />`

2. **Dual Implementation / Legacy Code in `AiToolWorkspaceView.tsx`**:
   - `src/features/ai-tools/AiToolWorkspaceView.tsx` (1,322 lines) still contains embedded code for humanizer, writing assistant, and paraphrasing (lines 491–502, 693–790, 850–891). However, `AppShell.tsx` routes all three to the dedicated `src/features/writing-workspace/AcademicWritingWorkspaceView.tsx`.
   - In `AiToolWorkspaceView.tsx`, lines 352 and 358 compute AI writing detector probabilities:
     ```typescript
     let aiProb = Math.min(96, Math.max(8, Math.round(uniformityScore * 0.5 + clicheCount * 12 + 15)));
     const isSuspect = hasCliche || (len >= 16 && len <= 22);
     ```
     This clamps scores arbitrarily between 8% and 96% and marks any sentence between 16 and 22 words as suspect machine text.
   - In `AiToolWorkspaceView.tsx`, lines 540–559 hardcode client progress increments: `setJobProgress(15)` -> `35` -> `60` -> `100`.
   - In `src-tauri/src/commands/ai_tools.rs` lines 126–157, `start_analysis_job` simulates progress with `tokio::time::sleep(100ms)`, sets 35%, `sleep(150ms)`, sets 70%, `sleep(100ms)`, and completes with dummy JSON `{ "status": "ready" }`.
   - In `src/lib/desktop-api/index.ts` lines 2340–2358, the non-Tauri preview fallback for `detectAiSignals` returns hardcoded `overall_signal_score: 0.35`, `variance: 2.5`, `burstiness: 0.15`.

3. **Plagiarism Checker Missing Controls**:
   - In `src/features/ai-tools/AiToolWorkspaceView.tsx` lines 375–418, plagiarism checks are run solely in a `useMemo` comparing 4-grams against in-memory `papers` state.
   - There is NO manual "Run" button for `plagiarism_checker` in `AiToolWorkspaceView.tsx` (unlike writing assistant or detector).
   - No external corpus or database full-text search is connected, contrary to the description in `AiToolsHubView.tsx:75`.

4. **Binary Document Upload Corruption**:
   - In `src/features/citation-checker/CitationCheckerWorkspaceView.tsx` line 111: `reader.readAsText(file)`.
   - In `src/features/readability/ReadabilityAnalyzerView.tsx` line 144: `reader.readAsText(file)`.
   - In `src/features/integrity/ResearchIntegrityView.tsx` line 185: `reader.readAsText(file)`.
   - All three components accept `.pdf` and `.docx` via file input, but invoke `FileReader.readAsText()`, corrupting binary files into raw text strings instead of invoking `extract_document_text` via Tauri IPC.

5. **Python Engine Latent Bug**:
   - In `python-engine/src/paper_scraper/ai/signals.py` lines 58–59:
     ```python
     replacement_chars = raw_text.count("\ufffd")
     is_clean = replacement_count < 5
     ```
     `replacement_count` is undefined and raises `NameError`.

6. **Hardcoded Mock Reports in Saved Reports View**:
   - In `src/features/reports/SavedReportsView.tsx` lines 29–63, the `reports` list is a static mock array in React `useState`:
     - "Deep Learning Load Forecasting Review Matrix" (CSV, Oct 28, 2026)
     - "IEEE Open Access Synthesis & Provenance Summary" (Markdown, Oct 27, 2026)
     - "Master Bibliography Export (IEEE Format)" (BibTeX, Oct 26, 2026)
   - It is not wired to `listSavedIntegrityReportsDb()`, `listCitationAuditsDb()`, or SQLite tables.

7. **Vitest Automated Test Run Execution**:
   - Executing `npm test` (`vitest run`) across 52 test files:
     - **Passed**: 46 test files (567 tests).
     - **Failed**: 6 test files (11 tests).
   - Specific Research Tools test suites (`academic-writing-workspace.test.tsx`, `citation-checker.test.tsx`, `readability-and-integrity.test.tsx`, `phase9-backend-integration.test.tsx`) **pass 100%**.
   - The 6 failing test files are:
     1. `two-column-sidebar-and-navigation.test.tsx`: expects `AI Tools (Click to open)` but `Sidebar.tsx:119` has `shortLabel: "Tools"`; expects `AI Research & Writing Suite` but `AiToolsHubView.tsx:257` has `Research Tools Suite`.
     2. `phase7-app-shell.test.tsx`: expects title `AI Tools (Click to open)`.
     3. `crawl-engine.test.tsx`: expects heading "Downloads & Retrieval Jobs" but `DownloadsView` renders "Download Manager & Retrieval".
     4. `phase14-ai-engine.test.tsx`: query string mismatch in `MultiPaperComparisonPanel`.
     5. `phase8-page-transitions.test.tsx`: multiple buttons match `/Discover Papers/i`.
     6. `AppShell.test.tsx`: multiple headings match "Research Collections".

---

## 2. Logic Chain

1. *Premise*: The prompt asks to inventory the nine existing tool pages (1–8 named, plus identify the 9th tool in the codebase).
   *Step 1*: Examination of `Sidebar.tsx:116-167` and `domain.ts:13-22` proves that the Research Tools category has exactly 9 items: Tools Hub (`ai_tools`), AI Writing Detector (`ai_writing_detector`), Plagiarism Checker (`plagiarism_checker`), AI Humanizer (`ai_humanizer`), Academic Writing Assistant (`academic_writing_assistant`), Paraphrasing Tool (`paraphrasing_tool`), Citation Checker (`citation_checker`), Readability Analyzer (`readability_analyzer`), and Research Integrity (`research_integrity`).
   *Step 2*: Tools Hub (`ai_tools`) is the 9th item that coordinates and launches the 8 analytical tools.
   *Step 3*: Other research-focused tools in adjacent categories include Saved Reports (`saved_reports`), Review Matrix (`review_matrix`), and Literature Workspace (`literature_workspace`).

2. *Premise*: R1 requires identifying fake analysis percentages, mock data, stub handlers, and broken buttons.
   *Step 1*: Observations in `AiToolWorkspaceView.tsx:352,358` demonstrate that the AI Writing Detector uses arbitrary sentence length clamps (8%–96%) and marks any sentence of 16–22 words as machine text.
   *Step 2*: Observations in `ai_tools.rs:126-157` demonstrate that background analysis jobs simulate progressive stages with `sleep` and return dummy JSON.
   *Step 3*: Observations in `AiToolWorkspaceView.tsx:375-418` prove that Plagiarism Checker only searches in-memory papers and lacks a manual Run button.
   *Step 4*: Observations in `SavedReportsView.tsx:29-63` prove that Saved Reports is a hardcoded mock view not connected to SQLite.

3. *Premise*: R1 requires assessing document upload and PDF integration.
   *Step 1*: Observations in `CitationCheckerWorkspaceView.tsx:111`, `ReadabilityAnalyzerView.tsx:144`, and `ResearchIntegrityView.tsx:185` prove that file inputs accept `.pdf` and `.docx` but read them with `readAsText()`, which fatally corrupts binary documents.
   *Step 2*: A functional backend extraction command (`extract_document_text`) exists in Rust and Python, but is not called by the frontend file handlers.

4. *Premise*: R1 and Acceptance Criteria require inspecting frontend test execution and offline capability.
   *Step 1*: Execution of `vitest run` demonstrates that 46 of 52 test files pass offline without network calls.
   *Step 2*: The 6 failures are non-functional label/query mismatches resulting from UI copy changes in `Sidebar.tsx`, `AiToolsHubView.tsx`, and `DownloadsView.tsx`.

---

## 3. Caveats

- **No Code Modifications**: Per teamwork explorer constraints, this audit was strictly read-only. No source files were edited.
- **Backend Rust/Python Deep Dive Scope**: Rust backend and Python engine were inspected specifically where frontend components invoke them (`commands/ai_tools.rs`, `lib.rs`, `desktop-api/`, `runner.py`, `signals.py`). Broader scraping and crawler services were not exhaustively audited.
- **Sidecar Runtime**: Local `llama-server` on port 11435 was evaluated based on the frontend fetch handler in `AiToolWorkspaceView.tsx:149`; live binary sidecar execution was not tested under active GPU load during this survey.

---

## 4. Conclusion

1. **Architecture Status**: The Research Tools module has strong domain engines (Citation Parser, DOI Validator, Readability Formulas, Token Preservation Guard, Multi-Dimensional Integrity Auditor) and clean SQLite persistence models for writing revisions, citation audits, and readability/integrity reports.
2. **Key Defects Identified**:
   - Binary document upload defect across Citation Checker, Readability Analyzer, and Research Integrity.
   - Mock data and simulated progress in AI Writing Detector and Saved Reports View.
   - Missing Run button and missing external corpus in Plagiarism Checker.
   - Undefined variable `replacement_count` in Python engine `signals.py:59`.
   - 6 failing Vitest test files due to UI label discrepancies between tests and components.
3. **Actionable Roadmap for Implementer**:
   - Phase 1: Wire binary file inputs (`.pdf`, `.docx`) to `extract_document_text`.
   - Phase 2: Fix `replacement_chars` typo in `signals.py`.
   - Phase 3: Add explicit "Run Scan" button to Plagiarism Checker and query local SQLite paper full-text index.
   - Phase 4: Replace simulated sleep in `start_analysis_job` with genuine statistical calculations.
   - Phase 5: Wire `SavedReportsView.tsx` to `listSavedIntegrityReportsDb()`, `listCitationAuditsDb()`, and SQLite tables.
   - Phase 6: Align navigation labels in `Sidebar.tsx` and `AiToolsHubView.tsx` with unit tests to achieve 100% test pass rate.

---

## 5. Verification Method

To independently verify all observations in this audit:

1. **Frontend Test Suite Execution**:
   Run Vitest in terminal:
   ```powershell
   npm test
   ```
   *Expected Result*: 46 test files pass, 6 test files fail with the exact label mismatches documented in Section 1.7.

2. **Dedicated Tool Test Suite Verification**:
   Run the dedicated Research Tools tests:
   ```powershell
   npx vitest run src/test/academic-writing-workspace.test.tsx src/test/citation-checker.test.tsx src/test/readability-and-integrity.test.tsx src/test/phase9-backend-integration.test.tsx
   ```
   *Expected Result*: All 4 test files pass 100% (73+ tests).

3. **Inspect Binary File Upload Defect**:
   Examine line 111 of `src/features/citation-checker/CitationCheckerWorkspaceView.tsx`, line 144 of `src/features/readability/ReadabilityAnalyzerView.tsx`, and line 185 of `src/features/integrity/ResearchIntegrityView.tsx`.
   *Expected Result*: Verbatim presence of `reader.readAsText(file)` on file inputs accepting `.pdf` and `.docx`.

4. **Inspect Python Bug**:
   Examine lines 58–59 of `python-engine/src/paper_scraper/ai/signals.py`.
   *Expected Result*: `replacement_chars = raw_text.count("\ufffd")` followed by `is_clean = replacement_count < 5`.

5. **Inspect Mock Saved Reports**:
   Examine lines 29–63 of `src/features/reports/SavedReportsView.tsx`.
   *Expected Result*: Verbatim presence of hardcoded mock array in `useState`.
