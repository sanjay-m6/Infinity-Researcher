# Security Review: Anti-SSRF, Safe Filesystem, & Network Isolation

## 1. Threat Modeling & Attack Surface

Desktop research tools that fetch remote URLs based on external metadata must protect against multiple vulnerability classes:
1. **Server-Side Request Forgery (SSRF) / Client-Side LAN Pivoting**: Malicious or manipulated metadata pointing to `http://127.0.0.1:8080/admin` or `http://169.254.169.254/latest/meta-data/` to probe user local services.
2. **Directory Traversal / Arbitrary File Overwrite**: Malicious paper identifiers or filenames such as `../../../../Windows/System32/evil.dll` or `..\..\..\AppData\Roaming\calc.exe`.
3. **Malicious PDF Payloads / Parser Exploitation**: Corrupt, malformed, or hostile PDF streams designed to trigger memory corruption in PDF parsers.
4. **Credential Leakage**: Forwarding institutional cookies or API keys to unvetted third-party mirrors during HTTP redirects.

---

## 2. Implemented Defense Controls

### 2.1 Strict Anti-SSRF Protection (`UrlGuard`)
Every candidate URL is validated before socket connection:
```rust
pub fn validate_url(raw_url: &str) -> Result<url::Url, UrlGuardError> {
    let parsed = url::Url::parse(raw_url)?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err(UrlGuardError::InvalidScheme);
    }
    if let Some(host) = parsed.host_str() {
        let lower = host.to_lowercase();
        // Block localhost and loopback
        if lower == "localhost" || lower.starts_with("127.") || lower == "::1" {
            return Err(UrlGuardError::BlockedHost("Loopback forbidden"));
        }
        // Block private IP ranges
        if lower.starts_with("10.") || lower.starts_with("192.168.") || lower.starts_with("169.254.") {
            return Err(UrlGuardError::BlockedHost("Private network forbidden"));
        }
    }
    Ok(parsed)
}
```

### 2.2 Redirect Sanitization
- `reqwest::redirect::Policy::custom`:
  - Enforces a strict limit of 5 hops.
  - Re-validates every redirect destination with `UrlGuard::validate_url`.
  - Drops authorization headers and cookies when crossing host boundaries.

### 2.3 Filesystem Confinement & Safe Filenames
- Files are saved exclusively within the user's sandboxed local data directory (`storage_dir`).
- Target filenames use UUIDs or sanitized alphanumeric IDs:
  `{storage_dir}/{paper_id}.pdf`
- Any path containing separators (`/`, `\`) or `..` is rejected by path sanitization routines.
- In-flight transfers write exclusively to `.tmp_{job_id}.part`.

### 2.4 Structural Memory Safety
- PDF parsing is implemented in Rust using `lopdf`, which operates in safe memory without native C buffer overflows.
- Full text and object parsing ceilings prevent resource exhaustion:
  - `MAX_PAGES_TO_EXTRACT = 50`
  - `MAX_FULL_TEXT_BYTES = 200 * 1024` (200 KB)
  - `MAX_ALLOWED_PDF_BYTES = 100 * 1024 * 1024` (100 MB max file size)

