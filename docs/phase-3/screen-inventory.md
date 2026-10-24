# Phase 3 UI Screen Inventory & Interaction Contract

Project: Research Paper Scraper  
Phase: 3 of 10 — Modern UI, Design System, & Application Shell  
Status: Implemented & Verified  

---

## 1. Global Application Shell & Regions

| Region | Component Path | Purpose & UX Logic |
| :--- | :--- | :--- |
| **Sidebar** | [`src/components/layout/Sidebar.tsx`](file:///d:/Paper/src/components/layout/Sidebar.tsx) | Collapsible navigation rail containing product brand mark ("Research Paper / Local Workbench"), active section indicator across 8 screens, real-time job/collection badge counters, collapse toggle (`w-60` to `w-16`), and live Rust core health pill. |
| **Top Toolbar** | [`src/components/layout/Toolbar.tsx`](file:///d:/Paper/src/components/layout/Toolbar.tsx) | Desktop utility bar containing active section title, global keyword search bar (triggers Discover view), `Ctrl+K` command palette launcher, active jobs indicator badge, and theme switcher (Light / Dark / System). |
| **Command Palette** | [`src/components/ui/CommandPalette.tsx`](file:///d:/Paper/src/components/ui/CommandPalette.tsx) | Accessible modal popup opened via `Ctrl+K` or search trigger. Provides keyboard navigation (`↑`/`↓`/`Enter`/`Esc`) for instantaneous section jumping and real-time title/author searching. |
| **Paper Details Drawer** | [`src/features/paper-details/PaperDetailDrawer.tsx`](file:///d:/Paper/src/features/paper-details/PaperDetailDrawer.tsx) | Slide-over inspection drawer accessible from Dashboard, Discover, and Library. Displays full metadata, author names, expandable abstract, DOI copy, BibTeX citation generation, external URL link-out, and collection membership toggles. |
| **Notification Center** | [`src/components/ui/ToastContainer.tsx`](file:///d:/Paper/src/components/ui/ToastContainer.tsx) | Non-intrusive floating alert toasts for user actions (collection CRUD, paper bookmarking, citation copying, error reporting). |

---

## 2. Navigable Screen Specifications

### 2.1 Dashboard (`dashboard`)
- **Component:** [`src/features/dashboard/DashboardView.tsx`](file:///d:/Paper/src/features/dashboard/DashboardView.tsx)
- **Purpose:** Central scholarly overview presenting workspace metrics, quick navigation shortcuts, recent publications, source health, and recent operations.
- **Interactive Affordances:**
  - **Metric Tiles:** Interactive cards for Total Papers, Saved Library, Active Download Jobs, and Configured Providers. Clicking any metric navigates to its corresponding view.
  - **Quick Action Bar:** Quick search buttons ("deep learning transformer", "protein folding alphafold") and direct access to Library and Discover.
  - **Recent Papers List:** Shows 5 most recent papers with venue, year, source, and citations. Clicking any row opens the Paper Details drawer.
  - **Source Connector Summary:** Displays live connection readiness across Tier A providers (OpenAlex, arXiv, Crossref).
  - **Recent Activity Feed:** Displays recent user actions and system events.

### 2.2 Discover (`discover`)
- **Component:** [`src/features/discover/DiscoverView.tsx`](file:///d:/Paper/src/features/discover/DiscoverView.tsx)
- **Purpose:** Scholarly query workspace to formulate keyword searches, filter by publisher/source, publication years, and open-access status.
- **Interactive Affordances:**
  - **Search Input:** High-performance filtering across title, abstract, authors, venue, and DOI.
  - **Filter Panel:** Multi-source selection pills (arXiv, OpenAlex, Semantic Scholar, etc.), year range inputs (From/To), and open-access-only toggle.
  - **Filter Chips:** Active filters rendered as removable chips with a "Clear all" shortcut.
  - **Sort Dropdown:** Relevance, Year: Newest, Year: Oldest, and Most Cited.
  - **Result Cards:** Card view showing paper metadata, abstract excerpt, open-access badges, external link-out, and save/unsave toggle.
  - **Demo Banner:** Explicitly informs the user that remote live API connectors will be connected in Phase 5.

### 2.3 Saved Library (`library`)
- **Component:** [`src/features/library/LibraryView.tsx`](file:///d:/Paper/src/features/library/LibraryView.tsx)
- **Purpose:** Local repository management for saved academic papers.
- **Interactive Affordances:**
  - **In-Library Search:** Fast filter over saved papers by title, author, or venue.
  - **Collection & Source Filters:** Filter saved papers by specific collection tags or academic source providers.
  - **Sort Dropdown:** Recently Added, Year: Newest, Most Cited, and Title: A-Z.
  - **Checkbox Selection:** Individual row selection and "Select all" toggle.
  - **Bulk Action Bar:** Appears when rows are selected; allows assigning papers to collections in bulk or clearing selection.
  - **Paper Removal with Confirmation:** Trash icon opens [`ConfirmDialog`](file:///d:/Paper/src/components/ui/ConfirmDialog.tsx) before removing from the saved library.

### 2.4 Downloads & Retrieval Jobs (`downloads`)
- **Component:** [`src/features/downloads/DownloadsView.tsx`](file:///d:/Paper/src/features/downloads/DownloadsView.tsx)
- **Purpose:** Observability into asynchronous metadata scraping, full-text PDF retrieval, and text extraction jobs.
- **Interactive Affordances:**
  - **Status Tabs:** Segmented filters for All, Running, Queued, Completed, and Failed jobs with live badge counts.
  - **Job Progress:** Static progress percentage and stage status messages (explicitly marked as demo state; no fake moving progress timers).
  - **Action Buttons:** Retry button for failed tasks, Cancel button for running tasks (mutating client-side demo state with toast feedback).
  - **Error Diagnostics:** Displays HTTP 403 Forbidden / paywall gating explanations on restricted downloads.

### 2.5 Research Collections (`collections`)
- **Component:** [`src/features/collections/CollectionsView.tsx`](file:///d:/Paper/src/features/collections/CollectionsView.tsx)
- **Purpose:** Topic-based and project-based grouping of academic literature.
- **Interactive Affordances:**
  - **Collection Grid:** Cards displaying collection name, description, paper count, color badge, and update timestamp.
  - **Create Collection Modal:** Accessible dialog with inline validation (rejects blank names, strings > 50 characters, and case-insensitive duplicates like "Machine Learning Foundations").
  - **Color Picker:** 7 curated theme colors for collection badges.
  - **Collection Detail View:** Clicking a collection displays its assigned papers, dedicated in-collection search, and "Remove from collection" action.
  - **Safety Contract:** Deleting a collection triggers a confirmation modal and *never* deletes paper records from the main library.

### 2.6 Academic Sources Directory (`sources`)
- **Component:** [`src/features/sources/SourcesView.tsx`](file:///d:/Paper/src/features/sources/SourcesView.tsx)
- **Purpose:** Directory of supported academic sources, providers, repositories, and publisher link-outs.
- **Interactive Affordances:**
  - **Category Filter:** Filter by API, Repository, Structured Feed, and Commercial (Link-Out).
  - **Source Cards:** Display provider tier (Tier A/B/C), status badge (Supported, Not configured, Needs API Key), rate limits, and capability checklist.
  - **Details Modal:** Inspects official documentation URL, rate limits, and planned capabilities.
  - **Configure CTA:** Informs the user that API credentials and scrapers are scheduled for Phase 5.

### 2.7 Activity & System Logs (`activity`)
- **Component:** [`src/features/activity/ActivityView.tsx`](file:///d:/Paper/src/features/activity/ActivityView.tsx)
- **Purpose:** Audit log of recent search queries, downloads, collection modifications, and system events.
- **Interactive Affordances:**
  - **Type & Status Filters:** Filter by event category (search, download, collection, system) and outcome (success, warning, error, info).
  - **Copy Log Line:** One-click clipboard copy of timestamped log entries formatted for diagnostics.

### 2.8 Settings & Diagnostics (`settings`)
- **Component:** [`src/features/settings/SettingsView.tsx`](file:///d:/Paper/src/features/settings/SettingsView.tsx)
- **Purpose:** Application preferences, theme configuration, storage inspection, and native Rust backend health monitoring.
- **Interactive Affordances:**
  - **Theme Selection:** Light, Dark, or System mode with instantaneous UI update and `localStorage` persistence.
  - **Storage Directory:** Displays real storage path queried from Tauri backend health command (`backendHealth.default_storage_dir`).
  - **Rust Core Health:** Live app version, operating system platform, and subsystem status probe.
  - **Re-probe Button:** Triggers real-time health check via Tauri command bridge.
  - **Deep Diagnostic Modal:** Launches the Phase 2 `DiagnosticView` for detailed Tauri subsystem probes and IPC round-trip latency checks.
