# Project: Chat Persistence and UI Component Understanding

## Architecture
The application is a Tauri v2 desktop application pairing a Rust backend (`src-tauri/`) with a React 18 / TypeScript frontend (`src/`).

### Layer Architecture
1. **Backend Storage & Domain (`src-tauri`)**:
   - SQLite database managed via `rusqlite` with migrations in `src-tauri/migrations/`.
   - `ai_chat_sessions` and `ai_chat_messages` tables established in `0007_ai_workspace_and_knowledge.sql` with foreign keys enforced (`PRAGMA foreign_keys = ON;`).
   - Domain models in `src-tauri/src/domain/ai.rs`.
   - Repository layer in `src-tauri/src/repositories/ai_repo.rs` providing thread-safe SQLite operations.
   - IPC Command layer in `src-tauri/src/commands/ai.rs` exposed to the frontend via Tauri `invoke_handler`.
   - AI generation & prompt construction service in `src-tauri/src/services/ai_provider_service.rs`.

2. **Frontend Desktop API Bridge (`src/lib/desktop-api/`)**:
   - TypeScript interfaces in `src/lib/desktop-api/types.ts`.
   - Typed wrappers for Tauri IPC commands in `src/lib/desktop-api/index.ts`.

3. **Frontend Chat Surfaces (`src/`)**:
   - **AI Hub** (`src/features/ai-hub/AiHubView.tsx`): Dedicated AI exploration panel.
   - **PDF Viewer Right Panel** (`src/components/pdf-viewer/PdfRightPanel.tsx`): In-reader document assistant with page/selection grounding.
   - **Discover Paper Assistant** (`src/features/discover/DiscoverPaperAssistant.tsx` & `discoverSessionStore.ts`): Search and literature discovery assistant.
   - **Global AI Chat Drawer** (`src/components/chat/GlobalAiChatDrawer.tsx`): Flyout assistant accessible across views.

4. **UI Component Understanding Engine (`src/features/copilot/`)**:
   - `UiContextProvider.tsx` & `useUiContext`: Gathers live React application state (route, active panels, open paper, selection, search query).
   - `uiContextSerializer.ts`: Serializes current UI state into a concise semantic context block (< 250 tokens / < 600 characters).
   - `UiActionDispatcher.ts` & `UiActionCard.tsx`: Parses and executes assistant-driven actions (navigate screen, open paper, jump page, filter).
   - Backend `GenerateRequestInput` extension: Accepts `ui_context` and injects it into LLM prompt assembly.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Frontend Syntax & Type Fix | Fix duplicated export and variable hoisting in `src/context/AppContext.tsx` to unblock 34 Vitest test suites | M1 | Survey (Explorer 3) |
| F2 | Backend AiChatSession Model | Add `AiChatSession` struct with id, paper_id, title, created_at, updated_at in `domain/ai.rs` | M1 | Survey (Explorer 1) |
| F3 | Backend Session CRUD & Foreign Key Safety | Add `ensure_session_exists`, `create_session`, `list_sessions`, `delete_session` in `ai_repo.rs`; sanitize unimported `paper_id`s | M1 | Survey (Explorer 1) |
| F4 | Backend Tauri Session Commands | Expose `list_ai_chat_sessions`, `create_ai_chat_session`, `delete_ai_chat_session` in `commands/ai.rs` and `lib.rs` | M1 | Survey (Explorer 1) |
| F5 | Backend UI Context Prompt Ingestion | Extend `GenerateRequestInput` with `ui_context: Option<String>` and format it in `ai_provider_service.rs:build_prompt_with_context` | M1 | Survey (Explorer 2) |
| F6 | Frontend Desktop API Bridge | Export `listAiChatMessages`, `saveAiChatMessage`, `clearAiChatSession`, `createAiChatSession`, `listAiChatSessions`, `deleteAiChatSession` in `desktop-api` | M1 | Survey (Explorer 1 & 3) |
| F7 | AI Hub Chat Persistence | Wire `AiHubView.tsx` to load from SQLite on mount, persist messages on exchange, and delete session messages on clear | M2 | Survey (Explorer 1) |
| F8 | PDF Viewer Right Panel Chat Persistence | Standardize on `AiChatMessage`, load from SQLite by `pdf_chat_${paperId}`, persist messages, and add Clear History button | M2 | Survey (Explorer 1) |
| F9 | Discover Paper Assistant Persistence | Wire `DiscoverPaperAssistant.tsx` and `discoverSessionStore.ts` to SQLite, persist messages, and clear cleanly | M2 | Survey (Explorer 1) |
| F10 | UI Component Understanding Research Doc | Author comprehensive research document in `docs/ui-component-understanding.md` on state grounding, semantic trees, and action execution | M3 | Survey (Explorer 2) |
| F11 | UI Context Provider & Serializer | Implement `UiContextProvider` and `uiContextSerializer` to capture active screen, visible panels, active paper, and selection | M3 | Survey (Explorer 2) |
| F12 | Assistant Copilot UI Grounding | Inject serialized UI context into `generateAiResponse` calls across AI Hub, PDF Viewer, Discover Assistant, and Global Chat | M3 | Survey (Explorer 2) |
| F13 | UI Action Dispatcher & Card | Implement action execution (`UiActionDispatcher`) and chat action chips (`UiActionCard`) for assistant navigation and interactions | M3 | Survey (Explorer 2) |
| F14 | E2E Testing Suite & Quality Gate | Automated Rust (`chat_persistence_tests.rs`) and Frontend (`chat-persistence.test.tsx`, `ui-component-understanding.test.tsx`) test suites passing with zero regressions | M4 | Survey (Explorer 3) |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend SQLite Persistence & Domain Infrastructure | Features F1, F2, F3, F4, F5, F6. Fix `AppContext.tsx`, implement session model & CRUD, foreign key safety, commands, UI context ingestion in backend, and frontend `desktop-api` wrappers. | none | DONE |
| M2 | Frontend Chat Persistence Across Panels | Features F7, F8, F9. Wire AI Hub, PDF Viewer Right Panel, and Discover Paper Assistant to SQLite desktop APIs. Implement session hydration and clearing. | M1 | IN_PROGRESS |
| M3 | UI Component Understanding Research & Copilot Integration | Features F10, F11, F12, F13. Author research doc, build `UiContextProvider`, `uiContextSerializer`, `UiActionDispatcher`, and wire prompt injection into copilot. | M1 | PLANNED |
| M4 | E2E Test Pass, Adversarial Hardening & Audit Gate | Feature F14. Run all backend and frontend test suites (Tiers 1-4), execute adversarial tests (Tier 5), perform forensic integrity audit, and achieve 100% pass rate with zero regressions. | M2, M3 | PLANNED |

---

## Interface Contracts

### Backend ↔ Frontend IPC Contract (`src-tauri/src/commands/ai.rs` ↔ `src/lib/desktop-api/`)
```typescript
export interface AiChatSession {
  id: string;
  paper_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: string;
  session_id: string;
  paper_id?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  citations_json?: string | null;
  provider_id?: string | null;
  model_id?: string | null;
  retrieval_mode?: string;
  created_at?: string;
}

// Commands:
// list_ai_chat_sessions() -> Promise<AiChatSession[]>
// create_ai_chat_session(session: AiChatSession) -> Promise<void>
// delete_ai_chat_session(session_id: string) -> Promise<void>
// list_ai_chat_messages(session_id: string) -> Promise<AiChatMessage[]>
// save_ai_chat_message(message: AiChatMessage) -> Promise<void>
// clear_ai_chat_session(session_id: string) -> Promise<void>
```

### UI Component Understanding Contract (`src/features/copilot/`)
```typescript
export interface UiContextSnapshot {
  activeSection: string; // e.g. "library", "discover", "review-matrix", "pdf-reader"
  visiblePanels: string[]; // e.g. ["pdf-reader-right-panel", "global-ai-chat-drawer"]
  activePaper?: {
    id: string;
    title: string;
    page?: number;
    totalPages?: number;
  } | null;
  selectedText?: string | null;
  searchQuery?: string | null;
  activeFilter?: string | null;
}

export interface UiActionDirective {
  action: "navigate_screen" | "open_paper" | "jump_pdf_page" | "set_search_filter" | "toggle_panel";
  params: Record<string, any>;
  description: string;
}
```

---

## Code Layout
- `src-tauri/src/domain/ai.rs` — Backend AI domain models (`AiChatSession`, `AiChatMessage`, `GenerateRequestInput`)
- `src-tauri/src/repositories/ai_repo.rs` — SQLite session & message CRUD with foreign key auto-handling
- `src-tauri/src/commands/ai.rs` — Tauri command handlers
- `src-tauri/src/services/ai_provider_service.rs` — LLM prompt assembly with UI context
- `src-tauri/tests/chat_persistence_tests.rs` — Backend integration tests
- `src/context/AppContext.tsx` — Global application state (syntax fix & UI state source)
- `src/lib/desktop-api/types.ts` & `index.ts` — Frontend desktop API bridges
- `src/features/ai-hub/AiHubView.tsx` — AI Hub chat panel persistence
- `src/components/pdf-viewer/PdfRightPanel.tsx` — PDF Viewer Right Panel persistence
- `src/features/discover/DiscoverPaperAssistant.tsx` & `discoverSessionStore.ts` — Discover Assistant persistence
- `docs/ui-component-understanding.md` — Online research report on UI component understanding
- `src/features/copilot/` — UI context provider, serializer, action dispatcher, and action cards
- `src/test/chat-persistence.test.tsx` — Frontend persistence integration tests
- `src/test/ui-component-understanding.test.tsx` — UI component understanding unit and integration tests
