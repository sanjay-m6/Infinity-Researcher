# Phase 13: Navigation and In-Document Search Architecture

## 1. Overview

Effective academic reading demands rapid traversal across lengthy treatises, conference papers, and supplemental appendices. Phase 13 introduces a multi-tiered navigation and full-text search subsystem.

---

## 2. Navigation Subsystems

### 2.1 Table of Contents & Outline Resolution (`PdfLeftPanel.tsx`)
Document outlines are extracted through `pdfDoc.getOutline()`. Because PDF outlines often reference internal named destinations rather than explicit page indices, the reader incorporates an asynchronous destination resolver:
1. If destination is a named string (e.g. `section.3`), invokes `doc.getDestination(dest)`.
2. Resolves destination reference `[ref, { name: 'XYZ' }, ...]` to exact 0-indexed page index via `doc.getPageIndex(ref)`.
3. Maps to human-readable 1-indexed page number.
4. Recursively processes child items to preserve section hierarchies.

### 2.2 Direct Page Input with Boundary Clamping
The page navigation form in `PdfToolbar.tsx` provides:
- Single-click previous (`ChevronLeft`) and next (`ChevronRight`) navigation.
- Boundary clamping: Prevents navigation below page 1 or beyond total page count.
- Direct input box with blur fallback to current page on invalid or non-numeric input.

### 2.3 Keyboard Accelerators
- `ArrowLeft` / `PageUp`: Navigate to previous page.
- `ArrowRight` / `PageDown`: Navigate to next page.
- `+` / `=`: Zoom in (+15%).
- `-`: Zoom out (-15%).
- `r` / `R`: Rotate clockwise (90 degrees).
- `Ctrl+F` / `Cmd+F`: Toggle in-document text search bar.
- `Escape`: Close search bar, dismiss selection menu, or exit fullscreen focus mode.

---

## 3. In-Document Full-Text Search Engine

The in-document search feature enables researchers to locate specific equations, keywords, author references, and statistical findings across the entire paper:

1. **Document-Wide Text Crawl**: Asynchronously scans each page's text items via `page.getTextContent()`.
2. **Match Indexing**: Aggregates all matches into an indexed array `SearchMatch[]` containing `pageNumber` and occurrence index.
3. **Interactive Navigation**:
   - Live match counter: Displays `Current Match of Total Matches` (e.g. `2 of 8`).
   - `Next Match` / `Previous Match` buttons cycle through occurrences.
   - Automatically navigates to the matching page canvas when moving between matches.
4. **Instant Query Population**: Highlighting text in the document and selecting "Find in Doc" from the floating toolbar immediately populates the search bar and runs the search query.

