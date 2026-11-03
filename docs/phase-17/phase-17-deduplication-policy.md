# Phase 17 — Conservative Deduplication Policy & Safe Merging

**Subsystem**: Cross-Source Deduplication  
**Module**: `src-tauri/src/academic_sources/search_service.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Deduplication Principles & Rationale

In academic research, false-positive duplicate merging is far more catastrophic than duplicate duplication:
- **False-positive merge**: Combines two distinct papers (e.g. two papers titled *"Deep Learning for Healthcare"* published in the same year by different research groups) into one record, destroying bibliographic accuracy and confusing citations.
- **Conservative policy**: Papers are only merged when there is unequivocal cryptographic or multi-attribute provenance evidence.

---

## 2. Three-Tier Deduplication Hierarchy

The coordinator implements a hierarchical evaluation chain:

```
Incoming Work
     │
     ▼
[Tier 1: Canonical DOI Match?] ──────────► MERGE (High Confidence)
     │ No
     ▼
[Tier 2: Provider & Record ID Match?] ───► MERGE (High Confidence)
     │ No
     ▼
[Tier 3: Title Key >= 10 chars?]
     │ Yes
     ├──► [Year difference <= 1 year?]
     │         │ Yes
     │         └──► [Author surname overlap (>= 3 chars)?] ──► MERGE
     │                   │ No
     │                   ▼
     └────────────────► KEEP AS SEPARATE PAPERS
```

### 2.1 Tier 1: Canonical DOI Matching
- If both records possess a valid `canonical_doi`, exact string equality confirms identity.
- This merges identical papers discovered across Crossref, OpenAlex, Semantic Scholar, and Europe PMC regardless of slight title capitalization or subtitle variances.

### 2.2 Tier 2: Provider-Specific Identifier Matching
- Matches identical `provider_id` and `provider_record_id` (e.g. arXiv identifier `2104.12345` discovered across two search queries or crawling sessions).

### 2.3 Tier 3: Clean Title + Year + Author Overlap
- **Title Threshold**: `clean_title_key` must be at least 10 alphanumeric characters to prevent generic collision on short titles like *"Overview"*, *"Introduction"*, or *"Review"*.
- **Year Window**: Publication years must match or be within +/- 1 year (accommodating preprint submission in year $N$ and journal publication in year $N+1$).
- **Author Overlap**: If both papers list authors, at least one author family name (cleaned, lowercase, minimum 3 characters) must match across both works. If author sets are completely disjoint, deduplication is strictly refused.

---

## 3. Safe Field Merging Rules

When two candidate works are determined to be identical, metadata is merged into a single `NormalizedWork` without losing data:

1. **Provenance Consolidation**:
   - Upstream provenances (`provider_id`, `record_id`, `landing_url`, `retrieved_at`) are unioned into `target.provenance` without duplicates.
2. **Non-Destructive Overwrites**:
   - If target lacks an abstract and candidate provides one, the abstract is adopted.
   - If target lacks a PDF URL and candidate provides an open-access PDF URL, the PDF URL is adopted and `is_open_access` is set to `true`.
   - If candidate provides a more complete author list (longer length or contains ORCID/affiliation data), the richer author list is adopted.
   - If target lacks venue or publication date, candidate values are adopted.
3. **Metric Maximization**:
   - Citation counts are preserved as $\max(\text{target.citations}, \text{candidate.citations})$.
4. **Completeness Recomputation**:
   - `target.compute_completeness()` is recalculated to reflect the enriched state.

---

## 4. Verification Test Cases

- **Exact DOI Match**: OpenAlex record `W1` and Crossref record `10.1000/182` successfully merge into 1 unified record with dual provenance.
- **Preprint to Journal Merge**: arXiv preprint by Vaswani (2021) and Semantic Scholar journal article by Vaswani (2021) merge successfully with title + author overlap.
- **Different Authors Protection**: Paper 1 titled *"Introduction to Quantum Computing"* by Alice Smith (2022) and Paper 2 titled *"Introduction to Quantum Computing"* by Kenji Tanaka (2022) are kept as 2 distinct papers.

