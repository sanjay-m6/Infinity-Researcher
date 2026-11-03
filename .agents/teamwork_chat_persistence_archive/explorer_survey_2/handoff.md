# Handoff Report — Explorer 2 (Copilot Context Explorer)
**Survey & Architecture Specification for Requirement R2 (UI Component Understanding)**

## 1. Observation

1. **Global AI Chat Drawer**:
   - Location: `src/components/chat/GlobalAiChatDrawer.tsx` (lines 25–230).
   - Chat persistence currently uses `localStorage`:
     - Line 35: `const saved = localStorage.getItem("global_ai_chat_messages");`
     - Line 83: `localStorage.setItem("global_ai_chat_messages", JSON.stringify(messages));`
   - AI generation call (`generateAiResponse`):
     - Lines 135–144:
       ```typescript
       const resp = await generateAiResponse({
         prompt: query,
         paper_id: null,
         task_type: mode === "library" ? "qa_citations" : "general_academic",
         audience_level: "researcher",
         reading_mode: "deep_read",
         rag_scope: mode === "library" ? "library" : "none",
         provider_override: selectedProviderId,
         model_override: activeProv?.default_model || undefined,
       });
       ```
     - Context passed is strictly the user's prompt string. There is zero awareness of the current view/section, open document, or visible UI components.
   - Interactive UI capability:
     - Lines 415–427: Clicking a citation button calls `setReadingPaper(found)`. This is the sole existing interactive action.

2. **Discover Paper Assistant**:
   - Location: `src/features/discover/DiscoverPaperAssistant.tsx` (lines 180–580).
   - Chat persistence currently uses an in-memory session store (`discoverSessionStore`):
     - Line 310: `const session = discoverSessionStore.getState();`
     - Line 452: `discoverSessionStore.addChatMessage(paperIdKey, userMsg);`
     - Line 577: `discoverSessionStore.clearChat(paperIdKey);`
   - AI generation call:
     - Lines 503–513: passes `prompt`, `paper_id`, `system_instruction` referencing `paper.title`, but zero awareness of active search query, filters, or discovered results list.

3. **PDF Viewer Right Panel AI Assistant**:
   - Location: `src/components/pdf-viewer/PdfRightPanel.tsx` (lines 75–157).
   - Chat persistence uses ephemeral React state:
     - Line 81: `const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);`
     - When the modal closes or unmounts, all messages are immediately lost.
   - Grounding context:
     - Lines 110–117:
       ```typescript
       let groundingContext = `Paper Title: "${paperTitle}". Current Page: ${currentPage} of ${numPages}.`;
       if (groundingScope === "selection" && selectedText) {
         groundingContext += `\nUser highlighted text excerpt:\n"${selectedText}"`;
       } else if (groundingScope === "page") {
         groundingContext += `\nGround your answer strictly within the context of Page ${currentPage}.`;
       } else {
         groundingContext += `\nGround your answer within the full academic document.`;
       }
       ```
     - Passed inside `system_instruction` to `generateAiResponse` (line 125).

4. **AI Hub Assistant**:
   - Location: `src/features/ai-hub/AiHubView.tsx` (lines 190–203, 513–580).
   - Chat persistence uses `localStorage`:
     - Line 192: `localStorage.getItem("ai_hub_chat_messages")`
     - Line 201: `localStorage.setItem("ai_hub_chat_messages", JSON.stringify(chatMessages))`

5. **Backend Database Schema & Repository**:
   - SQLite migration `src-tauri/migrations/0007_ai_workspace_and_knowledge.sql:93-115`:
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
     ```
   - Repository methods exist in `src-tauri/src/repositories/ai_repo.rs:850-903` (`list_messages`, `save_message`, `clear_session_messages`).
   - Tauri commands exist in `src-tauri/src/commands/ai.rs:383-410` (`list_ai_chat_messages`, `save_ai_chat_message`, `clear_ai_chat_session`).
   - Frontend API wrappers exist in `src/lib/desktop-api/index.ts:1750-1763`.
   - Foreign key constraint: `PRAGMA foreign_keys = ON;` is enforced in `src-tauri/src/database/mod.rs:89`. Therefore, saving a message to `ai_chat_messages` requires the `session_id` to exist in `ai_chat_sessions` first.

6. **Prompt Assembly & Tool Calling in Backend**:
   - `src-tauri/src/services/ai_provider_service.rs:972-1025` (`build_prompt_with_context`):
     - Injects academic research instructions and RAG passages from `AiRagContext`.
     - Zero awareness of UI state.
     - Zero tool definitions or function-calling payloads are sent to LLM endpoints.

---

## 2. Logic Chain

1. **From Observation 1, 2, 3, 4**:
   - Across all 4 chat surfaces, each surface manages chat state independently (two in `localStorage`, one in `discoverSessionStore`, one in ephemeral `useState`).
   - When users switch between views, close the PDF viewer, or restart the app, state is either fragmented or wiped out.
   - Concurrently, each surface sends only local parameters without global screen context.

2. **From Observation 5**:
   - The backend already has dedicated tables (`ai_chat_sessions`, `ai_chat_messages`), repository methods, Tauri commands, and frontend desktop APIs.
   - However, they are currently unused by the UI surfaces.
   - Furthermore, because foreign keys are active (`PRAGMA foreign_keys = ON`), inserting into `ai_chat_messages` without an entry in `ai_chat_sessions` will fail unless `save_message` or an `ensure_session_exists` helper upserts the session record.

3. **From Observation 6 and Research**:
   - Modern AI copilot grounding (e.g. Cursor IDE context providers, assistant-ui headless runtime, Microsoft Copilot Studio) demonstrates that extracting a **Semantic State Tree** from React state (`activeSection`, open modals, active paper, selected text, search query) yields ultra-compact (< 250 token) context.
   - Scraping raw DOM or accessibility trees via browser APIs is unnecessary and counter-productive for a 1st-party React app due to token bloat (classes, tailwind wrappers) and latency.
   - For action execution, a dual protocol (native JSON tool schema for cloud models + structured ````action ... ```` blocks for local GGUF models) guarantees 100% compatibility across cloud and local CPU models without hallucination or failure.

---

## 3. Caveats

1. **Local Model Token Limits**:
   - Infinity Researcher ships with local edge models (e.g. Qwen 0.5B / Llama 1B running on CPU via `llama-server`). These models have context limits of 2,048 tokens.
   - The UI context representation must remain strictly under 250 tokens so it never squeezes out retrieved paper passages or conversation history.
2. **Read-Only Investigation**:
   - In accordance with explorer constraints, no production files were modified. All architectural artifacts and specifications are contained within this folder (`analysis.md`, `handoff.md`).

---

## 4. Conclusion

1. **Architecture Blueprint**:
   - **Frontend**: Introduce a lightweight `UiContextProvider` and `useUiContext()` in `src/features/copilot/` that hooks into `AppContext` (`activeSection`, `readingPaper`, `selectedPaperId`, `globalSearchQuery`) and active modal states.
   - **Context Serialization**: Create `uiContextSerializer.ts` producing a structured `< 250-token` context block (`--- CURRENT APPLICATION & SCREEN STATE ---`).
   - **Action Dispatcher**: Create `UiActionDispatcher` supporting `navigate_screen`, `open_paper_reader`, `jump_pdf_page`, `set_search_query`, `toggle_sidebar`, and `toggle_theme`.
   - **Chat Grounding**: Update `GlobalAiChatDrawer`, `DiscoverPaperAssistant`, and `PdfRightPanel` to inject the serialized UI context into `generateAiResponse` and render interactive `UiActionCard` chips for assistant-proposed actions.
   - **Backend**: Extend `GenerateRequestInput` in `src-tauri/src/domain/ai.rs` and `commands/ai.rs` to ingest `ui_context`, formatting it into the system prompt in `ai_provider_service.rs:build_prompt_with_context()`.
   - **Persistence Integration (R1)**: Update all chat surfaces to use `listAiChatMessages`, `saveAiChatMessage`, and `clearAiChatSession`, ensuring session auto-creation in `ai_repo.rs` to satisfy SQLite foreign key constraints.

---

## 5. Verification Method

1. **Frontend Tests**:
   - Run `npm test` or `npx vitest run` to verify that existing test suites pass without regression.
   - Add new tests in `src/test/copilot-ui-context.test.tsx` and `src/test/copilot-action-dispatcher.test.tsx` to verify:
     - `useUiContext()` tracks route transitions and document opening.
     - Serialized context stays under 250 tokens.
     - `UiActionDispatcher` correctly executes actions and handles invalid payloads gracefully.
2. **Backend Tests**:
   - Run `cargo test` in `src-tauri` to verify backend build and existing test suites.
   - Add tests in `src-tauri/tests/ai_ui_context_tests.rs` verifying serialization of `UiContextSnapshot` and prompt formatting in `build_prompt_with_context()`.
3. **Invalidation Conditions**:
   - If UI context serialization exceeds 400 tokens, it will invalidate the low-VRAM CPU model constraint.
   - If action blocks cause local edge models to emit unparseable malformed text, the structured fallback parser must discard the action cleanly without corrupting the chat message display.
