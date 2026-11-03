# Phase 7 — Application Header (Toolbar) Implementation Specification

## 1. Overview

The Application Header (`src/components/layout/Toolbar.tsx`) serves as the central control bar of Infinity Researcher. It provides dynamic navigation context, global research search, keyboard shortcut assistance, active task telemetry, and appearance customization.

## 2. Header Geometry & Styling

- **Height**: Fixed 48px (`h-12`).
- **Padding**: Horizontal padding `px-4`.
- **Background**: `bg-white dark:bg-[#0b101b]`.
- **Border**: Bottom border `border-b border-slate-200 dark:border-white/[0.06]`.
- **Transitions**: Smooth color mode transitions (`transition-colors duration-200`).
- **Z-Index**: `z-20`.

## 3. Key Functional Sections

### 3.1 Dynamic Breadcrumb Navigation
- **Semantic Landmark**: `<nav aria-label="Breadcrumbs">`.
- **Category Button**: Displays the active parent category (e.g., `Research`, `AI Tools`, `Workspace`, `System`). Clicking it navigates to that category's root workspace.
- **Divider Icon**: Subtle chevron divider `<AppIcon icon={ChevronRight} size="xs" />`.
- **Active Page Title**: Displays the human-readable scholarly title of the active section (e.g., `Discover & Query Papers`, `Literature Review Matrix`, `Citation Checker`).

### 3.2 Global Research Search Entry
- **Role**: `role="search"`.
- **Input Field**: Semantic `<input type="search">` with accessible `aria-label="Search papers across all sources"`.
- **Clear Button**: `<IconButton icon={X} size="xs" />` dynamically displayed when query is non-empty.
- **Command Palette Trigger**: Platform-aware shortcut badge:
  - macOS: `⌘K` badge.
  - Windows/Linux: `Ctrl+K` badge (`<Command /> + K`).
  - Clicking badge opens the central `CommandPalette` dialog.
- **Submission**: Enter key executes `executeGlobalSearch(query)`, switching directly to the streaming search canvas in `DiscoverView`.

### 3.3 Active Telemetry & Quick Action Bar
1. **AI Tools Hub Button**:
   - Quick launch pill for the specialized AI research workspace.
   - Enhanced with `<AnimatedIcon icon={Sparkles} animation="pulse" />`.
   - Accessible `<Tooltip>` explaining tool capabilities.
2. **Active Download Jobs Indicator**:
   - Dynamically displayed when background retrieval or crawl tasks are active (`jobs.filter(j => running || queued)`).
   - Pulsing download icon `<AnimatedIcon icon={DownloadCloud} animation="pulse" isAnimating={true} />`.
   - Tooltip indicating exact running job count.
   - Clicking navigates directly to `DownloadsView`.
3. **Segmented Theme Selector**:
   - Segmented toggle (`ThemeSelector variant="segmented"`).
   - Light, Dark, and System modes with keyboard navigation and instant persistence.

