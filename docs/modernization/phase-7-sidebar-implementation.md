# Phase 7 — Sidebar Implementation Specification

## 1. Component Overview

The modernized Two-Column Sidebar (`src/components/layout/Sidebar.tsx`) delivers an ergonomic desktop layout that maximizes vertical screen space while maintaining immediate access to all 24 scholarly tools and workflows.

## 2. Column 1: Primary Icon Rail (56px)

### Specifications
- **Dimensions**: Fixed width of 56px (`w-14`), 100% viewport height.
- **Background**: `bg-slate-100 dark:bg-[#070b12]`.
- **Border**: Right border `border-r border-slate-200 dark:border-slate-800/80`.
- **Z-Index**: `z-20` relative to the secondary panel.

### Elements
1. **Brand Button**:
   - Circular brand avatar (`w-8 h-8 rounded-full bg-white text-slate-950 font-black text-xs`).
   - Tooltip: "Infinity Researcher — About" with accessible `aria-label`.
   - Triggers the `AboutModal` dialog displaying software version, developer credits (Sanjay), and system details.
2. **Category Navigation Buttons**:
   - Four primary categories (`Research`, `AI Tools`, `Workspace`, `System`).
   - Square icon buttons (`w-9 h-9 rounded-lg`) with `AppIcon` integration.
   - Screen reader support: `aria-label="{shortLabel} navigation group"` and `aria-current={isCatActive ? "page" : undefined}`.
   - Hover and focus states: `focus-visible:ring-2 focus-visible:ring-indigo-500`.
   - **Active Accent Bar**: High-contrast indicator (`absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r`).
3. **Rail Footer Actions**:
   - **Secondary Panel Collapse Toggle**: `<IconButton>` with chevron animation (`isExpanded={!isSecondaryCollapsed}`).
   - **Local User Avatar**: Initial-based avatar with quick popover menu supporting Lock Application (`lockApplication`), About System, and Logout (`logoutUser`).

## 3. Column 2: Secondary Category Sub-Navigation Panel (224px)

### Specifications
- **Dimensions**: Fixed width of 224px (`w-56`), 100% viewport height.
- **Background**: `bg-slate-50/90 dark:bg-[#0b101b]`.
- **Border**: Right border `border-r border-slate-200 dark:border-slate-800/80`.
- **Transitions**: Smooth enter/exit animation (`animate-in fade-in duration-150`).

### Elements
1. **Category Header**:
   - Category name in bold uppercase tracking (`text-[11px] font-bold uppercase tracking-wider`).
   - Quick collapse button (`aria-label="Collapse category panel"`).
2. **Sub-Navigation List**:
   - Enclosed within semantic `<nav aria-label="Main Navigation">`.
   - Interactive item buttons with `AppIcon`, truncated text label, optional dynamic count badges (e.g., paper count, collection count, active jobs count), and "NEW" feature pills.
   - Active state: `aria-current="page"`, `bg-white dark:bg-white/[0.08] text-indigo-700 dark:text-white font-medium border-indigo-200/80 dark:border-white/10 shadow-xs`.
   - Keyboard navigation: Roving arrow navigation via `onKeyDown={(e) => handleNavKeyDown(e, idx)}`.
3. **Storage & Diagnostics Footer**:
   - Real-time engine status pill (`Local Engine: Ready` with pulsing emerald dot).
   - Database engine indicator (`SQLite`).

## 4. State Persistence & Responsive Behavior

- Secondary panel collapse state is persisted across reloads in `localStorage` under `infinity_sidebar_v3_secondary_collapsed`.
- Changes to collapse state trigger `AppContext.setIsSidebarCollapsed` to notify responsive canvas consumers.
- Clicking an already-active primary rail icon toggles the secondary panel open or closed.
- Selecting an inactive primary rail icon opens the panel and auto-focuses the first workspace if the current view is outside that category.

