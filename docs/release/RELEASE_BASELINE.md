# Infinity Researcher — Production Release Baseline

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author & Creator:** Sanjay  
**Publisher & Developer Brand:** Infinity Web Technology  
**Copyright:** © 2026 Sanjay. All rights reserved.  
**Bundle Identifier:** `com.infinitywebtechnology.infinityresearcher`  
**Git Remote:** `https://github.com/sanjay-m6/Infinity-Researcher.git`  
**Release Target:** Windows 10/11 x64 (MSI & NSIS)  
**Date of Verification:** October 26, 2026  

---

## 1. Executive Summary & Production Identity

Infinity Researcher is an AI-powered, local-first research workspace and literature intelligence workbench engineered by **Sanjay** and published by **Infinity Web Technology**. It combines automated scholarly paper crawling, full-text PDF parsing and reading, evidence extraction across 9 PRISMA review matrix dimensions, research integrity checking (exact/near-exact text similarity and AI-signal evaluation), and an in-app GitHub bug and feedback reporting center.

---

## 2. Technical Stack & Version Matrix

| Tier | Component / Technology | Specification & Version |
| :--- | :--- | :--- |
| **Desktop Shell** | Tauri v2 | Tauri `v2.12.5`, `tauri-build` `v2.0` |
| **Backend Core** | Rust Systems Language | Rust `1.85+` / `1.99.1`, Cargo toolchain |
| **Local Storage** | SQLite 3 | `rusqlite` bundled with FTS5 full-text search, WAL mode |
| **Frontend Framework** | React & TypeScript | React `19.1.0`, TypeScript `6.0.3`, Tailwind CSS |
| **Bundler & Test Runner** | Vite & Vitest | Vite `8.0.16`, Vitest `5.0.5`, `@testing-library/react` |
| **Sidecar Engine** | Python Scraper Engine | Python `3.10+`, Scrapy, Pydantic v2, PDFPlumber |
| **Packaging Target** | Windows Installer | WiX Toolset 3.14 (MSI) & NSIS, x64 architecture |

---

## 3. Comprehensive Test Baseline & Quality Metrics

All test suites have been executed and verified in the production environment:

| Test Layer | Test Tool | Tests Executed | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rust Desktop Backend** | `cargo test` | 98 | 98 | 0 | :white_check_mark: Passing |
| **Python Scraping Engine** | `pytest` | 65 | 65 | 0 | :white_check_mark: Passing |
| **Frontend UI & Workflows** | `npx vitest run` | 88 (17 files) | 88 | 0 | :white_check_mark: Passing |
| **Diagnostic Sanitization** | `vitest` | 12 | 12 | 0 | :white_check_mark: Passing |
| **Total Automated Tests** | — | **251** | **251** | **0** | :white_check_mark: 100% Green |

---

## 4. Key Subsystems Baseline

### A. Dynamic Onboarding Wizard
- **6 Steps:** Welcome & Brand, Research Interests & Custom Topics, Primary Workflow Goals, Optional AI Setup & Local Keys, Storage & Privacy Explanation, and Review & Completion.
- **State Management:** Persistent completion flag stored in SQLite `app_settings` (`onboarding_completed: true`) with localStorage fallback.
- **Re-run & Skip Support:** Can be re-launched at any time via **Settings > Preferences > Run Setup Wizard** or via the Command Palette (`Ctrl+K`).

### B. In-App Feedback & GitHub Issue Center
- **GitHub Target:** Repository `sanjay-m6/Infinity-Researcher`.
- **Taxonomy:** 17 color-coded repository labels synchronized via `.github/labels.yml`.
- **Diagnostic Redaction:** Client-side scrubbing of GitHub PATs, provider API keys (`sk-*`), Bearer tokens, Windows user directory paths (`C:\Users\<user>`), and emails before transmission.
- **Dual Submission Flow:** Direct REST API issue creation with token storage, or 1-click "Continue on GitHub" prefilled web issue URL fallback.

### C. 9-Dimensional PRISMA Review Matrix
- Complete literature review grid tracking Paper Title, Authors/Year, Research Question, Methodology, Sample Size, Key Findings, Limitations, Quality Assessment, and Evidence-Linked Quotes with full-text jump capabilities.

### D. Research Integrity & Academic Writing Assistant
- Exact and near-exact text similarity matching against user-controlled corpora.
- Synthetic AI-signal stylistic analysis with honest uncertainty bounds and clear non-punitive guidance.
- Academic clarity rewriting preserving mathematical equations, citations, and scholarly tone.

---

## 5. Build & Packaging Instructions

### Quick Build (Frontend & Backend Check):
```bash
# Frontend build verification
npm run build

# Rust backend check
cd src-tauri
cargo check --release
cargo test
cd ..
```

### Production Installer Generation (Windows x64):
```bash
# Build complete MSI and NSIS installers
npm run tauri build
```
The resulting installers are deposited in `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/bundle/nsis/`.
