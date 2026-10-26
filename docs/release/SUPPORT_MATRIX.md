# Platform Support & Distribution Matrix

**Project:** Research Paper Scraper  
**Document:** Platform Support Matrix & Target Compatibility Specification  
**Version:** 0.1.0  
**Last Updated:** 2026-10-24  

---

## 1. Operating System Compatibility Matrix

| Operating System | Target Architecture | Package Format | Build Status | Install Test | Launch Test | Data Preservation | Code Signing Status | Support Tier |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Windows 11 (64-bit)** | `x86_64-pc-windows-msvc` | `.msi` (MSI Installer) | **Passed** | **Passed** | **Passed** | **Passed** | Not Signed (Validation Build) | **Tier 1 (Supported)** |
| **Windows 11 (64-bit)** | `x86_64-pc-windows-msvc` | `.exe` (Standalone Binary) | **Passed** | N/A (Portable) | **Passed** | **Passed** | Not Signed (Validation Build) | **Tier 1 (Supported)** |
| **Windows 10 (64-bit)** | `x86_64-pc-windows-msvc` | `.msi` (MSI Installer) | Compatible | Compatible | Compatible | Compatible | Not Signed (Validation Build) | **Tier 1 (Supported)** |
| **macOS (Apple Silicon)** | `aarch64-apple-darwin` | `.dmg` / `.app` | Not Tested | Not Tested | Not Tested | Not Tested | Pending Developer ID | Tier 2 (Pending CI Runner) |
| **macOS (Intel x86_64)** | `x86_64-apple-darwin` | `.dmg` / `.app` | Not Tested | Not Tested | Not Tested | Not Tested | Pending Developer ID | Tier 2 (Pending CI Runner) |
| **Linux (Ubuntu/Debian)** | `x86_64-unknown-linux-gnu` | `.deb` / `.AppImage` | Not Tested | Not Tested | Not Tested | Not Tested | Unsigned GPG | Tier 2 (Pending CI Runner) |

---

## 2. Hardware & Runtime Prerequisites

### Windows Platform (Tier 1)
* **Operating System:** Windows 10 (Build 19041 or higher) or Windows 11 (64-bit).
* **WebView Runtime:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 10/11; standard component).
* **Architecture:** x86_64 (64-bit Intel or AMD).
* **RAM:** Minimum 2 GB RAM; Recommended 4 GB RAM.
* **Disk Space:** 50 MB for application installation; additional disk space for stored research PDFs and SQLite index.

---

## 3. Disclosed Limitations & Security Guidance

1. **Windows SmartScreen Prompt (Unsigned Build):**
   * *Status:* The validation release is not signed with an EV Code Signing certificate. Windows Defender SmartScreen may display an *"Unknown Publisher"* warning.
   * *Resolution for Evaluators:* Click *"More info"* and select *"Run anyway"*. For public production releases, a trusted commercial code-signing certificate and timestamping authority must be configured.
2. **Offline vs. Online Capability:**
   * All local research library features (viewing imported papers, searching full text via FTS5, managing notes, organizing collections, and exporting citations) function **100% offline**.
   * Discovering new papers via academic sources (arXiv, Crossref, Semantic Scholar, etc.) and crawling publisher sites require an active internet connection.
