# Phase 7 — Testing, Verification & Acceptance Report

## 1. Automated Test Execution Summary

### Rust Backend
All unit and integration tests execute cleanly with zero failures:
```bash
cargo test
# Result: 64 passed, 0 failed, 0 ignored across lib, database, crawl, search, and processing suites
```

Clippy lint verification:
```bash
cargo clippy --all-targets --all-features -- -D warnings
# Result: 0 warnings, exit code 0
```

Rust code formatting:
```bash
cargo fmt --check
# Result: formatted and compliant, exit code 0
```

### Frontend Typechecking, Linting & Unit Tests
```bash
npm run check:all
# tsc --noEmit: Passed (0 type errors)
# eslint .: Passed (0 lint errors)
# vitest run: 7 passed test suites, 36 passed unit & component tests
# tsc && vite build: Production bundle generated successfully
```

## 2. Test Suites Implemented for Phase 7
- `tests/processing_pipeline_tests.rs`:
  - `test_metadata_normalization_pipeline_end_to_end`: Validates normalization of DOIs, clean title keys, and insertion into `paper_identifiers`.
  - `test_duplicate_detection_and_candidate_generation`: Tests exact match, high-confidence matching, near-duplicate review requirement, and distinct classification for conflicting DOIs.
  - `test_transactional_paper_merge_with_audit_trail`: Tests transactional merge preserving incoming abstracts, reassigning notes and tags, recording audit rows in `paper_merge_history`, and soft-merging records via `merged_into_id`.
  - `test_pdf_integrity_and_text_extraction`: Tests synthetic valid PDF extraction, zero-byte file detection, and corrupted PDF handling.
- `src/test/processing-pipeline.test.tsx`:
  - Validates `LibraryView` rendering the three tabs: "Library Papers", "Duplicate Review", and "Document Integrity & Pipeline".
  - Validates switching between tabs, displaying the candidate queue, triggering scans, and inspecting the local file integrity table.

## 3. Manual Verification Steps
1. **Metadata Normalization**:
   - Save or import papers with varied DOI formats (`https://doi.org/10.1038/...`, `doi:10.1038/...`).
   - Navigate to **Library ➔ Document Integrity & Pipeline** and click **Normalize All Metadata**.
   - Verify that all canonical DOIs are cleaned and registered in `paper_identifiers`.
2. **Duplicate Review Workflow**:
   - Add two papers with similar titles and identical years (e.g., preprint and published record).
   - Click **Run Duplicate Scan**.
   - Navigate to **Duplicate Review** tab to inspect the candidate card with similarity score, match tier, and evidence tags.
   - Click **Merge Records** to open the modal, select canonical paper and preservation options, and confirm. Verify that the non-canonical paper is softly merged and user notes are preserved.
   - Click **Keep Separate** to dismiss false positives without deleting records.
3. **PDF Document Verification**:
   - Save a paper with a local PDF.
   - In **Document Integrity & Pipeline**, click **Verify Document Hashes & Text**.
   - Verify that the streamed SHA-256 hash is computed, page count is extracted, and the status chip reads "Verified".
