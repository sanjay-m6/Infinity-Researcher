# Release Process & Versioning Guide — Infinity Researcher

Step-by-step procedures for preparing, testing, packaging, signing, and distributing official production and beta releases of **Infinity Researcher**.

---

## 1. Versioning Standard (Semantic Versioning)

Infinity Researcher strictly adheres to [Semantic Versioning 2.0.0](https://semver.org/):
- **Major (`X.0.0`)**: Breaking database schema migrations requiring non-backwards-compatible upgrades or major architectural overhauls.
- **Minor (`0.X.0`)**: New user-facing features, new academic source adapters, new AI capabilities.
- **Patch (`0.0.X`)**: Bug fixes, security patches, styling improvements, and performance optimizations.

---

## 2. Pre-Release Checklist

Before tagging a release, run the automated local validation:

```bash
# 1. Run full secret and repository hygiene audit
npm run audit:secrets

# 2. Check version consistency between package.json, tauri.conf.json, and Cargo.toml
npm run version:check

# 3. Run frontend quality checks (typecheck, lint, unit tests, build)
npm run typecheck
npm run lint
npm run test
npm run build

# 4. Run Rust test suite and clippy
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cd ..

# 5. Run pre-release check script
node scripts/release-check.mjs --tag "v0.1.0"
```

---

## 3. Version Bump Procedure

To bump the version across all manifests simultaneously (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`):

```bash
# Bump patch (e.g. 0.1.0 -> 0.1.1)
node scripts/version-bump.mjs patch

# Bump minor (e.g. 0.1.0 -> 0.2.0)
node scripts/version-bump.mjs minor

# Bump major (e.g. 0.1.0 -> 1.0.0)
node scripts/version-bump.mjs major
```

Verify changes and update [`CHANGELOG.md`](file:///d:/client%20Project/Infinity-Researcher/CHANGELOG.md) with user-facing release notes under the new version header (e.g., `## [0.1.0] - 2026-11-03`).

---

## 4. Tagging & Triggering the Automated Release

Commit the version bump and push a signed Git tag:

```bash
git add .
git commit -m "chore(release): bump version to 0.1.0"
git push origin main

# Create and push git tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Pushing the `v*` tag triggers the GitHub Actions workflow [`.github/workflows/release.yml`](file:///d:/client%20Project/Infinity-Researcher/.github/workflows/release.yml):
1. Runs full quality gate.
2. Extracts release notes automatically from `CHANGELOG.md`.
3. Compiles and packages Windows x64 (`.exe`, `.msi`), Linux x64 (`.AppImage`, `.deb`, `.rpm`), and macOS (`.dmg` for Apple Silicon & Intel).
4. Generates Minisign updater signatures (`.sig`) for all platforms.
5. Assembles `latest.json` updater manifest with download URLs and signatures.
6. Computes `SHA256SUMS.txt`.
7. Creates a GitHub Release draft with all packages and notes attached.

---

## 5. Post-Release Verification

1. Navigate to the GitHub Releases tab in your repository.
2. Review the Draft Release:
   - Ensure all 4 platforms' installers are present.
   - Confirm `latest.json` updater manifest and `SHA256SUMS.txt` are attached.
   - Inspect release notes.
3. Test downloading the installer on a clean VM or test machine.
4. Publish the Release from Draft to Public.

