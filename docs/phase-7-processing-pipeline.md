# Phase 7 — Processing Pipeline Architecture

## 1. Overview
The Phase 7 processing engine provides an idempotent, durable, and crash-resilient pipeline for normalizing research paper metadata, performing multi-stage deduplication, and validating local document (PDF) integrity.

```
       Incoming / Existing Library Paper
                       │
                       ▼
          [Stage 1: Metadata Normalization]
          - Unicode NFC normalization
          - Title clean key & formula preservation
          - Canonical DOI, arXiv, PMID extraction
          - Abstract HTML entity sanitization
                       │
                       ▼
          [Stage 2: Identifier & Content Indexing]
          - Insert into `paper_identifiers`
          - Update clean_title_key in SQLite
                       │
                       ▼
          [Stage 3: Multi-Stage Deduplication]
          - Stage A: Exact DOI & provider ID match
          - Stage B: Content hash & title+year key
          - Stage C: Trigram & Token similarity candidate scoring
                       │
                       ▼
        Classification: Exact | High | Review | Distinct
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
    Auto-Match                  Review Queue
    (Safe identical records)   (Ambiguous / Mismatched DOIs)
         │                           │
         ▼                           ▼
   Soft Transactional Merge     User Interactive Decision
   (`merged_into_id`, audit)   (Merge or Keep Separate)
                       │
                       ▼
          [Stage 4: PDF Integrity & Text Extraction]
          - Bounded streaming SHA-256 digest
          - Path boundary traversal defense
          - `lopdf` defensive structural parse
          - Classification: Verified | Corrupt | Missing | Encrypted | No-Text
          - Safe bounded text extraction (first 10 pages)
```

## 2. Durable State Machine & Database Schema

Processing jobs and individual item operations are persisted in SQLite:
- `processing_jobs`: Tracks high-level operations (`job_type`, `status`, `total_items`, `completed_items`, `failed_items`, `error_message`, `started_at`, `completed_at`).
  - States: `queued` ➔ `running` ➔ `completed` | `failed` | `cancelled`
- `processing_job_items`: Detailed audit trail per paper/file (`stage`, `status`, `error_message`, `attempt_count`).
- `paper_identifiers`: Relational table indexing normalized persistent identifiers (`doi`, `arxiv`, `pmid`, `pmc`, `openalex`, etc.) linked to canonical papers.
- `paper_files`: Tracks local file metadata, relative paths, SHA-256 content hashes, byte sizes, and verification states.
- `duplicate_candidates`: Records generated comparison pairs, match tiers (`exact_match`, `high_confidence`, `review_required`, `distinct`), similarity scores, and machine-readable evidence arrays.
- `paper_merge_history`: Complete audit trail of merged records, preserving original IDs, fields updated, notes/tags/files reassigned, and merge notes.

## 3. Concurrency, Cancellation & Crash Recovery
- **Worker Isolation**: Processing jobs execute within bounded transactional boundaries without holding long locks on the main database connection.
- **Idempotency**: Rerunning normalization or duplicate scanning on already-processed papers reuses stable keys and updates existing candidate states without duplicating rows.
- **Cooperative Cancellation**: Long-running file scans and deduplication passes check job status flags between items to halt cleanly when cancelled.
- **Restart Recovery**: Abandoned `running` jobs from an unexpected process termination are identified on startup and flagged as failed with an explanation or resumed safely.
