# Phase 13: PDF Reader Workspace Pre-Implementation Audit & Baseline Analysis

## 1. Executive Summary

As part of **Phase 13 — PDF Reader Workspace Modernization**, a comprehensive audit of Infinity Researcher's embedded PDF viewing infrastructure was conducted. The audit covered the current React viewer (`src/components/pdf-viewer/EmbeddedPdfViewer.tsx`), the underlying rendering engine (`pdfjs-dist`), Tauri 2 IPC commands, SQLite reading progress storage, remote streaming pipelines, AI integration, and user interactions.

Infinity Researcher currently provides an embedded canvas reader with an explicit 12-state finite state machine (FSM). While the base rendering and error handling are robust, several key productivity and research capabilities are missing or incomplete:
- **Missing Document Outline (TOC)**: PDF outline trees (`doc.getOutline()`) are not extracted or surfaced for hierarchical navigation.
- **Placeholder Thumbnails**: The current sidebar displays static page cards (`P. {p}`) rather than visual page previews.
- **No In-Document Bookmarking**: Researchers cannot bookmark key pages (theorems, methodologies, result tables) with custom labels.
- **Disconnected Text Selection**: Selecting text in the transparent text layer lacks contextual research actions (Ask AI, Save Note, In-Document Search, Copy Citation).
- **Separate AI Workspace**: In modal reading mode (`AppShell.tsx`), the AI Assistant and notes are not directly accessible in a docked right panel.
- **Unthrottled Progress Persistence**: Reading progress writes to SQLite on render without debouncing.

---

## 2. Subsystem & Component Audit Matrix

| Subsystem / Module | Path / Location | Technology & Version | Current Role & Audit Findings |
| :--- | :--- | :--- | :--- |
| **Embedded PDF Viewer** | `src/components/pdf-viewer/EmbeddedPdfViewer.tsx` | React 19, TypeScript, Tailwind CSS v4 | Houses 12-state FSM, canvas rendering, text layer, zoom, rotation, and basic search. Needs multi-panel modularization. |
| **PDF Rendering Engine** | `pdfjs-dist` (`^6.4.299`) | Mozilla PDF.js v6 with Vite-bundled worker | Production-grade canvas & text-layer renderer. Fully compatible with Tauri 2 and web preview. **Retain without replacement.** |
| **PDF Worker Configuration** | `pdfjs-dist/build/pdf.worker.min.mjs?url` | Vite URL asset bundling | Clean local worker resolution (`GlobalWorkerOptions.workerSrc`). Avoids external CDN dependencies. |
| **Native Rust IPC Commands** | `src-tauri/src/commands/` | Tauri 2 IPC commands | `read_paper_pdf`, `fetch_remote_pdf_preview`, `save_reader_state`, `get_reader_state`, `get_notes_for_paper`, `save_note`. |
| **SQLite Reader State Repository** | `src-tauri/src/repositories/pdf_workspace_repo.rs` | `rusqlite` SQLite storage | Table `reader_state (paper_id, file_id, last_page, zoom_level, rotation, updated_at)`. Fast indexed lookup. |
| **Local PDF Storage & Cache** | `src-tauri/src/scrapers/` & App data | Local filesystem & SQLite paths | Local PDF binaries resolved from disk; remote open-access PDFs streamed via memory buffers with SHA-256 integrity. |
| **AI Paper Assistant** | `src/features/discover/DiscoverPaperAssistant.tsx` | Local/Remote LLM & RAG chunks | Provides RAG citations, structured insights (ELI5, Methodology, Results), and direct note saving. |
| **Document Search Engine** | `EmbeddedPdfViewer.tsx` (in-viewer) | In-memory text extraction | Scans page `textContent.items` with previous/next match jumping and match counts. |

---

## 3. Analysis of Identified Deficits & Opportunities

### 3.1. Document Outline (Table of Contents) Extraction
- **Deficit**: Academic papers frequently contain hundreds of pages with nested sections (e.g. Abstract, Related Work, Section III Methodology, Experiments, Appendix). Currently, `pdfDoc.getOutline()` is not invoked.
- **Remediation**: Call `pdfDoc.getOutline()` upon document ready. Render a hierarchical outline tree in the left panel. Clicking any section item resolves its destination via `pdfDoc.getDestination()` / `pdfDoc.getPageIndex()` and jumps directly to that page.

### 3.2. Page Bookmarks
- **Deficit**: No mechanism exists for researchers to flag critical pages with descriptive labels (e.g., "Main Theorem Proof", "Hyperparameter Table").
- **Remediation**: Add a persistent Bookmark manager (`PdfBookmark: { id, paperId, pageNumber, label, createdAt }`) stored in `localStorage` or SQLite, allowing one-click page jumps, label editing, and bookmark deletion.

### 3.3. Contextual Text Selection Actions
- **Deficit**: The text layer enables native browser text selection, but does not provide academic research shortcuts.
- **Remediation**: Render a floating contextual menu (`TextSelectionMenu`) on mouse selection containing:
  - **Ask AI**: Pre-fills selected text into the AI assistant with action prompts.
  - **Save Note**: Opens a new note pre-populated with the selected quote and page number.
  - **Search in PDF**: Immediately executes an in-document search for the phrase.
  - **Copy & Cite**: Copies the excerpt formatted with title, author, and page attribution.

### 3.4. Multi-Panel Reading Workspace in Modal & Fullscreen Mode
- **Deficit**: When a paper is opened from the Research Library or Dashboard via `AppShell.tsx`, `EmbeddedPdfViewer` renders without side panels, hiding the AI Assistant, metadata inspector, and notes.
- **Remediation**: Modernize `EmbeddedPdfViewer` into a full 3-panel workspace:
  - **Left Panel (collapsible)**: Outline, Thumbnails, Bookmarks, Annotations.
  - **Center Panel**: Canvas rendering, zoom, search, floating selection actions.
  - **Right Panel (collapsible)**: AI Research Assistant, Paper Metadata with BibTeX/APA citation generators, and SQLite Notes.

### 3.5. Debounced Reading Progress Persistence
- **Deficit**: `saveReaderState` was called directly inside `renderCurrentPage()`. Rapid zooming or page changes triggered excessive IPC commands.
- **Remediation**: Wrap `saveReaderState` in a 500ms debounce timer to ensure efficient, non-blocking persistence.

---

## 4. Architectural Decision: Retaining PDF.js

The audit investigated whether to replace `pdfjs-dist`:
1. **Compatibility**: `pdfjs-dist` is already bundled via Vite worker (`pdf.worker.min.mjs`) and runs cross-platform without native C++ compilation hurdles in Tauri 2.
2. **Text Layer & Search**: It provides full text content itemization, enabling zero-overhead native text selection, search, and page mapping.
3. **Maturity & Stability**: Evaluated alternative engines (e.g., PDFium bindings or webview iframes) and found them either heavier or lacking custom UI integration.
4. **Conclusion**: **Retain `pdfjs-dist` (`^6.4.299`)** and modernize the surrounding workspace components, navigation, and research tools.

