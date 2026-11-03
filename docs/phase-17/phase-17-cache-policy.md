# Phase 17 — Academic Connector Cache & Ephemeral Storage Policy

**Subsystem**: Query Caching & Temporary Storage  
**Module**: `src-tauri/src/academic_sources/` & `database/`  
**Phase**: Phase 17 Modernization  

---

## 1. Storage Tiers Overview

Academic search queries and metadata live across three distinct storage tiers:
1. **Tier 1 (Ephemeral In-Memory Cache)**: Query responses and connector health checks kept in the React UI session state (`discoverSessionStore.ts`) during active user exploration.
2. **Tier 2 (Session Persistence)**: Preserved discovered search results and filter selections surviving view navigation without re-triggering upstream API requests.
3. **Tier 3 (Persistent SQLite Library)**: Curated papers explicitly imported by the researcher, stored permanently in the `papers`, `paper_authors`, and `paper_sources` tables.

---

## 2. In-Memory Session Cache Rules

- Discovered search results are preserved across navigation between tabs (e.g. switching from Discover Papers to PDF Reader, AI Hub, or Library, and returning).
- Results remain intact until the user manually triggers a new search or clears results.
- This policy prevents redundant API quota consumption and avoids triggering upstream rate limits on frequent tab switches.

---

## 3. SQLite Import Deduplication & Provenance Preservation

When selected search results are imported into the research library via `import_search_results`:
1. **Duplicate Check by Canonical DOI**: Queries `PaperRepository::get_by_doi(&conn, doi)`.
2. **Duplicate Check by Clean Title Key**: Queries `PaperRepository::get_by_clean_title(&conn, &work.clean_title_key)`.
3. **Existing Paper Preservation**:
   - If the paper already exists in the database, its existing tags, notes, reading progress, and local PDF path are preserved untouched.
   - If `is_saved` was false, it is toggled to true.
4. **Provenance Tracking**:
   - Provenance records are inserted into `paper_sources`:
     ```sql
     INSERT OR IGNORE INTO paper_sources (paper_id, source_id, source_record_id, source_url, retrieved_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ```
   - This ensures multi-source indexing history is permanently recorded in the local SQLite database.

---

## 4. Cache Invalidation & Temporary File Cleanup

- Health check probe results have a maximum cache TTL of 60 seconds before requiring a fresh network ping.
- Downloaded temporary PDF previews are managed by Phase 16's `cleanOrphanedDownloads` utility and purged safely.

