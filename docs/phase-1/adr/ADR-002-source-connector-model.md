# ADR-002: Modular Source Connector Architecture with Explicit Capability Tiers

* **Status:** Accepted  
* **Date:** 2026-10-24  
* **Deciders:** Academic Data Integration Engineer, Rust Engineer, Security Engineer  

---

## Context and Problem Statement
Academic literature sources vary widely in technical interfaces, rate limits, access policies, data formats, and legal terms:
* OpenAlex and Crossref provide rich REST APIs with open metadata licenses.
* arXiv returns Atom XML feeds and enforces strict 3-second pacing.
* Europe PMC provides direct PMC Open Access full-text links for biomedical literature.
* Commercial publishers (Elsevier, IEEE, Springer) enforce strict anti-bot mechanisms and prohibit automated scraping in their terms.

The application cannot treat all sources as a monolithic "scraper" or promise universal web scraping without breaking upstream terms, causing IP bans, or resulting in severe maintenance fragility.

## Decision Drivers
* Extensibility: Adding a new academic source must not alter core search orchestration or UI presentation code.
* Compliance: Strict adherence to published rate limits, terms of use, and polite access etiquette.
* Fault Isolation: A failure or timeout in one provider must not crash or delay other active providers.
* Honesty: The UI must clearly indicate the distinction between metadata-only access, direct open-access download availability, and paywalled/restricted content.

## Considered Options
1. **Option 1: Monolithic Scraper Script with Dynamic Conditionals**  
   One large service containing `if source == 'arxiv': ... elif source == 'crossref': ...`.
2. **Option 2: Universal Headless Browser Web Crawler (Puppeteer/Playwright)**  
   Simulate browser sessions across all sites and scrape HTML.
3. **Option 3: Strongly-Typed Trait-Based Modular Connectors with Tiered Capabilities (Selected)**

## Decision Outcome
**Chosen Option:** **Option 3: Strongly-Typed Trait-Based Modular Connectors with Tiered Capabilities**.

### Connector Contract & Tiers
Connectors implement the `AcademicConnector` Rust trait and declare explicit capability tiers:
* **Tier A (Official API):** OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ.
* **Tier B (Permitted Structured Web Adapter):** Allowed static feeds complying with `robots.txt` and polite 1-req/sec pacing.
* **Tier C (Link-Out Only):** Commercial/paywalled publishers where automated retrieval is unsupported.
* **Unsupported:** Any platform requiring CAPTCHA bypass, proxy rotation, or credential circumvention.

### Fault Isolation & Pacing Architecture
* Each connector manages its own rate limiter token bucket and endpoint mapping.
* The search orchestrator invokes adapters concurrently using `tokio::spawn`, wrapping each in an independent timeout and cancellation token.
* If a connector fails or times out, its error is captured as a diagnostic record, allowing partial search results to render seamlessly.

## Consequences & Trade-offs
### Positive
* Highly maintainable and testable; each connector can be unit-tested against recorded, sanitized JSON/XML fixtures without live network dependencies.
* Safe from IP bans through guaranteed per-host rate limiting.
* Clean UI transparency: users understand exactly why a paper is or is not downloadable.

### Negative / Mitigations
* Normalizing disparate provider payloads requires connector-specific mapping logic (e.g. reconstructing OpenAlex inverted abstracts; parsing arXiv Atom XML). This complexity is strictly isolated within the respective connector modules.
