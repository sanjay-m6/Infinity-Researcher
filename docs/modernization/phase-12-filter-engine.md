# Phase 12: Advanced Filter Engine Architecture

## 1. Overview

The Infinity Researcher Advanced Filter Engine (`src/lib/search/searchPlanner.ts` & `src/features/discover/DiscoverView.tsx`) provides deterministic, multi-dimensional filtering across diverse academic sources. It combines explicit structured query tokens with user-selected UI filter controls, resolving conflicts cleanly and avoiding invalid remote API calls.

---

## 2. Filter Dimensions & Semantics

| Filter Dimension | Input Source | Source-Delegated Filter | Client Post-Filter | Evaluation Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **Publication Year** | `year:2020..2024` or Year Start/End inputs | `year_start`, `year_end` (arXiv, PLOS, PMC, IEEE) | `satisfiesClientPostFilters` | **Strict Inclusive Range**: If `yearStart` is enforced, papers with unknown/null years are excluded. |
| **Author Name** | `author:"He"` or Author input | `author` (arXiv, PLOS, PMC, IEEE) | `satisfiesClientPostFilters` | **Case-Insensitive Substring / Token**: Matches first or co-authors. |
| **Academic Sources** | `source:arxiv` or Sources dropdown | Narrows `targetSources` list | Evaluated prior to dispatch | **OR Semantics**: Results from any selected active source are ingested. |
| **Content Type** | `type:preprint` or Type dropdown | `content_type` | `satisfiesClientPostFilters` | Matches classifications (`preprint`, `journal_article`, `conference`). |
| **Open Access Status** | `open_access:true` or Quick Filter "OA" | `open_access_only` | `satisfiesClientPostFilters` | **Verified Evidence**: Checks explicit CC license or unpaywalled repository flag. |
| **Local PDF State** | Quick Filter "Downloaded" or Status filter | — | `p.is_downloaded` / `local_pdf_path` | Verified local on-disk existence in SQLite library. |
| **Scholarly Venue** | `venue:"Nature"` or Venue input | — | `satisfiesClientPostFilters` | Substring match against publication journal or conference name. |
| **Peer-Review** | `peer_reviewed:true` or Peer Reviewed checkbox | — | `satisfiesClientPostFilters` | Confirms peer-review verification indicator. |
| **In-Page Text** | Compact filter bar | — | Evaluated on memory cache | Multi-field search across title, authors, DOI, and venue. |

---

## 3. Logical Operator Semantics (AND vs. OR)

To ensure predictable, intuitive search behavior for academic researchers, the filter engine defines strict operator conventions:

1. **Inter-Field Composition (AND)**:
   - When multiple different criteria are specified (e.g., `year:2020..2024` and `author:"Bengio"` and `type:preprint`), all conditions must be satisfied simultaneously:
     $$\text{Match} = \text{Match}_{\text{year}} \land \text{Match}_{\text{author}} \land \text{Match}_{\text{type}}$$
2. **Multi-Source Selection (OR)**:
   - When a researcher selects multiple academic sources (e.g., arXiv and PubMed Central), results from either source are retrieved and merged into the unified feed:
     $$\text{Sources} = \text{Source}_{\text{arXiv}} \lor \text{Source}_{\text{PMC}}$$
3. **Multi-Keyword Text Terms (AND)**:
   - Free-text keywords (e.g., `quantum error mitigation`) must all appear across the paper's title, authors, venue, or abstract text.
4. **Multi-Author Lists (OR / Substring)**:
   - Comma-separated author lists (e.g. `author:"Vaswani, Shazeer"`) match papers co-authored by any of the listed individuals.

---

## 4. Conflict Resolution & Precedence

When a researcher specifies criteria in both the structured query string and the filter drawer UI:
1. **Query String Precedence**: Explicit query expressions (`year:2024`) take precedence over broader UI dropdowns (`Year: All`).
2. **Safe Fallback**: If an explicit query field has an invalid format (e.g. inverted year `2025..2020`), the engine raises a syntax error badge in the UI and falls back to the safe bounds.
3. **Empty Filter Handling**: Empty strings, nulls, or `"all"` values are omitted from the active filter set, ensuring zero overhead on unfiltered searches.

