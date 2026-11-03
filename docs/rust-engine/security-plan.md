# Infinity Researcher — Backend Security & Privacy Plan

**Date:** 2026-10-29  
**Version:** 0.1.0  
**Authors:** Principal Systems & AI Infrastructure Architect

---

## 1. Security Architecture & Threat Model

Infinity Researcher is designed for academic, scientific, and enterprise researchers who handle proprietary data, embargoed research papers, and pre-publication manuscripts. The security model adheres to a **local-first, zero-trust cloud boundary** philosophy.

---

## 2. Privacy Guard Enforcement (Local-Only Mode)

### 2.1 Backend Network Barrier
Local-only mode is not merely a UI toggle; it is enforced in Rust at the network transport boundary before any socket, DNS lookup, or HTTP request is performed:
```rust
if settings.local_only_mode && !provider.is_local {
    return Err(AppError::Validation(
        "Local-only mode is active in AI Settings. All outbound cloud requests are strictly blocked.".into()
    ));
}
```

### 2.2 Paper Content Transmission Protection
- Full-text research documents, extracted tables, and user draft manuscripts must never be forwarded to third-party cloud LLMs without explicit, recorded user consent.
- When `cloud_paper_sharing_enabled = false`, even if a cloud provider (e.g., Groq, Gemini) is selected for general Q&A, sending document excerpts or draft text triggers an immediate rejection.
- The UI must clearly indicate whether a task is executing locally or transmitting metadata externally.

---

## 3. Secret & Credential Management

### 3.1 Vault Isolation
- API credentials for cloud providers (OpenAI, Anthropic, Gemini, Groq, OpenRouter, etc.) are **never** stored in plain text in the SQLite database or committed to version control.
- In-memory credentials are stored in `AiProviderService::secure_store` (`Mutex<HashMap<String, String>>`) and synchronized to a secure local vault file in the application data directory (`.vault.dat`).
- In SQLite, the `ai_providers` table stores only an opaque reference key (e.g., `cred:ai_groqcloud:v1`).
- All loggers (`tracing::info!`, `warn!`) explicitly redact API keys, showing only the provider ID and credential reference name.

---

## 4. Input Validation & Document Safety

### 4.1 Path Traversal Prevention
- All file access commands (`open_paper_document`, `read_paper_pdf`, `ingest_document_content`) must validate and canonicalize paths using `std::fs::canonicalize`.
- Paths must be verified to stay within designated application directories or explicitly chosen user file paths.

### 4.2 Malicious Document Defense
- **PDF Parser Sandboxing**: Uses `lopdf` with defensive error handling to prevent stack overflows or memory exhaustion on malformed PDF structures.
- **Resource Limits**:
  - Maximum pages extracted per PDF: 50 pages (configurable ceiling).
  - Maximum text payload stored per paper: 200 KB preview / full text.
  - Large document parsing runs on `tokio::task::spawn_blocking` to prevent starving the async reactor thread pool.
- **LaTeX & Markdown Safety**:
  - Never execute arbitrary LaTeX shell commands or invoke external compilers with `-shell-escape`.
  - LaTeX parsing is purely structural and lexical.

---

## 5. Tauri IPC Capability Controls

Tauri v2 capabilities are defined in `src-tauri/capabilities/default.json`:
- Restricts window operations and file dialogs to legitimate application scopes.
- All IPC commands validate inputs, string lengths, and payload boundaries before processing.

