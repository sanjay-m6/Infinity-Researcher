# Phase 11: Paper Metadata Normalization & Deduplication

## 1. Executive Summary

When searching academic literature across disparate sources (e.g., arXiv, bioRxiv, PLOS, PMC, Semantic Scholar), incoming bibliographic metadata arrives in heterogenous formats:
- Author names formatted as strings, arrays, or objects (`"Last, First"`, `"First Last"`, or `{ "name": "..." }`).
- Publication dates varying between full ISO strings (`2023-04-12T00:00:00Z`), years (`2023`), or custom formats.
- DOIs formatted with or without URL prefixes (`https://doi.org/10.1145/...` vs `10.1145/...`) with inconsistent casing.
- Abstract text containing HTML entities, LaTeX markups, or truncated previews.

Phase 11 modernizes the normalization pipeline, ensuring consistent data models and robust deduplication.

---

## 2. Unified Discover Paper Entity Schema

The unified UI schema is defined in `UnifiedDiscoverPaper` (`src/features/discover/DiscoverView.tsx`):

```typescript
export interface UnifiedDiscoverPaper {
  id: string;                     // Unique UI key, e.g. websearch_{id}
  paper_id?: string | null;       // Local SQLite paper ID (if imported)
  title: string;                  // Normalized title (trimmed, clean whitespace)
  authors: string[];              // Normalized author name array
  publication_date?: string | null;// Original date string
  publication_year?: number | null;// Guaranteed 4-digit integer
  venue?: string | null;          // Journal or conference name
  canonical_doi?: string | null;  // Normalized lowercase DOI without URL prefix
  abstract_text?: string | null;  // Cleaned plain text abstract
  pdf_url?: string | null;        // Verified remote PDF direct stream URL
  url: string;                    // Primary source landing page URL
  is_imported: boolean;           // True if present in local SQLite library
  is_downloaded: boolean;         // True if local PDF binary is downloaded
  local_pdf_path?: string | null; // Filesystem path to cached PDF
  is_open_access: boolean;        // Verified open access status
  source_name: string;            // Human-readable repository name
  source_id?: string;             // System connector ID (e.g. arxiv, plos)
  content_type?: string;          // preprint | journal_article | conference_paper
  license_name?: string | null;   // CC BY, CC BY-NC, Public Domain, etc.
  peer_reviewed?: boolean | null; // Peer review confirmation
  subject_tags?: string[];        // Research topics & taxonomy tags
  language?: string | null;       // ISO language code (e.g. en)
  relevance_score?: number;       // Normalized ranking match [0.0 - 1.0]
  metadata_confidence?: number | null; // Confidence metric [0.0 - 1.0]
  collection_ids?: string[];      // Associated local research collections
  citation_count?: number | null; // Extracted academic citation count
}
```

---

## 3. Deduplication Algorithm

When papers are ingested via streaming events (`paper_found`), the deduplication engine runs prior to state insertion:

1. **DOI Matching**:
   Canonical DOIs are stripped of URL prefixes (`https://doi.org/`, `http://dx.doi.org/`) and compared case-insensitively:
   $$\text{DOI}_A = \text{DOI}_B \iff \text{normalize}(\text{DOI}_A) == \text{normalize}(\text{DOI}_B)$$
2. **Title Similarity Matching**:
   If canonical DOIs are unavailable, titles are normalized (lowercased, punctuation-stripped, whitespace-collapsed) and compared for exact identity.
3. **Metadata Merging & Enrichment**:
   When a duplicate paper is identified from an additional source, the existing record is not overwritten; rather, missing fields are enriched:
   - If `existing.pdf_url` was missing, it takes `incoming.pdf_url`.
   - If `existing.abstract_text` was brief, it upgrades to `incoming.abstract_text`.
   - If `existing.canonical_doi` was missing, it adopts `incoming.canonical_doi`.

---

## 4. SQLite Library Cross-Referencing

Discovered query results are cross-referenced reactively with the local SQLite `papers` table (`AppContext.papers`):
- If a match is found by DOI or title:
  - `paper_id` is linked to the local database ID.
  - `is_imported` is set to `true` (rendering the `In Library` bookmark badge).
  - `is_downloaded` is set to `true` if `localPdfPath` exists (rendering the `Saved Offline` badge).
  - `collection_ids` are linked, enabling immediate collection management.

