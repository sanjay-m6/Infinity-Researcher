# Assumptions, Trade-offs, and Open Questions

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Audited  

---

## 1. Verified Technical Facts vs. Explicit Assumptions

### 1.1 Verified Technical Facts (Backed by Official Documentation)
1. **OpenAlex API:** Usage is governed by a daily budget resetting at midnight UTC. Free key grants $1.00/day budget (100k requests) and 30 req/sec; unauthenticated is capped at $0.10/day and 10 req/sec. Abstracts are stored as inverted indexes.
2. **Crossref API:** Polite pool requires user contact email via `mailto` or `User-Agent`. Offers 10 req/sec and concurrency of 5 (vs 5 req/s and 1 concurrency for public pool). Crossref is purely bibliographic metadata; it does not host PDFs.
3. **arXiv API:** Enforces Atom XML format and strict rate limiting (max 1 request per 3 seconds recommended by official user manual). Desktop crawler bulk harvesting is prohibited; direct PDF download is permitted for individual papers if properly paced.
4. **Europe PMC API:** Free open REST service with cursor-based pagination. Provides direct PMC Open Access PDF URLs in `fullTextUrlList` for open access subset articles.
5. **Commercial Publishers (IEEE, ScienceDirect, Springer):** Strictly prohibit unauthorized web scraping in their terms of use and deploy anti-bot systems. Automated PDF retrieval cannot be guaranteed or implemented without violating terms.

### 1.2 Explicit Engineering Assumptions
1. **Windows 10/11 Target:** Assumed standard modern 64-bit Windows environments. Assumed Microsoft Edge WebView2 runtime is already present on Windows 10 (via Evergreen distribution) and pre-installed on Windows 11.
2. **Local Storage Limits:** Assumed users have sufficient local disk space for their saved PDF library. The default 100 MB per-file ceiling is assumed sufficient for 99.8% of academic papers (typical PDFs range from 1 to 15 MB).
3. **Network Availability:** Assumed internet access is required solely for online discovery and downloading; assumed local SQLite database and already-downloaded PDFs will function 100% offline.
4. **DOI Coverage:** Assumed that approximately 75–85% of modern scholarly literature has a registered DOI. For preprints (e.g. arXiv) without DOIs, repository IDs (e.g. `arXiv:1706.03762`) serve as stable unique keys.

---

## 2. Open Questions & Architectural Trade-offs

### 2.1 Non-Blocking Design Choices (To be resolved during Phase 2 & 3)
* **Question NB-001 (UI Component Architecture):**  
  * *Context:* Should we adopt shadcn/ui components copied directly into the project, or build a lightweight bespoke component set using Tailwind CSS v4?  
  * *Recommendation:* Use a lightweight bespoke component system inspired by shadcn/ui principles (accessible primitives, Tailwind CSS v4 tokens, Lucide icons) to avoid unnecessary npm dependency weight and ensure seamless Tailwind v4 compatibility.  
  * *Impact:* Low (isolated to UI styling layer).
* **Question NB-002 (PDF In-App Viewer vs System Default):**  
  * *Context:* Should the application embed an internal PDF viewer (via PDF.js in an iframe) or open PDFs in the user's OS default reader (Acrobat, Edge, SumatraPDF)?  
  * *Recommendation:* Launch the user's preferred OS default viewer via `open::that(path)` for P0. Evaluate an optional embedded viewer in P1. Most researchers have strong preferences for external dedicated PDF tools with stylus/highlighting capabilities.  
  * *Impact:* Low.
* **Question NB-003 (Optional Cloud Sync for Notes):**  
  * *Context:* Will users ever want encrypted synchronization for personal notes across devices?  
  * *Recommendation:* Strictly out of scope for MVP. The application will remain 100% local-first. If requested in future releases, implement via file-based sync (e.g. pointing library to an encrypted Syncthing/OneDrive/Dropbox folder) rather than introducing a central proprietary cloud backend.

### 2.2 Mandatory Blockers (None Identified)
* **Status:** Zero mandatory blockers currently impede progressing to **Phase 2 (Architecture Foundation)**.
* Toolchains (Rust 1.99.1, Cargo 1.99.1, Node v24.13.1, npm 11.8.0, Git 2.56.0) are fully operational in the environment.
* Source access rules and API contracts have been verified against official documentation.
