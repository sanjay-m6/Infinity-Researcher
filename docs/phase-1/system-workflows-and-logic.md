# End-to-End System Workflows and System Logic

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Verified  

---

## 1. Search Workflow Logic

### Flowchart
```
[User Input Query & Options]
           │
           ▼
[Validate & Normalize Query] ──(Invalid)──► [Return UI Validation Error]
           │ (Valid)
           ▼
[Generate Search Job ID & State]
           │
           ▼
[Partition Tasks across Enabled Source Adapters]
   ┌───────────────┬───────────────┬───────────────┐
   ▼               ▼               ▼               ▼
[OpenAlex]     [Crossref]       [arXiv]       [Europe PMC]  ...
(10-30 rps)    (10 rps polite)  (1 req/3s)    (10 rps polite)
   │               │               │               │
   └───────────────┴───────────────┴───────────────┘
           │
           ▼
[Per-Source Response Normalization -> Vec<PaperCandidate>]
           │
   ┌───────┴────────────────────────┐
   ▼                                ▼
(Source Success)             (Source Failure/Timeout)
   │                                │
   │                         [Record Diagnostic Banner]
   ▼                                │
[Deduplication & Merge Pass] ◄──────┘
(Group on Canonical DOI & IDs)
           │
           ▼
[Emit Progress & Results Stream to UI]
           │
           ▼
[Transient Query Cache / Optional Search History]
```

### Pseudocode
```python
async def execute_federated_search(query_str: str, source_ids: List[str], filters: SearchFilters) -> SearchResultBundle:
    # 1. Validate Query
    sanitized_query = query_str.strip()
    if len(sanitized_query) < 2:
        raise ValidationError("Search query must be at least 2 characters long.")
    
    job_id = generate_uuid()
    active_sources = [s for s in source_ids if connector_registry.is_enabled(s)]
    if not active_sources:
        raise ConfigError("At least one academic source must be enabled.")

    # 2. Spawn concurrent tasks with cancellation token
    cancellation_token = CancellationToken()
    source_tasks = []
    for source in active_sources:
        adapter = connector_registry.get_adapter(source)
        source_tasks.append(adapter.search(sanitized_query, filters, cancellation_token))

    # 3. Await all results with per-source isolation
    raw_responses = await asyncio.gather(*source_tasks, return_exceptions=True)

    candidates = []
    source_diagnostics = []

    for source_id, result in zip(active_sources, raw_responses):
        if isinstance(result, Exception):
            source_diagnostics.append(SourceDiagnostic(
                source_id=source_id,
                status="failed",
                error_message=str(result),
                is_retryable=is_transient_error(result)
            ))
        else:
            source_diagnostics.append(SourceDiagnostic(
                source_id=source_id,
                status="success",
                result_count=len(result.candidates)
            ))
            for raw_item in result.candidates:
                candidate = normalize_provider_candidate(source_id, raw_item)
                candidates.append(candidate)

    # 4. Federated Deduplication
    merged_results = deduplicate_candidates(candidates)

    # 5. Return complete bundle
    return SearchResultBundle(
        job_id=job_id,
        query=sanitized_query,
        total_found=len(merged_results),
        results=merged_results,
        diagnostics=source_diagnostics
    )
```

---

## 2. Metadata Normalization and Deduplication Logic

### Canonicalization Rules
1. **DOI Canonicalization:**  
   Strip URL prefixes (`https://doi.org/`, `http://dx.doi.org/`), strip leading `doi:`, trim whitespace, and convert entire string to lowercase.  
   *Target regex:* `^10\.\d{4,9}/[-._;()/:a-z0-9]+$`
2. **Title Normalization:**  
   Convert to Unicode NFKC, strip HTML tags (e.g. `<i>`, `<sub>`), replace multiple whitespace characters with a single space, convert to lowercase, and strip leading/trailing punctuation for matching keys.
3. **Author Normalization:**  
   Preserve original author sequence. Extract `family_name`, `given_name`, and `orcid` where structured. Clean initials.
4. **Abstract Reconstruction:**  
   OpenAlex stores abstracts as inverted indexes (`{"word": [0, 4, 12]}`). The normalizer must invert the index, reconstruct word positions into a continuous string, and trim whitespace.
5. **Venue & Date:**  
   Normalize dates into ISO 8601 string (`YYYY-MM-DD` or `YYYY`).

### Deduplication Order & Precedence
```
                  [Candidate A & Candidate B]
                              │
                              ▼
                 [Do both have valid DOIs?]
                   /                     \
                 (Yes)                   (No)
                  │                        │
         [Do DOIs match?]           [Do stable IDs match?]
          /            \            (e.g. arXiv ID, PMID)
        (Yes)          (No)          /                 \
         │              │          (Yes)               (No)
         ▼              ▼           │                    │
    [MERGE AS      [DO NOT MERGE    ▼                    ▼
     IDENTICAL]    KEEP SEPARATE] [MERGE AS         [Fuzzy Title + Author Check]
                                  IDENTICAL]       (Jaro-Winkler > 0.92 & Year Match)
                                                   /                                \
                                                 (Yes)                              (No)
                                                  │                                  │
                                                  ▼                                  ▼
                                         [FLAG AS SUSPECTED                 [DO NOT MERGE
                                          DUPLICATE FOR USER                 KEEP SEPARATE]
                                          REVIEW WORKSPACE]
```

### Conflict Resolution for Merged Fields
* **DOI:** Authoritative from Crossref/DataCite.
* **Title:** Prefer the most complete title (preserves proper capitalization).
* **Authors:** Prefer the source with structured ORCID identifiers.
* **Abstract:** Prefer the longer, un-truncated abstract text.
* **Open Access PDF URL:** Union of available download links; verified OA source takes priority.
* **Provenance:** Retain all raw contributing source records in `source_records`.

---

## 3. PDF and File Download Workflow Logic

### Flowchart
```
[User Clicks "Download PDF" or Auto-Queue Rule]
                     │
                     ▼
[Resolve Candidate URL & Verify Open-Access Permission]
                     │
       ┌─────────────┴─────────────┐
    (Permitted OA)             (Restricted / Paywall)
       │                           │
       │                           ▼
       │                    [Mark "Manual Link Only",
       │                     Open Publisher Page]
       ▼
[Validate URL Scheme & Anti-SSRF Check]
(Block Loopback, Private IPs, Metadata IPs)
       │
       ▼
[Enqueue Download Job in SQLite jobs table]
       │
       ▼
[Download Worker Starts: Stream to .tmp File]
       │
       ▼
[Verify HTTP 200, Content-Length <= 100MB]
       │
       ▼
[Inspect Magic Bytes: First 4 bytes must be %PDF-] ──(No)──► [Abort & Purge .tmp]
       │ (Yes)
       ▼
[Compute SHA-256 Checksum on Streamed File]
       │
       ▼
[Generate Deterministic Filename: {Author}_{Year}_{Title}.pdf]
       │
       ▼
[Atomic Filesystem Move from .tmp to Library Path]
       │
       ▼
[Commit Transaction: Insert files row, Update papers.has_file = 1]
       │
       ▼
[Emit Progress & Completion Events to UI]
```

### Pseudocode
```python
async def download_paper_pdf(paper_id: str, download_url: str, storage_config: StorageConfig) -> FileRecord:
    # 1. SSRF Validation
    target_ip = resolve_dns(download_url)
    if is_forbidden_ip(target_ip): # 127.0.0.1, 10.0.0.0/8, 169.254.169.254, etc.
        raise SecurityException(f"Destination IP {target_ip} is rejected by SSRF guard.")

    job_id = db.insert_job("pdf_download", paper_id=paper_id, status="running")
    temp_filepath = storage_config.temp_dir / f"{job_id}.tmp"

    try:
        async with http_client.stream("GET", download_url, headers=polite_headers(), follow_redirects=False) as resp:
            # Re-check redirect targets if 301/302
            if resp.is_redirect:
                redirect_url = resp.headers["location"]
                return await download_paper_pdf(paper_id, redirect_url, storage_config)

            if resp.status_code != 200:
                raise DownloadException(f"Server returned HTTP {resp.status_code}")

            content_length = int(resp.headers.get("content-length", 0))
            if content_length > storage_config.max_file_size_bytes: # 100 MB
                raise DownloadException(f"File size {content_length} exceeds limit.")

            hasher = hashlib.sha256()
            total_bytes = 0
            header_checked = False

            with open(temp_filepath, "wb") as f:
                async for chunk in resp.iter_bytes(chunk_size=16384):
                    if not header_checked:
                        if len(chunk) >= 4 and not chunk.startswith(b"%PDF-"):
                            raise DownloadException("Invalid file: magic bytes do not match PDF signature.")
                        header_checked = True

                    f.write(chunk)
                    hasher.update(chunk)
                    total_bytes += len(chunk)
                    if total_bytes > storage_config.max_file_size_bytes:
                        raise DownloadException("Stream exceeded max file size during download.")
                    
                    db.update_job_progress(job_id, bytes_downloaded=total_bytes, total_bytes=content_length)

        # Atomic Move & Registration
        file_hash = hasher.hexdigest()
        paper = db.get_paper(paper_id)
        final_filename = sanitize_filename(f"{paper.primary_author}_{paper.year}_{paper.title}.pdf")
        final_filepath = storage_config.library_dir / final_filename

        atomic_move(temp_filepath, final_filepath)

        file_record = db.insert_file(
            paper_id=paper_id,
            relative_path=str(final_filepath.relative_to(storage_config.library_dir)),
            checksum_sha256=file_hash,
            size_bytes=total_bytes,
            mime_type="application/pdf"
        )
        db.update_paper_file_status(paper_id, has_file=True)
        db.update_job_status(job_id, status="succeeded")
        return file_record

    except Exception as err:
        if temp_filepath.exists():
            temp_filepath.unlink() # Purge incomplete temp file
        db.update_job_status(job_id, status="failed", error=str(err))
        raise err
```

---

## 4. Job Queue and Concurrency Logic

### Job States
* `queued`: Job created and pending worker slot.
* `running`: Active execution; streaming or parsing.
* `succeeded`: Execution finished with 100% completion.
* `partially_succeeded`: Completed with partial warnings (e.g. metadata saved, but thumbnail failed).
* `failed`: Unrecoverable error occurred (e.g. 404, SSRF violation).
* `cancelled`: Aborted by user; temporary resources unlinked.
* `paused`: Suspended due to upstream 429 / Retry-After or user pause.
* `retrying`: Transient failure; awaiting exponential backoff delay.

### Concurrency Allocations
* **Global Network Concurrency:** Max 6 parallel downloads across all hosts.
* **Per-Host Concurrency:**
  * arXiv: Strict 1 concurrent request; minimum 3,000ms delay between dispatches.
  * Semantic Scholar: 1 concurrent request (authenticated).
  * Crossref: Max 5 concurrent requests (Polite Pool).
  * Europe PMC: Max 4 concurrent requests.
  * OpenAlex: Max 5 concurrent requests.
* **Disk / Extraction Concurrency:** Max 2 parallel PDF text extractions to prevent local CPU/disk thrashing.

---

## 5. Local PDF Import and Processing Logic

### Ingestion Workflow
1. User selects single file or directory.
2. Ingestion service enumerates files with `.pdf` extension; ignores system/hidden files.
3. For each file:
   * Verify file exists, size $> 0$, and starts with `%PDF-`.
   * Compute SHA-256 hash. Query `files` table for matching hash. If duplicate found, skip download and link existing record.
   * Parse PDF Document Info dictionary (extract `Title`, `Author`, `CreationDate`).
   * Extract plain text from Page 1 and Page 2.
   * Run high-precision regex scanners:
     * DOI pattern: `(?i)\b10\.\d{4,9}/[-._;()/:A-Za-z0-9]+\b`
     * arXiv ID pattern: `(?i)\barxiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)\b`
   * **If DOI/arXiv ID detected:** Call local Crossref/OpenAlex resolver to fetch full bibliographic metadata, authors, and abstract.
   * **If no identifier found:** Create paper record using PDF Title property (or cleaned filename as fallback), flag `metadata_confidence = "unverified"`.
   * Atomically copy or link file into library managed directory.
   * Queue text extraction job for SQLite FTS5 search indexing.

---

## 6. Local Search Logic

### Search Layers
1. **Metadata Search (FTS5):** Indexes `title`, `abstract`, `authors`, `venue`, `tags`, and `user_notes`.
2. **Full-Text Document Search (FTS5):** Indexes extracted plain text from local PDFs (`doc_text` virtual table).

### Query Processing Rules
* Tokenization: SQLite FTS5 `unicode61` tokenizer with case-folding and diacritic removal.
* Multiple terms default to `AND` operator (e.g. `quantum error` becomes `quantum AND error`).
* Quoted terms execute exact phrase queries (`"neural radiance fields"`).
* Prefix queries supported for terms $\ge 3$ characters (`transf*`).
* Offline-first: Runs directly against local SQLite database in $< 20\text{ms}$ with zero network activity.

---

## 7. Citation and Metadata Export Logic

### Supported Formats & P0 Scope
* **BibTeX (`.bib`):** [P0] Standard LaTeX citation keys (`{author}{year}{title_word}`). Properly escapes LaTeX reserved characters: `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`.
* **RIS (`.ris`):** [P0] Standard Research Information Systems format compatible with Zotero, EndNote, and Mendeley.
* **CSV (`.csv`):** [P0] Tabular export of selected library rows for spreadsheets or statistical analysis.
* **JSON (`.json`):** [P0] Full structured dump of canonical paper, authors, tags, and source records for backup.

### Export Determinism
* Keys and record ordering are sorted deterministically (by primary author then publication year).
* Encoding is strictly UTF-8 without BOM.
* Missing fields omit corresponding tags rather than outputting `"None"` or `"undefined"`.
