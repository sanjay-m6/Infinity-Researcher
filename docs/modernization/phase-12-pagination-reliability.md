# Phase 12: Pagination Reliability & Session Management

## 1. Overview

In desktop academic research tools, pagination and state management must prevent race conditions, avoid memory leaks, and accommodate heterogeneous source continuation models (offset vs page-based). Phase 12 builds upon the session architecture established in Phase 11 to guarantee bounded memory consumption and stable ordering during progressive loading.

---

## 2. Academic Source Pagination Strategies

Academic repositories utilize distinct pagination paradigms:

| Source ID | Pagination Type | Parameter Names | Max Page Size | Behavior at End of Feed |
| :--- | :--- | :--- | :---: | :--- |
| `arxiv` | Offset-based | `start`, `max_results` | 200 | Returns empty Atom feed `<feed></feed>` when offset $\ge$ total results. |
| `pmc` | Offset-based | `retstart`, `retmax` | 100 | Returns empty XML `<IdList></IdList>` when offset $\ge$ total results. |
| `local_library`| Offset-based | `LIMIT`, `OFFSET` | 500 | SQLite `SELECT` returns empty row vector. |
| `biorxiv` | Page-based | `page` (1-indexed) | 75 | Returns empty HTML container when page exceeds last available results. |
| `medrxiv` | Page-based | `page` (1-indexed) | 75 | Returns empty HTML container when page exceeds last available results. |
| `plos` | Page-based | `page` (1-indexed) | 50 | Returns empty JSON documents array. |
| `nature_srep` | Page-based | `page` (1-indexed) | 50 | Returns empty article list. |
| `ieee_xplore` | Page-based | `pageNumber` | 50 | Returns empty results array. |

---

## 3. Client Progressive Slicing & Bounded Memory

To prevent UI thread degradation and virtual DOM bloat when hundreds of papers stream in:
1. **Bounded Source Requests**:
   - The user selects a bounded fetch limit per source (`limitPerSource`: 15, 25, 50, or 100).
   - This prevents launching unbounded scrapers or exhausting network sockets.
2. **Progressive Visible Slicing**:
   - Retrieved papers are stored in `discoveredResults`.
   - The UI displays `visiblePapers = filteredPapers.slice(0, visibleCount)` (defaulting to 50 items).
   - A dedicated **"Load More Results"** button increments `visibleCount` by 50, providing smooth scrolling without refetching from the network.
3. **Infinite Loop Prevention**:
   - If a source returns zero new papers or a repeated cursor, the scraper marks the source status as `completed` with 0 new records and stops further crawls.

---

## 4. Session Cancellation & Isolation

1. **Stale Event Immunity**:
   - Every search session generates a cryptographic session ID:
     `sessionId = "search_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7)`.
   - Streaming events verify `event.session_id === currentSearchSessionRef.current`.
   - Events from preceding searches are discarded silently without mutating the active state.
2. **Active Stream Cancellation**:
   - When a user submits a new query or clicks "Cancel", `cancelStreamFnRef.current()` is invoked immediately, transmitting an abort signal across Tauri IPC to Rust and Python child processes.
3. **Background Worker Cleanup**:
   - Headless browser contexts and HTTP client connection pools are recycled upon cancellation.

