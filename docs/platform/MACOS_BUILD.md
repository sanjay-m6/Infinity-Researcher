# macOS Build Guide — Infinity Researcher

Comprehensive guide for building, packaging, verifying, signing, and notarizing **Infinity Researcher** on macOS.

---

## 1. Supported Architectures & macOS Versions

| Architecture | Target Triple | Target Hardware | Package Formats |
| :--- | :--- | :--- | :--- |
| **Apple Silicon (ARM64)** | `aarch64-apple-darwin` | M1, M2, M3, M4 and newer | `.dmg`, `.app` bundle, `.tar.gz` |
| **Intel (x86_64)** | `x86_64-apple-darwin` | Mac computers with Intel processors | `.dmg`, `.app` bundle, `.tar.gz` |

Minimum Supported macOS Version: **macOS 10.15 (Catalina)** or newer.

---

## 2. Prerequisites & Environment Setup

1. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. **Rust Toolchain**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add aarch64-apple-darwin
   rustup target add x86_64-apple-darwin
   ```
3. **Node.js**: v22.x or higher with `npm`.
4. **Python**: Python 3.12 (via Homebrew or python.org).

---

## 3. Building the Python Sidecar

Build the platform sidecar matching your target architecture:

```bash
# Apple Silicon
python3 scripts/build-python-sidecar.py --target aarch64-apple-darwin --stub

# Intel
python3 scripts/build-python-sidecar.py --target x86_64-apple-darwin --stub
```

Output path: `src-tauri/binaries/research-scraper-<target-triple>`.

---

## 4. Building the Application

### Apple Silicon (M1/M2/M3/M4)
```bash
npm ci
npm run build
npm run tauri build -- --target aarch64-apple-darwin
```

### Intel x64
```bash
npm ci
npm run build
npm run tauri build -- --target x86_64-apple-darwin
```

Output packages are placed in:
`src-tauri/target/<target-triple>/release/bundle/`:
- **DMG Package**: `dmg/Infinity-Researcher_<version>_<arch>.dmg`
- **Application Bundle**: `macos/Infinity Researcher.app`
- **Updater Archive**: `macos/Infinity Researcher.app.tar.gz` + `.sig`

---

## 5. Verifying Architecture & Bundle Structure

```bash
# Verify binary architecture
file "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Infinity Researcher.app/Contents/MacOS/infinity-researcher"
# Output should indicate Mach-O 64-bit executable arm64

# Verify Info.plist metadata
plutil -p "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Infinity Researcher.app/Contents/Info.plist"
```

---

## 6. Storage Locations on macOS

- **Application Support**: `~/Library/Application Support/com.infinity.researcher/`
- **SQLite Database**: `~/Library/Application Support/com.infinity.researcher/research_library.db`
- **Caches**: `~/Library/Caches/com.infinity.researcher/`
- **Preferences**: `~/Library/Preferences/com.infinity.researcher.plist`
- **Research Library**: `~/InfinityResearcher/Library/`

