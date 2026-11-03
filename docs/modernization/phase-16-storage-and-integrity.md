# Phase 16: Safe Storage, Atomic Commit, and Storage Hygiene Report

## 1. Storage Architecture & Atomic Commit

To guarantee that corrupt, incomplete, or partially transferred files never enter the research library:

1. **Temporary Streaming Path**:
   - Downloads stream to `.tmp_<job_id>.part` in the configured application storage folder.
2. **Atomic Rename**:
   - Only after network transfer finishes, checksum validates, and `PdfProcessor` confirms valid PDF structure, the backend executes `fs::rename(&temp_path, &final_path)`.
   - On modern operating systems (Windows NTFS, Linux ext4, macOS APFS), rename within the same filesystem volume is an atomic filesystem operation.
3. **Library Database Commitment**:
   - Transactionally updates:
     - `paper_files`: attaches file path, file name, byte size, page count, and SHA-256 hash.
     - `papers`: marks `has_file = 1`, `local_pdf_path = final_path`, `content_hash = sha256`.
     - `download_jobs`: sets `status = 'completed'`, `destination_path = final_path`.

---

## 2. Safe Dissociation Principle

A critical user experience standard is **safe dissociation**:
- Clearing a download from the history list (`deletePdfDownloadJob` or `clearCompletedPdfDownloads`) removes the job tracking record from SQLite `download_jobs`.
- **It NEVER deletes `<paper_id>.pdf` or touches `paper_files`**.
- The paper remains fully readable, indexed in full-text search, and available to the AI Assistant.

---

## 3. Storage Maintenance & Orphan Cleanup

If an application crash or force-kill occurs during transfer, orphaned `.tmp_*.part` files might linger:
- **`get_download_storage_metrics`**:
  - Scans the storage directory.
  - Returns `storage_path`, `total_bytes` (from `.pdf` files), `pdf_count`, `temp_files_count`, and `temp_files_bytes`.
- **`clean_orphaned_downloads`**:
  - Compares all `.tmp_*.part` files against in-memory active jobs (`self.cancel_senders`).
  - Safely deletes ONLY abandoned `.part` files.
  - Leaves all valid user `.pdf` files 100% untouched.
  - Reports count of files deleted and total bytes freed.

