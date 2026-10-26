# Academic Source Connectors & API Specifications

**Document:** Phase 5 Source Connectors Specification  
**Application:** Research Paper Scraper  
**Last Verified Date:** 2026-10-24  
**Status:** Active & Implemented  

---

## 1. Provider Capability & Specification Matrix

| Provider | Purpose & Coverage | Official API Documentation | Connector Status | Auth / API Key | Official Rate Limits & Quotas | Search Fields & Filters | Pagination Model | Attribution & Terms |
|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
| **OpenAlex** | Global multidisciplinary scholarly index (~250M works) | [https://docs.openalex.org](https://docs.openalex.org) | **Implemented** | Optional. Unauthenticated supported. Optional API key via header/param. | Public pool: 10 req/s. Free API key: 30 req/s (100k req/day). | Free text query (`search`), filters: `publication_year`, `is_oa`, `has_doi`. Reconstructs abstract from inverted index. | Page & per-page (`page=N`, `per-page=N`, max 200). Cursor pagination (`cursor=*`). | CC0 Public Domain metadata. Attribution appreciated. |
| **Crossref** | Authoritative DOI registrar & bibliographic citation metadata | [https://api.crossref.org](https://api.crossref.org) | **Implemented** | None required. "Polite Pool" enabled by User-Agent / mailto. | Public: 5 req/s. Polite: 10 req/s with 5 concurrency limit. | Free text query (`query.bibliographic`), filters: publication year, DOI lookup, author matching. | Offset & rows (`offset=N`, `rows=N`, max 100). | Open metadata. Free redistribution. |
| **Semantic Scholar** | AI-powered citation graph & open-access PDF resolver | [https://api.semanticscholar.org/api-docs/graph](https://api.semanticscholar.org/api-docs/graph) | **Implemented** | Optional. Public pool shared (1 req/s). Free API key via `x-api-key`. | 1 req/s (public); up to 10 req/s with registered key. | Keyword search (`/graph/v1/paper/search`). Specific field projection (`fields=...`). | Offset & limit (`offset=N`, `limit=N`, max 100). | AI2 Terms of Use; non-commercial research use supported. |
| **arXiv** | Physical sciences, mathematics, CS & quantitative biology preprints | [https://arxiv.org/help/api/user-manual](https://arxiv.org/help/api/user-manual) | **Implemented** | None required. | Strict 1 request per 3 seconds recommended. Mandatory descriptive User-Agent. | Atom XML search (`search_query=all:term`, `ti:term`, `au:term`). Direct PDF link generation. | Start & max_results (`start=N`, `max_results=N`). | Preprints under arXiv non-exclusive license or Creative Commons. |
| **Europe PMC** | Comprehensive life sciences and biomedical literature index | [https://europepmc.org/RestfulWebService](https://europepmc.org/RestfulWebService) | **Implemented** | None required. | $\le 10$ req/s recommended fair use. | Full text search, field qualifiers, open access status, PMC full-text links. | Page size (`pageSize=N`, max 100) and cursor pagination (`cursorMark=...`). | CC licenses for open access subset; open bibliographic metadata. |

---

## 2. In-Depth Connector Details

### 2.1 OpenAlex
- **Endpoint:** `GET https://api.openalex.org/works`
- **Request Parameters:**
  - `search`: Keyword string.
  - `filter`: Comma-delimited key-value filters, e.g. `is_oa:true`, `publication_year:2020-2024`.
  - `page`: 1-based index.
  - `per_page`: 20 default (up to 200).
- **Abstract Reconstruction:** OpenAlex stores abstract text in `abstract_inverted_index` format (`{ "term": [pos1, pos2] }`). The adapter sorts all term occurrences by positional indices and reconstructs the full narrative text.
- **Open Access & PDF Semantics:** Uses `open_access.oa_url` only when `is_oa == true`. Never assumes publisher landing pages are direct PDFs.
- **Verification Date:** 2026-10-24.

### 2.2 Crossref REST API
- **Endpoint:** `GET https://api.crossref.org/works`
- **Request Parameters:**
  - `query.bibliographic`: Search terms.
  - `filter`: E.g. `from-pub-date:YYYY,until-pub-date:YYYY`.
  - `rows`: 20 default (up to 100).
  - `offset`: 0-based offset.
- **Authoritative Identity:** Crossref DOIs are canonical. When present, the DOI is normalized (`10.xxxx/...`) and used as the gold-standard deduplication key.
- **Verification Date:** 2026-10-24.

### 2.3 Semantic Scholar Academic Graph (S2AG)
- **Endpoint:** `GET https://api.semanticscholar.org/graph/v1/paper/search`
- **Request Parameters:**
  - `query`: Free-text search string.
  - `fields`: `paperId,title,abstract,authors,year,publicationDate,venue,externalIds,url,isOpenAccess,openAccessPdf,citationCount`.
  - `offset`: 0-based offset.
  - `limit`: 20 default (up to 100).
- **Rate-Limit Handling:** Unauthenticated requests receive HTTP 429 when the shared pool is saturated. The connector parses `Retry-After` headers and reports `rate_limited` status independently.
- **Verification Date:** 2026-10-24.

### 2.4 arXiv API
- **Endpoint:** `GET https://export.arxiv.org/api/query`
- **Request Parameters:**
  - `search_query`: E.g. `all:query` or `ti:query`.
  - `start`: 0-based offset.
  - `max_results`: 20 default.
- **Parser Security & Format:** The adapter parses standard Atom 1.0 XML using `quick-xml`. XML entities and escaped HTML within titles and summaries are decoded into clean plain text. Preprints preserve their arXiv identifier and direct PDF URLs (`https://arxiv.org/pdf/{id}.pdf`).
- **Pacing:** Rate-limited to polite intervals to prevent IP bans.
- **Verification Date:** 2026-10-24.

### 2.5 Europe PMC
- **Endpoint:** `GET https://europepmc.org/RestfulWebService/rest/search`
- **Request Parameters:**
  - `query`: Keyword query.
  - `format`: `json`.
  - `resultType`: `core`.
  - `pageSize`: 20 default.
  - `cursorMark`: `*` for initial page, or token from previous response.
- **Biomedical Metadata:** Maps PMID, PMCID, and DOI. Identifies open access status and links to PMC full-text repositories.
- **Verification Date:** 2026-10-24.

---

## 3. Disallowed and Excluded Providers

The following providers from the Phase 1 candidate evaluation are deliberately excluded from automated API scraping:
- **Sci-Hub:** Prohibited by ethical and compliance policies.
- **ResearchGate / Academia.edu:** Prohibited by terms of service; enforce aggressive CAPTCHA/anti-bot crawler blocks.
- **Commercial Link-Out Only (IEEE Xplore, ScienceDirect):** Available strictly as Tier C metadata link-outs in the UI. No automated scraping or paywall bypass is performed.
