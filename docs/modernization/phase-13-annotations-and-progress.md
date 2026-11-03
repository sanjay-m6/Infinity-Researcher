# Phase 13: Annotations, Reading Progress & Persistence Architecture

## 1. Executive Summary

Scholarly workflows require durable persistence so researchers can resume literature reviews across desktop restarts without losing their place, bookmarks, or annotations. Phase 13 implements two layers of persistence:
1. Native Rust SQLite persistence for reading position and research notes.
2. Structured local storage for custom document bookmarks.

---

## 2. Debounced Reading Position Persistence

### 2.1 SQLite Schema & Rust Data Layer
The native backend stores reading position in the `reader_state` table:
```sql
CREATE TABLE IF NOT EXISTS reader_state (
    paper_id TEXT PRIMARY KEY,
    file_id TEXT,
    last_page INTEGER NOT NULL,
    zoom_level REAL NOT NULL,
    rotation INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
```

### 2.2 Debounce Optimization
Previously, `saveReaderState` was invoked synchronously on every page render and zoom step. In Phase 13, writes are debounced by 500ms using a timer ref:
```typescript
const persistReaderPosition = useCallback(
  (page: number, scale: number, rot: number) => {
    if (!paperId || remotePdfUrl) return;
    if (saveReaderStateTimeoutRef.current) {
      clearTimeout(saveReaderStateTimeoutRef.current);
    }
    saveReaderStateTimeoutRef.current = setTimeout(async () => {
      try {
        await saveReaderState({
          paper_id: paperId,
          file_id: null,
          last_page: page,
          zoom_level: scale,
          rotation: rot,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // non-blocking
      }
    }, 500);
  },
  [paperId, remotePdfUrl]
);
```
This guarantees that rapid page scrubbing (e.g. flipping through 30 pages) results in a single, clean database write.

---

## 3. Persistent SQLite Research Notes

The Notes tab in `PdfRightPanel.tsx` is tied directly to the SQLite `notes` repository (`getNotesForPaper`, `saveNote`, `deleteNote`):
- **Page Association**: Notes created from the reader default to "Attach to Page X", tagging the note title with `Page ${currentPage}`.
- **Interactive Jumps**: Note cards render an interactive `[P. X]` button. Clicking the button jumps the reader directly to the cited page.
- **Instant Deletion**: Notes can be deleted with instant UI synchronization.

---

## 4. Bookmarks Management

Bookmarks created in `PdfLeftPanel.tsx` allow scholars to tag noteworthy theorems, figures, or tables:
- **Custom Labels**: Users can assign meaningful titles (e.g., "Theorem 4.1 Proof", "Ablation Study Table 3").
- **Persistence**: Saved under key `pdf_bookmarks_${paperId || paperTitle}`.
- **One-Click Navigation**: Clicking any bookmark jumps directly to the bookmarked page.

