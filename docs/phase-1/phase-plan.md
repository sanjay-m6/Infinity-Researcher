# Ten-Phase Engineering Roadmap & Execution Plan

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Enforceable  

---

## 1. Roadmap Overview & Sequencing Logic

The ten-phase roadmap establishes a strict dependency graph ensuring that each engineering milestone builds upon verified, tested foundations. No application code or dependencies are introduced before their architectural requirements and security bounds are proven.

```
[Phase 1: Specs & Source Research] (Complete)
           │
           ▼
[Phase 2: Tauri 2 + Rust + React Bootstrap & Security Baseline]
           │
           ▼
[Phase 3: Design System, Shell Layout, Navigation & Accessibility]
           │
           ▼
[Phase 4: SQLite Database Repositories, Migrations & Local Storage]
           │
           ▼
[Phase 5: Academic API Connectors (OpenAlex, Crossref, arXiv, Europe PMC, S2AG)]
           │
           ▼
[Phase 6: Resilient Job Queue, Rate Limiters, Backoff & Diagnostics]
           │
           ▼
[Phase 7: Normalization, Safe PDF Download Pipeline & Deduplication]
           │
           ▼
[Phase 8: Research Workflows: FTS5 Search, Collections, Tags, Notes, Exports]
           │
           ▼
[Phase 9: Comprehensive QA, Security Penetration, Benchmarking & Recovery]
           │
           ▼
[Phase 10: Multi-Platform Packaging, Installers, User Guides & Release]
```

---

## 2. Phase-by-Phase Execution Blueprints

### Phase 1: Requirements, Source Research, and System Logic
* **Objective:** Establish the comprehensive, evidence-based technical specification, source capabilities matrix, collection policy, domain model, and risk register.
* **Prerequisites:** Clean workspace; access to official academic source documentation.
* **Tasks:** Workspace assessment; official API verification; PRD authoring; user journeys; domain modeling; ADR writing; roadmap definition.
* **Deliverables:** Complete `docs/phase-1/` documentation suite and ADRs.
* **Exit Criteria:** All Phase 1 stop/go acceptance gates verified; zero production code or package dependencies introduced.
* **Estimated Effort:** 3–5 working days (Provisional).

---

### Phase 2: Architecture and Project Foundation
* **Objective:** Bootstrap the foundational desktop shell with Tauri 2, Rust backend, React/TypeScript/Vite frontend, Tailwind CSS v4, strict CSP, and typed IPC scaffolding.
* **Prerequisites:** Approved Phase 1 specification; Node.js, npm, Rust toolchains.
* **Key Tasks:**
  1. Initialize Tauri 2 project in clean workspace (`npx @tauri-apps/cli`).
  2. Configure `Cargo.toml` with stable dependencies (`tokio`, `serde`, `serde_json`, `thiserror`, `tracing`).
  3. Configure Vite, TypeScript, and Tailwind CSS v4.
  4. Implement strict Tauri capability permissions (CSP, disable unused system plugins).
  5. Establish typed IPC communication pipeline between React and Rust (`invoke` wrapper).
  6. Set up linting, formatting, and CI testing scripts (`cargo test`, `npm run lint`, `npm test`).
* **Deliverables:** Compiling, runnable desktop application shell displaying basic diagnostic info; green CI build.
* **Tests:** `cargo check`, `cargo test`, `npm test`, app launches window on Windows desktop.
* **Risks:** Dependency version incompatibilities; Windows WebView2 runtime path discrepancies.
* **Exit Criteria:** Desktop application compiles and launches in $< 1.5\text{s}$; typed echo command succeeds over IPC.
* **Estimated Effort:** 3–4 working days (Provisional).

---

### Phase 3: UI Design System and Navigation
* **Objective:** Implement the complete visual system, layout frame, routes, theme switcher, accessible controls, and responsive states.
* **Prerequisites:** Phase 2 compilation and IPC baseline.
* **Key Tasks:**
  1. Establish Tailwind CSS v4 theme tokens (slate/indigo/emerald palettes, dark and light modes).
  2. Implement reusable atomic UI components (Button, Input, Badge, Dialog, Drawer, VirtualTable, Card).
  3. Build persistent Navigation Rail and App Titlebar with custom window controls.
  4. Create routing shell (`/dashboard`, `/search`, `/library`, `/jobs`, `/sources`, `/settings`).
  5. Build reusable empty, loading (skeleton shimmer), and error state containers.
  6. Enforce full keyboard navigation (`Ctrl+K`, `Esc`, focus trapping) and WCAG AA contrast.
* **Deliverables:** Interactive, styled desktop UI with navigable placeholder screens and theme persistence.
* **Tests:** Component unit tests; axe-core accessibility audit; keyboard focus navigation tests.
* **Risks:** Layout shift during virtualized scrolling.
* **Exit Criteria:** Zero WCAG AA contrast violations; smooth 60 FPS navigation across all main routes.
* **Estimated Effort:** 4–5 working days (Provisional).

---

### Phase 4: Local Database and Library Storage
* **Objective:** Implement SQLite persistence, versioned migrations, entity repositories, and user-configurable document storage directory.
* **Prerequisites:** Phase 2 Rust scaffolding; Phase 1 domain schema.
* **Key Tasks:**
  1. Integrate `rusqlite` with bundled SQLite and FTS5 support.
  2. Implement migration runner with initial migration (`001_initial_schema.sql`).
  3. Implement strongly typed repositories for `papers`, `authors`, `paper_authors`, `sources`, `source_records`, `files`, `collections`, `tags`, `notes`.
  4. Build `StorageManager` to initialize and validate library storage path (`%USERPROFILE%\Documents\ResearchPapers`).
  5. Expose Tauri commands for library CRUD and directory selection dialog.
* **Deliverables:** Functional SQLite database persistence with automated migrations and passing integration tests.
* **Tests:** SQLite unit/integration tests (`PRAGMA foreign_keys = ON; PRAGMA integrity_check;`); migration rollback tests.
* **Risks:** SQLite file locking conflicts in multi-threaded environment (mitigated by WAL mode and connection pooling).
* **Exit Criteria:** 1,000 synthetic records inserted, queried, and verified with foreign key cascade integrity.
* **Estimated Effort:** 4–5 working days (Provisional).

---

### Phase 5: Academic API Connectors
* **Objective:** Implement the core `AcademicConnector` trait and official Tier A integrations for OpenAlex, Crossref, Semantic Scholar, arXiv, and Europe PMC.
* **Prerequisites:** Phase 4 database foundations; network client with SSRF guard.
* **Key Tasks:**
  1. Build resilient HTTP client with SSRF blocking, connection timeouts, and transparent User-Agent headers.
  2. Implement OpenAlex connector (search, query params, inverted abstract reconstruction).
  3. Implement Crossref connector (bibliographic search, polite pool header `mailto`).
  4. Implement Semantic Scholar connector (partner API key support, `openAccessPdf` extraction).
  5. Implement arXiv connector (XML/Atom parser, 3-second pacing delay).
  6. Implement Europe PMC connector (biomedical query mapping, PMC OA link extraction).
  7. Implement connector test harness with recorded, sanitized mock JSON/XML fixtures.
* **Deliverables:** Five verified Tier A connectors passing mock contract tests.
* **Tests:** Unit tests against static mock responses; SSRF rejection tests; User-Agent inspection tests.
* **Risks:** Upstream API schema drift or undocumented breaking changes.
* **Exit Criteria:** 100% test pass rate for all 5 connectors across search and DOI lookup without live network dependencies.
* **Estimated Effort:** 5–7 working days (Provisional).

---

### Phase 6: Permitted Website Adapters and Job Queue
* **Objective:** Implement the persistent job queue, token bucket rate limiters, backoff/retry engine, and Tier B static feed adapters.
* **Prerequisites:** Phase 5 API connectors; Phase 4 `jobs` database table.
* **Key Tasks:**
  1. Build asynchronous job worker (`tokio::sync::mpsc`) managing global and per-host concurrency.
  2. Implement token-bucket rate limiter per host in Rust.
  3. Build exponential backoff with jitter and `Retry-After` header parser.
  4. Implement cancellation watch channels and progress event streaming to UI.
  5. Add Tier B permitted adapters (e.g. bioRxiv preprint feed) and DOAJ / CORE connectors.
  6. Build UI Jobs & Downloads panel with live progress bars and cancel/retry buttons.
* **Deliverables:** Fully observable background queue and rate-limiting system.
* **Tests:** Mocked rate-limiting test (asserting 3s interval for arXiv); retry-after delay test; cancellation test.
* **Risks:** Memory leaks from uncancelled async tasks (mitigated by RAII cancellation tokens).
* **Exit Criteria:** Enqueuing 20 jobs demonstrates strict rate-limiting; clicking cancel cleanly halts worker within $100\text{ms}$.
* **Estimated Effort:** 4–6 working days (Provisional).

---

### Phase 7: Normalization, Safe PDF Download Pipeline, and Deduplication
* **Objective:** Build the end-to-end normalization pipeline, safe streaming PDF download pipeline, checksum deduplication, and PDF text extraction.
* **Prerequisites:** Phase 5 connectors; Phase 6 download queue; Phase 4 storage layer.
* **Key Tasks:**
  1. Build `MetadataNormalizer` implementing DOI canonicalization and Unicode title cleaning.
  2. Build `DeduplicationEngine` (Tier 1 DOI merge, Tier 2 ID merge, Tier 3 Jaro-Winkler review flagging).
  3. Build streaming download pipeline: stream to `.tmp`, verify `%PDF-` magic bytes, enforce 100MB limit, compute SHA-256, atomic rename.
  4. Integrate safe Rust PDF text extractor (`lopdf` / `pdf-extract`) for full-text indexing.
  5. Build interactive Side-by-Side Duplicate Review Workspace in UI.
* **Deliverables:** Safe download pipeline, verified deduplication engine, and PDF text ingestion.
* **Tests:** Magic byte rejection test (HTML error page); SHA-256 collision test; Jaro-Winkler scoring unit tests.
* **Risks:** Malformed PDFs crashing parser (mitigated by isolated worker thread and panic catch).
* **Exit Criteria:** Downloading test PDF verifies SHA-256 and magic header; non-PDF download cleanly aborts without disk pollution.
* **Estimated Effort:** 5–7 working days (Provisional).

---

### Phase 8: Research Workflows (Search, Collections, Tags, Notes, Exports)
* **Objective:** Integrate end-to-end research workflows: local FTS5 search, collections, tags, Markdown notes, local PDF folder import, and BibTeX/RIS/CSV exports.
* **Prerequisites:** Phase 4 database; Phase 7 file pipeline; Phase 3 UI design system.
* **Key Tasks:**
  1. Implement SQLite FTS5 triggers and search queries across metadata and document text.
  2. Wire up Collections tree (drag-and-drop or multi-select assignment).
  3. Wire up flat colored Tags and tag filtering in Library view.
  4. Implement Markdown research note editor with live preview and auto-save.
  5. Build batch PDF folder import workflow with DOI regex extraction.
  6. Build deterministic citation exporter for BibTeX (`.bib`), RIS (`.ris`), CSV, and JSON.
* **Deliverables:** Feature-complete local research application operating end-to-end.
* **Tests:** FTS5 search accuracy tests; batch import benchmark; BibTeX syntax validation tests.
* **Risks:** LaTeX escaping errors on complex mathematical titles.
* **Exit Criteria:** Importing 50 local PDFs backfills metadata; exporting to BibTeX parses cleanly with `bibtex` compiler.
* **Estimated Effort:** 5–7 working days (Provisional).

---

### Phase 9: QA, Security Penetration, Benchmarking, and Recovery
* **Objective:** Perform rigorous end-to-end testing, security penetration simulation, crash recovery validation, and performance benchmarking against NFRs.
* **Prerequisites:** Complete Phase 1–8 implementations.
* **Key Tasks:**
  1. Execute automated security test suite (SSRF, path traversal, XSS, log redaction).
  2. Simulate network faults (slow 3G, 100% packet drop, HTTP 429 storms, upstream 503).
  3. Validate crash recovery (kill process during active download/migration; verify zero corruption).
  4. Benchmark startup time, FTS5 latency, and memory footprint on 5,000-paper test fixture.
  5. Conduct accessibility audit and usability sweep on Windows desktop.
* **Deliverables:** QA audit report, security verification report, and benchmark metrics document.
* **Tests:** End-to-end Playwright/WebDriver desktop tests; Criterion benchmarks; `PRAGMA integrity_check`.
* **Risks:** Memory leaks identified during extended multi-hour scraping runs.
* **Exit Criteria:** 100% of NFR targets met; 0 high/critical security risks; clean crash recovery proven.
* **Estimated Effort:** 4–5 working days (Provisional).

---

### Phase 10: Multi-Platform Packaging, User Documentation, and Release
* **Objective:** Generate production desktop installers (Windows MSI/NSIS), configure auto-updates/rollback strategy, author user guides, and publish final release assets.
* **Prerequisites:** Phase 9 QA sign-off.
* **Key Tasks:**
  1. Configure Tauri bundler for Windows NSIS and MSI installers with application icons and code signing.
  2. Verify cross-platform compilation targets for macOS (DMG) and Linux (AppImage/deb).
  3. Author comprehensive end-user documentation (`docs/user-guide.md`, backup & restore manual).
  4. Build automated database backup and restore utility in Settings.
  5. Generate final release checksums (SHA-256) and publish release notes.
* **Deliverables:** Signed Windows installer (`.exe` / `.msi`), user manuals, and verified release checklist.
* **Tests:** Clean install and uninstall tests on fresh Windows 10 and 11 environments.
* **Risks:** Code signing certificate prerequisites.
* **Exit Criteria:** Windows installer executes cleanly, installs app, launches in $< 1.5\text{s}$, and cleanly uninstalls.
* **Estimated Effort:** 3–4 working days (Provisional).
