# Pre-Release Quality Gate & Sign-Off Checklist

**Project:** Research Paper Scraper  
**Release Candidate:** v0.1.0  
**Target Release Date:** 2026-10-24  
**Release Lead:** Antigravity AI Engineering Team  

---

## Pre-Release Sign-Off Matrix

### 1. Identity & Versioning
- [x] Application name is consistent: `Research Paper Scraper`
- [x] Application identifier is normalized: `com.researchpaperscraper.desktop`
- [x] Version strings synchronized across `package.json`, `Cargo.toml`, and `tauri.conf.json`: `0.1.0`
- [x] Application icons verified in all required resolutions (PNG, ICO, ICNS)

### 2. Frontend Build & Assets
- [x] Locked dependencies installed via `npm ci`
- [x] TypeScript type checking passes with 0 errors (`npm run typecheck`)
- [x] ESLint passes with 0 errors/warnings (`npm run lint`)
- [x] Production build generated at `dist/` without dev-server dependencies (`npm run build`)
- [x] Dependency audit reports 0 vulnerabilities (`npm audit`)

### 3. Rust Backend & Packaging
- [x] Rust formatting verified (`cargo fmt --check`)
- [x] Strict Clippy analysis passes with 0 warnings (`cargo clippy -- -D warnings`)
- [x] Full unit and integration test suite passes: 72/72 tests passed (`cargo test`)
- [x] Security and robustness test suite passes: 7/7 tests passed
- [x] Synthetic performance benchmarks verified: 1k & 5k scale tests passed
- [x] Production standalone binary built: `src-tauri/target/release/research-paper-scraper.exe` (11.68 MiB)
- [x] Production Windows Installer built: `Research Paper Scraper_0.1.0_x64_en-US.msi` (5.51 MiB)

### 4. Data Safety & Lifecycle
- [x] Database located in stable user app-data directory (`%APPDATA%`)
- [x] All 4 SQLite database migrations execute transactionally and idempotently
- [x] Research notes, tags, and collections persist across application restarts
- [x] PDF downloads verified with SHA-256 integrity checks and magic bytes validation
- [x] Uninstallation removes application binaries while preserving user database and papers

### 5. Security & Content Policies
- [x] Content Security Policy (CSP) active and restricted to `'self'`
- [x] Anti-SSRF protection verified (loopback, RFC1918 private, link-local, cloud metadata IPs blocked)
- [x] Streaming response body size bounded to 10 MB maximum
- [x] CSV exports fortified against spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
- [x] Path traversal attacks (`../`) rejected on all file operations
- [x] Diagnostic logging automatically redacts Bearer tokens and API keys

### 6. Distribution & Documentation
- [x] [PHASE_10_AUDIT.md](file:///d:/Paper/docs/release/PHASE_10_AUDIT.md) completed
- [x] [SUPPORT_MATRIX.md](file:///d:/Paper/docs/release/SUPPORT_MATRIX.md) completed
- [x] [RELEASING.md](file:///d:/Paper/docs/release/RELEASING.md) completed
- [x] [INSTALLATION.md](file:///d:/Paper/docs/release/INSTALLATION.md) completed
- [x] [SMOKE_TEST_PLAN.md](file:///d:/Paper/docs/release/SMOKE_TEST_PLAN.md) completed
- [x] [ARTIFACTS.md](file:///d:/Paper/docs/release/ARTIFACTS.md) completed with exact SHA-256 hashes
- [x] [CHANGELOG.md](file:///d:/Paper/CHANGELOG.md) updated with Phase 1–10 additions
- [x] [THIRD_PARTY_NOTICES.md](file:///d:/Paper/THIRD_PARTY_NOTICES.md) prepared with license disclosures
- [x] Automated release workflow [.github/workflows/release.yml](file:///d:/Paper/.github/workflows/release.yml) configured
