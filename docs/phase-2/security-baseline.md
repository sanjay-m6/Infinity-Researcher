# Phase 2 Security Baseline & Threat Posture

**Project:** Research Paper Scraper  
**Phase:** Phase 2 — Architecture and Project Foundation  
**Status:** Approved & Implemented  
**Date:** 2026-10-24  

---

## 1. Security Baseline & Guiding Principles

The Phase 2 foundation establishes strict defense-in-depth boundaries designed to isolate the unprivileged presentation layer (React webview) from privileged OS-level operations.

### Core Security Axioms
1. **Sandboxed Presentation Layer:** The React webview is treated as an unprivileged presentation tier. It cannot execute OS shell commands, access arbitrary filesystem paths, or open raw network sockets.
2. **Explicit Capability Scoping:** Capabilities in `src-tauri/capabilities/default.json` declare only the minimum permissions required for the active window (`core:default`, `opener:default`). Wildcard permissions (`fs:all`, `shell:all`) are strictly prohibited.
3. **Strict Content Security Policy (CSP):** The webview environment enforces a restrictive CSP blocking inline scripts, unauthorized remote origins, and arbitrary frames.
4. **Untrusted Input at Boundary:** Every value passed from frontend to backend over IPC is treated as untrusted and validated at the Rust command boundary.
5. **No Credential Commits:** No API keys, credentials, or personal access tokens are committed or written to log files.

---

## 2. Configured Restrictions and Settings

### 2.1 Content Security Policy (`src-tauri/tauri.conf.json`)
The application window is configured with the following active CSP:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self';
frame-src 'none';
object-src 'none';
```

* **Script Execution:** Restricted strictly to `'self'`. External script tags (`<script src="https://...">`) and `eval()` are blocked.
* **Frame Navigation:** `frame-src 'none'` prevents untrusted third-party websites from being embedded inside the privileged desktop window.
* **Network Connections:** `connect-src 'self'` restricts frontend `fetch()` / `WebSocket` requests from the webview. All future academic network retrieval occurs exclusively in Rust.

### 2.2 Capability Definition (`src-tauri/capabilities/default.json`)
The capability scope is strictly narrowed to:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```
* `core:default`: Permits basic Tauri window lifecycle events.
* `opener:default`: Allows invoking default OS browsers for validated HTTPS landing page links.
* **Omitted Permissions:** No filesystem (`fs`), child process (`shell`), or clipboard permissions are granted to the webview.

### 2.3 Logging Redaction (`src-tauri/src/logging/mod.rs`)
The logging subsystem uses `tracing-subscriber` with active redaction:
* Scans message strings for `Bearer <token>` patterns and replaces values with `[REDACTED_TOKEN]`.
* Scans query parameters and headers for `api_key=`, `x-api-key:`, `apikey=` and replaces values with `[REDACTED_KEY]`.
* Prevents sensitive user credentials or tokens from being committed to diagnostic logs.

---

## 3. Threat Matrix & Residual Risks

| Threat Category | Implemented Mitigation | Residual Risk / Forward-Looking Task | Phase Milestone |
| :--- | :--- | :--- | :--- |
| **XSS via Untrusted Metadata** | React JSX auto-escaping; strict CSP (`script-src 'self'`). | Rendered markdown abstracts in Phase 8 must use DOMPurify or sanitize-html. | Phase 8 |
| **Path Traversal** | Document directory validated via `AppConfig::validate()`; relative paths enforced. | Future file download writer must sanitize filenames against traversal patterns. | Phase 7 |
| **Server-Side Request Forgery (SSRF)** | Connect-src locked to `'self'`; no raw webview fetching. | Pre-connection DNS IP check must be implemented in the Rust HTTP client before API queries. | Phase 5 |
| **Credential Leakage** | `redact_sensitive_string` in logging module; `.gitignore` ignores `.env*`. | Integration with OS secure credential store for optional partner API keys. | Phase 4 |
