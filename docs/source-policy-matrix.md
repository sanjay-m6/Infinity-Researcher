# Academic Source Policy & Compliance Matrix

This document provides verified evidence, access policies, robots rules, and connector implementation details for all candidate and supported scholarly sources in the Research Paper Scraper application.

**Policy Rule**: Automated scraping is enabled **only** where public terms and robots.txt permit automated access. Sites that prohibit automated exploration or require CAPTCHA bypass are marked `Disabled` or `Manual Only`. Under no circumstances are private/undocumented JSON APIs or automated bypass mechanisms deployed.

---

## Source Verification Matrix

| Source Label | Hostname / Domain | Terms / Acceptable Use URL | robots.txt URL | Keyword Search Status | Article Extraction Status | Rate Limit / Crawl Delay | PDF Link Extraction | Adapter Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **arXiv Preprints** | `arxiv.org` | [arXiv Access Policy](https://arxiv.org/help/robots) | `https://arxiv.org/robots.txt` | Allowed via public HTML search | Allowed | ≥ 3,000 ms crawl delay | Direct PDF link extracted from `/pdf/{id}.pdf` | **Enabled** |
| **bioRxiv Preprints** | `biorxiv.org` | [bioRxiv Terms & FAQ](https://www.biorxiv.org/about/faq) | `https://www.biorxiv.org/robots.txt` | Allowed via public Highwire search form | Allowed | ≥ 2,000 ms crawl delay | Direct PDF link extracted from Highwire meta tags | **Enabled** |
| **medRxiv Preprints** | `medrxiv.org` | [medRxiv Terms & FAQ](https://www.medrxiv.org/about/faq) | `https://www.medrxiv.org/robots.txt` | Allowed via public Highwire search form | Allowed | ≥ 2,000 ms crawl delay | Direct PDF link extracted from Highwire meta tags | **Enabled** |
| **PLOS Open Access Journals** | `journals.plos.org` | [PLOS Open Access License](https://journals.plos.org/plosone/s/content-license) | `https://journals.plos.org/robots.txt` | Allowed via search page (`/plosone/search`) | Allowed (CC BY 4.0) | ≥ 2,000 ms crawl delay | Direct PDF link extracted from article download link | **Enabled** |
| **Nature Scientific Reports** | `nature.com` | [Nature Legal Information](https://www.nature.com/info/legal) | `https://www.nature.com/robots.txt` | Allowed on public search listings | Allowed for OA subset | ≥ 2,500 ms crawl delay | PDF link extracted when explicit OA badge is present | **Enabled** |
| **PubMed Central (PMC)** | `pmc.ncbi.nlm.nih.gov` | [PMC Open Access Subset MOU](https://pmc.ncbi.nlm.nih.gov/about/mou/) | `https://pmc.ncbi.nlm.nih.gov/robots.txt` | Allowed via public web search interface | Allowed for OA articles | ≥ 3,000 ms crawl delay | PDF link extracted from article page | **Enabled** |
| **Europe PMC Website** | `europepmc.org` | [Europe PMC Terms](https://europepmc.org/terms) | `https://europepmc.org/robots.txt` | HTML search allowed under polite crawl rules | Allowed | ≥ 3,000 ms crawl delay | Direct PDF link extracted when OA | **Enabled** |
| **IEEE Xplore** | `ieeexplore.ieee.org` | [IEEE Terms of Use](https://ieeexplore.ieee.org/XploreHelp/legal-terms) | `https://ieeexplore.ieee.org/robots.txt` | Disallowed for automated robots | Disallowed | N/A | Manual BibTeX & DOI import only | **Manual Only** |
| **Google Scholar** | `scholar.google.com` | [Google Terms of Service](https://policies.google.com/terms) | `https://scholar.google.com/robots.txt` | Strictly Prohibited (disallowed in robots.txt) | Prohibited | N/A (CAPTCHAs enforced) | N/A | **Disabled** |

---

## Verification Notes & Date Verified

- **Verification Date**: October 2026.
- **Verification Method**: Direct inspection of root `robots.txt`, published Acceptable Use Policies (AUP), and manual network trace validation.
- **Strict Compliance Safeguards**:
  - `UrlGuard` enforces IP blocking (RFC 1918 private IPs, RFC 3927 link-local, loopback, and reserved ranges).
  - Domain allowlists strictly limit connector HTTP requests to authorized hostnames.
  - Redirect chains are bounded to at most 4 hops, re-validating the resolved destination at every hop.
  - Request delays and rate limits are enforced by default.
