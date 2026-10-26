# Phase 7 — Research Metadata Normalization

## 1. Overview
The `MetadataNormalizer` service ensures that heterogeneous metadata collected from academic APIs (Phase 5) and website scrapers (Phase 6) is transformed into uniform, clean, and easily queryable records without loss of fidelity.

## 2. Field Normalization Rules

### Title
- **Whitespace & Line Breaks**: Runs of whitespace, tabs, and newlines are collapsed to a single space, with leading and trailing whitespace trimmed.
- **Display Fidelity**: Formula characters, Greek letters ($\alpha$, $\beta$, $\gamma$), scientific notation, hyphens, and apostrophes are preserved in display titles.
- **Search & Comparison Key (`clean_title_key`)**: Non-alphanumeric ASCII characters are stripped, casing is folded to lowercase, and Unicode is normalized to NFC to generate stable blocking keys for deduplication.

### Canonical DOI
- **Prefix Removal**: Common DOI resolver prefixes are cleanly stripped:
  - `https://doi.org/`
  - `http://dx.doi.org/`
  - `doi:`
- **Case Normalization**: Handled case-insensitively for comparisons (canonical format stored as lowercase `10.xxxx/...`).
- **Validation**: Rejects invalid strings that do not conform to the `10.\d{4,9}/.+` DOI standard.

### Alternative Scholarly Identifiers
Identifiers are partitioned into distinct namespaces to prevent false cross-matching:
- **arXiv ID**: Strips `arxiv:`, `https://arxiv.org/abs/` prefixes. Normalizes new-style IDs (`2104.12345`) and captures version tags (e.g. `v2`).
- **PubMed (PMID)**: Digits-only normalized string stripped of `pmid:` labels.
- **PubMed Central (PMCID)**: Normalized with uppercase `PMC` prefix followed by digits.

### Abstract Sanitization
- **Entity Decoding**: Standard XML and HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) are decoded into native characters.
- **Tag Stripping**: Unsafe embedded HTML markup (`<p>`, `<span>`, `<div>`, `<script>`) is stripped defensively while preserving paragraph breaks.

### Publication Dates
- Parsed via ISO 8601 patterns (`YYYY-MM-DD`, `YYYY-MM`, or `YYYY`).
- Stored at actual reported precision without fabricating synthetic "January 1" dates when only a publication year was provided by the upstream source.
