# Phase 1: Responsiveness and Desktop Window Layout Audit

This audit evaluates the desktop window behavior, frameless title bar, multi-panel splitters, and responsive layout scaling across **Infinity Researcher**.

---

## 1. Window Constraints & Tauri Architecture

- **Window Dimensions**:
  - Minimum Size: `800x600` px (enforced in `tauri.conf.json`).
  - Default Launch Size: `1024x720` px.
  - Maximum Size: Unconstrained; supports 4K / ultrawide displays.
- **Custom Frameless Title Bar (`src/components/layout/TitleBar.tsx`)**:
  - The window is configured with `decorations: false` for a native, unified desktop aesthetic.
  - The top 38px strip carries `data-tauri-drag-region` allowing window dragging across the entire screen.
  - Interactive buttons (App logo, search trigger, window minimize, maximize/restore, close) exclude drag handling to preserve immediate click response.

---

## 2. Multi-Pane Workspace Layouts

### A. Discover View Three-Pane Layout (`DiscoverView.tsx`):
- **Pane 1 (Left ~300px)**: Search input, source selectors, filter dropdowns, and scrollable discovered paper list.
- **Pane 2 (Center flexible flex-1)**: Active paper document reader, high-DPI PDF canvas, action toolbar.
- **Pane 3 (Right ~380px)**: Grounded AI assistant, literature survey synthesis tools, notes.
- **Divider Handles**: Supports drag-to-resize handles with double-click reset and collapsed icon strips when space is restricted.

### B. Literature Workspace Three-Panel Layout (`LiteratureWorkspaceView.tsx`):
- **Panel 1 (Left 280px)**: Research project papers collection with extraction completion chips.
- **Panel 2 (Center flexible)**: Literature review synthesis editor and comparative matrix.
- **Panel 3 (Right 340px)**: Source evidence verification and citation inspector.

### C. Review Matrix Spreadsheet Grid (`ReviewMatrixView.tsx`):
- High-density data grid comparing multiple papers across custom extraction columns.
- Uses horizontal scrolling container with fixed table headers and sticky left paper identifier column.

---

## 3. Responsive Scaling & Narrow Window Findings

| Window Width | Layout Behavior | Observed Deficiencies | Recommended Modernization Fix |
| :--- | :--- | :--- | :--- |
| **>= 1440px (Wide Desktop)** | All 3 panes comfortably visible with zero clipping. | Empty margin whitespace in standard views (`max-w-7xl`). | Allow fluid container scaling or side-by-side notes panel in standard views. |
| **1024px–1439px (Standard)** | Default layout. All features fully operational. | Center PDF reader can feel narrow when both left list and right assistant are open. | Provide a "Focus Mode" button that collapses both side panes with one click. |
| **800px–1023px (Narrow)** | Right assistant panel auto-collapses to a slim 36px icon strip. | Toolbar breadcrumbs and action buttons can wrap into two lines. | Implement responsive overflow menu for toolbar actions when width < 900px. |
| **< 800px (Window Minimum)** | Tauri prevents window resizing below 800px. | N/A (Hard window limit prevents unusable states). | Preserve `minWidth: 800` and `minHeight: 600`. |

---

## 4. Modernization Targets (Phase 4 & 6)

1. **Standardized `<ResizablePanelGroup>`**:
   - Replace custom pointer-down resize math with a unified, keyboard-accessible resizable panel component.
2. **Persistent Workspace Layout Memory**:
   - Store panel width percentages per workspace so user adjustments are remembered across app restarts.
3. **Distraction-Free Reading Mode**:
   - Add a full-screen toggle for the PDF viewer and Literature Review editor that temporarily hides the TitleBar, Sidebar, and BottomBar.

