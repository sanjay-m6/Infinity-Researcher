# Product Requirements Document (PRD)

**Project:** Research Paper Scraper  
**Product Type:** Standalone, Local-First Desktop Research Application  
**Target Platforms:** Windows desktop first; architecture portable to macOS and Linux  
**Status:** Approved Specification  
**Version:** 1.0.0  

---

## 1. Problem Statement & Mission

Researchers, academics, students, and independent scholars face severe fragmentation across scholarly literature services:
1. **Siloed Discovery:** Finding papers requires repeating queries across multiple platforms (arXiv, PubMed/Europe PMC, Crossref, OpenAlex, Semantic Scholar, publisher portals).
2. **Metadata Discrepancies:** Different sources provide conflicting, incomplete, or proprietary metadata representations (e.g. inverted abstracts, missing DOIs, differing author representations).
3. **Full-Text Access Friction:** Many platforms display papers that appear accessible, only for researchers to encounter paywalls, broken download links, or restricted syndication. Legally authorized open-access papers are scattered across institutional repositories and preprint servers.
4. **Library Disorder:** Downloaded PDFs pile up in arbitrary folders with unreadable filenames (e.g., `download.pdf`, `10.1145_3318464.pdf`), lacking structured metadata, full-text searchability, or persistent organizational tags.
5. **Privacy & Vendor Lock-in:** Cloud-hosted reference managers require mandatory accounts, sync private research notes to third-party servers, and restrict local-first ownership of research libraries.

### The Mission
Build a local-first, standalone desktop application that empowers researchers to search across authorized academic services simultaneously, collect and normalize verified metadata, download permitted open-access PDFs safely, organize a structured offline library, search extracted full text, and export standardized citations—with **zero mandatory cloud backend**, zero telemetry of private libraries, and strict respect for academic licensing and publisher terms.

---

## 2. Target Users & Personas

### 2.1 Evaluated User Groups
* **Postgraduate & PhD Researchers:**  
  * *Needs:* Systematic literature reviews, tracking state-of-the-art across preprints (arXiv) and peer-reviewed journals, maintaining clean BibTeX libraries for LaTeX manuscripts.  
  * *Constraints:* High volume of papers; sensitive to rate limits; requires fast multi-source deduplication.
* **Academic Faculty & Research Assistants:**  
  * *Needs:* Rapid cross-checking of citations, discovering open-access versions for lab members, organizing papers by grant/project.  
  * *Constraints:* Institutional network environments; strict citation integrity.
* **Independent Researchers & Practitioners:**  
  * *Needs:* Broad topic discovery without institutional journal subscriptions; reliance on legitimate open-access copies (DOAJ, arXiv, PMC Open Access, OpenAlex OA).  
  * *Constraints:* No institutional library proxy access; strict reliance on authorized open access.
* **Researchers with Large Existing PDF Folders:**  
  * *Needs:* Ingesting hundreds of existing local PDFs, extracting DOIs, populating structured metadata automatically, and searching full text offline.  
  * *Constraints:* Corrupted PDFs, scanned papers without text layers, non-standard naming conventions.

### 2.2 Primary Persona for Release 1 (MVP)
* **Persona:** "Dr. Elena Rostova", Postdoctoral Researcher in Computational Biology & Machine Learning.
* **Key Workflow:** Elena conducts literature surveys combining preprints (arXiv), life sciences articles (Europe PMC), and cross-disciplinary papers (OpenAlex/Crossref). She needs to execute a single query, see unified deduplicated results with clear open-access download indicators, download authorized PDFs into her local storage with structured filenames (`{Author}_{Year}_{Title}.pdf`), take Markdown notes, and export clean BibTeX citations without leaving her desktop.

---

## 3. Functional Requirements (Traceable Register)

### Requirement Priority Scale
* **P0 (Critical / MVP):** Mandatory for the first usable local-first release.
* **P1 (High / Fast Follow):** High-value extension built directly on MVP foundations.
* **P2 (Deferred / Future):** Advanced or specialized capability.

| ID | Title & Statement | Rationale | Priority | Dependencies | Acceptance Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-001** | **Multi-Source Federated Search**<br>Execute concurrent queries across enabled academic sources (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC). | Eliminates siloed querying; unifies multi-disciplinary discovery. | **P0** | Source Adapters | Query "quantum computing" returns unified results from all enabled sources with source attribution. |
| **FR-002** | **Source Selector & Toggles**<br>Allow user to enable/disable specific sources and set per-source query filters. | Researchers often need domain-specific queries (e.g. arXiv for ML, Europe PMC for genetics). | **P0** | UI, Config | Disabling Europe PMC excludes it from dispatch; re-enabling immediately includes it. |
| **FR-003** | **Query Normalization & Validation**<br>Sanitize search input, trim whitespace, validate syntax, and reject empty/malformed inputs before network dispatch. | Prevents API errors and protects against malformed request payloads. | **P0** | Search Service | Whitespace-only query displays helpful validation message without triggering network calls. |
| **FR-004** | **Partial Failure Handling**<br>If one source fails or times out, display results from surviving sources with explicit diagnostic banner. | Network glitches or upstream provider outages must not crash or block the entire search. | **P0** | Search Orchestrator | When arXiv returns HTTP 503, OpenAlex/Crossref results are shown alongside an "arXiv unavailable" badge. |
| **FR-005** | **Metadata Normalization**<br>Normalize disparate provider payloads into a unified `PaperCandidate` schema (canonical DOI, title, author list, abstract, venue, year, license). | Inverted indexes (OpenAlex) and XML records (arXiv) must map into a predictable, typed UI structure. | **P0** | Normalizer Module | Abstract from OpenAlex inverted index correctly renders as coherent prose matching original text. |
| **FR-006** | **Deterministic DOI Canonicalization**<br>Normalize all DOI variations (`https://doi.org/...`, `doi:...`, uppercase/lowercase) to lowercase `10.xxxx/...`. | Prevents duplicate library records caused by URL or casing variations. | **P0** | Normalizer Module | `https://doi.org/10.1145/12345.67` and `10.1145/12345.67` match the exact same canonical DOI key. |
| **FR-007** | **Cautious Deduplication & Merging**<br>Automatically match identical records on canonical DOI or stable source ID (e.g. arXiv ID). Flag similar titles for user review without auto-merging. | Erroneous auto-merges corrupt research citations; strong IDs guarantee safe deduplication. | **P0** | Deduplication Engine | Two records with matching DOI merge into one card with combined source badges; different DOIs remain distinct. |
| **FR-008** | **Full-Text / PDF Availability Indicator**<br>Clearly display whether a paper is "Open Access (Download Available)", "Manual Link Only", or "Restricted/Paywalled". | Prevents user frustration and establishes transparency around legal availability. | **P0** | Source Adapters, UI | OA paper shows green "Download PDF" button; paywalled paper shows neutral "Open Publisher Link" button. |
| **FR-009** | **Safe Streaming Download Pipeline**<br>Download authorized PDFs directly to a temporary file, verify magic numbers (`%PDF-`), enforce size limits ($\le 100\text{MB}$ default), and atomic move to library. | Prevents memory exhaustion from large files and prevents HTML error pages from being saved as PDFs. | **P0** | Storage Layer, Network Layer | Downloading an HTML error page (e.g. 403 response) aborts without saving a corrupted `.pdf` into library. |
| **FR-010** | **SSRF & Network Boundary Protection**<br>Block private IP ranges (RFC 1918), loopback (`127.0.0.1`), link-local, and cloud metadata endpoints on all outbound HTTP requests and redirects. | Protects researcher desktop environment against SSRF vulnerabilities via malicious upstream redirect URLs. | **P0** | HTTP Client | A redirect pointing to `http://127.0.0.1:8080` or `169.254.169.254` is aborted with a security violation error. |
| **FR-011** | **Bounded Concurrency & Rate Limiting**<br>Enforce strict per-host rate limits (e.g. max 1 req/3s for arXiv, 1 req/s for S2AG) and bounded global concurrency. | Prevents IP bans and adheres strictly to published provider terms and polite usage etiquette. | **P0** | Job Queue | 10 rapid queries to arXiv are queued and dispatched with $\ge 3\text{s}$ interval between requests. |
| **FR-012** | **Job Queue, Cancellation & Retry**<br>Provide observable background queue for downloads and imports with live progress, pause, cancel, and exponential backoff retry. | Desktop users must retain full control over background network I/O and disk operations. | **P0** | Job Manager | Clicking "Cancel" on an active download stops the network stream and cleans up partial `.tmp` files. |
| **FR-013** | **Local Persistent SQLite Storage**<br>Store library papers, authors, source provenance, collections, tags, notes, and file paths in a local SQLite database with migrations. | Local-first design; library remains fully accessible and fast without internet connection. | **P0** | Database Repository | App restart loads full saved library with zero network calls in offline mode. |
| **FR-014** | **Collections, Tags, and Markdown Notes**<br>Allow users to create organizational collections/folders, assign arbitrary colored tags, and author local Markdown research notes. | Core research workflow for literature synthesis and project-based paper organization. | **P0** | Library Service | User creates collection "Thesis Chapter 2", adds 5 papers, writes notes; data persists across restarts. |
| **FR-015** | **Offline Local Library Search**<br>Provide instant local search across saved paper titles, authors, abstracts, collections, tags, and user notes. | Researchers need fast offline retrieval when writing or traveling without internet access. | **P0** | SQLite / FTS5 | Typing an author name in offline mode immediately filters the saved library table in $< 50\text{ms}$. |
| **FR-016** | **Local PDF Import & Ingestion**<br>Allow user to select individual PDF files or an entire folder to import into the library with automated checksum calculation and DOI regex extraction. | Empowers researchers with existing desktop collections to migrate into the app. | **P0** | Ingestion Engine | Importing `mypaper.pdf` computes SHA-256, extracts DOI `10.1145/...`, fetches Crossref metadata, and registers file. |
| **FR-017** | **Citation & Metadata Export (BibTeX, RIS, CSV, JSON)**<br>Export selected papers or entire collections into valid, deterministic BibTeX (`.bib`), RIS (`.ris`), CSV, and JSON formats. | Essential for writing papers in LaTeX, Word, or importing into reference tools. | **P0** | Export Service | Selected paper exports as standard `@article{...}` entry with escaped special characters and UTF-8 encoding. |
| **FR-018** | **Configurable Library Storage Directory**<br>Allow user to choose custom filesystem directory for paper PDFs, with default pointing to OS user data directory. | Respects user storage preferences (e.g. secondary NVMe drive, external SSD). | **P0** | Config & Storage | Changing library path to `D:\ResearchStorage` moves or redirects subsequent downloads safely. |
| **FR-019** | **Full-Text PDF Text Extraction & Indexing**<br>Extract plain text layers from downloaded/imported PDFs and index content in SQLite FTS5 for in-document full-text search. | Researchers frequently remember a phrase or equation inside a paper without remembering title/author. | **P1** | Text Extractor, FTS5 | Querying "backpropagation through time" matches a paper whose abstract does not contain the phrase. |
| **FR-020** | **Manual Duplicate Review & Merge Workspace**<br>Interactive side-by-side UI to review potential duplicates flagged by fuzzy title matching, select preferred metadata fields, and merge records. | Preserves provenance and gives user total control over resolving conflicting records. | **P1** | Deduplication UI | User reviews Paper A and Paper B, selects Paper A's abstract and Paper B's journal name, and merges cleanly. |
| **FR-021** | **DOAJ & CORE Connector Integrations**<br>Implement Tier A connectors for Directory of Open Access Journals and CORE open repositories. | Expands open-access discovery into peer-reviewed OA journals and university repositories. | **P1** | Source Adapters | DOAJ and CORE queries execute and integrate into unified search stream with verified OA links. |
| **FR-022** | **Dark / Light Theme & Keyboard Navigation**<br>Support full system-aware dark and light themes, accessible high-contrast colors, and comprehensive keyboard shortcuts (search, navigation, actions). | Ergonomic desktop experience for intensive reading and accessibility compliance. | **P0** | UI Design System | Pressing `Ctrl+K` focuses global search; `Esc` clears dialogs; table navigable via arrow keys. |

---

## 4. Non-Goals and Explicit Exclusions

To maintain legal integrity, technical stability, and a focused scope, the following capabilities are explicitly **excluded** from the application:
1. **No Universal / Black-Box Website Scraping:** The app will never promise or attempt to scrape "every website". Web retrieval is restricted to documented APIs and authorized Tier B structured feeds.
2. **No Circumvention of Paywalls or Access Controls:** The app will never attempt to bypass publisher paywalls, subscription logins, CAPTCHAs, DRM, or anti-bot protections.
3. **No Credential Storage for Publisher Accounts:** The app will not ask for or store user passwords for publisher portals (e.g. IEEE Xplore, ScienceDirect, SpringerLink).
4. **No Mandatory Cloud Backend or User Accounts:** The core application operates entirely on the local machine with no external server required for library management or storage.
5. **No Mandatory AI APIs or Cloud LLMs:** The application is a standalone research tool. It will not require paid OpenAI/Anthropic API keys to perform core indexing, searching, or library tasks.
6. **No Automated Bulk Corpus Crawling:** The app will not execute unthrottled bulk scraping loops that violate source terms or risk user IP banning.
7. **No Browser Extension or Mobile App (MVP Scope):** The MVP target is a focused Windows desktop application (portable to macOS/Linux). Browser extensions are deferred.
