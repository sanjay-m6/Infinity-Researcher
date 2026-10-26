# Changelog

All notable changes to the Research Paper Scraper desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-24

### Added
- **Multi-Source Academic Discovery Engine:** Integrated unified search across arXiv (Atom feed), Crossref, Semantic Scholar, OpenAlex, and Europe PMC with deduplication and token bucket rate pacing.
- **Configurable Website Scraping & Crawler:** Built HTML metadata extraction framework supporting Dublin Core, Highwire Press, and JSON-LD structured schemas, RFC-compliant robots.txt parsing, and background crawl jobs.
- **Paper Processing Pipeline:** Implemented metadata normalization (DOI standardization, author arrays, publication date parsing), near-duplicate scoring (Jaro-Winkler title distance and DOI exact match), and transactional paper merging with audit logs.
- **PDF Document Processing:** Added SHA-256 streaming file integrity calculation, PDF magic-byte verification (`%PDF-`), text extraction via worker threads, and graceful degradation for corrupt, textless, or encrypted documents.
- **Research Library & Full-Text Search:** Integrated SQLite 3 FTS5 virtual tables indexing titles, abstracts, and extracted PDF text with sub-50ms query times across 1,000 papers.
- **Collections & Research Tags:** Added hierarchical research collections, multi-tag assignments, bulk management, and safety invariants preventing paper deletion when collections or tags are removed.
- **Research Notes & Reading Tracking:** Added persistent per-paper markdown research notes, reading state machine (`Unread`, `Reading`, `Completed`, `Archived`), and reading progress tracking.
- **Academic Citation Exports:** Added citation serializers for BibTeX, RIS, CSV, and JSON formats supporting individual and full-library batch exports.
- **Desktop Application Packaging:** Added production Tauri 2 release bundling for Windows, producing both standalone executables and native Windows Installer (MSI) packages via the WiX Toolset.
- **CI/CD Automation:** Added GitHub Actions workflows for continuous integration quality gates and version-tagged release packaging.

### Changed
- Normalized Tauri bundle identifier to `com.researchpaperscraper.desktop` to prevent macOS `.app` bundle naming collisions.
- Raised SQLite query pagination clamp from 100 to 10,000 to enable large library citation exports in a single pass.
- Streamlined desktop application title to `Research Paper Scraper`.

### Fixed
- **Tauri IPC Command Registration:** Registered 15 previously missing Phase 8 commands (citation exports, document status, reading progress, bulk collections/tags) in `tauri::generate_handler!`.
- **CSV Formula Injection:** Neutralized spreadsheet formula execution triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with leading whitespace trimming before checking characters.
- **Unbounded HTTP Streaming:** Capped crawler response body consumption at 10 MB maximum via streaming chunks to prevent memory exhaustion and DoS.
- **BibTeX Character Escaping:** Escaped LaTeX special characters (`{`, `}`, `\`, `%`, `&`, `_`, `#`, `~`, `^`) in generated BibTeX citations.

### Security
- Implemented Anti-SSRF protection in `UrlGuard`, rejecting loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), cloud metadata (`169.254.169.254`), and RFC1918 private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Enforced strict Content Security Policy (CSP) in `tauri.conf.json` preventing remote script execution and inline scripts in production.
- Enforced filesystem path canonicalization, rejecting `..` traversal and absolute path escaping.
- Verified automatic regex redaction of Bearer tokens and API keys in diagnostic logs.
- Confirmed 0 vulnerabilities across all frontend dependencies via `npm audit`.

### Known Limitations
- Release artifacts are currently unsigned with a commercial Authenticode certificate; Windows SmartScreen will display an "Unknown Publisher" prompt during installation.
- macOS and Linux packaging workflows are defined in CI but remain untested on native macOS/Linux runner hardware.
- Live academic provider searches require active network access; local library search and stored papers remain 100% offline.
