# Phase 11: Academic Source Capabilities & Connector Specifications

## 1. Executive Summary

Infinity Researcher integrates a curated suite of global preprint repositories, open-access publisher portals, and bibliographic index databases. In compliance with repository usage policies, robots.txt directives, and academic open-access mandates, each connector is configured with explicit operational constraints, rate limits, and fallback strategies.

---

## 2. Comprehensive Source Capability Matrix

| Source ID | Repository / Platform | Protocol / Access Method | Native Year Filter | Crawl Delay / Rate Limit | Direct PDF Discovery | Content Types | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `arxiv` | **arXiv.org** | HTML Search + REST prefix | No (Post-filtered) | 3,000 ms | **Yes** (`https://arxiv.org/pdf/{id}.pdf`) | Preprints (Physics, Math, CS, Bio) | **Enabled** |
| `biorxiv` | **bioRxiv** (CSHL) | HTML Search | **Yes** (`supports_native_years: true`) | 2,000 ms | **Yes** (Confirmed CSHL PDF links) | Preprints (Life Sciences) | **Enabled** |
| `medrxiv` | **medRxiv** (CSHL) | HTML Search | **Yes** (`supports_native_years: true`) | 2,000 ms | **Yes** (Confirmed CSHL PDF links) | Preprints (Medical & Health) | **Enabled** |
| `plos` | **PLOS Journals** | REST API & HTML Search | **Yes** | 2,000 ms | **Yes** (100% CC BY Open Access) | Peer-Reviewed Journal Articles | **Enabled** |
| `nature_srep`| **Nature Scientific Reports** | HTML Search | No (Post-filtered) | 2,500 ms | **Yes** (Open Access subset) | Peer-Reviewed Journal Articles | **Enabled** |
| `pmc` | **PubMed Central (PMC)** | NCBI Entrez / HTML Search | No (Post-filtered) | 3,000 ms | **Yes** (OA subset with PMC/PMID) | Peer-Reviewed Biomedical | **Enabled** |
| `ieee_xplore`| **IEEE Xplore** | Official REST / Open Access Crossref | **Yes** | 1,000 ms | **Conditional** (Protected by anti-bot, manual link flow available) | Conference Papers, Journal Articles | **Enabled** |
| `semantic_scholar` | **Semantic Scholar** | Official Graph REST API | **Yes** | 1,000 ms | **Yes** (`openAccessPdf` direct resolution) | Articles, Preprints, Conferences | **Enabled** |
| `openalex` | **OpenAlex** | Open Scholarly API | **Yes** | 500 ms | **Yes** (Repository location discovery) | Global Scholarly Corpus | **Enabled** |
| `core_api` | **CORE Repositories** | CORE Global API | **Yes** | 1,000 ms | **Yes** (Institutional Repositories) | Preprints, Theses, Articles | **Enabled** |
| `acm_dl` | **ACM Digital Library** | Manual Import Workflow | No | N/A | **Manual** (Terms prohibit automated scraping) | Computer Science Conferences | **Manual Only** |
| `google_scholar` | **Google Scholar** | Blocked / CAPTCHA | No | N/A | **None** (Terms prohibit automated querying) | All Disciplines | **Disabled** |

---

## 3. Rate-Limit & Robots Policy Compliance

1. **Polite Crawling Headers**: All scraper requests identify Infinity Researcher with transparent user-agent telemetry and contact headers, conforming to the robots.txt terms of academic hosts.
2. **Domain Delay Enforcement**: Both Rust (`scraper/robots.rs`) and Python (`AutoThrottleMiddleware`) enforce source-specific inter-request latency (e.g. 3000ms on arXiv, 2000ms on bioRxiv/PLOS) to avoid server load spikes.
3. **Graceful Status Handling**:
   - HTTP 429 (Too Many Requests) or HTTP 403 (Forbidden) triggers status update `status: "rate_limited"` or `status: "failed"` with a human-readable telemetry message.
   - Other sources continue unaffected.
   - The user can click `Retry Failed Sources` to re-query affected repositories with exponential backoff.

