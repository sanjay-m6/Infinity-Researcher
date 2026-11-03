# Phase 9: Dashboard Widget Specification

## 1. Overview

This document specifies each widget deployed on the modernized Infinity Researcher dashboard, detailing its purpose, state inputs, user interactions, responsive behavior, and accessibility landmarks.

---

## 2. Widget Specifications

### 2.1. PageHeader & Command Bar
- **Purpose**: Welcomes the researcher, highlights local-first capabilities, and exposes primary action triggers.
- **Components**: `PageHeader`, `Button`, `AppIcon` (wrapping `Search`, `Compass`, `BookOpen`).
- **Actions**:
  - `Quick Find`: Toggles Command Palette modal (`setIsCommandPaletteOpen(true)`).
  - `Search Online`: Direct navigation to Discover (`setActiveSection("discover")`).
  - `Open Library`: Direct navigation to Library (`setActiveSection("library")`).
- **Responsive Handling**: The `Quick Find` button collapses to icon-only on mobile viewports.

---

### 2.2. Research Overview Metrics Grid
- **Purpose**: Displays high-level research quantitative indicators.
- **Topology**: 4-column responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- **Cards**:
  1. `Total Indexed Papers` (indigo theme, `BookOpen` icon)
  2. `Saved in Library` (emerald theme, `Bookmark` icon)
  3. `Active Job Queue` (sky theme, `DownloadCloud` icon)
  4. `Configured Providers` (amber theme, `Layers` icon)
- **Interactions**: Click and keyboard Enter/Space trigger navigation to destination sections.
- **Tokens**: `rounded-xl`, `border`, `bg-card`, hover border color transitions, and focus visible rings.

---

### 2.3. Literature Exploration Launchpad
- **Purpose**: Accelerates paper discovery via curated, high-yield academic search queries.
- **Visual Design**: Subtle gradient banner (`from-indigo-50/60` to `dark:to-slate-900`) with `Sparkles` icon.
- **Preset Queries**:
  - `"deep learning transformer"`
  - `"protein folding alphafold"`
  - `"large language models reasoning"`
- **Interaction**: Clicking any query pill invokes `executeGlobalSearch(query)`, which updates global query state and transitions the active view to Discover.

---

### 2.4. Continue Researching (Recent Scholarly Papers)
- **Purpose**: Enables researchers to quickly resume reading or inspecting recently added papers.
- **Max Items**: 5 papers.
- **Item Metadata**:
  - Paper title with line clamping (`line-clamp-1`)
  - Authors list (truncated)
  - Venue and publication year
  - `SourceBadge` (arXiv, PubMed, OpenAlex, IEEE, etc.)
  - Access status badge (`Open Access`, `Restricted`)
  - Citation count badge
- **Direct Actions**:
  - `Read PDF`: Launches built-in PDF Reader modal (`setReadingPaper`).
  - `Details`: Opens right-side `PaperDetailDrawer` (`setSelectedPaperId`).
- **Zero-State**: Phase 5 `EmptyState` component with "Search Academic Sources" button.

---

### 2.5. Active Tasks & Retrieval Queue
- **Purpose**: Real-time observability over background PDF downloads, scraping jobs, and metadata extractions.
- **Active Job Row**:
  - Paper title and stage message
  - Status chip (`info` badge for running, `secondary` for queued)
  - `Progress` bar with actual percentage
  - Cancel button (`cancelJob(job.id)`) with `X` icon
- **Completed Summary**: Shows up to 2 recently completed tasks when the queue is idle.
- **Zero-State**: Compact idle state indicating no running tasks.

---

### 2.6. Research Collections Binders
- **Purpose**: Provides quick access to topical paper binders and custom taxonomies.
- **Grid Layout**: 2-column grid (`grid-cols-1 sm:grid-cols-2 gap-3`).
- **Card Elements**:
  - Colored indicator dot reflecting `collection.colorHex`
  - Collection name (truncated)
  - Paper count badge (`X papers`)
  - Description snippet
- **Interaction**: Click opens collection view with pre-selected collection ID.
- **Zero-State**: Compact `EmptyState` with "Create Collection" action.

---

### 2.7. Quick Research Tools Launchpad
- **Purpose**: 1-click launcher for specialized analytical workflows.
- **Shortcuts**:
  - `Open Literature Workspace` -> `"literature_workspace"`
  - `AI Copilot Assistant` -> `"research_assistant"`
  - `Audit Citations` -> `"citation_checker"`
  - `Systematic Review Matrix` -> `"review_matrix"`
  - `Compare Papers Side-by-Side` -> `"paper_comparison"`

---

### 2.8. Academic Source Connectors
- **Purpose**: Real-time status indicators for configured academic repositories and pre-print servers.
- **Elements**: Source name, verified status badge (`Supported`, `Not configured`, `Needs credentials`), and directory link.

---

### 2.9. Recent Activity Feed
- **Purpose**: Audit trail of recent system events, searches, and imports.
- **Elements**:
  - Typed Lucide icon (`Search`, `DownloadCloud`, `Folder`, `FileText`, `Database`)
  - Event title and details
  - Relative timestamp (`Just now`, `5m ago`, `2h ago`)
- **Zero-State**: "No recent activity recorded yet."

---

### 2.10. Local Storage Diagnostics Box
- **Purpose**: Reinforces local-first transparency by displaying SQLite database file name and active cache counts.

