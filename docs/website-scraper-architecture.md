# Website Scraping Engine Architecture

This document describes the design and implementation of the Phase 6 **Website Scraping Engine** in the Research Paper Scraper desktop application.

---

## 1. Overview & Architectural Goals

The Website Scraping Engine enables researchers to crawl approved open-access scholarly web repositories, journals, and preprint servers directly from their desktop. Unlike commercial web scrapers or cloud microservices, this engine is:

1. **Local-First & Embedded:** Executes directly inside the desktop application via Rust (`reqwest`, `scraper`, `tokio`, `rusqlite`). No external daemon, server, or cloud node is required.
2. **Safe & Non-Aggressive:** Adheres strictly to RFC 9309 `robots.txt` specifications, respects domain boundaries, avoids infinite crawl loops, enforces request throttling (`crawl_delay_ms`), and protects internal networks via robust Anti-SSRF guards.
3. **Scholarly Standards-Compliant:** Extracts structured scholarly metadata adhering to Highwire Press (`citation_*`), Dublin Core (`DC.*`), Schema.org JSON-LD (`ScholarlyArticle`, `MedicalScholarlyArticle`), and site-specific CSS selector fallbacks.
4. **Resilient & Recoverable:** Crawl jobs, frontier queues, visited URL sets, and discovered scholarly records are persistently maintained in SQLite across application restarts with full Pause, Resume, and Cancel semantics.

---

## 2. Core Components

```
+---------------------------------------------------------------------------------+
|                               React 19 Frontend                                 |
|  - DownloadsView: Active Job Monitor, Queue Progress, Discovered Papers Drawer   |
|  - SourcesView: Scraping Profiles Config, Custom Rules, Live Extraction Preview |
+---------------------------------------------------------------------------------+
                                      |
                            Tauri 2 IPC Boundary
                                      |
+---------------------------------------------------------------------------------+
|                          Rust Backend (src-tauri/src)                           |
|                                                                                 |
|  [crawl.rs Commands] <---> [CrawlRepository] <---> [SQLite DB (Migration 0002)]  |
|          |                         |                                            |
|          v                         v                                            |
|  [CrawlEngine Controller] ---> [Active Workers Map (Arc<AtomicBool>)]           |
|          |                                                                      |
|          +---> [UrlGuard] (SSRF Protection, Domain Match, Pattern Regex)        |
|          +---> [RobotsCache / RobotsTxt] (RFC 9309 Parsing, Crawl-Delay)        |
|          +---> [HtmlExtractor] (Highwire, Dublin Core, JSON-LD, CSS Selectors)  |
|          +---> [PaperService / PaperRepository] (Library Import & Provenance)   |
+---------------------------------------------------------------------------------+
```

### 2.1. URL Guard & Anti-SSRF Engine (`scrapers/url_guard.rs`)
The `UrlGuard` provides strict validation and sanitization for all crawled and user-supplied URLs:
- **Protocol Enforcement:** Only `http://` and `https://` schemes are permitted. Schemes like `file://`, `ftp://`, `gopher://`, or `javascript:` are rejected immediately.
- **Anti-SSRF Protection:**
  - Blocks IPv4 loopback (`127.0.0.0/8`).
  - Blocks IPv4 private subnets (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Blocks IPv4 link-local and cloud metadata addresses (`169.254.0.0/16`, specifically protecting AWS/GCP/Azure instance metadata endpoints like `169.254.169.254`).
  - Blocks IPv6 loopback (`::1`, `[::1]`) and unspecified addresses (`::`).
  - Blocks local hostnames (e.g., `localhost`, `*.local`, `*.internal`).
- **URL Normalization:** Strips URL fragments (`#section`) and marketing/tracking query parameters (`utm_*`, `ref`, `fbclid`) to prevent redundant crawling and infinite duplicate loops.
- **Scope & Pattern Matching:** Verifies that candidate URLs belong to the allowed domains list and match configured regex inclusion/exclusion rules.

### 2.2. RFC 9309 Robots.txt Parser & Cache (`scrapers/robots.rs`)
- Parses standard `robots.txt` files per RFC 9309 specifications.
- Supports grouped `User-agent:` blocks (e.g. `User-agent: ResearchPaperScraper`, falling back to `User-agent: *`).
- Handles `Allow:` and `Disallow:` directives with wildcards (`*`) and end-anchors (`$`), resolving precedence by the length of the matching pattern.
- Extracts `Crawl-delay:` directives and enforces minimum delay times (configured default: 1000ms minimum).
- In-memory `RobotsCache` caches parsed rules per origin domain (`scheme://host:port`) to minimize unnecessary HTTP requests.

### 2.3. Multi-Standard Scholarly Extractor (`scrapers/extractor.rs`)
Academic publishers utilize standardized meta tags for Google Scholar, PubMed, and citation managers. `HtmlExtractor` executes extraction across four tiered strategies:
1. **Highwire Press Meta Tags:**
   - Title: `<meta name="citation_title" content="...">`
   - Authors: `<meta name="citation_author" content="...">` (preserves ordering and multi-authors)
   - DOI: `<meta name="citation_doi" content="...">`
   - Date: `<meta name="citation_publication_date" content="...">` / `<meta name="citation_date" content="...">`
   - Journal/Venue: `<meta name="citation_journal_title" content="...">` / `<meta name="citation_conference_title" content="...">`
   - PDF URL: `<meta name="citation_pdf_url" content="...">`
2. **Dublin Core Meta Tags:**
   - Title: `<meta name="DC.title" content="...">` / `dc.title`
   - Authors: `<meta name="DC.creator" content="...">` / `dc.creator`
   - Date: `<meta name="DC.date" content="...">`
   - Description/Abstract: `<meta name="DC.description" content="...">`
3. **Schema.org JSON-LD:**
   - Detects `<script type="application/ld+json">` blocks representing `ScholarlyArticle`, `MedicalScholarlyArticle`, or `Article`.
   - Maps `headline`, `name`, `author`, `abstract`, `description`, `datePublished`, and `publisher`.
4. **Site-Specific CSS Selectors:**
   - Fallback selectors configured in `CrawlProfile` (e.g. custom container elements, title headers, and abstract containers).

### 2.4. Crawl Engine & Job Coordinator (`scrapers/engine.rs`)
- **Queue & Depth Tracking:** Crawl items are stored in SQLite `crawl_queue` with explicit `depth` and status (`pending`, `fetching`, `visited`, `failed`, `skipped`).
- **Worker Concurrency & Interruption:**
  - Crawl jobs run asynchronously in background Tokio tasks.
  - Active jobs register an `Arc<AtomicBool>` cancellation/pause flag in `CrawlEngineState`.
  - When the user clicks **Pause** or **Cancel**, the atomic flag immediately interrupts fetching and cleanly updates job state in SQLite.
- **Polite Request Throttling:**
  - Implements adaptive crawl delays based on profile settings and `robots.txt` `Crawl-delay`.
  - Configurable request timeouts (default: 15s) and maximum response sizes (default: 5MB) prevent memory exhaustion on large binary assets.

---

## 3. Database Schema (Migration `0002_website_scraping_engine.sql`)

The scraping engine introduces four SQLite tables:

```sql
-- 1. Crawling Profiles
CREATE TABLE crawl_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    allowed_domains TEXT NOT NULL,       -- JSON array of strings
    start_urls TEXT NOT NULL,            -- JSON array of strings
    article_patterns TEXT NOT NULL,      -- JSON array of regex strings
    exclusion_patterns TEXT NOT NULL,    -- JSON array of regex strings
    respect_robots INTEGER NOT NULL,     -- 1 or 0
    crawl_delay_ms INTEGER NOT NULL,     -- e.g. 1500
    max_depth INTEGER NOT NULL,          -- e.g. 3
    max_pages INTEGER NOT NULL,          -- e.g. 100
    css_selectors TEXT NOT NULL,         -- JSON object of selectors
    is_built_in INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Crawl Jobs
CREATE TABLE crawl_jobs (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES crawl_profiles(id),
    name TEXT NOT NULL,
    start_url TEXT NOT NULL,
    status TEXT NOT NULL,                -- pending, running, paused, completed, failed, cancelled
    pages_crawled INTEGER NOT NULL,
    pages_discovered INTEGER NOT NULL,
    papers_extracted INTEGER NOT NULL,
    error_message TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Persistent URL Frontier Queue
CREATE TABLE crawl_queue (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    depth INTEGER NOT NULL,
    status TEXT NOT NULL,                -- pending, fetching, visited, failed, skipped
    http_status INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL,
    discovered_at TEXT NOT NULL,
    processed_at TEXT
);

-- 4. Discovered Scholarly Papers per Crawl Job
CREATE TABLE crawl_job_papers (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,               -- JSON array of strings
    doi TEXT,
    abstract_text TEXT,
    publication_date TEXT,
    venue TEXT,
    pdf_url TEXT,
    is_imported INTEGER NOT NULL,
    discovered_at TEXT NOT NULL
);
```

---

## 4. Security & Safety Principles

1. **Strict SSRF Immunity:**
   The desktop client never fetches loopback or internal LAN endpoints, preventing internal network enumeration attacks or cloud host compromise.
2. **Resource Boundaries:**
   - Total pages per crawl bounded by `max_pages`.
   - Traversal depth strictly bounded by `max_depth`.
   - Single page response body capped at 5 MB.
   - HTTP request timeout capped at 15 seconds.
3. **Non-Aggressive Crawler Behavior:**
   - Minimum request interval enforced.
   - Respects `robots.txt` Disallow rules by default.
   - Standard, identifiable User-Agent (`ResearchPaperScraper/1.0 (+https://github.com/desktop-research-scraper)`).
4. **No Evasion of Paywalls or Authentication:**
   The scraper strictly parses public HTML accessible to any browser without bypassing CAPTCHAs, DRM, or access controls.
