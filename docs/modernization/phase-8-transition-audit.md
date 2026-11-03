# Phase 8 — Transition and Animation Audit

## 1. Executive Summary

Phase 8 audited existing page-level and layout animations across Infinity Researcher. Prior to Phase 8, view changes in `AppShell.tsx` relied on an uncoordinated GSAP imperative hook (`gsap.fromTo`), which triggered vertical layout displacement even on large multi-panel canvas workspaces, lacked coordination with Motion for React presets established in Phase 4, and had potential race conditions during rapid navigation.

Phase 8 unified all route-level view swapping under a dedicated `<PageTransition>` component, eliminated imperative GSAP hooks from the app shell, established selective animation opt-out for heavy virtualized canvases (`review_matrix`, `paper_comparison`, `literature_workspace`), and preserved full state persistence for `DiscoverView`.

## 2. Pre-Modernization Animation Inventory

| Surface / Area | Previous Animation Method | Issues Identified | Resolution in Phase 8 |
|---|---|---|---|
| Main Content Canvas (`AppShell.tsx`) | `gsap.fromTo` on `contentRef` inside `useEffect` | Disconnected from Motion for React; caused potential table reflow in Matrix | Replaced with unified `<PageTransition>` using Motion for React tokens |
| Persistent Discover View | CSS `hidden` toggle | None (correct pattern) | Maintained persistent mounting; excluded from route transition remounting |
| Multi-Panel Workspaces | Animated vertically with other pages | Caused 4px vertical shift and table header recalculations | Added `optOut` capability (`data-slot="page-transition-opt-out"`) |
| Secondary Navigation Panel | CSS `animate-in fade-in duration-150` | Fast and accessible | Preserved; integrated with `IconButton` chevron angle animation |
| Modal & Command Palette Overlays | Portal with `animate-in fade-in` & Motion dialogs | Generally sound | Verified Escape-key listeners and backdrop click handling |
| Loading Skeletons | `animate-pulse` Tailwind utility | Minor flicker on instant requests | Standardized skeleton layout envelopes |

## 3. Router Architecture Assessment

Infinity Researcher uses a centralized, state-driven router managed in `AppContext` via `activeSection: NavSection`. This state-based routing is optimal for a local-first desktop application because:
1. It avoids URL synchronization overhead inside Tauri's native webview.
2. It allows individual workspaces (such as `DiscoverView`) to remain persistently mounted in the DOM while inactive, preserving complex search queries, active streaming jobs, filters, and PDF preview states.
3. It integrates cleanly with `<AnimatePresence mode="wait">` using `routeKey={activeSection}`.

## 4. Workspaces Requiring Transition Opt-Out

Certain high-density academic workspaces require strict 0-displacement transitions to maintain productivity and prevent expensive layout recalculations:
- **`discover`**: Persistently mounted; excluded from transition unmounting.
- **`review_matrix`**: High-density 2D matrix table; opted out of vertical translation (`y: 4 -> 0`).
- **`paper_comparison`**: Split-column comparison canvas; opted out of translation.
- **`literature_workspace`**: 3-pane resizable layout; opted out of translation.

