## 2026-11-03T05:32:51Z
You are Worker M2 Remediate (Frontend Chat Persistence Remediator) for Milestone 2 Iteration 2.
Your assigned working directory is: d:\Paper\.agents\teamwork\worker_m2_remediate\
Your parent orchestrator conversation ID is: 1de78534-cf9b-42f7-9125-c83ea2a3b73f

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
d:\Paper\.agents\teamwork\ORIGINAL_REQUEST.md

Read the failure evidence reports:
- Challenger 1 handoff: d:\Paper\.agents\teamwork\challenger_m2_1\handoff.md
- Reviewer 1 handoff: d:\Paper\.agents\teamwork\reviewer_m2_1\handoff.md
- Worker 2 handoff: d:\Paper\.agents\teamwork\worker_m2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own these files exclusively:
- src/features/ai-hub/AiHubView.tsx
- src/features/discover/DiscoverPaperAssistant.tsx
- src/features/discover/discoverSessionStore.ts
- src/test/chat-persistence.test.tsx
- src/test/chat-persistence-adversarial.test.tsx
- src/test/cross-panel-isolation.test.tsx

DEFECTS TO REMEDIATE:
1. `src/features/ai-hub/AiHubView.tsx`:
   - Line ~235: `if (!isCancelled && msgs && msgs.length > 0) { setChatMessages(msgs); }` prevents setting empty array `[]` when switching from a paper with history to a paper with 0 messages, leaving the old paper's messages displayed.
   - Change to `if (!isCancelled && msgs) { setChatMessages(msgs); }`.
   - Also fix the localStorage sync effect (lines ~248-256): when `targetPaperId` changes, the effect was running before `listAiChatMessages` resolved, writing the previous paper's `chatMessages` into the new paper's `localStorage` session key. Ensure that switching `targetPaperId` resets or initializes `chatMessages` properly so that Paper A's messages are never committed to Paper B's localStorage key.
2. `src/features/discover/DiscoverPaperAssistant.tsx`:
   - Line ~353: update hydration check from `msgs.length > 0` to `if (!isCancelled && msgs)`.
   - In lines ~486 and ~553: avoid duplicate insertion of identical message IDs into SQLite when `paper.paper_id && paper.paper_id !== paperIdKey`.
3. Verification:
   - Run: `npx vitest run src/test/chat-persistence-adversarial.test.tsx` (all 12 tests must pass, especially the test verifying switching to an empty paper does NOT leak messages).
   - Run: `npx vitest run src/test/chat-persistence.test.tsx` (all 9 tests must pass).
   - Run: `npx vitest run src/test/cross-panel-isolation.test.tsx` (all 7 tests must pass).
   - Run full regression: `npx vitest run src/test/phase13-pdf-reader.test.tsx src/test/discover-state-and-assistant.test.tsx src/test/ai-workspace.test.tsx src/test/desktop-api.test.ts`.
   - Run: `npx tsc --noEmit` (must exit 0 with 0 errors).

Maintain progress.md in your working directory.
Document all commands and verification results in:
d:\Paper\.agents\teamwork\worker_m2_remediate\handoff.md

When done, message parent (1de78534-cf9b-42f7-9125-c83ea2a3b73f) with a summary and path to handoff.md.
