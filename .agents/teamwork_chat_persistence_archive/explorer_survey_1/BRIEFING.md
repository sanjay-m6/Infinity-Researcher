# BRIEFING — 2026-11-03T04:21:00Z

## Mission
Survey the architecture, current implementation, and required modifications for Requirement R1: Chat Data and History Persistence Across Panels (AI Hub, PDF Viewer Right Panel, Discover Paper Assistant).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\Paper\.agents\teamwork\explorer_survey_1\
- Original parent: 1de78534-cf9b-42f7-9125-c83ea2a3b73f
- Milestone: Survey & Architecture Discovery for R1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce comprehensive analysis.md and handoff.md in working directory
- Communicate via send_message to parent upon completion

## Current Parent
- Conversation ID: 1de78534-cf9b-42f7-9125-c83ea2a3b73f
- Updated: 2026-11-03T04:21:00Z

## Investigation State
- **Explored paths**:
  - `src-tauri/migrations/0007_ai_workspace_and_knowledge.sql`
  - `src-tauri/src/database/migrations.rs` & `src-tauri/src/database/mod.rs`
  - `src-tauri/src/domain/ai.rs`
  - `src-tauri/src/repositories/ai_repo.rs` & `matrix_repo.rs`
  - `src-tauri/src/commands/ai.rs` & `src-tauri/src/lib.rs`
  - `src/lib/desktop-api/index.ts` & `src/lib/desktop-api/types.ts`
  - `src/features/ai-hub/AiHubView.tsx`
  - `src/components/pdf-viewer/PdfRightPanel.tsx`
  - `src/features/discover/DiscoverPaperAssistant.tsx` & `discoverSessionStore.ts`
  - `src/components/chat/GlobalAiChatDrawer.tsx`
  - Rust & Vitest test suites (`projects_and_ai_tests.rs`, `database_integration_tests.rs`, `phase13-pdf-reader.test.tsx`, `discover-state-and-assistant.test.tsx`, `ai-workspace.test.tsx`, `desktop-api.test.ts`)
- **Key findings**:
  1. Backend `ai_chat_sessions` table exists in SQL schema (migration 0007), but `AiChatSession` struct is missing in Rust domain and has ZERO repository methods and ZERO Tauri commands.
  2. `ai_chat_messages` enforces a strict foreign key `REFERENCES ai_chat_sessions(id) ON DELETE CASCADE` with `PRAGMA foreign_keys = ON;`. Calling `save_message` without pre-existing session causes immediate SQLite foreign key failure.
  3. `paper_id` in `ai_chat_sessions` and `ai_chat_messages` references `papers(id) ON DELETE SET NULL`. If an unimported paper ID is used (e.g. from search), SQLite will reject with foreign key error unless sanitized to `NULL`.
  4. AI Hub uses `localStorage.getItem("ai_hub_chat_messages")` and hardcodes `session_id: "default_session"`, never calling backend commands.
  5. PDF Viewer Right Panel uses pure in-memory React `useState<ChatMsg[]>([])`, completely losing history on navigate/tab-switch/restart, with no clear button.
  6. Discover Paper Assistant uses `discoverSessionStore`, persisting only to `localStorage` under `paper_desktop_discover_session_v1`, with no SQLite persistence.
  7. Clear actions in AI Hub and Discover only mutate `localStorage` and React state, never deleting from SQLite.
- **Unexplored areas**: None for R1. All targets mapped.

## Key Decisions Made
- Formulate comprehensive architecture recommendations:
  1. Add `AiChatSession` domain struct and CRUD methods in `ai_repo.rs` and `commands/ai.rs`.
  2. Auto-ensure session in `save_message` (upserting session if not found, validating `paper_id` existence against `papers` table).
  3. Expose session CRUD in Tauri commands and frontend desktop-api bridge.
  4. Wire all three panels to load from SQLite on mount / paper change, persist on message send/receive, and delete from SQLite on clear.

## Artifact Index
- DISPATCH.md — Incoming messages log
- BRIEFING.md — Persistent context & state
- progress.md — Liveness heartbeat and milestone tracker
- analysis.md — In-depth architectural survey report
- handoff.md — 5-component self-contained handoff report
