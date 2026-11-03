# Academic Source Capabilities & Provider Registry

## 1. Connector Registry Overview

The academic source connector registry maintains capability metadata, rate limits, endpoint paths, and authentication requirements for each supported provider:

| Provider | Category | Primary Identifier | Supports DOI Lookup | Supports Year Filter | Supports OA Filter | Rate Limit (RPS) | Auth Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAlex** | General Scholarly | OpenAlex ID / DOI | Yes | Yes | Yes | 10.0 | None (Polite Pool) |
| **Crossref** | General Scholarly | DOI | Yes | Yes | No | 10.0 | None (Polite Pool) |
| **arXiv** | Physical Sciences / CS | arXiv ID | Yes | No | No (100% OA) | 3.0 | None |
| **Europe PMC** | Life Sciences / Medicine | PMCID / PMID / DOI | Yes | Yes | Yes | 5.0 | None |
| **Semantic Scholar** | General Scholarly | S2 Paper ID / DOI | Yes | Yes | Yes | 1.0 (Public) | Optional API Key |
| **Unpaywall** | OA Resolver | DOI | Yes (DOI only) | No | No | 10.0 | Polite Email |

---

## 2. Source-Specific Implementation Details

### 2.1 OpenAlex
- **Base URL**: `https://api.openalex.org/works`
- **Capabilities**: Rich metadata, citation counts, inverted index abstracts, multiple open-access locations (`oa_locations`), and version indicators (`publishedVersion`, `acceptedVersion`, `submittedVersion`).
- **Polite Identification**: Passes `User-Agent: InfinityResearcher/0.1.0 (mailto:scholar@infinityresearcher.local)` to participate in the high-reliability polite pool.

### 2.2 Crossref
- **Base URL**: `https://api.crossref.org/works`
- **Capabilities**: Authoritative DOI registration agency, complete author hierarchies, container titles, publication dates, and license metadata.
- **Polite Identification**: Passes `User-Agent: InfinityResearcher/0.1.0 (mailto:scholar@infinityresearcher.local)`.

### 2.3 arXiv
- **Base URL**: `https://export.arxiv.org/api/query`
- **Capabilities**: Atom XML feed containing title, summary, authors, category tags, and direct PDF download links (`https://arxiv.org/pdf/{id}.pdf`).
- **Policy Compliance**: Enforces strict 3-second inter-request delay in compliance with arXiv terms of use.

### 2.4 Europe PMC
- **Base URL**: `https://www.ebi.ac.uk/europepmc/webservices/rest/search`
- **Capabilities**: Biomedical publications, PubMed Central full-text links, open-access XML and PDF render endpoints (`ptpmcrender.fcgi`).
- **Pagination**: Supports cursor-based pagination for large result sets.

### 2.5 Semantic Scholar
- **Base URL**: `https://api.semanticscholar.org/graph/v1/paper`
- **Capabilities**: Citation graph, influential citation counts, open-access PDF links, and author profile resolution.
- **Rate Limit**: Conservative 1 request per second without API key; up to 10 RPS when configured with `x-api-key`.

### 2.6 Unpaywall
- **Base URL**: `https://api.unpaywall.org/v2/{doi}`
- **Capabilities**: Precise DOI-to-Open-Access resolution. Provides `best_oa_location` and array of `oa_locations`.
- **Retired Endpoint Note**: Unpaywall's former free-text search endpoint was officially retired in September 2026. Infinity Researcher strictly uses the supported DOI lookup endpoint (`/v2/{doi}`) and delegates broad free-text search to OpenAlex.

