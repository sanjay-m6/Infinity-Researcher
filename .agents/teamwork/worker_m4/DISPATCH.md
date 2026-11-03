# Task Assignment: Milestone 4 — Frontend Research Tools Repair & Stabilization

## Identity
- Role: Frontend Research Tools Repair Worker (`teamwork_worker`)
- Working Directory: `d:\Paper\.agents\teamwork\worker_m4\`
- Authoritative User Request: `d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Blueprint: `d:\Paper\.agents\teamwork\orchestrator\PROJECT.md`
- Master Audit Report: `d:\Paper\docs\research-tools\CURRENT_IMPLEMENTATION_AUDIT.md`

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objectives & Exclusive File Ownership

You have exclusive write ownership of the following frontend files:
1. `src/features/citation-checker/CitationCheckerWorkspaceView.tsx`
2. `src/features/readability/ReadabilityAnalyzerView.tsx`
3. `src/features/integrity/ResearchIntegrityView.tsx`
4. `src/features/ai-tools/AiToolWorkspaceView.tsx`
5. `src/features/reports/SavedReportsView.tsx`
6. `src/components/layout/Sidebar.tsx`
7. `src/features/ai-tools/AiToolsHubView.tsx`
8. `src/features/downloads/DownloadsView.tsx`
9. Any associated frontend unit test files if test expectations need exact label alignment.

### Task 1: Binary Document Upload Fix
- In `CitationCheckerWorkspaceView.tsx`, `ReadabilityAnalyzerView.tsx`, and `ResearchIntegrityView.tsx`:
  - Inspect how files are uploaded.
  - Currently, `FileReader.readAsText(file)` is called on `.pdf` and `.docx` files, corrupting binary files into raw garbled characters.
  - Wire binary file extraction properly: check file extension (`.pdf`, `.docx`). If binary, use backend document text extraction (e.g. `desktopApi.aiTools.extractDocumentText(filePath)` or Tauri `invoke('extract_document_text', { path })`, or read as ArrayBuffer/text depending on available desktop API).
  - Ensure graceful error handling if extraction fails or file is empty, with offline fallback.

### Task 2: AI Writing Detector Stabilization
- In `AiToolWorkspaceView.tsx`:
  - Excised fake clamping (`Math.min(96, Math.max(8, ...))` and arbitrary `len >= 16 && len <= 22` heuristic).
  - Remove fake client-side progress loops (`setJobProgress(15 -> 35 -> 60 -> 100)`).
  - Connect to backend `desktopApi.aiTools.detectAiSignals(text)` / `start_analysis_job` or authentic stylometric calculation so scores are genuine and dynamically derived from text features (perplexity/burstiness/sentence variance).

### Task 3: Plagiarism Checker Controls & Search
- In `AiToolWorkspaceView.tsx`:
  - Add explicit "Run Scan" trigger button to initiate scan.
  - Connect search to local library paper records / SQLite corpus fingerprints rather than only relying on un-triggered in-memory state.

### Task 4: Connect Saved Reports to SQLite Persistence
- In `SavedReportsView.tsx`:
  - Replace static mock array in `useState` (lines 29-63) with real desktop API queries (`listSavedIntegrityReportsDb()`, `listCitationAuditsDb()`, and `list_writing_revisions`).
  - Maintain clean loading, empty, and populated states.

### Task 5: Vitest Test Suite Alignment & 100% Pass
- Run `npm test` using Vitest.
- Currently, 46/52 test files pass (567/578 tests pass). The 6 failing test files are purely non-functional UI copy/label mismatches:
  1. `two-column-sidebar-and-navigation.test.tsx` (sidebar tooltip/shortLabel)
  2. `phase7-app-shell.test.tsx`
  3. `crawl-engine.test.tsx` (heading label)
  4. `phase14-ai-engine.test.tsx`
  5. `phase8-page-transitions.test.tsx`
  6. `AppShell.test.tsx`
- Align UI copy and component labels so all 52 test files pass cleanly (`npm test` passes 578/578 tests).

## Verification Requirements
- Run `npm test` and document the exact test results.
- Verify that TypeScript compilation (`npx tsc --noEmit`) succeeds with zero errors.
- Document all changes and test outputs in `d:\Paper\.agents\teamwork\worker_m4\handoff.md`.


## 2026-11-03T08:25:45Z
[Message] timestamp=2026-11-03T08:25:45Z sender=b0eaf2ef-a808-46f4-a060-5d8f0f6729a2 priority=MESSAGE_PRIORITY_HIGH content=You are worker_m4 (Frontend Research Tools Worker).
Working directory: d:\Paper\.agents\teamwork\worker_m4\
Authoritative user request: d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md
Full task instructions: d:\Paper\.agents\teamwork\worker_m4\DISPATCH.md
Project blueprint: d:\Paper\.agents\teamwork\orchestrator\PROJECT.md
Audit deliverable: d:\Paper\docs\research-tools\CURRENT_IMPLEMENTATION_AUDIT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. Fix binary document upload corruption in CitationCheckerWorkspaceView.tsx, ReadabilityAnalyzerView.tsx, and ResearchIntegrityView.tsx so .pdf and .docx files use backend document extraction instead of raw text reading.
2. Stabilize AI Writing Detector in AiToolWorkspaceView.tsx: eliminate fake clamping (8-96% / 16-22 words) and fake progress increments; wire to real stylometric analysis / detectAiSignals.
3. Plagiarism Checker: add an explicit "Run Scan" trigger button and connect search to local library paper records / SQLite corpus.
4. Wire SavedReportsView.tsx to live SQLite data queries via desktop API instead of static mock state array.
5. Fix label/copy mismatches so all 52 Vitest test files pass (578/578 tests pass on `npm test`), and verify TypeScript compilation passes cleanly (`npx tsc --noEmit`).

Document all findings, changes made, and test execution outputs in d:\Paper\.agents\teamwork\worker_m4\handoff.md. Send a completion message when done.
