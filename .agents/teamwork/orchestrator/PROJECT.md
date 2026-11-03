# Project: Infinity Researcher - Research Tools Enhancement (Phase 1)

## Architecture
Infinity Researcher is a local-first desktop application with a four-tier architecture:
1. **Frontend (React / TypeScript / Tailwind / Vite)**:
   - Navigation: `Sidebar.tsx` under category `ai_tools` ("Research Tools").
   - Tools Hub: `AiToolsHubView.tsx` (launcher, hardware monitor, model manager).
   - Analytical Tools:
     - AI Writing Detector: `AiToolWorkspaceView.tsx` (`ai_writing_detector`)
     - Plagiarism Checker: `AiToolWorkspaceView.tsx` (`plagiarism_checker`)
     - AI Humanizer: `AcademicWritingWorkspaceView.tsx` (`ai_humanizer`)
     - Academic Writing Assistant: `AcademicWritingWorkspaceView.tsx` (`academic_writing_assistant`)
     - Paraphrasing Tool: `AcademicWritingWorkspaceView.tsx` (`paraphrasing_tool`)
     - Citation Checker: `CitationCheckerWorkspaceView.tsx` (`citation_checker`)
     - Readability Analyzer: `ReadabilityAnalyzerView.tsx` (`readability_analyzer`)
     - Research Integrity: `ResearchIntegrityView.tsx` (`research_integrity`)
   - Adjacent Views: `SavedReportsView.tsx` (`saved_reports`).
   - Desktop API Bridge: `src/lib/desktop-api/index.ts` invoking Tauri commands.

2. **Rust Backend (Tauri / Tokio / Rusqlite)**:
   - Entry point: `src-tauri/src/lib.rs` (registers 230 commands).
   - Research Tools Commands: `src-tauri/src/commands/ai_tools.rs` (18 commands).
   - Repositories: `src-tauri/src/repositories/ai_tools_repo.rs`.
   - IPC & Python Engine Service: `src-tauri/src/services/python_engine.rs`.
   - In-app AI Engine & GGUF sidecar: `src-tauri/src/ai_engine.rs` (`llama-server`).
   - AI Provider Service: `src-tauri/src/services/ai_provider_service.rs` (cloud LLMs + local runtimes).

3. **Python Backend (Scrapy / RapidFuzz / PyMuPDF)**:
   - Location: `python-engine/src/paper_scraper/`.
   - Protocol & IPC: `paper_scraper/integration/protocol.py` (runtime) and `protocol.py`.
   - Runner: `paper_scraper/integration/runner.py`.
   - Signals & Document Extraction: `paper_scraper/ai/signals.py` (REPAIRED: replacement_chars, docx extraction).
   - Dual execution: Standalone PyInstaller binary (`binaries/paper-scraper-x86_64-pc-windows-msvc.exe`) or dev interpreter (`python -m paper_scraper`).

4. **Database (SQLite with WAL & Strict Foreign Keys)**:
   - Migrations: `src-tauri/migrations/0001` through `0018`.
   - Research Tools Tables: `integrity_reports`, `integrity_findings`, `citation_audits`, `readability_reports`, `writing_sessions`, `writing_revisions`, `analysis_jobs`, `corpus_fingerprints`, `similarity_runs`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Comprehensive Audit Document | Master audit report `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md` covering all 11 required sections and full 9-tool inventory | M1 | ORIGINAL_REQUEST §R1 (DONE) |
| 2 | Synthetic Test Fixtures | PDF, DOCX, and TXT synthetic papers covering standard academic sections (title, abstract, sections, citations, tables) | M2 | ORIGINAL_REQUEST §R3 (DONE) |
| 3 | Python Signals Repair | Fix `replacement_count` -> `replacement_chars` `NameError` crash in `signals.py:59` | M2 | Survey 3 / R2 (DONE) |
| 4 | Python DOCX Extraction | Add native standard library `zipfile` XML extraction for `.docx` in `signals.py` | M2 | Survey 3 / R2 (DONE) |
| 5 | Python Test Suite & Coverage | Add unit tests for `extract_document_file` and `compute_statistical_ai_signals` to `test_ai_module.py` | M2 | Survey 3 / R3 (DONE) |
| 6 | Rust-Python IPC Reconciliation | Align `PythonEngineService::execute_rpc` with Python's `type` and `request_id` response structure, resolving 30s timeout | M2 | Survey 2 / R2 (DONE) |
| 7 | Rust `start_analysis_job` Repair | Replace simulated `tokio::time::sleep` mock progress with genuine feature extraction dispatch | M3 | Survey 2 / R2 |
| 8 | Foreign Key Guard in `save_writing_revision` | Auto-ensure parent `writing_sessions` row exists to prevent FK violation errors | M3 | Survey 2 / R2 |
| 9 | Rust Integration Test Panics Fix | Update hardcoded schema versions in `auth_tests.rs` and `projects_and_ai_tests.rs` (18 vs 12/16) and citation page assert in `matrix_tests.rs` | M3 | Survey 2 / R2 |
| 10 | Rust AI Tools Integration Tests | Create `tests/ai_tools_persistence_tests.rs` testing all Research Tools DB queries | M3 | Survey 2 / R3 |
| 11 | Binary File Upload Repair | Fix `CitationCheckerWorkspaceView`, `ReadabilityAnalyzerView`, and `ResearchIntegrityView` to use backend `extract_document_text` instead of `readAsText` | M4 | Survey 1 / R2 |
| 12 | AI Writing Detector Stabilization | Eliminate fake clamping (8-96% / 16-22 words) and wire to genuine stylometric analysis | M4 | Survey 1 / R2 |
| 13 | Plagiarism Checker Controls & Search | Add explicit "Run Scan" button and connect to local paper corpus search | M4 | Survey 1 / R2 |
| 14 | Saved Reports SQLite Connection | Connect `SavedReportsView.tsx` to `listSavedIntegrityReportsDb()`, `listCitationAuditsDb()`, and SQLite persistence | M4 | Survey 1 / R2 |
| 15 | Frontend Test Suite Stabilization | Align UI copy in `Sidebar.tsx`, `AiToolsHubView.tsx`, and views with Vitest tests so all 52 test files pass | M4 | Survey 1 / R3 |
| 16 | Multi-Stack Automated Verification & Offline Resilience | Validate `npm test`, `cargo test`, `pytest` pass cleanly offline without external API keys | M5 | Acceptance Criteria |
| 17 | Final Forensic Integrity Audit | Independent verification that zero mock/dummy implementations remain and all functionality is genuine | M5 | Acceptance Criteria |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Audit Deliverable & Documentation | Produce `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md` with all 11 required sections and full 9-tool status inventory | none | DONE |
| M2 | Test Fixtures & Python Engine Repair | Generate synthetic fixtures (PDF, DOCX, TXT), fix Python `NameError`, add DOCX parsing, reconcile Rust-Python IPC, pytest verification | none | DONE |
| M3 | Rust Backend & Database Stabilization | Replace mock `start_analysis_job`, fix FK hazard in `writing_revisions`, fix schema assertion tests, add `ai_tools_persistence_tests.rs`, cargo test verification | M2 | DONE |
| M4 | Frontend Research Tools Stabilization | Fix binary uploads (`.pdf`/`.docx`), stabilize AI Writing Detector & Plagiarism Checker, wire Saved Reports to DB, fix Vitest label mismatches | M2, M3 | IN_PROGRESS |
| M5 | Full-Stack Verification & Integrity Audit | Full multi-stack test runs (`npm test`, `cargo test`, `pytest`), offline verification, Challenger stress test, Forensic Integrity Audit gate | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### Rust ↔ Python IPC Protocol
- **Transport**: Standard I/O pipes (stdin/stdout) via child process.
- **Message Format**: JSON Lines (newline-delimited).
- **Request Format (Rust -> Python)**:
  ```json
  {
    "type": "command_name",
    "request_id": "<uuid>",
    "payload": { ... }
  }
  ```
- **Response Format (Python -> Rust)**:
  ```json
  {
    "schema_version": "1.0.0",
    "type": "response",
    "reply_to": "<uuid>",
    "response_type": "command_name_result",
    "timestamp": "<iso8601>",
    "payload": { ... }
  }
  ```

### Frontend ↔ Tauri Commands
- **Document Text Extraction**:
  - Command: `extract_document_text { path: string }` -> `Result<String, String>`
- **AI Signal Detection**:
  - Command: `detect_ai_signals { text: string }` -> `Result<AiSignalResult, String>`
- **Writing Revisions**:
  - Command: `save_writing_revision { revision: WritingRevisionInput }` -> `Result<String, String>`
  - Backend must ensure parent `writing_sessions` row exists.

---

## Code Layout
- `docs/research-tools/`: Audit reports and documentation.
- `fixtures/documents/`: Synthetic test documents (PDF, DOCX, TXT).
- `scripts/`: Generation scripts (`generate_synthetic_fixtures.py`).
- `python-engine/`: Python backend services, extractors, and tests.
- `src-tauri/`: Rust backend, Tauri commands, SQLite migrations, integration tests.
- `src/`: Frontend React components, stores, hooks, tests.
