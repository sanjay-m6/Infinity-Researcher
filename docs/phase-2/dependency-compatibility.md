# Dependency & Toolchain Compatibility Matrix

**Project:** Research Paper Scraper  
**Phase:** Phase 2 — Architecture and Project Foundation  
**Audit Date:** 2026-10-24  
**Audit Standard:** Official release notes and framework compatibility guidelines.

---

## 1. Verified Core Frameworks & Toolchains

| Component / Layer | Selected Version | Official Documentation / Guidance | Compatibility & Integration Verdict |
| :--- | :--- | :--- | :--- |
| **Rust Toolchain** | `1.99.1 (Stable)` | [https://www.rust-lang.org](https://www.rust-lang.org) | **Fully Compatible** with Tauri 2 core runtime. |
| **Cargo** | `1.99.1` | [https://doc.rust-lang.org/cargo/](https://doc.rust-lang.org/cargo/) | Standard package manager; lockfile `Cargo.lock` preserved. |
| **Node.js** | `v24.13.1 (Current)` | [https://nodejs.org](https://nodejs.org) | Node 18+ requirement met; runs Vite 6 and npm 11 cleanly. |
| **npm** | `11.8.0` | [https://docs.npmjs.com](https://docs.npmjs.com) | Standard package manager; lockfile `package-lock.json` enforced. |
| **Tauri Framework** | `v2.x` | [https://v2.tauri.app](https://v2.tauri.app) | CLI `@tauri-apps/cli@^2`, API `@tauri-apps/api@^2`, crate `tauri = "2"`. |
| **React** | `v19.1.0` | [https://react.dev](https://react.dev) | React 19 runtime with `@vitejs/plugin-react@^6.0.2`. |
| **Vite** | `v8.0.x / v6.x` | [https://vite.dev](https://vite.dev) | High-performance ES module dev server & bundler. |
| **Tailwind CSS** | `v4.x` | [https://tailwindcss.com/docs/installation/framework-guides/vite/react](https://tailwindcss.com/docs/installation/framework-guides/vite/react) | Integrated via official `@tailwindcss/vite` plugin and `@import "tailwindcss";`. |
| **Lucide Icons** | `^1.x` | [https://lucide.dev](https://lucide.dev) | Tree-shakable SVG icon set for accessible desktop navigation. |
| **Vitest** | `^4.x / ^3.x` | [https://vitest.dev](https://vitest.dev) | Native Vite test runner with jsdom for React component testing. |

---

## 2. Rust Crate Dependency Matrix (`src-tauri/Cargo.toml`)

All native dependencies are pinned to stable releases with proven Tauri 2 compatibility:

| Crate | Selected Version | Purpose | Security & Resource Impact |
| :--- | :--- | :--- | :--- |
| `tauri` | `2` | Core desktop application runtime, windowing, and IPC dispatch. | Memory-safe, sandboxed native integration. |
| `serde` | `1 (derive)` | Serialization/deserialization of typed IPC commands and DTOs. | Zero-allocation compile-time code generation. |
| `serde_json` | `1` | JSON payload serialization across the React-Rust IPC boundary. | Industry standard JSON parser. |
| `thiserror` | `2` | Strongly typed domain error derivation and error hierarchies. | Clean, zero-cost error category definitions. |
| `tracing` | `0.1` | Structured, level-based logging with redaction capabilities. | Non-blocking, zero-overhead when disabled. |
| `tracing-subscriber` | `0.3 (env-filter)` | Configures terminal/file logging sinks and filters. | Controlled log volume; redacts sensitive fields. |
| `tokio` | `1 (full)` | Asynchronous multi-threaded runtime for non-blocking operations. | Work-stealing async scheduler for I/O and workers. |

---

## 3. Tailwind CSS v4 Integration Specifics

Unlike Tailwind CSS v3, Tailwind v4 no longer requires `tailwind.config.js`, `postcss.config.js`, or `@tailwind base;` directives:
1. **Vite Plugin:** Loaded directly in `vite.config.ts`:
   ```typescript
   import tailwindcss from "@tailwindcss/vite";
   export default defineConfig({
     plugins: [react(), tailwindcss()],
     // ...
   });
   ```
2. **CSS Entry Point:** `src/styles/index.css` contains:
   ```css
   @import "tailwindcss";
   ```
3. **Theme Variables:** CSS custom properties define high-contrast dark and light modes cleanly without legacy PostCSS overhead.

---

## 4. Verification Check and Lockfile Integrity

* `package-lock.json` is generated deterministically and checked into Git.
* `src-tauri/Cargo.lock` is generated and committed to ensure immutable native builds.
* Floating Git commit hashes or unpinned repository URLs are strictly disallowed.
