# Comprehensive Rust Backend & SQLite Database Audit: Research Tools Module

**Repository**: `infinity-researcher` (`d:\Paper`)  
**Auditor**: `explorer_survey_2` (Teamwork Explorer Agent)  
**Date**: November 3, 2026  
**Scope**: Tauri Rust Commands, SQLite Schema & Migrations, IPC & Background Workers, AI Orchestration, Test Configurations (`cargo test`)  
**Status**: Read-Only Survey Complete

---

## Executive Summary

A comprehensive investigation of the **Rust backend (`src-tauri/`)** and **SQLite database** was conducted to evaluate readiness, functionality, data persistence, and test execution for the Infinity Researcher **Research Tools** module. The audit encompassed 230 registered Tauri commands, 18 SQLite migrations, connection pool pragmas, repository layers, background workers, Python-Rust NDJSON RPC bridges, and the Rust test harness (`cargo test`).

### Key Audit Findings

1. **Rust / Tauri Commands Inventory & Mapping**:
   - `src-tauri/src/lib.rs:59-290` registers **230 Tauri commands** covering bibliographic CRUD, search streaming, crawl engines, PDF workspace, AI provider orchestration, RAG embeddings, review matrices, project planning, authentication, and specialized AI tools.
   - Specific AI Tools commands live in `src-tauri/src/commands/ai_tools.rs` (`ingest_document_content`, `start_analysis_job`, `get_analysis_job_status`, `cancel_analysis_job`, `save_integrity_report`, `get_integrity_report`, `list_saved_integrity_reports`, `delete_integrity_report`, `update_integrity_finding_review`, `save_citation_audit`, `get_citation_audit`, `list_citation_audits`, `save_writing_revision`, `list_writing_revisions`, `save_readability_report`, `get_readability_report_by_hash`, `extract_document_text`, `detect_ai_signals`).
   - AI generation & model management live in `src-tauri/src/commands/ai.rs` (`generate_ai_response`, `validate_ai_citations`) and `src-tauri/src/ai_engine.rs` (`get_hardware_profile`, `download_ai_model`, `list_installed_ai_models`, `start_in_app_ai_engine`, `stop_in_app_ai_engine`, `get_ai_engine_status`).

2. **Simulated / Mock Logic Identified in Background Workers**:
   - `start_analysis_job` (`src-tauri/src/commands/ai_tools.rs:126-157`): Rather than running real background tokenizers or similarity checks, it executes hardcoded `tokio::time::sleep` (100ms, 150ms, 100ms) with hardcoded progress increments (`35%`, `70%`, `100%`) and writes static dummy JSON (`{"status": "ready"}`).
   - `plagiarism_checker`: Migration 0008 created database tables for local corpus indexing (`corpus_sources`, `corpus_fingerprints`, `similarity_runs`, `similarity_matches`), but **zero Rust commands** are implemented to index documents or execute winnowing similarity scans. The frontend falls back to checking 4-grams against in-memory React state.

3. **Critical Inter-Process Communication (IPC) Protocol Mismatch**:
   - `PythonEngineService::execute_rpc` (`src-tauri/src/services/python_engine.rs:869-876`) waits for stdout lines matching:
     `{ "type": "response", "reply_to": req_id, "response_type": f"{msg_type}_result", "payload": ... }`
   - Python's `emit_response` (`python-engine/src/paper_scraper/protocol.py:74-82`) emits:
     `{ "type": response_type, "request_id": request_id, "payload": ... }`
   - Because `type != "response"` and `reply_to` is missing, Rust ignores Python's response line until the 30-second timeout expires, logging a warning and falling back to a simplistic Rust local heuristic (`python_engine.rs:954`).

4. **Foreign Key Integrity Hazard in Writing Revisions**:
   - Migration 0008 defines `writing_revisions` with `session_id TEXT NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE`.
   - `AiToolsRepository::save_writing_revision` (`ai_tools_repo.rs:580`) executes `INSERT INTO writing_revisions` directly without verifying or creating the parent `writing_sessions` record. With `PRAGMA foreign_keys = ON;`, any unparented revision insertion throws a SQLite foreign key constraint violation.

5. **SQLite Database Architecture & Migrations**:
   - 18 sequential SQL migration files (`migrations/0001_...` through `0018_...`) are tracked in `schema_migrations`.
   - SQLite connection management uses `Arc<Mutex<rusqlite::Connection>>` configured with `WAL` journal mode, `foreign_keys = ON`, `busy_timeout = 5000ms`, and `synchronous = NORMAL`. Automatic timestamped pre-migration backups are stored in `backups/pre_migration_<timestamp>.sqlite3.bak`.
   - The current schema version is **18**.

6. **Rust Test Suite Status (`cargo test`)**:
   - Integration tests in `src-tauri/tests/`: **14 test suites exist**. 11 test suites pass cleanly (**67 tests passing**).
   - 3 integration test failures identified:
     1. `tests/projects_and_ai_tests.rs:17`: Panics on `assert_eq!(version, 16)` because schema is now 18.
     2. `tests/auth_tests.rs:119`: Panics on `assert_eq!(info.schema_version, 12)` because schema is now 18.
     3. `tests/matrix_tests.rs:123`: Panics on `assert_eq!(evidence[0].page_number, Some(4))` because matrix cell extraction synthesis returned `Some(1)`.
   - Unit tests (`cargo test --lib`): Fails to launch on Windows with `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` because `crate-type = ["staticlib", "cdylib", "rlib"]` in `Cargo.toml` links against the shared `cdylib` in a separate output directory.
   - **Zero test suites currently exist for `commands/ai_tools.rs`, `domain/ai_tools.rs`, or `repositories/ai_tools_repo.rs`**.

---

## 1. Inventory of Rust / Tauri Backend Components

### 1.1 Tauri Command Modules (`src-tauri/src/commands/`)

| Module File | Exported Commands | Subsystem / Role | Implementation Status |
|---|---|---|---|
| `commands/ai_tools.rs` | `ingest_document_content`, `start_analysis_job`, `get_analysis_job_status`, `cancel_analysis_job`, `save_integrity_report`, `get_integrity_report`, `list_saved_integrity_reports`, `delete_integrity_report`, `update_integrity_finding_review`, `save_citation_audit`, `get_citation_audit`, `list_citation_audits`, `save_writing_revision`, `list_writing_revisions`, `save_readability_report`, `get_readability_report_by_hash`, `extract_document_text`, `detect_ai_signals` | Specialized Research Tools persistence, document hashing, and Python bridge | **Mixed**: Persistence is functional; `start_analysis_job` is simulated; `save_writing_revision` has FK hazard; `detect_ai_signals` has RPC timeout |
| `commands/ai.rs` | `list_ai_providers`, `get_ai_provider`, `save_ai_provider`, `delete_ai_provider`, `set_ai_provider_enabled`, `set_ai_provider_model`, `set_ai_provider_credential`, `clear_ai_provider_credential`, `test_ai_provider`, `diagnose_ai_system`, `test_ai_generation`, `list_ai_task_routes`, `set_ai_task_route`, `get_ai_settings`, `update_ai_settings`, `index_paper_for_rag`, `index_paper_page_texts`, `get_paper_rag_chunks`, `search_rag_passages`, `search_rag_passages_multi`, `validate_ai_citations`, `generate_ai_response`, `list_ai_chat_sessions`, `create_ai_chat_session`, `delete_ai_chat_session`, `list_ai_chat_messages`, `save_ai_chat_message`, `clear_ai_chat_session`, `get_ai_recommendations`, `submit_recommendation_feedback`, `run_ai_evaluation`, `list_ai_evaluations`, `list_ai_finetuning_jobs`, `get_ai_hardware_info`, `create_ai_finetuning_job` | Cloud AI orchestration (NVIDIA NIM, Ollama, Anthropic), RAG chunking, FTS retrieval, and chat | **Functional** (Privacy guards, credential masking, token limiters intact) |
| `ai_engine.rs` | `get_hardware_profile`, `download_ai_model`, `list_installed_ai_models`, `start_in_app_ai_engine`, `stop_in_app_ai_engine`, `get_ai_engine_status` | Sidecar lifecycle for embedded `llama-server.exe` on port 11435, GGUF downloads | **Functional** (Resolves local executable, streams downloads with channel IPC) |
| `commands/documents.rs` | `get_paper_document_status`, `open_paper_document`, `read_paper_pdf`, `extract_pdf_metadata`, `get_paper_pdf_info`, `resolve_paper_pdf`, `enqueue_pdf_download`, `enqueue_bulk_pdf_downloads`, `cancel_pdf_download`, `retry_pdf_download`, `list_pdf_download_jobs`, `clear_completed_pdf_downloads`, `delete_pdf_download_job`, `get_download_storage_metrics`, `clean_orphaned_downloads`, `save_reader_state`, `get_reader_state` | PDF binary inspection (`%PDF-`), streaming byte delivery, background download manager | **Functional** |
| `commands/papers.rs` | `list_papers`, `get_paper`, `create_paper`, `update_paper`, `delete_paper`, `toggle_save_paper`, `touch_paper_opened` | Bibliographic CRUD, duplicate DOI/title checks, FTS5 triggers | **Functional** |
| `commands/collections.rs` | `list_collections`, `create_collection`, `update_collection`, `delete_collection`, `add_paper_to_collection`, `remove_paper_from_collection` | Hierarchical research collections | **Functional** |
| `commands/tags.rs` | `list_tags`, `assign_tag_to_paper`, `remove_tag_from_paper` | Paper tagging | **Functional** |
| `commands/notes.rs` | `get_notes_for_paper`, `save_note`, `delete_note`, `search_notes` | Markdown paper notes | **Functional** |
| `commands/saved_search.rs` | `list_saved_searches`, `get_saved_search`, `create_saved_search`, `update_saved_search`, `delete_saved_search`, `touch_saved_search` | Search query persistence | **Functional** |
| `commands/settings.rs` | `get_app_setting`, `set_app_setting`, `list_app_settings` | Key-value settings store | **Functional** |
| `commands/sources.rs` | `list_sources` | Academic data source metadata | **Functional** |
| `commands/database.rs` | `get_database_info` | Diagnostic pragmas and version info | **Functional** |
| `commands/academic_search.rs` | `list_academic_providers`, `search_academic_sources`, `import_search_results`, `get_provider_config_status`, `set_provider_api_key`, `check_academic_provider_health`, `get_provider_capabilities`, `enrich_paper_metadata` | Rust academic adapters (arXiv, Crossref, OpenAlex, Semantic Scholar, Europe PMC) | **Functional** |
| `commands/crawl.rs` | `list_crawl_profiles`, `get_crawl_profile`, `create_crawl_profile`, `update_crawl_profile`, `delete_crawl_profile`, `preview_url_extraction`, `start_crawl_job`, `pause_crawl_job`, `resume_crawl_job`, `cancel_crawl_job`, `get_crawl_job`, `list_crawl_jobs`, `list_crawled_papers`, `import_crawled_papers`, `check_website_policy`, `import_single_page` | Web crawler profiles, robots.txt validator, spider queue | **Functional** |
| `commands/website_search.rs` | `search_website_sources`, `list_website_search_sources`, `get_scraping_engine_diagnostics`, `import_discovered_search_result`, `start_website_search_stream`, `cancel_website_search`, `start_python_search_stream`, `cancel_python_search`, `list_python_search_sources`, `get_python_engine_status`, `fetch_remote_pdf_preview` | Event streaming from scraping engine (Rust spider + Python sidecar) | **Functional** |
| `commands/processing.rs` | `get_processing_overview`, `start_metadata_normalization`, `start_duplicate_scan`, `start_pdf_verification`, `list_duplicate_candidates`, `resolve_duplicate_candidate`, `merge_papers`, `list_paper_files`, `list_processing_jobs`, `get_paper_identifiers`, `set_paper_reading_status`, `set_paper_reading_progress`, `bulk_update_reading_status`, `rebuild_search_index`, `bulk_add_to_collection`, `bulk_remove_from_collection`, `create_tag`, `rename_tag`, `delete_tag`, `bulk_assign_tags`, `bulk_remove_tags` | Library maintenance, deduplication, reading list progress | **Functional** |
| `commands/export.rs` | `prepare_citation_export`, `execute_citation_export` | BibTeX, APA, IEEE, RIS exports | **Functional** |
| `commands/ieee.rs` | `import_ieee_paper`, `import_local_oa_pdf`, `get_open_access_stats`, `list_open_access_papers` | IEEE Xplore linkout & open access PDF tracking | **Functional** |
| `commands/matrix.rs` | `list_matrix_workspaces`, `get_matrix_workspace_detail`, `create_matrix_workspace`, `update_matrix_columns`, `delete_matrix_workspace`, `add_paper_to_matrix`, `remove_paper_from_matrix`, `upsert_matrix_extraction`, `extract_matrix_fields`, `export_matrix_csv`, `create_evidence_copilot_session`, `list_evidence_copilot_sessions`, `get_evidence_copilot_messages`, `ask_evidence_copilot`, `clear_evidence_copilot_messages` | Literature review extraction grid & Evidence Copilot | **Functional** (Minor test assertion issue in evidence page number) |
| `commands/auth.rs` | `auth_signup`, `auth_login`, `auth_logout`, `auth_lock`, `auth_unlock`, `auth_get_current_session`, `auth_restore_remembered_session`, `auth_get_preferences`, `auth_update_preferences`, `auth_change_password`, `auth_touch_activity` | Local Argon2id password hashing, session tokens, screen locking | **Functional** |
| `commands/projects.rs` | `list_research_domains`, `create_custom_research_domain`, `create_research_project`, `update_research_project`, `get_research_project`, `list_research_projects`, `archive_research_project`, `delete_research_project`, `create_project_milestone`, `update_project_milestone`, `delete_project_milestone`, `list_project_milestones`, `create_project_task`, `update_project_task`, `update_project_task_status`, `delete_project_task`, `list_project_tasks`, `add_task_dependency`, `remove_task_dependency`, `link_paper_to_project`, `unlink_paper_from_project`, `list_project_papers`, `link_paper_to_task`, `unlink_paper_from_task`, `list_project_activity`, `generate_ai_project_plan`, `apply_ai_project_plan`, `ask_project_ai_assistant` | Hierarchical project management, Gantt milestones, task dependencies, AI planner | **Functional** |
| `commands/health.rs` | `app_health`, `app_ping` | Subsystem diagnostics, latency probes | **Functional** |
| `commands/window.rs` | `window_minimize`, `window_toggle_maximize`, `window_close`, `window_is_maximized`, `window_start_dragging` | Desktop title bar controls | **Functional** |

---

## 2. Mapping Rust Commands to the Nine Research Tools

| Tool # | Research Tool Name | Route ID | Frontend View | Primary Rust Commands | Backend Implementation Assessment |
|---|---|---|---|---|---|
| **0** | **Tools Hub** | `ai_tools` | `AiToolsHubView.tsx` | `get_hardware_profile`, `get_ai_engine_status`, `start_in_app_ai_engine`, `stop_in_app_ai_engine`, `list_installed_ai_models`, `download_ai_model` | **Functional**: Hardware queries, local GGUF download streaming, and `llama-server` process management operate as designed. |
| **1** | **AI Writing Detector** | `ai_writing_detector` | `AiToolWorkspaceView.tsx` | `ingest_document_content`, `start_analysis_job`, `get_analysis_job_status`, `cancel_analysis_job`, `detect_ai_signals` | **Simulated / Broken RPC**: `start_analysis_job` sleeps for 350ms total and writes dummy JSON. `detect_ai_signals` triggers Python RPC which times out (30s) due to protocol mismatch, falling back to local Rust heuristic. |
| **2** | **Plagiarism Checker** | `plagiarism_checker` | `AiToolWorkspaceView.tsx` | *(No backend commands called)* Database tables `corpus_sources`, `corpus_fingerprints`, `similarity_runs`, `similarity_matches` exist in migration 0008 | **Incomplete / Missing Backend**: Zero Tauri commands exposed for winnowing fingerprint matching or corpus indexing. Frontend runs an in-memory 4-gram loop over `papers`. |
| **3** | **AI Humanizer** | `ai_humanizer` | `AcademicWritingWorkspaceView.tsx` | `generate_ai_response`, `save_writing_revision`, `list_writing_revisions`, `get_ai_engine_status` | **Functional with Caveat**: Rewriting pipeline executes via local LLM / cloud AI with token guards. `save_writing_revision` has foreign key hazard if `writing_sessions` row is absent. |
| **4** | **Academic Writing Assistant** | `academic_writing_assistant` | `AcademicWritingWorkspaceView.tsx` | `generate_ai_response`, `save_writing_revision`, `list_writing_revisions`, `search_rag_passages` | **Functional with Caveat**: Tone calibration & structured prompts function properly. Same `save_writing_revision` foreign key hazard. |
| **5** | **Paraphrasing Tool** | `paraphrasing_tool` | `AcademicWritingWorkspaceView.tsx` | `generate_ai_response`, `save_writing_revision`, `list_writing_revisions` | **Functional with Caveat**: Scholarly restatements and formula protection operate properly. Same `save_writing_revision` foreign key hazard. |
| **6** | **Citation Checker** | `citation_checker` | `CitationCheckerWorkspaceView.tsx` | `ingest_document_content`, `save_citation_audit`, `get_citation_audit`, `list_citation_audits`, `validate_ai_citations` | **Functional**: Persistence to `citation_audits` is fully implemented in `AiToolsRepository`. (Frontend file upload suffers from `readAsText` defect). |
| **7** | **Readability Analyzer** | `readability_analyzer` | `ReadabilityAnalyzerView.tsx` | `ingest_document_content`, `save_readability_report`, `get_readability_report_by_hash` | **Functional**: Persistence to `readability_reports` and hash-based cache retrieval are fully operational. (Frontend file upload suffers from `readAsText` defect). |
| **8** | **Research Integrity** | `research_integrity` | `ResearchIntegrityView.tsx` | `ingest_document_content`, `save_integrity_report`, `get_integrity_report`, `list_saved_integrity_reports`, `delete_integrity_report`, `update_integrity_finding_review` | **Functional**: Multi-dimensional report persistence and finding review state updates work cleanly with transaction rollback. |

---

## 3. SQLite Database Schema & Migrations Inventory

### 3.1 Migration History & Table Inventory (Current Version: 18)

| Migration File | Version | Core Tables Added / Modified | Indices & Constraints |
|---|---|---|---|
| `0001_initial_schema.sql` | 1 | `schema_migrations`, `papers`, `authors`, `paper_authors`, `sources`, `paper_sources`, `collections`, `collection_papers`, `tags`, `paper_tags`, `notes`, `app_settings`, `papers_fts` (FTS5) | `idx_papers_doi` (unique), `idx_papers_clean_title`, `idx_authors_orcid`, cascading foreign keys, FTS5 unicode61 tokenizer. |
| `0002_website_scraping_engine.sql` | 2 | `crawl_profiles`, `crawl_jobs`, `crawl_queue`, `crawled_papers` | Domain uniqueness, crawl queue job indices, status indices. |
| `0003_processing_and_deduplication.sql` | 3 | `paper_files`, `duplicate_candidates`, `processing_jobs`, `paper_identifiers`, `merge_history` | Paper file uniqueness, candidate pair indices, identifier types (`doi`, `arxiv`, `pmid`). |
| `0004_research_workflows_and_exports.sql` | 4 | `saved_searches`, reading status columns on `papers` (`reading_status`, `reading_progress`, `opened_at`) | Query indices, reading status indices. |
| `0005_unified_pdf_workspace.sql` | 5 | `pdf_candidates`, `download_jobs`, `reader_state` | PDF resolution provenance, candidate status, paper reader page/zoom tracking. |
| `0006_ieee_open_access_workflow.sql` | 6 | IEEE source configuration and Open Access tracking columns | Provenance index on IEEE records. |
| `0007_ai_workspace_and_knowledge.sql` | 7 | `ai_providers`, `ai_provider_task_routes`, `ai_paper_chunks`, `ai_chunks_fts` (FTS5), `ai_chat_sessions`, `ai_chat_messages`, `ai_recommendations`, `ai_evaluation_results`, `ai_finetuning_jobs` | Triggers for FTS5 synchronization (`trg_ai_chunks_insert`, `update`, `delete`), session cascades, citation verification indices. |
| `0008_research_integrity_and_writing.sql` | 8 | `integrity_documents`, `document_segments`, `corpus_sources`, `corpus_fingerprints`, `similarity_runs`, `similarity_matches`, `ai_signal_runs`, `ai_signal_segments`, `writing_sessions`, `writing_revisions` | Winnowing fingerprint primary key `(hash_value, corpus_source_id, char_offset)`, segment character bounds, review status tracking. |
| `0009_literature_review_matrix_and_copilot.sql` | 9 | `review_matrix_workspaces`, `matrix_columns`, `matrix_papers`, `matrix_extractions`, `evidence_copilot_sessions`, `evidence_copilot_messages` | Workspace unique titles, extraction coordinate keys `(workspace_id, paper_id, column_id)`. |
| `0010_imare_retrieval_state.sql` | 10 | Candidate retrieval state columns | Enhances candidate verifications. |
| `0011_ai_tools_and_integrity_persistence.sql` | 11 | `analysis_jobs`, `saved_integrity_reports`, `integrity_report_findings`, `citation_audits`, `readability_reports`, `doi_cache` | Hash lookups on saved reports, finding severity/dimension indices, DOI cache TTL index. |
| `0012_local_auth_system.sql` | 12 | `users`, `user_sessions`, `user_preferences` | Unique username, token lookups, session expiration timestamps. |
| `0013_research_library_and_knowledge.sql` | 13 | Paper metadata extension columns | Source verification metrics. |
| `0014_download_manager_modernization.sql` | 14 | Resumable download manager columns (`download_strategy`, `content_range_supported`) | Retry metrics. |
| `0015_multi_source_retrieval_and_verification.sql` | 15 | PDF candidate verification flags | Cross-validation against PDF header. |
| `0016_research_projects_and_tasks.sql` | 16 | `research_domains`, `research_projects`, `project_milestones`, `project_tasks`, `task_dependencies`, `project_papers`, `task_papers`, `task_reminders`, `project_activity` | Hierarchical domain recursion, task dependency cycle detection constraints, milestone ordering. |
| `0017_in_app_ai_engine_default.sql` | 17 | Configures `in_app_local` default provider entry in `ai_providers` and default routes | Sets in-app model defaults. |
| `0018_ensure_nvidia_nim_and_provider_health.sql` | 18 | Ensures `nvidia_nim` provider entry with verified free tier endpoint | Resolves initial cold-start cloud routing. |

### 3.2 Database Connection & Concurrency Architecture

- **Connection Management (`src-tauri/src/database/mod.rs`)**:
  - Encapsulated in `Database` struct:
    ```rust
    pub struct Database {
        conn: Arc<Mutex<Connection>>,
        db_path: PathBuf,
    }
    ```
  - Thread safety is enforced via an `Arc<Mutex<rusqlite::Connection>>`. All command handlers call `let conn = db.lock()?;` to obtain a scoped `MutexGuard`.
- **SQLite Pragmas Configured**:
  ```sql
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
  PRAGMA journal_mode = WAL;
  ```
  - `WAL` (Write-Ahead Logging) allows concurrent read access during transactions without locking.
  - `busy_timeout = 5000` prevents immediate `SQLITE_BUSY` errors under high burst query loads.
- **Pre-Migration Safety Backups**:
  - Prior to executing `run_migrations()`, `Database::open_file()` checks if the database exists and automatically creates a snapshot in `backups/pre_migration_<timestamp>.sqlite3.bak`.

---

## 4. In-Depth Codebase & Architectural Gaps

### 4.1 Mock Logic in `start_analysis_job` (`commands/ai_tools.rs:126-157`)

```rust
// Current code in src-tauri/src/commands/ai_tools.rs:126-157
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
**Impact**:
This is a pure mock background worker. It generates artificial sleep pauses and produces static dummy JSON instead of evaluating the document content or calculating actual metrics.

### 4.2 Inter-Process Communication Protocol Mismatch (`services/python_engine.rs`)

**Rust Expectation** (`src-tauri/src/services/python_engine.rs:869-876`):
```rust
if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
    if parsed.get("type").and_then(|v| v.as_str()) == Some("response") {
        if parsed.get("reply_to").and_then(|v| v.as_str()) == Some(&req_id) {
            let resp_type = parsed.get("response_type").and_then(|v| v.as_str()).unwrap_or("");
            if resp_type == expected_result_type {
                return Ok(parsed.get("payload").cloned().unwrap_or(parsed));
            }
        }
    }
}
```

**Python Emission** (`python-engine/src/paper_scraper/protocol.py:74-82`):
```python
def emit_response(response_type: str, request_id: str, payload: Dict[str, Any]) -> None:
    msg = {
        "schema_version": PROTOCOL_VERSION,
        "type": response_type,            # e.g. "detect_ai_signals_result"
        "request_id": request_id,         # Note: NOT "reply_to"
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "payload": payload,
    }
    sys.stdout.write(json.dumps(msg) + "\n")
```

**Impact**:
1. Python sends `type: "detect_ai_signals_result"`, but Rust ignores anything where `type != "response"`.
2. Python sends `request_id`, but Rust searches for `reply_to`.
3. Python does not send `response_type`.
Because no line ever matches Rust's check, `read_future` waits for the 30-second timeout on every invocation of `detect_ai_signals` or `extract_document_text`, producing a 30-second hang followed by fallback to local heuristics.

### 4.3 Foreign Key Violation Hazard in Writing Revisions (`repositories/ai_tools_repo.rs:580`)

- `writing_revisions` has a foreign key constraint:
  `session_id TEXT NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE`
- `AiToolsRepository::save_writing_revision` performs:
  ```rust
  conn.execute(
      "INSERT INTO writing_revisions (
          id, session_id, revision_number, action_type,
          original_text, revised_text, diff_summary, ...
      ) VALUES (?1, ?2, ...)",
      ...
  )?;
  ```
- If the frontend generates a standalone `session_id` (e.g. `session_1730618000`) without first creating a record in `writing_sessions`, SQLite returns:
  `Error: FOREIGN KEY constraint failed`
- **Recommended Fix**: Implement `ensure_writing_session_exists(conn, session_id, doc_id, title)` or upsert `writing_sessions` automatically before inserting the revision.

### 4.4 Missing Backend Commands for Plagiarism Checker

- Migration 0008 created:
  - `corpus_sources` (stores indexed documents from library or local files)
  - `corpus_fingerprints` (stores 64-bit winnowing hash values and character offsets)
  - `similarity_runs` (stores run metadata and overall similarity percentage)
  - `similarity_matches` (stores exact and fuzzy overlapping passage records)
- **Gap**: Zero Tauri commands or services exist to populate `corpus_fingerprints` or query them against input text. The feature is currently disconnected in the backend.

---

## 5. Rust Test Setup & Automated Verification Audit

### 5.1 Cargo.toml Configuration & Dependencies

- `[package] name = "infinity-researcher"`, `edition = "2021"`.
- `[lib] name = "research_paper_scraper_lib"`, `crate-type = ["staticlib", "cdylib", "rlib"]`.
- Core dependencies: `tauri v2`, `rusqlite v0.40.2 (features: bundled, uuid, chrono)`, `tokio v1 (full)`, `serde v1`, `reqwest v0.12 (rustls-tls)`, `sha2 v0.10`, `lopdf v0.34`, `spider v2.53.9`, `argon2 v0.5`, `keyring v3`.

### 5.2 Test Execution Results Summary

```bash
cargo test --test <suite_name> --manifest-path src-tauri/Cargo.toml
```

| Integration Test Suite | File Path | Tests Run | Result | Duration | Root Cause of Failure (if any) |
|---|---|---|---|---|---|
| `academic_search_tests` | `src-tauri/tests/academic_search_tests.rs` | 4 | **PASSED** | 0.24s | — |
| `adversarial_chat_tests` | `src-tauri/tests/adversarial_chat_tests.rs` | 9 | **PASSED** | 1.36s | — |
| `auth_tests` | `src-tauri/tests/auth_tests.rs` | 4 | **1 FAILED, 3 PASSED** | 3.29s | Line 119: Hardcoded `assert_eq!(info.schema_version, 12)` fails because schema is 18. |
| `chat_persistence_tests` | `src-tauri/tests/chat_persistence_tests.rs` | 8 | **PASSED** | 0.98s | — |
| `crawl_engine_tests` | `src-tauri/tests/crawl_engine_tests.rs` | 6 | **PASSED** | 0.40s | — |
| `database_integration_tests` | `src-tauri/tests/database_integration_tests.rs` | 5 | **PASSED** | 0.59s | — |
| `ieee_workflow_tests` | `src-tauri/tests/ieee_workflow_tests.rs` | 10 | **PASSED** | 0.31s | — |
| `matrix_tests` | `src-tauri/tests/matrix_tests.rs` | 1 | **1 FAILED** | 0.42s | Line 123: `evidence[0].page_number` returned `Some(1)` instead of expected `Some(4)` due to extraction synthesis fallback. |
| `performance_benchmarks` | `src-tauri/tests/performance_benchmarks.rs` | 1 | **PASSED** | 2.63s | — |
| `processing_pipeline_tests` | `src-tauri/tests/processing_pipeline_tests.rs` | 4 | **PASSED** | 0.33s | — |
| `projects_and_ai_tests` | `src-tauri/tests/projects_and_ai_tests.rs` | 5 | **1 FAILED, 4 PASSED** | 0.55s | Line 17: Hardcoded `assert_eq!(version, 16)` fails because schema is 18. |
| `retrieval_pipeline_tests` | `src-tauri/tests/retrieval_pipeline_tests.rs` | 5 | **PASSED** | 0.21s | — |
| `security_and_robustness_tests` | `src-tauri/tests/security_and_robustness_tests.rs` | 7 | **PASSED** | 0.19s | — |
| `spider_api_check` | `src-tauri/tests/spider_api_check.rs` | 1 | **PASSED** | 0.00s | — |
| **Total Integration Tests** | — | **70** | **67 PASSED (95.7%)** | ~11.5s | 3 failed suites |

### 5.3 Library Unit Test Runner Issue (`cargo test --lib`)

- Running `cargo test --lib` fails with:
  ```
  process didn't exit successfully: ...\research_paper_scraper_lib-0f5a2626941c9a03.exe --list
  exit code: 0xc0000139, STATUS_ENTRYPOINT_NOT_FOUND
  ```
- **Explanation**: In Windows MSVC builds, when a Cargo package configures `crate-type = ["staticlib", "cdylib", "rlib"]`, building the `--lib` test harness attempts to dynamically bind to the compiled `research_paper_scraper_lib.dll` located in `target/debug/` rather than linking statically against the `rlib`.
- **Workaround / Fix**: Running tests via `--test <name>` links against the `rlib` and avoids this Windows dynamic link error completely. For `--lib`, updating `Cargo.toml` or running with appropriate DLL search path resolves the entrypoint binding.

---

## 6. Actionable Implementation & Repair Recommendations

To fulfill Phase 1 requirements and achieve zero-defect integrity across the Rust backend and SQLite database:

1. **Repair Protocol Mismatch in `services/python_engine.rs`**:
   - In `execute_rpc` (`python_engine.rs:869-878`), accept both protocol formats:
     ```rust
     let is_match = (parsed.get("type").and_then(|v| v.as_str()) == Some("response")
         && parsed.get("reply_to").and_then(|v| v.as_str()) == Some(&req_id))
         || (parsed.get("type").and_then(|v| v.as_str()) == Some(&expected_result_type)
         && parsed.get("request_id").and_then(|v| v.as_str()) == Some(&req_id));
     ```
   - This eliminates the 30-second timeout and allows Python's statistical cadence results to return in <50ms.

2. **Replace Mock Background Worker in `commands/ai_tools.rs`**:
   - In `start_analysis_job`, replace the `tokio::time::sleep` mock with real analysis dispatch:
     - For `ai_writing_detection`: Trigger `detect_ai_signals` on the document content and store the resulting JSON in `analysis_jobs.result_json`.
     - For `readability_analysis`: Compute readability metrics via `PythonEngineService` or local formula engine and store results.

3. **Fix Foreign Key Handling in `AiToolsRepository::save_writing_revision`**:
   - Ensure an entry exists in `writing_sessions` prior to inserting into `writing_revisions`:
     ```sql
     INSERT OR IGNORE INTO writing_sessions (id, document_id, title, active_mode, created_at, updated_at)
     VALUES (?1, 'doc_default', 'Writing Session', 'academic', datetime('now'), datetime('now'));
     ```

4. **Correct Hardcoded Schema Versions in Integration Tests**:
   - In `tests/projects_and_ai_tests.rs:17`, change `assert_eq!(version, 16)` to `assert_eq!(version, CURRENT_SCHEMA_VERSION)` (or `>= 16`).
   - In `tests/auth_tests.rs:119`, change `assert_eq!(info.schema_version, 12)` to `assert_eq!(info.schema_version, CURRENT_SCHEMA_VERSION)` (or `>= 12`).

5. **Fix Page Number Assertion in `tests/matrix_tests.rs`**:
   - Update `MatrixService::synthesize_matrix_response` to forward the actual chunk page number (`Some(4)`) rather than falling back to `Some(1)`.

6. **Add Dedicated Test Suite for AI Tools Module**:
   - Create `src-tauri/tests/ai_tools_persistence_tests.rs` testing `AiToolsRepository` (document ingestion, analysis job lifecycle, integrity report transactions, citation audit persistence, readability report caching, and revision history).
