# Scraper Verification & Test Report

This test report summarizes the automated testing, compilation, linting, and security verification executed for the Website-Driven Research Paper Scraper (No-API Engine).

---

## 1. Test Environment

- **Operating System**: Windows 11 (x86_64)
- **Rust Toolchain**: `rustc 1.85.0+` / `cargo`
- **Node.js Environment**: Node.js v22+
- **Frontend Stack**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- **Backend Stack**: Tauri 2 + Rust + SQLite (rusqlite) + reqwest + scraper (html5ever)
- **Local PDF Engine**: pdfjs-dist v6.4.299 with bundled Web Worker

---

## 2. Test Execution & Pass/Fail Counts

### A. Rust Unit & Integration Tests
- **Command Executed**:
  ```bash
  cargo test --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target/check --lib
  ```
- **Execution Result**: **50 PASSED, 0 FAILED, 0 IGNORED** (Finished in 0.19s)
- **Coverage Areas**:
  - `scrapers::url_guard`: Anti-SSRF blocking (private IPs, loopback, cloud metadata `169.254.169.254`), scheme rejection, credential stripping, domain matching, URL normalization, link resolution.
  - `scrapers::robots`: robots.txt parsing, disallow/allow rule evaluation, crawl delay parsing.
  - `scrapers::extractor`: Highwire Press metadata extraction, Dublin Core parsing, Schema.org JSON-LD extraction.
  - `repositories::pdf_workspace_repo`: Reader state persistence, PDF candidate tracking, download job lifecycle.
  - `services::deduplication`: Exact DOI matching, conflicting DOIs, near-duplicate detection and scoring.
  - `services::file_integrity`: Path traversal protection, SHA-256 stream calculation, zero-byte file handling.
  - `services::pdf_processor`: Magic-byte `%PDF-` validation, corrupt file rejection, missing file detection, synthetic minimal valid PDF rendering.
  - `services::download_manager`: Download queue state recovery, job progress transitions.
  - `services::metadata_normalizer`: Title normalization, DOI formatting, arXiv ID normalization, abstract HTML sanitization, publication date parsing.
  - `database::migrations`: Clean SQLite schema initialization, foreign key enforcement.

### B. Frontend Vitest Test Suites
- **Command Executed**:
  ```bash
  npm test -- --run
  ```
- **Execution Result**: **7 TEST FILES PASSED, 36 TESTS PASSED, 0 FAILED** (Duration: 12.06s)
- **Verified Suites**:
  - `src/test/domain-logic.test.ts` (12 tests) — Domain model transformations and sorting logic.
  - `src/test/desktop-api.test.ts` (6 tests) — Desktop IPC bridge fallbacks and error handling.
  - `src/test/academic-discovery.test.tsx` (4 tests) — Website-Driven Discovery View, seed presets, No-API policy warning banner, empty state.
  - `src/test/crawl-engine.test.tsx` (2 tests) — DownloadsView live progress, SourcesView scraping profile tab.
  - `src/test/processing-pipeline.test.tsx` (3 tests) — LibraryView processing tabs, duplicate review, document integrity table.
  - `src/test/DiagnosticView.test.tsx` (3 tests) — Safe error handling, web preview fallback.
  - `src/test/AppShell.test.tsx` (6 tests) — Shell navigation, theme toggle, paper drawer, collection duplication prevention, command palette.

### C. TypeScript Typecheck
- **Command Executed**:
  ```bash
  npm run typecheck
  ```
- **Execution Result**: **EXIT CODE 0** (0 errors, 0 warnings).

### D. ESLint Static Analysis
- **Command Executed**:
  ```bash
  npm run lint
  ```
- **Execution Result**: **EXIT CODE 0** (0 errors, 0 warnings).

### E. Frontend Production Build
- **Command Executed**:
  ```bash
  npm run build
  ```
- **Execution Result**: **EXIT CODE 0** (Built in 3.94s).
- **Generated Artifacts**:
  - `dist/index.html` (0.63 kB)
  - `dist/assets/pdf.worker.min-CjEcRF4W.mjs` (1,264.34 kB)
  - `dist/assets/index-y5U_LogQ.css` (70.88 kB)
  - `dist/assets/index-BAXMhvf_.js` (889.37 kB)

---

## 3. Verified End-to-End Workflows

1. **Website Source Configuration Wizard**:
   - URL entry -> Policy & Robots.txt evaluation via `checkWebsitePolicy` -> Platform identification -> Acquisition mode selection -> Polite delay configuration -> Profile persistence.
2. **URL Extraction Sandbox & Single Page Import**:
   - Paste paper URL -> Preview Highwire Press, Dublin Core, and direct PDF URL -> Single-click import into local SQLite database.
3. **Controlled Website Crawl**:
   - Seed URL -> Bounded crawler with anti-SSRF protection -> Highwire/DC metadata extraction -> Persistent crawl queue and job event tracking.
4. **Permitted PDF Download & File Integrity**:
   - Direct public PDF detection -> Streaming download to temporary file -> Magic byte `%PDF-` validation -> SHA-256 calculation -> Atomic rename -> Link with SQLite paper record.
5. **Integrated In-App PDF Reader**:
   - Binary local file loading via Tauri IPC -> Zoom, fit width/page, rotate, thumbnail sidebar, in-PDF text search -> Reading position saved in `reader_state`.

---

## 4. Remaining Issues & Limitations

- **JavaScript Hydration Dependency**: Websites that rely entirely on heavy client-side JavaScript rendering without server-rendered meta tags require Rendered Website mode rather than static HTML mode.
- **Paywalled Documents**: Commercial subscription articles without open-access licensing cannot be downloaded and remain strictly as bibliographic citation metadata with landing-page links.
