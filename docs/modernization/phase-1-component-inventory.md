# Phase 1: Component Inventory and Modernization Plan

This inventory catalogs the shared UI primitives, layout structures, and page-specific components in **Infinity Researcher**.

---

## 1. Shared UI Primitives (`src/components/ui/`)

| Component Name | File Path | Usage Count & Areas | Dark Mode | Keyboard Support | Loading / Disabled States | Tested | Refactoring Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Button`** | `src/components/ui/Button.tsx` | Ubiquitous (>60 files). Primary, secondary, outline, ghost, destructive. | Yes | Yes (native `<button>`) | Yes (`disabled`, active styles) | Yes | **Retain & Enhance**: Add Motion press animation (`whileTap={{ scale: 0.98 }}`) and standardized icon spinner slots. |
| **`Badge`** | `src/components/ui/Badge.tsx` | ~25 files (Default, primary, success, warning, destructive, info, outline). | Yes | N/A (Static) | N/A | Yes | **Retain**: Clean semantic tokens, rounded-full styling. |
| **`SourceBadge`** | `src/components/ui/SourceBadge.tsx` | Discover, Library, IEEE, Literature Workspace. Colors per source (IEEE, arXiv, PubMed, etc.). | Yes | N/A | N/A | Yes | **Retain**: Essential domain component with exact color coding per scholarly repository. |
| **`Input`** | `src/components/ui/Input.tsx` | Forms, modals, settings, auth views. | Yes | Yes | Yes (`disabled`, focus ring) | Yes | **Retain & Consolidate**: Standardize focus ring with design tokens. |
| **`SearchInput`** | `src/components/ui/SearchInput.tsx` | Library search, collection search, modal filters. | Yes | Yes (`Escape` clears text) | Yes (Clear button) | Yes | **Retain**: Well-designed with clear button and Lucide search icon. |
| **`Skeleton`** | `src/components/ui/Skeleton.tsx` | Discover search, assistant, duplicate review, library modal. Includes `PaperCardSkeleton`, `TextSkeleton`, `CardSkeleton`, `TableSkeleton`, `AvatarSkeleton`. | Yes | N/A | Native pulsing animation | Yes | **Retain**: Recently integrated shadcn-compatible implementation (`data-slot="skeleton"`). |
| **`Modal`** | `src/components/ui/Modal.tsx` | Custom dialogs, settings sub-windows. | Yes | Partial (`Escape` handler) | N/A | Yes | **Refactor**: Upgrade to Radix UI Dialog primitive for focus trapping and accessible screen-reader portal. |
| **`Drawer`** | `src/components/ui/Drawer.tsx` | Slide-over panels (PaperDetailDrawer, EvidenceDrawer). | Yes | Partial | N/A | Yes | **Refactor**: Upgrade to Radix UI Sheet primitive with smooth gesture-enabled slide transitions. |
| **`ConfirmDialog`**| `src/components/ui/ConfirmDialog.tsx` | Delete paper, clear downloads, reset settings. | Yes | Yes (`Enter` to confirm, `Esc` to cancel) | Yes | Yes | **Retain & Refactor**: Wrap with Radix Alert Dialog for proper focus management. |
| **`EmptyState`** | `src/components/ui/EmptyState.tsx` | Zero-state paper lists, empty collections, no results. | Yes | N/A | N/A | Yes | **Retain**: Excellent icon + title + description structure; add Motion subtle floating entrance. |
| **`ErrorBoundary`**| `src/components/ui/ErrorBoundary.tsx`| Root application guard around `MainAppContent`. | Yes | Yes (Try Again button) | Safe error recovery | Yes | **Retain**: Catches unexpected React lifecycle errors and prevents black-screen crashes. |
| **`ToastContainer`**| `src/components/ui/ToastContainer.tsx`| Application-wide floating notifications (info, success, warning, error). | Yes | Basic | Auto-dismiss timer | Yes | **Refactor**: Replace timeout-based transition with Motion for React layout animations (`layout`, exit fade). |
| **`CommandPalette`**| `src/components/ui/CommandPalette.tsx`| `Ctrl+K` global spotlight launcher. | Yes | Yes (Arrow keys, Enter, Esc) | Fast index search | Yes | **Retain & Enhance**: Smooth backdrop blur, fuzzy search highlighting. |
| **`AboutModal`** | `src/components/ui/AboutModal.tsx` | Architecture overview, version info, licensing. | Yes | Yes | N/A | Yes | **Retain**: Informative multi-tab modal. |

---

## 2. Layout Components (`src/components/layout/`)

| Component Name | File Path | Purpose | Animations Present | Refactoring Recommendations |
| :--- | :--- | :--- | :--- | :--- |
| **`AppShell`** | `src/components/layout/AppShell.tsx` | Master view orchestrator, persistent Discover mounting, drawers, modals. | GSAP page transition | Replace GSAP with Motion for React `<AnimatePresence>` for declarative page routing. |
| **`TitleBar`** | `src/components/layout/TitleBar.tsx` | Custom frameless window title bar with drag region, logo, window controls. | CSS hover transitions | Retain Tauri window controls (`window_minimize`, `window_toggle_maximize`, `window_close`). |
| **`Sidebar`** | `src/components/layout/Sidebar.tsx` | 2-column sidebar: 4 category groups (Research, AI Tools, Workspace, System) + collapsible secondary column. | CSS transition on width | Modernize collapse/expand with Motion spring physics. Ensure tooltips on icon-only rail. |
| **`Toolbar`** | `src/components/layout/Toolbar.tsx` | Top breadcrumb, engine selector (Rust vs Python), fast search launcher, feedback button. | CSS hover transitions | Standardize pill badges and engine toggle switch. |
| **`BottomBar`** | `src/components/layout/BottomBar.tsx` | Status bar showing SQLite connection, local AI status, active background jobs count. | Pulse indicator on jobs | Retain; add expandable micro-drawer showing active job telemetry. |
| **`PageHeader`** | `src/components/layout/PageHeader.tsx` | Standardized header with title, subtitle, and action buttons. | Static | Retain as the standard layout wrapper for non-full-bleed views. |

---

## 3. Specialized Workspace Components

| Workspace | Key Components | Refactoring Opportunities |
| :--- | :--- | :--- |
| **Discover** | `DiscoverView`, `DiscoverPaperAssistant`, `PaperImportModal` | Multi-panel splitters should use standardized `<ResizablePanelGroup>`. Assistant insight tools should have animated state transitions. |
| **Literature Workspace** | `LiteratureWorkspaceView`, `AddPapersModal`, `EvidenceCopilotModal` | 3-panel literature survey workspace. Centralize column resizing and extraction status chips. |
| **Review Matrix** | `ReviewMatrixView`, `EvidenceDrawer`, `ColumnConfigModal` | Spreadsheet cell editing, virtualized scrolling for large paper collections (>100 papers). |
| **Embedded PDF Viewer** | `EmbeddedPdfViewer` | 12-state process pipeline, canvas zoom, text search. Add smooth page thumbnail navigation strip. |
| **AI Hub & Tools** | `AiHubView`, `AiToolsHubView`, `AiToolWorkspaceView` | Provider health check indicator cards, real-time token streaming layout. |
| **Writing Workspace** | `AcademicWritingWorkspaceView`, `tokenPreservationGuard` | Side-by-side revision diff viewer, preserved token highlighting pills. |
| **Citation Checker** | `CitationCheckerWorkspaceView`, `ReferenceInspectorDrawer` | Health score donut chart, categorized findings list. |
| **Integrity & Readability**| `ResearchIntegrityView`, `ReadabilityAnalyzerView` | Metric cards with animated gauge meters and radar visualization. |
| **Auth & Security** | `AuthView`, `LoginForm`, `SignupForm`, `LockScreenView` | Smooth flip/slide transition between Login and Signup modes; clean password reveal toggle. |

---

## 4. Prioritized Component Refactoring Plan

1. **Phase 2 (Design System)**:
   - Centralize all color, shadow, spacing, and border radius tokens in `src/styles/index.css`.
   - Audit all hardcoded hex values (`#070b12`, `#4f46e5`, `#0e1524`) and replace with semantic tokens (`bg-background`, `bg-card`, `text-primary`).
2. **Phase 3 (Motion Primitives)**:
   - Introduce Motion for React (`motion/react`).
   - Add `<motion.button>` wrappers with tap feedback.
   - Upgrade `ToastContainer` and `AppShell` transitions to Motion.
3. **Phase 4 (Primitive Standardization)**:
   - Implement accessible Radix-based `<Dialog>`, `<Sheet>`, `<DropdownMenu>`, and `<Tooltip>` primitives.
   - Consolidate modal and drawer implementations into these primitives.

