# Non-Functional Requirements & Performance Targets

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Benchmark Target Hardware:** Modern x64/ARM64 Laptop (8-core CPU, 16 GB RAM, NVMe SSD)  
**Standard Test Fixture Dataset:** 5,000 indexed paper records with 500 local PDFs ($\approx 2.5\text{ GB}$ storage)  

---

## 1. Measurable Performance & Quality Targets

| Requirement Area | Target Metric / Acceptance Criteria | Measurement Procedure | Target Threshold | Tolerance | Phase Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NFR-001: Cold Startup Time** | Time from executable launch to interactive UI on benchmark hardware. | Automated timestamp from process spawn to first React frame render (`performance.now()`). | $\le 1.5\text{ seconds}$ | Max $2.5\text{s}$ | Phase 2 & 9 |
| **NFR-002: Warm Startup Time** | Time from launch when database and OS caches are warm. | Automated timestamp from process spawn to interactive UI. | $\le 0.8\text{ seconds}$ | Max $1.2\text{s}$ | Phase 2 & 9 |
| **NFR-003: Local FTS5 Search Latency** | Time to execute full-text query across 5,000 saved metadata records. | Execute 100 random keyword queries against SQLite `papers_fts`; measure p95 latency. | $\le 25\text{ ms}$ (p95) | Max $50\text{ ms}$ | Phase 4 & 9 |
| **NFR-004: In-Document Full-Text Search** | Query response time across 500 extracted PDF text documents in `doc_text_fts`. | Execute phrase queries (e.g. `"gradient descent"`); measure query execution time. | $\le 75\text{ ms}$ (p95) | Max $150\text{ ms}$ | Phase 8 & 9 |
| **NFR-005: Idle Memory Footprint** | Resident Set Size (RSS) memory consumption when idle with 5,000 records loaded. | Inspect OS process working set (Rust core + WebView2 process) after 2 minutes idle. | $\le 120\text{ MB}$ total | Max $180\text{ MB}$ | Phase 9 |
| **NFR-006: Peak Memory Under Load** | Memory usage during active 5-source federated search and 4 concurrent PDF downloads. | Profile memory using `cargo flamegraph` / Windows Performance Monitor during peak operations. | $\le 250\text{ MB}$ total | Max $350\text{ MB}$ | Phase 9 |
| **NFR-007: UI Frame Rate & Responsiveness** | UI responsiveness during rapid table scrolling and background downloads. | Chrome DevTools Performance Profiler measuring frame drops while scrolling 5,000-row virtual table. | 60 FPS (zero frames $> 33\text{ms}$) | 95% frames $\ge 50\text{ FPS}$ | Phase 3 & 9 |
| **NFR-008: Concurrency & Rate Limiting** | Strict enforcement of per-source request spacing without starvation. | Dispatch 20 concurrent queries to arXiv; verify interval between outgoing HTTP requests. | $\ge 3,000\text{ ms}$ interval | $\pm 50\text{ ms}$ | Phase 5 & 9 |
| **NFR-009: Crash Recovery & Data Integrity** | Zero database corruption or orphaned `.tmp` files following sudden SIGKILL. | Terminate process via `taskkill /F` during active download; restart app; run `PRAGMA integrity_check`. | Clean recovery; 0 corrupted files | 100% integrity pass | Phase 4 & 9 |
| **NFR-010: Database Migration Durability** | Forward and backward schema migrations execute without data loss. | Migrate v1 schema with 1,000 records to v2; verify 100% record preservation and checksum match. | 0 data loss; time $< 2\text{s}$ | 100% data pass | Phase 4 |
| **NFR-011: Accessibility Compliance** | High contrast, full keyboard navigation, and screen reader labels. | Automated axe-core accessibility audit; manual full keyboard navigation test across all views. | WCAG 2.1 Level AA | 0 critical violations | Phase 3 & 9 |
| **NFR-012: Export Throughput** | Time to export 1,000 selected papers into valid BibTeX (`.bib`). | Measure wall-clock duration of `export_citations` command on test fixture. | $\le 1.0\text{ second}$ | Max $2.0\text{s}$ | Phase 8 |
| **NFR-013: Cross-Platform Portability** | Backend logic, adapters, normalization, and database code compile across OSes. | GitHub Actions CI matrix building on Windows (MSVC), macOS (Clang), and Linux (GCC). | 100% build & test pass | Zero OS-specific leaks | Phase 2 & 10 |
| **NFR-014: Connector Maintainability** | Adding a new academic source connector requires zero changes to core library or UI. | Implement test connector using `AcademicConnector` trait without editing core domain tables. | $< 250\text{ lines of code}$ | No core refactoring | Phase 5 |

---

## 2. Benchmarking Environment and Procedure

To ensure reproducibility across evaluation cycles, all performance audits in Phase 9 will execute using the following standard protocol:
1. **Clean Test Database:** Database populated with synthetic fixture of 5,000 papers derived from OpenAlex CC0 data snapshots.
2. **Deterministic Network Simulation:** Automated tests mock network responses with simulated latency ($150\text{ms}$) and payload sizes matching live APIs.
3. **Execution Script:** `cargo bench` running Criterion-rs benchmarks for core algorithms (normalization, DOI regex, Jaro-Winkler deduplication, BibTeX generation).
4. **Pass/Fail Standard:** Any regression exceeding the defined maximum tolerance triggers an automatic build failure in CI.
