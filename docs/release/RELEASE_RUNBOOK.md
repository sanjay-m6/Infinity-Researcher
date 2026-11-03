# Infinity Researcher — Release Engineering Runbook

**Product:** Infinity Researcher  
**Author:** Sanjay  
**Publisher:** Infinity Web Technology  
**Primary Target:** Windows x64 (NSIS & WiX MSI)  

---

## 1. Release Philosophy & Cadence

Infinity Researcher follows strict **Semantic Versioning (SemVer 2.0.0)**:
- **MAJOR (`X.0.0`):** Incompatible structural changes, breaking SQLite schema migrations, or fundamental architectural transitions.
- **MINOR (`0.X.0`):** Backward-compatible new features, new academic source adapters, new analysis tools.
- **PATCH (`0.0.X`):** Backward-compatible bug fixes, UI/UX polish, security patches, performance improvements.

All releases must:
1. Pass 100% of automated tests across TypeScript (Vitest), Rust (Cargo), and Python (Pytest).
2. Maintain zero unredacted secrets or private keys in the repository.
3. Be cryptographically signed using Minisign Ed25519 for in-app automatic update delivery.
4. Preserve existing user research databases, markdown notes, tags, and downloaded papers.

---

## 2. Pre-Release Checklist

Before tagging a release, run through this local pre-flight checklist:

```bash
# 1. Run full secret and hygiene scan
npm run audit:secrets

# 2. Verify all version numbers agree across package.json, tauri.conf.json, and Cargo.toml
npm run version:check

# 3. Run complete test suites across all three runtime layers
npm run check:all
cargo test --manifest-path src-tauri/Cargo.toml
python -m pytest python-engine/tests -q

# 4. Run release pre-flight checker
npm run release:check
```

---

## 3. Standard Step-by-Step Release Procedure

### Step 3.1: Update CHANGELOG.md
Ensure `CHANGELOG.md` has an entry for the version you intend to release. If notes are currently in `[Unreleased]`, move them or use the version bump script which automates header insertion.

```markdown
## [0.2.0] - 2026-10-27

### Added
- Signed in-app automatic update verification.
- Dedicated Updates card in Settings.

### Fixed
- Formula injection protection.
```

### Step 3.2: Bump the Application Version
Use the unified version bump script to atomically synchronize all project manifests:

```bash
# For a patch release (e.g. 0.1.0 -> 0.1.1):
npm run version:bump patch

# For a minor release (e.g. 0.1.0 -> 0.2.0):
npm run version:bump minor

# For a major release (e.g. 0.1.0 -> 1.0.0):
npm run version:bump major

# Or for an explicit version:
npm run version:bump 0.2.0
```

Verify that `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` all reflect the new version:
```bash
npm run version:check
```

### Step 3.3: Commit Release Preparation
```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
git commit -m "chore(release): prepare v0.2.0"
git push origin main
```

### Step 3.4: Create and Push Annotated Version Tag
Create an annotated Git tag matching the SemVer format:

```bash
git tag -a v0.2.0 -m "Infinity Researcher v0.2.0 Release"
git push origin v0.2.0
```

---

## 4. GitHub Actions Release Pipeline

Pushing `v0.2.0` automatically triggers `.github/workflows/release.yml`:

1. **Tag Validation:** Verifies that the git tag matches the version inside the repository manifests.
2. **Release Notes Extraction:** Extracts the corresponding section from `CHANGELOG.md` to populate the release description.
3. **Quality Gates:** Runs full typecheck, lint, vitest, clippy, and cargo tests.
4. **Tauri Action:**
   - Compiles the Windows x64 binaries.
   - Packages `Infinity-Researcher_0.2.0_x64-setup.exe` (NSIS).
   - Packages `Infinity-Researcher_0.2.0_x64_en-US.msi` (MSI).
   - Bundles and cryptographically signs `Infinity-Researcher_0.2.0_x64.nsis.zip` with `TAURI_SIGNING_PRIVATE_KEY`.
   - Generates the `latest.json` manifest file with the Ed25519 signature.
5. **Post-Build Verification:** Runs `scripts/verify-release-artifacts.mjs` to ensure installers, updater zip, and `.sig` files are non-empty and properly formatted.
6. **Draft GitHub Release:** Creates a draft release on GitHub with all assets attached.

---

## 5. Release Publication & In-App Update Verification

1. Navigate to **Releases** on `https://github.com/sanjay-m6/Infinity-Researcher/releases`.
2. Review the generated draft release and verify:
   - `Infinity-Researcher_0.2.0_x64-setup.exe`
   - `Infinity-Researcher_0.2.0_x64_en-US.msi`
   - `Infinity-Researcher_0.2.0_x64.nsis.zip`
   - `Infinity-Researcher_0.2.0_x64.nsis.zip.sig`
   - `latest.json`
   - `SHA256SUMS.txt`
3. Click **Publish release**.
4. Test In-App Update on an installed earlier version:
   - Open Settings → **Application Updates & Releases**.
   - Click **Check for Updates**.
   - Confirm update prompt displays version `0.2.0` with release notes.
   - Click **Download & Install**.
   - Click **Restart to Finish Update**.
   - Verify app launches running `v0.2.0` with database intact.

---

## 6. Hotfix Procedure

If a critical defect is discovered in production:

1. Create a hotfix branch from the release tag:
   ```bash
   git checkout -b hotfix/v0.2.1 v0.2.0
   ```
2. Implement the targeted fix and add a regression test.
3. Update `CHANGELOG.md` under `## [0.2.1]`.
4. Bump version:
   ```bash
   npm run version:bump patch
   ```
5. Merge hotfix into `main`:
   ```bash
   git checkout main
   git merge hotfix/v0.2.1
   git push origin main
   ```
6. Tag and push hotfix:
   ```bash
   git tag -a v0.2.1 -m "Hotfix v0.2.1"
   git push origin v0.2.1
   ```

---

## 7. Rollback & Recovery Policy

- **Tauri Updater Safety:** The Tauri updater compares SemVer strings. It will never install an update whose version number is lower than or equal to the currently installed version.
- **Rollback by Patching:** If a bad release is published, the recommended recovery is to publish a rapid patch release (`vX.Y.Z+1`) containing the reverted code or fix.
- **Never Rewrite Remote Tags:** Do not delete or force-push release tags on the remote repository once clients have begun pulling update manifests.
