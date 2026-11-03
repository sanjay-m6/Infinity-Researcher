# Phase 17 — Connector Diagnostics & Proactive Health Checks

**Subsystem**: Observability & Diagnostics Infrastructure  
**Module**: `src-tauri/src/academic_sources/adapter.rs` & `commands/academic_search.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Observability Imperative

Scholarly APIs experience frequent traffic spikes, scheduled maintenance, and rate-limiting throttling. Without proactive health diagnostics, users are left uncertain whether a lack of search results stems from a restrictive query or an upstream API outage.

Phase 17 introduces standardized, non-intrusive health checks across all academic connectors.

---

## 2. Health Check Contract (`AcademicSourceAdapter::health_check`)

Every academic adapter implements the `health_check` method:

```rust
#[async_trait]
pub trait AcademicSourceAdapter: Send + Sync {
    // ...
    async fn health_check(&self, client: &reqwest::Client) -> ProviderHealthCheck;
}
```

### 2.1 Health Check Data Structure
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealthCheck {
    pub provider_id: ProviderId,
    pub status: ProviderHealthStatus,
    pub latency_ms: u64,
    pub message: Option<String>,
    pub checked_at: String,
}
```

### 2.2 Health Status Enum
- **`Healthy`**: Responded with HTTP 200 within timeout; operational.
- **`Degraded`**: Responded with an unexpected HTTP status code or elevated latency (> 3000ms).
- **`RateLimited`**: Responded with HTTP 429 Too Many Requests.
- **`AuthRequired`**: Responded with HTTP 401 or 403 Forbidden due to missing or invalid API keys.
- **`Unavailable`**: Connection refused, DNS failure, or request timeout.

---

## 3. Provider Probe Implementations

Each provider issues a minimal, non-disruptive query with a strict 6-second timeout:
- **OpenAlex**: `GET https://api.openalex.org/works?per-page=1`
- **Crossref**: `GET https://api.crossref.org/works?rows=1`
- **arXiv**: `GET https://export.arxiv.org/api/query?search_query=all:electron&max_results=1`
- **Semantic Scholar**: `GET https://api.semanticscholar.org/graph/v1/paper/search?query=transformer&limit=1`
- **Europe PMC**: `GET https://europepmc.org/RestfulWebService/rest/search?query=cancer&format=json&pageSize=1`

---

## 4. UI Exposure & Desktop Integration

1. **Desktop API Command**: `check_academic_provider_health(provider_id?: Option<String>)`
2. **Diagnostics Modal in Discover Papers**:
   - Renders a live table of all 5 academic source connectors.
   - Shows display name, category, supported capabilities (DOI, Year, OA, PDF), health badge, latency (ms), and RPS limits.
   - Includes a **"Probe Source Health"** button for on-demand network verification.

