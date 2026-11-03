# Infinity Researcher — PDF Retrieval Engine, Rust & Python Audit Report
**Master Engineering Specification: Phase 1 Repository Audit**  
**Date:** 2026-10-29  
**Authors:** Senior Rust Systems Engineer & AI Infrastructure Architect  
**Status:** Complete — Proceeding to Phase 2 Implementation

---

## 1. Executive Summary

This audit evaluates the PDF discovery, retrieval, validation, and storage subsystems across the Infinity Researcher codebase (`src-tauri` Rust core, `python-engine` Scrapy scraping engine, and React 19 frontend). 

The audit confirms that the core architectural foundations are sound:
- Rust already coordinates local desktop storage, SQLite persistence (Schema v11), and background download queues via `DownloadManager`.
- Python engine has 109 passing pytest unit tests covering Scrapy spiders, query intelligence, and protocol serialization.
- Frontend has 211 passing Vitest tests covering two-column sidebar navigation, 3-panel literature workspace, AI tools, and citation checks.

However, several critical bottlenecks, fragile validation checks, missing candidate discovery routes, and polling inefficiencies were identified. This document details existing capabilities, reproducible bugs, root causes, dependency evaluations, missing tests, and a minimal-risk implementation plan.

---

## 2. Inventory of Existing Functionality

| Subsystem | File Location | Working Features | Retained vs Migrating |
| :--- | :--- | :--- | :--- |
| **Download Manager** | `src-tauri/src/services/download_manager.rs` | Bounded concurrency (Semaphore 3), SHA-256 calculation, atomic rename from `.tmp_*.part`, SQLite job persistence, cancellation watcher. | **Retained in Rust**; adding per-host rate limiting, real-time Tauri event emissions, and resume support. |
| **PDF Resolver** | `src-tauri/src/services/pdf_resolver.rs` | Local file detection, IEEE stamp stream resolution, Unpaywall OA API querying, `<meta name="citation_pdf_url">` extraction. | **Retained in Rust**; expanding with deterministic canonical OA URL routes (arXiv, bioRxiv, medRxiv, PLOS, PMC). |
| **Candidate Verifier** | `src-tauri/src/services/candidate_verifier.rs` | Anti-SSRF URL validation, manual redirect loop tracking, login/CAPTCHA HTML detection, 4KB binary fingerprinting, Jaccard title similarity. | **Retained in Rust**; fixing byte-zero `%PDF-` signature bug. |
| **PDF Processor** | `src-tauri/src/services/pdf_processor.rs` | `lopdf` structural parsing, encryption check, page count extraction, Info dictionary extraction, bounded text extraction. | **Retained in Rust**; handles rasterized/scanned PDFs (`no_text`) gracefully without false corruption flags. |
| **Academic Sources** | `src-tauri/src/academic_sources/` | Tier A academic API adapters: OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC. | **Retained in Rust**; primary metadata discovery layer. |
| **Web Scrapers** | `src-tauri/src/scrapers/` | Direct HTML search adapters for arXiv, bioRxiv, medRxiv, Nature, PLOS, PMC, and IEEE Xplore. | **Retained in Rust**; primary search coordinator. |
| **Python Scraper Engine** | `python-engine/src/paper_scraper/` | Scrapy spiders (`spiders/`), query intelligence (`discovery/query.py`), JSON-Lines protocol (`protocol.py`), PyMuPDF text extraction. | **Retained in Python** for specialized spiders and document parsing via versioned JSON Lines RPC. |
| **Database Persistence** | `src-tauri/src/database/migrations.rs` | SQLite v11 with `papers`, `paper_files`, `download_jobs`, `pdf_candidates`, `retrieval_state`, and `reader_state`. | **Retained**; transactions used for all state changes. |
| **Frontend Discover View** | `src/features/discover/DiscoverView.tsx` | Streaming search results, progressive loading, paper inspector, recent searches, PDF preview. | **Retained**; fixing download fallback, pagination re-fetch bug, and event listeners. |

---

## 3. Reproducible Bugs & Root Cause Analysis

### Bug 1: Strict Zero-Byte `%PDF-` Magic Signature Rejection
* **Files:** `src-tauri/src/services/candidate_verifier.rs` (line 282), `python-engine/src/paper_scraper/pdf.py` (line 34)
* **Symptom:** Valid open-access PDFs downloaded from certain academic repositories (e.g., Springer Nature mirrors, university DSpace repositories, OJS instances) are rejected with *"Missing %PDF- header magic signature"*.
* **Root Cause:** The verifier uses `sample_bytes.starts_with(b"%PDF-")`. Many institutional repositories prefix a UTF-8 BOM (`\xEF\xBB\xBF`), carriage returns (`\r\n`), or leading comments before `%PDF-`.
* **Fix:** Inspect the first 1024 bytes with `sample_bytes[..1024].windows(5).any(|w| w == b"%PDF-")`, ensuring leading bytes are whitespace/BOM/comments and not HTML tags (`<html`, `<!doctype`, etc.).

### Bug 2: Abrupt Download Failure When Search Result Lacks Direct `pdf_url`
* **File:** `src/features/discover/DiscoverView.tsx` (lines 1426–1434)
* **Symptom:** When a user clicks "Download PDF" on a paper discovered with only a DOI or landing page URL (e.g. PubMed or Crossref results), the app displays a warning toast: *"No direct PDF URL detected for this record"* and stops.
* **Root Cause:** `handleDownloadPdf` checks `if (!pdfUrl)` and aborts immediately instead of delegating to `handleResolvePdf` / `resolvePaperPdf`.
* **Fix:** When `!pdfUrl`, automatically trigger the multi-evidence resolver pipeline (`PdfResolverService`), resolve candidate URLs, update the record, and enqueue the verified PDF download.

### Bug 3: Discovery "Load More" Re-Queries from Offset Zero
* **File:** `src/features/discover/DiscoverView.tsx` (lines 1265–1272)
* **Symptom:** Clicking "Load More" from academic sources re-runs the entire search from limit 0 to `limit + 50`, causing duplicate network requests and potential result duplication.
* **Root Cause:** The query handler does not pass an offset/page cursor to source adapters, so sources re-scrape the initial results.
* **Fix:** Add pagination offset support in `WebsiteSearchQuery` and `SourceAdapter`, appending new unique items without repeating prior scraped pages.

### Bug 4: Missing Per-Host Rate Limiting in Rust `DownloadManager`
* **File:** `src-tauri/src/services/download_manager.rs` (lines 21–62)
* **Symptom:** Bulk downloading 5+ papers from the same publisher (e.g. `arxiv.org` or `biorxiv.org`) fires simultaneous requests on all semaphore permits, triggering HTTP 429 (Too Many Requests).
* **Root Cause:** The semaphore is global (`MAX_CONCURRENT_DOWNLOADS = 3`), without domain-level rate limiting or request pacing.
* **Fix:** Implement a per-host token/timestamp rate limiter ensuring a configurable minimum delay (e.g. 500ms–1000ms) between requests to the same host.

### Bug 5: Polling-Only Download Progress in Frontend
* **Files:** `src/features/discover/DiscoverView.tsx` (lines 680–695), `src-tauri/src/services/download_manager.rs`
* **Symptom:** The frontend polls `listPdfDownloadJobs(20)` every 3000ms, causing laggy progress bars and unnecessary SQLite queries.
* **Root Cause:** `DownloadManager` writes progress to SQLite but does not emit real-time Tauri events.
* **Fix:** Introduce `paper:download_progress`, `paper:download_completed`, and `paper:download_failed` Tauri event emissions with monotonic byte counters.

### Bug 6: Lack of Canonical Open-Access URL Pattern Generation in `PdfResolverService`
* **File:** `src-tauri/src/services/pdf_resolver.rs` (lines 115–242)
* **Symptom:** Open-access papers from arXiv, bioRxiv, medRxiv, and PMC without direct PDF links in initial metadata fail resolution if Unpaywall is slow or rate-limited.
* **Root Cause:** Resolution skips deterministic canonical URL construction rules verified for these repositories.
* **Fix:** Implement Stage B canonical route generators for arXiv (`https://arxiv.org/pdf/{id}.pdf`), bioRxiv/medRxiv (`https://www.biorxiv.org/content/{doi}.full.pdf`), and PMC (`https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/`).

---

## 4. Library & Dependency Evaluation Table

| Library / Crate | Ecosystem | Current Version | Evaluation & Decision | Reason |
| :--- | :--- | :--- | :--- | :--- |
| `reqwest` | Rust | 0.12 (rustls-tls) | **RETAIN** | Modern async HTTP client with connection pooling, custom redirect policy, and byte streaming. |
| `tokio` | Rust | 1.x (full) | **RETAIN** | Production async runtime, `Semaphore`, `watch`, and `oneshot` channel primitives. |
| `lopdf` | Rust | 0.34 | **RETAIN** | Robust PDF structural parser, detects encryption, extracts page counts, and extracts text without native C dependencies. |
| `sha2` | Rust | 0.10 | **RETAIN** | Fast, cryptographic SHA-256 calculation for byte verification and deduplication. |
| `rusqlite` | Rust | 0.40.2 (bundled) | **RETAIN** | Embedded ACID SQL storage with WAL mode, foreign keys, and FTS5. |
| `scraper` | Rust | 0.22 | **RETAIN** | Fast HTML parsing for citation meta tags and Open Graph data. |
| `httpx` | Python | 0.28.1 | **RETAIN** | High-performance async HTTP client used in Python engine for spiders and adapters. |
| `Scrapy` | Python | 2.19.0 | **RETAIN** | Retained strictly for complex multi-page spiders behind isolated worker subprocesses. |
| `PyMuPDF` | Python | Installed | **RETAIN** | Used for deep PDF document text extraction and OCR fallback when called via RPC. |

No bloated external crates or redundant scraping frameworks are needed. All improvements can be cleanly achieved by enhancing the existing Rust services and targeted Python bug fixes.

---

## 5. Missing Test Coverage

1. **Rust Unit Tests Needed:**
   - Test PDF magic byte detection with leading BOM (`\xef\xbb\xbf%PDF-1.5`) and leading whitespace.
   - Test per-host rate limiting pacing under concurrent queue loads.
   - Test candidate scoring model with varied confidence signals.
   - Test canonical OA URL generation for arXiv, bioRxiv, medRxiv, PLOS, and PMC.
   - Test atomic download commit with simulated file-system and database recovery.

2. **Python Unit Tests Needed:**
   - Test `verify_pdf_signature` with BOM and comment prefixes.
   - Test Scrapy spider termination under rate-limit (HTTP 429) conditions.

3. **Frontend Tests Needed:**
   - Test `handleDownloadPdf` automatic fallback to `handleResolvePdf` when `pdf_url` is initially undefined.
   - Test real-time `paper:download_progress` event listener handling.

---

## 6. Minimal-Risk Implementation Plan

* **Stage 1 (Phases 2 & 4):** Enhance Rust `DownloadManager` with per-host rate limiting, real-time Tauri event emissions, and BOM-tolerant PDF validation.
* **Stage 2 (Phases 3 & 9):** Implement deterministic candidate discovery and scoring in `PdfResolverService` (Stage A normalization, Stage B canonical OA routes, Stage C multi-signal scoring).
* **Stage 3 (Phase 6):** Repair Python `pdf.py` signature verification and ensure JSON-Lines protocol compatibility.
* **Stage 4 (Phases 7 & 8):** Update `DiscoverView.tsx` to auto-resolve PDFs on download, prevent pagination re-fetch bugs, and display live download progress.
* **Stage 5 (Phases 14 & 15):** Execute full verification across Rust (`cargo test --lib`), Python (`pytest`), Frontend (`vitest`), and Production Build (`npm run build`).

