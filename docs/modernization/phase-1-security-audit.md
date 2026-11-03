# Phase 1: Security and Privacy Audit

This audit examines the security boundaries, IPC capabilities, Content Security Policy (CSP), secret storage, and data privacy guarantees in **Infinity Researcher**.

---

## 1. Tauri 2 Capability and Permission Model

- **Configuration File**: `src-tauri/capabilities/default.json`
- **Identifier**: `default` (scoped strictly to the `main` window).
- **Active Permissions**:
  - `core:default`: Minimal required IPC invocation bridge.
  - `opener:default`: Safe external link opening via default system browser.
  - `updater:default`: Cryptographically signed software update verification.
  - `process:default`: Application exit and relaunch handling.
- **Evaluation**: The application avoids broad unrestricted permissions (e.g. `fs:allow-all` or `shell:allow-all`). File reads and writes are encapsulated strictly within Rust command handlers that validate paths against the user's local `app_data_dir`.

---

## 2. Content Security Policy (CSP) Analysis

The CSP is configured in `src-tauri/tauri.conf.json`:
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

### Security Properties:
1. **Script Execution Restriction**: `script-src 'self'` prevents injection of third-party remote scripts or malicious cross-site scripting (XSS) payloads.
2. **Frame & Object Lockdown**: `frame-src 'none'` and `object-src 'none'` block clickjacking, malicious iframe embeds, and Flash/ActiveX plugins.
3. **Network Boundary**: `connect-src 'self'` restricts client-side `fetch` or WebSocket requests from the webview context. All external academic API calls (Crossref, Semantic Scholar, IEEE) execute strictly within the Rust backend or Python engine, keeping network access audited and sanitized.

---

## 3. Secret Management & Credential Privacy

1. **Credential Masking Across IPC Boundary**:
   - In `src-tauri/src/commands/ai.rs`, any provider credential is automatically masked before returning to React:
     ```rust
     if p.credential_ref.is_some() {
         p.credential_ref = Some("••••••••••••••••".into());
     }
     ```
   - Plaintext API keys never exist in React state or browser DevTools memory dumps.
2. **Local Password Security**:
   - Passwords are never stored in plaintext. They are salted with 128-bit cryptographically secure entropy (`OsRng`) and hashed with Argon2id.
3. **OS Keyring Integration**:
   - Session tokens are stored in the Windows Credential Manager via the `keyring` crate rather than in local storage or unencrypted cookies.
4. **Zero-Telemetry Policy**:
   - Infinity Researcher has no tracking beacons, no analytics pixels, no Google Analytics, and no telemetry pings.
   - All research queries, downloaded PDFs, reading notes, and literature reviews remain exclusively on the user's local workstation.

---

## 4. UI Modernization Security Rules

1. **Never Relax CSP Directives**: Phase 2 and Phase 3 styling and animation additions must respect `script-src 'self'`.
2. **Never Expose Error Secrets**: Ensure error toast notifications display user-friendly diagnostic messages rather than raw database connection strings or filesystem paths.
3. **Preserve Path Sanitization**: Retain existing path validation on all PDF imports and export routines.

