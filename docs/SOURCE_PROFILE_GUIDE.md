# Source Profile Configuration & Selector Guide

This guide explains how to configure, preview, test, and troubleshoot website scraping profiles in the Research Paper Scraper desktop application.

---

## 1. How Source Profiles Work

A **Source Profile** defines the crawling boundary, safety rules, and DOM extraction instructions for a specific academic repository or journal origin.

Profiles are stored in the local SQLite database (`crawl_profiles` table). When a crawl job starts, the scheduler applies the profile's rules to every page it visits.

### Profile Structure
- **`domain`**: The allowed host origin (e.g. `biorxiv.org`). Subdomains are treated as separate origins unless explicitly approved.
- **`request_delay_ms`**: Minimum milliseconds to pause between consecutive HTTP requests (default: `1000` ms).
- **`max_depth`**: Maximum link hops from the seed URL (default: `2`).
- **`max_pages`**: Maximum number of unique pages visited during a crawl session (default: `20`).
- **`use_meta_tags`**: When enabled, the parser prioritizes standard scholarly HTML `<meta>` tags (`citation_*`, `DC.*`) before evaluating CSS selectors.
- **`allowed_patterns`**: Regular expressions filtering URLs eligible for crawling (e.g. `^/content/10\.1101/`).
- **`disallowed_patterns`**: Regular expressions identifying paths to immediately skip (e.g. `^/login`, `^/admin`, `^/cart`).

---

## 2. Configuring Custom CSS Selectors

When a journal or repository website does not render Highwire Press or Dublin Core meta tags, you can specify custom CSS selectors:

| Field | Selector Example | Description |
| :--- | :--- | :--- |
| **Title Selector** | `h1.article-title`, `h1.c-article-title` | CSS selector matching the main paper title element. |
| **Authors Selector** | `.authors-list a`, `span.c-author-list__item` | CSS selector matching author name nodes. Matches multiple elements into an author array. |
| **Abstract Selector** | `.abstract p`, `section.abstract-content` | CSS selector pointing to the abstract paragraph or text block. |
| **DOI Selector** | `span.doi-value`, `a.doi-link` | CSS selector for the DOI string or link target. |
| **PDF Link Selector** | `a.pdf-download-link`, `a[href$=".pdf"]` | CSS selector targeting visible full-text download anchors. |

---

## 3. Step-by-Step Wizard Workflow

1. Navigate to **Sources** in the left sidebar.
2. Ensure the **Website Scraping Profiles** tab is selected.
3. Click **Add Website Source**.
4. **Step 1: Seed URL & Robots.txt**:
   - Enter the journal section or table-of-contents URL (e.g. `https://journals.plos.org/plosone/`).
   - Click **Check Policy**. The engine fetches `/robots.txt`, identifies crawler restrictions, and sets polite crawl delay defaults.
5. **Step 2: Acquisition Mode**:
   - Select **Public HTML Crawl** (recommended for standard static sites).
   - Or select **Manual Current-Page Import Only** if the site terms discourage automated traversal.
6. **Step 3: Scope & Extraction Rules**:
   - Review or adjust Max Depth, Max Pages, and Request Delay.
   - Enter optional fallback CSS selectors if necessary.
7. **Step 4: Review & Test**:
   - Review settings and click **Save Profile Only** or **Save & Start Crawl**.

---

## 4. Live Testing in the Sandbox

Before executing a large crawl, test any target URL in the built-in **URL Extraction Sandbox**:
1. Open **Sources** -> **Website Scraping Profiles**.
2. Locate the **URL Extraction Sandbox** card at the top.
3. Paste a specific research paper article URL.
4. Select your profile (or choose "Auto-Detect Profile").
5. Click **Preview Extraction**.
6. The sandbox displays:
   - Extracted Title, Author list, DOI, Date, Venue, Abstract snippet.
   - Full-text PDF link (if publicly accessible).
   - List of discovered paper links on that page.
   - Warning notes regarding robots or parsing ambiguities.

---

## 5. Troubleshooting & Best Practices

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 429 Too Many Requests** | Request rate too high for target website | Increase `request_delay_ms` to `3000` or `5000` in profile. |
| **0 Papers Discovered** | Seed page links did not match `allowed_patterns` | Check URL regex patterns; ensure article detail URL paths are covered. |
| **Missing Authors or DOI** | Non-standard HTML markup | Inspect page DOM using browser DevTools and add specific CSS selectors in profile. |
| **Robots.txt Disallowed** | Target section is restricted by site policy | Respect the restriction. Switch to **Manual Single-Page Import** if permitted. |
| **Corrupt PDF Warning** | Server returned HTML paywall or sign-in redirect | Verify if paper is open-access. The engine automatically rejects HTML masquerading as PDF. |
