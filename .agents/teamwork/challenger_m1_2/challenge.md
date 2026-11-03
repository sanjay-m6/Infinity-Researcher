# Empirical Verification & Adversarial Challenge Report

**Audit Target**: `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md`  
**Challenger**: `challenger_m1_2` (Teamwork Empirical Challenger / Critic & Specialist)  
**Date**: November 3, 2026  
**Verdict**: **APPROVE** (with critical empirical qualification on IPC protocol)

---

## 1. Executive Summary

This report delivers an empirical forensic verification of the findings and defects documented in `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md`. Rather than relying on static code analysis or claims made in audit logs, each cited defect was directly inspected in the source files, tested via executable verification code, reproduced in terminal sessions, or stress-tested against the underlying runtimes (Python 3.14, Rust MSVC toolchain, Node.js, and SQLite3).

### Summary Table of Verified Defects

| # | Cited Defect & Location | Audit Claim | Empirical Verification Result | Status |
|---|---|---|---|---|
| **1** | `python-engine/src/paper_scraper/ai/signals.py:59` | Undefined variable `replacement_count` causing runtime crash | Executed `extract_document_file('README.md')`. Throws `NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?` | **CONFIRMED & REPRODUCED** |
| **2** | `CitationCheckerWorkspaceView.tsx:111`<br>`ReadabilityAnalyzerView.tsx:144`<br>`ResearchIntegrityView.tsx:185` | `reader.readAsText` corrupts binary PDF/DOCX into UTF-8 replacement characters (`\uFFFD`) | Inputs specify `.docx,.pdf`, call `readAsText(file)` directly. Confirmed binary byte stream decoded as UTF-8 produces replacement characters and corrupts text. Backend extraction commands are bypassed. | **CONFIRMED & REPRODUCED** |
| **3** | `src-tauri/src/commands/ai_tools.rs:126-157` | `tokio::time::sleep` simulated progress emitting dummy results | Direct inspection of lines 126–157: spawns async task with 100ms + 150ms + 100ms sleeps, hardcoded 35%, 70%, and dummy `{ "status": "ready" }` JSON. No text evaluation performed. | **CONFIRMED & VERIFIED** |
| **4** | `src-tauri/src/services/python_engine.rs:869-876` vs `protocol.py` | IPC field mismatch (`type == "response"`, `reply_to` vs `request_id`) causes 30s RPC timeout | **NUANCED CHALLENGE**: Audit cited `paper_scraper/protocol.py:74-82`. However, the active sidecar entrypoint (`runner.py`) actually imports `paper_scraper.integration.protocol`, which emits `"type": "response"`, `"reply_to"`, and `"response_type"`. Live sidecar process confirmed exact field match with Rust. The duplicate protocol file in `paper_scraper/protocol.py` is dead/divergent code. | **CHALLENGED / CLARIFIED** |
| **5** | `src-tauri/src/repositories/ai_tools_repo.rs:580` | `save_writing_revision` parent session foreign key hazard | `writing_revisions.session_id` has `FOREIGN KEY REFERENCES writing_sessions(id) ON DELETE CASCADE`. SQLite enforces `PRAGMA foreign_keys = ON;`. Zero rows exist in `writing_sessions`. Confirmed Python/SQLite raises `sqlite3.IntegrityError: FOREIGN KEY constraint failed`. Frontend catches and swallows error. | **CONFIRMED & REPRODUCED** |
| **6** | `SavedReportsView.tsx:29-63` | Static mock array in React state | Direct inspection confirms `useState<SavedReportItem[]>([...])` initialized with 3 hardcoded mock objects (`"report-1"`, `"report-2"`, `"report-3"`). No backend queries or persistence. | **CONFIRMED & VERIFIED** |

---

## 2. In-Depth Empirical Verification & Reproduction

### 2.1 Defect 1: Python Engine `signals.py:59` `NameError` Crash

- **Source Inspection**:
  In `python-engine/src/paper_scraper/ai/signals.py:55-60`:
  ```python
  words = raw_text.split()
  word_count = len(words)
  char_count = len(raw_text)
  replacement_chars = raw_text.count("\ufffd")
  is_clean = replacement_count < 5  # <-- NameError
  ```
- **Empirical Execution Command**:
  ```bash
  python -c "import sys; sys.path.insert(0, 'python-engine/src'); from paper_scraper.ai.signals import extract_document_file; extract_document_file('README.md')"
  ```
- **Execution Result (Exit Code 1)**:
  ```text
  Traceback (most recent call last):
    File "<string>", line 1, in <module>
    File "D:\Paper\python-engine\src\paper_scraper\ai\signals.py", line 59, in extract_document_file
      is_clean = replacement_count < 5
                 ^^^^^^^^^^^^^^^^^
  NameError: name 'replacement_count' is not defined. Did you mean: 'replacement_chars'?
  ```
- **Blast Radius**:
  Any call to `extract_document_file` on plain text, markdown, LaTeX, or PDF files crashes immediately.
- **Why Tests Missed It**:
  Inspection of `python-engine/tests/test_ai_module.py` confirmed it tests `chunk_text_content`, `evaluate_hardware_capability`, and `prepare_finetuning_dataset`, but has zero test cases invoking `extract_document_file` or `compute_statistical_ai_signals`.

---

### 2.2 Defect 2: Binary Document Upload Corruption via `FileReader.readAsText`

- **Source Inspection**:
  - `src/features/citation-checker/CitationCheckerWorkspaceView.tsx:111`:
    - Line 177: `<input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.tex,.bib,.docx,.pdf" className="hidden" />`
    - Line 111: `reader.readAsText(file);`
  - `src/features/readability/ReadabilityAnalyzerView.tsx:144`:
    - Line 225: `<input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.tex,.bib,.docx,.pdf" className="hidden" />`
    - Line 144: `reader.readAsText(file);`
  - `src/features/integrity/ResearchIntegrityView.tsx:185`:
    - Line 289: `<input ref={fileInputRef} type="file" accept=".txt,.md,.tex,.docx,.rtf" onChange={handleFileUpload} className="hidden" />`
    - Line 185: `reader.readAsText(file);`
- **Empirical Execution (Node.js Buffer Decoding)**:
  ```bash
  node -e "const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00, 0xff, 0xfe]); const str = buf.toString('utf-8'); console.log('Length:', str.length, 'Contains replacement chars:', str.includes('\ufffd'));"
  ```
- **Execution Result**:
  ```text
  Length: 14 Contains replacement chars: true
  ```
- **Blast Radius**:
  Binary document formats (`.docx`, `.pdf`, `.rtf`) are corrupted into replacement characters upon selection. The backend document extraction commands (`extract_document_text` / `extract_document_file`) are never triggered from these workspaces.

---

### 2.3 Defect 3: Simulated Timer Progress in `start_analysis_job`

- **Source Inspection**:
  In `src-tauri/src/commands/ai_tools.rs:126-157`:
  ```rust
  tokio::spawn(async move {
      tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
      if let Ok(conn) = db_clone.lock() {
          let _ = AiToolsRepository::update_job_progress(
              &conn,
              &job_id_clone,
              35,
              "Parsing syntax & extracting statistical features",
          );
      }

      tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
      if let Ok(conn) = db_clone.lock() {
          let _ = AiToolsRepository::update_job_progress(
              &conn,
              &job_id_clone,
              70,
              "Evaluating cross-dimensional consistency",
          );
      }

      tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
      if let Ok(conn) = db_clone.lock() {
          let dummy_res = serde_json::json!({
              "document_hash": doc_hash_clone,
              "status": "ready",
              "completed_at": chrono::Utc::now().to_rfc3339()
          })
          .to_string();
          let _ = AiToolsRepository::complete_analysis_job(&conn, &job_id_clone, &dummy_res);
      }
  });
  ```
- **Forensic Finding**:
  Confirmed as a synthetic mock routine. The job sleeps for 350ms total, updates hardcoded progress steps (35% and 70%), and writes dummy JSON without inspecting `document_hash` or invoking any statistical or signal extraction logic.

---

### 2.4 Defect 4: Adversarial Challenge — IPC Protocol Compatibility

- **Audit Report Claim**:
  Section 4.3 of the audit claimed that `src-tauri/src/services/python_engine.rs:869-876` and `python-engine/src/paper_scraper/protocol.py:74-82` have an incompatible protocol:
  - Rust checks `type == "response"`, `reply_to == req_id`, and `response_type == expected_result_type`.
  - Python emits `type == response_type`, `request_id == req_id`.
  - Conclusion: All RPC requests hang for 30s.
- **Adversarial Discovery & Empirical Challenge**:
  An adversarial trace across the codebase revealed that there are **two different protocol files**:
  1. `python-engine/src/paper_scraper/protocol.py`: contains `emit_response(response_type, request_id, payload)` emitting `"type": response_type`, `"request_id": request_id`.
  2. `python-engine/src/paper_scraper/integration/protocol.py`: contains `emit_response(response_type, request_id, payload)` emitting:
     ```python
     msg = {
         "version": PROTOCOL_VERSION,
         "type": "response",
         "reply_to": request_id,
         "response_type": response_type,
         "payload": payload,
     }
     ```
  Crucially, when Rust spawns Python via `python -m paper_scraper`, `python-engine/src/paper_scraper/__main__.py:13` calls:
  ```python
  from paper_scraper.integration.runner import run_sidecar
  run_sidecar()
  ```
  And `paper_scraper/integration/runner.py:16` imports:
  ```python
  from paper_scraper.integration.protocol import PROTOCOL_VERSION, emit_log, emit_response
  ```
- **Empirical Execution (Interactive Python Sidecar Pipe)**:
  Sent `{"type": "eval_hardware", "request_id": "test-123"}` over stdin to `python -m paper_scraper`.
- **Actual Output Captured on stdout**:
  ```json
  {"version": "1.0.0", "type": "log", "level": "info", "message": "Python Scrapy Paper Discovery Engine v1.0.0 started"}
  {"version": "1.0.0", "type": "response", "reply_to": "test-123", "response_type": "eval_hardware_result", "payload": {"hardware": {"cuda_available": false, ...}}}
  {"version": "1.0.0", "type": "log", "level": "info", "message": "stdin EOF reached, shutting down"}
  ```
- **Comparison with Rust `execute_rpc` in `services/python_engine.rs:869-877`**:
  - `parsed.get("type") == Some("response")` -> **MATCHES** (`"response"`)
  - `parsed.get("reply_to") == Some(&req_id)` -> **MATCHES** (`"test-123"`)
  - `parsed.get("response_type") == expected_result_type` -> **MATCHES** (`"eval_hardware_result"`)
- **Conclusion on Defect 4**:
  The audit report's claim that a 30s timeout hang occurs due to a protocol mismatch was based on reviewing the wrong (dormant) `protocol.py`. At runtime, the active `integration/protocol.py` already implements the exact protocol that Rust expects.
  **However**, having two divergent `protocol.py` files in `paper_scraper` is a legitimate maintenance and refactoring hazard. Reconciling or removing the redundant duplicate in `paper_scraper/protocol.py` is recommended.

---

### 2.5 Defect 5: Foreign Key Hazard in `save_writing_revision`

- **Source Inspection**:
  - Schema (`src-tauri/migrations/0008_research_integrity_and_writing.sql:134-142`):
    ```sql
    CREATE TABLE IF NOT EXISTS writing_revisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
        ...
    );
    ```
  - Repository (`src-tauri/src/repositories/ai_tools_repo.rs:579-603`):
    `save_writing_revision` directly executes `INSERT INTO writing_revisions (id, session_id, ...)` without ensuring `session_id` exists in `writing_sessions`.
  - Frontend (`src/features/writing-workspace/AcademicWritingWorkspaceView.tsx:94, 249-263`):
    Generates synthetic session IDs (`session_${toolId}`), and swallows failures via `.catch((e) => console.warn(...))`.
- **Empirical Execution (SQLite3 Foreign Key Constraint Validation)**:
  ```bash
  python -c "import sqlite3; conn = sqlite3.connect(':memory:'); conn.execute('PRAGMA foreign_keys = ON;'); conn.execute('CREATE TABLE writing_sessions (id TEXT PRIMARY KEY, title TEXT);'); conn.execute('CREATE TABLE writing_revisions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES writing_sessions(id));'); conn.execute('INSERT INTO writing_revisions (id, session_id) VALUES (?, ?)', ('rev1', 'session_ai_humanizer'))"
  ```
- **Execution Result (Exit Code 1)**:
  ```text
  sqlite3.IntegrityError: FOREIGN KEY constraint failed
  ```
- **Forensic Assessment**:
  Confirmed. Because `PRAGMA foreign_keys = ON;` is enforced by Tauri's database initialization, saving any revision without an existing row in `writing_sessions` fails immediately with an integrity error.

---

### 2.6 Defect 6: Static Mock Array in `SavedReportsView.tsx`

- **Source Inspection**:
  In `src/features/reports/SavedReportsView.tsx:29-63`:
  ```typescript
  const [reports] = useState<SavedReportItem[]>([
    {
      id: "report-1",
      title: "Deep Learning Load Forecasting Review Matrix",
      type: "matrix",
      typeLabel: "Literature Matrix",
      paperCount: 5,
      format: "CSV",
      createdDate: "Oct 28, 2026",
      fileSizeBytes: "14.2 KB",
      summary: "9-column comparative matrix covering methodology, datasets, sample sizes, and empirical findings.",
    },
    ...
  ]);
  ```
- **Forensic Assessment**:
  Confirmed. The view displays hardcoded static data from state, and provides zero wiring to SQLite queries (`listSavedIntegrityReportsDb`, `listCitationAuditsDb`, or `readability_reports`).

---

## 3. Empirical Verification of Tool Status Assessments

Each of the nine tools evaluated in Section 1.1 of the audit report was checked against its implementation code:

1. **Tools Hub (`ai_tools`)**:
   - Audit Status: **Functional** *(UI copy mismatch in unit tests)*
   - Verification: Ran `npm test src/test/two-column-sidebar-and-navigation.test.tsx`.
   - Result: Confirmed test failures due to `Sidebar.tsx:119` (`shortLabel: "Tools"` vs `"AI Tools"`) and `AiToolsHubView.tsx` (`"Professional Academic Research Tools"` vs `"Professional AI Academic Tools"`). The tool functionality itself (hardware profiler, model list) is functional.

2. **AI Writing Detector (`ai_writing_detector`)**:
   - Audit Status: **Incomplete / Simulated / Broken IPC**
   - Verification: Confirmed lines 348–358 in `AiToolWorkspaceView.tsx` clamp scores between 8% and 96% and flag all sentences between 16 and 22 words. Confirmed `desktop-api/index.ts:2345` returns static `0.35` mock payload in non-Tauri mode.

3. **Plagiarism Checker (`plagiarism_checker`)**:
   - Audit Status: **Incomplete / Disconnected**
   - Verification: Confirmed lines 375–417 in `AiToolWorkspaceView.tsx` calculate 4-gram overlap via `useMemo` strictly against loaded papers' title/abstract. If 0 papers are loaded, it returns 0%. No scan button exists; no calls are made to SQLite tables `corpus_fingerprints` or `corpus_sources`.

4. **AI Humanizer (`ai_humanizer`)**:
   - Audit Status: **Functional with FK Hazard**
   - Verification: Token preservation guard, side-by-side diff viewer, and local heuristic rewrites are functional. Foreign key hazard confirmed on revision save.

5. **Academic Writing Assistant (`academic_writing_assistant`)**:
   - Audit Status: **Functional with FK Hazard**
   - Verification: Academic drafting modes and RAG passage search wiring confirmed. Foreign key hazard confirmed on revision save.

6. **Paraphrasing Tool (`paraphrasing_tool`)**:
   - Audit Status: **Functional with FK Hazard**
   - Verification: Paraphrase modes and attribution notice banner confirmed. Foreign key hazard confirmed on revision save.

7. **Citation Checker (`citation_checker`)**:
   - Audit Status: **Functional / Broken Upload**
   - Verification: Consistency engine, DOI syntax validator, and IEEE/APA formatters confirmed functional. Upload is broken for binary PDF/DOCX via `readAsText`.

8. **Readability Analyzer (`readability_analyzer`)**:
   - Audit Status: **Functional / Broken Upload**
   - Verification: Flesch, Fog, Kincaid, Coleman-Liau, SMOG, and ARI mathematical calculations confirmed functional. Upload is broken for binary PDF/DOCX via `readAsText`.

9. **Research Integrity (`research_integrity`)**:
   - Audit Status: **Functional / Broken Upload**
   - Verification: Seven dimensional analysis engines and reviewer sign-off tables confirmed functional. Upload is broken for binary DOCX/RTF via `readAsText`.

---

## 4. Test Suite Audit Verification

1. **Frontend Vitest Suite (`npm test`)**:
   - Confirmed: 6 test suites fail due to UI label/heading discrepancies, while Research Tools feature test suites (`academic-writing-workspace.test.tsx`, `citation-checker.test.tsx`, `readability-and-integrity.test.tsx`, `phase9-backend-integration.test.tsx`) pass 100%.

2. **Rust Backend Tests (`cargo test`)**:
   - Ran `cargo test --manifest-path src-tauri/Cargo.toml --test auth_tests`.
   - Confirmed panic at `tests\auth_tests.rs:119:5`: `assertion left == right failed (left: 18, right: 12)`.
   - Confirmed schema version mismatch after migrations 0013–0018 were added without updating test assertions.

3. **Python Pytest Suite (`python -m pytest`)**:
   - Ran `python -m pytest python-engine/tests`.
   - Result: `109 passed in 17.69s (100% pass rate)`.
   - Confirmed blind spot in `test_ai_module.py`: zero tests exist for `extract_document_file` or `compute_statistical_ai_signals`, which allowed `signals.py:59` `NameError` to go undetected.

---

## 5. Adversarial Verdict & Recommendations

### Verdict: **APPROVE**

The audit document `docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md` satisfies all requirements of R1 and Phase 1 Milestone M1. Its explicit inventory of the nine Research Tools, technical risk assessments, and implementation roadmap are empirically supported by the codebase.

### Mandatory Nuance for Subsequent Phases:
- On Defect 4 (IPC Protocol), the implementation team must understand that `runner.py` uses `paper_scraper.integration.protocol.emit_response`, which **already matches** Rust's expected `{"type": "response", "reply_to": "...", "response_type": "..."}` format. The repair work in M2 should focus on removing or reconciling the duplicate `paper_scraper/protocol.py:74-82` and ensuring error responses emit clean payload structures.
