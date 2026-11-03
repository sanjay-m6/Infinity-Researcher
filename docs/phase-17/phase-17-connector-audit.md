# Phase 17 — Pre-Implementation Academic Source Connector Audit

**Audit Date**: October 2026  
**System**: Infinity Researcher — Academic Source Connector Framework & Retrieval Reliability  
**Target Architecture**: Tauri 2 + Rust Core + SQLite v14 + React 19 + TypeScript + Python Scraper Engine  

---

## 1. Executive Summary

This audit assesses the state of academic source connectors, paper retrieval pipelines, metadata normalization mechanisms, rate-limiting systems, and cross-engine communication across Infinity Researcher prior to Phase 17 implementation.

The application currently features dual connector architectures:
1. **Rust Scholarly Source API Subsystem** (`src-tauri/src/academic_sources/`):
   - High-performance, concurrent, asynchronous HTTP adapters for 5 Tier-A scholarly index providers: OpenAlex, Crossref, Semantic Scholar, arXiv, and Europe PMC.
   - Centralized `ProviderRegistry`, `AcademicSearchService`, and in-memory rate limiting.
   - SQLite integration via `PaperRepository`, `PaperSources` junction, and collection assignment.
2. **Python Web Crawling & Scraping Engine** (`python-engine/src/paper_scraper/adapters/`):
   - Asynchronous Python adapters (10 sources: arXiv, bioRxiv, medRxiv, PubMed, Europe PMC, PLOS, Nature Scientific Reports, IEEE Xplore, Semantic Scholar, OpenAlex, CORE API).
   - Scrapy spiders, headless browser fallback (Playwright), HTML selectors, and streaming IPC to Tauri.

The audit identified critical modernization requirements:
- **Capability-Aware Query Planning**: The system previously attempted to push arbitrary filter parameters to all providers without checking whether individual providers natively supported them (e.g., passing open-access flags to arXiv or year ranges to providers requiring different syntax).
- **Metadata Normalization & Completeness Scoring**: Lack of a standardized metadata quality indicator and unified canonical DOI sanitation led to inconsistent deduplication across provider boundaries.
- **Health Checks & Diagnostics**: Absence of proactive, non-intrusive provider ping/health checks left the user unaware when third-party APIs experienced rate-limiting, transient outages, or credential expirations.
- **Deduplication Conservatism**: Incomplete metadata merging risked overwriting rich metadata with empty fields or falsely merging papers with similar titles but different authors or publication years.
- **Cooperative Cancellation & Concurrency Bounding**: High concurrency without global semaphores risked socket starvation and upstream API bans.

---

## 2. Inventory of Academic Source Connectors

### 2.1 Rust API Providers (`src-tauri/src/academic_sources/`)

| Provider Identifier | Display Name | Endpoint Base | Authentication | Supported Filters | Primary Identifier |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `openalex` | OpenAlex | `https://api.openalex.org/works` | Optional Mailto / API Key | Year range, Open Access, DOI | DOI, OpenAlex Work ID |
| `crossref` | Crossref | `https://api.crossref.org/works` | Optional Polite Mailto | Year range, DOI, Bibliographic | DOI |
| `semantic_scholar` | Semantic Scholar | `https://api.semanticscholar.org/graph/v1` | Optional API Key (x-api-key) | Year range, Open Access, DOI | DOI, S2 Paper ID |
| `arxiv` | arXiv | `https://export.arxiv.org/api/query` | None (Public API) | Title, Abstract, Author, Category | arXiv ID |
| `europe_pmc` | Europe PMC | `https://www.ebi.ac.uk/europepmc/webservices/rest` | None (Public REST) | Year range, Open Access, DOI | DOI, PMCID, PMID |

### 2.2 Python Engine Adapters (`python-engine/src/paper_scraper/adapters/`)

| Adapter Identifier | Domain | Access Mode | Content Types | Rate Delay | Health Check Implemented |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `arxiv` | `arxiv.org` | HTML / API | Preprints | 3,000 ms | Yes |
| `biorxiv` | `biorxiv.org` | HighWire HTML / API | Preprints | 3,000 ms | Yes |
| `medrxiv` | `medrxiv.org` | HighWire HTML / API | Preprints | 3,000 ms | Yes |
| `pubmed` | `ncbi.nlm.nih.gov` | E-Utilities REST | Peer-reviewed articles | 3,000 ms | Yes |
| `epmc` | `ebi.ac.uk` | REST API | Peer-reviewed & preprints | 1,000 ms | Yes |
| `plos` | `journals.plos.org` | HTML / Solr Search | Peer-reviewed OA | 2,000 ms | Yes |
| `nature_srep` | `nature.com` | HTML Scraping | Open Access Articles | 2,000 ms | Yes |
| `ieee_xplore` | `ieeexplore.ieee.org` | REST / Headless Session | IEEE Conference & Journals | 3,000 ms | Yes |
| `semantic_scholar` | `semanticscholar.org` | REST API | Scholarly Index | 1,000 ms | Yes |
| `openalex` | `openalex.org` | REST API | Global scholarly catalog | 500 ms | Yes |
| `core_api` | `core.ac.uk` | REST API | Open Access Repositories | 1,000 ms | Yes |

---

## 3. Detailed Architectural Gap Analysis

### 3.1 Capability Declaration & Parameter Adaptation
- **Current Defect**: Query parameters (`year_start`, `year_end`, `open_access_only`) were passed blindly to each adapter. For example, arXiv does not natively filter by open access (since all papers on arXiv are open-access preprints), yet queries with `open_access_only=false` or `true` should not alter arXiv's core query unless flagged. Similarly, Crossref requires `filter=from-pub-date:...,until-pub-date:...` while OpenAlex uses `filter=publication_year:...` and Europe PMC uses Lucene syntax `PUB_YEAR:[... TO ...]`.
- **Target Architecture**: An `AcademicQueryPlanner` that receives the generic user query, inspects the `ProviderCapabilities` of each selected provider, translates filter criteria into provider-specific representations, flags unsupported filters for local client-side post-filtering, and produces structured user warnings.

### 3.2 Canonical DOI Normalization & Sanitization
- **Current Defect**: Connectors returned DOIs in varying formats:
  - `https://doi.org/10.1038/s41586-020-2649-2`
  - `http://dx.doi.org/10.1038/S41586-020-2649-2`
  - `doi:10.1038/s41586-020-2649-2`
  - ` 10.1038/s41586-020-2649-2 `
  Due to case mismatch or lingering URL prefixes, identical papers from different providers failed exact DOI lookup and were either duplicated or merged incorrectly.
- **Target Architecture**: A universal canonicalizer `normalize_doi` that trims whitespace, strips all resolver prefixes (`https://doi.org/`, `http://doi.org/`, `https://dx.doi.org/`, `http://dx.doi.org/`, `doi:`), converts the string to lowercase, and validates the standard format (`10.xxxx/...`).

### 3.3 Conservative Deduplication & Safe Merging
- **Current Defect**: Deduplication previously used a simple DOI match or `(clean_title_key, publication_year)` tuple. If publication year was missing on one source, deduplication was bypassed. Conversely, short or generic titles could collide if publication years matched.
- **Target Architecture**: A multi-tiered deduplication hierarchy:
  1. *Tier 1 (Exact Canonical DOI)*: Highest confidence.
  2. *Tier 2 (Provider Record Match)*: Same provider and identical provider record ID.
  3. *Tier 3 (Title + Year + Author Overlap)*: Exact clean title key + matching year (or within +/- 1 year) + at least one matching author surname (minimum 3 characters). If authors are completely disjoint or title is shorter than 12 characters, deduplication is refused.
- **Safe Field Merging**: When merging duplicate works:
  - Never overwrite existing non-empty values (e.g. detailed abstract) with null or empty strings.
  - Combine distinct provenance records.
  - Retain the most complete author list.
  - Retain verified open-access PDF URLs.

### 3.4 Rate Limiting, Backoff & Error Isolation
- **Current Defect**: While basic token waiting existed, HTTP 429 responses with `Retry-After` headers were not dynamically updating the rate limiter's backoff state. Furthermore, a failure in one provider (e.g. 403 Forbidden or network timeout) would return an error status but had no automated retry policy or distinct user remedy.
- **Target Architecture**:
  - Structured error classification: `RateLimited`, `AuthRequired`, `Timeout`, `Unavailable`, `NoResults`, `SucceededWithWarnings`.
  - Parse `Retry-After` HTTP headers.
  - Global semaphore to cap maximum concurrent HTTP connections across all providers.
  - Isolated provider result channels: failures in provider A never abort provider B or C.

### 3.5 Health Diagnostics & Verification
- **Current Defect**: The user interface had no mechanism to inspect the operational health of academic providers before initiating queries.
- **Target Architecture**:
  - `health_check(&self, client: &reqwest::Client)` method on `AcademicSourceAdapter`.
  - Performs lightweight, non-destructive probe requests.
  - Returns `ProviderHealthCheck` with latency, health status (`healthy`, `degraded`, `unavailable`, `rate_limited`, `auth_required`), and diagnostic messages.
  - Tauri command `check_academic_provider_health` and `get_provider_capabilities`.

### 3.6 Metadata Enrichment
- **Current Defect**: Discovered papers with missing abstracts, publication years, or open-access PDF links remained incomplete unless manually re-crawled.
- **Target Architecture**:
  - Metadata enrichment engine (`enrich_work_metadata` / `enrich_paper_metadata` Tauri command).
  - Queries secondary providers (e.g. OpenAlex and Crossref) by DOI to backfill missing fields into the local SQLite database.

---

## 4. Database Schema Verification

Inspection of the SQLite schema (v14):
- Table `sources`: Defines configured academic sources (`id`, `name`, `source_type`, `tier`, `base_url`, `policy_url`, `notes`, `is_enabled`, `rate_limit_rps`, `concurrency_limit`).
- Table `paper_sources`: Defines provenance records (`paper_id`, `source_id`, `source_record_id`, `source_url`, `raw_payload_json`, `open_access_pdf_url`, `retrieved_at`).
  - *Correction applied*: Fixed column name reference in `search_service.rs` (`retrieved_at` vs legacy `fetched_at`) and ensured `source_url` is stored.
- No schema migration is required; the existing v14 schema accommodates all Phase 17 metadata and provenance fields cleanly.

---

## 5. Verification Plan

| Component | Target Verification | Tools |
| :--- | :--- | :--- |
| **Rust Compilation** | `cargo check --manifest-path src-tauri/Cargo.toml` | Rustc / Cargo |
| **TypeScript Typecheck** | `npx tsc --noEmit` | TypeScript Compiler |
| **Frontend Test Suite** | `npx vitest run src/test/phase17-source-connectors.test.tsx` | Vitest / Testing Library |
| **Regression Test Suites** | Vitest phases 9-16, Python pytest suite | Vitest / Pytest |
| **Production Build** | `npm run build` | Vite |

---

## 6. Audit Conclusion & Go-Ahead

The audit confirms that the repository is in an ideal state to execute Phase 17. The core interfaces exist and can be refined without breaking any Phase 1–16 features. Step 2 (Shared Connector Registry & Capabilities Architecture) will now commence.

