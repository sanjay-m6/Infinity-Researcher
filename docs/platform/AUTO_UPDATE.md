# Automatic Updates System — Infinity Researcher

Technical specifications and operations manual for **Infinity Researcher's** cross-platform in-app automatic updater system.

---

## 1. System Architecture

The auto-update system utilizes Tauri v2's official `@tauri-apps/plugin-updater` and cryptographic signing via **Minisign Ed25519**.

```
                   +----------------------------------+
                   |   GitHub Releases / Updates CDN  |
                   |      latest.json & Binaries      |
                   +----------------------------------+
                                    |
                    HTTPS GET (Polling or Manual Check)
                                    v
                   +----------------------------------+
                   |  Tauri In-App Updater Engine     |
                   |   (Tauri Plugin + Rust Core)     |
                   +----------------------------------+
                                    |
          1. Check Version (SemVer comparison)
          2. Verify Cryptographic Minisign Signature (.sig)
          3. Download Staged Archive
          4. Validate Integrity
          5. Prompt User & Trigger Relaunch via Tauri Process Plugin
                                    v
                   +----------------------------------+
                   |   Updated Application Staged     |
                   |   Database & User Data Preserved |
                   +----------------------------------+
```

---

## 2. Cryptographic Security & Minisign Key Generation

All release packages must be cryptographically signed with an Ed25519 private key before the client application will accept or install them.

To generate a new updater key pair:

```bash
# Using the Tauri CLI
npm run tauri signer generate -- -w ~/.tauri/infinity_researcher.key
```

This generates:
- **Public Key**: Placed in [`src-tauri/tauri.conf.json`](file:///d:/client%20Project/Infinity-Researcher/src-tauri/tauri.conf.json) under `plugins.updater.pubkey`.
- **Private Key**: Configured as repository secret `TAURI_SIGNING_PRIVATE_KEY` on GitHub Actions.
- **Passphrase**: Configured as repository secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

---

## 3. Multi-Platform Update Manifest (`latest.json`)

The updater manifest maps platform target triples to their respective updater archives, cryptographic signatures, and release notes.

Example `latest.json`:

```json
{
  "version": "v0.1.0",
  "notes": "Infinity Researcher v0.1.0 release.",
  "pub_date": "2026-11-03T18:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/Sanjay-Infinity-Researcher/releases/download/v0.1.0/Infinity-Researcher_0.1.0_x64-setup.nsis.zip"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/Sanjay-Infinity-Researcher/releases/download/v0.1.0/Infinity-Researcher_0.1.0_amd64.AppImage.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/Sanjay-Infinity-Researcher/releases/download/v0.1.0/Infinity.Researcher.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/Sanjay-Infinity-Researcher/releases/download/v0.1.0/Infinity.Researcher.app.tar.gz"
    }
  }
}
```

This manifest is generated automatically on every release build by [`scripts/generate-update-manifest.mjs`](file:///d:/client%20Project/Infinity-Researcher/scripts/generate-update-manifest.mjs).

---

## 4. In-App User Experience

In the frontend, the updater is exposed through:
- **Hook**: [`src/features/updater/useAppUpdater.ts`](file:///d:/client%20Project/Infinity-Researcher/src/features/updater/useAppUpdater.ts)
- **UI Component**: [`src/features/updater/UpdateSettingsCard.tsx`](file:///d:/client%20Project/Infinity-Researcher/src/features/updater/UpdateSettingsCard.tsx) located in **Settings → General → Application Updates & Releases**.

Features:
- **Channel Switching**: Stable and Beta release channels.
- **Auto Check on Launch**: Automatically polls for updates in the background.
- **Manual Check**: Button to force an immediate check against GitHub Releases.
- **Progress Tracking**: Real-time download percentage and byte counters.
- **Restart Prompt**: User-controlled restart to apply updates safely without losing current research sessions.

---

## 5. Safe Upgrade Guarantee (Data Protection)

When an update is applied:
1. SQLite database files (`research_library.db`), WAL journals, and migration ledgers are stored in the user data directory (`%APPDATA%`, `~/.local/share`, or `~/Library/Application Support`).
2. Downloaded PDF research papers, annotations, and vector embeddings reside in the dedicated user library directory (`~/InfinityResearcher/Library`).
3. Only application binaries and static frontend assets are swapped during update installation.
4. On startup, SQLite migration scripts verify schema integrity and run pending migrations inside an atomic transaction.

