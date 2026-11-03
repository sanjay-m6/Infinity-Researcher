# Caching Policy & Duplicate Prevention

## 1. Caching Hierarchy & TTL Matrix

To ensure responsive search without overwhelming academic source APIs, Infinity Researcher implements a multi-tier cache policy:

| Cache Entity | Key Structure | Storage Medium | TTL (Freshness) | Invalidation Triggers |
| :--- | :--- | :--- | :--- | :--- |
| **DOI Resolution Cache** | `doi:{normalized_doi}` | SQLite `doi_cache` table | 14 Days | User forces re-check; manual cache clear |
| **Candidate PDF URLs** | `candidates:{paper_id}` | SQLite `pdf_candidates` table | 48 Hours | Download failure with HTTP 403/410; re-resolution |
| **Search Result Works** | `search:{query_hash}:{page}` | Memory & SQLite | 2 Hours | New search execution with `refresh=true` |
| **Local Verified PDFs** | `{paper_id}.pdf` | Filesystem + `paper_files` | Indefinite (Permanent) | User explicitly deletes paper from library |
| **Reader View State** | `reader:{paper_id}` | SQLite `reader_state` table | Indefinite | User navigates to new page or zooms |

---

## 2. Distinction Between Metadata & PDF Availability

The caching system explicitly decouples metadata freshness from candidate PDF validity:
1. **Metadata Persistence**: Bibliographic records (title, authors, year, abstract, citations) remain permanently cached in the user's SQLite library (`papers`).
2. **Ephemeral Candidate Links**: Pre-signed URLs or expiring tokens (e.g. temporary CDN links) are **never** treated as permanent. If a candidate URL expires or returns HTTP 403, the cache entry is invalidated and re-resolved via canonical sources.
3. **Negative Caching Limits**: If a source returns zero full-text locations, the negative result is cached for at most 12 hours. This ensures newly published open-access copies or deposited preprints are not locked out permanently.

---

## 3. Duplicate Prevention Architecture

- **Clean Title Key (`clean_title_key`)**: Prevents duplicate entries when titles differ only in punctuation, capitalization, or extra whitespace.
- **Canonical DOI (`canonical_doi`)**: Serves as the primary unique deduplication key.
- **SQLite Upsert Logic**: `ON CONFLICT(canonical_doi) DO UPDATE SET ...` enriches existing records with newly discovered abstracts or venues without generating duplicate database rows.

