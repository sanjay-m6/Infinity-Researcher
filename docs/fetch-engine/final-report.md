# Multi-Source Academic Retrieval and PDF Verification Engine — Final Engineering Report

## 1. Executive Summary

This report concludes the comprehensive modernization of **Infinity Researcher**'s academic source retrieval, alternative full-text discovery, and document identity verification engine.

The modernized pipeline transitions the application from a single-URL naive downloader to an enterprise-grade scholarly acquisition framework. By combining multi-source fan-out discovery across legitimate academic registries (OpenAlex, Crossref, arXiv, Europe PMC, PubMed Central, Unpaywall, and Semantic Scholar) with automated PDF structural validation and document identity verification, the application guarantees that downloaded research papers match the requested citation without risk of library corruption, paywall traps, or copyright violations.

---

## 2. Core Architectural Upgrades

```
                             [ User Discovery Query / DOI ]
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │   Rust Academic Source Dispatcher       │
                      │  (OpenAlex, Crossref, arXiv, EuroPMC)   │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Normalized Academic Work Record      │
                      │  (Canonical DOI, Title Key, Authors)    │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │      Alternative Full-Text Resolver     │
                      │  - Direct Publisher / Gold OA           │
                      │  - OpenAlex Repository Locations        │
                      │  - Europe PMC Open Access Cache         │
                      │  - Unpaywall Green/Gold Resolver        │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │   Resilient Download State Machine      │
                      │  1. QUEUED                              │
                      │  2. RESOLVING_SOURCE                    │
                      │  3. CHECKING_ACCESS                     │
                      │  4. DOWNLOADING (.tmp_{job_id}.part)    │
                      │  5. VALIDATING_PDF (Magic Bytes check)  │
                      │  6. VERIFYING_IDENTITY (Shingle match)  │
                      │  7. COMMITTING_FILE (Atomic rename)     │
                      │  8. COMPLETED ({paper_id}.pdf)          │
                      └─────────────────────────────────────────┘
```

### 2.1 Schema Version 15 Migration
The SQLite relational database was upgraded via Migration `0015_multi_source_retrieval_and_verification.sql`:
* Added `version_type`, `identity_status`, `identity_score`, and `provenance_json` to `pdf_candidates`.
* Added versioning and verification tracking fields to `download_jobs`, `paper_files`, and `papers`.
* Maintained 100% backward compatibility with all historical collections, user notes, full-text search indexes (FTS5), and existing PDF files.

### 2.2 Lawful Alternative Full-Text Discovery
In accordance with ethical academic retrieval guidelines:
* **Strict Paywall Compliance**: The engine never attempts to bypass paywalls, defeat CAPTCHAs, hijack institutional sessions, or interface with illicit shadow libraries.
* **Green Open Access Discovery**: When a paper's final published version is behind a paywall, the resolver interrogates OpenAlex OA locations, Unpaywall, and disciplinary preprint servers to locate author-accepted manuscripts (AAM) and institutional repository deposits.
* **Explicit Scholarly Version Classification**: Every retrieved document is clearly labeled:
  - `published_version`: Final Version of Record (VOR).
  - `accepted_manuscript`: Post-peer-review author manuscript.
  - `preprint`: Non-peer-reviewed version (arXiv, bioRxiv, ChemRxiv).
  - `repository_version`: Institutional repository deposit.

### 2.3 Document Identity Verification
The `PdfProcessor::reconcile_identity` engine prevents wrong-document ingestion:
* **Conflicting DOI Check**: Extracts embedded DOIs using regex (`10\.\d{4,9}/[-._;()/:A-Za-z0-9]+`). If the PDF contains a valid DOI that directly conflicts with the target paper's canonical DOI, it is immediately rejected as `wrong_document`.
* **Title Shingle Matching**: Computes Jaccard/Dice token similarity across normalized 3-gram title shingles.
* **Author Surname Corroboration**: Confirms the presence of listed author surnames within the document header and first two pages.
* **Structural Integrity**: Rejects HTML error pages returned with HTTP 200 headers by enforcing `%PDF-` magic byte inspection and `lopdf` stream validation.

### 2.4 Atomic Commitment and Fault Tolerance
* Downloads stream to `.tmp_{job_id}.part` scratch files.
* Only after validation and identity verification succeed is the file atomically renamed to `{paper_id}.pdf`.
* If a download fails or identity verification rejects the file, the `.part` scratch file is immediately unlinked.
* Interrupted downloads are automatically detected on startup and cleaned up or resumed.

---

## 3. Verification Against Acceptance Criteria

| Requirement | Implementation Details | Status |
| :--- | :--- | :--- |
| **No Rebuild / Preserve Stack** | Tauri 2 + Rust + Python + SQLite + React TS fully preserved | **PASSED** |
| **Preserve User Data** | All existing libraries, notes, collections, and PDFs remain intact | **PASSED** |
| **Multi-Source Connectors** | OpenAlex, Crossref, arXiv, Europe PMC, PubMed Central, Unpaywall | **PASSED** |
| **Document Identity Verification**| `reconcile_identity` with shingle scoring, DOI regex, and reject traps | **PASSED** |
| **Download State Machine** | 8-stage lifecycle with `.part` isolation and atomic rename | **PASSED** |
| **Frontend Integration** | Semantic version badges, provenance indicators, and access status | **PASSED** |
| **Documentation Suite** | All 17 architectural and operational documents completed in `docs/fetch-engine/` | **PASSED** |

---

## 4. Documentation Index

The complete documentation suite for the modernized retrieval framework is maintained in `docs/fetch-engine/`:
1. [initial-audit.md](file:///d:/Paper/docs/fetch-engine/initial-audit.md) — Comprehensive audit of existing connectors and data structures.
2. [connector-architecture.md](file:///d:/Paper/docs/fetch-engine/connector-architecture.md) — Layered connector and dispatch architecture.
3. [search-algorithm.md](file:///d:/Paper/docs/fetch-engine/search-algorithm.md) — Hybrid multi-source query fan-out and deduplication.
4. [metadata-normalization.md](file:///d:/Paper/docs/fetch-engine/metadata-normalization.md) — Canonical schema and title-key hashing.
5. [source-capabilities.md](file:///d:/Paper/docs/fetch-engine/source-capabilities.md) — Rate limits, supported identifiers, and authentication models.
6. [full-text-discovery.md](file:///d:/Paper/docs/fetch-engine/full-text-discovery.md) — Lawful alternative location resolution workflow.
7. [access-and-version-classification.md](file:///d:/Paper/docs/fetch-engine/access-and-version-classification.md) — Scholarly document version taxonomy.
8. [pdf-validation.md](file:///d:/Paper/docs/fetch-engine/pdf-validation.md) — Byte inspection, header/trailer validation, and corruption rejection.
9. [document-identity-verification.md](file:///d:/Paper/docs/fetch-engine/document-identity-verification.md) — Text shingles, author matching, and DOI cross-checks.
10. [download-state-machine.md](file:///d:/Paper/docs/fetch-engine/download-state-machine.md) — Formal 8-state acquisition lifecycle.
11. [rust-python-contract.md](file:///d:/Paper/docs/fetch-engine/rust-python-contract.md) — IPC contracts, JSON schemas, and process lifecycles.
12. [caching-policy.md](file:///d:/Paper/docs/fetch-engine/caching-policy.md) — TTL, HTTP caching headers, and LRU eviction rules.
13. [security-review.md](file:///d:/Paper/docs/fetch-engine/security-review.md) — SSRF prevention, directory traversal protections, and safe deserialization.
14. [open-source-license-review.md](file:///d:/Paper/docs/fetch-engine/open-source-license-review.md) — Reference project licensing audits (PyPaperRetriever, paperfetch, quelle).
15. [benchmark-results.md](file:///d:/Paper/docs/fetch-engine/benchmark-results.md) — Quantitative performance and retrieval accuracy evaluations.
16. [test-report.md](file:///d:/Paper/docs/fetch-engine/test-report.md) — Comprehensive unit, integration, and validation test report.
17. [final-report.md](file:///d:/Paper/docs/fetch-engine/final-report.md) — Executive architectural and engineering summary (this document).

---

## 5. Conclusion

Phase 17 has successfully elevated Infinity Researcher into a reliable, ethical, and high-performance academic research desktop application. The modernized retrieval engine provides researchers with seamless access to scholarly literature while rigorously verifying document identity, protecting local file integrity, and adhering to open-access standards.

