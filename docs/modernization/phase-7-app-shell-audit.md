# Phase 7 — App Shell & Layout Audit

## 1. Executive Summary

Phase 7 evaluated and modernized the foundational desktop layout shell of Infinity Researcher. The audit reviewed the window shell hierarchy, window title bar, primary and secondary navigation structures, toolbar headers, main workspace canvases, and persistent status bars.

Prior to Phase 7, the application layout relied on inconsistent styling tokens, unconstrained CSS animations that did not respect OS-level reduced-motion preferences, missing ARIA landmark attributes, and lack of keyboard navigation across sub-navigation hierarchies. Phase 7 brought the entire application shell into full compliance with WCAG 2.1 AA accessibility standards, integrated Motion for React and GSAP with reduced-motion safeguards, and standardized the layout across all 24 scholarly feature workspaces.

## 2. Shell Stacking & Z-Index Architecture

The shell stacking hierarchy was standardized to prevent z-index collisions, modal bleeding, and portal layering conflicts:

| Layer Level | Element | Z-Index | Role / Description |
|---|---|---|---|
| Level 1 | App Background / Canvas | `z-0` | Base view background (`bg-slate-50 dark:bg-[#070b12]`) |
| Level 2 | Main View Container | `z-10` | Primary content canvas and scroll containers |
| Level 3 | Application Toolbar (Header) | `z-20` | Dynamic breadcrumbs, global search, and tool actions |
| Level 4 | Sidebar Navigation | `z-30` | Two-column navigation rail (56px) and subnav panel (224px) |
| Level 5 | Status Bottom Bar | `z-30` | System health, database connection, and storage metrics |
| Level 6 | Custom Window Title Bar | `z-40` | Tauri window drag region, window controls, and brand badge |
| Level 7 | Quick Actions / Overlays | `z-50` | Command palette (`Ctrl+K`), modal backdrops |
| Level 8 | PDF Viewer & Flyout Drawers | `z-[100]` | Slide-over paper detail drawer, full-screen PDF workbench |
| Level 9 | Floating Notifications (Toasts) | `z-[140]` | Real-time task feedback and status toasts |

## 3. Structural Container Analysis

### 3.1 Custom Window Title Bar (`TitleBar.tsx`)
- **Drag Region**: Integrated with Tauri's native window-dragging system (`data-tauri-drag-region`, `startDraggingWindow()`).
- **Semantic Landmark**: Modernized from unlabelled container to `<header aria-label="Window title bar">`.
- **Window Controls**: Accessible Minimize, Maximize/Restore, and Close buttons with tooltip hints and distinct focus rings.
- **Brand Identity**: Interactive brand badge triggering the About modal with developer attribution.

### 3.2 Two-Column Navigation Sidebar (`Sidebar.tsx`)
- **Primary Rail (56px)**: High-density icon rail providing instant category switching between `Research`, `AI Tools`, `Workspace`, and `System`. Enhanced with `Tooltip`, `aria-current="page"`, and animated accent bar.
- **Secondary Sub-Navigation Panel (224px)**: Dedicated workspace selector with collapsible state persistence via `localStorage` and `AppContext`.
- **Keyboard Traversal**: Fully accessible `ArrowDown` / `ArrowUp` arrow key navigation across sub-navigation items.

### 3.3 Main Viewport (`AppShell.tsx`)
- **Multi-Panel Canvas Workspaces**: Workspaces requiring custom internal layouts (`discover`, `literature_workspace`, `review_matrix`, `paper_comparison`) are granted full-bleed viewport access (`overflow-hidden p-0 h-full w-full`).
- **Standard Document Workspaces**: Document-oriented views receive padded, readable layout envelopes (`overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 max-w-7xl mx-auto`).
- **Discover State Persistence**: `DiscoverView` remains mounted once initialized to prevent dropping active search queries, streaming jobs, or multi-tab PDF reading states.

## 4. Preservation Matrix

- **Rust Backend**: 100% of Tauri IPC commands preserved. No changes to database migrations or schema tables.
- **Python Engine**: Scraping and extraction pipelines untouched.
- **Workspaces**: All 24 specialized views remain completely operational with zero route removals.

