# Phase 2 Testing and Quality Gates Specification

**Project:** Research Paper Scraper  
**Phase:** Phase 2 — Architecture and Project Foundation  
**Status:** All Automated Quality Gates Passing  
**Date:** 2026-10-24  

---

## 1. Quality Gates & Execution Matrix

The application foundation enforces strict automated quality gates across both frontend and native backend layers:

| Quality Gate | Command Executed | Tool / Engine | Expected Output / Assertion | Actual Result |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Format Check** | `npm run format:check` | Prettier 3.9 | All matching files match Prettier code style | **PASS (0 violations)** |
| **Frontend Type Check** | `npm run typecheck` | TypeScript 6.0 (`tsc --noEmit`) | Strict type checking with 0 compiler errors | **PASS (0 errors)** |
| **Frontend Linting** | `npm run lint` | ESLint 10 + typescript-eslint | 0 lint errors across React/TS files | **PASS (0 errors)** |
| **Frontend Unit Tests** | `npm run test` | Vitest 5 + Testing Library | 3 unit tests in `DiagnosticView.test.tsx` pass | **PASS (3/3 passed)** |
| **Frontend Production Build** | `npm run build` | Vite 8 + `@vitejs/plugin-react` | Asset bundling into `dist/` with 0 warnings | **PASS (built in 1.17s)** |
| **Rust Format Check** | `cargo fmt --check` | `rustfmt` (Rust 1.99.1) | Clean code formatting across native crates | **PASS (0 diffs)** |
| **Rust Clippy Lint** | `cargo clippy -- -D warnings` | `clippy` (Rust 1.99.1) | Zero compiler or lint warnings treated as errors | **PASS (0 warnings)** |
| **Rust Native Unit Tests** | `cargo test` | Cargo test runner | 6 unit tests across config, errors, logging, health | **PASS (6/6 passed)** |
| **Unified Quality Check** | `npm run check:all` | npm script | Orchestrates typecheck, lint, test, and build | **PASS (100% green)** |

---

## 2. Test Suite Details

### 2.1 Native Rust Test Suite (`src-tauri/src/`)
* **`config::tests::test_default_config_is_valid`:** Validates default document path, $100\text{MB}$ file ceiling, and default concurrency limit of 4.
* **`config::tests::test_invalid_concurrency_rejected`:** Asserts that concurrency $\le 0$ or $> 20$ returns `AppError::Validation`.
* **`errors::tests::test_app_error_to_command_error_conversion`:** Verifies that internal errors map cleanly to sanitized `CommandError` shapes without leaking paths or technical causes.
* **`logging::tests::test_redact_bearer_token`:** Verifies that Bearer authorization tokens are redacted to `[REDACTED_TOKEN]`.
* **`logging::tests::test_redact_api_key_query_param`:** Verifies that API keys in query parameters are replaced with `[REDACTED_KEY]`.
* **`services::health::tests::test_health_check_returns_valid_response`:** Asserts that `HealthService::check_health` returns a complete diagnostic payload with valid platform and uptime.

### 2.2 Frontend React Test Suite (`src/test/`)
* **`renders accurately in browser fallback mode when Tauri IPC is absent`:** Mocks `isTauriEnvironment() = false`; verifies the amber banner is displayed explaining desktop runtime unavailability.
* **`renders healthy backend status and platform details when connected via Tauri IPC`:** Mocks `getAppHealth` and `pingBackend`; verifies green connected banner, latency display, platform target, and document root.
* **`renders safe error state and allows user retry when backend communication fails`:** Mocks rejected promise from `getAppHealth`; verifies error message display and user retry interaction.

---

## 3. Manual Desktop Smoke Test Procedure

When executing in a graphical desktop environment:
1. **Launch Development Mode:** Run `npm run tauri dev`.
2. **Window Initialization:** Verify the Tauri desktop window opens titled *"Research Paper Scraper — Desktop Foundation"*.
3. **Visual Inspection:** Verify the dark slate background renders with the purple logo, version badge, and green "Rust Native Backend Connected" card.
4. **Latency Measurement:** Verify the round-trip ping time is displayed (e.g. `Round-trip: 2ms`).
5. **Window Responsiveness:** Resize window from $800 \times 600$ to full screen; verify grid transitions smoothly from single-column to three-column without layout clipping.
6. **Keyboard Navigation:** Press `Tab` to navigate to the "Re-check" button; press `Enter` to trigger health check refresh; verify spinner rotates during check.
7. **Production Desktop Build:** Run `npm run tauri build` to generate the standalone Windows desktop bundle.
