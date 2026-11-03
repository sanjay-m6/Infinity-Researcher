Store chat data and persist message history across sessions in all application chat panels, and integrate UI component understanding capabilities into the assistant copilot based on online research.

Working directory: d:\Paper
Integrity mode: development

## Requirements

### R1. Chat Data and History Persistence Across Panels
Persist chat messages and conversation history across all chat surfaces in the application (AI Hub, PDF Viewer Right Panel, and Discover Paper Assistant) across sessions using the existing SQLite database storage infrastructure (`ai_chat_sessions` and `ai_chat_messages` tables, backend repository methods, and frontend desktop APIs). Ensure chat history is loaded upon opening each panel or restarting the application, and users can manage or clear session history.

### R2. UI Component Understanding Research and Integration
Research online patterns for how AI chatbots understand UI components (including UI context/state grounding, active view awareness, component tree representation, and action execution/tool calling). Integrate UI component understanding into the application so the assistant is grounded in the current screen context, visible panels, and active UI components when responding to user queries or performing actions.

## Verification Resources
Existing automated test suites (`cargo test` for Tauri/Rust backend, `npm test` or existing frontend test runners for React/TypeScript), plus newly added automated unit or integration tests verifying chat persistence and UI component understanding.

## Acceptance Criteria

### Chat Persistence
- [ ] Chat messages sent and received in AI Hub, PDF Viewer Right Panel, and Discover Paper Assistant are persisted to the SQLite database via backend commands and desktop APIs.
- [ ] When opening any of the three chat panels or restarting the desktop application, previous chat history is retrieved from storage and displayed.
- [ ] Clearing a chat session deletes or clears stored messages properly without leaving orphaned state or causing UI errors.

### UI Component Understanding
- [ ] Research on AI chatbot UI component understanding patterns (state grounding, component awareness, action triggers) is conducted and documented in the repository.
- [ ] The assistant copilot integrates UI component understanding, capturing current screen/view context or active components to inform assistant responses or actions.

### Verification
- [ ] Automated tests for chat persistence in the repository and frontend integration pass.
- [ ] Automated tests for UI component understanding logic pass.
- [ ] Existing project test suites (`cargo test` and `npm test`) pass with no regressions.
