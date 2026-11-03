# Infinity Researcher — Production Release Baseline

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author & Creator:** Sanjay  
**Publisher & Developer Brand:** Infinity Web Technology  
**Copyright:** © 2026 Sanjay. All rights reserved.  
**Bundle Identifier:** `com.infinitywebtechnology.infinityresearcher`  
**Git Remote:** `https://github.com/sanjay-m6/Infinity-Researcher.git`  
**Release Target:** Windows 10/11 x64 (NSIS & WiX MSI)  
**Date of Verification:** October 27, 2026  
**Auditor:** Senior Tauri Release Engineer & Desktop Architect  

---

## 1. Executive Summary & Production Identity

Infinity Researcher is an AI-powered, local-first research workspace and literature intelligence workbench engineered by **Sanjay** and published by **Infinity Web Technology**. It combines automated scholarly paper crawling, full-text PDF parsing and reading, evidence extraction across 9 PRISMA review matrix dimensions, research integrity checking (exact/near-exact text similarity and AI-signal evaluation), signed in-app updates, and an in-app GitHub bug and feedback reporting center.

---

## 2. Technical Stack & Architecture

| Layer | Component / Technology | Version & Specification |
| :--- | :--- | :--- |
| **Desktop Shell** | Tauri v2 | Tauri `v2.12.5`, `tauri-build` `v2.0` |
| **Backend Core** | Rust Systems Language | Rust `1.85+` / `1.99.1` (MSVC toolchain) |
| **Local Storage** | SQLite 3 | `rusqlite 0.40.2` (bundled, FTS5 full-text, WAL mode) |
| **Database Path** | Operating System AppData | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\infinity-researcher.sqlite3` |
| **Frontend Framework** | React & TypeScript | React `19.1.0`, TypeScript `6.0.3`, Tailwind CSS `v4` |
| **Bundler & Test Runner** | Vite & Vitest | Vite `8.0.16`, Vitest `5.0.5`, `@testing-library/react` |
| **Sidecar Engine** | Python Scrapy Engine | Python `3.10+` / PyInstaller standalone sidecar executable |
| **In-App Updater** | Tauri v2 Updater | `@tauri-apps/plugin-updater`, Minisign Ed25519 signing |
| **Process Management** | Tauri v2 Process | `@tauri-apps/plugin-process` for safe user-approved restart |
| **Packaging Target** | Windows Installer | NSIS `.exe` (per-user currentUser) & WiX `.msi` (x64) |

---

## 3. Storage Separation & User Data Integrity

- **Program Binaries:** Installed to `%LOCALAPPDATA%\Programs\Infinity Researcher\` (per-user NSIS) or `%ProgramFiles%\Infinity Researcher\` (per-machine MSI).
- **User Research Data:** Saved strictly in per-user application data directory `%APPDATA%\com.infinitywebtechnology.infinityresearcher\`.
- **Database File:** `infinity-researcher.sqlite3` with dual migration fallback checking for legacy `research-paper-scraper.sqlite3`.
- **WAL & Concurrency:** PRAGMA `foreign_keys = ON`, `busy_timeout = 5000`, `synchronous = NORMAL`, and WAL mode enabled on disk.
- **Uninstaller Contract:** Uninstallation removes binaries and Start Menu/desktop shortcuts, leaving the user's research database, notes, tags, PDFs, and local model configurations intact by default.

---

## 4. Comprehensive Test Baseline

All test suites execute with 100% passing status:

| Test Layer | Test Tool | Tests Executed | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rust Desktop Backend** | `cargo test` | 98 | 98 | 0 | :white_check_mark: Passing |
| **Python Scraping Engine** | `pytest` | 65 | 65 | 0 | :white_check_mark: Passing |
| **Frontend & Updater Tests**| `npx vitest run` | 106 (18 files) | 106 | 0 | :white_check_mark: Passing |
| **Secret & Hygiene Scan** | `npm run audit:secrets`| 500+ files | 500+ | 0 | :white_check_mark: Passing |
| **SemVer Synchronization**| `npm run version:check`| 3 manifests | 3 | 0 | :white_check_mark: Passing |
| **Total Automated Tests** | — | **269** | **269** | **0** | :white_check_mark: 100% Green |

---

## 5. Security & Permission Scope

- **Tauri IPC Commands:** Strictly bound to defined domain handlers; arbitrary shell execution is blocked.
- **Anti-SSRF Protection:** Web scraping requests validate IP addresses, blocking loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and RFC 1918 private ranges.
- **Content Security Policy:** Strict CSP preventing unauthorized script injection.
- **Diagnostic Scrubbing:** Regex redaction for GitHub PATs, OpenAI/Anthropic/Gemini keys (`sk-*`), Bearer tokens, and Windows username paths.
- **Cryptographic Keys:** Minisign public key embedded in `tauri.conf.json`; private keys remain outside source control.
