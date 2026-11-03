# Phase 17 — Academic Source Capabilities & Filter Adaptation

**Module**: `src-tauri/src/academic_sources/types.rs` & `query_planner.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Capability Declaration Model

Scholarly search providers exhibit widely divergent query syntax, supported filtering parameters, pagination protocols, and rate limits. Rather than forcing uniform assumptions on all providers, Phase 17 implements a rich, capability-driven model.

### 1.1 `ProviderCapabilities` Definition
```rust
pub struct ProviderCapabilities {
    pub provider_id: ProviderId,
    pub display_name: String,
    pub description: String,
    pub documentation_url: String,
    pub supports_year_filter: bool,
    pub supports_open_access_filter: bool,
    pub supports_doi_lookup: bool,
    pub supports_author_search: bool,
    pub supports_abstracts: bool,
    pub supports_pdf_discovery: bool,
    pub supports_pagination: bool,
    pub supports_cursor_pagination: bool,
    pub requires_api_key: bool,
    pub rate_limit_rps: f64,
    pub category: String,
    pub auth_type: String,
    pub preferred_identifier: String,
}
```

---

## 2. Authoritative Provider Capability Matrix

| Feature / Limit | OpenAlex | Crossref | Semantic Scholar | arXiv | Europe PMC |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Category** | General Scholarly | General Scholarly | General Scholarly | Preprints | Biomedical & Life Sciences |
| **Authentication** | Optional API Key | None (Polite Mailto) | Optional API Key | None | None |
| **Rate Limit (RPS)** | 10.0 (Polite) | 50.0 (Polite) | 1.0 (Unauth) / 10.0 (Key) | 0.33 (1 req / 3s) | 10.0 |
| **DOI Lookup** | Yes (`/works/doi`) | Yes (`/works/{doi}`) | Yes (`/paper/{doi}`) | Yes (bibliographic) | Yes (`DOI:...`) |
| **Year Range Filter** | Yes (`filter=publication_year:2020-2024`) | Yes (`filter=from-pub-date:...,until-pub-date:...`) | Yes (`year=2020-2024`) | No (Requires boolean search) | Yes (`(PUB_YEAR:[2020 TO 2024])`) |
| **Open Access Filter** | Yes (`filter=is_oa:true`) | No (Inconsistent licenses) | Yes (`openAccessPdf`) | No (100% OA by definition) | Yes (`(OPEN_ACCESS:y)`) |
| **Abstract Distribution** | Yes (Inverted index) | No (Publisher restricted) | Yes (Direct text) | Yes (Atom summary) | Yes (Direct abstract) |
| **PDF Direct Discovery** | Yes (`primary_location.pdf_url`) | No (Landing URLs only) | Yes (`openAccessPdf.url`) | Yes (`/pdf/{id}.pdf`) | Yes (PMC full-text PDF) |
| **Pagination Type** | Cursor & Offset | Cursor & Offset | Offset (`offset`, `limit`) | Offset (`start`, `max_results`) | Cursor (`cursorMark`) |
| **Preferred Identifier** | `doi` | `doi` | `doi` | `arxiv_id` | `pmcid` |

---

## 3. Capability-Aware Query Adaptation Logic

The `AcademicQueryPlanner` reconciles generic input parameters against each provider's declared capabilities:

### 3.1 Parameter Translation Matrix

#### Publication Year Range
- **OpenAlex**: Formats `filter=publication_year:{start}-{end}`.
- **Crossref**: Formats `filter=from-pub-date:{start}-01-01,until-pub-date:{end}-12-31`.
- **Semantic Scholar**: Formats query parameter `year={start}-{end}`.
- **Europe PMC**: Injects Lucene clause `(PUB_YEAR:[{start} TO {end}])`.
- **arXiv**: Flags `requires_client_filtering = true`. Issues warning: *"arXiv does not support server-side publication year filtering; results will be post-filtered locally."*

#### Open-Access Filter
- **OpenAlex**: Injects `filter=is_oa:true`.
- **Semantic Scholar**: Evaluates `openAccessPdf` field.
- **Europe PMC**: Injects Lucene clause `(OPEN_ACCESS:y)`.
- **Crossref**: Flags `requires_client_filtering = true`. Issues warning: *"Crossref does not support native open-access filtering; results will be post-filtered locally."*
- **arXiv**: Recognizes arXiv papers as inherently open-access preprints; skips filter injection without issuing false error warnings.

### 3.2 Client-Side Fallback Filtering (`AcademicQueryPlanner::filter_post_search`)
When upstream providers do not support server-side parameters, the coordinator executes deterministic post-filtering:
```rust
pub fn filter_post_search(&self, works: Vec<NormalizedWork>, query: &AcademicSearchQuery) -> Vec<NormalizedWork> {
    works.into_iter().filter(|work| {
        if let Some(start) = query.year_start {
            if let Some(year) = work.publication_year {
                if year < start { return false; }
            }
        }
        if let Some(end) = query.year_end {
            if let Some(year) = work.publication_year {
                if year > end { return false; }
            }
        }
        if let Some(true) = query.open_access_only {
            if !work.is_open_access { return false; }
        }
        true
    }).collect()
}
```
This guarantees 100% query fidelity regardless of provider API limitations.

