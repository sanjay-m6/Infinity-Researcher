# PRIVACY POLICY

**Product Name:** Infinity Researcher  
**Tagline:** Discover. Understand. Research.  
**Author & Creator:** Sanjay  
**Publisher & Developer Brand:** Infinity Web Technology  
**Copyright:** © 2026 Sanjay. All rights reserved.  
**Effective Date:** October 26, 2026  

---

### OUR PRIVACY PHILOSOPHY: SOVEREIGN, LOCAL-FIRST RESEARCH

Infinity Researcher was engineered from the ground up to respect academic privacy, intellectual freedom, and confidential literature analysis. We believe that your research hypotheses, reading habits, unpublished paper drafts, literature reviews, and research matrices should belong solely to you.

---

### 1. ZERO TELEMETRY & ZERO CLOUD TRACKING

- **No Behavioral Analytics:** Infinity Researcher contains no Google Analytics, Mixpanel, PostHog, telemetry SDKs, or advertising trackers.
- **No Phone-Home Logging:** Launching, navigating, searching, or organizing your papers triggers zero tracking pings to our servers.
- **No Account Required for Core Operations:** You can install and use Infinity Researcher completely offline without creating an account or logging in.

---

### 2. LOCAL DATA STORAGE & STORAGE SOVEREIGNTY

- **Local SQLite Database:** All paper metadata, citations, collection structures, tags, review matrices, and custom notes are stored in a local SQLite database (`infinity-researcher.sqlite3` / `research-paper-scraper.sqlite3`) residing inside your local user data directory:
  - **Windows:** `%APPDATA%\com.infinitywebtechnology.infinityresearcher\`
  - **Linux:** `~/.config/infinity-researcher/`
  - **macOS:** `~/Library/Application Support/com.infinitywebtechnology.infinityresearcher/`
- **Full-Text PDF Storage:** Downloaded PDF manuscripts, cached extracts, and text representations remain exclusively on your local hard drive.
- **1-Click Complete Erasure:** You can completely wipe all locally saved papers, collections, caches, and crawl jobs directly from the **Settings > Data Management** view at any time.

---

### 3. THIRD-PARTY AI PROVIDER INTEGRATION & API KEYS

- **Local Key Storage:** If you configure AI assistant API keys (e.g., OpenAI, Anthropic, Google Gemini, Ollama, or Hugging Face), they are stored locally in your SQLite application settings table and are never transmitted to Infinity Web Technology.
- **Explicit Transmission Only:** AI requests are only initiated when you explicitly click an AI action (such as generating synthesis notes, extracting claims in the Review Matrix, or consulting the Grounded Copilot).
- **Offline / Local Model Support:** Infinity Researcher supports local LLM endpoints (such as Ollama or local Hugging Face pipelines) for 100% air-gapped, zero-leak research workflows.

---

### 4. IN-APP FEEDBACK & GITHUB ISSUE REPORTING

When you choose to submit feedback or report a bug via the built-in **Feedback & GitHub Issue Center**:

1. **Strict Client-Side Redaction:** Prior to any issue payload being assembled or sent, an automated multi-stage redaction engine sanitizes all diagnostic logs:
   - GitHub Personal Access Tokens (`ghp_`, `github_pat_`) are scrubbed.
   - LLM and cloud provider API keys (`sk-`, `key-`, etc.) are masked (`[REDACTED_API_KEY]`).
   - Authorization headers (`Bearer <token>`) are stripped.
   - Local filesystem user profile paths (e.g. `C:\Users\Username\...` or `/home/username/...`) are normalized to `C:\Users\<redacted>\...` or `~/<redacted>/...`.
   - Email addresses are masked (`[REDACTED_EMAIL]`).
2. **Transparent Live Preview:** You are provided with a live Markdown preview displaying the exact sanitized payload before submission.
3. **Opt-In Diagnostics:** Inclusion of application health, platform architecture, and error logs is completely optional and unselected by default.
4. **Token Security:** If you provide a GitHub Personal Access Token to submit issues directly from the app, the token is stored locally on your device and sent directly and exclusively to the official GitHub REST API (`api.github.com`). It is never relayed through third-party proxy servers.

---

### 5. SCHOLARLY SCRAPING & WEB HARVESTING PRIVACY

When crawling scholarly web sources or downloading open-access papers:
- Requests originate directly from your workstation to the target academic repository or server.
- The scraper sends standardized desktop headers and adheres to configurable rate limits and robots.txt directives.

---

### 6. CONTACT & PRIVACY INQUIRIES

If you have questions regarding this Privacy Policy or data security within Infinity Researcher, contact:
- **Maintainer:** Sanjay
- **Organization:** Infinity Web Technology
- **Repository:** [https://github.com/sanjay-m6/Infinity-Researcher](https://github.com/sanjay-m6/Infinity-Researcher)
