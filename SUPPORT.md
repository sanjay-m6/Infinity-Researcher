# SUPPORT & COMMUNITY GUIDELINES

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author & Creator:** Sanjay  
**Publisher & Developer Brand:** Infinity Web Technology  
**Copyright:** © 2026 Sanjay. All rights reserved.  

---

## 1. Getting Help

Welcome to the **Infinity Researcher** support guide. Whether you are conducting systematic literature reviews, scraping scholarly repositories, or evaluating research paper integrity, we are here to support your scholarly workflows.

### Primary Support Channels

1. **In-App Feedback & GitHub Issue Center:**
   - Launch directly inside the application via **Settings > Feedback & Bug Center** or via the keyboard shortcut / Command Palette (`Ctrl+K` -> "Report a Bug").
   - Categorize issues (Bug, Feature Request, Scraper Failure, PDF Reader, UI/UX, Performance, AI Hub, Installer).
   - Automatically attaches sanitized, redacted diagnostic data.
2. **GitHub Repository:**
   - **Issues:** [https://github.com/sanjay-m6/Infinity-Researcher/issues](https://github.com/sanjay-m6/Infinity-Researcher/issues)
   - **Discussions:** [https://github.com/sanjay-m6/Infinity-Researcher/discussions](https://github.com/sanjay-m6/Infinity-Researcher/discussions)

---

## 2. In-App Bug Reporting & Diagnostics

Infinity Researcher features an integrated, privacy-preserving feedback center:

### How It Works:
- **Direct Submission:** If you provide a GitHub Personal Access Token (`repo` or `public_repo` scope), the app creates the issue directly on GitHub and provides a one-click link to your new issue number.
- **Web Fallback (Zero Token Required):** If you do not have or do not wish to provide a token, clicking "Continue on GitHub" opens your default web browser with a prefilled issue form adhering to the repository issue template.
- **Automatic Sanitization:** All diagnostic outputs (system architecture, memory usage, OS version, error logs) are automatically scrubbed of personal paths, bearer tokens, and API credentials.

---

## 3. Common Troubleshooting Scenarios

### A. Python Scraping Engine Status
- **Symptom:** Scrapers or PDF extractors display "Engine Offline" or "Worker Unavailable".
- **Solution:** 
  1. Navigate to **Settings > System Diagnostics**.
  2. Verify that Python 3.10+ is detected on your system path.
  3. Ensure required dependencies (`scrapy`, `pydantic`, `pdfplumber`, etc.) are installed in your virtual environment.
  4. Click "Restart Python Engine" from the diagnostics panel.

### B. SQLite Database Locks or Reset
- **Symptom:** "Database locked" or corrupted database errors.
- **Solution:**
  1. Open **Settings > Data Management**.
  2. Click "Verify Database Integrity".
  3. If corruption occurred due to unexpected power outage, click "Create Backup" and then "Rebuild SQLite Index".

### C. PDF Rendering & Local CORS Issues
- **Symptom:** PDF preview displays a blank page or cross-origin security warning.
- **Solution:**
  1. Ensure the PDF file was downloaded into the managed storage directory.
  2. Open the paper via the built-in PDF Reader view, which utilizes Tauri custom asset protocol streaming (`tauri://localhost` or `asset://`).

---

## 4. Feature Requests & Roadmap Alignment

Feature ideas that enhance literature discovery, PRISMA review matrices, evidence extraction, citation graphs, and academic integrity analysis are highly encouraged. Please submit them using the **Feature Request** issue template on GitHub.
