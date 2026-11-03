# E2E Test Infra: Chat Persistence & UI Component Understanding

## Test Philosophy
- Requirement-driven, opaque-box & automated unit/integration suites.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing across backend SQLite persistence and frontend UI copilot.
- Zero tolerance for regressions across existing test suites (`cargo test` and `npm test`).

## Feature Inventory Mapping
| # | Feature | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|-------------|:----------------:|:-----------------:|:----------------------:|:-------------------:|
| F1 | Frontend Syntax & Type Fix | R1 & Verification | 1 | 1 | 1 | 1 |
| F2 | Backend AiChatSession Model | R1 | 5 | 5 | ✓ | ✓ |
| F3 | Backend Session CRUD & FK Safety | R1 | 5 | 5 | ✓ | ✓ |
| F4 | Backend Tauri Session Commands | R1 | 5 | 5 | ✓ | ✓ |
| F5 | Backend UI Context Ingestion | R2 | 5 | 5 | ✓ | ✓ |
| F6 | Frontend Desktop API Bridge | R1 & R2 | 5 | 5 | ✓ | ✓ |
| F7 | AI Hub Chat Persistence | R1 | 5 | 5 | ✓ | ✓ |
| F8 | PDF Viewer Chat Persistence | R1 | 5 | 5 | ✓ | ✓ |
| F9 | Discover Assistant Persistence | R1 | 5 | 5 | ✓ | ✓ |
| F10 | UI Research Documentation | R2 | 5 | 5 | ✓ | ✓ |
| F11 | UI Context Provider & Serializer | R2 | 5 | 5 | ✓ | ✓ |
| F12 | Assistant Copilot Grounding | R2 | 5 | 5 | ✓ | ✓ |
| F13 | UI Action Dispatcher & Card | R2 | 5 | 5 | ✓ | ✓ |
| F14 | Comprehensive Verification Gate | Verification | 5 | 5 | ✓ | ✓ |

## Test Architecture
1. **Backend Tests**:
   - `src-tauri/tests/chat_persistence_tests.rs`:
     - Test session creation, listing, deletion.
     - Test message saving with automatic parent session creation.
     - Test message saving with unimported / non-existent paper_id (foreign key safety).
     - Test message ordering (chronological retrieval).
     - Test citation JSON serialization/deserialization roundtrip.
     - Test clearing messages in session.
     - Test cascade deletion (deleting session deletes all its messages).
     - Test isolation across sessions.
   - Command: `cargo test --manifest-path src-tauri/Cargo.toml --test chat_persistence_tests`
2. **Frontend Tests**:
   - `src/test/chat-persistence.test.tsx`:
     - Test desktop API wrappers for sessions and messages.
     - Test AI Hub loading on mount and persisting outgoing/incoming messages.
     - Test PDF Viewer Right Panel loading by `pdf_chat_${paperId}` and clearing history.
     - Test Discover Paper Assistant persisting and clearing across session stores.
   - `src/test/ui-component-understanding.test.tsx`:
     - Test `UiContextProvider` extracting active section, panels, reading paper, selection, search query.
     - Test `uiContextSerializer` output format and size (< 250 tokens / < 600 chars).
     - Test `UiActionDispatcher` executing navigations and search updates.
     - Test prompt assembly with `<ui_context>` injection into assistant generation.
   - Command: `npm test` (`npx vitest run`)

## Acceptance Pass Criteria
- 100% of newly added test suites pass.
- All pre-existing test suites continue to pass with zero regressions.
- Forensic Auditor reports CLEAN integrity verdict.

