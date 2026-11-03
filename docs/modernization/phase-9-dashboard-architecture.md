# Phase 9: Dashboard Architecture Specification

## 1. Architectural Vision

The modernized Infinity Researcher dashboard serves as the central operational cockpit for offline academic exploration, document management, and analytical workflows. Operating under a strict **local-first, data-driven architecture**, every widget renders authoritative state from SQLite and the local Python scraping engine through `AppContext`.

---

## 2. Component Hierarchy & Layout Topology

```
DashboardView
├── PageHeader (Landmark Banner)
│   ├── Title: "Scholarly Workspace"
│   ├── Subtitle: "Local-first academic research workbench..."
│   └── Actions:
│       ├── Quick Find Button (⌘K shortcut trigger)
│       ├── Search Online Button (Discover router)
│       └── Open Library Button (Library router)
│
├── Research Overview (Role="region" aria-label="Research Overview Metrics")
│   ├── MetricCard 1: Total Indexed Papers (Total count & Open Access breakdown)
│   ├── MetricCard 2: Saved in Library (Saved paper count & Collections coverage)
│   ├── MetricCard 3: Active Job Queue (Running & Queued tasks vs Total jobs)
│   └── MetricCard 4: Configured Providers (Supported feeds vs Configured sources)
│
├── Literature Exploration Launchpad (Role="region" aria-label="Literature Exploration Launchpad")
│   ├── Curated Search Prompts ("deep learning transformer", "protein folding alphafold", etc.)
│   └── Direct Launch to Discover
│
└── Main 2-Column Responsive Workspace (Grid: 2 Cols Left, 1 Col Right on Desktop)
    ├── Primary Column (Left 2/3)
    │   ├── Continue Researching (Recent Scholarly Papers)
    │   │   ├── Paper Item Row (Title, Authors, Venue, Year, Badges, Citations)
    │   │   ├── Direct Action: "Read" (triggers built-in PDF Reader)
    │   │   ├── Direct Action: "Details" (triggers PaperDetailDrawer)
    │   │   └── EmptyState (Search Academic Sources call to action)
    │   │
    │   ├── Active Tasks & Retrieval Queue
    │   │   ├── Live Tasks List (Paper Title, Stage Message, Progress Bar, Cancel Action)
    │   │   ├── Completed Tasks Idle Summary
    │   │   └── EmptyState (Task queue idle indicator)
    │   │
    │   └── Research Collections
    │       ├── Collections Grid (Color dot, Binder Name, Description, Paper count badge)
    │       └── EmptyState (Create Collection call to action)
    │
    └── Secondary Column (Right 1/3)
        ├── Quick Research Tools Launchpad
        │   ├── Literature Workspace (Multi-document synthesis)
        │   ├── AI Research Assistant (Copilot dialogue)
        │   ├── Citation Checker (BibTeX & Reference validation)
        │   ├── Review Matrix (Systematic extraction tables)
        │   └── Paper Comparison (Side-by-side comparative analysis)
        │
        ├── Academic Source Connectors
        │   └── Verified Feeds & Tier Badges (arXiv, OpenAlex, PubMed, IEEE Xplore)
        │
        ├── Recent Research Activity Timeline
        │   └── Typed Event Rows (Search, Download, Collection, Import, System) + Relative Time
        │
        └── Local Storage Diagnostics
            └── Offline SQLite DB path, cached papers count, and collections count
```

---

## 3. State Management & Data Flow

```
                      +-----------------------------+
                      |     Rust SQLite Backend     |
                      +-----------------------------+
                                     │
                        (Tauri IPC / desktop-api)
                                     ▼
                      +-----------------------------+
                      |         AppContext          |
                      |  - papers: Paper[]          |
                      |  - collections: Collection[]|
                      |  - jobs: DownloadJob[]      |
                      |  - sources: SourceProvider[]|
                      |  - activity: ActivityEvent[]|
                      |  - databaseInfo: DBInfo     |
                      +-----------------------------+
                                     │
                                     ▼
                      +-----------------------------+
                      |        DashboardView        |
                      |  - Zero mock data           |
                      |  - Live derived metrics     |
                      |  - Event dispatchers        |
                      +-----------------------------+
                         │          │          │
                         ▼          ▼          ▼
               [PDF Reader]  [Details]  [Task Actions]
```

---

## 4. Resiliency & Loading Philosophy

1. **Initial Hydration (`isDbLoading: true`)**:
   - The view renders `Skeleton` metrics, `PaperCardSkeleton` rows, and pulsing placeholders, preventing layout reflow.
2. **Zero-State Fallbacks**:
   - Every individual widget implements a dedicated, non-disruptive `EmptyState` component with a direct call to action.
3. **Partial Failure Resiliency**:
   - If network sources or Python scrapers are unreachable, the dashboard remains 100% functional, relying on local SQLite cached data.

