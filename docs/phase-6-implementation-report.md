# Phase 6 Implementation Report: Website Scraping Engine

**Project:** Research Paper Scraper — standalone local-first desktop application  
**Phase:** 6 of 10 — Website Scraping Engine  
**Completed:** October 2026  
**Status:** COMPLETE (All unit, integration, frontend, and build checks passing)

---

## 1. Summary of Accomplishments

Phase 6 delivers a fully functional, safe, local-first **Website Scraping Engine** integrated directly into the Tauri 2 desktop architecture. The application enables researchers to crawl open-access academic websites, journal archives, and preprint servers, automatically extracting standardized scholarly metadata without relying on external cloud services or fragile browser automation.

Key achievements:
- **Safe Crawling Engine in Rust:** Built an asynchronous crawler using `reqwest`, `scraper`, and `tokio` with strict RFC 9309 `robots.txt` compliance, request throttling, domain boundaries, and polite crawl delays.
- **Robust Anti-SSRF Protection:** Built `UrlGuard` that rejects non-HTTP(S) schemes, IPv4 loopback (`127.0.0.0/8`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata endpoints (`169.254.169.254`), and IPv6 loopback (`::1`, `[::1]`).
- **Multi-Standard Metadata Extraction:** Implemented extraction across Highwire Press (`citation_*`), Dublin Core (`DC.*`), Schema.org JSON-LD (`ScholarlyArticle`, `MedicalScholarlyArticle`), and site-specific CSS selector fallbacks.
- **Persistent Job State & Frontier Queue:** Added SQLite database migration `0002_website_scraping_engine.sql` supporting `crawl_profiles`, `crawl_jobs`, `crawl_queue`, and `crawl_job_papers`. Jobs survive app restarts with full Pause, Resume, and Cancel support.
- **Real UI Integration:**
  - **Downloads View:** Live crawl job dashboard with progress gauges, queue counts, pause/resume/cancel controls, and discovered papers import drawer.
  - **Sources View:** Toggle between Academic Connectors and Website Scraping Profiles, profile creation modal, and a live URL extraction preview sandbox.
- **Zero Mock Policy in Production:** All extraction, crawl queueing, robots checking, and library imports operate via real Rust desktop commands.

---

## 2. Repository Changes

### Backend (Rust / Tauri 2)
1. **`src-tauri/migrations/0002_website_scraping_engine.sql`**: Added tables `crawl_profiles`, `crawl_jobs`, `crawl_queue`, and `crawl_job_papers` with initial seed profiles (`biorxiv`, `nature`, `plos`, `acm`, `generic`).
2. **`src-tauri/src/database/migrations.rs`**: Registered migration 0002 and updated migration tests.
3. **`src-tauri/src/domain/crawl.rs`**: Domain types for profiles, jobs, queue items, and crawled paper records.
4. **`src-tauri/src/repositories/crawl_repo.rs`**: SQLite repository for CRUD operations on profiles, jobs, queue state, and discovered papers.
5. **`src-tauri/src/scrapers/url_guard.rs`**: Anti-SSRF validation, URL normalization, domain boundary checks, and relative link resolution.
6. **`src-tauri/src/scrapers/robots.rs`**: RFC 9309 `robots.txt` parser with wildcard/anchor matching, crawl-delay calculation, and domain-keyed `RobotsCache`.
7. **`src-tauri/src/scrapers/extractor.rs`**: Scholarly metadata extractor supporting Highwire Press, Dublin Core, Schema.org JSON-LD, and CSS selectors.
8. **`src-tauri/src/scrapers/engine.rs`**: Multi-threaded crawl worker with `Arc<AtomicBool>` cancellation/pause controllers, queue processing, and library import integration.
9. **`src-tauri/src/commands/crawl.rs`**: 14 typed Tauri IPC commands for profile management, extraction previews, job control, and paper importing.
10. **`src-tauri/src/lib.rs` & `src-tauri/src/state/mod.rs`**: Registered `CrawlEngineState` and crawl IPC commands.
11. **`src-tauri/tests/crawl_engine_tests.rs`**: 6 integration tests covering robots parsing, SSRF rejection, metadata extraction, queue persistence, and library deduplication.

### Frontend (React 19 / TypeScript / Vite)
1. **`src/lib/desktop-api/types.ts`**: Added TypeScript interfaces for `CrawlProfile`, `CrawlJob`, `CrawlQueueItem`, `CrawledPaperRecord`, and preview request/response.
2. **`src/lib/desktop-api/index.ts`**: Added typed IPC wrappers for all 14 crawl commands with graceful web preview fallbacks.
3. **`src/features/downloads/DownloadsView.tsx`**: Implemented real-time crawl job manager, active queue counters, pause/resume/cancel controls, and discovered papers import drawer.
4. **`src/features/sources/SourcesView.tsx`**: Added dual-tab navigation (API Connectors vs Website Scraping), custom profile creator, and live URL extraction preview sandbox.
5. **`src/test/crawl-engine.test.tsx`**: Unit tests verifying DownloadsView job monitoring and SourcesView sandbox extraction preview.

---

## 3. Security, Privacy, and Content Handling

1. **SSRF Prevention:**
   - Evaluated by `UrlGuard::validate_url`.
   - Explicitly rejects:
     - `127.0.0.1`, `127.10.0.1` (IPv4 loopback)
     - `10.0.0.1`, `172.16.0.1`, `192.168.1.1` (RFC 1918 private LANs)
     - `169.254.169.254` (Cloud instance metadata services)
     - `[::1]`, `::1` (IPv6 loopback)
     - `localhost`, `*.internal`, `*.local`
2. **Resource Throttling & Limits:**
   - Response size ceiling: 5 MB per page to avoid out-of-memory errors on binaries.
   - HTTP connect/read timeout: 15 seconds.
   - Crawl delay: Minimum 1,000 ms between sequential requests to the same origin host.
   - Max page and depth ceilings: Enforced at both profile and worker levels.
3. **Respect for Publisher Controls:**
   - Strictly obeys `robots.txt` disallows when `respect_robots` is enabled.
   - Never bypasses paywalls, CAPTCHAs, or authentication forms.

---

## 4. Verification and Test Results

### 4.1. Rust Test Suite (`cargo test`)
All 46 unit and integration tests passed:
- **32 unit tests in `research-paper-scraper` lib**:
  - `test_url_guard_ssrf_protection`: PASS
  - `test_url_guard_domain_and_pattern_filtering`: PASS
  - `test_url_guard_normalization`: PASS
  - `test_robots_txt_allow_disallow`: PASS
  - `test_robots_crawl_delay`: PASS
  - `test_highwire_press_metadata_extraction`: PASS
  - `test_dublin_core_metadata_extraction`: PASS
  - `test_schema_org_json_ld_extraction`: PASS
  - `test_link_discovery`: PASS
  - Academic connectors, database migrations, and health tests: ALL PASS.
- **6 integration tests in `tests/crawl_engine_tests.rs`**:
  - `test_robots_parser_integration`: PASS
  - `test_url_guard_ssrf_rejection`: PASS
  - `test_extractor_html_standards`: PASS
  - `test_crawl_profile_persistence`: PASS
  - `test_crawl_job_and_queue_lifecycle`: PASS
  - `test_crawled_paper_import_to_library`: PASS
- **8 other integration tests** (`academic_search_tests`, `database_tests`): ALL PASS.

### 4.2. Code Quality & Formatting
- `cargo fmt --check`: PASSED.
- `cargo clippy -- -D warnings`: PASSED (0 warnings).

### 4.3. Frontend Quality Gates (`npm run check:all`)
- `npm run typecheck` (`tsc --noEmit`): PASSED (0 errors).
- `npm run lint` (`eslint .`): PASSED (0 errors).
- `npm run test` (`vitest run`): PASSED (6 test files, 33 tests passed).
- `npm run build` (`vite build`): PASSED (production bundle created).

---

## 5. Acceptance Checklist

| Requirement | Status | Evidence |
| :--- | :--- | :--- |
| Configurable source profiles | **PASS** | 5 built-in profiles in SQLite; CRUD commands in `crawl.rs`; profile creator in UI. |
| RFC 9309 robots.txt compliance | **PASS** | `RobotsTxt::parse` matches agents, wildcards, end anchors, and crawl delays with unit tests. |
| Domain boundaries & Anti-SSRF | **PASS** | `UrlGuard::validate_url` blocks private IPs, metadata IPs, and loopbacks; verified in tests. |
| Structured metadata extraction | **PASS** | `HtmlExtractor` parses Highwire Press, Dublin Core, Schema.org JSON-LD, and CSS fallbacks. |
| Persistent job states & queue | **PASS** | SQLite tables `crawl_jobs` and `crawl_queue` maintain frontier state across sessions. |
| Pause, resume, and cancel | **PASS** | `CrawlEngineState` with `Arc<AtomicBool>` triggers immediate worker pause/cancel. |
| UI integration | **PASS** | `DownloadsView` monitors jobs and imports papers; `SourcesView` previews live URL extraction. |
| Library deduplication | **PASS** | Crawled papers save to library via `PaperService` with DOI and title matching. |
| Quality gates pass | **PASS** | All Rust and TypeScript tests, lints, and builds pass cleanly. |

---

## 6. Phase 7 Handoff Notes

Phase 7 will implement the **Advanced PDF Extraction Pipeline**.
Key points for Phase 7:
1. **Crawled PDF Links:** `crawl_job_papers` records now capture `pdf_url` (extracted from `citation_pdf_url` meta tags or link tags). These URLs serve as valid seed targets for Phase 7 retrieval.
2. **Local Storage Contract:** PDF files should be downloaded into the user's configured research storage folder, with SHA-256 integrity verification.
3. **Text Extraction:** Extract full-text content, sections, references, and embedded figures using local Rust libraries (e.g., `pdf-extract` or `lopdf`).
