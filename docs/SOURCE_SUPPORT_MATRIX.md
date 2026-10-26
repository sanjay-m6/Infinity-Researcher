# Website Source Support Matrix

This matrix documents scholarly domains and website repositories tested with the Website-Driven Scraper engine. Sites are classified truthfully based on actual automated tests and fixture validations.

## Tested & Verified Sources

| Domain / Origin | Supported Mode | Policy State | Tested Page Types | Extraction Strategy & Evidence | Limitations / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **biorxiv.org** (bioRxiv) | `public_html_crawl`, `manual_import` | `allowed` | Early preview listings, article detail pages (`/content/10.1101/...`) | Full Highwire Press (`citation_*`) metadata. Direct PDF link detected via `citation_pdf_url`. | High volume crawling should respect polite `Crawl-delay: 2000ms`. Do not bypass rate limits. |
| **medrxiv.org** (medRxiv) | `public_html_crawl`, `manual_import` | `allowed` | Recent archive listings, article detail pages | Same Highwire Press schema as bioRxiv. Clean author lists and DOIs. | Polite crawl delay enforced. |
| **journals.plos.org** (PLOS ONE) | `public_html_crawl`, `manual_import` | `allowed` | Issue archive, article detail (`/plosone/article?id=...`) | Highwire Press + Dublin Core meta tags. Direct open-access PDF links verified. | Subject search filters are URL-parameter driven. |
| **nature.com** (Nature Publishing Group) | `public_html_crawl`, `manual_import` | `restricted` (open-access only) | Journal listings, open-access articles (e.g. Scientific Reports `/articles/...`) | Highwire Press tags present on article pages. PDF downloadable only when article is open-access. | Subscription/paywalled articles remain as bibliographic metadata only; paywalls are strictly respected. |
| **dl.acm.org** (ACM Digital Library) | `public_html_crawl`, `manual_import` | `restricted` (open-access only) | Proceedings listings, publication records (`/doi/...`) | Dublin Core + Highwire tags embedded in HTML. Open-access papers provide direct PDF. | Closed-access papers show "PDF restricted/unavailable". Automation must not exceed 1 req/sec. |
| **arxiv.org** (arXiv e-Print Archive) | `public_html_crawl`, `manual_import` | `allowed` | Recent list (`/list/cs/recent`), abstract pages (`/abs/...`) | HTML metadata tags and clear `/pdf/` links. | Must use polite crawl delay (at least 3 seconds per robots.txt guidance). Bulk dumps prohibited. |
| **Local Scholarly HTML Fixtures** | `public_html_crawl`, `manual_import`, `link_only` | `allowed` | Article cards, issue TOC, pagination, direct PDF links | Tested against Highwire Press, Dublin Core, and Schema.org JSON-LD test fixtures. | Used for deterministic unit and regression testing. |

---

## Untested / Experimental Sources

Any source not listed above is treated as **"Needs configuration / Experimental"** by default in the application UI:
- **Institutional Repositories (DSpace, EPrints, Bepress)**: Supported via Generic Scholarly HTML profile if standard Highwire Press or Dublin Core meta tags are rendered in HTML.
- **Conference Publication Listings**: Supported via user-configured CSS selectors in the Add Website Wizard.
- **Commercial Closed Publishers**: Only permitted for open-access pages or bibliographic citation discovery. Downloading restricted full-text is rejected.

---

## Prohibited & Unsupported Automation Targets

In strict accordance with the non-negotiable No-API specification and legal compliance:
- **Google Search / Google Scholar Result Pages**: Automated crawling is strictly disabled because their Terms of Service prohibit automated queries.
- **Sites Requiring CAPTCHA Solving**: The engine halts immediately if a CAPTCHA, Cloudflare challenge, or bot-detection page is encountered.
- **Paywalls & Authentication Gates**: No attempt is made to bypass session gates or paywalls.
