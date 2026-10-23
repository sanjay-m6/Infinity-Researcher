# System Architecture Overview

**Project:** Research Paper Scraper  
**Phase:** Phase 1 — Requirements and Source Research  
**Core Technologies:** Tauri 2 (Rust Backend + React/TypeScript/Vite Frontend)  
**Data Storage:** Local SQLite 3 (WAL + FTS5) & User-Managed Local Document Directory  

---

## 1. Architectural Philosophy: Local-First & Sovereign Research

The Research Paper Scraper is designed from first principles as a **local-first desktop system**. 

### Core Architectural Axioms
1. **Local Supremacy:** All paper records, collections, tags, research notes, and downloaded PDF documents are stored locally. The application remains fully functional offline.
2. **Clear Boundary of Privilege:** The React UI runs inside a sandboxed Webview context and cannot perform direct filesystem, database, or socket operations. All privileged actions occur exclusively within the Rust backend via strongly typed Tauri IPC commands.
3. **Decoupled Provider Architecture:** Academic sources are implemented as independent, isolated adapters conforming to a shared trait/interface. Adding or updating a source connector never touches the core library or UI presentation layer.
4. **Resilient Background Execution:** Long-running operations (federated searches, streaming file downloads, batch imports, text extraction) execute on background asynchronous tasks (`tokio`), communicating with the UI via typed IPC progress events. The UI thread never blocks.

---

## 2. High-Level System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND (Vite)                           │
│                                                                        │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │ Global Search│  │ Local Library │  │ Detail Drawer │  │ Settings │ │
│  └──────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────┬─────┘ │
│         │                  │                  │               │        │
│  ┌──────┴──────────────────┴──────────────────┴───────────────┴─────┐  │
│  │  State & Cache Layer: TanStack Query + Zustand (UI State Only)   │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ Tauri IPC (Typed Commands & Events)
┌────────────────────────────────────┼───────────────────────────────────┐
│                        RUST CORE BACKEND (Tauri 2)                     │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Tauri IPC Command Handlers                     │  │
│  │     (Input Validation, DTO Serialization, Error Mapping)         │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                     Domain / Application Services                │  │
│  │  ┌───────────────────┐  ┌──────────────────┐  ┌───────────────┐  │  │
│  │  │SearchOrchestrator │  │  LibraryManager  │  │ Deduplication │  │  │
│  │  ├───────────────────┤  ├──────────────────┤  ├───────────────┤  │  │
│  │  │  JobQueueManager  │  │ IngestionService │  │ ExportService │  │  │
│  │  └───────────────────┘  └──────────────────┘  └───────────────┘  │  │
│  └──────────────────┬───────────────────────────────┬───────────────┘  │
│                     │                               │                  │
│  ┌──────────────────▼───────────────┐  ┌────────────▼────────────────┐ │
│  │     Academic Source Connectors   │  │    Local Persistence Layer  │ │
│  │  ┌─────────────┐ ┌─────────────┐ │  │  ┌────────────────────────┐ │ │
│  │  │ OpenAlex    │ │ Crossref    │ │  │  │ SQLite WAL Repository  │ │ │
│  │  ├─────────────┤ ├─────────────┤ │  │  ├────────────────────────┤ │ │
│  │  │ SemanticSch │ │ arXiv (Atom)│ │  │  │ SQLite FTS5 Full-Text  │ │ │
│  │  ├─────────────┤ ├─────────────┤ │  │  ├────────────────────────┤ │ │
│  │  │ Europe PMC  │ │ DOAJ / CORE │ │  │  │ Migration Runner       │ │ │
│  │  └─────────────┘ └─────────────┘ │  │  └────────────────────────┘ │ │
│  └──────────────────┬───────────────┘  └────────────┬────────────────┘ │
│                     │                               │                  │
│  ┌──────────────────▼───────────────┐  ┌────────────▼────────────────┐ │
│  │       Resilient Network Engine   │  │     File Storage Engine     │ │
│  │  • SSRF IP Guard & Redirection   │  │  • Streaming Download (.tmp)│ │
│  │  • Token Bucket Rate Limiters    │  │  • Magic Byte (%PDF-) Check │ │
│  │  • Exponential Backoff & Jitter  │  │  • SHA-256 Checksumming     │ │
│  │  • Polite User-Agent / Headers   │  │  • Atomic Move to Library   │ │
│  └──────────────────┬───────────────┘  └────────────┬────────────────┘ │
└─────────────────────┼───────────────────────────────┼──────────────────┘
                      ▼                               ▼
              [Academic Web APIs]             [Local Filesystem]
              (HTTPS Only, Encrypted)         (%USERPROFILE%\Research)
```

---

## 3. Subsystem Boundaries and Responsibilities

### 3.1 React Frontend
* **Scope:** User interaction, presentation, client-side filtering, form validation (React Hook Form + Zod), accessible keyboard navigation, and theme rendering.
* **Component System:** Clean, accessible component hierarchy built with Tailwind CSS v4 and Lucide icons.
* **Data Flow:**
  * Asynchronous queries and cached server state managed via **TanStack Query**.
  * Local transient UI state (active tab, search drawer open/closed, table sorting) managed via lightweight **Zustand** stores.
* **Security Guard:** The frontend never parses raw HTML from external academic sites, never executes downloaded scripts, and communicates exclusively with the Rust backend via typed Tauri commands.

### 3.2 Tauri IPC Command Layer
* **Scope:** Acts as the strict gateway between Webview JavaScript and the Rust runtime.
* **Responsibilities:**
  * Validates every incoming argument (checks non-empty strings, valid UUIDs, positive integers).
  * Enforces least-privilege Tauri capabilities (CSP restricting external script execution, limiting filesystem access).
  * Converts Rust domain errors into structured, user-friendly IPC error payloads (`{ code: "SOURCE_TIMEOUT", message: "..." }`).

### 3.3 Domain & Application Services
* **`SearchOrchestrator`:** Accepts queries, fans out requests to enabled source adapters concurrently, aggregates responses, isolates individual provider timeouts/errors, and triggers deduplication.
* **`DeduplicationEngine`:** Executes deterministic matching on canonical DOIs and stable IDs; applies cautious Jaro-Winkler scoring on titles to flag potential duplicates without destructive auto-merges.
* **`JobQueueManager`:** Persistent queue (`tokio::sync::mpsc`) managing download concurrency, rate-limit pacing, cancellation tokens, retries, and progress broadcasting.
* **`IngestionService`:** Coordinates local PDF scanning, checksumming, text extraction, DOI regex extraction, and Crossref metadata backfilling.
* **`ExportService`:** Formats saved papers into deterministic BibTeX, RIS, CSV, and JSON outputs.

### 3.4 Academic Source Connector Framework
* **Interface Contract (`AcademicConnector` trait):**
  ```rust
  #[async_trait]
  pub trait AcademicConnector: Send + Sync {
      fn id(&self) -> &'static str;
      fn name(&self) -> &'static str;
      fn tier(&self) -> SourceTier;
      fn capabilities(&self) -> SourceCapabilities;
      async fn search(&self, query: &str, filters: &SearchFilters, cancel: CancellationToken) -> Result<Vec<PaperCandidate>, ConnectorError>;
      async fn fetch_by_doi(&self, doi: &str) -> Result<Option<PaperCandidate>, ConnectorError>;
  }
  ```
* **Isolation:** Each connector encapsulates its own endpoint URLs, request query parameter mapping, XML/JSON parsing, and response header extraction (`X-RateLimit-Remaining`).

### 3.5 Resilient Network Engine
* **`HttpClient`:** Configured with strict timeouts (connect: 5s, read: 15s).
* **Anti-SSRF Filter:** Custom DNS resolver intercepts domain resolutions before TCP connection, rejecting private (RFC 1918), loopback, link-local, and cloud metadata IP ranges.
* **Rate Limiting:** In-memory token bucket per host enforcing published rate limits (e.g. arXiv $\ge 3\text{s}$, S2AG 1 req/s).
* **Backoff Strategy:** Automatically handles HTTP 429 and 503 with exponential backoff and jitter, respecting `Retry-After` headers.

### 3.6 Local Persistence Layer (SQLite 3)
* **Configuration:** SQLite compiled with `SQLITE_ENABLE_FTS5`, running in Write-Ahead Logging (`WAL`) mode with `PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;`.
* **Migrations:** Managed via incremental versioned SQL migrations (`001_initial_schema.sql`, `002_add_fts5.sql`).
* **Repositories:** Strongly typed data access objects (`PaperRepository`, `SourceRecordRepository`, `JobRepository`, `FileRepository`).

### 3.7 File Storage Engine
* **Managed Root:** Default directory `%USERPROFILE%\Documents\ResearchPapers` (or user-configured path).
* **Streaming Ingestion:** Downloads stream to `.tmp` files; byte headers inspected for `%PDF-`; size validated against $\le 100\text{MB}$ limit; atomically renamed on completion.
* **Integrity:** SHA-256 computed on stream; stored in `files` table to prevent duplicate storage.

---

## 4. Evaluation of Browser Automation (Headless Browsers)

A critical architectural consideration in Phase 1 was evaluating whether a headless browser (such as Chromium via Puppeteer, Playwright, or Selenium) should be bundled into the application:

* **Evaluation Finding:**  
  All prioritized Phase 1 & Phase 2 academic sources (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ, CORE, bioRxiv) provide official, public **REST or Atom XML APIs** that return clean, structured JSON or XML. None of these sources require JavaScript execution.
* **Operational Drawbacks of Bundling Chromium:**
  * Increases desktop installer size by $\approx 150 - 250\text{ MB}$.
  * Adds massive memory overhead ($\approx 300 - 600\text{ MB}$ RAM per browser instance).
  * Introduces brittle dependency trees and security vulnerabilities.
  * Headless browsers are frequently flagged and blocked by commercial anti-bot services (Cloudflare, Akamai).
* **Architectural Decision:**  
  **No headless browser will be included.** All academic networking will be performed via lightweight, async HTTP clients (`reqwest`). For subscription-only commercial publishers where automated retrieval is unsupported, the app provides a native link-out that opens the article in the user's standard default desktop browser.
