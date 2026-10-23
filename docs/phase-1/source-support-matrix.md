# Academic Source Support Matrix

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Verified  
**Last Verified Date:** 2026-10-24  

---

## 1. Source Support Tiers & Classification Model

To ensure strict compliance with publisher terms, robot directives, and technical stability, connectors are categorized into four operational tiers:

* **Tier A (Official API / Authorized Repository Integration):**  
  Documented, stable JSON/XML APIs provided by academic infrastructure bodies with explicit rate limits, pagination, and query parameters.
* **Tier B (Permitted Structured Web Adapter):**  
  Public feeds or structured landing pages where robots.txt, terms of service, and public data policies permit automated indexing with polite pacing ($\le 1$ req/sec). No anti-bot evasion.
* **Tier C (User-Initiated / Browser-Assisted Link):**  
  Sites where automated downloading is prohibited, paywalled, or gated behind authentication/CAPTCHAs. The application stores canonical metadata and opens the link in the user's default browser.
* **Unsupported (Prohibited / Anti-Bot Blocked):**  
  Platforms whose terms of service strictly forbid scraping, enforce aggressive CAPTCHAs, or require illicit circumvention (e.g., Sci-Hub, ResearchGate gated crawler blocks). Automated retrieval will NOT be built.

---

## 2. Comprehensive Candidate Evaluation Matrix

### Candidate 1: OpenAlex
* **Official Homepage:** [https://openalex.org](https://openalex.org)
* **API Documentation:** [https://docs.openalex.org](https://docs.openalex.org)
* **Terms / Access Policy:** [https://openalex.org/terms](https://openalex.org/terms) (CC0 Public Domain for metadata)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Comprehensive keyword, Boolean, field filters (`title.search`, `abstract.search`, `author.id`, `institutions.id`, publication year, open access status).
* **Metadata Fields:** Title, author names and ORCIDs, abstract (reconstructed from inverted index), DOI, publication date, venue/host institution, external IDs (PMID, MagID), citation counts, license type, primary location URLs.
* **Full-Text / PDF Availability:** Direct links provided via `open_access.oa_url` when marked `is_oa: true`. Unpaywall integration embedded. Download allowed only for verified open-access URLs.
* **Authentication:** Optional. Unauthenticated allows $0.10 daily budget (10 req/s); free API key allows $1.00 daily budget (30 req/s, 100k requests/day) and cursor pagination.
* **Rate Limits & Headers:** 10–30 req/s depending on key. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
* **Pagination:** Page-based (up to 200 items per page) and cursor pagination (`cursor=*`).
* **License & Attribution:** CC0 Public Domain dedication. Attribution appreciated.
* **Reliability & Complexity:** High reliability; Low-to-Medium complexity (requires abstract inverted index reconstruction).
* **MVP Recommendation:** **Include in P0 (Core MVP)**.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 2: Crossref REST API
* **Official Homepage:** [https://www.crossref.org](https://www.crossref.org)
* **API Documentation:** [https://api.crossref.org](https://api.crossref.org)
* **Terms / Access Policy:** [https://www.crossref.org/documentation/retrieve-metadata/rest-api/etiquette/](https://www.crossref.org/documentation/retrieve-metadata/rest-api/etiquette/)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Free-text query (`query.bibliographic`, `query.title`, `query.author`), filter by year, type, publisher, DOI lookup.
* **Metadata Fields:** Authoritative DOI, title, author lists (with affiliation & ORCID), publication date (print & online), journal/conference title, volume/issue, publisher, license declarations, references.
* **Full-Text / PDF Availability:** Bibliographic metadata provider. Crossref does not host PDFs. Returns publisher landing URLs in `resource.primary.URL` and occasionally syndication links in `link` array.
* **Authentication:** No API key required. "Polite Pool" enabled by providing `mailto=email` in query or `User-Agent`.
* **Rate Limits & Headers:** Public: 5 req/s (1 concurrency); Polite Pool: 10 req/s (5 concurrency). Headers: `x-api-pool`, `x-rate-limit-limit`, `x-concurrency-limit`.
* **Pagination:** Offset/rows (`offset`, `rows` $\le 100$) and cursor pagination (`cursor=*`).
* **License & Attribution:** Open metadata; free redistribution.
* **Reliability & Complexity:** High reliability; Low complexity.
* **MVP Recommendation:** **Include in P0 (Core MVP)** for authoritative DOI validation and metadata enrichment.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 3: Semantic Scholar Academic Graph (S2AG)
* **Official Homepage:** [https://www.semanticscholar.org](https://www.semanticscholar.org)
* **API Documentation:** [https://api.semanticscholar.org/api-docs/graph](https://api.semanticscholar.org/api-docs/graph)
* **Terms / Access Policy:** [https://www.semanticscholar.org/product/api](https://www.semanticscholar.org/product/api)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Keyword search (`/graph/v1/paper/search`), batch lookup (`/graph/v1/paper/batch`), field-restricted projection.
* **Metadata Fields:** PaperId, DOI, ArXivId, PubMedId, title, abstract, authors, publication date, venue, citationCount, influentialCitationCount, referenceCount, `openAccessPdf`.
* **Full-Text / PDF Availability:** Direct open access PDF URL provided via `openAccessPdf.url` when legally indexed from open repositories.
* **Authentication:** Optional for low-traffic; free API key strongly recommended (`x-api-key` header).
* **Rate Limits & Headers:** Shared unauthenticated pool (frequent HTTP 429); Free key grants dedicated 1 req/sec. Max 10MB payload limit.
* **Pagination:** Offset / limit (`limit` $\le 100$).
* **License & Attribution:** AI2 Terms of Use; non-commercial research use supported.
* **Reliability & Complexity:** Medium-to-High reliability; Low complexity.
* **MVP Recommendation:** **Include in P0 (Core MVP)**.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 4: arXiv
* **Official Homepage:** [https://arxiv.org](https://arxiv.org)
* **API Documentation:** [https://arxiv.org/help/api/user-manual](https://arxiv.org/help/api/user-manual)
* **Terms / Access Policy:** [https://arxiv.org/help/robots](https://arxiv.org/help/robots)
* **Connector Type:** Tier A (Official XML / Atom API)
* **Search Capabilities:** Full query syntax (`search_query=all:electron`, `au:einstein`, `ti:relativity`, `cat:cs.AI`), id list lookup (`id_list`).
* **Metadata Fields:** arXiv ID, version, title, authors, summary/abstract, published/updated dates, primary category, DOI (if published), journal ref, comment.
* **Full-Text / PDF Availability:** Direct open-access PDF download via `https://arxiv.org/pdf/{id}.pdf`.
* **Authentication:** None required.
* **Rate Limits & Headers:** Strict pacing: Max 1 request per 3 seconds recommended by arXiv documentation. Mandatory descriptive `User-Agent`. Automated bulk harvesting via web crawler prohibited (S3 bucket required for bulk).
* **Pagination:** `start` and `max_results` parameters.
* **License & Attribution:** Open preprint repository; individual preprints under arXiv perpetual non-exclusive license or Creative Commons.
* **Reliability & Complexity:** High reliability; Medium complexity (requires XML/Atom parser).
* **MVP Recommendation:** **Include in P0 (Core MVP)** for Physics, Mathematics, and Computer Science coverage.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 5: Europe PMC
* **Official Homepage:** [https://europepmc.org](https://europepmc.org)
* **API Documentation:** [https://europepmc.org/RestfulWebService](https://europepmc.org/RestfulWebService)
* **Terms / Access Policy:** [https://europepmc.org/terms](https://europepmc.org/terms)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Comprehensive biomedical query syntax, boolean logic, field qualifiers (`AUTH:`, `JOURNAL:`, `DOI:`).
* **Metadata Fields:** PMID, PMCID, DOI, title, authorString, authorId list (ORCID), journalTitle, pubYear, abstractText, `isOpenAccess`, `inEpmc`, `inPmc`, `fullTextUrlList`.
* **Full-Text / PDF Availability:** Direct PDF URLs in `fullTextUrlList` for open access subset (PMC Open Access articles).
* **Authentication:** None required.
* **Rate Limits & Headers:** Fair-use policy ($\le 10$ req/s recommended); standard descriptive `User-Agent` required.
* **Pagination:** `pageSize` ($\le 100$) with cursor pagination (`cursorMark`).
* **License & Attribution:** Open Access subset governed by CC licenses; metadata openly queryable.
* **Reliability & Complexity:** Very high reliability; Low-to-Medium complexity.
* **MVP Recommendation:** **Include in P0 (Core MVP)** for Life Sciences and Medicine.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 6: Directory of Open Access Journals (DOAJ)
* **Official Homepage:** [https://doaj.org](https://doaj.org)
* **API Documentation:** [https://doaj.org/api/v4/docs](https://doaj.org/api/v4/docs)
* **Terms / Access Policy:** [https://doaj.org/terms](https://doaj.org/terms)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Lucene-style search query (`/api/v4/search/articles/{query}`).
* **Metadata Fields:** Title, authors, abstract, DOI, journal title, ISSN, explicit license type (CC BY, CC BY-SA, etc.), fulltext links.
* **Full-Text / PDF Availability:** Direct landing or PDF links provided via `bibjson.link` array where `type == "fulltext"`.
* **Authentication:** None required for public searching.
* **Rate Limits & Headers:** Pacing $\le 2$ req/s recommended; max `pageSize=100`; search window capped at 1,000 results.
* **Pagination:** `page` and `pageSize`.
* **License & Attribution:** CC-BY for DOAJ metadata.
* **Reliability & Complexity:** High reliability; Low complexity.
* **MVP Recommendation:** **Include in P1** (High quality OA source; follow-up after OpenAlex & Crossref).
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 7: CORE (core.ac.uk)
* **Official Homepage:** [https://core.ac.uk](https://core.ac.uk)
* **API Documentation:** [https://core.ac.uk/services/api](https://core.ac.uk/services/api)
* **Terms / Access Policy:** [https://core.ac.uk/terms](https://core.ac.uk/terms)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Lucene queries across aggregated global institutional repositories.
* **Metadata Fields:** CORE ID, title, authors, abstract, DOI, repository URLs, downloadUrl.
* **Full-Text / PDF Availability:** Aggregated repository PDFs when available via `downloadUrl`.
* **Authentication:** Free API key required for persistent access; token bucket rate-limiting.
* **Rate Limits & Headers:** Dynamic token headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
* **Pagination:** Offset and limit.
* **License & Attribution:** Open repository terms.
* **Reliability & Complexity:** Medium reliability (intermittent aggregator latency); Medium complexity.
* **MVP Recommendation:** **Include in P1 / P2**.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 8: bioRxiv / medRxiv
* **Official Homepage:** [https://www.biorxiv.org](https://www.biorxiv.org) / [https://www.medrxiv.org](https://www.medrxiv.org)
* **API Documentation:** [https://api.biorxiv.org/details](https://api.biorxiv.org/details)
* **Terms / Access Policy:** [https://www.biorxiv.org/about/terms](https://www.biorxiv.org/about/terms)
* **Connector Type:** Tier A (Official REST API)
* **Search Capabilities:** Date-range and cursor-based feed extraction; DOI lookup. (Note: Search by arbitrary text keyword is not natively supported on this endpoint; relies on date interval or DOI).
* **Metadata Fields:** DOI, title, authors, author institutions, publication date, version, abstract, license.
* **Full-Text / PDF Availability:** Direct PDF URLs formatted deterministically from preprint DOI (`https://www.biorxiv.org/content/{doi}.full.pdf`).
* **Authentication:** None required.
* **Rate Limits & Headers:** Polite pacing ($\le 1$ req/s).
* **Pagination:** 100 items per batch via cursor.
* **License & Attribution:** Preprints under author-selected CC licenses.
* **Reliability & Complexity:** High reliability for DOI lookups, but limited as a general keyword search engine.
* **MVP Recommendation:** **Include in P1** (as DOI resolver / specialized bio preprint connector; use OpenAlex or Europe PMC for general discovery).
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 9: Local PDF Import
* **Official Homepage:** Local Filesystem
* **Connector Type:** Tier A (Local File Parser & Metadata Extractor)
* **Search Capabilities:** N/A (Ingestion mechanism).
* **Metadata Fields:** Extracted from PDF document info dictionary (Title, Author, Subject) and text analysis (regex scanning for DOI `10.\d{4,9}/[-._;()/:A-Za-z0-9]+` and arXiv IDs).
* **Full-Text / PDF Availability:** Local file already on disk; copied atomically or referenced in library data directory.
* **Authentication:** None (Local OS file access).
* **Rate Limits & Headers:** Bounded by local disk I/O and CPU extraction throughput.
* **Pagination:** Local directory enumeration.
* **License & Attribution:** User responsibility (local files).
* **Reliability & Complexity:** Medium-to-High; handles corrupt, encrypted, or scanned non-OCR PDFs gracefully.
* **MVP Recommendation:** **Include in P0 (Core MVP)**.
* **Confidence Level:** Verified (Checked 2026-10-24).

---

### Candidate 10: Commercial Publisher Portals (IEEE Xplore, ScienceDirect, SpringerLink, Wiley)
* **Connector Type:** Tier C (User-Initiated / Browser Link Out) or Unsupported for automated scraping.
* **Analysis:** These platforms require institutional subscriptions, enforce strict anti-bot mechanisms (Cloudflare, PerimeterX, Akamai), and explicitly prohibit automated scraping in their terms.
* **MVP Recommendation:** **Metadata link-out only**. When a search candidate points to an IEEE or ScienceDirect paper without an open access route, the app displays canonical metadata and provides an "Open Publisher Page" button. No scraping or automated bypass will ever be attempted.
* **Confidence Level:** Verified.
