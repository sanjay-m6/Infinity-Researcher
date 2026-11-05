# Changelog

All notable changes to the Infinity Researcher desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-11-05

### Added
- **AI Tools Beta Indicator:** Added visual "Beta" tags across the AI Tools navigation and workspace views:
  - Displayed high-contrast amber `Beta` tag badge next to `AI TOOLS` category header in the secondary sidebar panel.
  - Added `Beta` sub-navigation tag to `Academic Writing Assistant`.
  - Added `Beta` badges to the `Academic Writing Assistant` workspace master header, individual tool workspace views, and the AI Tools Hub hero banner.
- **Scholarly Query Expansion:** Added multi-pass academic query expansion and comprehensive cross-source paper discovery.

### Fixed
- **Academic Paper Discovery & Scraper Resilience:**
  - Resolved Europe PMC 503 service outage and intermittent endpoint failures across Rust (`query_search.rs`, `biorxiv.rs`, `medrxiv.rs`, `nature.rs`, `pmc.rs`) and Python (`epmc.py`, `engine.py`, `adapter_engine.py`).
  - Added resilient Crossref fallback querying prefixes `10.1101` (bioRxiv/medRxiv), `10.1038` (Nature), and biomedical journal articles (PubMed/PMC).
  - Increased HTTP connection and adapter timeouts from 14s to 35s, with an overall query deadline of 45s to prevent query timeouts during high traffic.
  - Fixed truthful PDF detection to prevent false positives and correctly reflect publisher open-access status.
- **Authentication & Sign-In UI Polish:**
  - Completely removed the legacy offline guest bypass ("Continue as Local Researcher") from the authentication system and UI, unifying user onboarding around clean Sign In and Account Creation.
  - Fixed auth container styling and background contrast to eliminate dark borders and ensure seamless visual harmony across dark and light modes.
  - Completely removed experimental `HoleBackground` animation and WebGL/canvas dependencies to optimize UI performance and eliminate visual artifacts.

## [0.1.0] - 2026-11-03

### Added
- **Cross-Platform Operating System Support:** Engineered first-class support for Windows 10/11 (x64 and ARM64), Linux (AppImage, Debian `.deb`, and Fedora/RHEL `.rpm`), and macOS (Apple Silicon M1/M2/M3/M4 `aarch64-apple-darwin` and Intel `x86_64-apple-darwin`).
- **Platform Abstraction Layer:** Created modular Rust abstractions (`src-tauri/src/platform/`) providing cross-platform application data and research library path resolution, process execution isolation, and native background process control.
- **Dynamic System Platform IPC:** Added `app_platform` Tauri command and frontend `getAppPlatform()` API displaying real-time OS name, architecture, kernel family, target triple, and storage paths.
- **Pure-Rust In-Memory Archive Extraction:** Built native ZIP decompression via the `zip` crate to eliminate external OS shell dependencies (`powershell`, `unzip`).
- **Automated Cross-Platform GitHub Actions Matrix:** Created complete automated workflows (`build.yml`, `ci.yml`, `build-windows.yml`, `build-linux.yml`, `build-macos.yml`, `release.yml`, `nightly.yml`) building, testing, and packaging across Windows, Linux, and macOS runners.
- **Signed In-App Automatic Updates:** Integrated official Tauri v2 updater (`@tauri-apps/plugin-updater`, `tauri-plugin-updater`) with Minisign Ed25519 cryptographic signature verification and multi-platform `latest.json` generation.
- **Dedicated In-App Updates & Diagnostics UI:** Added Settings Updates panel and About dialog displaying current version (v0.1.0), update check status, download progress, release channel selection (Stable/Beta), and platform diagnostics.
- **Multi-Source Academic Discovery Engine:** Integrated unified search across arXiv (Atom feed), Crossref, Semantic Scholar, OpenAlex, and Europe PMC with deduplication and token bucket rate pacing.
- **Configurable Website Scraping & Crawler:** Built HTML metadata extraction framework supporting Dublin Core, Highwire Press, and JSON-LD structured schemas, RFC-compliant robots.txt parsing, and background crawl jobs.
- **Paper Processing Pipeline:** Implemented metadata normalization (DOI standardization, author arrays, publication date parsing), near-duplicate scoring (Jaro-Winkler title distance and DOI exact match), and transactional paper merging with audit logs.
- **PDF Document Processing:** Added SHA-256 streaming file integrity calculation, PDF magic-byte verification (`%PDF-`), text extraction via worker threads, and graceful degradation for corrupt, textless, or encrypted documents.
- **Research Library & Full-Text Search:** Integrated SQLite 3 FTS5 virtual tables indexing titles, abstracts, and extracted PDF text with sub-50ms query times.
- **Collections & Research Tags:** Added hierarchical research collections, multi-tag assignments, bulk management, and safety invariants preventing paper deletion when collections or tags are removed.
- **Academic Citation Exports:** Added citation serializers for BibTeX, RIS, CSV, and JSON formats supporting individual and full-library batch exports.
- **Comprehensive Platform Documentation:** Added 10 production architecture guides in `docs/platform/` covering Windows, Linux, macOS, Apple Silicon, GitHub Actions, Release Process, Auto Update, Code Signing, and Troubleshooting.

### Fixed
- **Windows Loader Fault `0xc0000139` (`STATUS_ENTRYPOINT_NOT_FOUND`):** Injected Windows Common Controls v6 (`comctl32.dll`) manifest dependency into the MSVC linker in `build.rs` to resolve missing `TaskDialogIndirect` entrypoint during unit and integration test execution.
- **Duplicate Resource Collision (`CVT1100`):** Configured `WindowsAttributes::new_without_app_manifest()` in `build.rs` to prevent conflicting manifest resource generation between `tauri_build` and MSVC linker arguments.
- **Shell & Toolchain Dependencies:** Removed hardcoded calls to `powershell -Command Expand-Archive` and `where.exe`, replacing them with portable Rust functions and system `PATH` resolution.
- **Hardcoded File System Paths:** Eliminated hardcoded references to `%APPDATA%`, `%USERPROFILE%`, and `%HOME%` in favor of standard `dirs` crate resolution across Windows, Linux, and macOS.
- **Tauri IPC Command Registration:** Registered all Phase 8 commands (citation exports, document status, reading progress, bulk collections/tags) and `app_platform` in `tauri::generate_handler!`.
- **CSV Formula Injection:** Neutralized spreadsheet formula execution triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with leading whitespace trimming.
- **Unbounded HTTP Streaming:** Capped crawler response body consumption at 10 MB maximum via streaming chunks to prevent memory exhaustion.
- **BibTeX Character Escaping:** Escaped LaTeX special characters (`{`, `}`, `\`, `%`, `&`, `_`, `#`, `~`, `^`) in generated BibTeX citations.

### Security
- **Anti-SSRF Protection:** Enforced `UrlGuard` blocking access to loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), cloud metadata (`169.254.169.254`), and RFC1918 private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Content Security Policy (CSP):** Enforced strict CSP in `tauri.conf.json` preventing remote script execution and inline scripts in production.
- **Path Traversal Defense:** Enforced strict filesystem path canonicalization, rejecting directory traversal attempts (`..`).
- **Data Protection Guarantee:** Guaranteed that application updates never overwrite or purge user databases or stored research collections.
