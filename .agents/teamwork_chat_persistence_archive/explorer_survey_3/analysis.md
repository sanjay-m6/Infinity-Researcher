# Testing Infrastructure, Existing Coverage & Verification Strategy Analysis

**Agent**: Explorer 3 (Testing Infrastructure Explorer)  
**Date**: 2026-11-03  
**Integrity Mode**: Development  
**Workspace**: `d:\Paper`

---

## Executive Summary

Infinity Researcher is a hybrid desktop application built with a **Rust + Tauri 2** backend and a **React 19 + TypeScript + Vite + Tailwind CSS** frontend.

1. **Backend Testing**:
   - **Infrastructure**: Co-located unit tests in `src-tauri/src/**` and 12 dedicated integration test suites in `src-tauri/tests/*.rs`.
   - **Database Testing Fixture**: `Database::open_in_memory()` in `src-tauri/src/database/mod.rs` sets `PRAGMA foreign_keys = ON;`, `busy_timeout = 5000;`, and runs full migrations through `CURRENT_SCHEMA_VERSION = 18`.
   - **Existing Chat Persistence**: SQLite tables `ai_chat_sessions` and `ai_chat_messages` are created in migration `0007_ai_workspace_and_knowledge.sql`. `AiRepository` has `list_messages`, `save_message`, and `clear_session_messages`, and Tauri command handlers exist in `src/commands/ai.rs`. However, session-level operations (`create_session`, `list_sessions`, `delete_session`) and automated tests for chat persistence are currently missing.
   - **Existing Test Health**: 8 integration test suites pass completely (`database_integration_tests`, `academic_search_tests`, `crawl_engine_tests`, `ieee_workflow_tests`, `processing_pipeline_tests`, `retrieval_pipeline_tests`, `security_and_robustness_tests`, `spider_api_check`, and `performance_benchmarks`). Three specific pre-existing test failures were uncovered and analyzed:
     - `tests/projects_and_ai_tests.rs`: hardcoded check `assert_eq!(version, 16)` fails because schema is now 18.
     - `tests/auth_tests.rs`: hardcoded check `assert_eq!(version, 12)` fails because schema is now 18.
     - `tests/matrix_tests.rs`: line 123 assertion expects `evidence[0].page_number == Some(4)` but got `Some(1)`.
     - `cargo test --lib`: fails on Windows with `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` on the `--lib` test harness executable; running tests as integration tests in `src-tauri/tests/*.rs` avoids this issue completely.

2. **Frontend Testing**:
   - **Infrastructure**: Vitest 5.0.5 + jsdom + `@testing-library/react` 16.3.3 + `@testing-library/jest-dom` 7.0.1. Configuration in `vite.config.ts` (setup file `./src/test/setup.ts`).
   - **Existing Test Coverage**: 49 test files in `src/test/`. Suites like `matrix-ai-assistant.test.tsx`, `phase13-pdf-reader.test.tsx`, `particle-loading-and-ai-typing.test.tsx`, and `desktop-api.test.ts` pass completely (147 tests verified passing).
   - **Critical Pre-Existing Frontend Issue Identified**: `src/context/AppContext.tsx` had an invalid duplicate `export const DEFAULT_LOCAL_RESEARCHER` inside the `AppProvider` component body (lines 324–330) and a variable hoisting error with `showToast`, preventing 34 test files that import `AppContext` from parsing.
   - **Tauri IPC Mocking**: Vitest tests mock desktop interactions at the `desktopApi` module level using `vi.spyOn(desktopApi, "<method>")`. Global Tauri IPC invoke mocking is not configured in `setup.ts`.

3. **Requirement R1 Test Strategy**:
   - A dedicated integration test suite `src-tauri/tests/chat_persistence_tests.rs` verifying session creation, message persistence, citation JSON roundtripping, foreign key cascade deletion, and multi-surface session isolation.
   - Frontend tests in `src/test/chat-persistence.test.ts` and component tests in AI Hub, PDF Viewer, and Discover Assistant ensuring mount retrieval, incremental persistence, and clean session clearing without orphaned state.

4. **Requirement R2 Test Strategy**:
   - Tests for UI context extraction, active route/view detection, semantic accessibility tree serialization, prompt grounding injection, and action directive parsing/dispatch.

---

## 1. Backend Rust/Tauri Testing Infrastructure

### 1.1 Configuration & Dependencies
- **Manifest**: `src-tauri/Cargo.toml`
  - Package: `infinity-researcher` v0.1.0 (library: `research_paper_scraper_lib`)
  - SQLite: `rusqlite = { version = "0.40.2", features = ["bundled", "uuid", "chrono"] }`
  - Serialization: `serde`, `serde_json`
  - Async Runtime: `tokio = { version = "1", features = ["full"] }`
  - Tauri: `tauri = { version = "2", features = [] }`
- **Build Script**: `src-tauri/build.rs` runs `tauri_build::build()`.

### 1.2 Test Execution Structure
Rust tests are divided into two categories:
1. **Co-located Module Tests** (`#[cfg(test)] mod tests`):
   - Located inside `src-tauri/src/**` (e.g., `src/database/mod.rs`, `src/database/migrations.rs`, `src/repositories/ai_repo.rs`).
   - Run via `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
   - *Environment Finding*: On Windows, running `cargo test --lib` encounters exit code `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)`.
2. **Integration Test Executables** (`src-tauri/tests/*.rs`):
   - 12 integration test files located in `src-tauri/tests/`:
     * `academic_search_tests.rs` (4 tests) — **PASS**
     * `crawl_engine_tests.rs` (6 tests) — **PASS**
     * `database_integration_tests.rs` (5 tests) — **PASS**
     * `ieee_workflow_tests.rs` (10 tests) — **PASS**
     * `performance_benchmarks.rs` (1 test) — **PASS**
     * `processing_pipeline_tests.rs` (4 tests) — **PASS**
     * `retrieval_pipeline_tests.rs` (5 tests) — **PASS**
     * `security_and_robustness_tests.rs` (7 tests) — **PASS**
     * `spider_api_check.rs` (1 test) — **PASS**
     * `matrix_tests.rs` (1 test) — **1 FAIL** (line 123 page_number assertion)
     * `projects_and_ai_tests.rs` (5 tests) — **1 FAIL** (line 17 schema version assertion)
     * `auth_tests.rs` (4 tests) — **1 FAIL** (line 119 schema version assertion)
   - Integration tests link against `research_paper_scraper_lib` as an `rlib` and execute natively without `0xc0000139`.
   - Run command: `cargo test --manifest-path src-tauri/Cargo.toml --test <test_name>`

### 1.3 Database Initialization Pattern for Tests
`src-tauri/src/database/mod.rs` provides the canonical fixture:
```rust
pub fn open_in_memory() -> Result<Self, AppError> {
    let mut conn = Connection::open_in_memory()
        .map_err(|e| AppError::Internal(format!("Failed to open in-memory database: {}", e)))?;

    Self::configure_pragmas(&mut conn)?;
    migrations::run_migrations(&mut conn).map_err(|e| {
        AppError::Internal(format!("In-memory database migration failed: {}", e))
    })?;

    Ok(Self {
        conn: Arc::new(Mutex::new(conn)),
        db_path: PathBuf::from(":memory:"),
    })
}
```
Key Pragmas configured:
- `PRAGMA foreign_keys = ON;` (ensures foreign key constraints and `ON DELETE CASCADE` are enforced)
- `PRAGMA busy_timeout = 5000;`
- `PRAGMA synchronous = NORMAL;`

Alternatively, standalone test files use:
```rust
fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&mut conn).expect("run_migrations failed");
    conn
}
```

### 1.4 Existing Chat Persistence State in Rust Backend
1. **Schema** (`src-tauri/migrations/0007_ai_workspace_and_knowledge.sql`, lines 93–115):
   ```sql
   CREATE TABLE IF NOT EXISTS ai_chat_sessions (
       id TEXT PRIMARY KEY NOT NULL,
       paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
       title TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
   );

   CREATE TABLE IF NOT EXISTS ai_chat_messages (
       id TEXT PRIMARY KEY NOT NULL,
       session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
       paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
       role TEXT NOT NULL,                      -- 'user', 'assistant', 'system'
       content TEXT NOT NULL,
       citations_json TEXT,                     -- JSON array of cited AiChunkCitation
       provider_id TEXT,
       model_id TEXT,
       retrieval_mode TEXT NOT NULL DEFAULT 'paper',
       created_at TEXT NOT NULL
   );

   CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_messages(session_id);
   CREATE INDEX IF NOT EXISTS idx_ai_chat_paper ON ai_chat_messages(paper_id);
   ```
2. **Repository** (`src-tauri/src/repositories/ai_repo.rs`):
   - `list_messages(conn: &Connection, session_id: &str) -> Result<Vec<AiChatMessage>>` (lines 850–881)
   - `save_message(conn: &Connection, msg: &AiChatMessage) -> Result<()>` (lines 883–895)
   - `clear_session_messages(conn: &Connection, session_id: &str) -> Result<()>` (lines 897–903)
3. **Commands** (`src-tauri/src/commands/ai.rs`):
   - `list_ai_chat_messages` (lines 383–390)
   - `save_ai_chat_message` (lines 393–400)
   - `clear_ai_chat_session` (lines 403–410)
4. **Registration** (`src-tauri/src/lib.rs` lines 199–201):
   - All three commands are included in `tauri::generate_handler![...]`.
5. **Gaps in Backend Persistence**:
   - No session management methods in `AiRepository`: missing `create_session`, `get_or_create_session`, `list_sessions`, `delete_session`.
   - No Tauri command handlers for session CRUD (`create_ai_chat_session`, `list_ai_chat_sessions`, `delete_ai_chat_session`).
   - Zero existing automated unit/integration tests verifying `ai_chat_sessions` or `ai_chat_messages`.

---

## 2. Frontend React/TypeScript Testing Infrastructure

### 2.1 Configuration & Scripts
- **`package.json`**:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"typecheck": "tsc --noEmit"`
  - `"lint": "eslint ."`
- **`vite.config.ts`**:
  ```ts
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    testTimeout: 15000,
    coverage: { provider: "v8" },
  }
  ```
- **`src/test/setup.ts`**:
  - Configures `@testing-library/jest-dom/vitest`.
  - Stubs `window.matchMedia`.

### 2.2 IPC Mocking Methodology
- In the frontend, native calls pass through `isTauriEnvironment()` (`src/lib/tauri-bridge.ts`), which checks for `"__TAURI_INTERNALS__" in window || "__TAURI__" in window`.
- When running in JSDOM / Node, `isTauriEnvironment()` returns `false`.
- If unmocked, calling any `desktop-api` function throws `CommandError` with `code: "ERR_RUNTIME_UNAVAILABLE"`.
- **Existing Test Mocking Pattern**:
  Tests spy on the API module functions directly:
  ```ts
  import * as desktopApi from "../lib/desktop-api";
  vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({ ... });
  vi.spyOn(desktopApi, "getPaperRagChunks").mockResolvedValue([ ... ]);
  ```
  This is clean, robust, and isolates UI components from low-level Tauri serialization.

### 2.3 Existing Chat Surfaces in Frontend
1. **AI Hub** (`src/features/ai-hub/AiHubView.tsx`):
   - Currently persists chat messages to `localStorage.getItem("ai_hub_chat_messages")` (lines 190–203).
   - Does NOT persist to SQLite via Tauri commands.
2. **PDF Viewer Right Panel** (`src/components/pdf-viewer/PdfRightPanel.tsx`):
   - Currently stores chat messages in local in-memory state: `useState<ChatMsg[]>([])` (line 81).
   - History is completely lost when closing the panel or restarting the app.
3. **Discover Paper Assistant** (`src/features/discover/DiscoverPaperAssistant.tsx`):
   - Reads/writes chat messages through in-memory session store (`discoverSessionStore.ts`), which syncs to `sessionStorage` / `localStorage`.
   - Does NOT persist to SQLite via Tauri commands.
4. **Global AI Chat Drawer** (`src/components/chat/GlobalAiChatDrawer.tsx`):
   - Uses `session_id: "global_chat"` but persists locally to `localStorage.getItem("global_ai_chat_messages")`.

---

## 3. Test Strategy for Requirement R1 (Chat Persistence)

### 3.1 Backend Test Design (`src-tauri/tests/chat_persistence_tests.rs`)
Write a new integration test suite using `Connection::open_in_memory()` with `PRAGMA foreign_keys = ON;`:

| Test Name | Target Function | Assertion / Expected Behavior |
|---|---|---|
| `test_create_and_list_chat_sessions` | `AiRepository::create_session`, `list_sessions` | Creates sessions with/without `paper_id`. Listing returns all sessions ordered by `updated_at DESC`. Filtering by `paper_id` returns only relevant sessions. |
| `test_save_and_retrieve_chat_messages_ordering` | `AiRepository::save_message`, `list_messages` | Inserts 3 messages with timestamps. Retrieval guarantees chronological `ASC` order. |
| `test_chat_citations_json_serialization` | `AiRepository::save_message`, `list_messages` | Saves assistant message with 2 `AiChunkCitation` records. Deserialization preserves chunk ID, paper ID, page number, section heading, snippet, and score. |
| `test_clear_session_messages_preserves_session` | `AiRepository::clear_session_messages` | Clears messages for a session. Querying `list_messages` returns empty Vec; session record in `ai_chat_sessions` remains intact. |
| `test_cascade_delete_session_removes_messages` | `AiRepository::delete_session` | Deleting a session record cascades and deletes all associated records in `ai_chat_messages`. |
| `test_session_isolation_across_panels` | Multiple sessions (`ai_hub`, `pdf_panel`, `discover_assistant`) | Messages added to session A are never returned when querying session B. |
| `test_paper_deletion_sets_null_on_session_and_message` | `ON DELETE SET NULL` on `paper_id` | Deleting a paper in `papers` does not delete the chat session or messages; `paper_id` is cleanly updated to `NULL`. |

### 3.2 Frontend Test Design (`src/test/chat-persistence.test.ts`)
1. **API Client Unit Tests**:
   - `listAiChatMessages`: calls `invoke("list_ai_chat_messages", { sessionId })`.
   - `saveAiChatMessage`: calls `invoke("save_ai_chat_message", { message })`.
   - `clearAiChatSession`: calls `invoke("clear_ai_chat_session", { sessionId })`.
   - `createAiChatSession`: calls `invoke("create_ai_chat_session", { input })`.
2. **Hook / Service Integration Tests**:
   - Initial load: when a chat surface mounts, `listAiChatMessages` is called with the panel-specific `sessionId` (e.g. `pdf_reader_<paper_id>`).
   - Outgoing turn: sending a prompt adds optimistic user message and calls `saveAiChatMessage`.
   - Incoming turn: receiving assistant response adds message and calls `saveAiChatMessage`.
   - Clear history: calling clear invokes `clearAiChatSession` and resets local message state to empty.
   - Persistence across unmount/remount: mounting component A, saving messages, unmounting, and remounting renders all previously saved messages.
3. **Panel Surface Tests**:
   - `AiHubView`: "Reading Assistant & Chat" tab loads messages from session `ai_hub_main`.
   - `PdfRightPanel`: loads messages from session `pdf_reader_<paper_id>`.
   - `DiscoverPaperAssistant`: loads messages from session `discover_<paper_id>`.

---

## 4. Test Strategy for Requirement R2 (UI Component Understanding)

### 4.1 UI Component Understanding Architecture (Research Synthesis)
Modern copilot patterns (Microsoft Copilot UX, Model Context Protocol, accessibility-tree-grounded agents) employ four core mechanisms:
1. **Context Extraction & Active State Grounding**:
   - Current route/view (`dashboard`, `discover`, `library`, `pdf_viewer`, `matrix`, `ai_hub`).
   - Active sub-panels and drawers (`pdf-right-panel`, `matrix-side-panel`, `notes-tab`).
   - Focused entity (`selectedPaper`: id, title, doi, current page, selected text excerpt).
2. **Semantic UI / Accessibility Representation**:
   - Extracting a lightweight, token-efficient semantic map of active controls (buttons, tabs, inputs) rather than raw HTML DOM.
3. **Prompt Grounding Injection**:
   - Injecting structured `<ui_context>` blocks into the LLM system prompt:
     ```xml
     <ui_context>
       <view>pdf_viewer</view>
       <focused_entity type="paper" id="p1" title="Attention Is All You Need" current_page="3" total_pages="15" />
       <selected_text>We propose a novel architecture...</selected_text>
       <available_actions>navigate_page, save_note, switch_view</available_actions>
     </ui_context>
     ```
4. **Action Execution / Tool Dispatch Loop**:
   - Parsing structured action directives (e.g., `{"action": "navigate_page", "page": 7}`) from assistant responses.
   - Dispatching to application state handlers (`onNavigatePdfPage(7)`, `saveNote(...)`, `setActiveSection(...)`).

### 4.2 Test Design for R2 (`src/test/ui-component-understanding.test.tsx` and `src/test/ui-context-grounding.test.ts`)
1. **Context Extractor Tests**:
   - `captures_active_view_and_navigation`: accurately reflects `activeSection`.
   - `captures_pdf_viewer_page_and_selection`: captures `currentPage`, `numPages`, and `selectedText` when in PDF reader.
   - `captures_discover_active_query_and_results`: captures active search query and count of results.
2. **Component Tree Serialization Tests**:
   - `serializes_interactive_elements`: produces concise list of visible action targets (e.g. `[Tab: "Assistant", Button: "Clear Chat", Input: "Ask about equations..."]`).
   - `token_budget_enforcement`: guarantees serialized context is compact (< 600 chars).
3. **Prompt Injection Tests**:
   - `injects_grounding_block_into_ai_prompt`: ensures prompt sent to `generateAiResponse` contains accurate `<ui_context>` metadata.
4. **Action Directive Parsing & Dispatching Tests**:
   - `parses_navigate_action`: correctly parses `{"action": "navigate_page", "page": 4}`.
   - `executes_registered_ui_callback`: triggers `onNavigatePdfPage(4)`.
   - `handles_malformed_directives_safely`: falls back to displaying raw message without runtime exception.
   - `renders_action_chip_in_ui`: displays interactive action badge for user confirmation.

---

## 5. Existing Failures, Regressions, and Mitigation Plan

### 5.1 Failures Catalog

| Failure Location | Failure Type | Root Cause | Impact | Fix / Remediation |
|---|---|---|---|---|
| `src-tauri/tests/projects_and_ai_tests.rs:17` | `cargo test` failure | Hardcoded `assert_eq!(version, 16)` while `CURRENT_SCHEMA_VERSION` is `18`. | Blocks `cargo test --test projects_and_ai_tests` | Update assertion to `CURRENT_SCHEMA_VERSION` (18). |
| `src-tauri/tests/auth_tests.rs:119` | `cargo test` failure | Hardcoded `assert_eq!(version, 12)` while `CURRENT_SCHEMA_VERSION` is `18`. | Blocks `cargo test --test auth_tests` | Update assertion to `assert!(version >= 12)`. |
| `src-tauri/tests/matrix_tests.rs:123` | `cargo test` failure | Assertion expects `evidence[0].page_number == Some(4)` but got `Some(1)`. | Blocks `cargo test --test matrix_tests` | Align test expectation with extraction ranker. |
| `src-tauri/src/lib.rs` (`cargo test --lib`) | Process exit `0xc0000139` | Missing native entrypoint when executing `--lib` test harness on Windows. | Affects `cargo test --lib` | Run and write tests as integration tests in `src-tauri/tests/*.rs`. |
| `src/context/AppContext.tsx:324-330` | Build / Vitest Parse Error | Duplicate `export const DEFAULT_LOCAL_RESEARCHER` declared inside `AppProvider` function body. | Causes 34 Vitest test suites to fail bundling | Remove duplicate inner declaration; line 212 already declares it at module top-level. |
| `src/context/AppContext.tsx:359` | TypeScript Error | `showToast` used in `useEffect` at line 359 before declaration at line 370. | Fails `npm run typecheck` | Move `const showToast = useCallback(...)` above line 348. |
| `src/lib/desktop-api/index.ts` | Missing Exports | Chat commands in Rust (`list_ai_chat_messages`, etc.) not wrapped or exported in frontend API client. | Blocks frontend chat persistence | Add typed wrapper functions in `src/lib/desktop-api/index.ts`. |

### 5.2 Verification Commands
- Backend verification:
  ```powershell
  cargo test --manifest-path src-tauri/Cargo.toml --test database_integration_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test academic_search_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test crawl_engine_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test ieee_workflow_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test processing_pipeline_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test retrieval_pipeline_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test security_and_robustness_tests
  cargo test --manifest-path src-tauri/Cargo.toml --test spider_api_check
  cargo test --manifest-path src-tauri/Cargo.toml --test performance_benchmarks
  ```
- Frontend verification:
  ```powershell
  npx vitest run src/test/desktop-api.test.ts
  npx vitest run src/test/matrix-ai-assistant.test.tsx
  npx vitest run src/test/phase13-pdf-reader.test.tsx
  npx vitest run src/test/particle-loading-and-ai-typing.test.tsx
  ```
