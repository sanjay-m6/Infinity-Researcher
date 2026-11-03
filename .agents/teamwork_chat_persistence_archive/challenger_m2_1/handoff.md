# Handoff Report — Challenger 1 (Milestone 2)

**Agent**: Challenger 1 (`challenger_m2_1`)  
**Parent Agent ID**: `1de78534-cf9b-42f7-9125-c83ea2a3b73f`  
**Milestone**: Milestone 2 (Frontend Chat Persistence Across Panels)  
**Date**: 2026-11-03  
**Verdict**: **REJECT**  
**Working Directory**: `d:\Paper\.agents\teamwork\challenger_m2_1\`  
**Report Path**: `d:\Paper\.agents\teamwork\challenger_m2_1\handoff.md`  

---

## 1. Observation

1. **Baseline Test Execution**:
   - Command: `npx vitest run src/test/chat-persistence.test.tsx`
   - Output: 9 tests passed (100%).

2. **Adversarial Test Suite Execution**:
   - Co-located adversarial test file authored at `src/test/chat-persistence-adversarial.test.tsx` containing 12 stress tests across all 4 assigned failure modes.
   - Command: `npx vitest run src/test/chat-persistence-adversarial.test.tsx`
   - Output: 12 tests passed (100%), confirming empirical reproduction of failure modes and edge cases.
   - Combined Command: `npx vitest run src/test/chat-persistence.test.tsx src/test/chat-persistence-adversarial.test.tsx`
   - Output: 21 tests passed (100%).
   - Full Regression Command: `npx vitest run src/test/chat-persistence.test.tsx src/test/chat-persistence-adversarial.test.tsx src/test/phase13-pdf-reader.test.tsx src/test/discover-state-and-assistant.test.tsx src/test/ai-workspace.test.tsx src/test/desktop-api.test.ts`
   - Output: 6 test files, 50 tests passed (100%).
   - TypeScript Compilation: `npx tsc --noEmit` exited with code 0 and zero errors.

3. **Empirical Defect Observed in AI Hub (`src/features/ai-hub/AiHubView.tsx:228-254`)**:
   Verbatim code in `AiHubView.tsx`:
   ```typescript
   // Load persisted messages from SQLite for current session (with fallback to localStorage)
   useEffect(() => {
     let isCancelled = false;
     const sessionId = targetPaperId ? `ai_hub_${targetPaperId}` : "ai_hub_default";

     listAiChatMessages(sessionId)
       .then((msgs) => {
         if (!isCancelled && msgs && msgs.length > 0) {
           setChatMessages(msgs);
         }
       })
       .catch((e) => {
         console.warn("Failed to load AI Hub messages from SQLite:", e);
       });

     return () => {
       isCancelled = true;
     };
   }, [targetPaperId]);

   useEffect(() => {
     try {
       const sessionId = targetPaperId ? `ai_hub_${targetPaperId}` : "ai_hub_default";
       localStorage.setItem("ai_hub_chat_messages", JSON.stringify(chatMessages));
       localStorage.setItem(`ai_hub_chat_messages_${sessionId}`, JSON.stringify(chatMessages));
     } catch {}
   }, [chatMessages, targetPaperId]);
   ```
   - In `AiHubView.tsx:235`, line reads:
     `if (!isCancelled && msgs && msgs.length > 0) { setChatMessages(msgs); }`
   - When switching `targetPaperId` from a paper with chat history (`paper_alpha`, 1 message) to an un-chatted paper (`paper_beta`, 0 messages), SQLite returns an empty array `[]` (`msgs.length === 0`).
   - Because `msgs.length > 0` evaluates to `false`, `setChatMessages` is **never called**.
   - React state `chatMessages` retains `paper_alpha`'s messages while displaying `paper_beta`.
   - Immediately upon `targetPaperId` changing to `paper_beta`, lines 248-254 execute and write `paper_alpha`'s conversation into `localStorage.setItem("ai_hub_chat_messages_ai_hub_paper_beta", JSON.stringify(chatMessages))`.
   - When the user sends a new message on `paper_beta`, line 554 (`setChatMessages((prev) => [...prev, userMsg])`) appends the new question onto `paper_alpha`'s conversation.
   - Tested empirically in `AiHubView: switching from a paper with history to an empty paper leaks stale messages and pollutes new paper session`:
     - `staleMessageStillPresent` confirmed `true`.
     - `localStorage.getItem("ai_hub_chat_messages_ai_hub_paper_beta")` was verified to contain `"Alpha Question That Should Disappear on Beta"`.

4. **Observation on PDF Viewer Right Panel (`src/components/pdf-viewer/PdfRightPanel.tsx:91-108`)**:
   Verbatim code in `PdfRightPanel.tsx`:
   ```typescript
   useEffect(() => {
     let isCancelled = false;
     const currentSessionId = `pdf_chat_${paperId || "general"}`;

     listAiChatMessages(currentSessionId)
       .then((msgs) => {
         if (!isCancelled && msgs) {
           setChatMessages(msgs);
         }
       })
       .catch((err) => {
         console.warn("Failed to load PDF chat history from SQLite:", err);
       });

     return () => {
       isCancelled = true;
     };
   }, [paperId]);
   ```
   - Line 97 uses `if (!isCancelled && msgs)`. Because `[]` is truthy in JavaScript, `setChatMessages([])` is properly called, correctly resetting the display when switching to an empty paper.
   - Rapid switching with out-of-order promise resolution was verified: resolving a cancelled paper's promise does not overwrite the active paper's messages.
   - Line 411: `disabled={chatMessages.length === 0}` disables the Clear History button when history is empty, preventing redundant IPC delete calls.

5. **Observation on Discover Paper Assistant (`src/features/discover/DiscoverPaperAssistant.tsx:313-316`)**:
   - `currentChatMessages` is derived synchronously from `discoverSessionStore.getState().chatHistoryByPaper[paperIdKey]`.
   - Paper switching isolates messages cleanly across different papers because the store is keyed by `paperIdKey`.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R1 dictates that chat history across all panels must be persisted and loaded cleanly per paper/session without displaying stale cross-talk or corrupting session records.
2. **Premise 2**: In `AiHubView.tsx`, chat messages are stored in local React component state `chatMessages` and synchronized to SQLite via `listAiChatMessages(sessionId)`.
3. **Premise 3**: When a researcher switches from Paper A to Paper B where Paper B has no chat history in SQLite yet, `listAiChatMessages("ai_hub_paper_b")` resolves to `[]`.
4. **Premise 4**: Because line 235 guards state updates with `if (!isCancelled && msgs && msgs.length > 0)`, the empty result (`msgs.length === 0`) is discarded, and `setChatMessages` is bypassed entirely.
5. **Premise 5**: As a consequence, `chatMessages` remains populated with Paper A's conversation. The UI displays Paper A's Q&A under Paper B's header.
6. **Premise 6**: The secondary effect at line 248 triggers on `targetPaperId` change and commits Paper A's messages into Paper B's localStorage session key (`ai_hub_chat_messages_ai_hub_paper_b`). Any subsequent user questions typed in Paper B are concatenated onto Paper A's history.
7. **Conclusion**: This is a confirmed session cross-contamination and data isolation flaw in `AiHubView.tsx`. The implementation must be rejected until line 235 is fixed to correctly set `msgs` even when empty (`if (!isCancelled && msgs)`).

---

## 3. Caveats

1. `PdfRightPanel.tsx` and `DiscoverPaperAssistant.tsx` showed robust resilience across all adversarial stress vectors:
   - Panel unmounting mid-flight does not cause unhandled rejections or runtime crashes.
   - Multiple consecutive clicks on "Clear History" are safely handled (and disabled in `PdfRightPanel`).
   - SQLite query errors (e.g., `SQLITE_BUSY` or IPC failure) are caught with `.catch()`, rendering empty state cards without crashing the UI.
2. In `DiscoverPaperAssistant.tsx:353`, there is also an `if (!isCancelled && msgs && msgs.length > 0)` check. While Discover avoids cross-paper UI leakage due to its keyed store (`session.chatHistoryByPaper[paperIdKey]`), if a session in SQLite is cleared externally, the store will not sync to empty. Addressing this alongside `AiHubView` is recommended.

---

## 4. Conclusion

**Verdict**: **REJECT**

While PDF Viewer and Discover Paper Assistant exhibit solid persistence handling, `AiHubView.tsx` fails the paper switching requirement:
- **Flaw**: Switching to a paper with empty chat history retains the previous paper's conversation in the UI and writes it to the new paper's storage key (`AiHubView.tsx:235`).
- **Remediation Required**: In `src/features/ai-hub/AiHubView.tsx` line 235, change:
  ```typescript
  // Before (Bug):
  if (!isCancelled && msgs && msgs.length > 0) {
    setChatMessages(msgs);
  }

  // After (Fix):
  if (!isCancelled && msgs) {
    setChatMessages(msgs);
  }
  ```
  And on paper change, clear or reset `chatMessages` to ensure immediate UI isolation prior to the SQLite fetch resolving.

---

## 5. Verification Method

To independently reproduce the empirical findings and verify the defect:

1. **Run Adversarial Suite (12 tests)**:
   ```powershell
   npx vitest run src/test/chat-persistence-adversarial.test.tsx
   ```
   *Verified Result*: `AiHubView: switching from a paper with history to an empty paper leaks stale messages and pollutes new paper session` confirms that `staleMessageStillPresent === true` and `betaLocalStorage` contains Alpha's leaked message.

2. **Run Worker 2 Baseline Suite (9 tests)**:
   ```powershell
   npx vitest run src/test/chat-persistence.test.tsx
   ```
   *Verified Result*: All 9 baseline tests pass.

3. **Run TypeScript Compiler**:
   ```powershell
   npx tsc --noEmit
   ```
   *Verified Result*: 0 errors, exit code 0.

4. **Conditions for Validation / Invalidation**:
   - Rejection is valid as long as switching to a paper with `[]` messages in `AiHubView` leaves the prior paper's chat messages on screen.
   - To validate acceptance, Worker 2 must update line 235 of `AiHubView.tsx` so that `listAiChatMessages` returning `[]` clears `chatMessages`, and switching papers does not cross-pollinate localStorage keys.

---

## Adversarial Challenge Report

### Challenge Summary
**Overall Risk Assessment**: **HIGH** (Cross-session chat data pollution in AI Hub).

### Challenges

#### [High] Challenge 1: Stale Session Leakage & LocalStorage Pollution in AI Hub
- **Assumption challenged**: That `useEffect` in `AiHubView.tsx` hydrates the new paper's history correctly without showing stale messages from the previous paper.
- **Attack scenario**: User views Paper Alpha (which has chat messages), then switches the dropdown to Paper Beta (a newly added paper with no chat history).
- **Blast radius**: Paper Alpha's messages remain visible on screen. When lines 248-254 execute, Paper Alpha's messages are written into Paper Beta's localStorage key. Sending a message appends to Paper Alpha's history, permanently corrupting Paper Beta's session.
- **Empirical test**: `src/test/chat-persistence-adversarial.test.tsx` (Test: `AiHubView: switching from a paper with history to an empty paper leaks stale messages and pollutes new paper session`).
- **Mitigation**: Update `AiHubView.tsx:235` from `if (!isCancelled && msgs && msgs.length > 0)` to `if (!isCancelled && msgs)`.

#### [Low] Challenge 2: Redundant IPC Deletions on Repeated Clear Clicks
- **Assumption challenged**: Repeatedly clicking "Clear History" might cause uncaught promise rejections or race conditions.
- **Outcome**: `PdfRightPanel.tsx:411` disables the button when `chatMessages.length === 0`. In `AiHubView.tsx` and `DiscoverPaperAssistant.tsx`, repeated calls are idempotent and error-handled. Survives `SQLITE_BUSY` gracefully without crashing.

#### [Low] Challenge 3: In-flight Component Unmounting
- **Assumption challenged**: Component unmounting before `saveAiChatMessage` finishes might trigger unhandled rejections or memory leaks.
- **Outcome**: Handled gracefully. Background promises resolve without uncaught errors in React 18.

### Stress Test Results Table

| Scenario | Target Surface | Expected Behavior | Actual Empirical Behavior | Status |
|---|---|---|---|---|
| Unmount mid-flight | `PdfRightPanel` | No crash, promise finishes | Completed cleanly without unhandled rejection | PASS |
| Unmount mid-flight | `AiHubView` | No crash, promise finishes | Completed cleanly without unhandled rejection | PASS |
| Unmount mid-flight | `DiscoverPaperAssistant` | Store & SQLite updated | Message preserved in store & SQLite called | PASS |
| Out-of-order paper fetch | `PdfRightPanel` | Stale fetch discarded | Cancelled fetch ignored; active paper displayed | PASS |
| Switch to empty paper | `PdfRightPanel` | Clears to empty state | Empty state displayed immediately on resolve | PASS |
| Switch to empty paper | `DiscoverPaperAssistant` | Isolates paper history | Separate paper store queried, clean state | PASS |
| Switch to empty paper | `AiHubView` | Clears to empty state | **Retains previous paper's messages & pollutes storage** | **FAIL (BUG)** |
| Multiple clears (rapid) | `PdfRightPanel` | Idempotent, no crash | Clear button disabled after click 1, no duplicate IPC | PASS |
| SQLite error on clear | `PdfRightPanel` | Graceful error catch | Error caught with `console.warn`, UI intact | PASS |
| Multiple clears (rapid) | `AiHubView` | Idempotent, no crash | Handled cleanly, UI clears to empty state | PASS |
| Empty history init (`[]`) | All 3 panels | Render empty state | All 3 panels render respective empty state cards | PASS |
| SQLite query error on mount| `PdfRightPanel` | Graceful error catch | Error caught, empty state rendered without crash | PASS |

### Unchallenged Areas
- Backend SQLite migrations and foreign key cascades (thoroughly tested in Milestone 1 and `cargo test chat_persistence_tests`).
