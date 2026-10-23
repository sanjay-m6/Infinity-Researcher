# UI and Interaction Specification

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Design Paradigm:** Desktop-Optimized, Accessible, Information-Dense, Minimalist  
**UI Framework:** React + TypeScript + Vite with Tailwind CSS v4 and Lucide Icons  

---

## 1. Global Navigation and Layout Frame

### 1.1 Shell Architecture
The desktop window consists of three persistent layout regions:
1. **Title / Drag Bar (Top, 36px):** Custom window controls (minimize, maximize, close), application title, active database breadcrumb, and global offline badge.
2. **Primary Navigation Rail (Left, 64px collapsed / 220px expanded):**
   * **Dashboard** (`/dashboard`) — Activity overview and system health.
   * **Search** (`/search`) — Multi-source federated academic discovery.
   * **Library** (`/library`) — Saved papers, collections, and tags.
   * **Jobs / Queue** (`/jobs`) — Background downloads, imports, and extractions.
   * **Sources** (`/sources`) — Connector configuration and diagnostics.
   * **Settings** (`/settings`) — Storage, network, and application preferences.
   * *Bottom Action:* Quick theme toggle (Dark / Light / System) and active job indicator badge.
3. **Workspace Canvas (Center / Right):** Active view with responsive split-pane or drawer overlay for paper inspection.
4. **Status Footer (Bottom, 24px):** Active storage directory indicator, active background queue count, offline/online status indicator.

---

## 2. Screen Specifications

### Screen 1: First-Run Setup & Directory Selection
* **Primary User Goal:** Initialize application storage, set data directory, and confirm polite API settings.
* **Primary Actions:**
  * Browse and select library storage directory (default `%USERPROFILE%\Documents\ResearchPapers`).
  * Enter optional researcher email for Crossref Polite Pool and polite User-Agent headers.
  * Click "Initialize & Start Researching".
* **Data Dependencies:** System filesystem probe for default document path.
* **UI States:**
  * *Default:* Clean two-column card with clear explanations of local-first storage.
  * *Validating:* Brief spinner while checking folder write permissions.
  * *Error:* Inline alert if selected path is read-only or invalid.
* **Keyboard / Accessibility:** `Tab` moves through directory input, browse button, email input, and submit; `Enter` triggers initialization. Screen reader labels on all inputs.

---

### Screen 2: Dashboard
* **Primary User Goal:** Review research activity, quick-access recent papers, monitor library growth, and view connector status.
* **Key Components:**
  * *Metric Cards:* Total Saved Papers, Downloaded PDFs, Total Collections, Storage Footprint (MB/GB).
  * *Recent Activity Feed:* Last 5 papers added or downloaded with one-click "Open" buttons.
  * *Connector Status Widget:* Grid of enabled academic sources with live health status badges (`Healthy`, `Rate Limited`, `Paused`).
  * *Quick Search Input:* Compact search bar with shortcut hint (`Ctrl+K`) that redirects to Search screen.
* **UI States:**
  * *Empty Library:* Displays welcoming "Welcome to Research Paper Scraper" onboarding banner with quick actions: "Start a Search" or "Import Existing PDFs".
* **Keyboard / Accessibility:** Direct skip-to-content links; all action buttons have explicit `aria-label` attributes.

---

### Screen 3: Global Federated Search
* **Primary User Goal:** Discover scholarly literature across multiple enabled academic sources in a single query.
* **Key Components:**
  * *Omni-Search Bar:* Query input with clear button, search button, and history dropdown.
  * *Source Toggle Bar:* Multi-select pill toggles (`All`, `OpenAlex`, `Crossref`, `Semantic Scholar`, `arXiv`, `Europe PMC`).
  * *Filter Toolbar:* Date range picker (from year to year), Open-Access Only toggle, Has Abstract toggle.
  * *Results Header:* Query execution stats (e.g. "84 papers found across 5 sources in 1.2s (1 source timed out)").
  * *Results Table / Card Stream:*
    * Paper Title (clickable).
    * Author list (formatted with `et al.` truncation).
    * Venue / Year pill badge.
    * Contributing Source badges (`[OpenAlex] [arXiv] [Crossref]`).
    * Full-Text Status Badge:
      * Green: `Download Available (Open Access)`.
      * Amber: `Preprint Only (arXiv)`.
      * Neutral: `Restricted / Paywalled (Manual Link Only)`.
    * Action Buttons: "Save to Library" (bookmark), "Download PDF" (if OA), "Open Landing Page" (external link).
* **UI States:**
  * *Idle:* Search prompt with suggested research topics or recent queries.
  * *Loading:* Skeleton cards with animated shimmer; source-by-source progress checklist (`✓ OpenAlex (25) | ✓ arXiv (18) | ⟳ Europe PMC...`).
  * *Partial Error:* Sticky top banner alerting that one source failed, with a "Retry [Source]" button.
  * *Zero Results:* Helpful empty state suggesting query refinements or broadening year filters.
* **Keyboard / Accessibility:** `Ctrl+K` focuses search bar; arrow up/down navigates result cards; `Enter` opens detail drawer.

---

### Screen 4: Paper Detail Drawer / Modal
* **Primary User Goal:** Comprehensive inspection of paper metadata, full abstract reading, author details, provenance, and note-taking.
* **Key Components:**
  * *Header:* Title, publication year, venue, canonical DOI badge with copy button.
  * *Authors Section:* List of authors with institutional affiliations and clickable ORCID badges.
  * *Abstract Panel:* Full formatted text with selectable typography and copy button.
  * *Source Provenance Tab:* Auditable list of each upstream provider that contributed data (e.g. Crossref raw record, OpenAlex ID).
  * *Actions Bar:* "Download PDF", "Save to Library", "Add to Collection", "Export BibTeX", "Open External Link".
  * *Local Notes Tab:* Split Markdown editor with live preview for personal research notes.
* **UI States:**
  * *File Available:* Displays "Open PDF in Viewer" and "Show in Folder" buttons.
  * *File Not Available (OA):* Displays "Download PDF (3.2 MB)".
  * *File Restricted:* Displays "Full Text Restricted by Publisher" with "Attach Local File" button.
* **Keyboard / Accessibility:** `Esc` closes drawer; focus trapped within drawer when open.

---

### Screen 5: Local Library
* **Primary User Goal:** Manage, filter, sort, organize, and browse all saved research papers offline.
* **Key Components:**
  * *Sidebar:* Collections tree (`All Papers`, `Unorganized`, custom collections), Tags filter list.
  * *Data Grid / Table:* High-performance virtualized table supporting columns: Title, Authors, Year, Venue, Files, Collections, Tags, Date Added.
  * *Column Sorting:* Clickable headers for Title, Year, Date Added.
  * *Bulk Action Bar:* Multi-select checkboxes triggering "Add to Collection", "Assign Tag", "Export Citations", or "Delete from Library".
* **UI States:**
  * *Filtered Empty State:* "No papers match tag 'review-pending'. Clear filter."
  * *Offline Mode:* Subtle banner in header: "Offline Mode Active — Local Library Fully Operational".
* **Keyboard / Accessibility:** Full table navigation via arrow keys; spacebar toggles row selection; `Delete` triggers delete confirmation dialog.

---

### Screen 6: Downloads & Job Queue Panel
* **Primary User Goal:** Monitor, cancel, pause, and retry background network and disk tasks.
* **Key Components:**
  * *Active Jobs List:* Progress bars displaying byte progress, transfer rate, and percentage.
  * *Completed Jobs Log:* List of succeeded downloads with direct "Open File" buttons.
  * *Failed / Cancelled Queue:* Explicit error descriptions (e.g. "HTTP 403: Publisher Forbidden", "Connection Timeout") with individual "Retry" buttons.
  * *Global Controls:* "Pause All", "Resume All", "Clear Completed".
* **UI States:**
  * *Active Transfers:* Animated progress bars with real-time byte counts.
  * *Idle:* "No active background tasks."

---

### Screen 7: Import Workflow (Existing PDFs)
* **Primary User Goal:** Ingest desktop PDF files or directories into the structured library.
* **Key Components:**
  * *Drag-and-Drop Dropzone:* Accepts `.pdf` files or folder drops.
  * *Import Options:*
    * Checkbox: "Auto-fetch metadata from Crossref/OpenAlex via extracted DOI".
    * Checkbox: "Extract text layer for offline full-text search".
    * Radio: "Copy files to library directory" vs "Link files in place".
  * *Batch Progress Modal:* Shows total files scanned, verified DOIs found, metadata backfilled, and any corrupt/encrypted files skipped.
* **UI States:**
  * *Analyzing:* Fast spinner reading PDF headers and computing SHA-256.
  * *Summary Report:* Collapsible table listing each imported file and its metadata confidence.

---

### Screen 8: Collections, Tags, and Notes Workspace
* **Primary User Goal:** Dedicated hierarchical workspace for literature synthesis and thesis/paper drafting.
* **Key Components:**
  * Left pane: Nested collection folder tree and tag management dialogs.
  * Center pane: Filtered paper list belonging to selected collection.
  * Right pane: Unified Markdown research notebook linked to collection.

---

### Screen 9: Source Manager & Connector Diagnostics
* **Primary User Goal:** Inspect connector status, rate limits, configure optional API keys, and test provider health.
* **Key Components:**
  * Connector Card for each source (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ, CORE).
  * On/Off Switch to enable or disable source globally.
  * Health Indicator: "Last Ping: 200 OK (320ms)".
  * Rate Limit Meter: Shows remaining hourly/daily credits or current requests-per-second throttle.
  * Optional Key Field: Input for free Semantic Scholar or OpenAlex keys.
  * Diagnostic Link: "Test Connection".

---

### Screen 10: Preferences & Settings
* **Primary User Goal:** Configure storage paths, network behavior, backup, and diagnostics.
* **Sections:**
  1. *Storage:* Library root path with "Change Folder" and "Relocate Existing Files" workflow.
  2. *Network & Etiquette:* Polite email address, global concurrent download ceiling (default 6), custom proxy settings if required.
  3. *Search & Indexing:* Enable/disable PDF full-text indexing; clear search history; rebuild FTS5 index.
  4. *Backup & Export:* "Export Entire Library (.zip)", "Restore Library from Backup".
  5. *Logs & Diagnostics:* "View Application Log", "Export Sanitized System Report".

---

### Screen 11: Error, Empty, and Offline States
* **Offline State:** UI indicates offline connectivity through a non-intrusive status pill. Online search inputs display disabled states with clear tooltips.
* **Network Error Dialog:** Specific guidance when an academic provider returns HTTP 429 or 503, offering backoff countdown timer.
* **Database Corruption Safeguard:** If SQLite detects an unrecoverable disk error, app launches in Safe Recovery Mode offering to restore the latest automatic database snapshot.
