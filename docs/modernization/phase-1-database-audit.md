# Phase 1: Database and User Data Audit

This audit examines the SQLite database architecture, schema migrations, table indices, foreign key constraints, and user data preservation guarantees in **Infinity Researcher**.

---

## 1. Database Architecture & Connection Model

- **Engine**: Embedded **SQLite 3** via the `rusqlite` crate (version `0.40.2` with `bundled`, `uuid`, `chrono` features).
- **Storage Location**: Stored locally in the application data directory (`infinity-researcher.sqlite3` with backward-compatible fallback for legacy databases).
- **Concurrency & WAL Mode**: Configured with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA foreign_keys = ON;`, allowing concurrent read operations without locking write transactions.
- **Migration Engine**: `src-tauri/src/database/migrations.rs` automatically applies incremental migrations tracked in the `schema_migrations` table (`version`, `name`, `applied_at`).

---

## 2. Complete Schema Migrations Registry (Migrations 0001–0012)

| Version | Migration Script Name | Primary Tables Created / Managed | Role in Research Workspace |
| :--- | :--- | :--- | :--- |
| **0001** | `0001_initial_schema.sql` | `papers`, `collections`, `paper_collections`, `tags`, `paper_tags`, `notes`, `app_settings`, `sources` | Core research library, folders, bibtex metadata, and notes. |
| **0002** | `0002_website_scraping_engine.sql`| `crawl_profiles`, `crawl_jobs`, `crawled_papers` | Background crawl jobs, domain whitelist policies, and extracted URLs. |
| **0003** | `0003_processing_and_deduplication.sql`| `duplicate_candidates`, `paper_identifiers`, `paper_files`, `processing_jobs` | Deduplication queue, SHA-256 file hashes, match tier scoring. |
| **0004** | `0004_research_workflows_and_exports.sql`| `reading_lists`, `citation_exports` | Reading queue priorities and citation exports (BibTeX, APA, IEEE). |
| **0005** | `0005_unified_pdf_workspace.sql`| `pdf_reader_states`, `pdf_annotations`, `pdf_metadata_cache` | Last read page, zoom level, search match cache, and highlight annotations. |
| **0006** | `0006_ieee_open_access_workflow.sql`| `ieee_open_access_records` | IEEE provenance verification, stamp verification, and license badges. |
| **0007** | `0007_ai_workspace_and_knowledge.sql`| `ai_providers`, `ai_task_routes`, `ai_paper_chunks`, `ai_chat_messages`, `ai_evaluations`, `ai_finetuning_jobs`, `ai_recommendations` | Provider catalog, model routing, page/section RAG vector chunks, and chat history. |
| **0008** | `0008_research_integrity_and_writing.sql`| `integrity_reports`, `integrity_findings`, `similarity_analyses`, `writing_sessions`, `writing_revisions` | Manuscript audits, AI signals, text similarity findings, revision diffs. |
| **0009** | `0009_literature_review_matrix_and_copilot.sql`| `matrix_workspaces`, `matrix_columns`, `matrix_extractions`, `evidence_copilot_sessions`, `evidence_copilot_messages` | Literature matrix spreadsheet, extracted claims, grounded quote citations. |
| **0010** | `0010_imare_retrieval_state.sql`| `imare_retrieval_state`, `imare_source_coverage` | Advanced multi-source retrieval state and source coverage tracking. |
| **0011** | `0011_ai_tools_and_integrity_persistence.sql`| `readability_reports`, `citation_audits`, `ai_tool_executions`, `document_content_cache` | Readability scores, Crossref citation audits, cached document content. |
| **0012** | `0012_local_auth_system.sql` | `users`, `user_preferences`, `auth_audit_log` | Local user accounts, Argon2id password hashes, lock timeouts, auth audit log. |

---

## 3. Data Integrity & Security Protections

1. **Transactional Migrations**: Every migration executes within a dedicated SQLite transaction (`conn.transaction()`). If any SQL statement encounters an error, the transaction rolls back completely, preventing database corruption.
2. **Cascading Deletions**: Related entities (e.g. `paper_collections`, `notes`, `ai_paper_chunks`) use `ON DELETE CASCADE` referencing `papers(id)`, preventing orphan database records.
3. **Sensitive Data Segregation**:
   - `users.password_hash` stores only salted Argon2id hashes.
   - `ai_providers.credential_ref` stores opaque references or masked tokens; secrets are never output in plain text.
   - Session keys use the operating system keyring (`keyring` crate) rather than plaintext SQLite columns.

---

## 4. UI Modernization Impact & Preservation Rules

- **Zero Schema Modifications in Phase 1**: The current 12-migration schema fully supports all 24 views, research workflows, and user preferences.
- **Data Safety Guarantee**: Modernizing UI components, animations, and icons must not alter, drop, or rewrite existing database tables or erase user research libraries.

