# Code Signing & Notarization Guide — Infinity Researcher

Comprehensive guide for configuring code signing, certificates, and notarization across Windows, macOS, and Linux.

---

## 1. Why Code Signing Matters

Unsigned software triggers severe OS security warnings:
- **Windows**: Microsoft SmartScreen ("Windows protected your PC — Unknown Publisher").
- **macOS**: Apple Gatekeeper ("Infinity Researcher cannot be opened because the developer cannot be verified").
- **Linux**: Integrity verification and package manager trust.

---

## 2. Windows Code Signing (Authenticode)

### Prerequisites
- An **EV (Extended Validation)** or Standard Code Signing Certificate from a trusted Certificate Authority (DigiCert, Sectigo, etc.).
- Azure Trusted Signing (Microsoft's modern cloud HSM signing service).

### Configuration in Tauri
In [`src-tauri/tauri.conf.json`](file:///d:/client%20Project/Infinity-Researcher/src-tauri/tauri.conf.json), under `bundle.windows`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

Or using `signtool.exe` in CI:
```powershell
signtool sign /f certificate.pfx /p $CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 Infinity-Researcher_x64-setup.exe
```

---

## 3. macOS Code Signing & Apple Notarization

### Prerequisites
- An active **Apple Developer Program** membership (\$99/year).
- **Developer ID Application** certificate (`.p12`).
- App-Specific Password generated on [appleid.apple.com](https://appleid.apple.com).

### GitHub Actions Environment Variables
Set the following repository secrets:

```env
APPLE_CERTIFICATE=<base64-encoded .p12 certificate>
APPLE_CERTIFICATE_PASSWORD=<p12 password>
APPLE_SIGNING_IDENTITY="Developer ID Application: Sanjay (TEAM_ID)"
APPLE_ID=sanjay@example.com
APPLE_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_TEAM_ID=XXXXXXXXXX
```

### Automated Notarization via Tauri
Tauri CLI automatically detects these environment variables during `npm run tauri build`:
1. Codesigns the `.app` bundle and embedded binaries (including Python sidecar).
2. Creates the `.dmg` package.
3. Submits the DMG to Apple Notary Service via `xcrun notarytool submit`.
4. Staples the notarization ticket to the DMG using `xcrun stapler staple`.

### Development Fallback
When signing secrets are not present in GitHub Actions, the workflows automatically fall back to unsigned builds for pull requests and development artifacts, allowing contributors to build and test without requiring Apple credentials.

---

## 4. Linux Package Signing (GPG)

For Debian repositories or RPM packages, packages can be signed with GPG keys:

```bash
# Sign Debian package with debsign
debsign -k $GPG_KEY_ID infinity-researcher_amd64.deb

# Sign RPM with rpm-sign
rpm --addsign infinity-researcher-1.x86_64.rpm
```

