# Phase 1: Dependency and Framework Audit

This audit examines all dependencies across the frontend, Rust backend, and Python research engine in **Infinity Researcher**.

---

## 1. Frontend Dependencies (`package.json`)

| Package | Installed Version | Purpose | Assessment & Compatibility | Action Plan |
| :--- | :--- | :--- | :--- | :--- |
| **`react`** | `^19.1.0` | Frontend UI runtime | React 19 modern runtime with React Compiler rules | Retain; ensure animation libraries support React 19. |
| **`react-dom`** | `^19.1.0` | DOM renderer for React | Matches React 19 | Retain. |
| **`tailwindcss`** | `^4.3.3` | Utility styling engine | Tailwind CSS v4 (new CSS-first engine using `@theme`) | Retain. Note: Does not use legacy `tailwind.config.js`. |
| **`@tailwindcss/vite`** | `^4.3.3` | Vite plugin for Tailwind v4 | Official modern Vite bundler integration | Retain. |
| **`lucide-react`** | `^1.61.0` | Comprehensive icon set | Standard scholarly, UI, and navigation icons | Standardize as the exclusive icon library. |
| **`gsap`** | `^3.15.0` | Animation engine | Used only in `AppShell.tsx` for view transitions | **Plan for removal**: Replace with Motion for React to eliminate duplicate animation runtimes. |
| **`pdfjs-dist`** | `^6.4.299` | PDF rendering & text engine | Renders PDF canvas in `EmbeddedPdfViewer.tsx` | Retain. Local web worker bundle is configured and verified. |
| **`@tauri-apps/api`** | `^2` | Tauri 2 IPC client | Communication bridge between React and Rust | Retain. Core desktop capability. |
| **`@tauri-apps/plugin-opener`** | `^2` | File & URL opening plugin | Opens external browser links safely | Retain. |
| **`@tauri-apps/plugin-updater`**| `^2.14.0` | Desktop auto-updater | GitHub Releases release manifests & signatures | Retain. |
| **`@tauri-apps/plugin-process`**| `^2.4.0` | Process exit & restart | Required for application relaunch upon updates | Retain. |
| **`vite`** | `^8.0.16` | Frontend bundler | High-speed ESM development and production builds | Retain. Production build takes ~7-9s. |
| **`typescript`** | `~6.0.3` | Type checking | Strict type checking with project paths | Retain. `tsc --noEmit` passes cleanly. |
| **`vitest`** | `^5.0.5` | Test runner | Fast Vite-native unit and integration testing | Retain. 221 tests pass across 27 suites. |
| **`@testing-library/react`** | `^16.3.3` | Component test utilities | DOM testing for React 19 components | Retain. |

---

## 2. Motion for React (`motion`) Assessment

- **Current State**: Neither `framer-motion` nor `motion` is currently installed. GSAP is imported in `AppShell.tsx`.
- **Target Package**: `motion` (latest version 12+).
- **Import Convention**: `import { motion, AnimatePresence } from "motion/react";`
- **React 19 Compatibility**: Motion for React v12+ fully supports React 19 and concurrent mode features.
- **Migration Strategy**:
  1. Install `motion` via `npm install motion`.
  2. Replace `gsap.fromTo` in `src/components/layout/AppShell.tsx` with `<AnimatePresence mode="wait">` and `<motion.div>`.
  3. Uninstall `gsap` (`npm uninstall gsap`) to reduce bundle size by ~70 KB minified.
  4. Implement Motion micro-interactions (sidebar collapse spring, dialog entrance physics, tab active pill layout transitions).

---

## 3. shadcn/ui and Radix UI Preparation

- **Current State**:
  - `components.json` is not present.
  - The repository has custom implementations of `Button`, `Badge`, `Input`, `Modal`, `Drawer`, `ConfirmDialog`, `EmptyState`, `ToastContainer`, `Skeleton`.
  - Recently implemented `src/components/ui/Skeleton.tsx` strictly follows shadcn anatomy (`data-slot="skeleton"`, `PaperCardSkeleton`, `TextSkeleton`, etc.).
- **Tailwind v4 Nuance**:
  - Traditional shadcn CLI commands expect Tailwind v3 with `tailwind.config.js`.
  - For Tailwind v4, shadcn components are authored using CSS `@theme` variables (already configured in `src/styles/index.css`).
  - Radix primitives (e.g., `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`) can be installed and wrapped cleanly in TypeScript source code without relying on legacy generator scripts.

---

## 4. Rust Backend Dependencies (`src-tauri/Cargo.toml`)

| Crate | Version | Role in Application |
| :--- | :--- | :--- |
| **`tauri`** | `2` | Desktop core framework, window management, IPC generation |
| **`tokio`** | `1` (features: `full`) | Async runtime for background downloads, crawlers, and streams |
| **`rusqlite`** | `0.40.2` (features: `bundled`, `uuid`, `chrono`) | Embedded SQLite database driver with bundled C engine |
| **`reqwest`** | `0.12` (features: `json`, `rustls-tls`) | HTTP client for academic API connectors and PDF downloads |
| **`spider`** | `2.53.9` | High-throughput web crawler for paper discovery |
| **`lopdf`** | `0.34` | PDF binary inspection, page count extraction, stream validation |
| **`argon2`** | `0.5` | Enterprise password hashing for local user accounts |
| **`keyring`** | `3` | OS credential vault (Windows Credential Manager) for session tokens |
| **`uuid`** | `1.29.0` | Unique identifier generation for papers, jobs, and sessions |
| **`chrono`** | `0.4.45` | Timestamp formatting and audit event tracking |
| **`tracing`** | `0.1` | Structured logging and diagnostic telemetry |

- **Rust Health**: `cargo check` passes cleanly in 3.8s with zero errors.

---

## 5. Python Engine Dependencies (`python-engine/pyproject.toml`)

| Package | Version Constraint | Role in Scraping Engine |
| :--- | :--- | :--- |
| **`scrapy`** | `>=2.11.0` | Asynchronous scraping spider framework |
| **`lxml`** | `>=5.0.0` | Fast XML and HTML parsing |
| **`httpx`** | `>=0.27.0` | Async HTTP client for REST adapters (Semantic Scholar, Crossref, OpenAlex) |
| **`beautifulsoup4`** | `>=4.12.0` | Robust HTML DOM extraction for messy publisher landing pages |
| **`pydantic`** | `>=2.7.0` | Strict data validation models for discovered paper schemas |
| **`rapidfuzz`** | `>=3.9.0` | Fast Levenshtein distance calculation for title deduplication |
| **`pytest`** | `>=8.0.0` | Engine test suite (109 passed in 41s) |

---

## 6. Identified Risks & Recommendations

1. **Dual Animation Libraries**: GSAP is currently installed alongside plans for Motion. They should not coexist long term. Consolidating into `motion` is scheduled for Phase 3.
2. **ESLint Configuration**: ESLint reported 37 errors (`no-useless-escape`, `no-useless-assignment`, and React Compiler hook ordering in demo manuscripts). These must be resolved in Phase 2/3 so `npm run lint` passes as a prerequisite for CI/CD.
3. **No Indiscriminate Upgrades**: Keep React 19, Tailwind 4, and Tauri 2 locked to their stable versions to avoid breaking changes.

