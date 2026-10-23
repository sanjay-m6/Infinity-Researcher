# Phase 2 Foundation Architecture Specification

**Project:** Research Paper Scraper  
**Phase:** Phase 2 — Architecture and Project Foundation  
**Status:** Approved & Implemented  
**Date:** 2026-10-24  

---

## 1. Architectural Foundation Overview

Phase 2 establishes the foundational desktop execution frame connecting the React 19 / TypeScript / Vite frontend to the Rust native backend via Tauri 2 IPC commands. 

The application enforces a **clean separation of privileges**:
* **Frontend (Unprivileged):** Responsible solely for UI rendering, user interactions, local form validation, and accessible states. It communicates with native capabilities strictly via typed bridge functions.
* **Backend (Privileged):** Owns system configuration, logging, health probes, and in future phases, network scraping, SQLite storage, and PDF file operations.

```
┌────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Vite)                   │
│                                                            │
│  ┌──────────────────────────────┐                          │
│  │    DiagnosticView Component   │                          │
│  └──────────────┬───────────────┘                          │
│                 │                                          │
│  ┌──────────────▼───────────────┐                          │
│  │   Tauri Bridge (tauri-bridge)│                          │
│  │ • isTauriEnvironment()       │                          │
│  │ • getAppHealth()             │                          │
│  │ • pingBackend()              │                          │
│  │ • normalizeCommandError()    │                          │
│  └──────────────┬───────────────┘                          │
└─────────────────┼──────────────────────────────────────────┘
                  │ Tauri IPC (JSON over MessagePipe)
┌─────────────────┼──────────────────────────────────────────┐
│                 ▼                                          │
│    Tauri Command Router (tauri::generate_handler!)         │
│                 │                                          │
│  ┌──────────────▼───────────────┐  ┌─────────────────────┐ │
│  │      commands::health        │  │     errors::mod     │ │
│  │   (app_health, app_ping)     │  │ (CommandError DTO)  │ │
│  └──────────────┬───────────────┘  └─────────────────────┘ │
│                 │                                          │
│  ┌──────────────▼───────────────┐  ┌─────────────────────┐ │
│  │   services::HealthService    │  │     logging::mod    │ │
│  │  (System metrics & checks)   │  │ (Tracing & Redact)  │ │
│  └──────────────┬───────────────┘  └─────────────────────┘ │
│                 │                                          │
│  ┌──────────────▼───────────────┐  ┌─────────────────────┐ │
│  │       state::AppState        │  │     config::mod     │ │
│  │  (RwLock<AppConfig>, Uptime) │  │  (Bounds validation)│ │
│  └──────────────────────────────┘  └─────────────────────┘ │
│                     RUST BACKEND CORE                      │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Rust Backend Module Layout (`src-tauri/src/`)

The native backend is organized into decoupled, unit-testable modules:

* **`commands/`:** Tauri IPC command entry points.
  * `health.rs`: Implements `app_health` and `app_ping` handlers. Validates invocation, logs activity, calls domain services, and returns `Result<HealthResponse, CommandError>`.
  * `mod.rs`: Re-exports command functions for registration.
* **`config/`:** Application configuration types and validation.
  * `mod.rs`: Defines `AppConfig` with default document directory, max file size ceiling ($100\text{MB}$), concurrency limits ($1 \le N \le 20$), and request timeouts ($1 \le T \le 120\text{s}$). Rejects invalid parameter combinations.
* **`errors/`:** Strongly typed error definitions and IPC serialization.
  * `mod.rs`: Distinguishes internal error categories (`AppError::Config`, `AppError::Validation`, `AppError::Command`, `AppError::Internal`) from the sanitized external shape `CommandError` (`code`, `message`, `retryable`).
* **`logging/`:** Structured logging and security filters.
  * `mod.rs`: Configures `tracing-subscriber` with `env-filter`. Provides `redact_sensitive_string` utility scrubbing Bearer tokens and API keys.
* **`services/`:** Business logic and diagnostic services.
  * `health.rs`: Inspects runtime environment, platform string (OS + Arch), process uptime, and subsystem roadmap readiness.
* **`state/`:** Managed application state.
  * `mod.rs`: Defines `AppState` containing an `Arc<RwLock<AppConfig>>` and startup timestamp `Instant`.
* **`lib.rs`:** Desktop application builder, plugin initialization (`tauri_plugin_opener`), state injection, and command handler registration.
* **`main.rs`:** Windows entry point calling `research_paper_scraper_lib::run()`.

---

## 3. Frontend Architecture (`src/`)

* **`src/types/`:**
  * `health.ts`: TypeScript interfaces mirroring Rust DTOs (`HealthResponse`, `SubsystemHealth`, `CommandError`).
* **`src/lib/`:**
  * `tauri-bridge.ts`: Central gateway for invoking desktop commands. Detects window runtime context via `isTauriEnvironment()`. Gracefully falls back to structured browser notices when executed outside Tauri.
* **`src/components/`:**
  * `DiagnosticView.tsx`: Accessible, responsive startup view displaying real backend connectivity, latency, platform target, CSP status, process uptime, and upcoming subsystem readiness roadmap.
* **`src/app/`:**
  * `App.tsx`: Root application shell.
* **`src/styles/`:**
  * `index.css`: Tailwind CSS v4 entry point (`@import "tailwindcss";`) with modern dark theme variables.
* **`src/test/`:**
  * `setup.ts`: Vitest testing library configuration importing `@testing-library/jest-dom/vitest`.
  * `DiagnosticView.test.tsx`: Comprehensive unit tests covering loading, connected, error, and browser fallback states.

---

## 4. Error Handling and Serialization Boundary

Internal native errors must never leak technical implementation details (such as database query strings, file paths, or OS error numbers) to the user interface. 

The boundary enforces the following mapping:

| Internal Rust Error | Serialized Error Code | Serialized User Message | Retryable |
| :--- | :--- | :--- | :--- |
| `AppError::Validation(msg)` | `ERR_VALIDATION` | Literal validation message (e.g. "Query cannot be empty") | `false` |
| `AppError::Config(msg)` | `ERR_CONFIG` | Literal config message (e.g. "Invalid directory") | `false` |
| `AppError::Command(msg)` | `ERR_COMMAND` | Literal command error message | `true` |
| `AppError::Internal(_)` | `ERR_INTERNAL` | "An unexpected internal error occurred. Please try again." | `true` |
