# R1 Architectural Survey: Chat Data and History Persistence Across Panels

**Date**: 2026-11-03  
**Explorer**: Explorer 1 (Chat Persistence Explorer)  
**Assigned Directory**: `d:\Paper\.agents\teamwork\explorer_survey_1\`  
**Target Objective**: Map out the full architecture, current state, gaps, and required changes for Requirement R1 (*Chat Data and History Persistence Across Panels*).

---

## 1. Executive Summary

Requirement R1 mandates that chat messages and conversation history be persisted across all three chat surfaces in the application (**AI Hub**, **PDF Viewer Right Panel**, and **Discover Paper Assistant**) across sessions using the existing SQLite database storage infrastructure (`ai_chat_sessions` and `ai_chat_messages` tables, backend repository methods, and frontend desktop APIs).

### Critical Findings at a Glance
1. **The Backend Foreign Key Trap**: The database migration (`0007_ai_workspace_and_knowledge.sql`) created `ai_chat_sessions` and `ai_chat_messages`, where `ai_chat_messages.session_id` has a strict `REFERENCES ai_chat_sessions(id) ON DELETE CASCADE`. SQLite enforces `PRAGMA foreign_keys = ON;`. However, **no repository methods or commands exist to create or manage `ai_chat_sessions`**. Calling `save_ai_chat_message` with any arbitrary session ID will immediately fail with `FOREIGN KEY constraint failed`.
2. **Unimported Paper Foreign Key Trap**: Both tables have `paper_id REFERENCES papers(id) ON DELETE SET NULL`. In the Discover Paper Assistant, users chat about unimported search results (`paper.id` is an arXiv ID or external ID not in `papers`). Passing this `paper_id` directly to SQLite causes another `FOREIGN KEY constraint failed`.
3. **Frontend Storage Disconnect**: None of the three chat panels currently persist messages to SQLite:
   - **AI Hub** (`AiHubView.tsx`): Saves messages to `localStorage` (`ai_hub_chat_messages`) using a hardcoded dummy session ID `"default_session"`. It never invokes backend persistence commands.
   - **PDF Viewer Right Panel** (`PdfRightPanel.tsx`): Stores messages strictly in an in-memory React state (`useState<ChatMsg[]>([])`). When switching papers, changing tabs, or restarting the app, all history is completely wiped. No "Clear History" button even exists.
   - **Discover Paper Assistant** (`DiscoverPaperAssistant.tsx`): Manages messages via an in-memory store (`discoverSessionStore.ts`) that dumps JSON into `localStorage` (`paper_desktop_discover_session_v1`). Clearing the chat only clears `localStorage`.
4. **Missing Session Abstraction**: While `AiChatMessage` exists in both backend and frontend, `AiChatSession` does not exist as a domain model or TypeScript interface, and no Tauri commands exist for listing or deleting chat sessions.

---

## 2. Backend SQLite Storage Infrastructure (`src-tauri`)

### 2.1 Database Setup & Connection Configuration
In `src-tauri/src/database/mod.rs` (lines 88–92) and `migrations.rs` (line 297), SQLite foreign keys are explicitly enforced:
```rust
conn.execute_batch(
    "PRAGMA foreign_keys = ON;
     PRAGMA journal_mode = WAL;
     PRAGMA synchronous = NORMAL;
     PRAGMA busy_timeout = 5000;"
)?;
```
`PRAGMA foreign_keys = ON;` is tested and verified in test suites. Any insertion into child tables without corresponding parent records or with invalid foreign key IDs will fail immediately.

### 2.2 Table Schemas & Migrations
The chat schema was introduced in `src-tauri/migrations/0007_ai_workspace_and_knowledge.sql` (lines 92–116):

```sql
-- 5. AI Research Chat Sessions and Messages
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
    role TEXT NOT NULL,                      -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations_json TEXT,                     -- JSON array of cited {paper_id, title, page_number, section_heading, quote}
    provider_id TEXT,
    model_id TEXT,
    retrieval_mode TEXT NOT NULL DEFAULT 'paper', -- 'paper', 'library', 'none'
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_paper ON ai_chat_messages(paper_id);
```

#### Key Schema Characteristics
- `ai_chat_sessions.id`: String primary key (e.g. `ai_hub_global`, `pdf_paper_123`, `discover_2401.12345`).
- `ai_chat_sessions.paper_id`: Optional foreign key to `papers(id)`. When a paper is deleted, `ON DELETE SET NULL` keeps the session.
- `ai_chat_messages.session_id`: Non-null foreign key to `ai_chat_sessions(id)`. When the session is deleted, `ON DELETE CASCADE` automatically removes all associated messages.
- `ai_chat_messages.citations_json`: Text column storing serialized JSON array of citations (`AiChunkCitation`).
- `ai_chat_messages.retrieval_mode`: Default `'paper'` (allowed: `'paper'`, `'library'`, `'none'`).

### 2.3 Backend Domain Models (`src-tauri/src/domain/ai.rs`)
In `src-tauri/src/domain/ai.rs` (lines 89–101):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatMessage {
    pub id: String,
    pub session_id: String,
    pub paper_id: Option<String>,
    pub role: String, // 'user', 'assistant', 'system'
    pub content: String,
    pub citations: Vec<AiChunkCitation>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub retrieval_mode: String,
    pub created_at: String,
}
```
**GAP**: There is **no `AiChatSession` struct** in `src-tauri/src/domain/ai.rs`.

### 2.4 Existing Repository Methods (`src-tauri/src/repositories/ai_repo.rs`)
Located at lines 850–904:
```rust
// -------------------------------------------------------------------------
// Chat Sessions & Messages
// -------------------------------------------------------------------------

pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<AiChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, paper_id, role, content, citations_json, provider_id, model_id, retrieval_mode, created_at
         FROM ai_chat_messages
         WHERE session_id = ?1
         ORDER BY created_at ASC"
    )?;

    let rows = stmt.query_map(params![session_id], |row| {
        let cits_json: String = row.get(5).unwrap_or_else(|_| "[]".to_string());
        let citations: Vec<AiChunkCitation> =
            serde_json::from_str(&cits_json).unwrap_or_default();
        Ok(AiChatMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            paper_id: row.get(2)?,
            role: row.get(3)?,
            content: row.get(4)?,
            citations,
            provider_id: row.get(6)?,
            model_id: row.get(7)?,
            retrieval_mode: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?;

    let mut msgs = Vec::new();
    for r in rows {
        msgs.push(r?);
    }
    Ok(msgs)
}

pub fn save_message(conn: &Connection, msg: &AiChatMessage) -> Result<()> {
    let cits_json = serde_json::to_string(&msg.citations).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO ai_chat_messages (
            id, session_id, paper_id, role, content, citations_json, provider_id, model_id, retrieval_mode, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))",
        params![
            msg.id, msg.session_id, msg.paper_id, msg.role, msg.content,
            cits_json, msg.provider_id, msg.model_id, msg.retrieval_mode
        ],
    )?;
    Ok(())
}

pub fn clear_session_messages(conn: &Connection, session_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM ai_chat_messages WHERE session_id = ?1",
        params![session_id],
    )?;
    Ok(())
}
```

### 2.5 Critical Deficiencies in Backend Repository
1. **Foreign Key Failure on `session_id`**: If a message is inserted with `session_id = "default_session"` or `session_id = "pdf_123"`, SQLite throws `SqliteFailure(..., "FOREIGN KEY constraint failed")` because no corresponding row exists in `ai_chat_sessions`.
2. **Foreign Key Failure on unimported `paper_id`**: In `save_message`, if `msg.paper_id` contains an ID not present in `papers`, SQLite throws `FOREIGN KEY constraint failed`. The repository must sanitize `paper_id`: verify whether the paper ID exists in `papers(id)`; if not, bind `None` (`NULL`).
3. **Missing Session Upsert**: When saving a message, the repository should ensure the parent session exists (or create it with an auto-generated title and updated timestamp).
4. **Missing Session Operations**:
   - `create_or_ensure_session(conn, session_id, paper_id, title)`
   - `list_sessions(conn, paper_id)`
   - `get_session(conn, session_id)`
   - `delete_session(conn, session_id)`

### 2.6 Existing vs. Missing Tauri Command Handlers (`src-tauri/src/commands/ai.rs` & `lib.rs`)
Existing commands (lines 382–410 in `src-tauri/src/commands/ai.rs`):
- `list_ai_chat_messages(state, session_id: String) -> Result<Vec<AiChatMessage>, CommandError>`
- `save_ai_chat_message(state, message: AiChatMessage) -> Result<(), CommandError>`
- `clear_ai_chat_session(state, session_id: String) -> Result<(), CommandError>`

Missing commands:
- `create_ai_chat_session(state, session: AiChatSession) -> Result<(), CommandError>`
- `list_ai_chat_sessions(state, paper_id: Option<String>) -> Result<Vec<AiChatSession>, CommandError>`
- `delete_ai_chat_session(state, session_id: String) -> Result<(), CommandError>`

---

## 3. Frontend Desktop API Bridge (`src/lib/desktop-api/`)

### 3.1 Existing IPC Wrappers (`src/lib/desktop-api/index.ts`)
Lines 1750–1763:
```typescript
export async function listAiChatMessages(sessionId: string): Promise<AiChatMessage[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiChatMessage[]>("list_ai_chat_messages", { sessionId });
}

export async function saveAiChatMessage(message: AiChatMessage): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("save_ai_chat_message", { message });
}

export async function clearAiChatSession(sessionId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("clear_ai_chat_session", { sessionId });
}
```

### 3.2 Existing TypeScript Interfaces (`src/lib/desktop-api/types.ts`)
Lines 1248–1259:
```typescript
export interface AiChatMessage {
  id: string;
  session_id: string;
  paper_id?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  citations: AiChunkCitation[];
  provider_id?: string | null;
  model_id?: string | null;
  retrieval_mode: string;
  created_at: string;
}
```

### 3.3 Missing Bridge Functions & Types
1. **Missing interface `AiChatSession`**:
   ```typescript
   export interface AiChatSession {
     id: string;
     paper_id?: string | null;
     title: string;
     created_at: string;
     updated_at: string;
   }
   ```
2. **Missing bridge functions in `index.ts`**:
   - `listAiChatSessions(paperId?: string): Promise<AiChatSession[]>`
   - `createAiChatSession(session: AiChatSession): Promise<void>`
   - `deleteAiChatSession(sessionId: string): Promise<void>`
3. **Web / Mock Environment Fallback**:
   In non-Tauri environments (like Vitest jsdom), `listAiChatMessages` returns `[]` and `saveAiChatMessage` returns immediately. To support offline or test scenarios without mocking, a localStorage-backed mock cache or clean stubbing is appropriate.

---

## 4. Detailed Investigation of the Three Chat Surfaces

### 4.1 Panel 1: AI Hub (`src/features/ai-hub/AiHubView.tsx`)

#### Current Architecture
- Tab identifier: `"chat"` ("Reading Assistant & Grounded Research Chat").
- File location: `src/features/ai-hub/AiHubView.tsx` (lines 189–204, 513–581, 1602–1611).
- State initialization:
  ```typescript
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("ai_hub_chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ai_hub_chat_messages", JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages]);
  ```
- Session ID: Hardcoded as `"default_session"` in `userMsg`, `assistantMsg`, and `errorMsg`:
  ```typescript
  const userMsg: AiChatMessage = {
    id: createAiHubMsgId("usr"),
    session_id: "default_session",
    paper_id: targetPaperId || null,
    role: "user",
    content: promptToSend,
    citations: [],
    retrieval_mode: activeRagScope,
    created_at: new Date().toISOString(),
  };
  ```
- Generation Flow:
  - Appends `userMsg` to React state.
  - Calls `generateAiResponse(...)`.
  - Appends `assistantMsg` or `errorMsg` to React state.
  - Synchronizes to `localStorage.setItem("ai_hub_chat_messages", ...)`.
  - **Zero calls to `saveAiChatMessage` or `listAiChatMessages`**.
- Clear Action (lines 1602–1611):
  ```typescript
  <button
    onClick={() => {
      setChatMessages([]);
      localStorage.removeItem("ai_hub_chat_messages");
    }}
  >
    <RotateCcw className="w-3.5 h-3.5" /> Clear History
  </button>
  ```
  - **Zero calls to `clearAiChatSession`**.

#### Lifecycle Analysis
| Event | Current Behavior | Required R1 Behavior |
|---|---|---|
| **Panel Opened / App Restart** | Loads from `localStorage.getItem("ai_hub_chat_messages")`. If cleared or empty, starts blank. | Calls `listAiChatMessages(sessionId)`. Loads persisted SQLite history. |
| **Paper Changed (`targetPaperId`)** | Messages stay unchanged (or mix papers under `"default_session"`). | Switches active session ID (e.g. `ai_hub_${targetPaperId || "general"}`) and loads that paper's chat history. |
| **Message Sent / Received** | Serializes whole array to `localStorage`. | Calls `saveAiChatMessage(userMsg)` and `saveAiChatMessage(assistantMsg)` to write to SQLite. |
| **Clear History Clicked** | Clears React state and deletes `localStorage` key. | Calls `clearAiChatSession(sessionId)`, deletes records from SQLite, resets UI. |

---

### 4.2 Panel 2: PDF Viewer Right Panel (`src/components/pdf-viewer/PdfRightPanel.tsx`)

#### Current Architecture
- Tab identifier: `"ai"` ("AI Copilot").
- File location: `src/components/pdf-viewer/PdfRightPanel.tsx` (lines 45–57, 80–156, 470–513).
- Data type: Uses a local private interface `ChatMsg`:
  ```typescript
  interface ChatMsg {
    id: string;
    role: "user" | "assistant";
    content: string;
    page?: number;
    timestamp: string;
  }
  ```
- State initialization:
  ```typescript
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  ```
- Persistence: **COMPLETELY NON-EXISTENT**. No `localStorage`, no SQLite database.
- Generation Flow:
  - Appends local `ChatMsg` to `chatMessages`.
  - Calls `generateAiResponse(...)`.
  - Appends assistant `ChatMsg` or fallback to `chatMessages`.
  - **Never persists anything**.
- Clear Action: **There is NO clear history button anywhere in `PdfRightPanel.tsx`**.

#### Lifecycle Analysis
| Event | Current Behavior | Required R1 Behavior |
|---|---|---|
| **Panel Opened / App Restart** | Initializes to empty array `[]`. All prior chat lost. | Derives session ID `pdf_chat_${paperId}`. Calls `listAiChatMessages(sessionId)` and populates history. |
| **Paper Changed (`paperId`)** | Component re-mounts or props change; chat resets to `[]`. | Re-fetches history for the new `paperId` from SQLite. |
| **Message Sent / Received** | Added only to transient React state. | Converts to/uses `AiChatMessage` and calls `saveAiChatMessage`. Persists to SQLite with page citation info. |
| **Clear History** | Not available. | Provide a "Clear History" button that invokes `clearAiChatSession(sessionId)` and resets state. |

---

### 4.3 Panel 3: Discover Paper Assistant (`src/features/discover/DiscoverPaperAssistant.tsx`)

#### Current Architecture
- Tab identifier: `"chat"` (versus `"insights"`).
- File location: `src/features/discover/DiscoverPaperAssistant.tsx` (lines 309–318, 434–579) and `src/features/discover/discoverSessionStore.ts`.
- State Store:
  `discoverSessionStore` holds `chatHistoryByPaper: Record<string, AiChatMessage[]>`.
  Persisted to `localStorage.setItem("paper_desktop_discover_session_v1", ...)` on any mutation.
- Session ID construction:
  ```typescript
  session_id: `discover_${paperIdKey}`
  ```
  where `paperIdKey = paper.id`.
- Duplicate insertion bug:
  Lines 452–455 and 528–531:
  ```typescript
  discoverSessionStore.addChatMessage(paperIdKey, userMsg);
  if (paper.paper_id && paper.paper_id !== paperIdKey) {
    discoverSessionStore.addChatMessage(paper.paper_id, userMsg);
  }
  ```
  If `paper.paper_id` exists, messages are duplicated under two keys in `chatHistoryByPaper`.
- Clear Action (lines 576–579):
  ```typescript
  const handleClearChat = () => {
    discoverSessionStore.clearChat(paperIdKey);
    showToast("Chat history cleared for this paper.", "info");
  };
  ```
  Only removes `chatHistoryByPaper[paperIdKey]` from `discoverSessionStore` and `localStorage`.
  Does NOT delete from `paper.paper_id` (leaving orphaned duplicates).
  Does NOT call `clearAiChatSession`.

#### Lifecycle Analysis
| Event | Current Behavior | Required R1 Behavior |
|---|---|---|
| **Panel Opened / App Restart** | Reads from `localStorage` store. If cleared or fresh app install, empty. | Calls `listAiChatMessages("discover_" + paperId)`. Populates store & view from SQLite. |
| **Paper Selected in Discover** | Shows messages cached in memory store for that `paper.id`. | Queries SQLite for `session_id = "discover_" + paper.id` (or canonical `paper.paper_id`). |
| **Message Sent / Received** | Saves to in-memory store and `localStorage`. | Calls `saveAiChatMessage` to insert into `ai_chat_messages`. |
| **Clear Chat Clicked** | Deletes `chatHistoryByPaper[paperIdKey]` in memory store. | Calls `clearAiChatSession(sessionId)`, cleans store cleanly without orphans. |

---

## 5. Architectural Gap Analysis Matrix

| Dimension | AI Hub | PDF Viewer Right Panel | Discover Paper Assistant | Backend (`src-tauri`) |
|---|---|---|---|---|
| **Current Storage Mechanism** | `localStorage` (`ai_hub_chat_messages`) | In-memory React `useState` | `localStorage` (`paper_desktop_discover_session_v1`) | SQLite `ai_chat_messages` (unused) |
| **Session ID Scheme** | Static `"default_session"` | None | Dynamic `discover_${paper.id}` | Requires matching row in `ai_chat_sessions` |
| **Session Model in DB** | Missing | Missing | Missing | Missing struct & CRUD |
| **Initial Loading** | `localStorage.getItem` | Empty `[]` | Store in-memory / `localStorage` | `list_ai_chat_messages` implemented |
| **Message Persistence** | `localStorage.setItem` | None | Store in-memory / `localStorage` | `save_ai_chat_message` implemented (fails FK) |
| **Clear Action** | `localStorage.removeItem` | None | Store `clearChat` | `clear_ai_chat_session` implemented |
| **Foreign Key Enforcement** | N/A | N/A | N/A | Fails FK if session missing or unimported `paper_id` |
| **Data Loss on Restart?** | No (localStorage), but no DB sync | **YES** (100% loss) | No (localStorage), but no DB sync | N/A |

---

## 6. Concrete Implementation Recommendations

To fulfill Requirement R1 cleanly, robustly, and with zero test regressions, the implementation must follow these concrete architectural steps:

### Phase A: Backend Infrastructure (`src-tauri`)

1. **Domain Struct `AiChatSession` (`src-tauri/src/domain/ai.rs`)**:
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

2. **Repository Enhancements (`src-tauri/src/repositories/ai_repo.rs`)**:
   - **`ensure_session_exists`**:
     ```rust
     pub fn ensure_session_exists(
         conn: &Connection,
         session_id: &str,
         paper_id: Option<&str>,
         title: Option<&str>,
     ) -> Result<()> {
         // Verify paper_id exists in papers table to avoid FK error
         let valid_paper_id = if let Some(pid) = paper_id {
             let exists: bool = conn
                 .query_row(
                     "SELECT 1 FROM papers WHERE id = ?1",
                     params![pid],
                     |_| Ok(true),
                 )
                 .unwrap_or(false);
             if exists { Some(pid) } else { None }
         } else {
             None
         };

         let title_str = title.unwrap_or("Research Chat Session");
         conn.execute(
             "INSERT INTO ai_chat_sessions (id, paper_id, title, created_at, updated_at)
              VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
              ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now')",
             params![session_id, valid_paper_id, title_str],
         )?;
         Ok(())
     }
     ```
   - **`save_message` Update**:
     Before inserting into `ai_chat_messages`:
     1. Call `ensure_session_exists(conn, &msg.session_id, msg.paper_id.as_deref(), None)`.
     2. Validate `msg.paper_id` against `papers` table; if not found, insert `NULL` for `paper_id`.
     3. Insert message into `ai_chat_messages`.
   - **Session CRUD**:
     - `list_sessions(conn: &Connection, paper_id: Option<&str>) -> Result<Vec<AiChatSession>>`
     - `get_session(conn: &Connection, session_id: &str) -> Result<Option<AiChatSession>>`
     - `delete_session(conn: &Connection, session_id: &str) -> Result<()>` (Cascades to messages).
     - `clear_session_messages(conn: &Connection, session_id: &str) -> Result<()>` (Deletes messages, keeps session).

3. **Tauri Command Handlers (`src-tauri/src/commands/ai.rs` & `src-tauri/src/lib.rs`)**:
   - Add commands:
     - `list_ai_chat_sessions(state, paper_id: Option<String>) -> Result<Vec<AiChatSession>, CommandError>`
     - `create_ai_chat_session(state, session: AiChatSession) -> Result<(), CommandError>`
     - `delete_ai_chat_session(state, session_id: String) -> Result<(), CommandError>`
   - Register commands in `src-tauri/src/lib.rs` inside `tauri::generate_handler![...]`.

### Phase B: Frontend Desktop API Bridge (`src/lib/desktop-api/`)

1. **Types (`types.ts`)**:
   Export interface `AiChatSession`:
   ```typescript
   export interface AiChatSession {
     id: string;
     paper_id?: string | null;
     title: string;
     created_at: string;
     updated_at: string;
   }
   ```
2. **Bridge Methods (`index.ts`)**:
   ```typescript
   export async function listAiChatSessions(paperId?: string): Promise<AiChatSession[]> {
     if (!isTauriEnvironment()) return [];
     return invokeCommand<AiChatSession[]>("list_ai_chat_sessions", { paperId: paperId || null });
   }

   export async function createAiChatSession(session: AiChatSession): Promise<void> {
     if (!isTauriEnvironment()) return;
     return invokeCommand<void>("create_ai_chat_session", { session });
   }

   export async function deleteAiChatSession(sessionId: string): Promise<void> {
     if (!isTauriEnvironment()) return;
     return invokeCommand<void>("delete_ai_chat_session", { sessionId });
   }
   ```

### Phase C: AI Hub Integration (`src/features/ai-hub/AiHubView.tsx`)

1. **Session Keying**:
   Derive session ID based on active paper or general hub:
   `const activeSessionId = targetPaperId ? `ai_hub_${targetPaperId}` : "ai_hub_general";`
2. **Load on Mount & Paper Change**:
   Add `useEffect` when `activeSessionId` changes:
   ```typescript
   useEffect(() => {
     let isMounted = true;
     async function loadHistory() {
       try {
         const dbMsgs = await listAiChatMessages(activeSessionId);
         if (isMounted) {
           if (dbMsgs && dbMsgs.length > 0) {
             setChatMessages(dbMsgs);
           } else {
             // Fallback to localStorage if any
             const saved = localStorage.getItem(`ai_hub_chat_${activeSessionId}`);
             setChatMessages(saved ? JSON.parse(saved) : []);
           }
         }
       } catch {
         // Keep fallback
       }
     }
     loadHistory();
     return () => { isMounted = false; };
   }, [activeSessionId]);
   ```
3. **Persist Messages**:
   When user sends message:
   `void saveAiChatMessage(userMsg);`
   When assistant returns:
   `void saveAiChatMessage(assistantMsg);`
4. **Clear Action**:
   ```typescript
   await clearAiChatSession(activeSessionId);
   setChatMessages([]);
   localStorage.removeItem(`ai_hub_chat_${activeSessionId}`);
   ```

### Phase D: PDF Viewer Right Panel Integration (`src/components/pdf-viewer/PdfRightPanel.tsx`)

1. **Standardize Message Model**:
   Replace local `ChatMsg` with `AiChatMessage` from `../../lib/desktop-api`.
2. **Session Keying**:
   `const sessionId = `pdf_chat_${paperId || "anonymous"}`;`
3. **Load History on Mount & Paper Switch**:
   ```typescript
   useEffect(() => {
     let isMounted = true;
     async function loadHistory() {
       if (!paperId) return;
       try {
         const msgs = await listAiChatMessages(sessionId);
         if (isMounted && msgs) setChatMessages(msgs);
       } catch (err) {
         console.warn("Failed to load PDF chat history:", err);
       }
     }
     void loadHistory();
     return () => { isMounted = false; };
   }, [sessionId, paperId]);
   ```
4. **Save Messages**:
   In `handleSendAi`:
   - Construct `userMsg: AiChatMessage` with `session_id: sessionId`, `paper_id: paperId`.
   - Call `void saveAiChatMessage(userMsg)`.
   - On response, construct `assistantMsg: AiChatMessage` and call `void saveAiChatMessage(assistantMsg)`.
5. **Add Clear History Button**:
   Add a button in the AI copilot header:
   ```typescript
   const handleClearHistory = async () => {
     try {
       await clearAiChatSession(sessionId);
       setChatMessages([]);
     } catch (err) {
       console.error("Failed to clear PDF chat session:", err);
     }
   };
   ```

### Phase E: Discover Paper Assistant Integration (`DiscoverPaperAssistant.tsx` & `discoverSessionStore.ts`)

1. **Session Keying**:
   Session ID is already `discover_${paperIdKey}` where `paperIdKey = paper.id`.
2. **Load History on Mount / Paper Change**:
   In `DiscoverPaperAssistant.tsx`:
   ```typescript
   useEffect(() => {
     let isMounted = true;
     const sessionId = `discover_${paperIdKey}`;
     async function loadFromDb() {
       try {
         const dbMsgs = await listAiChatMessages(sessionId);
         if (isMounted && dbMsgs && dbMsgs.length > 0) {
           discoverSessionStore.setChatMessages(paperIdKey, dbMsgs);
         }
       } catch (e) {
         console.warn("Failed to load discover chat from DB:", e);
       }
     }
     void loadFromDb();
     return () => { isMounted = false; };
   }, [paperIdKey]);
   ```
3. **Save Messages**:
   When user sends message:
   `void saveAiChatMessage(userMsg);`
   When assistant responds or returns greeting:
   `void saveAiChatMessage(assistantMsg);`
4. **Clear Action**:
   In `handleClearChat`:
   ```typescript
   const handleClearChat = async () => {
     const sessionId = `discover_${paperIdKey}`;
     try {
       await clearAiChatSession(sessionId);
     } catch (e) {
       console.warn("Failed to clear chat session in DB:", e);
     }
     discoverSessionStore.clearChat(paperIdKey);
     if (paper.paper_id) discoverSessionStore.clearChat(paper.paper_id);
     showToast("Chat history cleared for this paper.", "info");
   };
   ```

### Phase F: Automated Testing & Quality Gates

1. **Backend Tests (`src-tauri/tests/chat_persistence_tests.rs`)**:
   - Test session creation and listing.
   - Test `save_message` auto-ensures session when not yet existing.
   - Test `save_message` with unimported paper ID does not trigger foreign key violation.
   - Test `list_messages` retrieves messages in chronological order with intact citations JSON.
   - Test `clear_session_messages` deletes only messages for the targeted session.
   - Test `delete_session` cascades deletion to messages.
2. **Frontend Tests (`src/test/chat-persistence.test.tsx`)**:
   - Test AI Hub loads persisted messages via `listAiChatMessages` and saves new messages via `saveAiChatMessage`.
   - Test PDF Right Panel loads history for the active `paperId` and provides a working Clear History control.
   - Test Discover Paper Assistant loads history from SQLite and syncs with `discoverSessionStore`.
   - Verify existing test suites (`phase13-pdf-reader.test.tsx`, `discover-state-and-assistant.test.tsx`, `ai-workspace.test.tsx`) continue to pass without regressions.
