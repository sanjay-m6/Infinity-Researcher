# Release Engineering & Build Guide

**Project:** Research Paper Scraper  
**Document:** Standard Operating Procedure for Desktop Releases  
**Author:** Release Engineering Lead  
**Version:** 0.1.0  

---

## 1. Prerequisites & Build Toolchain

To build the Research Paper Scraper release bundle from source:

1. **Rust Stable Toolchain:** `rustc 1.85+` with Cargo (`stable-x86_64-pc-windows-msvc`).
2. **Node.js:** `v22+` or `v24+` with `npm 11+`.
3. **Microsoft C++ Build Tools:** Visual Studio Build Tools 2022 (or MSVC v143+).
4. **WebView2 SDK:** Pre-installed on Windows 10/11.
5. **WiX Toolset (for MSI Bundles):** WiX v3.11+ with `candle.exe` and `light.exe` available in PATH.

---

## 2. Local Build & Packaging Procedure

### Step 1: Install Locked Dependencies
```powershell
npm ci
```

### Step 2: Execute Full Verification Suite
```powershell
# Frontend lint, types, and unit tests
npm run typecheck
npm run lint
npm run test

# Rust formatting, static analysis, and full test suite
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cd ..
```

### Step 3: Compile Production Desktop Bundle
```powershell
# Builds frontend assets and produces the release MSI package
npx tauri build --bundles msi
```

### Step 4: Locate Output Artifacts
The compiled artifacts will be located at:
* **Standalone Binary:** `src-tauri/target/release/research-paper-scraper.exe`
* **Windows Installer:** `src-tauri/target/release/bundle/msi/Research Paper Scraper_0.1.0_x64_en-US.msi`

---

## 3. Checksum Generation & Integrity Verification

To generate SHA-256 integrity checksums for generated packages:
```powershell
Get-FileHash -Algorithm SHA256 "src-tauri/target/release/bundle/msi/*.msi" | Format-List
Get-FileHash -Algorithm SHA256 "src-tauri/target/release/research-paper-scraper.exe" | Format-List
```

---

## 4. Code Signing Configuration (Production Maintainers)

For production deployment with Microsoft SmartScreen trust:
1. Obtain an Authenticode / EV Code Signing certificate (`.pfx` file or Hardware Security Module).
2. Store the certificate thumbprint or environment credentials in GitHub Actions Secrets (`SIGNING_CERT_THUMBPRINT`, `SIGNING_PASSWORD`).
3. Set the signing parameters in `tauri.conf.json`:
```json
"bundle": {
  "windows": {
    "certificateThumbprint": "{{ env.SIGNING_CERT_THUMBPRINT }}",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```
*Never commit `.pfx` certificates or passwords to version control.*

---

## 5. Release Tagging & GitHub Automation

When initiating an official release:
1. Ensure `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` share the identical version string (e.g., `0.1.0`).
2. Commit the version bump and push tag `v0.1.0`:
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```
3. The automated GitHub Actions workflow [.github/workflows/release.yml](file:///d:/Paper/.github/workflows/release.yml) executes the build matrix, verifies checksums, and publishes a draft GitHub release with attached MSI and executable artifacts.

---

## 6. Rollback Guidance

If a critical defect is discovered post-release:
1. Mark the GitHub release as *Pre-release* or remove the downloadable binary.
2. Publish an advisory note in [CHANGELOG.md](file:///d:/Paper/CHANGELOG.md).
3. Prepare a patch release (e.g., `v0.1.1`) applying the targeted hotfix, verify migration compatibility, and publish the update.
