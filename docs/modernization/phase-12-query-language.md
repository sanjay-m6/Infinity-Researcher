# Phase 12: Advanced Search Query Language Specification

## 1. Overview

Infinity Researcher Phase 12 introduces a structured query language for academic paper discovery. Researchers can execute precision searches using field-scoped filters, date ranges, and boolean attributes alongside natural language search queries.

The query parser (`src/lib/search/queryParser.ts`) transforms user input into a validated Abstract Syntax Tree (`StructuredQuery`) without executing raw code or modifying backend search drivers unexpectedly.

---

## 2. Syntax Grammar & Supported Expressions

### 2.1. Free-Text Terms & Quoted Phrases
| Query Syntax | Description | Example |
| :--- | :--- | :--- |
| `term` | Single keyword token matched against paper metadata | `quantum computing` |
| `"quoted phrase"` | Exact contiguous phrase matched across title, abstract, or venue | `"deep residual learning"` |

### 2.2. Field-Scoped Expressions
| Field Prefix | Aliases | Description | Valid Values & Examples |
| :--- | :--- | :--- | :--- |
| `title:` | — | Matches words or phrases within paper titles | `title:"attention is all you need"` |
| `author:` | `authors:` | Matches author names (exact or partial) | `author:"Vaswani"`, `author:"Vaswani, Shazeer"` |
| `year:` | — | Exact year, year range, or inequality | `year:2024`, `year:2020..2024`, `year:>=2021` |
| `doi:` | — | Canonical or normalized DOI | `doi:10.1145/3292500.3330964` |
| `source:` | `sources:` | Filters by academic source ID | `source:arxiv`, `source:plos,nature_srep` |
| `type:` | `content_type:` | Filters by scholarly document classification | `type:preprint`, `type:journal_article` |
| `open_access:` | `oa:` | Enforces verified open-access availability | `open_access:true`, `oa:yes`, `oa:false` |
| `venue:` | — | Matches journal, conference, or publisher name | `venue:"NeurIPS"`, `venue:Nature` |
| `peer_reviewed:` | — | Filters by peer-review validation | `peer_reviewed:true`, `peer_reviewed:false` |

---

## 3. Advanced Date & Range Semantics

The `year:` field supports four distinct parsing formats:
1. **Exact 4-Digit Year**:
   - `year:2023` → matches papers published in 2023 (`yearStart: 2023`, `yearEnd: 2023`).
2. **Inclusive Year Range**:
   - `year:2020..2024` or `year:2020-2024` → matches papers published between 2020 and 2024 inclusive.
3. **Lower Bound (Greater Than / Equal)**:
   - `year:>=2020` or `year:>2019` → matches papers from 2020 to present.
4. **Upper Bound (Less Than / Equal)**:
   - `year:<=2022` or `year:<2023` → matches papers up to and including 2022.

### Inverted Range Validation
If a researcher enters an inverted range such as `year:2025..2020`, the parser automatically reports a syntax error:
`"Invalid year range: start year (2025) cannot exceed end year (2020)."` and safely normalizes bounds to prevent crashing or undefined database queries.

---

## 4. Fault Tolerance & Security

1. **Unclosed Quotation Marks**:
   - Queries like `title:"machine learning in medical imaging` do not throw syntax exceptions. The tokenizer consumes the remaining string as the intended phrase.
2. **Preservation of DOIs**:
   - Scholarly DOIs contain slashes, hyphens, and periods (e.g., `10.1038/s41598-021-00000-0`). The parser ensures slashes are never interpreted as separators or regex delimiters.
3. **Unknown Field Prefixes**:
   - An unrecognized prefix like `custom:data` produces a non-blocking warning (`Field "custom:" is not a recognized filter field; treated as search keyword.`) and includes the terms in general search.
4. **Code Execution Prevention**:
   - Structured parsing uses pure string tokenization and regex matching. No `eval()`, `Function()`, or unparameterized SQL execution is permitted.

---

## 5. UI Integration & Visual Feedback

When the user types structured syntax into Discover Papers' search input, the UI activates a live **Query Plan Preview** (`data-testid="structured-query-preview"`) directly below the search bar:
- Displays parsed fields as distinct colored badges (`[Title: "Attention..."]`, `[Author: "Vaswani"]`, `[Year: 2017..2024]`, `[Source: arXiv]`).
- Highlights active syntax errors in rose badges so researchers can immediately correct invalid bounds.
- Re-serializes the query when filters are cleared or reset.

