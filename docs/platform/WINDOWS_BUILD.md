# Windows Build Guide — Infinity Researcher

Comprehensive guide for building, packaging, verifying, and distributing **Infinity Researcher** on Microsoft Windows.

---

## 1. Supported Platforms & Architectures

| Architecture | Target Triple | Support Status | Package Formats |
| :--- | :--- | :--- | :--- |
| **Windows x64** | `x86_64-pc-windows-msvc` | **Tier 1 (Primary)** | NSIS Installer (`.exe`), WiX MSI (`.msi`), Portable / Zip |
| **Windows ARM64** | `aarch64-pc-windows-msvc` | **Tier 2 (Supported)** | NSIS Installer (`.exe`), Portable / Zip |

Minimum Operating System: **Windows 10 (Version 1809+, 64-bit)** or **Windows 11**.

---

## 2. Prerequisites & Development Environment

Install the following tools on Windows:

1. **Microsoft Visual Studio 2022 / Build Tools**:
   - Workload: *Desktop development with C++*
   - Ensure *MSVC v143 - VS 2022 C++ x64/x86 build tools* and *Windows 11 SDK* are checked.
2. **Rust Toolchain**:
   - Install via [rustup.rs](https://rustup.rs):
     ```powershell
     rustup default stable-x86_64-pc-windows-msvc
     rustup target add x86_64-pc-windows-msvc
     ```
3. **Node.js**:
   - Node.js **v22.x** or higher with `npm`.
4. **Python**:
   - Python **3.12.x** 64-bit added to system `PATH`.
5. **WebView2 Runtime**:
   - Installed by default on Windows 10 (v2004+) and Windows 11.

---

## 3. ComCtl32 v6 Manifest & Linker Architecture

Tauri v2 utilizes Windows native dialog controls (such as `TaskDialogIndirect` via `tao`/`wry`). In Windows, `TaskDialogIndirect` is exclusively provided by **Common Controls version 6.0** (`comctl32.dll`), whereas legacy applications default to version 5.82.

In Infinity Researcher, [`src-tauri/build.rs`](file:///d:/client%20Project/Infinity-Researcher/src-tauri/build.rs) automatically configures the MSVC linker with manifest dependencies for Windows builds:

```rust
#[cfg(target_os = "windows")]
{
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
    let attrs = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs))
        .expect("Failed to run tauri_build");
}
```

This ensures both unit tests (`cargo test`) and the production binary cleanly load ComCtl32 v6 without `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)`.

---

## 4. Building the Python Sidecar

Infinity Researcher uses a native Python scraping engine packaged as a Tauri external binary sidecar.

To build or stage the sidecar for Windows:

```powershell
# Production stub/native wrapper
python scripts/build-python-sidecar.py --target x86_64-pc-windows-msvc --stub

# Or full standalone PyInstaller bundle:
python scripts/build-python-sidecar.py --target x86_64-pc-windows-msvc
```

The resulting executable is placed in `src-tauri/binaries/research-scraper-x86_64-pc-windows-msvc.exe`.

---

## 5. Building the Desktop Application

### Development Build
```powershell
# Install frontend packages
npm ci

# Start live development with hot reload
npm run tauri dev
```

### Production Release Packaging
```powershell
# Build frontend production bundle
npm run build

# Compile Rust backend and package NSIS & MSI installers
npm run tauri build -- --target x86_64-pc-windows-msvc
```

Generated packages will be located in:
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`
- **NSIS Installer**: `nsis/Infinity-Researcher_<version>_x64-setup.exe`
- **WiX MSI**: `msi/Infinity-Researcher_<version>_x64_en-US.msi`
- **Signed Updater Archive**: `nsis/Infinity-Researcher_<version>_x64-setup.nsis.zip` + `.sig`

---

## 6. Verifying Artifacts

Run the automated release verification suite:

```powershell
node scripts/verify-release-artifacts.mjs src-tauri/target/x86_64-pc-windows-msvc/release/bundle --generate-checksums
```

---

## 7. Storage & Upgrade Safety Guarantee

- **Application Data Directory**: `%APPDATA%\com.infinity.researcher`
- **Local SQLite Database**: `%APPDATA%\com.infinity.researcher\research_library.db`
- **Document Library**: `%USERPROFILE%\InfinityResearcher\Library`

Upgrading the application via NSIS or the Tauri in-app updater **never** overwrites or deletes the user's database or PDF documents. Migration scripts run automatically upon database connection.

