# GitHub Actions CI/CD Architecture — Infinity Researcher

Complete architecture and reference documentation for the automated continuous integration, matrix packaging, and release delivery pipeline.

---

## 1. Workflow Pipeline Overview

Infinity Researcher uses 6 specialized, modular GitHub Actions workflows located in `.github/workflows/`:

```
.github/workflows/
├── ci.yml                 # Multi-platform continuous integration gate (Ubuntu, macOS, Windows)
├── build-windows.yml      # Standalone Windows x64 build & packaging workflow
├── build-linux.yml        # Standalone Linux x64 build & packaging workflow (AppImage, Deb, RPM)
├── build-macos.yml        # Standalone macOS build & packaging workflow (Apple Silicon & Intel)
├── release.yml            # Master automated release orchestrator & updater publisher
└── nightly.yml            # Scheduled daily pre-release build workflow
```

---

## 2. Workflow Specifications

### `ci.yml` — Continuous Integration Quality Gate
- **Triggers**: `push` or `pull_request` to `main` / `master`, or `workflow_dispatch`.
- **Jobs**:
  1. `frontend-and-hygiene`:
     - Secret scanning (`npm run audit:secrets`)
     - Version consistency verification (`npm run version:check`)
     - Formatting checks (`npm run format:check`)
     - TypeScript typechecking (`npm run typecheck`)
     - ESLint linting (`npm run lint`)
     - Vitest test suite (`npm run test`)
     - Production bundle compilation (`npm run build`)
  2. `python-engine`:
     - Python syntax compilation (`compileall`)
     - Pytest unit tests (`python-engine/tests`)
     - Sidecar stub generation validation
  3. `rust-quality-matrix`:
     - Matrix: `[ubuntu-latest, macos-latest, windows-latest]`
     - Linux WebKitGTK 4.1 installation
     - `cargo fmt --check`
     - `cargo clippy -- -D warnings`
     - `cargo test` across all platforms
  4. `ci-status`: Aggregate status gate required for branch protection.

---

### `release.yml` — Master Release Orchestrator
- **Triggers**: Tag pushes matching `v*` (e.g. `v0.1.0`), or manual `workflow_dispatch`.
- **Stages**:
  1. `validate-release-metadata`: Ensures version sync, verifies release prerequisites, extracts release notes from `CHANGELOG.md`.
  2. `build-cross-platform`: Parallel matrix build across:
     - Windows x64 (`windows-latest`, `x86_64-pc-windows-msvc`)
     - Linux x64 (`ubuntu-22.04`, `x86_64-unknown-linux-gnu`)
     - macOS Apple Silicon (`macos-latest`, `aarch64-apple-darwin`)
     - macOS Intel (`macos-13`, `x86_64-apple-darwin`)
     Signs update archives via `TAURI_SIGNING_PRIVATE_KEY`.
  3. `publish-and-finalize`:
     - Collects all platform artifacts into `dist/`.
     - Generates unified multi-platform update manifest `latest.json` via `scripts/generate-update-manifest.mjs`.
     - Generates global `SHA256SUMS.txt`.
     - Creates/publishes GitHub Release with all binary packages attached.

---

### Standalone Platform Build Workflows
- **`build-windows.yml`**: On-demand build and packaging for Windows x64.
- **`build-linux.yml`**: On-demand build producing AppImage, Debian (.deb), and RPM (.rpm) with headless Xvfb verification.
- **`build-macos.yml`**: On-demand build producing ARM64 and Intel DMG packages with bundle inspection.

---

### `nightly.yml` — Automated Nightly Builds
- **Triggers**: Nightly schedule (`cron: '0 2 * * *'`) or manual dispatch.
- **Behavior**: Tags with `nightly-YYYYMMDD`, compiles all target architectures, and publishes pre-release builds.

---

## 3. Required Repository Secrets

Configure the following secrets in **GitHub Repository Settings → Secrets and variables → Actions**:

| Secret Name | Purpose | Required For |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Created automatically by GitHub Actions with `contents: write` | Release creation & asset uploading |
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign Ed25519 private key for signing in-app updates | Signed updater bundles (`.sig`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase for the Minisign private key | Decrypting updater private key |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application Certificate (`.p12`) | macOS code signing (optional for dev) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` certificate file | macOS code signing (optional for dev) |
| `APPLE_SIGNING_IDENTITY` | Signing identity string (e.g., `Developer ID Application: Sanjay...`) | macOS codesign utility |
| `APPLE_ID` | Apple Developer Account email | macOS notarization |
| `APPLE_PASSWORD` | App-specific password generated on appleid.apple.com | macOS notarization (`notarytool`) |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID | macOS notarization |

