# Legal, Ethical, and Resilient Collection Policy

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Enforceable  

---

## 1. Purpose and Guiding Philosophy

The **Research Paper Scraper** is engineered to serve scholarly research while adhering strictly to academic publishing ethics, intellectual property frameworks, public API terms of service, and technical integrity standards. 

This policy establishes strict engineering guardrails for all network interactions, source connectors, document retrieval pipelines, and local data persistence. Every software module written in subsequent phases must enforce these rules programmatically.

> [!IMPORTANT]
> **Engineering Non-Negotiable:** The application will never implement mechanisms designed to evade access controls, bypass paywalls, conceal client identity, crack CAPTCHAs, or violate published rate limits. Where full text cannot be legally or technically verified as open access, the app preserves metadata and provides direct links to the official publisher landing page.

---

## 2. Core Policy Directives

### Directive 1: API and Structured Feed Preference
* All automated paper discovery and metadata retrieval must prioritize official REST/XML APIs (e.g., OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ).
* Direct web page scraping is restricted to authorized Tier B structured feeds where terms of service and robots.txt explicitly permit automated indexing.
* Unstructured HTML scraping of publisher sites is strictly prohibited.

### Directive 2: Respect for Access Controls & Paywalls
* The application must never attempt to bypass authentication mechanisms, paywalls, CAPTCHAs, digital rights management (DRM), or publisher subscription gates.
* If an article is gated behind an institutional or commercial subscription, the application must identify it as `Restricted / Paywalled`, display its canonical bibliographic metadata, and provide an official link-out to the publisher page.
* Under no circumstances will proxy rotation, headless browser fingerprint spoofing, or stealth user-agent rotation be incorporated.

### Directive 3: Interpretation of `robots.txt`
* Robots directives (`robots.txt`) represent an automated crawling exclusion standard, **not** an affirmative legal copyright license or grant of permission.
* The application crawler engine must check and obey `robots.txt` rules for any Tier B web retrieval, but obeying `robots.txt` does not substitute for reviewing terms of use.

### Directive 4: Conservative Pacing, Concurrency, and Rate Limiting
* Network requests must be strictly rate-limited on a per-host basis.
* Default to **one concurrent request at a time per host** unless a higher limit is explicitly documented and configured (e.g., Crossref Polite Pool allows concurrency of 5).
* Source-specific pacing limits must be hardcoded as conservative safety caps:
  * **arXiv:** Minimum 3 seconds between requests (or $\le 1$ req/3s) to prevent automated IP bans.
  * **Semantic Scholar:** 1 req/sec when authenticated with partner key; low-frequency pacing on unauthenticated pool.
  * **Crossref:** Max 10 req/s with mandatory `mailto` polite identification.
  * **Europe PMC:** Max 10 req/s polite pacing.
  * **OpenAlex:** Max 10 req/s unauthenticated; up to 30 req/s with verified key.

### Directive 5: Transparent Identification & User-Agent Standards
* All outbound HTTP requests must supply an informative, transparent `User-Agent` string identifying the application, version, and user/developer contact email.
* Format: `User-Agent: ResearchPaperScraper/{version} (+https://github.com/user/research-paper-scraper; mailto:{polite_email})`
* Generic or deceptive User-Agents (e.g. spoofing Googlebot, Chrome desktop, or random browser headers) are strictly prohibited.

### Directive 6: Resilient Error Handling & Exponential Backoff
* Transient errors (HTTP 429 Too Many Requests, HTTP 500, 502, 503, 504, network timeouts) must trigger exponential backoff with randomized jitter.
* Base backoff: $t_{wait} = \text{min}(t_{max}, t_{base} \times 2^{attempt} + \text{jitter})$.
* If an upstream response includes a `Retry-After` header, the job queue must pause all requests to that host until the specified timestamp has elapsed.
* Maximum retry attempts are bounded ($\le 3$ retries). If failures persist, the job fails with a clear diagnostic state. Never retry in an infinite loop.

### Directive 7: Circuit Breakers for Access Denials
* If a host returns repeated HTTP 403 (Forbidden), 401 (Unauthorized), or persistent 429s ($> 3$ consecutive failures), a circuit breaker triggers for that connector.
* The connector is automatically transitioned to `paused` state, pending jobs for that host are suspended, and the user is alerted with diagnostic guidance.

### Directive 8: Safe Document Handling & Anti-SSRF
* External URLs and documents are treated as untrusted input.
* **Server-Side Request Forgery (SSRF) Guard:** Before issuing any HTTP GET/HEAD request or following redirects, the destination IP address must be resolved and checked:
  * Block `127.0.0.0/8`, `::1` (IPv4/IPv6 loopback).
  * Block `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private subnets).
  * Block `169.254.0.0/16`, `fe80::/10` (link-local and cloud metadata addresses, e.g. AWS/Azure metadata `169.254.169.254`).
  * Block non-HTTP/HTTPS schemes (e.g. `file://`, `ftp://`, `gopher://`).
* Every HTTP redirect target must be independently validated against the SSRF guard before execution.

### Directive 9: Document Integrity & File Signature Verification
* Downloaded files must never be trusted based on file extension or `Content-Disposition` header alone.
* The streaming download pipeline must verify:
  1. HTTP 200 OK status.
  2. Maximum file size ceiling (default 100 MB).
  3. Magic bytes / file signature: First 4 bytes must match `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`).
  4. Response is not an HTML error document, login form, or CAPTCHA page.
* Non-conforming or corrupted files must be immediately unlinked and aborted.

### Directive 10: Provenance & Rights Tracking
* Every persisted paper record must record its provenance:
  * Primary contributing source (e.g. `openalex`, `arxiv`, `crossref`).
  * External source identifier.
  * Canonical HTTPS URL.
  * Retrieval timestamp (UTC ISO 8601).
  * Declared license/access rights (e.g. `CC-BY-4.0`, `CC0`, `arXiv-perpetual-non-exclusive`, `Restricted`).
  * Authorized download route status.

### Directive 11: Local Privacy & Zero Telemetry
* The local research library, personal collections, tags, user notes, and downloaded PDF documents are strictly private.
* The application will never transmit library inventories, search queries, or user notes to any central telemetry server or third-party cloud.
* Outbound traffic occurs solely between the user's desktop and the specific academic provider selected for search or download.

---

## 3. Automated Policy Enforcement Tests

Implementation phases (Phase 5, 6, 7, and 9) must write and pass the following automated unit and integration tests:

| Test Identifier | Policy Clause | Test Objective & Verification Method |
| :--- | :--- | :--- |
| **TEST-POL-001** | SSRF Guard | Verify that `HttpClient` rejects requests to `http://127.0.0.1`, `http://localhost`, `http://192.168.1.1`, and `http://169.254.169.254`. |
| **TEST-POL-002** | Redirect SSRF | Verify that a 302 redirect from a valid public URL to a private IP is intercepted and aborted before connection. |
| **TEST-POL-003** | arXiV Pacing | Mock 5 sequential arXiv queries; assert that client enforces $\ge 3000\text{ms}$ interval between network calls. |
| **TEST-POL-004** | User-Agent Inspection | Verify that all outbound request headers include the application name, version, and configured `mailto` contact. |
| **TEST-POL-005** | Retry-After Header | Mock a 429 response with `Retry-After: 5`; assert queue sleeps for 5 seconds before subsequent retry attempt. |
| **TEST-POL-006** | Magic Byte Validation | Feed an HTML login page returned with a `.pdf` extension to download validator; assert rejection and cleanup of `.tmp` file. |
| **TEST-POL-007** | Circuit Breaker | Mock 4 consecutive HTTP 403 responses; assert connector state switches to `paused` and queue stops dispatching. |
| **TEST-POL-008** | Provenance Recording | Verify that saving a paper record creates an immutable `source_records` row with timestamp, source ID, and license string. |
