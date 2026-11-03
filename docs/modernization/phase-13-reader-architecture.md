# Phase 13: PDF Reader Workspace Architecture Report

## 1. Executive Summary

Phase 13 modernizes the embedded reading environment in **Infinity Researcher** from a single canvas viewer into an integrated, multi-panel academic reading workspace. The architecture reconciles deep native desktop capabilities (Tauri 2, Rust IPC, SQLite database WAL mode) with high-performance web standards (`pdfjs-dist` v6, HTML5 Canvas, selectable text overlays, and fluid flex layouts).

The modernized workspace directly serves scholars engaged in intensive literature reviews, experimental analysis, and critical peer review.

---

## 2. Multi-Panel Layout System

The PDF reader workspace is partitioned into three responsive panels and a persistent top navigation bar:

```
+----------------------------------------------------------------------------------------------------+
|  Top Toolbar: Title | Metadata Badges | Nav Pill | Zoom Presets | Find | DOI | Panel Toggles | Focus |
+----------------------+------------------------------------------------------+----------------------+
|  Left Collapsible    |  Center Viewport                                     |  Right Collapsible   |
|  Panel:              |                                                      |  Panel:              |
|  - Outline (TOC)     |  - High-DPI Canvas Rendering                         |  - AI Copilot        |
|  - Page Thumbnails   |  - Transparent Selectable Text Layer                 |  - Metadata & Cite   |
|  - Bookmarks Manager |  - Floating Text Selection Research Actions          |  - SQLite Notes      |
|                      |  - In-Document Search Overlays                       |                      |
+----------------------+------------------------------------------------------+----------------------+
```

### 2.1 Top Workspace Toolbar (`PdfToolbar.tsx`)
- **Document Identity**: Primary paper title, source badge (e.g. arXiv, PubMed, IEEE), venue, publication year, and canonical DOI with one-click copy.
- **Storage & Stream Badges**: Differentiates between permanent offline SQLite documents (`Saved Offline`) and live repository streams (`Remote Stream`).
- **Precision Page Navigation**: Chevron controls, current page indicator, total page count, direct page jumping input with boundary clamping.
- **Zoom & View Presets**: Discrete zoom increments (+/- 15%), direct zoom level selector (`50%`, `75%`, `100%`, `125%`, `150%`, `200%`), and responsive viewport sizing modes (`Fit Width`, `Fit Page`).
- **Orientation & View Toggles**: 90-degree clockwise rotation, search bar toggle (`Ctrl+F`), left navigation panel toggle, right research panel toggle, and distraction-free fullscreen focus mode.

### 2.2 Left Navigation Panel (`PdfLeftPanel.tsx`)
- **Document Outline (TOC)**: Asynchronous extraction of document bookmarks and nested section headings via `pdfDoc.getOutline()`, mapping named destinations to exact page indices.
- **Page Thumbnails Grid**: Fast visual navigation across all pages of the document with highlighted active page indicator.
- **Bookmarks Manager**: User-defined page markers with custom labels (e.g., "Methodology", "Theorem 2 Proof", "Baseline Comparison Table"), persistent across application sessions.

### 2.3 Center Reading Canvas Viewport (`EmbeddedPdfViewer.tsx`)
- **Render Engine**: Utilizes existing `pdfjs-dist` v6 with local Vite-bundled worker (`pdf.worker.min.mjs?url`), avoiding external network runtime requirements.
- **Transparent Selectable Text Layer**: Absolute positioned `<span>` elements matching font size and baseline geometry, enabling native text selection, copy-pasting, and research interactions.
- **Floating Text Selection Toolbar (`TextSelectionMenu.tsx`)**: Appears automatically above mouse selections, providing contextual research actions: Ask AI, Save Note, Find in Document, Copy Plain Text, and Cite Quotation.
- **ResizeObserver Scaling**: Smooth responsive canvas re-rendering on window or panel resizing without tearing or DOM remounts.

### 2.4 Right Research & Synthesis Panel (`PdfRightPanel.tsx`)
- **Grounded AI Copilot**: Context-aware assistant supporting three explicit grounding scopes: Highlighted Text Selection, Current Page Context, or Entire Paper Catalog. Includes quick prompt accelerators (ELI5, Summarize Page, Technical Methodology, Empirical Results, Critical Limitations).
- **Metadata & Citation Engine**: Displays complete bibliographic details and provides one-click copying for formatted APA 7th Edition citations and BibTeX entries.
- **SQLite Persistent Notes**: Reads and writes directly to local SQLite database table `notes`, linking annotations to specific pages and timestamps.

---

## 3. Integration & Modal Adaptability

The workspace supports two distinct presentation contexts:
1. **Discover Center Pane**: Renders within the Discover view with `hideRightPanel={true}` to prevent duplicate side panels and maintain the global 3-pane workflow.
2. **Dedicated Modal / Fullscreen Reader**: Renders the complete multi-panel research environment inside `AppShell` or standalone workspace windows.

