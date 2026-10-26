# PDF Access, Verification Pipeline & Integrated Reader

This document details the legal constraints, storage lifecycle, verification pipeline, and integrated offline reader for research paper PDFs in the application.

---

## 1. Ethical & Legal Access Constraints

The application treats full-text documents with strict compliance:
1. **No Brute-Forcing or URL Guessing**: The engine never generates speculative PDF URLs by incrementing IDs or guessing file paths.
2. **Visible Document Discovery**: Only downloads PDFs linked directly from public article landing pages via visible anchor tags (`<a href="...pdf">`), accessible button roles, or official Highwire Press meta tags (`<meta name="citation_pdf_url" content="...">`).
3. **Open-Access Only**: If an article requires institutional sign-in, subscription payment, or authentication, the scraper saves bibliographic metadata only and marks the document status as `restricted`.
4. **No Gate Bypass**: The scraper does not bypass paywalls, replay private session tokens, or defeat bot challenges.

---

## 2. Document Access States

Every paper record in the local SQLite database maintains an explicit `access_status`:

| Access Status | Description | UI Display |
| :--- | :--- | :--- |
| **`pdf_downloaded`** | File has been downloaded, verified, hashed, and stored locally. Ready for offline reading. | Green "Available (Offline)" badge |
| **`pdf_link_found`** | Direct, public PDF link detected on the article page, but binary not yet downloaded. | Blue "PDF Found (Ready to Download)" badge |
| **`metadata_only`** | Bibliographic citation extracted successfully; no direct public PDF link detected on page. | Slate "Metadata Only" badge |
| **`restricted`** | Article is behind a paywall, publisher embargo, or authentication gate. | Amber "PDF Restricted / Publisher Only" badge |
| **`failed`** | Download attempt failed due to network timeout or corrupt data. Metadata retained. | Rose "Download Failed" badge |

---

## 3. Download & Verification Pipeline

When a permitted PDF download is initiated:

```
[Target PDF URL]
       │
       ▼
[UrlGuard Re-Validation: Anti-SSRF, Scheme, Host]
       │
       ▼
[Streaming HTTP Client with Max-Size Cap]
       │
       ▼
[Streamed to Temporary File in local scratch/]
       │
       ▼
[Magic-Byte Inspection: Must start with %PDF-]
       │ (Rejects HTML error pages masquerading as PDF)
       ▼
[Compute SHA-256 Checksum on Stream]
       │
       ▼
[Check Local DB for Identical Hash: Deduplicate]
       │
       ▼
[Atomic Move to Stable Storage: data/papers/{paper_id}.pdf]
       │
       ▼
[SQLite Transaction: Link paper_files & Update papers.document_status]
```

### Safety Features
- **Unbounded Memory Protection**: PDFs are streamed directly from the network socket to disk in bounded 64 KB chunks. Never buffered entirely in RAM.
- **Magic Byte Validation**: Files claiming to be PDF must start with `%PDF-` bytes. If a server returns an HTML paywall or 403 page with a `.pdf` extension, the engine rejects it immediately and cleans up the temporary file.
- **Path Traversal Protection**: File paths are strictly generated from internal UUIDs (`{paper_id}.pdf`). Untrusted server filenames or URL paths are never used directly as filesystem paths.

---

## 4. Integrated PDF Reader Panel

The desktop application includes a full-featured, embedded PDF viewer powered by Mozilla's vetted `pdfjs-dist` (v6.4.299) running within an isolated, sandboxed web worker (`pdf.worker.min.mjs`).

### Reader Features
- **100% Offline**: Reads binary PDF bytes directly from the local filesystem via Tauri binary IPC (`read_paper_pdf`). Never transmits document data to external cloud servers.
- **Page Navigation**: Previous / Next controls, direct numeric page input, and total page count display.
- **Zoom & Viewing Modes**: Zoom In, Zoom Out, Preset Zoom levels (50% to 300%), Fit to Width, and Fit to Page.
- **Document Rotation**: 90-degree incremental rotation clockwise.
- **In-Document Full-Text Search**: Live substring search across PDF pages with match count display and next/previous match highlighting.
- **Collapsible Thumbnail Sidebar**: Page preview strip for rapid visual navigation.
- **Reading Position Persistence**: Automatically saves and restores last viewed page, zoom scale, and rotation angle in SQLite (`reader_state` table).
- **Focus Reading Mode**: Distraction-free full-screen reader view.

---

## 5. User-Provided Local PDF Imports

For papers acquired outside the scraper (e.g. personal institutional copies or author preprints):
- Users can import local `.pdf` files from their workstation directly into any paper record.
- Imported files undergo the same SHA-256 verification and atomic storage pipeline.
- Associated papers immediately become readable offline in the embedded viewer.
