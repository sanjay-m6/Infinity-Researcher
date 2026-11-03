# Open-Source License & Reference Implementation Review

## 1. Evaluated Reference Implementations

In accordance with Phase J requirements, three prominent open-source academic retrieval and verification projects were audited for potential integration or algorithmic adaptation:

| Project | License | Primary Language | Maintenance Status | Key Architectural Takeaways | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PyPaperRetriever** | BSD-3-Clause | Python | Active (JOSS 2024) | Polite Unpaywall DOI queries, Crossref links, PubMed Central mapping. | **Adapted algorithmically** into Rust `PdfResolverService` and Python adapters. |
| **paperfetch** | MIT License | Python | Active (2025–2026) | `%PDF-` signature checking, first-page token extraction, document matching. | **Adapted algorithmically** into Rust `PdfProcessor::reconcile_identity` & `CandidateVerifier`. |
| **quelle** | MIT License | Rust / Python | Active CLI | Multi-source priority fallback chain, normalized DOI key caching. | **Adapted algorithmically** into `AcademicSearchPlan` & `doi_cache`. |

---

## 2. Detailed Technical & License Audits

### 2.1 PyPaperRetriever
- **License**: BSD-3-Clause (Permissive).
- **Core Value**: Demonstrated the polite Unpaywall DOI query convention (`/v2/{doi}?email=...`) and handling of Unpaywall's `best_oa_location` and `oa_locations` arrays.
- **Decision**: Avoided bundling external Python CLI dependencies into the desktop bundle. The clean, compliant HTTP query logic and data models were natively implemented in Rust (`PdfResolverService::query_unpaywall_oa`).

### 2.2 paperfetch
- **License**: MIT (Permissive).
- **Core Value**: Emphasized that finding an open URL is insufficient: automated verification of downloaded files must check magic bytes and match document title tokens against requested publications.
- **Decision**: Adapted the document identity matching model into native Rust using `lopdf`. The Jaccard token similarity and author surname overlap logic was integrated directly into `CandidateVerifier` and `PdfProcessor`.

### 2.3 quelle
- **License**: MIT (Permissive).
- **Core Value**: Elegant priority-ordered fallback chain across metadata sources and persistent local DOI caching.
- **Decision**: Adopted the concept of staged fallback query planning in `query_planner.rs` and the SQLite `doi_cache` table.

---

## 3. Compliance and Attribution

All adapted algorithms originate from BSD-3-Clause and MIT licensed open-source software, which permit commercial and non-commercial desktop embedding, modification, and redistribution. 

Attribution notices for PyPaperRetriever, paperfetch, and quelle are recorded in `THIRD_PARTY_NOTICES.md` to ensure full compliance.

