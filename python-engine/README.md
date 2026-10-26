# Python Research Paper Scraping Engine

A modular, high-coverage academic paper discovery and metadata extraction engine designed to run standalone or as a managed sidecar in the Research Paper Scraper desktop application.

---

## Key Capabilities

- **No Academic API Keys Required**: Searches and parses public scholarly interfaces directly.
- **Permitted Sources**: Pre-configured with adapters for:
  - **arXiv** (`arxiv.org`) — Physics, CS, and mathematics preprints with direct PDF streaming.
  - **bioRxiv** (`biorxiv.org`) — Cold Spring Harbor Laboratory biological sciences preprints.
  - **PubMed** (`pubmed.ncbi.nlm.nih.gov`) — Biomedical literature with automated Free PMC full-text detection.
  - **PLOS** (`journals.plos.org`) — 100% CC BY open access peer-reviewed journals.
- **Explainable Relevance Scoring**: Local multi-feature scoring model (query term coverage, exact phrase matching, author matches, metadata completeness, and year filter alignment).
- **Truthful Metadata Confidence**: Computed breakdown across title, authors, DOI, abstract, and PDF links.
- **Conservative Deduplication**: DOI canonicalization, native identifier matching, and RapidFuzz token sorting for candidate matching while preserving source provenance.
- **Anti-SSRF Security**: Strict scheme allowlisting, private/loopback/cloud-metadata IP blocking, redirect validation, and path-traversal prevention.
- **PDF Signature Validation**: Validates `%PDF-` file magic and detects HTML error / login walls masquerading as PDF files.

---

## Architecture & Communication Protocol

The engine communicates with Tauri / Rust over **stdin/stdout using versioned JSON Lines** (`1.0.0`):

- **Commands (stdin)**:
  - `handshake`: Protocol handshake and version negotiation.
  - `list_sources`: Returns registered source descriptors and capabilities.
  - `start_search`: Initiates parallel async search across selected sources with bounded concurrency.
  - `cancel_search`: Signals immediate cancellation of running tasks via `asyncio.Event`.
  - `preview_pdf`: Validates PDF accessibility and range-request support without downloading the entire document.
  - `health_check`: Pings sources and tracks runtime success rates.
  - `shutdown`: Gracefully terminates background tasks and exits.
- **Events (stdout)**:
  - `job.started`, `source.started`, `paper.discovered`, `paper.duplicate_candidate`, `source.completed`, `source.blocked`, `source.failed`, `job.completed`, `job.cancelled`.
- **Diagnostics (stderr)**:
  - Structured JSON logs sent exclusively to `stderr` to maintain protocol integrity on `stdout`.

---

## Adding a New Source Adapter

To add a new scholarly source adapter:

1. Create a new file in `src/paper_scraper/adapters/<source_name>.py` subclassing `BaseAdapter`:
   ```python
   from paper_scraper.adapters.base import BaseAdapter
   from paper_scraper.models import PaperResult, QueryFilter

   class MySourceAdapter(BaseAdapter):
       id = "mysource"
       name = "My Source"
       domain = "example.org"
       policy_url = "https://example.org/robots.txt"
       policy_notes = "Public repository search"

       async def search(self, query: str, filters: QueryFilter, client: httpx.AsyncClient):
           ...
           yield paper

       async def health_check(self, client: httpx.AsyncClient):
           ...
   ```
2. Register the adapter in `src/paper_scraper/adapters/registry.py`:
   ```python
   self.register(MySourceAdapter())
   ```
3. Add a deterministic test fixture in `tests/fixtures/<source_name>_search.html`.
4. Add unit test assertions in `tests/test_adapters.py`.

---

## Running Tests

```bash
# Run all Python engine tests
cd python-engine
python -m pytest tests
```
