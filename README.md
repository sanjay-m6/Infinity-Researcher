# Infinity-Researcher

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Tauri 2](https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=black)](https://www.rust-lang.org)

> **Discover. Understand. Research.**  
> Created by **Sanjay** | **Infinity Web Technology**  
> Copyright © 2026 Sanjay. All rights reserved.

A standalone, local-first AI-powered research workspace desktop application engineered for academic researchers. Discover papers across permitted scholarly websites and repositories, collect normalized metadata, download authorized open-access documents, read PDFs offline in the integrated reader, perform literature review matrices, and organize a persistent local library.

Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Vite 8**, and **Tailwind CSS v4**.

---

## Architecture Highlights

* **Website-Driven Discovery (No-API Engine):** Discovers literature by requesting permitted public HTML pages and extracting standard embedded metadata (Highwire Press, Dublin Core, Schema.org JSON-LD) and normal hyperlinks. Never calls third-party academic provider APIs, private/undocumented network endpoints, or cloud scraping proxies.
* **Local-First & Sovereign:** All bibliographies, collections, crawl state, and PDF files reside on the researcher's local machine in a local SQLite database (WAL mode) and managed document directory. Zero mandatory remote servers or cloud accounts.
* **Integrated Offline PDF Reader:** Embedded reader powered by sandboxed PDF.js with page navigation, zoom/fit modes, 90° rotation, full-text search, thumbnail previews, and persistent reading state.
* **Strict Ethical & Safety Boundaries:** Automated URL validation via Anti-SSRF guards (blocking private/loopback/metadata addresses), full robots.txt compliance, polite crawl delay enforcement, and magic-byte `%PDF-` validation before file storage. Paywalls and bot challenges are never bypassed.

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
* **[Phase 4 Local Backend & SQLite Database](file:///d:/Paper/docs/phase-4-completion-report.md):**
  * [ADR-005: SQLite Persistence & Database Access](file:///d:/Paper/docs/decisions/ADR-005-database-access.md)
  * [Local Database Architecture & Migrations](file:///d:/Paper/docs/architecture/local-database.md)
  * [Relational Data Model & FTS5](file:///d:/Paper/docs/architecture/data-model.md)
  * [Phase 4 Quality & Test Report](file:///d:/Paper/docs/testing/phase-4-test-report.md)
* **[Phase 5 Academic Connectors & Unified Discovery](file:///d:/Paper/docs/phase-5-implementation-report.md):**
  * [Source Connectors & Specification Matrix](file:///d:/Paper/docs/source-connectors.md)
  * [Academic Search Architecture & Connector Framework](file:///d:/Paper/docs/academic-search-architecture.md)
  * [Provider Setup, Rate Limits & Credentials](file:///d:/Paper/docs/provider-setup.md)
  * [Phase 5 Implementation & Audit Report](file:///d:/Paper/docs/phase-5-implementation-report.md)
* **[Phase 6 Website Scraping Engine](file:///d:/Paper/docs/phase-6-implementation-report.md):**
  * [Website Scraper Architecture](file:///d:/Paper/docs/website-scraper-architecture.md)
  * [Crawl Profiles Guide & Custom Rules](file:///d:/Paper/docs/crawl-profiles-guide.md)
  * [Phase 6 Implementation & Audit Report](file:///d:/Paper/docs/phase-6-implementation-report.md)
* **[Phase 7 Paper Processing, Deduplication & PDF Integrity](file:///d:/Paper/docs/phase-7-testing-and-verification.md):**
  * [Processing Pipeline Architecture](file:///d:/Paper/docs/phase-7-processing-pipeline.md)
  * [Metadata Normalization & Identifier Namespaces](file:///d:/Paper/docs/phase-7-metadata-normalization.md)
  * [Intelligent Deduplication & Merge Policy](file:///d:/Paper/docs/phase-7-deduplication-policy.md)
  * [PDF Processing & Document Integrity](file:///d:/Paper/docs/phase-7-pdf-processing.md)
  * [Phase 7 Testing & Verification Report](file:///d:/Paper/docs/phase-7-testing-and-verification.md)



