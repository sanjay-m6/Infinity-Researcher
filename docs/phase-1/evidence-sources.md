# Evidence Sources & Reference Registry

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Last Verified Date:** 2026-10-24  
**Audit Standard:** Official API documentation, published terms of service, and direct service response contracts.

---

## 1. Primary Academic Sources & API Evidence

### 1. OpenAlex
* **Service Name:** OpenAlex (OurResearch)
* **Official Website:** [https://openalex.org](https://openalex.org)
* **API Documentation:** [https://docs.openalex.org](https://docs.openalex.org)
* **API Endpoint Base:** `https://api.openalex.org/works`
* **Rate Limit & Policy Documentation:** [https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication](https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication)
* **Specific Verified Facts:**
  * Usage is managed via a daily dollar/credit budget resetting at midnight UTC.
  * Anonymous/unauthenticated calls: $0.10/day budget (~10,000 credits), velocity limit of 10 requests per second. Cursor paging past page 1 is restricted.
  * Free API Key tier: $1.00/day budget (~100,000 credits), velocity limit of 30 requests per second, cursor paging fully supported.
  * Key transport: Query parameter `?api_key=KEY` or HTTP header `Authorization: Bearer KEY`.
  * Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Credits-Used`, `X-RateLimit-Reset`.
  * Content: Abstracts provided as inverted indexes (`abstract_inverted_index`), DOIs, canonical URLs, primary locations, open access status (`open_access.is_oa`, `open_access.oa_url`), citation counts.
  * Terms & License: OpenAlex metadata is released under the Creative Commons CC0 public domain dedication.

---

### 2. Crossref
* **Service Name:** Crossref REST API
* **Official Website:** [https://www.crossref.org](https://www.crossref.org)
* **API Documentation:** [https://api.crossref.org](https://api.crossref.org) / [https://www.crossref.org/documentation/retrieve-metadata/rest-api/](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
* **Rate Limits & Polite Pool Policy:** [https://www.crossref.org/documentation/retrieve-metadata/rest-api/etiquette/](https://www.crossref.org/documentation/retrieve-metadata/rest-api/etiquette/)
* **Specific Verified Facts:**
  * Public pool (anonymous): 5 req/sec, concurrency limit of 1.
  * Polite pool (with identification): 10 req/sec, concurrency limit of 5.
  * Identification method: `mailto=user@example.com` parameter in query or in `User-Agent` header (e.g. `User-Agent: ResearchPaperScraper/1.0 (mailto:user@domain.com)`).
  * Response headers: `x-api-pool`, `x-rate-limit-limit`, `x-rate-limit-interval`, `x-concurrency-limit`.
  * Rate-limit response: HTTP 429 Too Many Requests.
  * Content: Authoritative DOI registration agency. Returns rich bibliographic metadata, authors with ORCID, publication year, volume/issue, publisher, license arrays, and publisher landing links.
  * Full Text: Crossref itself does not host PDFs; metadata records provide publisher URLs (often subscription-gated) and occasionally open-access links via the `link` array.

---

### 3. Semantic Scholar (S2AG)
* **Service Name:** Semantic Scholar Academic Graph API (Allen Institute for AI)
* **Official Website:** [https://www.semanticscholar.org](https://www.semanticscholar.org)
* **API Documentation:** [https://api.semanticscholar.org/api-docs/graph](https://api.semanticscholar.org/api-docs/graph)
* **Partner & Rate Limit Guidelines:** [https://www.semanticscholar.org/product/api](https://www.semanticscholar.org/product/api)
* **Specific Verified Facts:**
  * Unauthenticated: Shared global pool; susceptible to frequent HTTP 429 and 500 errors during traffic peaks.
  * Authenticated (free API key requested via portal): Dedicated 1 request per second across endpoints.
  * Header requirement: `x-api-key: YOUR_KEY` (case-sensitive).
  * Endpoints: `GET /graph/v1/paper/search` (supports `query`, `fields`, `offset`, `limit`), `POST /graph/v1/paper/batch` (up to 500 paper IDs).
  * Payload limit: Maximum 10 MB response size; developers must supply the `fields` parameter explicitly to avoid oversized payloads.
  * Full-text access: `openAccessPdf` field returns direct open-access PDF URLs when available from open-access publishers or unpaywall sources.
  * Terms: Metadata accessible for non-commercial research; key agreement limits redistribution of bulk datasets without license.

---

### 4. arXiv
* **Service Name:** arXiv API (Cornell University)
* **Official Website:** [https://arxiv.org](https://arxiv.org)
* **API Documentation:** [https://arxiv.org/help/api/user-manual](https://arxiv.org/help/api/user-manual)
* **Terms of Use & Robot Policy:** [https://arxiv.org/help/robots](https://arxiv.org/help/robots)
* **Specific Verified Facts:**
  * Endpoint: `http://export.arxiv.org/api/query` (supports Atom 1.0 XML responses).
  * Rate limit / pacing: Maximum 1 request per 3 seconds recommended by official user manual; absolute ceiling of 3 requests per second before automated IP ban.
  * User-Agent requirement: Must identify the application name and developer/user email (generic library UAs are blocked).
  * PDF Access: Open access preprints. Direct PDF endpoint `https://arxiv.org/pdf/{arxiv_id}.pdf`.
  * Restrictions: Automated bulk downloading of PDFs via web crawlers is strictly prohibited. For corpus-level harvesting, arXiv requires the use of their public AWS S3 bucket. Desktop downloaders must pace downloads sequentially with polite delays.

---

### 5. Europe PMC
* **Service Name:** Europe PMC RESTful Web Service (EMBL-EBI)
* **Official Website:** [https://europepmc.org](https://europepmc.org)
* **API Documentation & Swagger:** [https://europepmc.org/RestfulWebService](https://europepmc.org/RestfulWebService)
* **Terms & Fair Use Policy:** [https://europepmc.org/terms](https://europepmc.org/terms)
* **Specific Verified Facts:**
  * Base Endpoint: `https://www.ebi.ac.uk/europepmc/webservices/rest/search`
  * No mandatory API key or token required for search and retrieval.
  * Rate limit: Implicit fair-use policy; standard client pacing recommended at $\le 10$ requests per second.
  * Output formats: JSON (`format=json`) and XML.
  * Pagination: Cursor-based pagination via `cursorMark` (`cursorMark=*` initially) alongside `pageSize` ($\le 100$).
  * Content: 40M+ life science records (PubMed, PMC, preprints, patents). Includes `isOpenAccess` ('Y'/'N'), `inEpmc`, `inPmc`, and `fullTextUrlList` which contains direct open-access PDF links for articles in the PMC Open Access subset.

---

### 6. NCBI E-utilities (PubMed)
* **Service Name:** Entrez Programming Utilities (E-utilities) (National Center for Biotechnology Information / NLM)
* **Official Website:** [https://www.ncbi.nlm.nih.gov/books/NBK25501/](https://www.ncbi.nlm.nih.gov/books/NBK25501/)
* **API Key & Usage Guidelines:** [https://www.ncbi.nlm.nih.gov/books/NBK25497/](https://www.ncbi.nlm.nih.gov/books/NBK25497/)
* **Specific Verified Facts:**
  * Rate limit without API key: Maximum 3 requests per second per IP.
  * Rate limit with API key: Maximum 10 requests per second per IP.
  * Required parameters: All requests must include `tool` (application identifier without spaces) and `email` (user contact email). Optional parameter: `api_key`.
  * Search workflow: `esearch.fcgi` yields a list of PMIDs; `esummary.fcgi` or `efetch.fcgi` returns bibliographic records and abstracts.
  * Full Text: PubMed is an abstract and citation database; full text is hosted on PubMed Central (PMC) or publisher sites. E-utilities does not host direct PDFs; it provides LinkOut and PMC IDs.

---

### 7. Directory of Open Access Journals (DOAJ)
* **Service Name:** DOAJ API v4
* **Official Website:** [https://doaj.org](https://doaj.org)
* **API Documentation:** [https://doaj.org/api/v4/docs](https://doaj.org/api/v4/docs)
* **Specific Verified Facts:**
  * Endpoint: `https://doaj.org/api/v4/search/articles/{query}`
  * Authentication: No API key required for public searching of open access articles and journals.
  * Query & Pagination limits: Max `pageSize=100`; search window limit capped at depth 1,000.
  * Pacing: Respectful delay of 0.5 to 1.0 second between calls ($\le 2$ req/sec).
  * Content: Purely peer-reviewed open access literature. Explicit licensing metadata in `bibjson.journal.license` (e.g. CC BY, CC BY-NC) and direct full-text landing links in `bibjson.link` where `type == "fulltext"`.

---

### 8. CORE
* **Service Name:** CORE API v3 (Open University & Jisc)
* **Official Website:** [https://core.ac.uk](https://core.ac.uk)
* **API Documentation:** [https://core.ac.uk/services/api](https://core.ac.uk/services/api)
* **Rate Limit & Token Architecture:** [https://core.ac.uk/documentation/api](https://core.ac.uk/documentation/api)
* **Specific Verified Facts:**
  * Token-based rate limiting. Free registration provides an API key enabling baseline research queries.
  * Response tracking headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
  * Full text availability: CORE aggregates repository full texts, providing `downloadUrl` when legal repository agreements allow open download.

---

### 9. bioRxiv & medRxiv
* **Service Name:** bioRxiv / medRxiv API (Cold Spring Harbor Laboratory)
* **Official Website:** [https://api.biorxiv.org](https://api.biorxiv.org)
* **API Documentation:** [https://api.biorxiv.org/details](https://api.biorxiv.org/details)
* **Specific Verified Facts:**
  * Free REST API without API key or authentication tokens.
  * Endpoint pattern: `https://api.biorxiv.org/details/[server]/[interval]/[cursor]/[format]`
  * Pacing: No hard rate limits published, but community convention requires polite 1-second delay between sequential calls.
  * Output: 100 items per batch; direct preprint PDF URLs correspond directly to preprint DOIs (`https://www.biorxiv.org/content/{doi}.full.pdf`).
  * Dedicated bulk text mining bucket on AWS S3 exists for corpus crawling.
