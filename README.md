# Research Paper Scraper

A standalone, local-first desktop application engineered for academic researchers. Discover papers across verified scholarly sources, collect normalized metadata, download authorized open-access documents, organize a persistent local library, search indexed records and in-document text offline, and export standardized citations.

Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Vite 8**, and **Tailwind CSS v4**.

---

## Architecture Highlights

* **Local-First & Sovereign:** All bibliographies, collections, notes, and PDF files reside on the researcher's local machine in a local SQLite database (WAL mode) and managed document directory. Zero mandatory remote servers or cloud accounts.
* **Privilege Separation:** The React frontend runs in a sandboxed webview context protected by a strict Content Security Policy. Privileged operations (networking, filesystem I/O, database access) are owned exclusively by the native Rust backend.
* **Ethical Academic Sourcing:** Interacts strictly with documented academic APIs and repository feeds (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ). Strictly adheres to published rate limits and terms of use; never bypasses paywalls or CAPTCHAs.
* **Safe Ingestion Pipeline:** Outbound requests are protected by an Anti-SSRF guard; streamed downloads verify `%PDF-` file signatures and size limits before moving files into the library.

---

## Project Structure

```
research-paper-scraper/
├── src/                               # React 19 frontend
│   ├── app/                           # App root shell (App.tsx)
│   ├── components/                    # Reusable design system primitives & layout
│   │   ├── layout/                    # AppShell, Sidebar, Toolbar, PageHeader
│   │   └── ui/                        # Button, Badge, Input, SearchInput, Modal, ConfirmDialog, Drawer, EmptyState, CommandPalette, ToastContainer
│   ├── context/                       # Centralized AppContext for view state, theme, and fixtures
│   ├── data/                          # Centralized typed demo fixtures (demo-data.ts)
│   ├── features/                      # Screen views
│   │   ├── dashboard/                 # DashboardView
│   │   ├── discover/                  # DiscoverView
│   │   ├── library/                   # LibraryView
│   │   ├── downloads/                 # DownloadsView
│   │   ├── collections/               # CollectionsView
│   │   ├── sources/                   # SourcesView
│   │   ├── activity/                  # ActivityView
│   │   ├── settings/                  # SettingsView
│   │   └── paper-details/             # PaperDetailDrawer
│   ├── hooks/                         # useApp hook
│   ├── lib/                           # Typed Tauri IPC bridge (tauri-bridge.ts)
│   ├── styles/                        # Tailwind CSS v4 entry point & theme tokens
│   ├── test/                          # Frontend test setup, Vitest unit & integration suites
│   └── types/                         # TypeScript domain models and IPC interfaces
├── src-tauri/                         # Native Rust backend
│   ├── capabilities/                  # Scoped Tauri 2 window permissions
│   ├── src/
│   │   ├── commands/                  # IPC command entry points (app_health, app_ping)
│   │   ├── config/                    # Application configuration & bounds validation
│   │   ├── errors/                    # Internal AppError & serializable CommandError
│   │   ├── logging/                   # Tracing initialization & credential redaction
│   │   ├── services/                  # Business & diagnostic services (HealthService)
│   │   ├── state/                     # Managed application state (AppState)
│   │   ├── lib.rs                     # Builder & command handler registration
│   │   └── main.rs                    # Native executable entry point
│   ├── Cargo.toml                     # Native dependencies & profiles
│   └── tauri.conf.json                # Desktop window geometry & strict CSP
├── docs/
│   ├── phase-1/                       # Approved requirements, PRD, source research, domain model, ADRs
│   ├── phase-2/                       # Foundation architecture, security baseline, quality reports
│   └── phase-3/                       # Screen inventory, design system, demo data spec, completion report
├── .github/workflows/                 # CI quality workflows (ci.yml)
├── package.json                       # Frontend dependencies & npm scripts
└── vite.config.ts                     # Vite + Tailwind v4 + Vitest configuration
```

---

## Development Prerequisites

* **Node.js:** `v18+` (Tested on `v24.13.1`)
* **npm:** `v9+` (Tested on `11.8.0`)
* **Rust:** `v1.77+` stable toolchain (Tested on `1.99.1`)
* **Platform Build Tools (Windows):** Microsoft Visual Studio C++ Build Tools & Microsoft Edge WebView2 runtime (pre-installed on modern Windows 10/11).

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Desktop Application in Development Mode
Launches Vite dev server and native Tauri desktop window simultaneously:
```bash
npm run tauri dev
```

### 3. Start Frontend Alone (Browser Fallback Mode)
Launches Vite dev server on `http://localhost:1420`:
```bash
npm run dev
```
*(Note: In browser mode, an amber status banner indicates desktop IPC is unavailable.)*

---

## Quality Gates & Verification Commands

All quality checks must pass cleanly before any code is committed:

### Frontend Checks
```bash
# Type check with TypeScript compiler
npm run typecheck

# Lint with ESLint
npm run lint

# Check code formatting with Prettier
npm run format:check

# Format files with Prettier
npm run format:write

# Run frontend unit tests with Vitest
npm run test

# Build production frontend bundle into dist/
npm run build

# Run all frontend quality checks in one command
npm run check:all
```

### Native Rust Checks
```bash
# Check Rust code formatting
cargo fmt --manifest-path src-tauri/Cargo.toml --check

# Format Rust code
cargo fmt --manifest-path src-tauri/Cargo.toml

# Run Clippy linter with warnings treated as errors
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Run native Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## Build Standalone Desktop Package

To build the native production desktop executable and installer:
```bash
npm run tauri build
```
Build outputs are generated under `src-tauri/target/release/bundle/`.

---

## Documentation Roadmap

* **[Phase 1 Specifications](file:///d:/Paper/docs/phase-1/README.md):**
  * [Product Requirements Document (PRD)](file:///d:/Paper/docs/phase-1/product-requirements.md)
  * [Academic Source Support Matrix](file:///d:/Paper/docs/phase-1/source-support-matrix.md)
  * [Collection & Compliance Policy](file:///d:/Paper/docs/phase-1/collection-and-compliance-policy.md)
  * [Domain Model & SQLite Schema](file:///d:/Paper/docs/phase-1/domain-model.md)
  * [Architecture Decision Records (ADRs)](file:///d:/Paper/docs/phase-1/adr/ADR-001-local-first-architecture.md)
* **[Phase 2 Foundation](file:///d:/Paper/docs/phase-2/phase-2-completion-report.md):**
  * [Foundation Architecture](file:///d:/Paper/docs/phase-2/foundation-architecture.md)
  * [Security Baseline](file:///d:/Paper/docs/phase-2/security-baseline.md)
  * [Testing & Quality Gates](file:///d:/Paper/docs/phase-2/testing-and-quality-gates.md)
  * [Open Decisions & Technical Debt](file:///d:/Paper/docs/phase-2/open-decisions.md)
* **[Phase 3 Modern UI & Design System](file:///d:/Paper/docs/phase-3/phase-3-completion-report.md):**
  * [UI Screen Inventory](file:///d:/Paper/docs/phase-3/screen-inventory.md)
  * [Design System & Tokens](file:///d:/Paper/docs/phase-3/design-system.md)
  * [Demo Data Specification](file:///d:/Paper/docs/phase-3/demo-data-specification.md)
  * [Phase 3 Completion Report](file:///d:/Paper/docs/phase-3/phase-3-completion-report.md)

