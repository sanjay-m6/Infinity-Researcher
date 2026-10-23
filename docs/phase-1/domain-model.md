# Domain Model & Database Schema Specification

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Database Engine:** SQLite 3 (with WAL mode, foreign key enforcement, and FTS5)  
**Schema Migration Engine:** Versioned, incremental SQL migrations (`schema_migrations`)  

---

## 1. Architectural Principles of the Data Layer

1. **Clean Separation of Canonical Identity and Source Provenance:**  
   The application treats external academic providers as contributing informants. A paper's canonical identity lives in `papers`, while provider-specific identifiers, raw response payloads, and source URLs reside in `source_records`.
2. **Relative File Storage Paths:**  
   The `files` table stores file paths relative to the configured library data root (e.g. `2024/Vaswani_2017_Attention.pdf`). This ensures the entire library directory can be relocated across drives or restored from backup without breaking database path links.
3. **No Unbounded Raw Payloads:**  
   Raw JSON payloads in `source_records` are strictly bounded ($\le 256\text{KB}$) and scrubbed of non-essential transient fields before persistence.
4. **Zero Commingling of Secrets:**  
   Authentication keys (such as optional Semantic Scholar or OpenAlex keys) are stored in `app_settings` or OS credential stores, never inside `sources` or `papers` tables.
5. **Full-Text Search Indexing:**  
   Search across metadata and extracted PDF text is backed by dedicated SQLite FTS5 virtual tables with content synchronization triggers.

---

## 2. Detailed Entity Specifications

### 2.1 Entity: `papers`
Represents the local canonical bibliographic record of a scholarly work.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `canonical_doi`: `TEXT UNIQUE` NULLABLE (normalized lowercase `10.xxxx/...`).
  * `title`: `TEXT` NOT NULL (sanitized, UTF-8).
  * `clean_title_key`: `TEXT` NOT NULL (lowercase alphanumeric string for fuzzy index matching).
  * `abstract`: `TEXT` NULLABLE.
  * `publication_date`: `TEXT` NULLABLE (ISO 8601: `YYYY-MM-DD` or `YYYY`).
  * `publication_year`: `INTEGER` NULLABLE (derived 4-digit year for indexing and sorting).
  * `venue`: `TEXT` NULLABLE (journal name, conference, or repository).
  * `venue_type`: `TEXT` NULLABLE (`journal`, `conference`, `repository`, `book`).
  * `language`: `TEXT` DEFAULT `'en'`.
  * `citation_count`: `INTEGER` DEFAULT 0.
  * `reference_count`: `INTEGER` DEFAULT 0.
  * `is_open_access`: `INTEGER` NOT NULL DEFAULT 0 (Boolean 0 or 1).
  * `license`: `TEXT` NULLABLE (e.g. `'CC-BY-4.0'`, `'CC0'`).
  * `primary_landing_url`: `TEXT` NULLABLE (verified canonical HTTPS landing page).
  * `has_file`: `INTEGER` NOT NULL DEFAULT 0 (1 if local verified PDF exists).
  * `metadata_confidence`: `TEXT` NOT NULL DEFAULT `'verified'` (`'verified'`, `'unverified'`, `'user_edited'`).
  * `created_at`: `TEXT` NOT NULL (UTC ISO 8601).
  * `updated_at`: `TEXT` NOT NULL (UTC ISO 8601).
* **Indexes:**
  * `idx_papers_doi` on `canonical_doi` (Unique, where `canonical_doi IS NOT NULL`).
  * `idx_papers_year` on `publication_year`.
  * `idx_papers_has_file` on `has_file`.
  * `idx_papers_clean_title` on `clean_title_key`.

---

### 2.2 Entity: `authors`
Represents normalized researcher identities.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `full_name`: `TEXT` NOT NULL (formatted display name, e.g. "Ashish Vaswani").
  * `family_name`: `TEXT` NULLABLE ("Vaswani").
  * `given_name`: `TEXT` NULLABLE ("Ashish").
  * `orcid`: `TEXT UNIQUE` NULLABLE (19-character string `0000-0002-1825-0097`).
  * `created_at`: `TEXT` NOT NULL.
* **Indexes:**
  * `idx_authors_orcid` on `orcid` (Unique, where `orcid IS NOT NULL`).
  * `idx_authors_name` on `family_name, given_name`.

---

### 2.3 Entity: `paper_authors`
Many-to-many relationship establishing author order, affiliations, and roles for each paper.

* **Primary Key:** Composite `(paper_id, author_id)`.
* **Foreign Keys:**
  * `paper_id` REFERENCES `papers(id)` ON DELETE CASCADE.
  * `author_id` REFERENCES `authors(id)` ON DELETE RESTRICT.
* **Columns:**
  * `paper_id`: `TEXT` NOT NULL.
  * `author_id`: `TEXT` NOT NULL.
  * `author_order`: `INTEGER` NOT NULL (0-indexed position: 0 for first author, 1 for second, etc.).
  * `affiliation`: `TEXT` NULLABLE (institution name at publication).
  * `role`: `TEXT` NOT NULL DEFAULT `'author'` (`'author'`, `'editor'`, `'translator'`).
* **Indexes:**
  * `idx_paper_authors_order` on `paper_id, author_order`.

---

### 2.4 Entity: `sources`
Catalog of supported academic connector integrations.

* **Primary Key:** `id` (`TEXT` e.g. `'openalex'`, `'crossref'`, `'arxiv'`, `'europe_pmc'`, `'doaj'`).
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `name`: `TEXT` NOT NULL (Display name: "OpenAlex").
  * `tier`: `TEXT` NOT NULL (`tier_a`, `tier_b`, `tier_c`).
  * `base_url`: `TEXT` NOT NULL.
  * `is_enabled`: `INTEGER` NOT NULL DEFAULT 1 (1 for enabled, 0 for disabled).
  * `rate_limit_rps`: `INTEGER` NOT NULL (configured requests per second).
  * `concurrency_limit`: `INTEGER` NOT NULL (max simultaneous requests).
  * `created_at`: `TEXT` NOT NULL.
  * `updated_at`: `TEXT` NOT NULL.

---

### 2.5 Entity: `source_records`
Immutable provenance audit records linking raw upstream provider payloads to canonical papers.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Foreign Keys:**
  * `paper_id` REFERENCES `papers(id)` ON DELETE CASCADE.
  * `source_id` REFERENCES `sources(id)` ON DELETE CASCADE.
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `paper_id`: `TEXT` NOT NULL.
  * `source_id`: `TEXT` NOT NULL.
  * `source_record_id`: `TEXT` NOT NULL (e.g. `'W2963403866'`, `'1706.03762'`).
  * `source_url`: `TEXT` NOT NULL.
  * `raw_payload_json`: `TEXT` NULLABLE (bounded JSON string).
  * `open_access_pdf_url`: `TEXT` NULLABLE.
  * `retrieved_at`: `TEXT` NOT NULL.
* **Unique Constraints:** `UNIQUE(source_id, source_record_id)`.
* **Indexes:**
  * `idx_source_records_paper` on `paper_id`.
  * `idx_source_records_source_rec` on `source_id, source_record_id`.

---

### 2.6 Entity: `files`
Tracks local physical files (PDFs, supplementary data) managed by the library.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Foreign Keys:**
  * `paper_id` REFERENCES `papers(id)` ON DELETE CASCADE.
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `paper_id`: `TEXT` NOT NULL.
  * `relative_path`: `TEXT UNIQUE` NOT NULL (e.g. `'2024/Vaswani_2017.pdf'`).
  * `original_filename`: `TEXT` NOT NULL.
  * `checksum_sha256`: `TEXT UNIQUE` NOT NULL (64-character hex hash).
  * `size_bytes`: `INTEGER` NOT NULL.
  * `mime_type`: `TEXT` NOT NULL DEFAULT `'application/pdf'`.
  * `text_extraction_status`: `TEXT` NOT NULL DEFAULT `'pending'` (`'pending'`, `'extracted'`, `'failed'`, `'not_applicable'`).
  * `extraction_error`: `TEXT` NULLABLE.
  * `downloaded_at`: `TEXT` NOT NULL.
* **Indexes:**
  * `idx_files_checksum` on `checksum_sha256` (Unique).
  * `idx_files_paper` on `paper_id`.

---

### 2.7 Entity: `collections` and `collection_papers`
Supports hierarchical folders and user-curated groupings.

* **`collections` Primary Key:** `id` (`TEXT` UUID v4).
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `parent_id`: `TEXT` NULLABLE REFERENCES `collections(id)` ON DELETE SET NULL.
  * `name`: `TEXT` NOT NULL.
  * `description`: `TEXT` NULLABLE.
  * `color_hex`: `TEXT` DEFAULT `'#3b82f6'`.
  * `created_at`: `TEXT` NOT NULL.
  * `updated_at`: `TEXT` NOT NULL.
* **`collection_papers` Composite Key:** `(collection_id, paper_id)`.
  * `collection_id`: `TEXT` REFERENCES `collections(id)` ON DELETE CASCADE.
  * `paper_id`: `TEXT` REFERENCES `papers(id)` ON DELETE CASCADE.
  * `added_at`: `TEXT` NOT NULL.

---

### 2.8 Entity: `tags` and `paper_tags`
Many-to-many flat tagging system.

* **`tags` Primary Key:** `id` (`TEXT` UUID v4).
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `name`: `TEXT UNIQUE` NOT NULL (trimmed, case-insensitive index).
  * `color_hex`: `TEXT` DEFAULT `'#64748b'`.
  * `created_at`: `TEXT` NOT NULL.
* **`paper_tags` Composite Key:** `(paper_id, tag_id)`.
  * `paper_id`: `TEXT` REFERENCES `papers(id)` ON DELETE CASCADE.
  * `tag_id`: `TEXT` REFERENCES `tags(id)` ON DELETE CASCADE.
  * `tagged_at`: `TEXT` NOT NULL.

---

### 2.9 Entity: `notes`
Local research commentary attached to papers.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Foreign Keys:**
  * `paper_id` REFERENCES `papers(id)` ON DELETE CASCADE.
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `paper_id`: `TEXT` NOT NULL.
  * `title`: `TEXT` NOT NULL DEFAULT `'Research Notes'`.
  * `content_markdown`: `TEXT` NOT NULL.
  * `created_at`: `TEXT` NOT NULL.
  * `updated_at`: `TEXT` NOT NULL.
* **Indexes:**
  * `idx_notes_paper` on `paper_id`.

---

### 2.10 Entity: `jobs`
Persistent, recoverable background job state.

* **Primary Key:** `id` (`TEXT` UUID v4).
* **Columns:**
  * `id`: `TEXT PRIMARY KEY` NOT NULL.
  * `job_type`: `TEXT` NOT NULL (`search`, `download`, `import`, `extract_text`, `export`).
  * `target_id`: `TEXT` NULLABLE (e.g. `paper_id` or batch ID).
  * `source_id`: `TEXT` NULLABLE.
  * `status`: `TEXT` NOT NULL (`queued`, `running`, `succeeded`, `failed`, `cancelled`, `paused`).
  * `progress_percent`: `INTEGER` NOT NULL DEFAULT 0 (0-100).
  * `bytes_processed`: `INTEGER` NOT NULL DEFAULT 0.
  * `total_bytes`: `INTEGER` NOT NULL DEFAULT 0.
  * `error_message`: `TEXT` NULLABLE.
  * `created_at`: `TEXT` NOT NULL.
  * `started_at`: `TEXT` NULLABLE.
  * `completed_at`: `TEXT` NULLABLE.
* **Indexes:**
  * `idx_jobs_status` on `status`.
  * `idx_jobs_created` on `created_at`.

---

### 2.11 Full-Text Search (FTS5) Virtual Tables

1. **`papers_fts` (Metadata Search):**
   ```sql
   CREATE VIRTUAL TABLE papers_fts USING fts5(
       paper_id UNINDEXED,
       title,
       abstract,
       authors,
       venue,
       tokenize='unicode61 remove_diacritics 1'
   );
   ```
2. **`doc_text_fts` (In-Document PDF Text Search):**
   ```sql
   CREATE VIRTUAL TABLE doc_text_fts USING fts5(
       file_id UNINDEXED,
       paper_id UNINDEXED,
       extracted_text,
       tokenize='unicode61 remove_diacritics 1'
   );
   ```

---

## 3. Justifications for Key Schema Decisions

* **Citations and References:**  
  Modeled as aggregated counts (`citation_count`, `reference_count`) on `papers` rather than individual edge tables in Phase 1. Storing hundreds of thousands of individual reference edges from external graphs causes severe schema bloat for a local desktop tool. Individual citation graphs can be introduced in P2 if citation visualization is prioritized.
* **Downloads:**  
  Unified into the `jobs` table with `job_type = 'download'` and linked to `files`. A separate downloads table would duplicate state with the job queue.
* **App Settings (`app_settings`):**  
  Modeled as a key-value configuration table (`key TEXT PRIMARY KEY, value TEXT, updated_at TEXT`) to support extensible, typed settings (storage path, polite email, UI preferences) without requiring repeated schema migrations for every new configuration flag.
