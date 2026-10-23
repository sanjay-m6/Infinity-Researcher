# ADR-003: Scholarly Paper Identity, Canonicalization, and Deduplication Strategy

* **Status:** Accepted  
* **Date:** 2026-10-24  
* **Deciders:** Academic Data Integration Engineer, System Architect  

---

## Context and Problem Statement
When executing federated searches across OpenAlex, Crossref, arXiv, and Europe PMC, multiple providers will return records representing the same research paper. However, raw representations frequently diverge:
* DOIs appear in various formats (`https://doi.org/10.1145/...`, `doi:10.1145/...`, uppercase vs lowercase).
* Titles contain slight differences in subtitle punctuation, hyphenation, or LaTeX math markup (`$O(n \log n)$`).
* Abstracts from preprints differ slightly from final peer-reviewed journal publications.
* Author names may appear with full given names, initials, or differing affiliation strings.

Erroneously auto-merging two distinct papers corrupts citations and research bibliographies. Conversely, failing to deduplicate clutters the search UI with redundant cards.

## Decision Drivers
* Citation Integrity: Never destructively merge distinct papers based on loose fuzzy similarity alone.
* Determinism: Same inputs must always yield the exact same deduplication result.
* Provenance Preservation: Retain all contributing source IDs, URLs, and retrieval timestamps.
* User Agency: Support manual review and reversible merge workflows when uncertainty exists.

## Considered Options
1. **Option 1: Loose Fuzzy Title Matching Auto-Merge**  
   Merge any two records if title similarity exceeds 85%. (Rejected: High rate of false positives on paper series, workshops, and follow-up revisions).
2. **Option 2: Strict DOI-Only Deduplication**  
   Only merge records if they share an exact DOI. (Rejected: Ignores preprints on arXiv that have not yet been assigned a journal DOI).
3. **Option 3: Multi-Tiered Deduplication with Strong Identifiers and Cautious Review (Selected)**

## Decision Outcome
**Chosen Option:** **Option 3: Multi-Tiered Deduplication with Strong Identifiers and Cautious Review**.

### Deduplication Pipeline Rules
1. **Tier 1: Canonical DOI Matching (Automatic & Immediate)**  
   * All DOIs are normalized to lowercase `10.xxxx/...` with URL prefixes stripped.
   * If two candidates share an identical normalized DOI, they are deterministically merged into one canonical paper record.
2. **Tier 2: Stable Source ID Matching (Automatic & Immediate)**  
   * If two records share the same stable repository identifier (e.g. `arxiv:1706.03762` or `pmid:28493108`), they are merged.
3. **Tier 3: Cautious Title + Author + Year Heuristic (Review Only)**  
   * When strong IDs are absent, clean titles (Unicode NFKC, punctuation stripped) are compared using Jaro-Winkler string similarity ($> 0.92$) combined with primary author last name match and publication year match ($\pm 1\text{ year}$).
   * Matching records are **NOT** auto-merged. Instead, they are flagged as `suspected_duplicate` and surfaced in the interactive Side-by-Side Review Workspace for user confirmation.

### Merge Precedence & Provenance Preservation
When two records merge:
* The canonical record in `papers` is updated with the most complete title and longest abstract.
* Every contributing source is preserved as an individual row in `source_records` linked to the canonical paper ID.
* Merges are completely reversible by inspecting the audit log and disassociating source records.

## Consequences & Trade-offs
### Positive
* Zero risk of corrupting citations through reckless auto-merging.
* Clean federated search presentation without duplicate cards for identical DOIs.
* Complete data provenance preserved across all research records.

### Negative / Mitigations
* Preprints without DOIs that differ slightly in title from published papers require a one-click user review. This minor user friction is a deliberate design choice prioritizing scholarly accuracy over false automation.
