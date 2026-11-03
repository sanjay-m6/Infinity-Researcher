# UI Component Understanding Research & Architecture Specification
**Infinity Researcher — Copilot Context & Action Integration (Requirement R2)**

- **Date**: 2026-11-03
- **Author**: Explorer 2 (Copilot Context Explorer)
- **Status**: Complete Architecture & Research Synthesis

---

## 1. Executive Summary

Requirement R2 requires integrating **UI Component Understanding** into the Infinity Researcher desktop application so the AI Assistant / Copilot is dynamically grounded in the active screen context, visible panels, open documents, and actionable UI components.

Our investigation of the codebase and deep online research revealed:
1. **Current State**: The application currently has four independent chat surfaces (`GlobalAiChatDrawer`, `DiscoverPaperAssistant`, `PdfRightPanel`, and `AiHubView`). All four pass *only isolated textual parameters* (such as a bare prompt string or a paper title) to the backend. The AI has **zero awareness** of the active view/route (`activeSection`), open modals (e.g. PDF reader), search query state, visible controls, or selected text in global context. Furthermore, there is **zero action execution or tool calling capability**—the assistant cannot navigate the app, open papers, jump to PDF pages, or execute commands.
2. **Online Research Patterns**: Leading industry and academic systems (Playwright agents, Cursor IDE context providers, Microsoft Copilot Studio, OSWorld, SeeClick, and assistant-ui) demonstrate that desktop copilots succeed best by decoupling UI perception from rendering via a **Semantic UI State Tree** rather than fragile DOM/pixel scraping. The optimal architecture uses a **Perceive $\rightarrow$ Reason $\rightarrow$ Ground $\rightarrow$ Act** loop with a dual action protocol (native JSON tool calling for cloud models and structured action blocks for local edge GGUF models).
3. **Proposed Architecture**: A lightweight, non-invasive **UI Context Provider (`UiContextProvider`)** and **Action Dispatcher (`UiActionDispatcher`)** that aggregates active screen state (< 250 tokens), injects it into both frontend and backend LLM prompt pipelines, and executes assistant-suggested actions (e.g., navigating to sections, opening papers in reader, jumping to pages, applying search filters).

---

## 2. Current AI Assistant Implementation Audit

### 2.1 Inventory of AI Assistant Surfaces

| Surface | File Location | Trigger / Entry Point | Current Context Passed | Current Action Capability | Persistence Status |
|---|---|---|---|---|---|
| **Global AI Chat Drawer** | `src/components/chat/GlobalAiChatDrawer.tsx` | Floating button bottom-right / `Ctrl+J` (in `AppShell.tsx:210`) | Bare prompt string, `mode: "general" \| "library"` | User can click citation buttons to open paper in reader | LocalStorage (`global_ai_chat_messages`) |
| **Discover Paper Assistant** | `src/features/discover/DiscoverPaperAssistant.tsx` | Embedded side drawer in `DiscoverView.tsx:3820` | `paper_id`, `paper.title`, extracted page text chunks via RAG | User can click citation to jump PDF page (`onNavigatePdfPage`) | In-memory store (`discoverSessionStore.ts`) |
| **PDF Viewer Right Panel** | `src/components/pdf-viewer/PdfRightPanel.tsx` | Tab "ai" in `EmbeddedPdfViewer.tsx:430` | `paperTitle`, `currentPage`, `numPages`, `selectedText` (in system text) | Preset chips, citation page jump | Local component React state (lost on unmount) |
| **AI Hub Assistant** | `src/features/ai-hub/AiHubView.tsx` | Persistent tab `isAiHubActive` (`AppShell.tsx:174`) | `paper_id`, `audience_level`, `reading_mode`, `rag_scope` | Preset prompts | LocalStorage (`ai_hub_chat_messages`) |
| **Review Matrix Copilot** | `src/features/review-matrix/ReviewMatrixView.tsx` | Side panel in matrix workspace | Paper ID, matrix column key | Evidence cell extraction | SQLite matrix extraction tables |
| **Academic Writing Workspace** | `src/features/writing-workspace/writingEngine.ts` | Tools hub tools (`ai_humanizer`, etc.) | Selected paragraph, target tone | Apply rewrite to editor | In-memory editor state |

### 2.2 Backend Architecture & Prompt Construction

1. **Tauri Command Entry Point**:
   `src-tauri/src/commands/ai.rs:351`: `generate_ai_response(input: GenerateRequestInput)`
   - Takes `GenerateRequestInput`:
     ```rust
     pub struct GenerateRequestInput {
         pub prompt: String,
         pub system_instruction: Option<String>,
         pub paper_id: Option<String>,
         pub task_type: Option<String>,
         pub audience_level: Option<String>,
         pub reading_mode: Option<String>,
         pub rag_scope: Option<String>,
         pub provider_override: Option<String>,
         pub model_override: Option<String>,
     }
     ```
   - If `rag_scope != "none"`, queries `AiRagService::retrieve_context(db, &input.prompt, input.paper_id, &scope, 6)`.
   - Calls `state.ai_provider_service.generate(db, &input, rag_context.as_ref())`.

2. **Prompt Construction**:
   `src-tauri/src/services/ai_provider_service.rs:972` (`build_prompt_with_context`):
   - **System Instruction**:
     ```text
     You are an expert scientific researcher and literature analysis assistant.
     Communicate exclusively in clear, grammatically correct English.
     Audience level: <researcher>.
     Provide factual, direct, and concise answers based strictly on the provided research context.
     Do not include conversational filler, meta headers, thought processes, or non-English characters.
     <optional extra system_instruction>
     ```
   - **User Content Assembly**:
     ```text
     --- BEGIN RESEARCH PAPER CONTEXT ---
     [Passage 1] Paper: "..." | Page: 2 | Section: Methodology
     <passage text>
     --- END RESEARCH PAPER CONTEXT ---
     Instructions: Ground your answer ONLY in the provided passages where possible. ...
     <user prompt>
     ```
   - **Deficiency**: The prompt contains **no knowledge** of the user's UI context (current view, active panels, open document, filter states, or available UI actions).

3. **Database & Persistence Infrastructure**:
   - SQLite tables `ai_chat_sessions` and `ai_chat_messages` are defined in `migrations/0007_ai_workspace_and_knowledge.sql:93-115`.
   - Backend commands `list_ai_chat_messages`, `save_ai_chat_message`, and `clear_ai_chat_session` are defined in `src-tauri/src/commands/ai.rs:383-410` and registered in `lib.rs:199-201`.
   - Frontend wrappers exist in `src/lib/desktop-api/index.ts:1750-1763`.
   - **Deficiency**: The chat surfaces are NOT utilizing these SQLite methods uniformly:
     - `GlobalAiChatDrawer` saves to `localStorage` (`global_ai_chat_messages`).
     - `AiHubView` saves to `localStorage` (`ai_hub_chat_messages`).
     - `PdfRightPanel` keeps messages in ephemeral React `useState` (lost when closing the PDF viewer).
     - `DiscoverPaperAssistant` keeps messages in in-memory `discoverSessionStore.ts`.

4. **Tool Calling & Action Capabilities**:
   - There are **no tool call definitions** in `src-tauri` or in the frontend.
   - The assistant cannot emit commands to navigate the user, open a modal, apply filters, or trigger exports.

---

## 3. Online Research: AI Chatbot UI Component Understanding

### 3.1 Taxonomy of UI Understanding for AI Agents

Recent state-of-the-art research (2024–2026) categorizes UI understanding across three dimensions:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    UI Understanding Representations                     │
├──────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Visual/Multimodal │ 2. Accessibility / DOM   │ 3. Semantic State     │
│ (Screenshots + OCR)  │ (AXTree / Filtered HTML) │ (App State Snapshot)  │
├──────────────────────┼──────────────────────────┼───────────────────────┤
│ • Ferret-UI, SeeClick│ • Mind2Web, WebVoyager   │ • Cursor IDE Context  │
│ • CogAgent, OSWorld  │ • Playwright AXTree      │ • assistant-ui Runtime│
│ • ScreenQA           │ • Chromium CDP tree      │ • Raycast AI Context  │
│ High compute / VRAM  │ High token count (~5-15k)│ Ultra-compact (<300 t)│
│ High latency (2-5s)  │ Brittle class selectors  │ Deterministic & fast  │
│ Best for black-box OS│ Best for web scraping    │ Best for 1st-party app│
└──────────────────────┴──────────────────────────┴───────────────────────┘
```

#### A. Academic Foundations
- **SeeClick & CogAgent (2024)**: Point-and-click visual grounding on GUI screens. Highlights that pixel-level bounding boxes are essential when internal application state is inaccessible, but introduce significant latency and token cost.
- **Mind2Web & WebVoyager (2024)**: Benchmark web agents using accessibility trees. Proves that filtering DOM trees down to semantic interactive nodes (Roles, Names, Values) boosts task completion from 14% (raw HTML) to 73% (filtered AXTree) while slashing tokens by 85%.
- **OSWorld (2024)**: Multimodal OS-level agent evaluation benchmark. Shows that hybrid grounding (semantic element IDs + coordinate fallback) is necessary for complex desktop workflows.

#### B. Industry Patterns for Desktop Applications
1. **Cursor IDE Context Model**:
   - Cursor grounds its AI assistant by extracting active editor state: active file path, visible viewport line range, active selection, open tabs, and recent terminal commands.
   - It formats this state into structured context blocks (`--- CURRENT FILE CONTEXT ---`) prepended to the user prompt.
2. **Microsoft Windows Copilot Runtime / Copilot Studio**:
   - Uses an explicit `updateModelContextAsync` pattern where the desktop application pushes a lightweight summary of visible panels, active selection, and valid commands to the Copilot host.
3. **Model Context Protocol (MCP)**:
   - Dynamic tool discovery: Exposes discrete tools (`open_paper`, `navigate_view`) with JSON Schemas so the model understands what actions it can trigger.

### 3.2 Accessibility Tree vs Semantic Virtual Tree for Infinity Researcher

Why a **Semantic Virtual State Tree** is vastly superior to DOM / Accessibility scraping for Infinity Researcher:
1. **Zero Token Bloat**: Raw HTML in Tailwind React applications contains thousands of utility classes (`flex items-center justify-between p-3 sm:p-6 backdrop-blur-md...`). Scraping HTML uses 10,000+ tokens. A structured semantic state snapshot uses **150 to 250 tokens**.
2. **Deterministic Element Grounding**: In a first-party React app, UI state (which paper is open, which page, what search query is active) is already modeled in React contexts (`AppContext`, `discoverSessionStore`). Scraping the DOM to re-infer what React already knows is wasteful and error-prone.
3. **Offline / Low-Resource Performance**: Infinity Researcher runs on local CPU sidecars (`llama-server` GGUF models like Qwen 0.5B / Llama 1B with 2048-token context limits). Keeping UI context under 250 tokens ensures that 80%+ of the context window remains available for academic paper passages and user dialogue.

### 3.3 The Perceive $\rightarrow$ Reason $\rightarrow$ Ground $\rightarrow$ Act Loop

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Copilot Execution Loop                       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
1. PERCEIVE ───────────────────────▼─────────────────────────────────────┐
│ Collect live UI state via `useUiContext()`:                            │
│ - Active Screen: "discover"                                            │
│ - Open Modal: "pdf_viewer"                                             │
│ - Document: "Attention Is All You Need" (Page 4)                       │
│ - Selection: "Multi-head attention allows..."                          │
│ - Visible Controls: [Zoom, PageJump, Citations, Close]                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
2. REASON ─────────────────────────▼─────────────────────────────────────┐
│ LLM combines UI Context + Paper RAG Context + User Query:              │
│ User: "Explain the selected equation and jump to the results section"  │
│ Model reasons about equation and identifies page 9 has results.        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
3. GROUND ─────────────────────────▼─────────────────────────────────────┐
│ Model produces grounded answer + structured action block:              │
│ Text: "The equation represents Scaled Dot-Product Attention..."        │
│ Action: `{"type": "jump_pdf_page", "page": 9}`                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
4. ACT ────────────────────────────▼─────────────────────────────────────┐
│ `UiActionDispatcher` executes action or presents Action Card:          │
│ - Dispatches `onNavigatePdfPage(9)` to PDF reader                      │
│ - Toast / badge confirms: "Navigated PDF to Page 9 (Results)"          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Concrete UI Component Understanding Architecture

### 4.1 Architecture Components Overview

```text
src/
├── features/
│   └── copilot/
│       ├── types.ts                     <-- UI Context & Action Schema types
│       ├── UiContextProvider.tsx        <-- React context & hook: captures live UI state
│       ├── uiContextSerializer.ts       <-- Serializes snapshot into compact prompt format
│       ├── uiActionDispatcher.ts        <-- Executes actions (navigate, open paper, etc.)
│       └── components/
│           ├── UiActionCard.tsx         <-- Renders interactive execution chips in chat
│           └── UiContextBadge.tsx       <-- Shows user active grounding chip in chat header
```

### 4.2 Data Schemas

#### 1. UI Context Snapshot Schema (`UiContextSnapshot`)

```typescript
export interface UiContextSnapshot {
  timestamp: string;
  activeScreen: NavSection;                // e.g. "discover", "library", "ai_hub", "review_matrix"
  screenTitle: string;                    // e.g. "Discover Academic Literature"
  activePanels: {
    isPdfViewerOpen: boolean;
    isPaperDetailOpen: boolean;
    isCommandPaletteOpen: boolean;
    isSidebarCollapsed: boolean;
  };
  activeDocument?: {
    id: string;
    title: string;
    doi?: string | null;
    currentPage?: number;
    numPages?: number;
    selectedText?: string;
  } | null;
  activeSearch?: {
    query: string;
    totalResults?: number;
  } | null;
  visibleActions: string[];               // e.g. ["navigate", "open_paper", "jump_pdf_page", "search"]
}
```

#### 2. Compact Serialization for Prompt Injection

When serialized for injection into the prompt, it produces a clean, readable text block:

```text
--- CURRENT USER SCREEN & UI CONTEXT ---
Active Screen: Discover Literature (Section: discover)
Open Panels: PDF Viewer Modal (Active)
Viewing Document: "Attention Is All You Need" (ID: paper_101)
PDF Viewer: Page 4 of 15
Highlighted Excerpt: "Multi-head attention allows the model to jointly attend..."
Active Search: "transformer architecture" (25 results in view)
Available Actions: [navigate, open_paper, jump_pdf_page, search_literature, switch_tab]
--- END UI CONTEXT ---
```

Token cost: **~95 tokens**! Even on a small 1,024 or 2,048 token local model, this leaves ample space for paper RAG chunks and reasoning.

#### 3. Action Schema (`UiAction`)

```typescript
export type UiActionType =
  | "navigate_screen"     // Switch activeSection
  | "open_paper_reader"   // Open paper in EmbeddedPdfViewer
  | "open_paper_details"  // Open paper in PaperDetailDrawer
  | "jump_pdf_page"       // Jump to page in open PDF
  | "set_search_query"    // Run search in discover or global search
  | "toggle_sidebar"      // Collapse or expand navigation sidebar
  | "toggle_theme"        // Switch light/dark mode
  | "show_notification";  // Display toast feedback

export interface UiAction {
  id: string;
  type: UiActionType;
  label: string;          // Human-readable: "Jump to Page 9"
  payload: Record<string, unknown>;
  autoExecute?: boolean;  // Safe read-only actions can execute automatically
}
```

### 4.3 Action Trigger Protocols

To support **both high-end cloud LLMs** (NVIDIA NIM, Groq, Claude) and **local CPU models** (In-App Local Qwen 0.5B / Llama 1B), we implement a dual action protocol:

1. **Protocol A: Structured Action Blocks (Universal)**:
   The system instruction tells the assistant:
   ```text
   When suggesting or performing a UI action, include an action block at the end of your response:
   ```action
   {"type": "navigate_screen", "section": "review_matrix", "label": "Go to Literature Review Matrix"}
   ```
   ```
   The client-side `MarkdownMessage` or `UiActionCard` parser extracts this block and renders a clickable action button with icon and label.

2. **Protocol B: Client-Side Dispatcher (`UiActionDispatcher`)**:
   A centralized dispatcher binds to `AppContext`:
   ```typescript
   export class UiActionDispatcher {
     constructor(private appState: AppContextType) {}

     execute(action: UiAction): boolean {
       switch (action.type) {
         case "navigate_screen":
           this.appState.setActiveSection(action.payload.section as NavSection);
           return true;
         case "open_paper_reader":
           this.appState.setReadingPaper({
             id: action.payload.paperId as string,
             title: action.payload.title as string,
             sourceUrl: action.payload.sourceUrl as string,
           });
           return true;
         case "jump_pdf_page":
           window.dispatchEvent(
             new CustomEvent("copilot-jump-pdf-page", { detail: { page: action.payload.page } })
           );
           return true;
         case "set_search_query":
           this.appState.setGlobalSearchQuery(action.payload.query as string);
           this.appState.setActiveSection("discover");
           return true;
         ...
       }
     }
   }
   ```

---

## 5. Detailed Component Modification Inventory

### 5.1 Frontend Modifications

1. **Create `src/features/copilot/`**:
   - `types.ts`: Define `UiContextSnapshot`, `UiAction`, `UiActionType`.
   - `UiContextProvider.tsx`: Context provider that listens to `AppContext`, active modals, and emits `useUiContext()`.
   - `uiContextSerializer.ts`: Serializes `UiContextSnapshot` to string format for `system_instruction` or prompt injection.
   - `uiActionDispatcher.ts`: Singleton or hook to safely execute UI actions.
   - `components/UiActionCard.tsx`: Renders action chips inside chat bubbles (e.g. "⚡ Open Paper in Reader").
2. **Update `src/components/layout/AppShell.tsx`**:
   - Wrap the shell inside `<UiContextProvider>` so all child drawers (`GlobalAiChatDrawer`, `EmbeddedPdfViewer`, `DiscoverView`) have synchronized access to UI state.
3. **Update `src/components/chat/GlobalAiChatDrawer.tsx`**:
   - Consume `useUiContext()`.
   - Include serialized UI context in calls to `generateAiResponse({ prompt, ui_context, ... })`.
   - Parse `action` blocks from assistant response and render `<UiActionCard />`.
   - Switch from `localStorage` to SQLite persistence via `listAiChatMessages("global_chat")`, `saveAiChatMessage()`, and `clearAiChatSession("global_chat")`.
4. **Update `src/components/pdf-viewer/PdfRightPanel.tsx`**:
   - Hook into `useUiContext()` to pass page number and selection cleanly.
   - Persist chat history per paper session using `listAiChatMessages(`pdf_${paperId}`)` and `saveAiChatMessage()`.
   - Listen to `copilot-jump-pdf-page` custom event to allow assistant to navigate pages.
5. **Update `src/features/discover/DiscoverPaperAssistant.tsx`**:
   - Hook into `useUiContext()` to ground assistant in active search query and visible results.
   - Persist chat history to SQLite using `listAiChatMessages(`discover_${paperId}`)`.
6. **Update `src/features/ai-hub/AiHubView.tsx`**:
   - Switch from `localStorage` (`ai_hub_chat_messages`) to SQLite persistence via `listAiChatMessages("ai_hub_default")`.

### 5.2 Backend Modifications

1. **Update `src-tauri/src/domain/ai.rs`**:
   - Add `UiContextSnapshot` struct (optional field on `GenerateRequestInput`).
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct UiContextSnapshot {
       pub active_screen: Option<String>,
       pub screen_title: Option<String>,
       pub active_document_title: Option<String>,
       pub active_document_id: Option<String>,
       pub current_page: Option<i64>,
       pub total_pages: Option<i64>,
       pub selected_text: Option<String>,
       pub active_search_query: Option<String>,
       pub available_actions: Option<Vec<String>>,
   }
   ```
2. **Update `src-tauri/src/services/ai_provider_service.rs`**:
   - In `build_prompt_with_context()`, if `input.ui_context` is present, inject formatted `--- CURRENT APPLICATION & SCREEN STATE ---` block into the system prompt.
   - Add guidance for generating actionable UI blocks when appropriate.
3. **Update `src-tauri/src/repositories/ai_repo.rs`**:
   - Verify `save_message` ensures an entry exists in `ai_chat_sessions` to satisfy foreign key constraint `REFERENCES ai_chat_sessions(id) ON DELETE CASCADE` if `PRAGMA foreign_keys = ON`.
   - Add `ensure_session_exists(conn, session_id, paper_id, title)` helper.

---

## 6. Verification and Testing Strategy

### 6.1 Automated Tests to Add

1. **Frontend Unit & Integration Tests**:
   - `src/test/copilot-ui-context.test.tsx`:
     - Test that `UiContextProvider` correctly captures active section changes.
     - Test that open document state (paper title, current page, selected text) updates dynamically.
     - Test that `serializeUiContext()` produces compact text within budget (< 300 tokens).
   - `src/test/copilot-action-dispatcher.test.tsx`:
     - Test that `UiActionDispatcher` executes `navigate_screen`, `open_paper_reader`, and `jump_pdf_page`.
     - Test that invalid/malformed action payloads are safely rejected without throwing exceptions.
   - `src/test/chat-persistence-all-panels.test.tsx`:
     - Test that `GlobalAiChatDrawer`, `PdfRightPanel`, and `DiscoverPaperAssistant` invoke `listAiChatMessages` on mount.
     - Test that sending a message calls `saveAiChatMessage`.
     - Test that clearing history calls `clearAiChatSession`.
2. **Backend Rust Tests**:
   - `src-tauri/tests/ai_ui_context_tests.rs`:
     - Test that `GenerateRequestInput` with `UiContextSnapshot` is serialized and deserialized properly.
     - Test `build_prompt_with_context` correctly incorporates UI context into system instructions.
     - Test `save_message` with auto-session creation satisfies foreign keys.

### 6.2 Regression Verification Commands
- `npm test` / `npx vitest run`: Ensures all 49 existing frontend test suites pass with 0 regressions.
- `cargo test`: Ensures all 12 backend test suites pass with 0 regressions.
