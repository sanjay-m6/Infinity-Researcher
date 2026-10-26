# Scraper Security, Sandbox Isolation & Privacy Specification

This specification outlines the security controls, SSRF mitigations, filesystem isolation, and secrets policies implemented in the Research Paper Scraper desktop application.

---

## 1. Anti-SSRF (Server-Side Request Forgery) Architecture

Untrusted URLs supplied as seed URLs, page links, or redirect locations pose significant SSRF and internal network scanning risks. The application enforces `UrlGuard` validation in the Rust backend before any network connection is opened:

### Strict Validation Rules
1. **Scheme Allowlist**: Only `http://` and `https://` schemes are accepted. All other schemes (`file:`, `javascript:`, `data:`, `blob:`, `ftp:`) are rejected immediately.
2. **Credential Stripping**: URLs containing embedded user info or credentials (e.g. `https://user:pass@host/`) are rejected.
3. **Private & Loopback Address Blocking**:
   - `127.0.0.0/8` (IPv4 Loopback)
   - `::1` (IPv6 Loopback)
   - `10.0.0.0/8` (Private RFC 1918)
   - `172.16.0.0/12` (Private RFC 1918)
   - `192.168.0.0/16` (Private RFC 1918)
   - `169.254.0.0/16` (Link-Local / Cloud Metadata Addresses like AWS `169.254.169.254`)
   - `224.0.0.0/4` (Multicast)
4. **Host Resolution & Redirect Re-Validation**: If a public URL redirects, the redirect destination is re-evaluated through `UrlGuard` prior to following the redirect.

---

## 2. Crawl Boundary & Scope Limits

To prevent runaway crawls or unauthorized cross-domain traversal:
- **Same-Origin Constraint**: By default, the crawler restricts link discovery to the origin host configured in the profile. Subdomains are treated as separate origins.
- **Path Pattern Filtering**: Profile `allowed_patterns` and `disallowed_patterns` regexes filter candidate URLs.
- **Max Depth Limit**: Bounded to a user-configured limit (default: 2, max: 5).
- **Max Pages Budget**: Bounded to a fixed session cap (default: 20, max: 200).
- **Polite Crawl Delay**: Enforces sequential requests with mandatory minimum delay (default: 1,000 ms, adjusted upwards if robots.txt specifies a longer delay).

---

## 3. Filesystem Safety & Path Traversal Prevention

Downloaded PDFs, temporary files, and exports are isolated from untrusted input:
1. **Canonical Identifier Paths**: Saved files use deterministic internal UUIDs (`data/papers/{paper_id}.pdf`). Raw filenames from HTTP `Content-Disposition` headers or website URL paths are NEVER used as filesystem paths.
2. **Atomic Writes**: Downloaded streams write to a dedicated temporary folder (`data/scratch/temp_{uuid}.part`) and are atomically moved to their destination only after verification.
3. **Magic-Byte Signature Verification**: All downloaded files must start with `%PDF-` bytes (`0x25, 0x50, 0x44, 0x46, 0x2D`). Any HTML payload masquerading as a PDF is rejected.
4. **Maximum Download Byte Limits**: Downloads are capped at 100 MB per file to prevent zip-bomb / disk-exhaustion attacks.

---

## 4. UI & DOM Sandboxing

- **No Remote JavaScript Execution**: The static HTML crawler uses Rust-based `scraper` and `html5ever` to parse HTML trees. Remote scripts are never executed in the scraper engine.
- **XSS Prevention in UI**: Extracted titles, author names, and abstracts are treated as untrusted text and rendered as sanitized text nodes in React. Dangerous HTML tags are stripped during normalization.
- **Isolated PDF Worker**: PDF rendering runs in a separate Web Worker thread (`pdf.worker.min.mjs`) without access to the host DOM or Tauri native IPC.

---

## 5. Secrets Redaction & Privacy

- **Local-First Storage**: All crawl state, paper metadata, and PDFs remain strictly on the user's local disk in SQLite. No telemetry or analytics are sent to external cloud servers.
- **Sensitive Data Redaction**: Loggers automatically redact API keys, authentication headers, and private query strings matching `token=`, `key=`, or `auth=` patterns.
- **Zero Credential Collection**: The application never prompts for, stores, or exports user passwords or private session cookies.
