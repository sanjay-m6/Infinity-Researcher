## 2026-11-03T04:29:50Z
You are Worker 1 (Backend & Infrastructure Worker) implementing Milestone 1.
Your assigned working directory is: d:\Paper\.agents\teamwork\worker_m1\
Your parent orchestrator conversation ID is: 1de78534-cf9b-42f7-9125-c83ea2a3b73f

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md

Also read:
- d:\Paper\.agents\teamwork\PROJECT.md
- d:\Paper\.agents\teamwork\TEST_INFRA.md
- d:\Paper\.agents\teamwork\explorer_survey_1\handoff.md
- d:\Paper\.agents\teamwork\explorer_survey_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own these files exclusively:
- src/context/AppContext.tsx
- src-tauri/src/domain/ai.rs
- src-tauri/src/repositories/ai_repo.rs
- src-tauri/src/commands/ai.rs
- src-tauri/src/lib.rs
- src-tauri/src/services/ai_provider_service.rs
- src/lib/desktop-api/types.ts
- src/lib/desktop-api/index.ts
- src-tauri/tests/chat_persistence_tests.rs

TASKS TO EXECUTE FOR MILESTONE 1:
1. Fix Frontend Syntax & Type Errors in `src/context/AppContext.tsx`:
   - Remove the duplicate declaration of `export const DEFAULT_LOCAL_RESEARCHER` on lines 324-330 inside `AppProvider`.
   - Move `const showToast = useCallback(...)` before line 348 to fix the TypeScript variable hoisting error (`TS2448: Block-scoped variable 'showToast' used before its declaration`).
   - Run `npx tsc --noEmit` and `npx vitest run src/test/desktop-api.test.ts` to confirm bundling and type checks pass.

2. Domain Model in `src-tauri/src/domain/ai.rs`:
   - Add `AiChatSession` struct:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct AiChatSession {
         pub id: String,
         pub paper_id: Option<String>,
         pub title: String,
         pub created_at: String,
         pub updated_at: String,
     }
     ```
   - In `GenerateRequestInput`, add:
     ```rust
     #[serde(default)]
     pub ui_context: Option<String>,
     ```

3. SQLite Repository in `src-tauri/src/repositories/ai_repo.rs`:
   - Implement `create_session(conn: &Connection, session: &AiChatSession) -> Result<()>`
   - Implement `list_sessions(conn: &Connection) -> Result<Vec<AiChatSession>>`
   - Implement `get_session(conn: &Connection, session_id: &str) -> Result<Option<AiChatSession>>`
   - Implement `delete_session(conn: &Connection, session_id: &str) -> Result<()>`
   - Implement `ensure_session_exists(conn: &Connection, session_id: &str, paper_id: Option<&str>, default_title: &str) -> Result<()>`:
     Checks if `session_id` exists in `ai_chat_sessions`. If not, creates it.
   - Update `save_message(conn: &Connection, msg: &AiChatMessage) -> Result<()>`:
     - Automatically call `ensure_session_exists` so `REFERENCES ai_chat_sessions(id)` never fails.
     - Check if `msg.paper_id` exists in `papers`. If `msg.paper_id` is Some(id) but `SELECT 1 FROM papers WHERE id = ?` returns empty, bind `None::<String>` so foreign key `REFERENCES papers(id) ON DELETE SET NULL` does not violate constraint when unimported/preview papers are passed.

4. Tauri Commands in `src-tauri/src/commands/ai.rs` & `src-tauri/src/lib.rs`:
   - Expose Tauri command handlers:
     - `list_ai_chat_sessions`
     - `create_ai_chat_session`
     - `delete_ai_chat_session`
   - Register them in `src-tauri/src/lib.rs` inside `generate_handler![]`.

5. Prompt Context in `src-tauri/src/services/ai_provider_service.rs`:
   - In `build_prompt_with_context()`, if `input.ui_context` has content, format and append it under a `--- UI CONTEXT & CURRENT SCREEN STATE ---` header.

6. Frontend Desktop API in `src/lib/desktop-api/types.ts` & `src/lib/desktop-api/index.ts`:
   - Define `interface AiChatSession`.
   - Implement and export wrappers:
     - `listAiChatSessions(): Promise<AiChatSession[]>`
     - `createAiChatSession(session: AiChatSession): Promise<void>`
     - `deleteAiChatSession(sessionId: string): Promise<void>`
     - `listAiChatMessages(sessionId: string): Promise<AiChatMessage[]>`
     - `saveAiChatMessage(message: AiChatMessage): Promise<void>`
     - `clearAiChatSession(sessionId: string): Promise<void>`

7. Backend Integration Tests in `src-tauri/tests/chat_persistence_tests.rs`:
   - Write integration tests using `Database::open_in_memory()` verifying:
     - Session creation, listing, retrieval, deletion.
     - Message saving automatically creates parent session without foreign key error.
     - Message saving with unknown paper_id does not trigger foreign key error.
     - Chronological message listing (`created_at ASC`).
     - Clearing session messages.
     - Cascade deletion of messages when a session is deleted.
     - Session isolation (messages from session A do not leak into session B).
   - Run `cargo test --manifest-path src-tauri/Cargo.toml --test chat_persistence_tests`.

