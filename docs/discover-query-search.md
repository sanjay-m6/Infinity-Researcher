# Discover Research Papers: Query-Based Search & Advanced Filters

## Overview

The **Discover** module in Research Paper Scraper has been upgraded to a **query-first research discovery engine**. Instead of requiring users to manually locate and paste a seed URL, researchers can now enter natural-language research topics, authors, or keywords directly (e.g. `machine learning for medical image segmentation`).

The application automatically queries supported, policy-verified academic websites over normal public HTML search pages, extracts structured metadata, provides comprehensive multi-attribute filtering, and integrates directly with the three-pane workspace (Results, Embedded PDF Reader, and Details/Notes).

---

## Key Principles & Compliance

1. **Strictly No Academic API Keys or API Calls**:
   - Zero reliance on Crossref, OpenAlex, Semantic Scholar, arXiv APIs, or publisher internal/hidden JSON endpoints.
   - All queries navigate ordinary public HTML search listings using transparent User-Agents (`ResearchPaperScraper/1.0 (+https://github.com/academic-scraper)`).

2. **Compliance & Policy Verification**:
   - Automated keyword searching is enabled **only** for academic websites whose public terms and `robots.txt` permit automated exploration at conservative request rates.
   - Restricted websites (e.g. Google Scholar, IEEE Xplore) are clearly identified with status badges and explanations, rather than falsified.
   - For restricted sites like IEEE, manual workflows (e.g., BibTeX import, DOI lookup, and local OA PDF attachment) are provided.

3. **Anti-SSRF & Network Safety**:
   - All HTTP requests pass through `UrlGuard`, blocking loopback (`127.0.0.1`), private subnets (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), link-local (`169.254.0.0/16`), and non-public IPs.
   - Redirect chains are bounded (maximum 4 hops) and re-validated at every hop.
   - Body streaming is capped at 10 MB per response to prevent resource exhaustion.

---

## User Workflow

### 1. Natural Language & Keyword Search
- **Primary Search Bar**: Located prominently at the top of the Discover workspace.
- **Example Queries**:
  - `machine learning for medical image segmentation`
  - `renewable energy forecasting using neural networks`
  - `large language models in software engineering`
  - `"federated learning" AND healthcare`
- **Actions**:
  - Press <kbd>Enter</kbd> or click **Search** to execute concurrent requests across selected sources.
  - Click **Clear (X)** to reset query.
  - Click **Cancel** during an active search to abort in-flight requests cleanly.
  - Recent searches are persisted locally in `localStorage` with a 1-click re-search and clear history option.

### 2. Multi-Select Source Picker
- Filter searches across specific repositories or choose **All Enabled Sources**.
- Real-time badges indicate source policy status:
  - `Policy Checked` (arXiv, bioRxiv, medRxiv, PLOS, Nature Scientific Reports, PMC).
  - `Manual Only` (IEEE Xplore: terms prohibit automated crawling).
  - `Disabled` (Google Scholar: terms strictly forbid automated access and utilize CAPTCHAs).

### 3. Advanced Filtering & Sorting
A responsive, collapsible filter panel enables targeted refinement:
- **Publication Year**: From/To numeric year inputs, plus quick ranges: `Last 1 yr`, `Last 3 yrs`, `Last 5 yrs`, `Last 10 yrs`, and `All`.
- **Content Type**: `All`, `Preprint`, `Journal Article`, `Review`, `Conference Paper`.
- **Access Status**: `All`, `Confirmed Open Access`, `PDF Available`.
- **Author**: Text search matching displayed author names.
- **Venue & Subject**: Matches repository tags or journal venues.
- **Sorting**:
  - `Best Match` (source relevance score / query matching).
  - `Newest First` (descending publication year/date).
  - `Oldest First` (ascending publication year/date).
  - `Title A–Z` & `Author A–Z`.
- **Active Filter Chips**: Quickly inspect active filters with a single **Clear All** button.

### 4. Relocated URL Inspection & Crawl Tools
- Normal keyword research no longer requires or displays seed URLs.
- For repository administrators or manual URL troubleshooting, the URL tool is relocated to a collapsible section:
  **"Advanced: Inspect / Crawl a Permitted Website URL"**.
- Contains seed presets (`bioRxiv Recent`, `PLOS ONE`, `Nature Scientific Reports`, `arXiv CS List`), `Inspect Page`, and `Start Crawl` background jobs.

---

## Three-Pane Workspace Integration

- **Left Pane (Discovered Papers)**:
  - Scannable cards showing Title, Authors, Year, Venue, Source badge (e.g. `arXiv`, `PLOS`), Access badge (`OA`, `Access not verified`), and Download status.
- **Center Pane (PDF Reader & Retrieval)**:
  - Displays embedded PDF reader when a local document is downloaded.
  - Displays a truthful retrieval state when not downloaded: shows discovered direct PDF link with a **Download Full-Text PDF** action button.
  - If no direct PDF link is exposed on the webpage, provides an **Open Source Page** button. Never renders fabricated PDF previews.
- **Right Pane (Details & Persistent Notes)**:
  - Verified metadata, DOI copy button, full abstract, landing page link, **Save to Library** action, **Add to Collection** selector, and persistent SQLite research notes.
