# PDF URL Validation & Structural Integrity Checking

## 1. Network & Security Pre-Validation

Before initiating network connections to candidate URLs, Infinity Researcher enforces security checks via `UrlGuard` and `CandidateVerifier`:
1. **URL Syntax & Scheme**: Only `https://` and `http://` schemes are permitted. Malformed URLs are immediately rejected.
2. **Anti-SSRF Host Restrictions**:
   - Private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are blocked.
   - Loopback destinations (`127.0.0.1`, `localhost`) are blocked.
   - Cloud metadata IP addresses (`169.254.169.254`) are blocked.
3. **Redirect Loop Tracking**: Follows up to a maximum of 5 redirects. If a cycle is detected or destination redirects to a private host, the chain is aborted.

---

## 2. Header & Content-Type Inspection

Web servers often respond with HTTP 200 while serving an HTML login page or CAPTCHA challenge:
- `Content-Type: application/pdf` or `application/octet-stream` is expected.
- If `Content-Type: text/html` is returned:
  - The URL is identified as a landing page or paywall, not a PDF stream.
  - The response body is analyzed for login forms (`<input type="password">`, `recaptcha`, `cf-turnstile`, `institutional login`).
  - The candidate is rejected from direct download and tagged as `LandingPageOnly` or `AccessRestricted`.

---

## 3. Remote Magic Byte Inspection

To avoid downloading multi-megabyte HTML error pages, `CandidateVerifier` probes the remote candidate URL:
- Requests the first 4,096 bytes (4KB) via HTTP range request (`Range: bytes=0-4095`) or bounded stream read.
- Searches for `%PDF-` signature within the first 1,024 bytes.
- Allows for UTF-8 Byte Order Marks (`\xef\xbb\xbf`), UTF-16 BOMs, whitespace, and PDF comment lines (`%...`).
- Strictly rejects any file where `<html`, `<!doctype`, or `<head` precedes the `%PDF-` signature.

---

## 4. Local Structural Integrity Verification

Once streamed to disk as `.tmp_{job_id}.part`, the file is parsed by `PdfProcessor`:
1. **Minimum File Size**: Must be at least 1,024 bytes. Files under 1KB are rejected as corrupt or truncated.
2. **Structural Load**: Parsed via `lopdf::Document::load`. Ensures cross-reference tables (`xref`), trailer dictionaries, and object streams are intact.
3. **Encryption Detection**: Checks `doc.is_encrypted()`. If password encryption is present, flagged as `encrypted_pdf`.
4. **Page Count & Stream Check**: Confirms `page_count > 0` and verifies page object references.

