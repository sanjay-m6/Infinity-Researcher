# Linux Build Guide — Infinity Researcher

Comprehensive guide for building, packaging, verifying, and distributing **Infinity Researcher** on Linux distributions (Ubuntu, Debian, Fedora, Arch, openSUSE).

---

## 1. Supported Linux Distributions & Targets

| Architecture | Target Triple | Package Formats | Target Distros |
| :--- | :--- | :--- | :--- |
| **Linux x64** | `x86_64-unknown-linux-gnu` | AppImage, `.deb`, `.rpm`, `.tar.gz` | Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux |
| **Linux ARM64** | `aarch64-unknown-linux-gnu` | AppImage, `.deb`, `.tar.gz` | Raspberry Pi OS 64-bit, Ubuntu ARM, Asahi Linux |

---

## 2. System Dependencies

Tauri v2 applications on Linux require WebKit2GTK 4.1 and system tray libraries.

### Debian / Ubuntu
```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  build-essential \
  curl \
  wget \
  file \
  squashfs-tools \
  rpm
```

### Fedora / RHEL
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  squashfs-tools \
  rpm-build \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### Arch Linux
```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  openssl \
  base-devel \
  curl \
  wget \
  squashfs-tools \
  rpm-tools \
  libappindicator-gtk3 \
  librsvg
```

---

## 3. Toolchain Setup

1. **Rust Stable**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default stable
   rustup target add x86_64-unknown-linux-gnu
   ```
2. **Node.js**: v22.x or higher with `npm`.
3. **Python**: Python 3.10+ (3.12 recommended).

---

## 4. Building the Python Sidecar

Build the architecture-specific Python engine binary:

```bash
# Production stub/native wrapper
python3 scripts/build-python-sidecar.py --target x86_64-unknown-linux-gnu --stub

# Or PyInstaller bundle
python3 scripts/build-python-sidecar.py --target x86_64-unknown-linux-gnu
```

The resulting executable is generated at `src-tauri/binaries/research-scraper-x86_64-unknown-linux-gnu` with execute permissions (`chmod +x`).

---

## 5. Building the Desktop Application

### Production Release Build
```bash
# Install frontend dependencies
npm ci

# Build frontend assets
npm run build

# Package AppImage, Debian (.deb), and RPM (.rpm)
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

The output packages will be located in:
`src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/`:
- **AppImage**: `appimage/Infinity-Researcher_<version>_amd64.AppImage`
- **Debian Package**: `deb/infinity-researcher_<version>_amd64.deb`
- **RPM Package**: `rpm/infinity-researcher-<version>-1.x86_64.rpm`
- **Updater Archive**: `appimage/Infinity-Researcher_<version>_amd64.AppImage.tar.gz` + `.sig`

---

## 6. Headless Verification with Xvfb

In continuous integration environments or headless servers, test execution without an active X11 display:

```bash
xvfb-run ./src-tauri/target/x86_64-unknown-linux-gnu/release/infinity-researcher --version
```

---

## 7. Storage & XDG Base Directory Compliance

Infinity Researcher strictly adheres to the **XDG Base Directory Specification**:
- **Application Data**: `~/.local/share/com.infinity.researcher/`
- **Database File**: `~/.local/share/com.infinity.researcher/research_library.db`
- **Configuration**: `~/.config/com.infinity.researcher/`
- **Cache**: `~/.cache/com.infinity.researcher/`
- **Research Library**: `~/InfinityResearcher/Library/`

