# Security and Privacy Risk Register

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Document Status:** Complete & Enforceable  
**Security Standard:** Principle of Least Privilege, Zero Trust for External Content, Threat Modeling (STRIDE)  

---

## 1. Threat Landscape & Security Posture

As a desktop application that interacts with external academic websites, downloads untrusted binary documents (PDFs), processes untrusted text strings, and stores user notes locally, **Research Paper Scraper** must enforce strict security boundaries. 

The primary security axioms are:
1. **The Webview is Sandboxed:** The React frontend runs in an unprivileged webview context with a strict Content Security Policy. It cannot directly read files, spawn OS processes, or bind sockets.
2. **All External Data is Untrusted:** Web pages, PDF files, HTTP headers, redirects, and search abstracts are treated as potentially hostile input.
3. **SSRF Guard:** Outbound HTTP requests are blocked from reaching private local networks, loopback interfaces, or cloud metadata endpoints.
4. **Local Sovereignty & Privacy:** User bibliographies, notes, and PDF documents are strictly private and never transmitted to any telemetry or cloud server.

---

## 2. Comprehensive Security & Privacy Risk Register

| Risk ID | Threat Scenario | Likelihood | Impact | Severity | Mitigation Strategy | Implementation Phase | Verification Test ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | **Server-Side Request Forgery (SSRF)**<br>A malicious or spoofed paper URL redirects the client to internal network services (`http://127.0.0.1`, `http://192.168.1.1`, or `http://169.254.169.254`). | Medium | Critical | **High** | Pre-connection DNS interception and validation. Reject private RFC 1918 IPs, loopbacks, link-local, and non-HTTPS schemes. Re-validate every redirect target before following. | Phase 2 & 5 | `TEST-SEC-001` |
| **SEC-002** | **Arbitrary File Write / Path Traversal**<br>Upstream paper metadata contains path traversal characters (`../../Windows/System32/evil.dll`) in filenames or titles. | Medium | Critical | **High** | Sanitization and deterministic slugification of filenames (`[A-Za-z0-9_-]`). Files strictly written to managed directory; verify canonical path is child of library root. | Phase 4 & 7 | `TEST-SEC-002` |
| **SEC-003** | **HTML/JavaScript Injection via Metadata (XSS)**<br>An academic paper abstract or title contains malicious `<script>` tags, rendered unescaped in the React webview. | High | High | **High** | React JSX automatic string escaping; strict Content Security Policy (CSP) blocking inline scripts; Markdown renderer sanitizes HTML via DOMPurify before display. | Phase 2 & 3 | `TEST-SEC-003` |
| **SEC-004** | **HTML Error Page Masquerading as PDF**<br>A subscription paywall or 403 Forbidden page returns an HTML document disguised with a `.pdf` extension or filename. | High | Medium | **Medium** | Inspect first 4 bytes of stream for `%PDF-` magic header (`0x25 0x50 0x44 0x46 0x2D`). Abort and purge `.tmp` file immediately if signature does not match. | Phase 7 | `TEST-SEC-004` |
| **SEC-005** | **Resource Exhaustion / Decompression Bomb**<br>An attacker or server returns a multi-gigabyte stream or infinite gzip stream designed to exhaust memory and disk. | Low | High | **Medium** | Enforce strict file size ceiling (default 100 MB). Stream directly to disk in 16KB chunks; terminate stream if bytes exceed limit. Max 10MB payload cap on API JSON responses. | Phase 5 & 7 | `TEST-SEC-005` |
| **SEC-006** | **Credential Exposure in Logs & Diagnostics**<br>Optional API keys (e.g. Semantic Scholar, OpenAlex) or user contact emails are dumped into unencrypted log files or crash reports. | Medium | High | **High** | Regex scrubber in structured logging layer (`tracing`). Redact `api_key`, `Authorization`, `x-api-key`, and query params before writing to disk. | Phase 2 | `TEST-SEC-006` |
| **SEC-007** | **Insecure API Key Storage**<br>User's optional partner API keys are stored in plaintext configuration files accessible to other local processes. | Medium | Medium | **Medium** | Store optional keys using operating system secure credential vaults (Windows Credential Manager / DPAPI) where supported, or obfuscated in restricted user config. | Phase 4 | `TEST-SEC-007` |
| **SEC-008** | **Request Storms / Upstream IP Banning**<br>A tight loop or unthrottled concurrent search floods arXiv or Crossref, triggering an automated permanent IP block. | High | High | **High** | Hardcoded token bucket rate limiters per host in Rust; minimum 3,000ms delay for arXiv; circuit breaker trips after 3 consecutive 429/403 responses. | Phase 5 & 6 | `TEST-SEC-008` |
| **SEC-009** | **Tauri Capability Over-Privilege**<br>Webview granted broad `fs:all` or `shell:all` permissions, allowing compromised dependencies to execute arbitrary OS commands. | Low | Critical | **High** | Enforce Tauri 2 scoped capabilities. Frontend can only call explicitly enumerated custom commands. Core filesystem APIs are inaccessible from JavaScript. | Phase 2 | `TEST-SEC-009` |
| **SEC-010** | **Database / Storage Inconsistency on Crash**<br>Power outage or sudden application kill during download leaves partial `.tmp` files or orphaned database records. | High | Medium | **Medium** | Downloads write to isolated `.tmp` files, moved atomically on completion. SQLite operates in WAL mode with transactions. Startup recovery scans and cleans orphaned `.tmp` files. | Phase 4 & 7 | `TEST-SEC-010` |
| **SEC-011** | **Researcher Privacy Leakage**<br>User's search queries, private research notes, or imported library contents are leaked to external servers. | Medium | High | **High** | Local-first design: Zero telemetry or analytics pings. Outbound network requests only go to user-selected academic sources for public search queries. Local search runs entirely in SQLite FTS5. | Phase 2 & 8 | `TEST-SEC-011` |
| **SEC-012** | **PDF Parser Vulnerability / Memory Corruption**<br>A malformed PDF exploits a memory buffer overflow in the text extraction library. | Low | High | **Medium** | Use safe Rust PDF parsing libraries (`lopdf`, `pdf-extract`). Run text extraction in a bounded worker thread with strict timeouts and memory isolation. | Phase 7 | `TEST-SEC-012` |

---

## 3. Verification Test Specifications

The following automated and simulated security tests will be implemented during the respective engineering phases:

### `TEST-SEC-001`: SSRF Protection Verification
* **Objective:** Assert that `reqwest` client aborts requests to forbidden addresses.
* **Test Case:** Pass `http://127.0.0.1:8080`, `http://169.254.169.254`, and `http://localhost/test`.
* **Expected Result:** Client returns `Err(SecurityError::SsrfBlocked)`. No TCP handshake initiated.

### `TEST-SEC-002`: Path Traversal Sanitization
* **Objective:** Assert that title `../../etc/passwd` or `..\..\Windows\System32` cannot escape library root.
* **Test Case:** Pass malicious paper title to `sanitize_filename`.
* **Expected Result:** Output string is sanitized to `etc_passwd.pdf`; canonical path resides within `storage_config.library_dir`.

### `TEST-SEC-003`: XSS Injection Prevention
* **Objective:** Verify that paper abstract containing `<img src=x onerror=alert(1)>` renders safely.
* **Test Case:** Mount paper card with malicious abstract in UI test suite.
* **Expected Result:** Abstract renders as plain escaped text; no JavaScript alert is executed; DOM contains no unescaped script nodes.

### `TEST-SEC-004`: Non-PDF Header Rejection
* **Objective:** Verify that an HTML 403 page is never saved as a `.pdf`.
* **Test Case:** Stream HTTP response with headers `Content-Type: application/pdf` but body `<!DOCTYPE html><html><body>Forbidden</body></html>`.
* **Expected Result:** Stream aborts at byte 4; `.tmp` file is deleted; error returned: `InvalidFileSignature`.

### `TEST-SEC-006`: Credential Redaction in Logs
* **Objective:** Verify that API keys do not leak into `tracing` log files.
* **Test Case:** Invoke API client with `x-api-key: secret_12345`; inspect log buffer.
* **Expected Result:** Log output contains `x-api-key: [REDACTED]`.
