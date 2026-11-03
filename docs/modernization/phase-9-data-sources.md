# Phase 9: Data Sources & Integration Specification

## 1. Overview

Infinity Researcher's dashboard follows a strict data integrity mandate: **no mock data in production**. Every metric, paper record, task, and activity log is backed by the real SQLite database and Tauri IPC commands.

---

## 2. Comprehensive Data Source Inventory

### 2.1. Local SQLite Database (`desktop-api`)

| Target Entity | API Command | SQL Query Origin | Primary Fields Consumed |
| :--- | :--- | :--- | :--- |
| **Indexed Papers** | `listPapersApi({ page, page_size })` | `SELECT * FROM papers ORDER BY id DESC` | `id`, `title`, `authors`, `venue`, `year`, `doi`, `isSaved`, `accessStatus`, `citationCount`, `pdfUrl`, `documentStatus` |
| **Collections** | `listCollectionsApi()` | `SELECT * FROM collections` | `id`, `name`, `description`, `colorHex`, `paperIds`, `createdAt`, `updatedAt` |
| **Database Info** | `getDatabaseInfo()` | `PRAGMA database_list; PRAGMA user_version;` | `path`, `schema_version`, `journal_mode`, `foreign_keys` |
| **App Settings** | `getAppSetting(key)` | `SELECT setting_value FROM app_settings WHERE setting_key = ?` | `onboarding_completed`, `theme_preference` |

### 2.2. Background Task Engine (`jobs`)

| State Field | Originating Command / IPC | Job Types | Statuses Handled |
| :--- | :--- | :--- | :--- |
| `jobs: DownloadJob[]` | `start_pdf_download`, `extract_paper_text`, `run_crawl_job` | `pdf_download`, `metadata_fetch`, `text_extraction` | `running`, `queued`, `completed`, `failed` |

### 2.3. Academic Source Providers (`sources`)

| Source Provider | Category | Tier | Capabilities |
| :--- | :--- | :--- | :--- |
| **arXiv** | Structured Feed | Tier A | Full-text PDF, abstract search, arXiv categories |
| **OpenAlex** | API | Tier A | Cross-publisher metadata, citation graphs, concept hierarchy |
| **Semantic Scholar** | API | Tier A | TLDR summaries, citation velocity, author profiles |
| **PubMed / PMC** | Repository | Tier A | Biomedical abstracts, PMC full-text XML/PDF |
| **IEEE Xplore** | Commercial Link-Out | Tier B | IEEE metadata, Open Access retrieval, conference indexing |

### 2.4. Activity Logging Engine (`activity`)

| Event Type | Trigger Origin | Example Details |
| :--- | :--- | :--- |
| `search` | Discover query submission | `Submitted query 'deep learning transformer' across 4 sources` |
| `download` | Ingestion / PDF retrieval | `Started download for 'Attention Is All You Need'` |
| `collection` | Collection mutation | `Added paper 'AlphaFold' to 'Structural Biology'` |
| `import` | DOI or file ingestion | `Ingested local PDF document '2107.03819.pdf'` |
| `system` | Database seed / sync | `Synchronized 14 cached papers from local SQLite store` |

---

## 3. Hydration & Reactivity Cycle

1. **Mount**: `useEffect` in `AppContext` invokes `refreshHealth()` and `refreshDatabase()`.
2. **IPC Fetch**: Tauri invokes Rust backend via `invoke("list_papers")` and `invoke("list_collections")`.
3. **State Distribution**: Raw Rust SQLite records are converted using `dbPaperToPaper()` and `dbCollectionToCollection()`, populating `papers` and `collections`.
4. **Dashboard Ingestion**: `DashboardView` consumes the synchronized arrays, computing derived counts with zero re-fetching overhead.

