# Testing Search Connectors & Adapters

This document describes how to test website search connectors, mock offline fixtures, and run opt-in live integration smoke tests.

---

## 1. Unit Testing with Saved Fixtures

Standard automated tests must **never** depend on live external networks or cause rate-limiting issues on academic websites.

Unit tests in `src-tauri/src/scrapers/query_search.rs` use local HTML fixtures:
- `parse_arxiv_search`: Tests extraction of title, author list, abstract, landing URL, and direct PDF URL (`/pdf/{id}.pdf`).
- `parse_biorxiv_search`: Tests Highwire search result cards, DOI extraction, and PDF URLs.
- `parse_plos_search`: Tests PLOS journal article search listings and CC BY license extraction.
- `parse_nature_search`: Tests Nature Scientific Reports search listings and OA badges.
- `parse_pmc_search`: Tests PubMed Central article listings and DOI extraction.
- `deduplicate_results`: Tests cautious deduplication across sources matching normalized DOIs and titles while preserving rich metadata.

Run unit tests via:
```bash
cargo test --package research-paper-scraper scrapers::query_search
```

---

## 2. Frontend Component Tests

Frontend tests in `src/test/academic-discovery.test.tsx` and `src/test/discover-three-pane.test.tsx` verify:
1. Discover page renders the query-first search bar (`Search by topic, title, author, keyword, or phrase…`).
2. Search buttons, Enter-to-search, Clear query, and Cancel search behave correctly.
3. Multi-select source picker shows policy status and badges.
4. Advanced filter controls (year ranges, content type, access status, author, sort) update results reactively.
5. Three-pane layout responds to selection:
   - Left pane displays results with source pills and OA status.
   - Center pane displays embedded reader or truthful un-downloaded state.
   - Right pane displays verified metadata, copy DOI, and SQLite research notes.

Run frontend tests via:
```bash
npx vitest run
```

---

## 3. Opt-in Integration Smoke Test

To verify connectivity against live public search pages for policy-verified sites:
```bash
cargo test --test live_website_search -- --ignored
```
*Note: Live integration tests are marked `#[ignore]` by default so standard CI builds run completely offline.*
