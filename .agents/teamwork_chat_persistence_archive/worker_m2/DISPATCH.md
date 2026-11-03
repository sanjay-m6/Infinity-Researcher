## 2026-11-03T04:59:04Z
You are Worker 2 (Frontend Chat Persistence Worker) implementing Milestone 2.
Your assigned working directory is: d:\Paper\.agents\teamwork\worker_m2\
Your parent orchestrator conversation ID is: 1de78534-cf9b-42f7-9125-c83ea2a3b73f

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md

Also read:
- d:\Paper\.agents\teamwork\PROJECT.md
- d:\Paper\.agents\teamwork\TEST_INFRA.md
- d:\Paper\.agents\teamwork\explorer_survey_1\handoff.md
- d:\Paper\.agents\teamwork\worker_m1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own these files exclusively:
- src/features/ai-hub/AiHubView.tsx
- src/components/pdf-viewer/PdfRightPanel.tsx
- src/features/discover/DiscoverPaperAssistant.tsx
- src/features/discover/discoverSessionStore.ts
- src/test/chat-persistence.test.tsx

TASKS TO EXECUTE FOR MILESTONE 2:
1. AI Hub (`src/features/ai-hub/AiHubView.tsx`):
   - Import `listAiChatMessages`, `saveAiChatMessage`, `clearAiChatSession` from `@/lib/desktop-api`.
   - On mount or paper selection, load stored messages for the session (`ai_hub_${paperId || "general"}` or `ai_hub_default`) via `listAiChatMessages`.
   - When messages are sent (user message) and when assistant response completes, persist to SQLite via `saveAiChatMessage`.
   - When clearing chat history (line ~1604), invoke `clearAiChatSession(sessionId)` to delete persisted messages from SQLite as well as clearing component state.
   - Retain localStorage as fallback for non-Tauri preview mode.

2. PDF Viewer Right Panel (`src/components/pdf-viewer/PdfRightPanel.tsx`):
   - Standardize chat message representation to use `AiChatMessage` from `@/lib/desktop-api`.
   - Derive session ID: `pdf_chat_${paperId}`.
   - On mount or paper change, load existing chat history from SQLite via `listAiChatMessages(sessionId)`.
   - When user submits a question and when assistant response completes, persist each turn via `saveAiChatMessage`.
   - Add a "Clear History" button (e.g. trash icon or button with tooltip) in the chat header of `PdfRightPanel.tsx`. When clicked, call `clearAiChatSession(sessionId)` and clear local message state cleanly.

3. Discover Paper Assistant (`src/features/discover/DiscoverPaperAssistant.tsx` & `discoverSessionStore.ts`):
   - Derive session ID: `discover_${paperIdKey}`.
   - In `DiscoverPaperAssistant.tsx` on mount / paper change, load stored chat messages from SQLite via `listAiChatMessages(sessionId)` and populate the store (`discoverSessionStore`).
   - When adding a chat message (user or assistant), persist to SQLite via `saveAiChatMessage`.
   - When `clearChat` is called, invoke `clearAiChatSession(sessionId)` to delete stored messages from SQLite in addition to resetting the store.

4. Integration Tests in `src/test/chat-persistence.test.tsx`:
   - Write comprehensive tests verifying:
     - AI Hub loads messages from `listAiChatMessages`, persists via `saveAiChatMessage`, and clears via `clearAiChatSession`.
     - PDF Right Panel loads messages from `listAiChatMessages`, persists via `saveAiChatMessage`, and clears via `clearAiChatSession`.
     - Discover Paper Assistant loads from `listAiChatMessages`, persists via `saveAiChatMessage`, and clears via `clearAiChatSession`.
   - Execute tests with `npx vitest run src/test/chat-persistence.test.tsx`.
   - Verify existing tests continue to pass: `npx vitest run src/test/phase13-pdf-reader.test.tsx src/test/discover-state-and-assistant.test.tsx src/test/ai-workspace.test.tsx src/test/desktop-api.test.ts`.
   - Verify TypeScript: `npx tsc --noEmit`.

Maintain progress.md in your working directory.
Run the builds and tests yourself, document all command invocations and outputs in `handoff.md`.
Write your complete report to:
d:\Paper\.agents\teamwork\worker_m2\handoff.md

When done, message parent (1de78534-cf9b-42f7-9125-c83ea2a3b73f) with a summary and path to handoff.md.

