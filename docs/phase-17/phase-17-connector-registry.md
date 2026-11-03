# Phase 17 — Academic Connector Registry Specification

**Subsystem**: Academic Source Registry  
**Module**: `src-tauri/src/academic_sources/registry.rs` & `python-engine/src/paper_scraper/adapters/registry.py`  
**Phase**: Phase 17 Modernization  

---

## 1. Registry Purpose & Objectives

The `ProviderRegistry` serves as the single source of truth for all configured academic source adapters in Infinity Researcher. It provides:
1. Dynamic adapter lookup and lifecycle management.
2. Authoritative capability declarations for query planning.
3. Concurrent, non-destructive health checks across all registered providers.
4. Extensible registration for scholarly APIs and indexing repositories.

---

## 2. Rust Provider Registry (`src-tauri/src/academic_sources/registry.rs`)

### 2.1 Interface & Memory Layout
The registry maintains adapters in a thread-safe `HashMap<ProviderId, Arc<dyn AcademicSourceAdapter>>`:

```rust
pub struct ProviderRegistry {
    adapters: HashMap<ProviderId, Arc<dyn AcademicSourceAdapter>>,
}
```

### 2.2 Core Registered Adapters
The registry is initialized with the 5 core scholarly providers:
- **`OpenAlexAdapter`**: Tier A catalog indexing ~250M works with open-access tracking and citation graphs.
- **`CrossrefAdapter`**: Authoritative DOI registration agency indexing 150M+ scholarly publisher works.
- **`SemanticScholarAdapter`**: AI2 scholarly graph featuring paper embeddings, TLDRs, and citation velocity.
- **`ArxivAdapter`**: Open-access preprint archive for physics, mathematics, and computer science.
- **`EuropePmcAdapter`**: Biomedical literature index aggregating PubMed and PMC open-access records.

### 2.3 Public Registry API

```rust
impl ProviderRegistry {
    pub fn new() -> Self;
    pub fn get_adapter(&self, id: ProviderId) -> Option<Arc<dyn AcademicSourceAdapter>>;
    pub fn list_capabilities(&self) -> Vec<ProviderCapabilities>;
    pub fn is_supported(&self, id: ProviderId) -> bool;
    pub async fn run_health_checks(
        &self,
        client: &reqwest::Client,
        target_provider: Option<ProviderId>,
    ) -> Vec<ProviderHealthCheck>;
}
```

### 2.4 Concurrent Health Check Dispatch
The `run_health_checks` method can target an individual provider or probe all adapters concurrently using `tokio::spawn`:
```rust
let mut handles = Vec::new();
for adapter in self.adapters.values() {
    let adapter = adapter.clone();
    let client = client.clone();
    handles.push(tokio::spawn(async move {
        adapter.health_check(&client).await
    }));
}
for handle in handles {
    if let Ok(check) = handle.await {
        checks.push(check);
    }
}
checks.sort_by(|a, b| a.provider_id.as_str().cmp(b.provider_id.as_str()));
```

---

## 3. Python Source Adapter Registry (`python-engine/src/paper_scraper/adapters/registry.py`)

The Python engine maintains a parallel `SourceRegistry` for crawling and scraping adapters:
- **Adapters Registered**: arXiv, bioRxiv, medRxiv, PubMed, Europe PMC, PLOS, Nature Scientific Reports, IEEE Xplore, Semantic Scholar, OpenAlex, and CORE API.
- **Telemetry Tracking**: Records per-source request successes, HTTP 429 rate limits, and HTTP 403 access blocks.
- **Health Classification**: Updates descriptor health status (`healthy`, `degraded`, `blocked`) based on real-time success rates.

---

## 4. Architectural Guarantees

1. **Deterministic Sorting**: `list_capabilities()` and `run_health_checks()` return predictably sorted vectors to ensure stable UI rendering.
2. **Immutable Trait Objects**: Adapters are wrapped in `Arc<dyn AcademicSourceAdapter>`, ensuring concurrent thread safety without lock contention.
3. **No Unregistered Providers**: Any query requesting an unregistered provider fails safely with `AcademicError::UnknownProvider` before network transmission.

