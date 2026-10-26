# End-User Installation & User-Data Lifecycle Guide

**Project:** Research Paper Scraper  
**Application Version:** 0.1.0  
**Target Platform:** Windows 10 / Windows 11 (64-bit)  

---

## 1. System Requirements

* **OS:** Windows 10 (64-bit, Version 19041+) or Windows 11.
* **Component:** Microsoft Edge WebView2 (installed by default on Windows 10/11).
* **Disk Space:** ~50 MB for the application; additional storage as your research library grows.

---

## 2. Installation Instructions

### Option A: Standard Windows Installer (Recommended)
1. Download `Research Paper Scraper_0.1.0_x64_en-US.msi`.
2. Double-click the `.msi` file to launch the Windows Setup wizard.
3. Follow the on-screen prompts to complete the installation.
4. Launch **Research Paper Scraper** from the Start Menu or desktop shortcut.

> **Note on Windows SmartScreen:** If Windows displays an *"Unknown Publisher"* prompt during initial installation of an unsigned evaluation build, click **"More info"** and choose **"Run anyway"**.

### Option B: Standalone Portable Binary
1. Download `research-paper-scraper.exe`.
2. Place the executable in your preferred directory (e.g., `D:\Tools\ResearchPaperScraper\`).
3. Run `research-paper-scraper.exe` directly.

---

## 3. Data Storage & Privacy Architecture

The Research Paper Scraper is a **local-first application**. Your research papers, notes, tags, and reading progress remain strictly on your local computer.

| Data Category | On-Disk Location |
|:---|:---|
| **SQLite Research Database** | `%APPDATA%\com.researchpaperscraper.desktop\research-paper-scraper.sqlite3` |
| **Database WAL & SHM Files** | `%APPDATA%\com.researchpaperscraper.desktop\research-paper-scraper.sqlite3-wal` |
| **Downloaded Research PDFs** | `%USERPROFILE%\Downloads\ResearchPapers\` (or user-configured directory) |
| **Diagnostic Application Logs** | `%LOCALAPPDATA%\com.researchpaperscraper.desktop\logs\` |

---

## 4. How to Back Up Your Research Library

To back up your research metadata, collections, and notes:
1. Close the **Research Paper Scraper** application.
2. Open Windows File Explorer and navigate to:
   `%APPDATA%\com.researchpaperscraper.desktop`
3. Copy `research-paper-scraper.sqlite3` (and the `-wal` file if present) to an external drive or cloud backup folder.
4. Also back up your downloaded research PDF directory.

---

## 5. Upgrade Behavior

When upgrading to a newer version of Research Paper Scraper:
1. Run the new version installer (`.msi`).
2. The installer upgrades the application binaries in place.
3. Your database and existing papers in `%APPDATA%` are **fully preserved**.
4. When the new version opens, database migrations automatically and transactionally update the schema to the latest version.

---

## 6. Uninstallation & Data Preservation

### Standard Uninstallation
1. Open Windows **Settings** > **Apps** > **Installed apps**.
2. Select **Research Paper Scraper** and click **Uninstall**.
3. The Windows installer removes application binaries and shortcuts from your computer.
4. **Your research library, notes, collections, and downloaded PDFs are preserved** in `%APPDATA%` to prevent accidental loss of valuable academic work.

### Complete Data Removal (Optional)
If you wish to delete all research data and reset the application completely:
1. Uninstall the application via Windows Settings.
2. Manually delete the `%APPDATA%\com.researchpaperscraper.desktop` folder.
3. Manually delete your downloaded PDF storage directory.

---

## 7. Troubleshooting Common Issues

### Issue 1: "WebView2 Runtime not found"
* *Cause:* WebView2 runtime is missing or disabled on the machine.
* *Fix:* Download and install the free Evergreen WebView2 Runtime directly from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### Issue 2: "Database locked or busy timeout"
* *Cause:* Another instance of the application is running in the background.
* *Fix:* Check Windows Task Manager, end any orphaned `research-paper-scraper.exe` processes, and relaunch the application.

### Issue 3: "Online search fails but local library works"
* *Cause:* Internet connection is down or an academic API provider is experiencing a temporary outage.
* *Explanation:* Research Paper Scraper local library and FTS5 search function completely offline. Remote discovery resumes once network connectivity is restored.
