# Cross-Platform Troubleshooting & Diagnostics — Infinity Researcher

Comprehensive troubleshooting guide for common build, runtime, packaging, and updater issues across Windows, Linux, and macOS.

---

## 1. Windows Issues & Solutions

### Issue: `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` on `cargo test`
- **Symptom**: Test runner fails with exit code `0xc0000139` or complains that `TaskDialogIndirect` entrypoint is not found in `comctl32.dll`.
- **Cause**: By default, Windows loads Common Controls v5.82 for test binaries because test executables do not inherit the default application manifest.
- **Solution**: Handled automatically in [`src-tauri/build.rs`](file:///d:/client%20Project/Infinity-Researcher/src-tauri/build.rs) by embedding the v6 manifest dependency:
  ```rust
  #[cfg(target_os = "windows")]
  {
      println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
      println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
      let attrs = tauri_build::WindowsAttributes::new_without_app_manifest();
      tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs)).unwrap();
  }
  ```

### Issue: `CVTRES : fatal error CVT1100: duplicate resource. type:MANIFEST, name:1`
- **Cause**: The MSVC linker received a custom `/MANIFEST:EMBED` linker arg while `tauri_build` simultaneously generated an internal manifest resource.
- **Solution**: Use `tauri_build::WindowsAttributes::new_without_app_manifest()` on Windows builds.

---

## 2. Linux Issues & Solutions

### Issue: Missing `webkit2gtk-4.1` or `pkg-config` during cargo build
- **Symptom**: `pkg-config error: Could not run pkg-config` for `javascriptcoregtk-4.1` or `webkit2gtk-4.1`.
- **Solution**: Install WebKit2GTK 4.1 development headers:
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Issue: AppImage fails to launch with "FUSE error"
- **Symptom**: `dlopen(): error loading libfuse.so.2` when running AppImage on Ubuntu 22.04+ or modern distributions.
- **Solution**: Install `libfuse2`:
  ```bash
  sudo apt-get install -y libfuse2
  ```
  Or run with `--appimage-extract-and-run`.

### Issue: Headless CI test failure
- **Symptom**: Application exits with `Cannot open display: :0`.
- **Solution**: Wrap execution with virtual frame buffer:
  ```bash
  xvfb-run --auto-servernum ./infinity-researcher
  ```

---

## 3. macOS Issues & Solutions

### Issue: "Infinity Researcher is damaged and can't be opened" (Gatekeeper)
- **Symptom**: macOS Gatekeeper quarantines unsigned DMG or app downloaded from the web.
- **Cause**: File was downloaded from the internet and lacks Apple notarization ticket.
- **Workaround (Development Only)**:
  ```bash
  xattr -d com.apple.quarantine "/Applications/Infinity Researcher.app"
  ```
  Or Right-click → Open → Open.
- **Production Solution**: Enable Apple Developer ID signing and notarization via GitHub Actions secrets.

### Issue: M1/M2/M3 Architecture Mismatch (`bad CPU type in executable`)
- **Symptom**: macOS fails to execute the Python sidecar or llama-server with `bad CPU type`.
- **Cause**: An Intel (`x86_64`) binary was staged inside an Apple Silicon (`arm64`) application bundle.
- **Solution**: Ensure `scripts/build-python-sidecar.py --target aarch64-apple-darwin` is used for ARM64 builds. Verify with:
  ```bash
  file src-tauri/binaries/research-scraper-aarch64-apple-darwin
  ```

---

## 4. In-App Updater Issues

### Issue: "Signature verification failed"
- **Symptom**: In-app updater downloads new package but errors out with `Signature verification failed`.
- **Cause**: The public key in `tauri.conf.json` does not match the private key used to sign the update archive in GitHub Actions.
- **Solution**: Regenerate the key pair using `npm run tauri signer generate` and ensure the public key in `tauri.conf.json` and the secret `TAURI_SIGNING_PRIVATE_KEY` are synchronized.

### Issue: "Network request failed while checking for updates"
- **Symptom**: Updates card displays an error when checking for updates.
- **Cause**: Device is offline, GitHub API rate limit reached, or release assets not yet published.
- **Graceful Behavior**: The application catches network errors safely and alerts the user without crashing or disrupting the active research session.

