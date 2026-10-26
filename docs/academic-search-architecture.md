# Academic Search Architecture & Connector Framework

**Document:** Phase 5 Unified Academic Discovery Architecture  
**Application:** Research Paper Scraper (Tauri 2 + Rust + React + SQLite)  
**Status:** Implemented & Verified  

---

## 1. System Overview

The Academic Search Engine provides a local-first, multi-source discovery pipeline that allows researchers to query leading academic repositories simultaneously from a single unified interface. All network requests and data normalization happen in the native Rust backend, ensuring maximum performance, zero leakage of API credentials, and direct integration with the local Phase 4 SQLite database.

```mermaid
flowchart TD
    UI[React DiscoverView UI] -->|IPC: search_academic_sources| CMD[Tauri Command: academic_search]
    CMD --> COORD[AcademicSearchService Coordinator]
    COORD --> REG[ProviderRegistry]
    COORD --> LIMIT[RateLimiter & Pacing Manager]

    subgraph Adapters [Provider Adapters (Concurrent)]
        OA[OpenAlexAdapter]
        CR[CrossrefAdapter]
        S2[SemanticScholarAdapter]
        ARX[ArxivAdapter]
        EPMC[EuropePmcAdapter]
    end

    COORD -->|tokio::spawn| OA
    COORD -->|tokio::spawn| CR
    COORD -->|tokio::spawn| S2
    COORD -->|tokio::spawn| ARX
    COORD -->|tokio::spawn| EPMC

    OA -.->|HTTP JSON| OAPI[(OpenAlex REST API)]
    CR -.->|HTTP JSON| CRAPI[(Crossref REST API)]
    S2 -.->|HTTP JSON| S2API[(Semantic Scholar S2AG)]
    ARX -.->|HTTP XML| ARXAPI[(arXiv Atom API)]
    EPMC -.->|HTTP JSON| EPMCAPI[(Europe PMC API)]

    Adapters -->|AdapterSearchResult| COORD
    COORD --> MERGE[Deduplication & Provenance Merge Engine]
    MERGE --> RESP[UnifiedSearchResponse]
    RESP --> UI

    UI -->|IPC: import_search_results| IMP[AcademicSearchService::import_works]
    IMP --> DB[(Phase 4 SQLite Database)]
```

---

## 2. Separation of Concerns & Module Boundaries

The architecture is strictly separated across 6 foundational layers:

| Layer | Module Path | Purpose |
|:---|:---|:---|
| **Domain Types** | `src-tauri/src/academic_sources/types.rs` | Provider-neutral scholarly work representations (`NormalizedWork`, `NormalizedAuthor`, `ProviderProvenance`, `ProviderCapabilities`, `ProviderStatus`). |
| **Adapter Trait** | `src-tauri/src/academic_sources/adapter.rs` | Strongly-typed async trait `AcademicSourceAdapter` that every remote connector implements. |
| **Provider Adapters** | `src-tauri/src/academic_sources/providers/` | Isolated provider-specific HTTP request serialization, response parsing, and error mapping (`openalex.rs`, `crossref.rs`, `semantic_scholar.rs`, `arxiv.rs`, `europe_pmc.rs`). |
| **Provider Registry** | `src-tauri/src/academic_sources/registry.rs` | Static catalog of supported connectors, capability flags, and factory instantiations. |
| **Search Coordinator** | `src-tauri/src/academic_sources/search_service.rs` | Orchestrates concurrent asynchronous queries, tracks per-provider statuses, performs DOI & clean-title deduplication, and handles SQLite library imports. |
| **IPC Boundary** | `src-tauri/src/commands/academic_search.rs` | Thin, validated Tauri command handlers exposing discovery and credential management to the frontend. |

---

## 3. Provider Contract (`AcademicSourceAdapter`)

Every academic source implements the `AcademicSourceAdapter` trait:

```rust
#[async_trait]
pub trait AcademicSourceAdapter: Send + Sync {
    /// Returns the unique, stable identifier for this provider.
    fn provider_id(&self) -> ProviderId;

    /// Returns human-readable capability metadata and supported query filters.
    fn capabilities(&self) -> ProviderCapabilities;

    /// Executes an asynchronous query against the provider's official REST / XML endpoint.
    async fn search(
        &self,
        client: &reqwest::Client,
        query: &AcademicSearchQuery,
        api_key: Option<&str>,
    ) -> Result<AdapterSearchResult, AcademicError>;
}
```

### Key Rules Enforced by Adapters
1. **No Data Fabrication:** Missing fields remain `None`. Adapters never invent publication dates, citation counts, DOIs, or author affiliations.
2. **Abstract Reconstruction:** For APIs storing abstracts as inverted indexes (e.g. OpenAlex), adapters linearly reconstruct full sentences by token positions.
3. **Safe Previews:** arXiv titles and abstracts often contain newline formatting and LaTeX entities; adapters normalize whitespace and strip dangerous HTML/XML injection tags.
4. **Authentic Provenance:** Every returned result carries `ProviderProvenance` linking the paper back to the provider's stable record ID and verified canonical landing page.

---

## 4. Concurrency & Independent Failure Isolation

Search requests execute concurrently using `tokio::spawn` with bounded timeouts:

1. **Per-Provider Concurrency:** When a user queries 5 sources, the coordinator schedules 5 independent asynchronous tasks.
2. **Failure Isolation:** If OpenAlex returns HTTP 500 or arXiv times out after 10 seconds, their statuses are marked `failed` or `unavailable` with sanitized diagnostic messages. All successful responses from Crossref, Semantic Scholar, and Europe PMC are preserved and returned to the user without interruption.
3. **Pacing & Rate Limiting:** The `RateLimiter` enforces mandatory pauses between requests (e.g. 3.0 seconds for arXiv, 1.0 second for Semantic Scholar) to comply with academic fair-use policies and avoid HTTP 429 IP bans.

---

## 5. Deduplication and Metadata Merging

A single scholarly paper (e.g. *"Attention Is All You Need"*) is indexed across arXiv, Semantic Scholar, Crossref, and OpenAlex. The search engine automatically reconciles these into a unified record while preserving provenance:

### Deduplication Algorithm
1. **Primary Match (Canonical DOI):**
   - DOIs are normalized using standard DOI resolution rules (`https://doi.org/`, `doi:`, whitespace, and resolver prefixes are stripped).
   - Case-insensitive comparison (`10.48550/arxiv.1706.03762`).
2. **Secondary Match (Clean Title + Year):**
   - If a work lacks a DOI (common for recent preprints or non-traditional publications), the engine compares `clean_title_key` (alphanumeric characters only, lowercased) combined with matching `publication_year`.
3. **Field-Specific Merging Precedence:**
   - **Provenance:** Appends all provider records to the `provenance` array so the user can verify where the paper was indexed.
   - **Authors:** The adapter with the highest number of structured authors is retained.
   - **Abstract:** Preserved from whichever source supplies a non-empty abstract text (e.g. arXiv or OpenAlex).
   - **Open Access:** If any provider certifies open-access availability, `is_open_access` is set to `true`.
   - **PDF Link:** Direct Open Access PDF URLs (from arXiv or Unpaywall/OpenAlex) take precedence over general publisher landing pages.

---

## 6. Local SQLite Integration (`import_works`)

Saving search results is an explicit user action (either clicking "Save" on an individual result card or using "Import Selected"):

1. **Transaction Safety:** Imports run inside a localized database operation. Network requests are never executed inside a database transaction lock.
2. **Duplicate-Aware Insertion:** If a paper already exists in the SQLite database (matched by DOI or clean title key), its existing ID is reused:
   - If the existing record was unsaved, it is marked `is_saved = true`.
   - If a target collection was selected, the existing paper is linked to the collection.
   - User notes, tags, reading state, and locally attached PDF files are strictly preserved and never overwritten.
3. **Structured Outcome Summary:** The backend returns an `ImportSummary` reporting:
   - `added`: Number of brand-new papers saved.
   - `already_present`: Number of papers already in the library that were linked or marked saved.
   - `updated`: Number of records enriched with fresh metadata.
   - `failed`: Number of failed records.

---

## 7. How to Add a Future Provider

Adding a new academic source connector (e.g. PubMed / NCBI E-utilities, DOAJ, or DBLP) follows a strict 7-step procedure:

### Step 1: Verify Official Documentation & Policies
Confirm that the source provides an official public REST/XML API. Check authentication requirements, rate limits, pagination parameters, and licensing terms. Record findings in `docs/source-connectors.md`.

### Step 2: Add Provider Identifier
In `src-tauri/src/academic_sources/types.rs`:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderId {
    OpenAlex,
    Crossref,
    SemanticScholar,
    Arxiv,
    EuropePmc,
    NewProvider, // <-- Add variant
}
```
Update `ProviderId::as_str()` and `ProviderId::from_str()`.

### Step 3: Implement the Adapter
Create `src-tauri/src/academic_sources/providers/new_provider.rs`:
- Define response deserialization structs.
- Implement `AcademicSourceAdapter` for `NewProviderAdapter`.
- Map provider fields to `NormalizedWork`.
- Add parser tests with official sanitized response fixtures.

### Step 4: Register in Registry
In `src-tauri/src/academic_sources/registry.rs`:
- Add `NewProviderAdapter` to the static registry vector.
- Declare provider capabilities (supports DOI lookup, supports year filtering, rate limits, etc.).

### Step 5: Update Re-Exports & Rate Limiting
- Export adapter in `src-tauri/src/academic_sources/providers/mod.rs`.
- In `src-tauri/src/academic_sources/rate_limit.rs`, configure the required request pacing delay (e.g. 100ms or 3000ms).

### Step 6: Verify Frontend Discovery
In `src/features/discover/DiscoverView.tsx`:
- The provider will be automatically loaded via `listAcademicProviders()` IPC.
- Add a badge tag in the sources selector list.

### Step 7: Run Quality Gates
```bash
cargo test --manifest-path src-tauri/Cargo.toml
npm run check:all
```
Update documentation to reflect the new provider's status.
