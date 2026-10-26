# Research Integrity Privacy Architecture & Data Flow

## 1. Zero-Leakage Privacy Policy

Academic manuscripts, unpublished pre-prints, and experimental data are sensitive intellectual property. The Research Integrity & Academic Writing Suite adheres to strict privacy and data isolation guarantees:

```
+-----------------------------------------------------------------------------------+
|                            Local Desktop Boundary                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [User Manuscript] ---> [Tauri 2 Desktop Shell] ---> [Local SQLite (data.db)]     |
|          |                         |                                              |
|          | (Local File Path)       | (Standard IO / IPC)                          |
|          v                         v                                              |
|  [Document Ingest]      [Python Worker Subprocess]                               |
|   (Local Extraction)        - Local Winnowing                                     |
|                             - Local Fingerprint Index                             |
|                             - Local Statistical AI Signal                         |
|                             - Local Rule-Based Writing Assistant                  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                     X (BLOCKED BY DEFAULT)
                                     X
                        +--------------------------+
                        |  Remote Cloud AI APIs    |
                        | (OpenAI, Anthropic, etc) |
                        +--------------------------+
```

1. **Local-First Default**: By default, **100% of document processing, fingerprinting, similarity comparison, statistical AI analysis, and writing revisions execute locally on the user's machine**.
2. **Zero Cloud Telemetry**: Document text, excerpts, titles, hashes, and reviewer comments are **never** logged to telemetry servers or third-party diagnostic endpoints.
3. **No Unannounced Network Requests**: The application never sends document excerpts to remote servers for "spelling checks", "AI detection", or "plagiarism screening".
4. **Local Only Toggle**: When the user sets the AI Provider setting to `Local Only`, all outbound HTTP network sockets within the AI pipeline are intercepted and rejected at the system level.

---

## 2. Document Immutability & Revision Storage

To ensure academic provenance and auditability:
- **Original Source Immutability**:
  The submitted document (`integrity_documents`) is stored in SQLite with its SHA-256 cryptographic digest. Once ingested, `raw_content` is immutable and cannot be overwritten.
- **Separate Revision Sessions**:
  Writing Assistant sessions (`writing_sessions`) branch off the original document. Every revision (`writing_revisions`) is persisted as an independent row with:
  - `revision_number`: Incremental sequence (1, 2, 3...)
  - `transformation_mode`: The applied mode (e.g., `academic_tone`, `concise`, `clarity`)
  - `revised_content`: Full text of the revision
  - `diff_data`: JSON-encoded word-level edit operations
  - `meaning_risk_flags`: Array of automated warnings (e.g., modified quantities or dropped citations)
- **User-Controlled Export**:
  The user must explicitly click "Save Revision" or "Export" to write modified text back to a new file on disk. The original file remains untouched.

---

## 3. Secure Credential Management & API Key Handling

For users who explicitly configure external hosted providers (e.g., OpenAI, Anthropic, or OpenRouter for writing suggestions):
- **Encrypted Local Storage**: API keys are managed using OS keychain integration or encrypted SQLite columns.
- **Redaction from Logs**: Structured application logging pipelines automatically redact headers containing `Authorization: Bearer ...`, `x-api-key`, and query parameters matching `api_key=...`.
- **Pre-Call Disclosure**: Whenever a cloud provider is invoked, the UI displays the chosen provider, model name, and routing disclosure before transmitting any prompt.

---

## 4. Local Corpus Storage & Isolation

The local reference corpus is stored entirely within the application's local SQLite database:
- **Corpus Sources (`corpus_sources`)**: Metadata, titles, file paths, and SHA-256 hashes of indexed papers.
- **Corpus Fingerprints (`corpus_fingerprints`)**: 64-bit integer hashes representing text shingles. Storing hashes rather than raw text allows rapid inverted-index retrieval without duplicating gigabytes of text on disk.
- **Safe Deletion**: Deleting an item from the corpus removes its indexed fingerprints from SQLite. It **never** deletes the original PDF or source paper from the user's disk or research library.
