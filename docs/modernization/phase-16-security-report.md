# Phase 16: Security & Safety Verification Report

## 1. Threat Analysis & Mitigations

### 1.1 Server-Side Request Forgery (SSRF)
- **Threat**: Malicious URLs or HTTP 3xx redirects pointing to `localhost`, `127.0.0.1`, `169.254.169.254`, or private subnet ranges (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`).
- **Mitigation**: Every download URL is validated through `UrlGuard::validate_url`. Furthermore, the `reqwest::Client` redirect policy uses a custom inspector that re-evaluates `UrlGuard` on every redirect hop, blocking redirect chains to unauthorized private endpoints.

### 1.2 Path Traversal & Unsafe Filenames
- **Threat**: Remote servers sending HTTP `Content-Disposition` headers containing `../../etc/passwd` or malicious executable extensions (`.exe`, `.bat`).
- **Mitigation**: Infinity Researcher **never** uses server-supplied filenames directly on disk. All files are strictly assigned canonical UUID/paper IDs formatted as `<storage_dir>/<paper_id>.pdf`.

### 1.3 Zip / PDF Bombs & Resource Exhaustion
- **Threat**: Malicious URLs streaming infinite byte loops designed to consume user disk space.
- **Mitigation**: `MAX_ALLOWED_PDF_BYTES` is enforced both before transfer (via `Content-Length`) and during streaming (terminating immediately if downloaded bytes exceed 100 MB).

### 1.4 HTML Masquerading & Phishing Ingestion
- **Threat**: Remote paywalls serving HTML login forms disguised with `.pdf` file extensions.
- **Mitigation**: First chunk inspects magic bytes `%PDF-`. Files with `<!DOCTYPE`, `<html`, or `<head` are immediately rejected with `html_paywall` error category.

