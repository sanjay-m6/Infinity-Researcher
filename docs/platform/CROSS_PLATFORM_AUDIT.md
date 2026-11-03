# Infinity Researcher — Complete Cross-Platform Architecture Audit

**Document Version:** 1.0.0  
**Target Release:** v0.1.0+ Cross-Platform Edition  
**Author:** Sanjay (Infinity Web Technology)  
**Date:** November 2026  

---

## 1. Executive Summary

Infinity Researcher is an AI-powered scholarly desktop workspace uniting Tauri 2, Rust, React 19, TypeScript, and a high-performance Python discovery engine. This audit examines the existing codebase to identify all operating-system-specific assumptions, native dependencies, packaging bottlenecks, and runtime dependencies across Windows, Linux, and macOS (Intel and Apple Silicon).

The primary objective is delivering **one shared, unified codebase** that builds, tests, packages, distributes, and automatically updates across all three primary desktop ecosystems without redundant platform forks.

---

## 2. Platform Support Matrix & Target Architectures

| Operating System | Architecture | Target Triple | Primary Packages | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** (10/11) | x86_64 (64-bit Intel/AMD) | `x86_64-pc-windows-msvc` | NSIS (.exe), WiX (.msi) | Supported & Verified |
| **Windows** (10/11) | aarch64 (ARM64 Snapdragon) | `aarch64-pc-windows-msvc` | NSIS (.exe) | Supported (cross-target/runner) |
| **Linux** (Ubuntu/Debian) | x86_64 (64-bit) | `x86_64-unknown-linux-gnu` | AppImage, Debian (.deb) | Supported (via WebKit2GTK 4.1) |
| **Linux** (Fedora/RHEL) | x86_64 (64-bit) | `x86_64-unknown-linux-gnu` | RPM (.rpm) | Supported |
| **Linux** (ARM64) | aarch64 (Raspberry Pi/Cloud) | `aarch64-unknown-linux-gnu` | AppImage, Debian (.deb) | Planned (ARM runner) |
| **macOS** (Apple Silicon) | aarch64 (M1/M2/M3/M4/M5) | `aarch64-apple-darwin` | DMG (.dmg), APP bundle | Tier 1 Supported |
| **macOS** (Intel) | x86_64 (64-bit Intel) | `x86_64-apple-darwin` | DMG (.dmg), APP bundle | Supported |

---

## 3. Comprehensive Codebase Audit Findings

### 3.1 Tauri Configuration (`src-tauri/tauri.conf.json`)
* **Bundle Targets:** Currently restricted to `["nsis", "msi"]`. When building on Linux or macOS, this fails because neither NSIS nor WiX are native target bundle types on Unix.
  - *Fix:* Configure target bundles dynamically per platform (`all` or target-specific bundling via CLI flags).
* **External Binaries (`bundle.externalBin`):** Declares `["binaries/paper-scraper"]`. Tauri 2 requires the target triple appended to the filename (e.g. `paper-scraper-x86_64-pc-windows-msvc.exe` on Windows, `paper-scraper-x86_64-unknown-linux-gnu` on Linux, `paper-scraper-aarch64-apple-darwin` on macOS).
  - *Fix:* Ensure sidecar provisioning script generates matching target triple binary names per platform.
* **Linux Bundle Settings:** Missing `deb` dependencies (`libwebkit2gtk-4.1-0`, `libappindicator3-1`, `librsvg2-2`, `libsoup-3.0-0`).
* **macOS Bundle Settings:** Missing macOS category (`public.app-category.education`), `minimumSystemVersion` (`10.15`), and network entitlement definitions for in-app AI engine IPC.

### 3.2 Rust Dependencies & Native Linkage (`src-tauri/Cargo.toml`)
* **`rusqlite`:** Uses `bundled` feature. Bundled SQLite compiles pure C code via `cc` on all platforms, guaranteeing identical behavior and avoiding runtime SQLite shared library version drift on Linux/macOS.
* **`reqwest`:** Uses `rustls-tls` (`default-features = false`). This avoids native OpenSSL linking issues across Linux distributions and macOS LibreSSL/OpenSSL disparities.
* **`keyring`:** Crate version 3 utilizes Windows Credential Manager on Windows, Secret Service / DBus on Linux, and macOS Keychain natively on Apple Darwin.
* **`sysinfo`:** Version 0.31 supports Windows, Linux, and macOS memory, CPU, and process queries out of the box.
* **Windows-only Build Linker Flags:** `src-tauri/build.rs` previously had no platform guards for MSVC-specific linker directives (`/MANIFEST:EMBED`).
  - *Fix:* Guard all MSVC linker flags with `#[cfg(windows)]`.

### 3.3 File System & Path Resolution
* **Application Data Directory:** `services/ai_provider_service.rs` previously invoked `std::env::var("APPDATA")` as a fallback. On Linux and macOS, `APPDATA` is unset, falling back to current working directory `.`.
  - *Fix:* Use `dirs::data_dir()` / `dirs::config_dir()` or Tauri's native `app.path().app_data_dir()`.
* **Default Library Directory:** `config/mod.rs` checked `USERPROFILE` then `HOME`.
  - *Fix:* Standardize with `dirs::document_dir()` / `dirs::home_dir()`.
* **Path Separators:** Verified that `Path::join` and `PathBuf` are used throughout instead of manual string concatenation with backslashes or forward slashes.

### 3.4 Process Management & Subprocess Execution
* **AI Engine Sidecar (`ai_engine.rs`):**
  - Previously assumed `llama-server.exe` and invoked `powershell` with `Expand-Archive` to unpack downloaded models/server binaries.
  - Previously invoked Windows-specific `where.exe`.
  - *Fix:* Replace shell-based archive extraction with in-process, pure Rust `zip` decoding. Auto-resolve executable name (`llama-server.exe` on Windows, `llama-server` on Linux/macOS) and PATH resolution using cross-platform methods (`which` on Unix, `where.exe` on Windows).

### 3.5 Python Engine Integration (`python-engine/`)
* **Architecture Agnostic Code:** The core Python modules (`paper_scraper`, `extractors`, `adapters`, `ranking`) are 100% pure Python using `httpx`, `beautifulsoup4`, `pydantic`, and `rapidfuzz`.
* **Sidecar Distribution:**
  - `scripts/build-python-sidecar.py` previously hardcoded `paper-scraper-x86_64-pc-windows-msvc.exe`.
  - *Fix:* Update `build-python-sidecar.py` to accept `--target <triple>` and generate the correct executable name (no `.exe` on Linux/macOS).

### 3.6 SQLite Database & Migrations
* Database resides in `app_data_dir()` (`infinity-researcher.sqlite3` with fallback detection for legacy names).
* 18 schema migrations execute sequentially within transactional blocks.
* Backups and WAL mode operate cleanly on NTFS (Windows), ext4/btrfs (Linux), and APFS (macOS).

### 3.7 UI & Custom Titlebar Experience
* Custom titlebar with GSAP animations and framer-motion respects system accessibility and theme preferences (Dark/Light).
* On macOS, native traffic-light buttons or custom controls can be styled without conflicting with Tauri window dragging regions (`data-tauri-drag-region`).

---

## 4. Required Native System Libraries (CI & Runtime)

### Linux (Ubuntu / Debian / Fedora)
* **Build Dependencies:**
  - `build-essential`, `pkg-config`, `libssl-dev`
  - `libwebkit2gtk-4.1-dev` (or `4.0-dev`)
  - `libappindicator3-dev`
  - `librsvg2-dev`
  - `patchelf` (for AppImage bundling)
* **Runtime Dependencies:**
  - `libwebkit2gtk-4.1-0`
  - `libsoup-3.0-0`
  - `libjavascriptcoregtk-4.1-0`

### macOS (Darwin Intel & Apple Silicon)
* **Build Dependencies:** Xcode Command Line Tools.
* **Runtime Dependencies:** Native macOS WebKit framework (pre-installed on macOS 10.15+).

### Windows
* **Build Dependencies:** MSVC C++ Build Tools, Windows SDK, `rustc` x86_64-pc-windows-msvc.
* **Runtime Dependencies:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 10/11).

---

## 5. GitHub Actions CI/CD Architecture Plan

1. **`ci.yml`**: Unified quality gate running frontend lint/build/tests, Python tests, and Rust format/clippy/tests across Ubuntu, macOS, and Windows.
2. **`build-windows.yml`**: Builds and packages Windows x64 NSIS (.exe) and WiX (.msi).
3. **`build-linux.yml`**: Installs GTK/WebKit toolchains, builds AppImage and Debian (.deb) packages.
4. **`build-macos.yml`**: Builds Intel (`x86_64`) and Apple Silicon (`aarch64`) DMG packages.
5. **`release.yml`**: Comprehensive release orchestrator bundling all platforms upon version tagging (`v*`), generating `SHA256SUMS.txt`, signing update artifacts, and publishing GitHub Releases with `latest.json`.
6. **`nightly.yml`**: Scheduled continuous delivery producing pre-release artifacts.

