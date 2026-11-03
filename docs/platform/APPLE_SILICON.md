# Apple Silicon Optimization & Compatibility Guide

Technical details on building, optimizing, and verifying **Infinity Researcher** natively on Apple Silicon (M1, M2, M3, M4, and upcoming generations).

---

## 1. Why Native Apple Silicon (ARM64)?

Running desktop applications via Rosetta 2 translation incurs runtime overhead, slower startup time, and higher memory consumption.
Infinity Researcher targets `aarch64-apple-darwin` as a Tier-1 native target:
- **Zero Translation Overhead**: Direct ARM64 execution with native NEON SIMD vectorization.
- **Metal Acceleration**: Direct integration with Apple Silicon GPU pipelines for UI rendering and local AI embedding workloads (such as `llama.cpp` Metal backend).
- **Unified Memory Architecture (UMA)**: Optimized buffer transfers between CPU and Neural Engine/GPU.

---

## 2. Target Architecture Specifications

- **Rust Target Triple**: `aarch64-apple-darwin`
- **Tauri External Binary Sidecar**: `src-tauri/binaries/research-scraper-aarch64-apple-darwin`
- **Compiler Flags**:
  - LLVM target: `arm64-apple-darwin`
  - Min OS version: `10.15` (Catalina) or `11.0` (Big Sur, Apple Silicon baseline)

---

## 3. Local Model Acceleration (llama-server)

In [`src-tauri/src/platform/mod.rs`](file:///d:/client%20Project/Infinity-Researcher/src-tauri/src/platform/mod.rs), the download resolver dynamically selects the optimized Metal build for macOS:

```rust
pub fn llama_server_download_url(version: &str) -> Option<String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Some(format!(
            "https://github.com/ggerganov/llama.cpp/releases/download/{version}/llama-{version}-bin-macos-arm64.zip"
        )),
        ("macos", "x86_64") => Some(format!(
            "https://github.com/ggerganov/llama.cpp/releases/download/{version}/llama-{version}-bin-macos-x64.zip"
        )),
        // ...
    }
}
```

This enables hardware-accelerated local AI inference utilizing Apple Silicon GPU cores and Apple Neural Engine (ANE).

---

## 4. Cross-Compilation from macOS Intel or GitHub Actions

In GitHub Actions, Apple Silicon packages are built natively on Apple Silicon runners (`macos-latest` or `macos-14`).

To cross-compile locally from an Intel Mac:
```bash
# Add ARM64 target
rustup target add aarch64-apple-darwin

# Build with cross-compilation target
npm run tauri build -- --target aarch64-apple-darwin
```

---

## 5. Verification Commands

Verify that the compiled binary is 100% native ARM64 without Intel dependencies:

```bash
# Check binary type
file "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Infinity Researcher.app/Contents/MacOS/infinity-researcher"
# Expected: Mach-O 64-bit executable arm64

# Check dynamic library architectures
otool -L "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Infinity Researcher.app/Contents/MacOS/infinity-researcher"
```

