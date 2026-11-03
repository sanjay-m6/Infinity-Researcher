# Phase 12: Academic Source Capability Registry

## 1. Overview

Different academic repositories and publishers expose heterogeneous search interfaces, ranging from full boolean REST APIs to basic HTML search forms. The **Academic Source Capability Registry** (`src/lib/search/sourceRegistry.ts`) establishes a formal, testable capability contract for every supported source.

The **Search Planner** consults this registry prior to query dispatch to:
- Prevent dispatching unsupported parameters that would fail with `400 Bad Request`.
- Automatically route unsupported parameters to the client-side post-filter pipeline.
- Enforce strict upstream rate-limit and pagination constraints.

---

## 2. Source Capability Matrix

| Source ID | Display Name | Native Free-Text | Native Title | Native Author | Native DOI | Native Year | Native OA | Pagination Mode | Max Page Size | Rate Limit | Known Constraints & Behavior |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `arxiv` | arXiv | Yes | Yes | Yes | Yes | Yes | Yes | `offset` | 200 | 3000 ms | 1 req / 3 sec per arXiv API guidelines; all items open-access preprints. |
| `biorxiv` | bioRxiv | Yes | Yes | No (Post-Filter) | Yes | No (Post-Filter) | Yes | `page` | 75 | 2000 ms | HTML search matches free-text keywords; author/year verified via client post-filter. |
| `medrxiv` | medRxiv | Yes | Yes | No (Post-Filter) | Yes | No (Post-Filter) | Yes | `page` | 75 | 2000 ms | Medical preprints; HTML search; field criteria verified via post-filter. |
| `plos` | PLOS ONE / Journals | Yes | Yes | Yes | Yes | Yes | Yes | `page` | 50 | 1000 ms | REST API with peer-reviewed CC-BY open-access journal articles. |
| `nature_srep` | Nature SciRep | Yes | Yes | No (Post-Filter) | Yes | No (Post-Filter) | Yes | `page` | 50 | 2000 ms | Open-access Nature Scientific Reports articles; HTML scraper. |
| `pmc` | PubMed Central | Yes | Yes | Yes | Yes | Yes | Yes | `offset` | 100 | 1000 ms | NCBI E-utilities API; rate limited to 3 req/sec without API key. |
| `ieee_xplore` | IEEE Xplore | Yes | Yes | Yes | Yes | Yes | Yes | `page` | 50 | 1500 ms | Mixed open-access and subscription; open-access papers have direct PDF links. |
| `local_library` | Local SQLite Library | Yes | Yes | Yes | Yes | Yes | Yes | `offset` | 500 | Instant | Instant indexed lookups over saved papers, collections, and notes. |

---

## 3. Dynamic Source Evaluation & Fallbacks

When an unrecognized or dynamic crawl source is queried:
1. `getSourceCapability(sourceId)` returns a safe baseline descriptor (`supportsFreeText: true`, `supportsAuthor: false`, `supportsYearFilter: false`).
2. The search planner forwards only the cleaned keyword query to the scraper.
3. All field-specific filters are automatically verified by the in-memory post-filter pipeline.
4. A diagnostic notice is attached to the query plan to inform observability tooling without interrupting research workflows.

---

## 4. Rate-Limiting & Compliance

Infinity Researcher enforces ethical desktop scraping standards:
- Adheres to `robots.txt` disallow paths via native Rust `UrlGuard` and Python `RobotsTxtMiddleware`.
- Applies source-specific inter-request delay timers to prevent IP blacklisting or server overload.
- Does not bypass CAPTCHAs, paywalls, or institutional access controls.

