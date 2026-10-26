# Phase 7 — Intelligent Deduplication & Merge Policy

## 1. Principles of Conservative Deduplication
Scholarly literature presents subtle distinctions: preprints, revised editions, errata, conference papers, and translations often share similar or identical titles.
- **Rule 1**: Title similarity alone **never** triggers an automatic destructive merge.
- **Rule 2**: Conflicting DOIs automatically classify candidate pairs as `distinct`, preventing false positive grouping.
- **Rule 3**: User-edited metadata is flagged (`is_manually_edited = 1`) and protected from being overwritten by automatic pipelines.
- **Rule 4**: Merges are soft and non-destructive. Redundant records are redirected via `merged_into_id` and deactivated from active library lists (`is_saved = 0`), retaining full provenance and undo potential.

## 2. Multi-Stage Match Tiers

| Tier | Condition | Score Range | Default Action |
| :--- | :--- | :--- | :--- |
| `exact_match` | Matching canonical DOI or identical cryptographic file SHA-256 hash | 1.00 | Eligible for safe automated merge |
| `high_confidence` | Identical normalized clean title + same first author surname + identical publication year | 0.85 – 0.99 | Flagged for priority user review / safe merge suggestion |
| `review_required` | Near-duplicate title (trigram similarity $\ge 0.65$ or token overlap $\ge 0.50$) with compatible or missing DOIs | 0.60 – 0.84 | Routed to human-review queue in Library View |
| `distinct` | Conflicting valid DOIs or dissimilar titles/authors | 0.00 – 0.40 | Excluded from merge suggestions |

## 3. Similarity Signals & Evidence Generation
Each duplicate candidate retains human-readable evidence strings in SQLite:
- `Exact canonical DOI match (10.xxxx/yyyy)`
- `Exact normalized title match`
- `Token Jaccard title similarity: 82%`
- `Author surname match (Smith)`
- `Identical publication year (2023)`
- `Conflicting DOIs detected (10.1103/... vs 10.1038/...) -> Classified as distinct`

## 4. Transactional Merge Semantics
When a merge is confirmed by user review or safe automation:
1. An atomic SQLite transaction begins.
2. The incoming paper's empty fields (abstract, PDF URL, publication date, venue) are populated from the non-canonical record using source confidence ranking.
3. User notes, tags, and collection memberships from the merged record are reassigned to the canonical paper without creating duplicate relational rows.
4. Linked document files (`paper_files`) and source observations are reassigned to the canonical paper ID.
5. An audit row is written to `paper_merge_history`.
6. The incoming paper has its `merged_into_id` pointer set to the canonical ID, and `is_saved` is set to 0.
7. Transaction commits. No physical files or database records are deleted.
