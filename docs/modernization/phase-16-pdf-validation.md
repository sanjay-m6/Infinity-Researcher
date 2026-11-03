# Phase 16: PDF Validation and Integrity Verification Report

## 1. Magic Bytes Inspection

A common failure mode in academic paper acquisition is publishers returning an HTTP 200 status code with an HTML landing page, CAPTCHA, or institutional login wall instead of a raw PDF stream. Saving such responses as `.pdf` corrupts the local library and causes viewer rendering crashes.

To eliminate this vulnerability, **Infinity Researcher** executes multi-stage validation:

### Stage 1: First Chunk Inspection
On the very first network chunk received (usually within the first 1–8 KB):
- Evaluates the initial 1024 bytes using `CandidateVerifier::has_valid_pdf_magic_bytes`.
- **BOM & Comment Tolerance**:
  - Checks for UTF-8 Byte Order Marks (`0xEF, 0xBB, 0xBF`).
  - Checks for UTF-16 Byte Order Marks (`0xFE, 0xFF` / `0xFF, 0xFE`).
  - Tolerates leading whitespace and PDF header comments (`% ...`).
- **Immediate Rejection**:
  - If the header begins with `<!DOCTYPE html`, `<html`, or `<head`, the transfer is aborted immediately before wasting bandwidth on the remainder of the file.

---

## 2. Structural Parsing & Integrity

Once the entire file has finished streaming:
1. **Size Verification**:
   - Rejects any file `< 1024` bytes (a valid PDF cannot be under 1 KB).
   - Enforces a `100 MB` maximum limit to prevent zip/PDF bombs.
2. **Structural Parse Check (`PdfProcessor::process_pdf_file`)**:
   - Analyzes PDF dictionary, catalog reference, page tree, and trailer.
   - Detects encrypted or password-protected PDFs.
   - If the processor reports `status == "corrupt"`, the temporary file is deleted, and the task transitions to `failed` with `error_category = 'corrupt_pdf'`.

---

## 3. Incremental SHA-256 Hashing

- SHA-256 checksum is computed on the fly during chunk streaming via `sha2::Sha256`.
- Avoids reading the completed file back into memory from disk.
- Commits the calculated hash to `download_jobs.sha256_hash`, `paper_files.sha256_hash`, and `papers.content_hash`.

