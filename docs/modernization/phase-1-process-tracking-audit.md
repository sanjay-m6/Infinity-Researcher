# Phase 1: Real-Time Process Tracking and Observability Audit

This audit examines the background execution model, event streaming, progress metrics, and UI observability indicators across **Infinity Researcher**.

---

## 1. Background Task Coverage Matrix

| Operation | Backend Engine | Event Source & Channel | Progress Granularity | Cancellation Support | Current UI Status Display |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Academic Paper Search** | Rust Native & Python Engine | `website_search_stream_{id}` | **Granular per-source**: Started, status, paper count, completed, failed | **Yes** (`cancel_website_search` / `cancel_python_search`) | Real-time source progress chips, incoming result count badge, skeleton fallback. |
| **PDF Download** | Rust `DownloadManager` | `paper:download_progress` | **Exact Bytes & Rate**: bytes downloaded, total bytes, speed KB/s, ETA | **Yes** (`cancel_pdf_download`) | Progress bar in Downloads view and detail drawer; status chips in paper cards. |
| **Website Web Crawl** | Rust `spider` & Scrapy | `list_crawl_jobs` polling / events | **Numerical**: URLs discovered, pages crawled, papers extracted | **Yes** (`pause_crawl_job`, `cancel_crawl_job`) | Live job card with status badge and numerical counter. |
| **Deduplication Scan** | Rust `ProcessingEngine` | `list_processing_jobs` | **Stage-based**: Hashing, metadata comparison, candidate queue | **Yes** (cooperative token) | Status banner with progress bar and candidate count. |
| **PDF Document Resolution** | Rust `PdfResolverService` | Async command promise | **State Machine**: 12 discrete states (Resolving, Checking, Fetching, Validating, etc.) | **Yes** (Abort controller) | Discrete state label with animated spinner in Embedded PDF Viewer. |
| **RAG Section Indexing** | Rust `AiRagService` | Async command promise | **Chunk-level**: Chunks created, tokens parsed | **No** (Fast synchronous batch) | Loading spinner on index button; badge changes to "Indexed". |
| **AI Text Generation** | LLM Streaming Client | Tauri IPC stream | **Token-level**: Streamed delta tokens | **Yes** (Stop generating button) | Real-time streaming text block with cursor pulse. |
| **Crossref Citation Audit**| REST Crossref Client | Async command promise | **Numerical**: References parsed, resolved count, orphan count | **No** (Batch execution) | Progress banner with live resolving counter. |

---

## 2. Progress Reporting Evaluation

1. **True Progress vs Indeterminate Spinners**:
   - **PDF Downloads**: True progress with real percentage calculation:
     $$\text{Progress} = \frac{\text{Bytes Downloaded}}{\text{Total Bytes}} \times 100$$
   - **Academic Search**: True per-source streaming. Each source repository independently moves through `queued -> searching -> completed / failed / rate_limited`.
   - **Job Guard Terminal Guarantee**: `src-tauri/src/scrapers/job_guard.rs` enforces Rust RAII drop semantics. If a search worker panics or finishes unexpectedly, the guard automatically emits `SearchCompleted` or `SearchFailed`, preventing permanent spinning loaders.
2. **Areas Requiring Modernization**:
   - **BottomBar Background Indicator**: Currently displays only the number of active jobs (`jobs.length`). It should expand into a real-time floating activity sheet showing individual file progress, transfer rates, and cancellation buttons.
   - **Deduplication Progress**: Displays a simple spinner while scanning. Should be upgraded to an animated multi-step progress bar showing `Hashing -> Normalizing -> Comparing`.

---

## 3. Real-Time Telemetry Modernization Roadmap (Phase 5)

1. **Floating Task Tray Component**:
   - A docked expandable task tray above the `BottomBar` displaying concurrent PDF downloads, web scraping streams, and background indexing.
2. **Animated Progress Bars with Motion**:
   - Replace jumpy CSS width transitions with smooth spring-animated `<motion.div>` progress fills.
3. **Engine Diagnostics Live Drawer**:
   - Connect `get_scraping_engine_diagnostics` to a live observability drawer showing CPU memory consumption, active network connections, and cache hit ratios.

