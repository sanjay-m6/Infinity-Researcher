# Phase 9 Baseline Assessment & Health Record

**Date:** 2026-10-24  
**Project:** Research Paper Scraper (Desktop Application)  
**Branch:** `master`  
**Base Commit:** `f882c441fe1d4a41c81db40ab39ba76ef37ff753`  
**Repository State:** Modified / Active Phase 9 Hardening Branch  

---

## 1. Toolchain & Environment Specifications

| Component | Tool / Runtime | Version | Status |
|:---|:---|:---|:---|
| Host Operating System | Microsoft Windows 11 Pro | x86_64 | Verified |
| Rust Compiler | `rustc` | `1.99.1 (58cf8f9c3 2026-10-13)` | Active |
| Rust Package Manager | `cargo` | `1.99.1 (5f94df478 2026-08-27)` | Active |
| Node.js Runtime | `node` | `v24.13.1` | Active |
| JavaScript Package Manager | `npm` | `11.8.0` | Active |
| Desktop Framework | Tauri 2 (`@tauri-apps/api`, `tauri` crate) | `2.x` | Verified |
| Frontend Framework | React 19 + TypeScript + Vite | `v8.3.5` | Verified |
| Database Engine | SQLite 3 (`rusqlite` bundled with FTS5) | `3.x` | Verified |

---

## 2. Baseline Verification Commands & Status

All commands were executed directly against the local repository without mocks for system tools.

| Layer / Check | Exact Command Line | Exit Code | Result Summary | Pre-existing Issue? |
|:---|:---|:---|:---|:---|
| **Frontend Tests** | `npm run test -- --run` | 0 | 7 test files passed, 36 tests passed (14.63s) | No |
| **Frontend Type Check** | `npm run typecheck` (`tsc --noEmit`) | 0 | Clean. 0 type errors. | No |
| **Frontend Linter** | `npm run lint` (`eslint .`) | 0 | Clean. 0 ESLint warnings/errors. | No |
| **Frontend Production Build** | `npm run build` (`tsc && vite build`) | 0 | Client built in 4.84s; assets optimized. | No |
| **Frontend Dependency Audit** | `npm audit` | 0 | Found 0 vulnerabilities. | No |
| **Rust Code Formatter** | `cargo fmt --check` | 0 | Conforms to standard Rust formatting guidelines. | Resolved formatting diffs |
| **Rust Clippy (Strict)** | `cargo clippy --all-targets --all-features -- -D warnings` | 0 | 0 clippy warnings across all crates & tests. | Resolved |
| **Rust Test Suite** | `cargo test` | 0 | **72 passed**, 0 failed, 0 ignored across 7 targets. | Resolved |
| **Rust Performance Suite** | `cargo test --test performance_benchmarks -- --nocapture` | 0 | 1 passed; all 11 benchmark milestones verified. | No |
| **Rust Security Suite** | `cargo test --test security_and_robustness_tests` | 0 | 7 passed; SSRF, CSV injection, path traversal safe. | No |
| **Rust Dependency Audit** | `cargo audit` | 1 | **Blocked:** Tool not installed on host environment. | Tooling limitation |

---

## 3. Discovered Defects & Baseline Fixes

During the initial baseline discovery and Phase 8/9 inspection, the following verified defects and gaps were identified and corrected:

### Defect 1: Unregistered Phase 8 Desktop IPC Commands
* **Symptom:** Tauri backend was missing handlers for Citation Exports, Local Document Access, Reading Progress, and Bulk Tagging commands introduced in Phase 8.
* **Root Cause:** Command functions existed in service layers but lacked Tauri wrappers and registration in `generate_handler!`.
* **Remedy:** Created [export.rs](file:///d:/Paper/src-tauri/src/commands/export.rs) and [documents.rs](file:///d:/Paper/src-tauri/src/commands/documents.rs), expanded [papers.rs](file:///d:/Paper/src-tauri/src/commands/papers.rs), [collections.rs](file:///d:/Paper/src-tauri/src/commands/collections.rs), and [tags.rs](file:///d:/Paper/src-tauri/src/commands/tags.rs), and registered all 15 commands in [lib.rs](file:///d:/Paper/src-tauri/src/lib.rs).
* **Verification:** Vitest desktop API tests and full compile check passed.

### Defect 2: Artificial Page Size Clamp in Repository Listing
* **Symptom:** Bulk library exports or listing queries requesting >100 papers were truncated to 100 items.
* **Root Cause:** [paper_repo.rs](file:///d:/Paper/src-tauri/src/repositories/paper_repo.rs#L298) clamped `q.page_size` with `.clamp(1, 100)`.
* **Remedy:** Raised clamp to `10_000` (`.clamp(1, 10_000)`), preserving safety against negative/zero bounds while permitting full-library research exports.
* **Verification:** Verified by [performance_benchmarks.rs](file:///d:/Paper/src-tauri/tests/performance_benchmarks.rs) listing 1,000 items in a single export query.

### Defect 3: CSV Formula Injection Vulnerability with Leading Whitespace
* **Symptom:** Formula payloads prepended with whitespace (e.g., `"   =cmd|' /C calc'!A0"`) bypassed prefix checks.
* **Root Cause:** `escape_csv_cell` only inspected the first character without trimming leading whitespace.
* **Remedy:** Updated [export_service.rs](file:///d:/Paper/src-tauri/src/services/export_service.rs) to inspect `text.trim_start()` for formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) and prepend `'` safely.
* **Verification:** Validated by `test_csv_formula_injection_defense` in [security_and_robustness_tests.rs](file:///d:/Paper/src-tauri/tests/security_and_robustness_tests.rs).

### Defect 4: Unbounded Response Streaming in Website Scraper
* **Symptom:** Large malicious or misconfigured web pages could consume unbounded memory during crawl jobs.
* **Root Cause:** `preview_url` and `run_crawl_worker` lacked an explicit streaming response byte ceiling.
* **Remedy:** Implemented `read_response_body_bounded` in [engine.rs](file:///d:/Paper/src-tauri/src/scrapers/engine.rs) with a hard cap of 10 MB (`MAX_RESPONSE_BODY_BYTES`), aborting transfers exceeding the threshold.
* **Verification:** Checked via unit tests in [url_guard.rs](file:///d:/Paper/src-tauri/src/scrapers/url_guard.rs).

---

## 4. Identified Platform and Tooling Limitations

1. **`cargo-audit` Unavailable:**
   The `cargo-audit` CLI binary is not installed on this local Windows development machine. The advisory check is documented as blocked. Frontend dependencies were independently audited via `npm audit` (0 vulnerabilities found).
2. **Local-First Mocked Academic Network Tests:**
   In compliance with Phase 9 execution rules (no live external API hits or scraping against live publisher paywalls during automated test runs), academic connectors (arXiv, Crossref, OpenAlex, Semantic Scholar, Europe PMC) utilize deterministic local JSON/XML fixtures and wiremock equivalents.
