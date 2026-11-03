# Infinity Researcher — Backend Test Plan & Verification Matrix

**Date:** 2026-10-29  
**Version:** 0.1.0  
**Authors:** Principal Systems & AI Infrastructure Architect

---

## 1. Test Strategy Overview

The testing architecture encompasses four complementary testing layers:
1. **Rust Backend Unit & Integration Tests** (`cargo test --manifest-path src-tauri/Cargo.toml`)
2. **Frontend React / TypeScript Tests** (`npx vitest run`)
3. **Python Engine Tests** (`pytest python-engine/tests`)
4. **End-to-End Three-Panel Workflow Integration Tests**

---

## 2. Test Suites & Coverage Inventory

### 2.1 Rust Backend Test Coverage
Located in `src-tauri/tests/`:
- `ieee_workflow_tests.rs`: Tests IEEE Open Access ingestion, Mode A compliance, and deduplication.
- `matrix_tests.rs`: Tests matrix extraction creation, cell updates, and copilot session history.
- Unit tests embedded in:
  - `src-tauri/src/services/ai_provider_service.rs`: Credential resolution, privacy guard validation.
  - `src-tauri/src/services/ai_rag_service.rs`: Chunking, page coordinate preservation, BM25 retrieval.
  - `src-tauri/src/services/pdf_processor.rs`: Test PDF generation, text extraction, encrypted PDF rejection.
  - `src-tauri/src/scrapers/dedup.rs`: DOI and normalized title deduplication.

### 2.2 Frontend Vitest Suites
**Status:** 25 passing test suites (211 passed tests):
- `literature-workspace.test.tsx`: 3-panel layout, panel resizing, panel collapsing, tab switching (Survey, Compare, Gaps, Writer, Notes, Figures), matrix cell evidence synchronization to Panel 3, claim-to-evidence links, similarity review tags, citation formatting.
- `two-column-sidebar-and-navigation.test.tsx`: Two-column sidebar rail, category switching, secondary column collapsing, light/dark theme-adaptive classes.
- `academic-writing-workspace.test.tsx`: Multi-mode text rewriting, side-by-side diff comparison, token preservation guard, version restore.
- `citation-checker.test.tsx`: Missing references detection, orphan bibliography entries, DOI format validation, style formatting.
- `readability-and-integrity.test.tsx`: Flesch-Kincaid, Gunning Fog metrics, unified research integrity reports, individual finding reviews.
- `phase9-backend-integration.test.tsx`: Desktop API bridges, Tauri command error contracts, job status polling.
- `streaming-search-and-pdf-preview.test.tsx`: Live paper discovery streaming, session isolation, embedded PDF viewer page jump.
- `discover-query-search.test.tsx`: Query-first academic search, filter combinations, source toggling.
- `ai-workspace.test.tsx`: AI Hub provider configuration, RAG scope, evaluation benchmarks.

### 2.3 Python Engine Test Coverage
Located in `python-engine/tests/`:
- `test_spiders.py`: Scrapy spiders for arXiv, bioRxiv, PLOS, Nature, PubMed.
- `test_adapters.py`: OpenAlex, Semantic Scholar, Crossref API connectors.
- `test_scrapy_engine.py`: Stdio JSON protocol and crawler lifecycle.
- `test_query_intelligence.py`: Query normalization and expansion.
- `test_source_ranker.py`: Result relevance scoring and ranking.

---

## 3. Critical Verification Scenarios for Future Phases

| Phase | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **Phase 2** | `JobManager` cancellation token propagation | Long-running analysis job stops scheduling stages upon cancel request; status becomes `cancelled`. |
| **Phase 3** | Provider returns invalid JSON for structured schema | Rust schema validator triggers bounded repair or reports clear `ERR_SCHEMA_VALIDATION` without crashing. |
| **Phase 4** | Extract text from 100-page scanned PDF | Flags `is_scanned = true`, reports `status = "no_text"`, suggests OCR without replacing text with null. |
| **Phase 6** | Research gap synthesis over 5 papers | Generates candidate gaps citing exact paper IDs and pages; includes explicit caveat notice. |
| **Phase 8** | Similarity analysis with overlapping matches | Merges overlapping match intervals $[10, 50]$ and $[30, 80]$ into $[10, 80]$ ($71$ chars), avoiding double-counting. |
| **Phase 11** | Local-only mode with cloud provider route | Request is blocked at the Rust socket boundary before any outbound bytes are transmitted. |

