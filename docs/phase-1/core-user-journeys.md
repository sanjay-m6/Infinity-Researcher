# Core User Journeys Specification

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Verified  

---

## Journey 1: First Launch & Initial Setup
* **Trigger:** User launches the application for the first time on Windows desktop.
* **Steps:**
  1. Application checks for existing database and configuration in `%APPDATA%\ResearchPaperScraper`.
  2. Welcome wizard modal appears, introducing the local-first philosophy and asking the user to confirm or choose the Library Storage Directory (defaulting to `%USERPROFILE%\Documents\ResearchPapers`).
  3. User accepts or selects a custom directory (e.g., `D:\ResearchLibrary`).
  4. User is presented with default academic sources enabled (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC) and an optional field to input contact email for Crossref Polite Pool (`mailto`) and polite User-Agent headers.
  5. User clicks "Complete Setup".
* **Visible Feedback:** Smooth onboarding cards; directory path selector with folder browse dialog; confirmation badge indicating "Storage Directory Initialized & Database Ready".
* **Saved State:**
  * SQLite database initialized with schema migrations at version 1.
  * `app_settings` table populated with storage path, polite email, enabled sources, and default concurrency limits.
* **Error Cases:**
  * *Selected directory is read-only or on an inaccessible network drive:* App displays descriptive error: "Unable to write to selected folder. Please choose a directory with write permissions." Wizard remains on directory selection step.
* **Success Condition:** User transitions directly to the main Dashboard with zero errors and an empty, clean library state.

---

## Journey 2: Search for a Topic Across Enabled Academic Sources
* **Trigger:** User types "graph neural networks drug discovery" into the global search bar on the Search screen and presses Enter or clicks "Search".
* **Steps:**
  1. Frontend validates query (non-empty, length $\ge 2$ characters).
  2. Tauri command `search_papers` is invoked with query, selected source list, and default limit (e.g. 25 per source).
  3. Rust search service dispatches concurrent async tasks to enabled source adapters (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC) bounded by their respective rate limiters.
  4. As adapters return normalized candidates, stream events emit progress to the UI.
  5. Search orchestrator runs deduplication pass on normalized DOIs and stable IDs, merging duplicate candidates into single unified result cards.
  6. Results display in an interactive table/card view sorted by relevance or publication date.
* **Visible Feedback:** Animated progress bar showing completed sources (e.g. "4/5 sources responded — 82 candidates found"); responsive skeleton loaders; deduplication badges showing combined sources (e.g. `[OpenAlex] [arXiv] [Crossref]`).
* **Saved State:** Query and timestamp saved to `search_history` (if enabled in settings). Transient candidates held in frontend query cache.
* **Error Cases:**
  * *One source times out (e.g. Europe PMC):* Surrounding 4 sources populate the list; an amber alert badge appears: "Europe PMC timed out after 10s. Showing results from 4 sources. [Retry Europe PMC]".
  * *Network offline:* Immediate toast: "Network unreachable. Check your connection or search your offline library."
* **Success Condition:** Deduplicated list of papers is rendered with complete titles, authors, venues, years, and actionable "Save to Library" or "Download PDF" buttons.

---

## Journey 3: Search One Specific Source
* **Trigger:** User wants to find a specific computer science preprint on arXiv.
* **Steps:**
  1. On Search screen, user toggles off "All Sources" and selects only "arXiv".
  2. User enters query `cat:cs.LG AND "diffusion models"` and clicks Search.
  3. Backend dispatches query exclusively to arXiv Atom API adapter, respecting the arXiv rate limiter (1 req / 3s).
  4. Results stream directly into the UI.
* **Visible Feedback:** Source badge explicitly displays "Showing arXiv results only"; total result count returned from arXiv Atom feed.
* **Saved State:** Current search view filter preserved in UI session state.
* **Error Cases:**
  * *Invalid arXiv query syntax:* arXiv returns XML error response; adapter maps error into human-readable message: "arXiv query syntax error. Please check category qualifiers."
* **Success Condition:** Targeted arXiv preprints display with direct arXiv IDs, category tags, and preprint PDF indicators.

---

## Journey 4: Inspect a Search Result & Open Its Source Record
* **Trigger:** User clicks on a paper card titled "Attention Is All You Need".
* **Steps:**
  1. Detail drawer or page opens on the right side of the screen.
  2. View displays normalized bibliographic details: full title, formatted author list with affiliations/ORCIDs where available, complete abstract, publication venue, publication date, canonical DOI, citation counts, and licensing metadata.
  3. "Source Provenance" panel lists all contributing academic providers (e.g. "Crossref: DOI 10.48550/arXiv.1706.03762", "OpenAlex: W2963403866").
  4. User clicks "Open Landing Page" or "View on arXiv".
  5. Application invokes safe system browser launcher for the verified HTTPS URL.
* **Visible Feedback:** Rich, structured typography; copy-to-clipboard buttons for DOI and citation; external link icon with tooltip showing target URL.
* **Saved State:** None (read-only inspection).
* **Error Cases:**
  * *Missing URL or invalid scheme:* If provider payload contains an unresolvable or non-HTTPS URL, link button is disabled with tooltip "No secure canonical URL provided by source."
* **Success Condition:** User reads complete paper metadata and external source page opens securely in default OS web browser.

---

## Journey 5: Add a Result to the Local Library
* **Trigger:** User clicks "Save to Library" (bookmark icon) on a paper search card.
* **Steps:**
  1. Frontend calls Tauri command `add_paper_to_library` with candidate payload.
  2. Rust service verifies whether paper already exists in `papers` table via canonical DOI or source ID.
  3. If not present:
     * Creates new record in `papers`.
     * Creates or links `authors` records via `paper_authors`.
     * Creates `source_records` entry containing original provider ID, raw JSON payload, and retrieval timestamp.
  4. Returns saved paper entity with generated UUID.
* **Visible Feedback:** Bookmark icon transitions immediately from outline to filled primary color; toast notification: "Saved to Library".
* **Saved State:** Database transaction committed: 1 `papers` row, N `authors` rows, 1+ `source_records` rows.
* **Error Cases:**
  * *Paper already saved in library:* Toast displays: "Already in library. Updated source provenance." Icon updates to saved state.
* **Success Condition:** Paper appears immediately in the "Library" tab with all metadata retained offline.

---

## Journey 6: Download an Openly Available or Authorized PDF
* **Trigger:** User clicks "Download PDF" on an open-access paper (e.g. an arXiv paper or PubMed Central OA paper).
* **Steps:**
  1. Frontend calls `queue_pdf_download` with paper ID and verified open-access URL.
  2. Backend validates URL: checks HTTPS scheme, validates that domain does not resolve to private/loopback IP (SSRF guard), verifies source connector permission status.
  3. Job is inserted into `jobs` table with state `queued` and assigned to download worker queue.
  4. Worker executes HTTP GET with polite User-Agent, streaming bytes into a temporary file (`.tmp`) in application storage.
  5. Worker verifies HTTP status 200, checks response size $\le 100\text{MB}$, and validates PDF magic bytes (`%PDF-`).
  6. Worker computes SHA-256 hash, generates safe canonical filename: `{FirstAuthor}_{Year}_{SlugifiedTitle}.pdf` (e.g., `Vaswani_2017_Attention_Is_All_You_Need.pdf`).
  7. Worker atomically renames `.tmp` file into the library document directory.
  8. Inserts row into `files` table and updates `papers.has_file = 1`.
  9. Emits progress and completion events to frontend.
* **Visible Feedback:** Download button displays circular spinner with percentage progress; upon completion, transitions to "Read PDF" / "Open File" button.
* **Saved State:**
  * PDF stored safely on filesystem.
  * `files` record linked to `paper_id` with checksum, size in bytes, and relative file path.
  * `jobs` record marked `completed`.
* **Error Cases:**
  * *Server returns HTML error page (e.g. 403 or paywall landing) with `.pdf` extension:* Validator detects absence of `%PDF-` magic header; download is aborted; temporary file is deleted; error logged: "Invalid file format: server returned HTML instead of PDF."
  * *Connection drops at 60%:* Backoff retry triggers up to 3 times; if still failing, job marked `failed` with "Connection lost. Click to retry." Temporary file purged.
* **Success Condition:** Valid PDF file is stored locally, associated with paper record, and can be opened in default PDF reader or internal viewer.

---

## Journey 7: Handle a Record Whose Full Text is Unavailable or Restricted
* **Trigger:** User searches a topic and finds a high-impact paper published in a closed-access commercial journal (e.g. Elsevier / Springer Nature) with no open-access preprint.
* **Steps:**
  1. Source adapter receives metadata from Crossref / OpenAlex where `is_oa == false` and no open repository URL is registered.
  2. Normalizer marks full-text status as `Restricted / Paywalled`.
  3. UI renders the paper card with complete bibliographic metadata, abstract, and DOI.
  4. "Download PDF" button is replaced with a clear, neutral badge: "Full Text Restricted (Subscription Required)" alongside an "Open Publisher Page" button.
  5. If user clicks "Save to Library", metadata, abstract, and publisher link are saved locally.
  6. User is informed: "Metadata and abstract saved. To attach a PDF manually if you have institutional access, use 'Attach Local File'."
* **Visible Feedback:** Clear visual hierarchy indicating metadata-only availability; zero misleading "downloading..." spinners; no fake error messages.
* **Saved State:** Paper saved in library with `has_file = 0`.
* **Error Cases:**
  * User clicks "Attach Local File": Standard OS file picker opens allowing user to select a legally obtained PDF from their machine.
* **Success Condition:** Researcher retains complete bibliographic record and citation capabilities without violating publisher access controls or encountering silent download crashes.

---

## Journey 8: Import Existing Local PDFs & Extract Available Metadata
* **Trigger:** User has a desktop folder with 50 downloaded research PDFs and selects "Import Local PDFs" from Library view.
* **Steps:**
  1. User selects "Import Folder" and picks `C:\Users\Elena\Downloads\Papers`.
  2. App creates an import batch job in `jobs` table and displays progress modal.
  3. For each PDF in folder:
     * Validates file is non-empty and has `%PDF-` magic header.
     * Computes SHA-256 checksum to prevent duplicate imports.
     * Reads PDF metadata dictionary (Title, Author, CreationDate) using Rust PDF parser.
     * Extracts text from first 2 pages and runs regex patterns to locate DOI (`10.\d{4,9}/[-._;()/:A-Za-z0-9]+`) and arXiv ID (`\d{4}\.\d{4,5}`).
     * If DOI is found: queries local library first; if not found locally, queries Crossref/OpenAlex to fetch full canonical metadata (authors, abstract, journal, year).
     * If no DOI found: creates paper record from PDF document title or cleaned filename, marking metadata status as "Extracted from File (Unverified)".
     * Copies or links PDF into application library storage.
  4. Batch completes and displays import summary: "46 papers imported with full metadata, 4 imported with filename metadata only."
* **Visible Feedback:** Real-time progress bar (e.g. "Processing 14/50: Vaswani_2017.pdf"); detailed completion report modal.
* **Saved State:** 50 new/updated paper records, 50 file records, and associated author links committed to SQLite.
* **Error Cases:**
  * *Corrupted or password-encrypted PDF encountered:* File skipped; error recorded in job summary: "Protected or corrupted PDF: paper_scan.pdf. Skipped." File does not crash the queue.
* **Success Condition:** Local PDFs are ingested, organized, linked to verified metadata where possible, and searchable in the library.

---

## Journey 9: Review & Merge Likely Duplicates
* **Trigger:** User imports a paper that has a slight title variation and no DOI, or clicks "Review Duplicates" in the Library maintenance menu.
* **Steps:**
  1. Deduplication analyzer detects two papers with high title Jaro-Winkler similarity ($> 0.92$) and matching publication year, but differing source IDs.
  2. App places a duplicate banner at the top of the Library: "2 potential duplicate pairs found. [Review]".
  3. User clicks "Review" to open the Side-by-Side Merge Workspace.
  4. Screen displays Candidate A (from arXiv) on the left and Candidate B (from Crossref) on the right, highlighting conflicting fields (e.g. arXiv preprint abstract vs published journal abstract).
  5. User selects preferred values (or clicks "Accept Suggested Merge").
  6. User clicks "Confirm Merge".
  7. Rust service:
     * Designates Candidate A as canonical.
     * Re-links all `source_records`, `files`, `notes`, `tags`, and `collection_papers` from Candidate B to Candidate A.
     * Deletes Candidate B.
     * Records merge audit log in database.
* **Visible Feedback:** Visual diff highlighting (green/amber highlights for matching vs diverging fields); confirmation modal with "Undo" toast option.
* **Saved State:** Consolidated canonical record with preserved provenance; total library count decremented by 1.
* **Error Cases:**
  * *User determines they are different papers (e.g. Part 1 and Part 2 of a study):* User clicks "Not a Duplicate"; system records distinct pair ID to prevent future duplicate prompts.
* **Success Condition:** Library cleanliness is restored without accidental data loss or silent overwriting of research notes.

---

## Journey 10: Search the Local Library While Offline
* **Trigger:** User is working on a flight with no internet access and wants to find all papers discussing "transformer attention complexity".
* **Steps:**
  1. User opens application; app detects no internet connection (network check fails gracefully).
  2. UI displays subtle offline badge in status bar ("Offline Mode — Local Library Active").
  3. User types "transformer attention complexity" in Library search bar.
  4. Frontend queries local SQLite FTS5 virtual table across indexed titles, abstracts, author names, tags, and user notes.
  5. Matches return in $< 20\text{ms}$ with highlighted search snippets.
  6. User clicks a result to view full metadata, notes, and clicks "Open PDF" to read the locally cached document in their PDF viewer.
* **Visible Feedback:** Instant search response; snippet highlighting matching terms; offline indicator; fully operational PDF opening.
* **Saved State:** None.
* **Error Cases:**
  * *User tries to trigger an online search:* App displays alert: "Online search unavailable while offline. Connect to the internet to query academic sources."
* **Success Condition:** Researcher conducts uninterrupted literature study and reading using local data without network dependencies.

---

## Journey 11: Organize Papers into Collections, Tags, and Add Notes
* **Trigger:** User wants to organize papers for their upcoming conference submission.
* **Steps:**
  1. In Library sidebar, user clicks "+" next to Collections and types "NeurIPS 2027 Survey".
  2. User selects 3 relevant papers from the library table and drags them into the new collection (or uses bulk action "Add to Collection").
  3. User opens paper detail for Paper 1, adds color tag `Review-Pending` and `Key-Reference`.
  4. User clicks "Notes" tab in detail view, writes research commentary in rich Markdown editor ("Strong theoretical bound in Section 4; check equation 12 against Theorem 3").
  5. Editor auto-saves with debounced local transaction.
* **Visible Feedback:** Collection count increments to 3; colorful tag pills appear on paper cards; "Saved" checkmark indicator in note editor.
* **Saved State:** Records created in `collections`, `collection_papers`, `tags`, `paper_tags`, and updated `notes` row.
* **Error Cases:**
  * *Collection name already exists:* Validation error: "A collection with this name already exists."
* **Success Condition:** Hierarchical and faceted organization is saved locally and instantly queryable.

---

## Journey 12: Export Citations or Metadata
* **Trigger:** User finishes writing a paper section and needs a BibTeX file of all papers in "NeurIPS 2027 Survey".
* **Steps:**
  1. User right-clicks "NeurIPS 2027 Survey" collection or selects papers and clicks "Export".
  2. Export dialog offers format selection: BibTeX (`.bib`), RIS (`.ris`), CSV, or JSON.
  3. User selects BibTeX, checks "Include abstract" and "Include local file links", and clicks "Export to File".
  4. Native file save dialog opens; user selects `D:\MyManuscript\references.bib`.
  5. Rust export engine processes records, generates deterministic citation keys (e.g. `vaswani2017attention`), escapes LaTeX special characters (`&`, `%`, `_`), formats author names, and writes UTF-8 file.
* **Visible Feedback:** Export progress bar for large collections; success toast: "Exported 18 citations to references.bib [Open Folder]".
* **Saved State:** Valid `.bib` file written to target disk location.
* **Error Cases:**
  * *Paper has missing author or year:* Engine generates fallback citation key (e.g. `anonymous2024title`) and reports warning in export summary: "1 record exported with incomplete author data."
* **Success Condition:** Generated file compiles cleanly in `biblatex` / `pdflatex` without syntax errors.

---

## Journey 13: Cancel a Long-Running Job & Resume or Retry Failed Work
* **Trigger:** User queued downloads for 15 papers, but needs to shut down their laptop or stops an accidental bulk queue.
* **Steps:**
  1. User opens the "Jobs / Downloads" drawer from the bottom status bar.
  2. View displays active jobs: 1 downloading (42%), 2 pending in queue, 12 queued.
  3. User clicks "Cancel All" or clicks "Cancel" on an individual item.
  4. Rust job manager issues `tokio::sync::watch` cancellation signal to running download task.
  5. Download stream terminates immediately; unfinalized temporary file `.tmp` is unlinked from disk.
  6. Job state updates to `cancelled` in SQLite.
  7. Later, user clicks "Retry Failed/Cancelled" on one paper; job re-queues and downloads from start.
* **Visible Feedback:** Progress bars immediately freeze and transition to "Cancelled" badge; disk cleanup confirmed in job diagnostics; no lingering background network processes.
* **Saved State:** `jobs` table updated with `cancelled` status and cancellation timestamp. Zero orphaned `.tmp` files left on disk.
* **Error Cases:**
  * *Application is forcefully killed (e.g. power loss) during active download:* On next launch, startup recovery job identifies orphaned `running` jobs, marks them `interrupted`, deletes unreferenced `.tmp` files, and offers "Resume interrupted downloads".
* **Success Condition:** Background work is completely responsive to user commands with zero resource leaks or orphaned data.

---

## Journey 14: Back Up, Restore, or Relocate the Local Data Directory
* **Trigger:** User gets a new workstation or wants to relocate their 20GB paper library to a secondary SSD (`E:\ResearchDrive`).
* **Steps:**
  1. In Settings > Storage, user clicks "Relocate Library Storage".
  2. Native folder dialog allows selection of `E:\ResearchDrive`.
  3. App prompts: "Move existing files (20.4 GB) to new location, or use new folder for future downloads only?"
  4. User selects "Move existing files".
  5. App suspends active background downloads, safely copies files, updates relative paths in `files` table, verifies file counts and checksums, and updates `app_settings`.
  6. User also clicks "Create Library Backup (.zip)"; app creates a compressed archive containing SQLite database, user notes, and metadata JSON.
* **Visible Feedback:** Relocation progress dialog with file copy counter; backup generation spinner; success dialog: "Library successfully relocated to E:\ResearchDrive".
* **Saved State:** Configuration and database point cleanly to the new storage root with all existing links intact.
* **Error Cases:**
  * *Destination drive runs out of disk space during move:* Copy operation halts; transaction aborts; partial files on destination purged; original files remain 100% intact; user alerted: "Insufficient disk space on destination. Move cancelled."
* **Success Condition:** Complete library integrity preserved across drive migrations and backups.
