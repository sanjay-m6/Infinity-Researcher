# Academic Provider Setup & Credentials Guide

**Document:** Phase 5 Provider Configuration & Rate Limits  
**Application:** Research Paper Scraper  
**Status:** Implemented & Verified  

---

## 1. Zero-Configuration Default Experience

Research Paper Scraper is designed to work immediately upon installation **without requiring any accounts, API keys, or subscriptions**.

All 5 core academic sources function out-of-the-box using official public access pools:

| Provider | Default Access Mode | Default Rate Limit | API Key Needed? |
|:---|:---|:---|:---:|
| **OpenAlex** | Public Polite Pool | 10 requests / second | **Optional** |
| **Crossref** | Public Open REST API | 5–10 requests / second | **None** |
| **Semantic Scholar** | Public Shared Graph Pool | 1 request / second | **Optional** |
| **arXiv** | Public Atom XML API | 1 request every 3 seconds | **None** |
| **Europe PMC** | Public Bio-REST Web Service | 10 requests / second | **None** |

---

## 2. Optional Provider API Keys

For researchers performing high-frequency searches, large literature reviews, or automated bibliography construction, two providers offer free API keys to increase request quotas:

### 2.1 Semantic Scholar (AI2) API Key
- **Why configure?** The unauthenticated public pool is shared across all global public users. During peak academic hours, public requests may occasionally receive HTTP 429 ("Rate limited"). A registered key provides a dedicated quota of **10 requests per second** (up from 1 req/s).
- **How to obtain:**
  1. Visit the [Semantic Scholar Academic Graph API Portal](https://www.semanticscholar.org/product/api).
  2. Request a free API key for academic/non-commercial research.
  3. Copy your API key (a 40-character alphanumeric string).
- **Setup in App:**
  1. Open **Settings & Diagnostics** in the desktop application.
  2. Locate the **Academic Provider API Keys** section.
  3. Paste your key into the **Semantic Scholar** field and click **Save Key**.
  4. The status badge will update to **Key Configured (10 req/s)**.

### 2.2 OpenAlex API Key
- **Why configure?** OpenAlex allows up to 100,000 calls per day in their public pool, but providing an API key grants access to their premium tier of **50 requests per second** (up from 10 req/s).
- **How to obtain:**
  1. Register for a free OpenAlex account at [https://openalex.org](https://openalex.org).
  2. In your user profile, generate a free API key.
- **Setup in App:**
  1. Open **Settings & Diagnostics**.
  2. Paste your key into the **OpenAlex** field and click **Save Key**.
  3. The status badge will update to **Key Configured (50 req/s)**.

---

## 3. Security & Credential Storage Architecture

To ensure strict privacy and user security:
1. **Never Stored in Source or Logs:** API keys are never hardcoded, written to configuration JSON files, or tracked by Git.
2. **Local SQLite Persistence:** When entered, keys are saved into the local `settings` SQLite table (`semantic_scholar_api_key`, `openalex_api_key`) via the `SettingsRepository`.
3. **Rust-Enforced Redaction:** All Rust tracing and error formatters automatically strip and redact any authorization headers (`x-api-key`, `api_key`, `Bearer ...`) before writing to application log files.
4. **No Frontend Exposure:** The `get_provider_config_status` Tauri IPC command returns boolean configuration flags (`is_configured: true/false`), never the actual plaintext secret keys.
5. **Zero Cloud Telemetry:** Credentials are used solely for direct HTTPS communication with `api.semanticscholar.org` or `api.openalex.org`. No proxy servers or third-party tracking services are involved.

---

## 4. Troubleshooting & Common Issues

### Issue 1: Semantic Scholar shows "Rate Limited" status
- **Cause:** The public shared pool has temporarily reached capacity.
- **Resolution:** Wait 2–3 seconds and click **Retry**, or enter a free Semantic Scholar API key in Settings.

### Issue 2: arXiv queries take longer to complete
- **Cause:** arXiv's official access policy requires a minimum 3.0-second pause between automated requests to protect their repository infrastructure.
- **Resolution:** This is expected polite behavior enforced by the application's `RateLimiter` to avoid IP address blacklisting.

### Issue 3: Paper results have no PDF link
- **Cause:** Many academic publishers maintain closed access paywalls (e.g. Elsevier, Springer Nature).
- **Resolution:** Research Paper Scraper strictly respects legal access boundaries. Only papers legitimately identified as Open Access by arXiv, Europe PMC, or OpenAlex will display direct PDF download links. For paywalled papers, use the canonical landing page link to access via your university library credentials.
