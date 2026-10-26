# Website Scraping Profiles Guide

This guide details the built-in scraping profiles and instructions for creating custom profiles in the Research Paper Scraper desktop application.

---

## 1. Built-in Profiles

The application comes pre-configured with 5 seed profiles stored in SQLite (`crawl_profiles` table, seeded via Migration `0002_website_scraping_engine.sql`):

| Profile ID | Target Repository / Journal | Allowed Domains | Article URL Patterns | Extraction Standards |
| :--- | :--- | :--- | :--- | :--- |
| `biorxiv` | bioRxiv Preprint Server | `biorxiv.org` | `^https?://(www\.)?biorxiv\.org/content/10\.\d{4,9}/.*` | Highwire Press (`citation_*`), DC |
| `nature` | Nature Journal Portfolio | `nature.com` | `^https?://(www\.)?nature\.com/articles/.*` | Schema.org JSON-LD, Highwire, DC |
| `plos` | Public Library of Science (PLOS) | `plos.org`, `journals.plos.org` | `^https?://journals\.plos\.org/plos(one\|biology\|pathogens\|genetics\|computationalbiology)/article\?id=.*` | Highwire Press, Dublin Core |
| `acm` | ACM Digital Library Open Articles | `dl.acm.org` | `^https?://dl\.acm\.org/doi/(abs\|full)/10\.\d{4,9}/.*` | Highwire Press, Dublin Core |
| `generic` | Generic Scholarly Web Page | `*` (Any valid domain) | Any valid URL | Highwire, Dublin Core, Schema.org, CSS |

---

## 2. Profile Structure & Configuration Fields

When configuring a profile in `SourcesView` or via the backend `crawl.rs` commands:

```json
{
  "id": "custom-journal-profile",
  "name": "Custom Journal / University Repository",
  "description": "Scrapes open repository papers matching specific regex patterns",
  "allowed_domains": ["openrepository.edu", "papers.openrepository.edu"],
  "start_urls": ["https://openrepository.edu/recent-publications"],
  "article_patterns": ["^https?://openrepository\\.edu/papers/\\d+.*"],
  "exclusion_patterns": ["/login", "/search", "\\.zip$", "\\.tar\\.gz$"],
  "respect_robots": true,
  "crawl_delay_ms": 1500,
  "max_depth": 2,
  "max_pages": 50,
  "css_selectors": {
    "title": "h1.paper-title",
    "authors": ".author-list .author-name",
    "abstract": "#abstract-content",
    "doi": ".doi-badge a",
    "pdf_url": "a.download-pdf-button"
  },
  "is_built_in": false
}
```

### Explanation of Settings:
- **`allowed_domains`**: List of hostnames the crawler is strictly permitted to visit. Any links discovered pointing to other hostnames (e.g., social links, external ad networks) are dropped immediately.
- **`start_urls`**: Seed URLs where the crawler begins crawling.
- **`article_patterns`**: Regular expressions used to classify discovered links as research papers/articles versus general navigation pages (indexes, archives, pagination). If a URL matches an article pattern, full metadata extraction is executed.
- **`exclusion_patterns`**: Regular expressions identifying URLs to skip unconditionally (e.g. login links, cart links, comment sections, non-paper binary archives).
- **`respect_robots`**: Boolean flag indicating whether `robots.txt` rules and crawl delays must be enforced (strongly recommended `true`).
- **`crawl_delay_ms`**: Minimum pause between HTTP requests to the same origin (default: 1,000–2,000 ms).
- **`max_depth`**: Maximum link hops from the seed URL (e.g., depth 0 = seed URL, depth 1 = links directly on seed URL, etc.).
- **`max_pages`**: Hard ceiling on total pages fetched per job to prevent runaway crawling.
- **`css_selectors`**: Site-specific selectors used when standard meta tags (`citation_*`, `DC.*`) are absent or incomplete.

---

## 3. Metadata Extraction Fallback Chain

When the crawler encounters an article page:

1. **Step 1: Highwire Press Meta Tags**
   The crawler inspects `<meta name="citation_title">`, `<meta name="citation_author">`, `<meta name="citation_doi">`, `<meta name="citation_pdf_url">`, and `<meta name="citation_publication_date">`. This covers the vast majority of academic publications (bioRxiv, medRxiv, Nature, Springer, Wiley, Science, PLOS, arXiv HTML, etc.).
2. **Step 2: Dublin Core Meta Tags**
   If title or author is missing, the extractor checks `<meta name="DC.title">`, `<meta name="DC.creator">`, `<meta name="DC.date">`, and `<meta name="DC.description">`.
3. **Step 3: Schema.org JSON-LD**
   The extractor scans for `<script type="application/ld+json">` matching `@type: "ScholarlyArticle"` or `"Article"`.
4. **Step 4: Custom CSS Selectors**
   If meta tags are absent or missing essential fields, the custom CSS selectors configured in the profile are evaluated against the parsed DOM.

---

## 4. Live Extraction Preview Sandbox

Before launching a large crawling job, researchers can test extraction rules in the **Sources** view:
1. Navigate to **Academic Sources** -> Click **Website Scraping Profiles** tab.
2. Select any active profile (e.g., *bioRxiv* or *PLOS*).
3. Paste a sample article URL into the **Live Extraction Preview Sandbox**.
4. Click **Test Extraction**.
5. The desktop backend fetches the page under SSRF and timeout guards, runs the multi-standard extraction pipeline, and displays the exact extracted Title, Authors, DOI, Abstract, Date, and PDF URL in real time.
