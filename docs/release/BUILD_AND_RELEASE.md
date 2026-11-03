# Infinity Researcher — Production Build, Packaging & Release Guide

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author / Creator:** Sanjay  
**Publisher / Company:** Infinity Web Technology  
**Framework:** Tauri 2 (Rust) + React 19 + TypeScript + Vite + SQLite (WAL Mode, FTS5) + Bundled Python Sidecar  
**Primary Target:** Windows 10/11 x64 (NSIS per-user installer primary, WiX MSI optional)  
**Bundle Identifier:** `com.infinitywebtechnology.infinityresearcher`  

---

## 1. Prerequisites & Toolchain Setup

To produce clean, deterministic production release artifacts on Windows 10/11 x64:

| Component | Minimum Version | Verified Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | `v20.18.0+` | Frontend bundling & release tooling |
| **Rust / Cargo** | `>= 1.77.0` | `1.85.0+` (MSVC) | Native desktop shell & IPC backend |
| **Python** | `>= 3.10.0` | `3.14.3` | Sidecar development & PyInstaller compilation |
| **PyInstaller** | `>= 6.0.0` | `6.22.3` | Standalone sidecar binary compilation |
| **NSIS** | `>= 3.0` | `3.x` | Production `-setup.exe` generation |
| **WiX Toolset** | `>= 3.11` | Optional | Enterprise MSI packaging |

---

## 2. Directory & Storage Architecture

Infinity Researcher strictly adheres to clean storage separation between read-only application binaries and mutable user research libraries:

| Content Type | Location (Windows) | Lifecycle / Upgrade Behavior |
| :--- | :--- | :--- |
| **Program Binaries** | `%LOCALAPPDATA%\Programs\Infinity Researcher\` | Overwritten/updated on new release; deleted on uninstall. |
| **SQLite Database** | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\infinity-researcher.sqlite3` | **Preserved indefinitely**; never deleted during upgrade or default uninstall. |
| **Automatic Backups** | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\backups\` | Timestamped `.sqlite3.bak` snapshots taken before every database migration. |
| **Downloaded PDFs** | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\pdfs\` | Stored locally; preserved across updates. |
| **Offline License** | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\license.json` | Stores signed Ed25519 offline license payload; preserved. |
| **Application Logs** | `%APPDATA%\com.infinitywebtechnology.infinityresearcher\logs\` | Rotated, privacy-sanitized diagnostic logs. |

---

## 3. Developer & Quality Gate Commands

Run the full local quality gate suite before any release build:

```bash
# 1. Zero-leak secret and credential audit
npm run audit:secrets

# 2. Version synchronization check (Cargo.toml, package.json, tauri.conf.json)
npm run version:check

# 3. TypeScript typecheck
npm run typecheck

# 4. ESLint static analysis
npm run lint

# 5. Vitest frontend & licensing unit tests (114 tests)
npm run test

# 6. Rust native backend unit & integration tests (98 tests)
cargo test --manifest-path src-tauri/Cargo.toml

# 7. Python scraping engine pytest suite (65 tests)
python -m pytest python-engine/tests

# 8. All-in-one quality gate runner
npm run check:all
```

---

## 4. Building the Standalone Python Sidecar Binary

Infinity Researcher bundles the Python Scrapy/HTTPX discovery engine into a standalone Windows executable (`paper-scraper-x86_64-pc-windows-msvc.exe`) so end-users **never need Python, pip, or development toolchains installed**:

```bash
# Compile the standalone sidecar into src-tauri/binaries/
python scripts/build-python-sidecar.py
```

- **Output:** `src-tauri/binaries/paper-scraper-x86_64-pc-windows-msvc.exe` (~217 MB)
- **Tauri Integration:** Declared under `bundle.externalBin` in `src-tauri/tauri.conf.json`.

---

## 5. Software Bill of Materials (SBOM) & License Audit

Generate production CycloneDX 1.5 JSON SBOM and Markdown audit reports:

```bash
npm run sbom:generate
```

- **Outputs:**
  - `dist/sbom-cyclonedx.json`: Machine-readable CycloneDX specification.
  - `docs/release/DEPENDENCY_LICENSE_AUDIT.md`: Human-readable SPDX audit covering all 39 npm, Cargo, and Python dependencies.

---

## 6. Building the Windows Production Installer

To produce the official NSIS per-user installer:

```bash
# Ensure frontend is built and sidecar is compiled
npm run build
python scripts/build-python-sidecar.py

# Build production Windows bundles
npm run tauri build
```

- **NSIS Installer:** `src-tauri/target/release/bundle/nsis/Infinity Researcher_0.1.0_x64-setup.exe`
- **WiX MSI (if WiX is installed):** `src-tauri/target/release/bundle/msi/Infinity Researcher_0.1.0_x64_en-US.msi`
- **Updater Bundle:** `src-tauri/target/release/bundle/nsis/Infinity Researcher_0.1.0_x64-setup.nsis.zip` + `.sig`

---

## 7. Code Signing & Updater Security

### Windows Authenticode Code Signing
When building for public production release, configure Microsoft Authenticode signing:
- Environment Variables required by Tauri:
  - `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (Minisign updater signature)
  - `WINDOWS_CERTIFICATE_PATH` / `WINDOWS_CERTIFICATE_PASSWORD` or Azure Trusted Signing in CI.

> [!IMPORTANT]
> If private code-signing credentials are not supplied, the generated installer is strictly labeled **UNSIGNED / INTERNAL TESTING ONLY**. The application will function identically, but Windows SmartScreen may present an unknown publisher warning upon first launch.

### In-App Updater Verification
- Public verification key embedded in `src-tauri/tauri.conf.json`:
  `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDgxMDEzMTc3RjEzQzg1QzEKUldUQmhUenhkekVCZ2NUSWZvUVhaWDl5R3VkaHQ3VjFrM2tHaDd5Wm5nVWRoMDVxcVQ0blJPMmYK`
- Update endpoint:
  `https://github.com/sanjay-m6/Infinity-Researcher/releases/latest/download/latest.json`
- In-app interface: **Settings > Application Updates & Releases**.

---

## 8. Verifying Release Artifacts

Verify SHA-256 checksums and file signatures:

```bash
# Compute SHA-256 hash of installer
certutil -hashfile "src-tauri/target/release/bundle/nsis/Infinity Researcher_0.1.0_x64-setup.exe" SHA256
```
