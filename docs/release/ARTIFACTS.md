# Release Artifacts Inventory & Checksums

**Project:** Research Paper Scraper  
**Release Version:** 0.1.0  
**Target Platform:** Windows x86_64 (`x86_64-pc-windows-msvc`)  
**Generated Date:** 2026-10-24  
**Build Tool:** Tauri 2 CLI (`@tauri-apps/cli` v2.12.4), Rust 1.99.1, MSVC Build Tools  

---

## 1. Verified Release Artifacts

| Artifact Name | Target Platform / Arch | Package Format | File Size | SHA-256 Checksum | Signing Status | Launch / Test Status |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **`Research Paper Scraper_0.1.0_x64_en-US.msi`** | Windows 10/11 x86_64 | Windows Installer (MSI) | **5,779,456 bytes** (5.51 MiB) | `BCA8C0CD11EDA000FA7494B1F4BDDFF47DEC015F50CA8F3BF770D58E0E0A78CA` | Not Signed (Validation Release) | **Passed** |
| **`research-paper-scraper.exe`** | Windows 10/11 x86_64 | Standalone PE Executable | **12,243,968 bytes** (11.68 MiB) | `40069F79E0ADFC038B155C0A2506B29CE3E4F2E88B1A439F8A02825B2C66D433` | Not Signed (Validation Release) | **Passed** |

---

## 2. Artifact Details & Build Provenance

### Artifact 1: Windows Installer (MSI)
* **File Path:** `src-tauri/target/release/bundle/msi/Research Paper Scraper_0.1.0_x64_en-US.msi`
* **Build Command:** `npx tauri build --bundles msi`
* **Bundler Engine:** WiX Toolset v3.11 (`candle.exe`, `light.exe`)
* **Components Bundled:**
  * Native x86_64 Rust application binary (`research-paper-scraper.exe`)
  * Production webview assets (`dist/index.html`, CSS, optimized JS chunks)
  * Multi-resolution application icons (`icon.ico`)
* **SHA-256:**
  ```text
  BCA8C0CD11EDA000FA7494B1F4BDDFF47DEC015F50CA8F3BF770D58E0E0A78CA
  ```

### Artifact 2: Standalone Production Binary
* **File Path:** `src-tauri/target/release/research-paper-scraper.exe`
* **Build Command:** `cargo build --release` (invoked via Tauri build runner)
* **Optimization Profile:** LTO (Link-Time Optimization) enabled, `opt-level = 3`, `codegen-units = 1`, symbols stripped
* **SHA-256:**
  ```text
  40069F79E0ADFC038B155C0A2506B29CE3E4F2E88B1A439F8A02825B2C66D433
  ```

---

## 3. Checksum Verification Procedure

Users and release maintainers can verify file integrity using PowerShell:
```powershell
Get-FileHash -Algorithm SHA256 "Research Paper Scraper_0.1.0_x64_en-US.msi"
Get-FileHash -Algorithm SHA256 "research-paper-scraper.exe"
```
Or with standard GNU `sha256sum`:
```bash
sha256sum -c <<EOF
BCA8C0CD11EDA000FA7494B1F4BDDFF47DEC015F50CA8F3BF770D58E0E0A78CA  Research Paper Scraper_0.1.0_x64_en-US.msi
40069F79E0ADFC038B155C0A2506B29CE3E4F2E88B1A439F8A02825B2C66D433  research-paper-scraper.exe
EOF
```
