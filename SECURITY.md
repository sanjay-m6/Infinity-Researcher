# Security Policy & Vulnerability Disclosure

**Product Name:** Infinity Researcher  
**Maintained By:** Sanjay (Infinity Web Technology)  
**Repository:** [https://github.com/sanjay-m6/Infinity-Researcher](https://github.com/sanjay-m6/Infinity-Researcher)  

---

## 1. Supported Versions

We actively provide security updates and patches for the following versions:

| Version | Supported |
| :--- | :--- |
| `0.1.x` (Latest) | :white_check_mark: Yes |
| `< 0.1.0` | :x: No |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or potential threat in Infinity Researcher:

1. **Do NOT open a public issue.**
2. Submit a confidential report via **GitHub Private Vulnerability Reporting**:
   - Go to [Infinity Researcher Security Advisories](https://github.com/sanjay-m6/Infinity-Researcher/security/advisories).
   - Click **"Report a vulnerability"**.
3. Include:
   - Detailed description of the potential vulnerability.
   - Proof of concept (PoC) or reproduction steps.
   - Affected platform (e.g., Windows 10/11 x64).
   - Impact assessment on local user data, SQLite storage, or IPC boundaries.

---

## 3. Vulnerability Response Timeline

- **Initial Acknowledgment:** Within 48 hours of receipt.
- **Triage & Remediation Plan:** Within 7 business days.
- **Signed Hotfix Delivery:** Shipped through signed releases and the in-app automatic updater with Minisign Ed25519 verification.

---

## 4. Security Principles & Architecture

- **Narrow IPC Surface:** The React frontend communicates strictly with pre-registered, strongly typed Rust commands with parameter sanitization.
- **Anti-SSRF URL Guards:** All scholarly web scraper requests pass through strict domain whitelist matching, credential rejection, loopback blocking, and private IPv4/IPv6 address protection.
- **Separation of Concerns:** Application binaries are installed to per-user program locations, while user data (SQLite database, paper PDFs, custom notes) is isolated in `%APPDATA%\com.infinitywebtechnology.infinityresearcher\`.
- **Zero Hardcoded Secrets:** No private signing keys, Minisign secret keys, or cloud provider tokens exist in the repository or compiled frontend code.
