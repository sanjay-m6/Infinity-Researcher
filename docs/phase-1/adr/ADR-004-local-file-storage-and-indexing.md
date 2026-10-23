# ADR-004: Local Document File Storage Structure and FTS5 Indexing Strategy

* **Status:** Accepted  
* **Date:** 2026-10-24  
* **Deciders:** System Architect, Rust Engineer, Desktop Application Architect  

---

## Context and Problem Statement
A research desktop tool can accumulate thousands of academic PDFs over several years, easily consuming tens of gigabytes of disk space. Common pain points include:
* Opaque or colliding filenames (`download.pdf`, `paper(1).pdf`).
* Moving the application or library folder breaking absolute filesystem path links in the database.
* Incomplete or corrupted downloads polluting the library.
* Inability to search for phrases, formulas, or methods discussed deep inside full-text PDF documents.

## Decision Drivers
* Data Integrity: Never save partial, broken, or HTML error files into the library.
* Portability & Relocation: Users must be able to move their entire library to an external SSD or different computer without invalidating path references.
* Full-Text Discovery: Instant offline search across both metadata and in-document extracted PDF text.
* Filesystem Cleanliness: Human-readable, deterministic folder and file naming.

## Considered Options
1. **Option 1: Blob Storage inside SQLite Database**  
   Store binary PDF bytes directly in SQLite BLOB columns. (Rejected: SQLite database size balloons to tens of gigabytes, making backups slow and memory mapping inefficient).
2. **Option 2: Flat Folder with Absolute Filesystem Paths**  
   Dump all files into one directory using absolute paths (e.g. `C:\Users\John\...`). (Rejected: Breaks immediately upon moving directory or restoring to another machine).
3. **Option 3: Managed Directory with Relative Paths, Content Checksumming, and SQLite FTS5 Indexing (Selected)**

## Decision Outcome
**Chosen Option:** **Option 3: Managed Directory with Relative Paths, Content Checksumming, and SQLite FTS5 Indexing**.

### Document Storage Pipeline
1. **Managed Root with Relative Paths:**  
   The application maintains a configurable root directory (default: `%USERPROFILE%\Documents\ResearchPapers`). The database stores relative paths only (`2024/Vaswani_2017_Attention_Is_All_You_Need.pdf`).
2. **Safe Filename Generation:**  
   Files are named using sanitized, human-readable patterns:  
   `{FirstAuthor}_{Year}_{SlugifiedTitle}.pdf`  
   Special characters and spaces are sanitized; length is capped to 120 characters to respect Windows `MAX_PATH` limitations.
3. **Streaming Ingestion & Atomic Verification:**  
   Downloads stream to an isolated `.tmp` folder. Headers are inspected for `%PDF-` magic bytes. SHA-256 hash is computed on the fly. Only upon verified completion is the file atomically moved into the target library directory.
4. **Deduplication by Cryptographic Hash:**  
   The `files.checksum_sha256` column prevents duplicate storage of identical PDF files, saving local disk space.

### Full-Text Indexing Architecture
* Metadata (titles, abstracts, authors, notes) is indexed in SQLite `papers_fts` using the `unicode61` tokenizer.
* Extracted PDF text is indexed in `doc_text_fts`.
* Text extraction occurs as an asynchronous background worker job (`lopdf` / `pdf-extract`) bounded to 2 threads, ensuring the UI remains 100% responsive during intensive batch imports.

## Consequences & Trade-offs
### Positive
* High durability: No corrupt files or orphaned temporary artifacts.
* Library can be relocated to any drive or machine by updating a single configuration setting.
* Instant offline full-text search across thousands of papers in milliseconds.

### Negative / Mitigations
* Text extraction from complex multi-column or scanned PDFs may be imperfect or produce ligature artifacts. The application treats text extraction as an auxiliary search index and preserves the original PDF bit-for-bit without alteration.
