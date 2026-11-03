# Phase 17 — Rust–Python Inter-Process Communication & Contract

**Subsystem**: Hybrid Engine IPC  
**Modules**: `src-tauri/src/academic_sources/` & `python-engine/src/paper_scraper/`  
**Phase**: Phase 17 Modernization  

---

## 1. Engine Specialization & Boundaries

Infinity Researcher employs a dual-engine architecture:
1. **Rust Core**: Responsible for desktop windowing (Tauri 2), local SQLite persistence, cryptographic operations, high-throughput asynchronous HTTP querying of scholarly APIs (OpenAlex, Crossref, Semantic Scholar, Europe PMC, arXiv), and embedded PDF viewing.
2. **Python Scraping Subsystem**: Responsible for web crawling, Scrapy spiders, headless browser fallback (Playwright) for JS-rendered publisher sites, Solr search parsing (PLOS), and full-text HTML extraction.

---

## 2. IPC Protocol & Stream Format

Communication between Rust and Python occurs over stdout/stdin JSON-RPC and NDJSON event streaming:

### 2.1 Event Types (`SearchStreamEvent`)
- **`stream_start`**: Signals search initiation with job UUID and configured sources.
- **`source_status`**: Emits real-time progress for an individual source adapter (`started`, `completed`, `failed`).
- **`paper_discovered`**: Streams an individual discovered paper as it is extracted, allowing the UI to render results progressively before crawling completes.
- **`stream_complete`**: Emits final job telemetry (total found, runtime duration, errors).
- **`stream_error`**: Emits fatal job execution errors.

---

## 3. Data Model Alignment

To ensure papers discovered by the Python crawling engine deduplicate seamlessly against papers retrieved by the Rust HTTP engine:

| Field Name | Rust `NormalizedWork` | Python `PaperResult` | TypeScript `UnifiedDiscoverPaper` |
| :--- | :--- | :--- | :--- |
| **DOI** | `canonical_doi: Option<String>` | `doi: Optional[str]` | `canonical_doi?: string \| null` |
| **Title** | `title: String` | `title: str` | `title: string` |
| **Clean Key** | `clean_title_key: String` | `normalize_title(p.title)` | Filtered alphanumeric key |
| **Authors** | `authors: Vec<NormalizedAuthor>` | `authors: List[str]` | `authors: string[]` |
| **Open Access** | `is_open_access: bool` | `is_open_access: bool` | `is_open_access: boolean` |
| **PDF URL** | `pdf_url: Option<String>` | `pdf_url: Optional[str]` | `pdf_url?: string \| null` |
| **Landing URL** | `landing_url: Option<String>` | `landing_url: str` | `url: string` |
| **Provenance** | `provenance: Vec<ProviderProvenance>` | `provenance_urls: List[str]` | `source_id`, `source_name` |

### 3.1 Canonical Normalization Contract
Both Rust (`MetadataNormalizer::normalize_doi`) and Python (`paper_scraper.deduplication.dedup.normalize_doi`) adhere to the identical canonical standard:
- Strip `https://doi.org/`, `http://doi.org/`, `https://dx.doi.org/`, `doi:`.
- Lowercase all characters.
- Trim trailing punctuation.
- Verify prefix `10.` and suffix separator `/`.

---

## 4. Contract Stability Guarantees

1. **Backwards Compatibility**: The Python engine maintains compatibility shims (`paper_scraper.dedup`) ensuring legacy scripts continue operating without deprecation breaks.
2. **Crash Isolation**: If the Python subprocess crashes, Rust handles process termination gracefully without hanging Tauri IPC calls.

