# Phase 1: Tauri 2 and Rust Backend Audit

This audit evaluates the Rust systems backend, Tauri 2 configuration, command registry, background services, IPC event streaming, and security boundaries in **Infinity Researcher**.

---

## 1. Tauri 2 Desktop Configuration (`src-tauri/tauri.conf.json`)

- **Identifier**: `com.infinitywebtechnology.infinityresearcher`
- **Window Specs**:
  - Initial Size: `1024x720`, Minimum Size: `800x600`
  - `decorations: false` (Custom styled TitleBar with native window controls)
  - `resizable: true`, `fullscreen: false`
- **Security & CSP**:
  - `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none';`
  - Restricts remote script execution and prevents arbitrary iframes.
- **Capabilities & Plugins**:
  - Registered plugins: `tauri-plugin-opener`, `tauri-plugin-updater`, `tauri-plugin-process`.
  - External binaries: `binaries/paper-scraper` (PyInstaller sidecar).

---

## 2. Command Registry & Architecture (`src-tauri/src/commands/`)

Over 100 Tauri commands are exposed across 20 organized modules:

| Module | Core Tauri Commands | Backend Service Invoked |
| :--- | :--- | :--- |
| **`website_search.rs`** | `start_website_search_stream`, `cancel_website_search`, `list_website_search_sources`, `get_scraping_engine_diagnostics` | `QuerySearchEngine`, `SpiderScraper`, `PythonEngineService` |
| **`documents.rs`** | `read_paper_pdf`, `get_paper_pdf_info`, `resolve_paper_pdf`, `enqueue_pdf_download`, `list_pdf_download_jobs`, `cancel_pdf_download` | `PdfProcessorService`, `DownloadManager`, `PdfResolverService` |
| **`auth.rs`** | `auth_signup`, `auth_login`, `auth_logout`, `auth_lock`, `auth_unlock`, `auth_restore_remembered_session`, `auth_get_preferences` | `AuthService` (Argon2id, Keyring, Inactivity Tracker) |
| **`ai.rs`** | `list_ai_providers`, `save_ai_provider`, `generate_ai_response`, `index_paper_for_rag`, `get_paper_rag_chunks`, `get_ai_hardware_info` | `AiRagService`, `AiEvalService`, `AiRecommendationService` |
| **`ai_tools.rs`** | `ingest_document_content`, `start_analysis_job`, `save_integrity_report`, `save_citation_audit`, `save_readability_report`, `detect_ai_signals` | `AiToolsRepository`, Document Hash Indexer |
| **`matrix.rs`** | `list_matrix_workspaces`, `create_matrix_workspace`, `upsert_matrix_extraction`, `extract_matrix_fields`, `ask_evidence_copilot` | `MatrixService`, `EvidenceCopilotService` |
| **`ieee.rs`** | `import_ieee_paper`, `list_open_access_papers`, `get_open_access_stats` | `IeeeFetcherService`, `CandidateVerifier` |
| **`crawl.rs`** | `list_crawl_profiles`, `start_crawl_job`, `pause_crawl_job`, `cancel_crawl_job`, `list_crawl_jobs`, `import_crawled_papers` | `CrawlEngineService` |
| **`papers.rs`** | `list_papers`, `get_paper`, `create_paper`, `update_paper`, `delete_paper`, `toggle_save_paper` | `PaperRepository` |
| **`window.rs`** | `window_minimize`, `window_toggle_maximize`, `window_close`, `window_is_maximized` | Native Tauri Window API |

---

## 3. Real-Time Event Streaming Mechanisms

The Rust backend uses high-throughput, non-blocking channels to stream real-time updates directly to React:

### A. Academic Search Stream:
- Event channel name: `website_search_stream_{sessionId}`
- Payload structure (`SearchStreamEvent`):
  - `SearchStarted`: Emitted immediately when query initiates.
  - `SourceStarted`: Emitted when an individual repository (arXiv, IEEE, PubMed) begins scraping.
  - `PaperFound`: Discovered paper emitted immediately into React state with relevance score.
  - `SourceCompleted` / `SourceFailed`: Granular status and failure reason per source.
  - `SearchCompleted`: Guaranteed terminal event via Rust `JobGuard` drop implementation, preventing stuck loading states.

### B. Download Manager Telemetry:
- Event channels:
  - `paper:download_started`
  - `paper:download_progress` (bytes downloaded, total bytes, download speed KB/s, ETA seconds)
  - `paper:download_completed`
  - `paper:download_failed`
  - `paper:download_cancelled`

---

## 4. Concurrency, Database, and Thread Safety

- **SQLite Access**: `rusqlite` connections are managed in `AppState` using thread-safe Arc-wrapped mutexes (`Arc<Database>`). WAL (Write-Ahead Logging) mode is activated for concurrent read and write operations.
- **Task Cancellation**: Cancellations (e.g. aborting an academic search or stopping a PDF download) use `Arc<AtomicBool>` and Tokio oneshot channels for immediate cooperative shutdown.
- **Credential Protection**: Database queries return masked credential tokens (`••••••••••••••••`) over the IPC boundary, ensuring sensitive API keys remain securely inside the backend vault.

