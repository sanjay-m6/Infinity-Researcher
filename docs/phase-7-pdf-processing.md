# Phase 7 — PDF Processing & Document Integrity

## 1. Overview
The PDF processing subsystem verifies file integrity, validates document structure, detects corrupt or encrypted documents, and extracts embedded document metadata and extractable text safely.

## 2. Safe File Handling & Path Verification
- **Path Traversal Protection**: All local document file paths are verified against permitted application directories or user-selected library paths. Relative paths containing `..` or symlinks that escape allowed boundaries are rejected immediately (`FileIntegrityService::validate_file_path`).
- **Streaming SHA-256 Digest**: Content hashing streams bytes in 64 KB buffers using the Rust `sha2` crate. Large PDFs (e.g. 100 MB books or monographs) are never read entirely into heap memory.

## 3. Structural Parsing with `lopdf`
PDF documents are parsed using the memory-safe Rust `lopdf` crate:
- **Header Check**: Confirms the file contains a valid `%PDF` identifier.
- **Structural Validation**: Attempts complete trailer, cross-reference table (XRef), and object tree parsing.
- **Defensive Error Handling**: Lopdf parsing errors are classified into clear, safe statuses:
  - `verified`: Valid PDF structure with extractable text and metadata.
  - `no_text`: Structurally valid PDF (e.g. scanned document or vector-only graphics) with no extractable text streams.
  - `encrypted`: Password-protected or encrypted PDF (not forced open).
  - `corrupt`: Truncated, invalid cross-reference table, or syntax-corrupted document.
  - `invalid_format`: Non-PDF file with a `.pdf` extension or zero-byte file.
  - `missing`: File recorded in database but no longer present on local disk.

## 4. Metadata & Text Extraction Limits
- **Resource Bounds**:
  - Maximum pages processed for text extraction: 10 pages per document.
  - Maximum extracted text retained: 50,000 characters.
  - Maximum metadata field length: 500 characters.
- **Embedded Document Info**: Extracts standard PDF dictionary fields (`Title`, `Author`, `Subject`, `Creator`, `Producer`, `CreationDate`) without overwriting higher-confidence academic API metadata.
- **No Active Script Execution**: Never executes embedded JavaScript, form actions, or external hyperlinks found inside document streams.
