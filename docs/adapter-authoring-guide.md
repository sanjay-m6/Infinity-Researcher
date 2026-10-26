# Adapter Authoring Guide: Adding a New Academic Website Connector

This guide outlines the protocol and architectural steps required to implement a new academic website connector in the Research Paper Scraper desktop application.

---

## 1. Pre-Implementation Policy & Verification Check

Before writing any scraping or extraction code:

1. **Inspect Terms of Service & Robot Directives**:
   - Verify the site's terms do not explicitly prohibit automated retrieval of search results or open access articles.
   - Inspect `https://<domain>/robots.txt` for disallow directives on search routes.
2. **Document Findings**:
   - Add the proposed repository to `docs/source-policy-matrix.md` with URLs to its terms, robots policy, and crawl-delay guidelines.
3. **Conservative Stance**:
   - If terms are ambiguous or prohibit robotic scraping, mark the adapter `Manual Only` and support manual BibTeX/DOI import.

---

## 2. Implementing the Website Adapter in Rust

All website search adapters live in `src-tauri/src/scrapers/query_search.rs`.

### Step 1: Add Source Descriptor
In `WebsiteSearchEngine::list_sources()`:
```rust
WebsiteSourceDescriptor {
    id: "my_repo".to_string(),
    name: "My Scholarly Repository".to_string(),
    domain: "myrepo.org".to_string(),
    status: "enabled".to_string(), // "enabled" | "disabled" | "manual_only"
    policy_url: "https://myrepo.org/terms".to_string(),
    policy_notes: "Public repository with permitted HTML search.".to_string(),
    supports_native_years: true,
    request_delay_ms: 2500,
    content_types: vec!["preprint".to_string(), "journal_article".to_string()],
}
```

### Step 2: Build the Public Search URL
Implement a URL constructor helper:
```rust
fn build_myrepo_url(query: &WebsiteSearchQuery) -> Result<String, String> {
    let encoded = urlencoding_encode(&query.query);
    let mut url = format!("https://myrepo.org/search?q={encoded}");
    if let Some(y) = query.year_start {
        url.push_str(&format!("&from={y}"));
    }
    // Validate target destination with Anti-SSRF guard
    UrlGuard::validate_url(&url).map_err(|e| format!("{e}"))?;
    Ok(url)
}
```

### Step 3: Fetch and Parse HTML
Implement the parser extracting only visible HTML elements:
```rust
async fn search_myrepo(&self, query: &WebsiteSearchQuery) -> Result<Vec<DiscoveredSearchResult>, String> {
    let search_url = Self::build_myrepo_url(query)?;
    let html_body = self.fetch_html(&search_url).await?;
    let document = Html::parse_document(&html_body);
    // Parse selector items, extract title, authors, doi, pdf link
    // ...
    Ok(results)
}
```

### Step 4: Normalization & Provenance
Every record must be returned as a `DiscoveredSearchResult` with:
- `source_id`: e.g. `"my_repo"`.
- `source_name`: Display name.
- `canonical_doi`: Cleaned DOI if displayed on the page.
- `is_open_access`: Only `true` if an explicit CC license or OA badge is confirmed.
- `pdf_url`: Direct public PDF URL if exposed.

---

## 3. Network & Security Constraints

- **Never bypass CAPTCHA, Cloudflare, or IP blocks**: On 403 or 429 status, record failure and report cleanly to the user.
- **Enforce Body Limits**: Max 10 MB body size.
- **Polite Request Headers**: Include a descriptive `User-Agent`.
