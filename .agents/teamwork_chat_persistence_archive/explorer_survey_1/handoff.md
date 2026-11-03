# Handoff Report — Explorer 1 (Chat Persistence Across Panels)

**Author**: Explorer 1 (Chat Persistence Explorer)  
**Parent Agent**: `1de78534-cf9b-42f7-9125-c83ea2a3b73f`  
**Working Directory**: `d:\Paper\.agents\teamwork\explorer_survey_1\`  
**Target File**: `handoff.md`  
**Detailed Report**: `analysis.md` in this directory  

---

## 1. Observation

1. **SQLite Database Schema and Migrations**:
   - `src-tauri/migrations/0007_ai_workspace_and_knowledge.sql` (lines 93–115):
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
         role TEXT NOT NULL,
         content TEXT NOT NULL,
         citations_json TEXT,
         provider_id TEXT,
         model_id TEXT,
         retrieval_mode TEXT NOT NULL DEFAULT 'paper',
         created_at TEXT NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_messages(session_id);
     CREATE INDEX IF NOT EXISTS idx_ai_chat_paper ON ai_chat_messages(paper_id);
     ```
   - `src-tauri/src/database/mod.rs` (line 89) and `migrations.rs` (line 297):
     `conn.execute_batch("PRAGMA foreign_keys = ON;...")` is explicitly enforced.

2. **Backend Domain & Repositories (`src-tauri/src/domain/ai.rs` & `ai_repo.rs`)**:
   - `src-tauri/src/domain/ai.rs` (lines 89–101) defines `struct AiChatMessage`, but **no `AiChatSession` struct exists**.
   - `src-tauri/src/repositories/ai_repo.rs` (lines 850–904) provides:
     - `pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<AiChatMessage>>`
     - `pub fn save_message(conn: &Connection, msg: &AiChatMessage) -> Result<()>`
     - `pub fn clear_session_messages(conn: &Connection, session_id: &str) -> Result<()>`
   - `ai_repo.rs` has **zero session CRUD methods**: no `create_session`, `list_sessions`, `get_session`, `delete_session`, or auto-ensuring session logic.
   - When `save_message` is invoked with a `session_id` not already present in `ai_chat_sessions`, SQLite returns:
     `SqliteFailure(ErrorCode: ConstraintViolation, ExtendedCode: 787, "FOREIGN KEY constraint failed")`.
   - When `save_message` is invoked with a `paper_id` not present in `papers`, SQLite also returns `FOREIGN KEY constraint failed`.

3. **Backend Command Handlers (`src-tauri/src/commands/ai.rs` & `src-tauri/src/lib.rs`)**:
   - `src-tauri/src/commands/ai.rs` (lines 382–410) exposes:
     - `list_ai_chat_messages`
     - `save_ai_chat_message`
     - `clear_ai_chat_session`
   - Commands are registered in `src-tauri/src/lib.rs` (lines 199–201).
   - No session management commands exist (`create_ai_chat_session`, `list_ai_chat_sessions`, `delete_ai_chat_session`).

4. **Frontend Desktop API Bridge (`src/lib/desktop-api/`)**:
   - `src/lib/desktop-api/types.ts` (lines 1248–1259) defines `interface AiChatMessage`. `interface AiChatSession` does not exist.
   - `src/lib/desktop-api/index.ts` (lines 1750–1763) implements:
     - `listAiChatMessages(sessionId: string): Promise<AiChatMessage[]>`
     - `saveAiChatMessage(message: AiChatMessage): Promise<void>`
     - `clearAiChatSession(sessionId: string): Promise<void>`

5. **Frontend Chat Surface 1 — AI Hub (`src/features/ai-hub/AiHubView.tsx`)**:
   - Line 190–203:
     ```typescript
     const [chatMessages, setChatMessages] = useState<AiChatMessage[]>(() => {
       const saved = localStorage.getItem("ai_hub_chat_messages");
       return saved ? JSON.parse(saved) : [];
     });
     useEffect(() => {
       localStorage.setItem("ai_hub_chat_messages", JSON.stringify(chatMessages));
     }, [chatMessages]);
     ```
   - Lines 517–520: Messages hardcode `session_id: "default_session"`.
   - Lines 1603–1606: Clear action does `setChatMessages([]); localStorage.removeItem("ai_hub_chat_messages");`.
   - `listAiChatMessages`, `saveAiChatMessage`, and `clearAiChatSession` are **never called**.

6. **Frontend Chat Surface 2 — PDF Viewer Right Panel (`src/components/pdf-viewer/PdfRightPanel.tsx`)**:
   - Lines 45–51: Defines private `interface ChatMsg { id: string; role: "user" | "assistant"; content: string; page?: number; timestamp: string; }`.
   - Line 81: `const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);`.
   - Transient in-memory state only. No `localStorage`, no SQLite persistence. All chat is lost on tab switch, paper switch, or app restart.
   - No Clear History control exists in `PdfRightPanel.tsx`.

7. **Frontend Chat Surface 3 — Discover Paper Assistant (`src/features/discover/DiscoverPaperAssistant.tsx`)**:
   - Line 310–314 & `src/features/discover/discoverSessionStore.ts`:
     State stored in module singleton `discoverSessionStore`, persisting `chatHistoryByPaper` to `localStorage.setItem("paper_desktop_discover_session_v1", ...)`.
   - Line 443: Session ID derived as `discover_${paperIdKey}`.
   - Lines 576–579: Clear chat does `discoverSessionStore.clearChat(paperIdKey)`.
   - Neither `listAiChatMessages`, `saveAiChatMessage`, nor `clearAiChatSession` are called.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R1 requires chat messages across AI Hub, PDF Viewer Right Panel, and Discover Paper Assistant to be persisted to the SQLite database via backend commands and desktop APIs, restored on panel mount / restart, and cleanly cleared.
2. **From Observation 1 & 2**: SQLite enforces `PRAGMA foreign_keys = ON;`. In `0007_ai_workspace_and_knowledge.sql`, `ai_chat_messages.session_id` references `ai_chat_sessions(id) ON DELETE CASCADE`.
3. **From Observation 2 & 3**: Currently, `ai_repo.rs` and `commands/ai.rs` only provide `save_message`, which directly executes an `INSERT INTO ai_chat_messages`. Because there are no methods to create or ensure the existence of `ai_chat_sessions` records, calling `save_ai_chat_message` with any session ID will fail immediately with an SQLite `FOREIGN KEY constraint failed` error.
4. **From Observation 2 & 7**: In Discover, search result papers may not yet be imported into the `papers` table (`paper.is_imported === false`). If `save_message` receives an unimported `paper_id`, SQLite will fail the foreign key check `REFERENCES papers(id)`.
5. **From Observation 5, 6, & 7**: Currently, none of the three frontend chat surfaces call `saveAiChatMessage` or `listAiChatMessages`. AI Hub relies solely on `localStorage` with `"default_session"`, PDF Viewer uses transient React `useState` (losing 100% of data on restart), and Discover Assistant relies on `discoverSessionStore` serialized to `localStorage`.
6. **From Observation 6**: PDF Viewer Right Panel uses an ad-hoc `ChatMsg` interface rather than `AiChatMessage`, lacks session keying, and has no clear history control.
7. **Synthesis**: To fulfill R1, we must:
   - Add `AiChatSession` model and CRUD in backend.
   - Make `save_message` automatically ensure/upsert parent sessions and sanitize unimported `paper_id`s (binding `NULL` if not in `papers`).
   - Expose session commands in Tauri and bridge methods in `src/lib/desktop-api/`.
   - Update all three frontend panels to load from SQLite on mount / paper change, persist every turn (user & assistant), and delete records in SQLite when cleared.

---

## 3. Caveats

1. **Offline / Vitest Preview Mode**: When running unit tests in Node.js/jsdom or in browser preview mode where Tauri IPC is unavailable (`!isTauriEnvironment()`), frontend calls to `listAiChatMessages` return `[]`. The existing UI components should keep their `localStorage` / memory caches as fallback to avoid breaking existing frontend tests.
2. **Paper ID for External / Unimported Discover Papers**: External papers in Discover have string IDs like arXiv IDs (`"2401.12345"`) or preview IDs (`"preview_..."`). They are not in the SQLite `papers` table. The backend repository MUST sanitize `paper_id` before inserting into `ai_chat_messages` or `ai_chat_sessions`.
3. **GlobalAiChatDrawer Context**: In `AppShell.tsx`, there is also a `GlobalAiChatDrawer`. While the user prompt specifically identifies the three main panels (AI Hub, PDF Viewer, Discover Paper Assistant), the same session architecture can seamlessly support `GlobalAiChatDrawer` if desired.

---

## 4. Conclusion

The SQLite schema (`ai_chat_sessions` and `ai_chat_messages`) in migration 0007 provides the required foundation, but the backend implementation is incomplete (missing session domain models, missing session CRUD, and broken by foreign key constraints on orphan sessions and unimported papers). Simultaneously, the frontend panels are completely disconnected from the desktop SQLite API, relying on `localStorage` (AI Hub, Discover) or transient React memory (PDF Viewer).

Implementation requires:
1. **Backend**: Implement `AiChatSession` in domain, add `ensure_session_exists` and session CRUD in `ai_repo.rs`, sanitize `paper_id`, and expose commands in `commands/ai.rs` and `lib.rs`.
2. **Desktop API**: Add `AiChatSession` interface and session invoke wrappers in `src/lib/desktop-api/`.
3. **AI Hub**: Replace `localStorage` with `listAiChatMessages` / `saveAiChatMessage` / `clearAiChatSession` keyed by `ai_hub_${paperId || "general"}`.
4. **PDF Viewer Right Panel**: Standardize onto `AiChatMessage`, key by `pdf_chat_${paperId}`, persist messages, load on mount, and add a Clear History button.
5. **Discover Paper Assistant**: Wire `listAiChatMessages` and `saveAiChatMessage` keyed by `discover_${paperIdKey}`, and ensure `clearAiChatSession` is called on clear.

---

## 5. Verification Method

To verify these findings and subsequently verify the implementation:

1. **Rust Backend Test Verification**:
   Run:
   ```powershell
   cargo test --manifest-path src-tauri/Cargo.toml --test database_integration_tests
   ```
   Must pass cleanly with `PRAGMA foreign_keys = ON;`.
   Add a new test file `src-tauri/tests/chat_persistence_tests.rs` verifying:
   - Auto-creation of `ai_chat_sessions` on `save_message`.
   - Handling of non-existent/unimported `paper_id` without foreign key error.
   - `list_messages` returns messages in chronological order.
   - `clear_session_messages` clears messages for that session.
   - `delete_session` cascade-deletes messages.

2. **Frontend Test Verification**:
   Run:
   ```powershell
   npx vitest run src/test/phase13-pdf-reader.test.tsx src/test/discover-state-and-assistant.test.tsx src/test/ai-workspace.test.tsx src/test/desktop-api.test.ts
   ```
   All 29 tests across these 4 existing suites must continue to pass without regressions.
   Add a dedicated integration test suite `src/test/chat-persistence.test.tsx` verifying:
   - AI Hub loads messages from `listAiChatMessages` and saves via `saveAiChatMessage`.
   - PDF Right Panel loads history and provides working Clear History action.
   - Discover Paper Assistant synchronizes with SQLite and clears both store and DB.

3. **Conditions for Invalidation**:
   - If SQLite foreign keys can be violated without error (invalidates Foreign Key Trap observation).
   - If any frontend panel is already persisting to SQLite (invalidates Storage Disconnect observation).
