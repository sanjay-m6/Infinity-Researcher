# Phase 16 Pre-Implementation Audit: Download Manager & PDF Acquisition Engine Modernization

## 1. Audit Overview & Technology Baseline

Before designing and executing Phase 16, a comprehensive audit was performed across the Infinity Researcher codebase, spanning Rust backend services, Python retrieval engine, SQLite migrations, domain models, React frontend views, state management, and test suites.

- **Desktop Framework**: Tauri 2 (Rust backend with rusqlite in WAL mode).
- **Frontend Architecture**: React 19, TypeScript, Tailwind CSS v4, Lucide icons.
- **Data Persistence**: SQLite schema currently at version 13 (`schema_migrations` table).
- **Core Download Entities Available**: `download_jobs`, `paper_files`, `pdf_candidates`, `papers.has_file`, `papers.local_pdf_path`, `papers.content_hash`.
- **Python Scraping & Retrieval Engine**: `python-engine/src/paper_scraper/pdf.py`, `downloader.py`, `security.py`.

---

## 2. Existing Components & File Inventory

### 2.1 Rust Backend
- `src-tauri/src/services/download_manager.rs`:
  - Contains `DownloadManager` struct with `reqwest::Client`, `storage_dir`, `semaphore` (max 3 concurrent), `cancel_senders` (`watch::channel`), `domain_rate_limiter`, and `app_handle`.
  - Methods: `new`, `set_app_handle`, `storage_dir`, `recover_interrupted_jobs`, `enqueue`, `enqueue_bulk`, `cancel`, `retry`, `list_jobs`, `clear_completed`, `get_job`.
  - Internal streaming: `run_download_task`, `execute_stream_download`, `persist_job_update`.
- `src-tauri/src/services/pdf_resolver.rs`:
  - Resolves open access and direct PDF links across arXiv, bioRxiv/medRxiv, PubMed Central, Unpaywall, CrossRef, and IEEE.
- `src-tauri/src/services/pdf_processor.rs`:
  - Inspects downloaded PDF file structure, extracts page counts, word counts, and metadata.
- `src-tauri/src/services/candidate_verifier.rs`:
  - Provides `has_valid_pdf_magic_bytes` check tolerant of UTF-8/UTF-16 BOMs and initial comments.
- `src-tauri/src/repositories/pdf_workspace_repo.rs`:
  - CRUD operations for `download_jobs`, `attach_downloaded_file`, `get_paper_pdf_info`, `get_active_download_for_paper`.
- `src-tauri/src/commands/documents.rs`:
  - Exposes Tauri commands: `enqueue_pdf_download`, `enqueue_bulk_pdf_downloads`, `cancel_pdf_download`, `retry_pdf_download`, `list_pdf_download_jobs`, `clear_completed_pdf_downloads`, `read_paper_pdf`, `extract_pdf_metadata`.

### 2.2 Python Engine
- `python-engine/src/paper_scraper/pdf.py`:
  - `verify_pdf_signature(header_bytes)`: Rejects HTML masquerading/paywalls, detects `%PDF-` with BOM tolerance.
  - `PdfManager`: Cache size management and `check_pdf_availability` via HTTP Range requests.
- `python-engine/src/paper_scraper/security.py`:
  - `validate_url`, `sanitize_filename`, `is_private_ip`, Anti-SSRF protection.

### 2.3 Frontend UI & Desktop API
- `src/features/downloads/DownloadsView.tsx`:
  - Currently presents web crawler jobs (`CrawlJob`), but lacks the primary workspace for academic PDF download jobs (`DownloadJob`).
- `src/lib/desktop-api/index.ts` & `src/lib/desktop-api/types.ts`:
  - IPC bindings for PDF downloads exist (`enqueuePdfDownload`, `enqueueBulkPdfDownloads`, `cancelPdfDownload`, `retryPdfDownload`, `listPdfDownloadJobs`, `clearCompletedPdfDownloads`).
  - Missing commands/bindings for storage metrics (`get_download_storage_metrics`), orphaned temporary file cleanup (`clean_orphaned_downloads`), and setting concurrency limit.

---

## 3. Findings & Architectural Assessment

### 3.1 Task Lifecycle & State Transitions
- **Current Lifecycle**: States `queued`, `downloading`, `completed`, `failed`, `cancelled`.
- **Gaps Identified**:
  - Missing fine-grained intermediate states: `resolving` (when negotiating open access streams or IEEE direct tokens), `validating` (verifying `%PDF-` and structural parsing), and `cancelling` (coordinating shutdown).
  - Download speed (`speed_bps`), start time (`started_at`), and completion time (`completed_at`) are not tracked or stored.
  - Failure categorization (`error_category`) is not structured, making user-facing error guidance generic.

### 3.2 Concurrency & Queue Coordination
- **Current Implementation**: Bounded by an in-memory `tokio::sync::Semaphore(3)`.
- **Gaps Identified**:
  - Concurrency limit is hardcoded to 3. Users cannot configure it according to their network environment.
  - Active deduplication only checks `papers` for active downloads, but does not prevent duplicate concurrent requests in fast succession before database persistence.

### 3.3 Progress Reporting & Bandwidth Calculation
- **Current Implementation**: Emits `paper:download_progress` every 256 KB.
- **Gaps Identified**:
  - Progress percent is calculated, but transfer rate (KB/s, MB/s) is not calculated or emitted.
  - UI has no access to real transfer speed or remaining time estimation.

### 3.4 PDF Validation & Storage Integrity
- **Current Strengths**:
  - Validates `%PDF-` on first chunk.
  - Computes SHA-256 during streaming.
  - Streams to temporary file `.tmp_<job_id>.part` before atomic rename.
  - Uses `PdfProcessor::process_pdf_file` to detect corrupt files.
- **Gaps Identified**:
  - If a download crashes or is killed by an OS signal, `.part` files can remain orphaned in the storage folder.
  - No storage metrics API to compute total PDF library size and orphaned temporary disk usage.
  - No safe cleanup command to delete orphaned `.part` files without risking user PDF files.

### 3.5 DownloadsView UI
- **Current State**: Displays web crawler tasks instead of the core PDF Download Manager.
- **Required Transformation**: Modernize `DownloadsView.tsx` into a comprehensive research acquisition hub:
  1. PDF Downloads Tab (Default): Active, queued, completed, and failed PDF acquisitions with live progress, real transfer speed, cancel/retry controls, "Read PDF" navigation, and storage management stats.
  2. Website Web Crawlers Tab: Preserves 100% of the existing scholarly crawling and metadata discovery workflows.

---

## 4. Modernization Strategy & Roadmap

1. **Database Schema Upgrade (Migration 0014)**:
   - Add `speed_bps`, `started_at`, `completed_at`, and `error_category` to `download_jobs`.
   - Update `CURRENT_SCHEMA_VERSION = 14`.
2. **Rust Backend Download Engine Modernization**:
   - Enhance `DownloadManager` with state transitions: `queued` -> `resolving` -> `downloading` -> `validating` -> `completed` / `failed` / `cancelled`.
   - Implement rolling window transfer speed calculation.
   - Implement dynamic concurrency configuration (`set_concurrency`).
   - Implement storage metrics inspection (`get_storage_metrics`).
   - Implement safe orphaned temporary file cleanup (`clean_orphaned_downloads`).
3. **Desktop API & TypeScript Bindings**:
   - Update `DownloadJob` interface and add `DownloadStorageMetrics` in `types.ts`.
   - Expose new commands in `src/lib/desktop-api/index.ts`.
4. **Frontend UI Modernization (`DownloadsView.tsx`)**:
   - Dual-tab interface: "PDF Downloads" and "Web Crawlers".
   - Overview metrics cards: Active, Queued, Completed, Failed, Total Storage (MB/GB).
   - Storage maintenance section: Disk usage, orphaned `.part` count, clean button.
   - Real-time progress bars with actual transfer speed, indeterminate progress when total is unknown.
   - Quick actions: Open in Reader, Retry, Cancel, Clear Completed from list.
5. **Testing & Verification**:
   - Unit and integration tests in `src/test/phase16-download-manager.test.tsx`.
   - Rust, Python, and frontend build verification.

