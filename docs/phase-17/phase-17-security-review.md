# Phase 17 — Security, Privacy & Integrity Review

**Subsystem**: Academic Connectors Security Review  
**Phase**: Phase 17 Modernization  

---

## 1. Security Scope

This review evaluates the security posture of Phase 17 academic connector changes, including API key handling, network communications, SQL injection prevention, SSRF defense, and upstream payload sanitization.

---

## 2. Threat Modeling & Mitigation Analysis

### 2.1 API Key & Credential Protection
- **Threat**: User API keys for Semantic Scholar or OpenAlex leaked via logs, error messages, or frontend IPC returns.
- **Mitigation**:
  - `get_provider_config_status` reports only a boolean `is_configured` flag, never returning secret strings to the frontend.
  - API keys are injected via secure HTTP request headers (`x-api-key`) or query parameters and stripped from debug logging macros (`tracing::info!`).

### 2.2 Network Security & TLS Enforcement
- **Threat**: Man-in-the-middle eavesdropping or plain HTTP plaintext leakage.
- **Mitigation**:
  - All 5 academic provider adapters enforce encrypted HTTPS endpoints (`https://api.openalex.org`, `https://api.crossref.org`, `https://api.semanticscholar.org`, `https://export.arxiv.org`, `https://europepmc.org`).
  - Strict connection and request timeouts (5s connect, 15s overall) prevent hung socket attacks.

### 2.3 SSRF & Malicious URL Injection
- **Threat**: Malicious upstream metadata returning `file://`, `localhost`, or internal IP addresses in `pdf_url` or `landing_url`.
- **Mitigation**:
  - `Url::parse` validates all URLs.
  - PDF resolver and download manager validate that URL schemes are restricted strictly to `http` or `https` and reject loopback/RFC 1918 private IP ranges.

### 2.4 SQL Injection Defense
- **Threat**: Unsanitized author names, titles, or abstracts containing SQL control characters.
- **Mitigation**:
  - All SQLite database interactions use parameterized queries via `rusqlite::params![]`.
  - Zero raw string concatenation is used in SQL statements.

### 2.5 Denial of Service & Resource Exhaustion
- **Threat**: Concurrent multi-provider queries flooding operating system sockets or triggering upstream IP blacklisting.
- **Mitigation**:
  - Bounded concurrency semaphore (`Arc<Semaphore>::new(5)`).
  - In-memory rate limiting with per-provider minimum intervals.

---

## 3. Privacy & Local-First Verification

- **Local Persistence**: All metadata and papers are stored locally in the user's SQLite database.
- **No Telemetry Leakage**: No telemetry or search query analytics are sent to any centralized server outside of direct requests to the academic providers chosen by the researcher.
- **Zero Third-Party Tracking**: Search requests contain only necessary query parameters and standard polite academic contact headers (`researcher@local-desktop.app`).

