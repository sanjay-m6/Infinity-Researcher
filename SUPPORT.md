# Infinity Researcher — Support & Diagnostics Guide

**Product Name:** Infinity Researcher  
**Developer Brand:** Infinity Web Technology  
**Author & Maintainer:** Sanjay  
**Repository:** [https://github.com/sanjay-m6/Infinity-Researcher](https://github.com/sanjay-m6/Infinity-Researcher)  

---

## 1. Support Channels

For bug reports, technical inquiries, and feature suggestions:

1. **In-App Feedback Center (Recommended):**
   - Open **Settings** in the application sidebar.
   - Click **"Report Bug / Feedback"** to launch the transparent sanitized issue generator.
   - Preview the scrubbed diagnostic details and submit directly to GitHub.
2. **GitHub Issues:**
   - [Submit an Issue](https://github.com/sanjay-m6/Infinity-Researcher/issues)
3. **GitHub Discussions:**
   - [Join the Community Discussions](https://github.com/sanjay-m6/Infinity-Researcher/discussions)

---

## 2. Generating a Diagnostic Support Report

When contacting support or filing a bug report regarding installation, updates, or licensing:

1. Navigate to **Settings** in Infinity Researcher.
2. Under the **"Software Licensing & Feature Entitlements"** card, click **"Diagnostic Report"**.
3. The report is instantly copied to your clipboard.
4. **Privacy Guarantee:** The diagnostic generator automatically redacts personal licensee names, customer email addresses, API provider keys, and research document titles.

### Example Redacted Output:
```text
================================================================
       INFINITY RESEARCHER — SUPPORT DIAGNOSTIC REPORT         
================================================================
Timestamp:        2026-10-27T02:15:00.000Z
Application:      Infinity Researcher v0.1.0
OS Target:        Windows 11 x64
Data Directory:   %APPDATA%\com.infinitywebtechnology.infinityresearcher
----------------------------------------------------------------
LICENSING STATUS:
  Active Tier:    COMMUNITY
  Status:         community_default
  Valid:          YES
----------------------------------------------------------------
ACTIVE ENTITLEMENTS:
  (Community feature set: local library, paper discovery, SQLite WAL)
================================================================
CONFIDENTIALITY: All secrets, private keys, API credentials, and
scholarly paper contents have been completely excluded or redacted.
================================================================
```

---

## 3. Data Directory & Safe Backup Locations

To create a manual backup of your research library and notes:

- **Windows:** Copy `%APPDATA%\com.infinitywebtechnology.infinityresearcher\infinity-researcher.sqlite3` to an external drive or backup storage.
- Upgrading or uninstalling Infinity Researcher preserves this database by default. Program binaries located in `%LOCALAPPDATA%\Programs\Infinity Researcher\` will be refreshed without altering your research data.
