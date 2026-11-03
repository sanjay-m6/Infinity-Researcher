# Phase 13: Feature Preservation Report

## 1. Executive Summary

Phase 13 modernized the PDF reader into an advanced academic research workspace while strictly preserving all existing functionality, interfaces, and backward compatibility.

---

## 2. Preserved Capabilities & Call Sites

### 2.1 Discover View Center Pane Integration (`DiscoverView.tsx`)
- **Dual Calling Modes Preserved**:
  1. Local saved papers: `selectedPaper.is_downloaded && selectedPaper.local_pdf_path`
  2. Live remote streaming papers: `selectedPaper.pdf_url || (selectedPaper.is_open_access && ...)`
- **`hideRightPanel={true}` Optimization**: Inside DiscoverView, the PDF reader's internal right panel is cleanly suppressed, avoiding redundant side-by-side panes with DiscoverView's own native right panel (`DiscoverPaperAssistant`).
- **Metadata Propagation**: `authors` and `abstract_text` are passed cleanly to `EmbeddedPdfViewer`.

### 2.2 Global AppShell Modal Reader (`AppShell.tsx`)
- Renders `readingPaper` via React Portal (`createPortal`).
- Displays full multi-panel research environment with `hideRightPanel={false}` (default), allowing users to read, navigate outlines, consult the AI Copilot, view citations, and take notes in full focus.

### 2.3 Existing PDF Engine Preservation
- Retains existing `pdfjs-dist` v6 without replacing it or requiring external cloud viewing services.
- Preserves the local Vite-bundled worker (`pdfjsWorker`).

### 2.4 Academic Ethics and Source Attribution
- Canonical DOI attribution is preserved and prominently displayed.
- Publisher access restrictions (`ACCESS_RESTRICTED`) are honored without bypassing paywalls or violating terms of service.
- Clear action buttons direct researchers to official publisher landing pages when documents require institutional authentication.

