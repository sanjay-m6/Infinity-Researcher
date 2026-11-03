# Phase 11: Discover Papers Pre-Implementation Audit & Baseline Analysis

## 1. Executive Summary

As part of **Phase 11 — Discover Papers Modernization**, an exhaustive audit of Infinity Researcher's academic discovery workspace (`src/features/discover/DiscoverView.tsx`), scraping subsystems (`src-tauri/src/scrapers/`), Python engine (`python-engine/`), and session management (`discoverSessionStore.ts`) was executed.

Infinity Researcher provides a desktop-grade three-pane academic workbench:
- **Left Pane**: Search input, academic source selector, filter drawer, and discovered paper cards.
- **Center Pane**: Integrated PDF viewer (`EmbeddedPdfViewer`) for instant in-situ reading of local and open-access documents, plus graceful metadata fallbacks.
- **Right Pane**: Multi-tab metadata inspector, grounded AI paper assistant, automated insight summaries, and persistent SQLite research notes.

---

## 2. Baseline Architecture & Subsystem Inspection

| Component / Subsystem | Path / Module | Role & Technologies | Audit Findings |
| :--- | :--- | :--- | :--- |
| **Discover View** | `src/features/discover/DiscoverView.tsx` | Main three-pane React 19 workspace | Comprehensive UI with query streaming, multi-source filters, drag-to-resize panes, and inline reader. Required WCAG 2.1 AA keyboard support and global search sync. |
| **Discover Session Store** | `src/features/discover/discoverSessionStore.ts` | In-memory singleton & `localStorage` cache | Backs search query, discovered results, source statuses, filters, and active tab across route switches and remounts. |
| **Rust Scraper Engine** | `src-tauri/src/scrapers/` | High-throughput native Rust static HTML & REST scrapers | Native adapters for arXiv, bioRxiv, medRxiv, PLOS, Nature Scientific Reports, PMC, and IEEE Xplore. Robust robots.txt compliance. |
| **Python Scraper Engine** | `python-engine/src/paper_scraper/` | Scrapy + Playwright headless worker subprocess | Multi-engine fallback supporting anti-SSRF protections, dynamic JS execution, and candidate expansion. 109 passing unit tests. |
| **PDF Viewer Subsystem** | `src/components/pdf-viewer/EmbeddedPdfViewer.tsx` | PDF.js-powered embedded canvas reader | Direct display of local PDF binaries and remote open-access PDFs with annotation, search, and citation jump triggers. |
| **Research Library Store** | `src/context/AppContext.tsx` | SQLite-backed desktop research library | Cross-referencing discovered papers against local library (`papers` state) to show import/download status. |
| **Global Search Integration** | `src/components/ui/CommandPalette.tsx` | Desktop command palette (`Ctrl+K`) | Dispatches `executeGlobalSearch(query)` which navigates to Discover with `globalSearchQuery`. |

---

## 3. Analysis of Pre-Implementation Deficits & Bugs

Prior to Phase 11 modernization, several UX and reliability deficits were diagnosed:

1. **Disappearing Results on Navigation**:
   - *Previous Defect*: Navigating away from Discover to Dashboard or Library would reset in-memory component state in earlier versions.
   - *Remediation*: Discover state is preserved in two independent layers:
     - `AppShell.tsx`: Container uses `<div className={activeSection === "discover" ? "" : "hidden"}><DiscoverView /></div>`, keeping the virtual DOM and scroll positions preserved during session navigation.
     - `discoverSessionStore.ts`: Persists query, results, source status, and filters to `localStorage` (`paper_desktop_discover_session_v1`).
2. **Global Search Handoff Disconnect**:
   - *Defect*: When a user activated the Command Palette or Dashboard Quick Find and clicked "Search Online in Discover", `AppContext` updated `globalSearchQuery`, but `DiscoverView` only inspected it on initial `useState` initialization. Mounted instances never triggered the search.
   - *Remediation*: Added reactive `useEffect` monitoring `globalSearchQuery`, updating `searchQuery` and invoking `handleExecuteSearch(globalSearchQuery)`.
3. **Empty-Query & Overlapping Requests**:
   - *Defect*: Submitting empty queries risked launching expensive headless crawls; rapid queries could result in out-of-order race conditions.
   - *Remediation*: Empty query validation with warning toast; unique `session_id` tagging (`search_${Date.now()}_...`) that discards stale stream events.
4. **Falsy Year Filter Bypass**:
   - *Defect*: Year filter checked `filterYearStart && p.publication_year && p.publication_year < filterYearStart`. Papers with null years bypassed the check and were shown.
   - *Remediation*: Explicit strict null checks ensuring papers with undefined years are excluded when a start year is enforced.
5. **Truthful PDF Availability**:
   - *Audit*: Verified that abstract pages are not misrepresented as direct PDF downloads. Verified PDFs ("Verified PDF" badge), locally saved files ("Saved Offline"), and metadata-only papers ("Metadata Only") are visually and functionally distinct.
6. **Accessibility Deficits (WCAG 2.1 AA)**:
   - *Defect*: Paper cards lacked `role="button"`, `tabIndex={0}`, accessible names, and keyboard selection; inputs lacked explicit `aria-label`; results header lacked screen-reader live regions.
   - *Remediation*: Integrated complete ARIA semantics, polite live region announcements, and keyboard navigation.

