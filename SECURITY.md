# SECURITY POLICY

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author & Creator:** Sanjay  
**Publisher & Developer Brand:** Infinity Web Technology  
**Copyright:** © 2026 Sanjay. All rights reserved.  

---

## 1. Supported Versions

Security updates and patches are actively maintained for the following versions of Infinity Researcher:

| Version | Supported          | Release Status |
| ------- | ------------------ | -------------- |
| 1.0.x   | :white_check_mark: | Current Stable |
| < 1.0.0 | :x:                | Deprecated     |

---

## 2. Security Architecture & Threat Model

Infinity Researcher is engineered with defense-in-depth principles designed specifically for desktop research environments:

### Local-First Process Isolation
- **No Remote Network Listeners:** Infinity Researcher does not open unauthenticated inbound TCP/UDP ports or background web servers.
- **Tauri IPC Sandbox:** Frontend React operations communicate strictly with the Rust core via strongly-typed Tauri v2 IPC commands (`#[tauri::command]`).
- **Child Engine Sandboxing:** Python scraper and worker sidecars communicate exclusively over standard I/O (stdin/stdout) via JSON-RPC protocol messages. They are spawned as unprivileged child processes bound to the parent PID lifetime.
- **Path Traversal Guards:** File paths for PDF storage and database exports are sanitized with canonicalization checks to prevent directory traversal (`..`) attacks.

### Secret & Key Management
- **Local SQLite Storage:** Third-party AI credentials (e.g. OpenAI, Anthropic, Gemini API keys) are stored locally in the user's private SQLite database.
- **Multi-Stage Diagnostic Redaction:** When exporting logs or submitting bug reports, an automated redactor sanitizes GitHub tokens, API keys, Bearer headers, local Windows user profile paths (`C:\Users\<user>`), and emails before transmission.
- **Zero Third-Party Relays:** GitHub Issue submissions communicate directly with `https://api.github.com` without intermediary telemetry servers.

---

## 3. Reporting a Vulnerability

We appreciate the responsible disclosure of security vulnerabilities by security researchers, academics, and users.

If you believe you have discovered a security vulnerability in Infinity Researcher:

1. **DO NOT** create a public GitHub issue.
2. Please report the issue privately by emailing the maintainer:
   - **Recipient:** Sanjay / Infinity Web Technology
   - **Subject Line:** `[SECURITY] Infinity Researcher Vulnerability Report`
   - **Repository Security Advisory:** [GitHub Private Vulnerability Reporting](https://github.com/sanjay-m6/Infinity-Researcher/security/advisories)
3. Please include in your report:
   - A detailed description of the vulnerability.
   - Exact steps or proof-of-concept (PoC) code to reproduce the issue.
   - Potential impact, attack vector, and affected components (Rust core, Tauri IPC, Python engine, or React frontend).
   - Recommended remediation or mitigation if known.

---

## 4. Vulnerability Response Timeline

- **Initial Response:** Within 48 hours acknowledging receipt of your report.
- **Assessment & Triaging:** Within 5 business days confirming reproduction and severity evaluation.
- **Remediation & Patch:** Security patches will be issued via hotfix releases on GitHub Releases with signed installers and automatic updater feeds.
- **Public Disclosure:** Coordinated disclosure will occur following the release of the patch or after 90 days from the initial report.
