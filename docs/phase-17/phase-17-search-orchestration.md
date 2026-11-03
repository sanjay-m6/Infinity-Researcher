# Phase 17 — Multi-Source Search Orchestration & Concurrency

**Subsystem**: Academic Search Service Orchestrator  
**Module**: `src-tauri/src/academic_sources/search_service.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Orchestration Objectives

Academic paper discovery requires orchestrating asynchronous network I/O across up to 5 concurrent third-party APIs with high responsiveness, bounded resource consumption, and zero tolerance for cascade failures.

Key design tenets:
1. **Isolated Provider Lifecycles**: A crash, timeout, or rate-limit error in one connector must never degrade or abort results from another.
2. **Bounded Concurrency Semaphore**: Socket and operating system concurrency is capped to 5 active provider requests.
3. **Pacing & Rate Control**: Each provider respects token bucket rate limiting before issuing network calls.
4. **Transparent Status Reporting**: The frontend receives a comprehensive `ProviderStatus` breakdown for every queried source.

---

## 2. Concurrency Model

### 2.1 Task Allocation
```rust
let concurrency_semaphore = Arc::new(Semaphore::new(5));
let mut tasks: Vec<SearchTaskHandle> = Vec::new();

for &provider_id in &query.providers {
    let adapter_opt = self.registry.get_adapter(provider_id);
    let client = self.http_client.clone();
    let rate_limiter = self.rate_limiter.clone();
    let sem = concurrency_semaphore.clone();
    let mut provider_query = query.clone();
    // ...
    let handle = tokio::spawn(async move {
        let start = Instant::now();
        let _permit = sem.acquire().await.map_err(...);
        rate_limiter.wait_for_slot(provider_id).await;
        let result = adapter.search(&client, &provider_query, api_key.as_deref()).await;
        let elapsed_ms = start.elapsed().as_millis() as u64;
        (provider_id, result, elapsed_ms)
    });
    tasks.push(handle);
}
```

### 2.2 Result Aggregation & Error Isolation
As tasks complete:
- Successful responses append their normalized works to `raw_works` and report `ProviderStatusCategory::Succeeded` (or `NoResults`).
- Errored responses do not terminate the search. Instead, errors are mapped into domain status categories (`RateLimited`, `AuthenticationRequired`, `Unavailable`, `Failed`) with human-actionable messages.

---

## 3. Provider Status Categories

| Status Category | Trigger Condition | UI Presentation | User Remediation |
| :--- | :--- | :--- | :--- |
| `succeeded` | HTTP 200 with 1+ papers | Green badge, result count | Inspect results |
| `no_results` | HTTP 200 with 0 papers | Slate badge, zero count | Broaden search terms |
| `rate_limited` | HTTP 429 response | Amber badge, retry-after countdown | Wait or configure API key |
| `authentication_required` | HTTP 401 / 403 (missing key) | Purple badge, key warning | Enter API key in Settings |
| `unavailable` | HTTP 500 / 503 / DNS error | Red badge, error description | Retry after downtime |
| `cancelled` | User cancellation signal | Slate badge, cancelled note | None |

---

## 4. Query Plan Warnings & Transparency

When `AcademicSearchService::search` returns, the `UnifiedSearchResponse` contains:
- `works`: Fully deduplicated and ranked works.
- `provider_statuses`: Telemetry per provider (latency, count, status).
- `query_plan`: The compiled execution plan.
- `warnings`: Actionable warnings (e.g. arXiv post-filtering notice).

