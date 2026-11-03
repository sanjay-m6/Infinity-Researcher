# Phase 15: Deduplication Review & Transactional Merge Report

## 1. Executive Summary

Phase 15 preserves and reinforces the deduplication architecture established in Phase 7. Multi-source academic literature aggregation inevitably discovers duplicate entries (e.g. arXiv preprints vs peer-reviewed conference publications). Infinity Researcher ensures that duplicate resolution is explainable, transparent, and non-destructive.

---

## 2. Multi-Stage Candidate Matching

Duplicate candidates are detected via three distinct matching tiers:
1. **Tier 1 (Exact DOI Match):** 100% confidence match based on normalized canonical DOI.
2. **Tier 2 (Normalized Title & Author Key):** High-confidence match (>90%) based on alphanumeric title normalization combined with lead author surname.
3. **Tier 3 (Fuzzy Title & Venue Similarity):** Medium-confidence candidate matching for preprints and published journal versions with minor title revisions.

---

## 3. Explainable Resolution & Preservation Toggles

In `LibraryView`, the "Duplicate Review" tab displays pending candidate pairs side-by-side:
- **Record A (Canonical Candidate):** Title, authors, publication year, and source provider.
- **Record B (Merged Candidate):** Corresponding metadata for comparison.
- **Confidence Badge:** Visual representation of match score and rule tier.
- **Decision Controls:**
  - `Keep Separate`: Permanently marks the candidate pair as distinct entities, preventing future duplicate warnings.
  - `Merge Papers`: Opens the Transactional Paper Merge modal.

### Preservation Matrix in Transactional Merge:

```
┌────────────────────────────────────────────────────────┐
│         Transactional Paper Merge Configuration        │
├────────────────────────────────────────────────────────┤
│ [✓] Preserve researcher notes & annotations            │
│ [✓] Preserve collection memberships                    │
│ [✓] Preserve tags and subject labels                   │
│                                                        │
│ Audit Trail Notes:                                     │
│ "Merged preprint observation with published edition"   │
└────────────────────────────────────────────────────────┘
```

When confirmed, `merge_papers` executes within a SQLite transaction:
- Child records (notes, tags, collection links) are migrated to `canonical_paper_id`.
- Downloaded PDF binaries are linked without overwriting existing files.
- The merged secondary record is cleanly archived, and audit log entries are committed.

