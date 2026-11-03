# Initial Audit: Academic Retrieval Engine & PDF Verification Pipeline

## 1. Executive Summary

An exhaustive technical audit of the **Infinity Researcher** retrieval infrastructure was conducted across the Tauri 2 desktop shell, Rust backend services, Python research retrieval engine, React + TypeScript presentation layer, and SQLite persistent datastore.

The audit identified critical reliability gaps in paper resolution and PDF acquisition:
1. **Single-Source Fragility**: Search and download workflows previously assumed that a single URL provided by a discovery provider remained stable and pointed to a valid PDF stream.
2. **False Verification**: HTTP 200 responses returning HTML landing pages, paywalls, or CAPTCHA challenges were susceptible to being misidentified as successful downloads.
3. **Absence of Deep Document Identity Verification**: Downloaded PDFs were structurally checked for PDF header bytes (`%PDF-`), but the extracted content (title, DOI, author surnames) was not reconciled against the requested scholarly publication. This allowed wrong documents, editorial corrigenda, or supplementary data sheets to be committed into the user's research library.
4. **Unclassified Versioning**: Preprints from arXiv, bioRxiv, and institutional repositories were not systematically distinguished from peer-reviewed Version of Record (VoR) publications or Accepted Author Manuscripts (AAM).

---

## 2. Component Inventory & Architecture Breakdown

### 2.1 Rust Main Backend (`src-tauri/`)
- **Academic Source Registry & Orchestration (`src/academic_sources/`)**:
  - `registry.rs`: Thread-safe registry maintaining connectors for OpenAlex, Crossref, Semantic Scholar, arXiv, and Europe PMC.
  - `query_planner.rs`: Capability-aware query analyzer converting raw queries into native provider query plans and identifying stable identifiers (DOI, arXiv ID, PMID).
  - `search_service.rs`: Asynchronous fan-out search executor with token-bucket rate limiters (`RateLimiter`), deduplication, and metadata completeness scoring.
  - `providers/`: Specialized connectors for `arxiv.rs`, `crossref.rs`, `europe_pmc.rs`, `openalex.rs`, and `semantic_scholar.rs`.
- **PDF Resolution & Processing (`src/services/`)**:
  - `pdf_resolver.rs`: Multi-source availability engine querying Unpaywall, OpenAlex OA locations, Europe PMC, canonical preprint routes, and publisher meta tags.
  - `candidate_verifier.rs`: Bounded network verifier enforcing anti-SSRF IP filtering, tracking HTTP redirect chains (up to 5 hops), detecting HTML challenge pages, and inspecting `%PDF-` magic signatures.
  - `pdf_processor.rs`: `lopdf`-based structural engine extracting page count, Document Info dictionary (`/Title`, `/Author`), full-text streams, DOI regex patterns, version classifications, and document identity reconciliation.
  - `download_manager.rs`: Tokio-based download orchestrator managing concurrency semaphores, safe `.tmp_{id}.part` disk isolation, multi-stage state transitions, and atomic commits.
- **Persistence (`src/database/` & `src/repositories/`)**:
  - SQLite database with 15 schema migrations, WAL journaling, and foreign key integrity.
  - `pdf_workspace_repo.rs`: Repository persisting `download_jobs`, `pdf_candidates`, `paper_files`, `reader_state`, and `papers`.

### 2.2 Python Research Retrieval Engine (`python-engine/`)
- **Adapters (`paper_scraper/adapters/`)**: ArXiv, BioRxiv, MedRxiv, PLOS, Nature, IEEE, PubMed, Europe PMC, OpenAlex, Semantic Scholar.
- **Discovery & Identity (`paper_scraper/discovery/`)**: Title normalization, token extraction, DOI validation, and duplicate detection.
- **PDF Scraper (`paper_scraper/pdf.py`)**: Range requests (0–1023 bytes) for remote magic-byte inspection and anti-SSRF protections.
- **Engine & Pipelines (`paper_scraper/engine/`, `pipelines/`)**: Scrapy-based crawling workers with item pipelines for normalization and deduplication.

### 2.3 Presentation Layer (`src/features/discover/`)
- `DiscoverView.tsx`: Multi-pane research discovery interface rendering query inputs, source capability toggles, paper card lists with version and verification badges, and paper inspection drawers.

---

## 3. Verified Failure Modes & Root-Cause Analysis

| Failure Mode | Observed Behavior | Root Cause | Modernized Solution |
| :--- | :--- | :--- | :--- |
| **HTML 200 Paywall Trap** | Web server returns HTTP 200 with HTML login page instead of PDF. | Relying solely on HTTP status code rather than inspecting headers and magic bytes. | `CandidateVerifier` checks `Content-Type` header and verifies `%PDF-` signature within first 1024 bytes. Rejects HTML challenge pages. |
| **Silent Wrong Document** | Downloaded PDF corresponds to a different paper or editorial note. | File committed based solely on structural validity without checking bibliographic contents. | `PdfProcessor::reconcile_identity` computes token similarity against expected title, author surnames, and DOI. Categorizes into `verified_match`, `probable_match`, `identity_uncertain`, or `wrong_document`. |
| **Expired Pre-signed URLs** | Candidate PDF links fail after a few hours with HTTP 403. | Ephemeral S3/GCS pre-signed URLs stored as permanent links. | Real-time candidate re-resolution on demand via canonical sources (Unpaywall, OpenAlex, arXiv). |
| **Silent Version Conflation** | An unreviewed preprint is presented as a final journal article. | No version classification taxonomy in domain models or database schema. | Implemented 5-tier version taxonomy: `published_version`, `accepted_manuscript`, `preprint`, `repository_version`, `unknown_version`. |
| **Interrupted Download Corruption** | Application shutdown during transfer leaves truncated PDF on disk. | Writing directly to final destination filename. | Downloads stream exclusively to `.tmp_{id}.part` temporary files. Only committed atomically to `{paper_id}.pdf` after identity checks succeed. |

---

## 4. Baseline Metrics & System Health

- **Python Engine Test Suite**: 109 tests passing in `python-engine/tests`.
- **Rust Backend Compilation**: Clean compilation (`cargo check`) with zero errors and zero warnings.
- **Frontend Bundle**: Production build (`npm run build`) bundles cleanly in ~12 seconds.
- **Database Schema**: 15 migrations cleanly applying in SQLite memory and file databases.

---

## 5. Enhancement Roadmap (Phases A through N)

1. **Schema Migration 0015**: Durable version taxonomy and identity verification columns across `pdf_candidates`, `download_jobs`, `paper_files`, and `papers`.
2. **Document Identity Verification**: Deep reconciliation in `PdfProcessor` with transparent confidence scoring.
3. **Alternative Full-Text Discovery**: Multi-source fallback across OpenAlex, Europe PMC, Unpaywall, and disciplinary repositories.
4. **Modernized Download Lifecycle**: Insertion of `VERIFYING_IDENTITY` stage prior to atomic disk commitment.
5. **UI Badging**: Clear scholarly version and verification indicators in `DiscoverView`.

