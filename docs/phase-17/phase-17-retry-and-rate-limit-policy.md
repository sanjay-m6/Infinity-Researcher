# Phase 17 — Rate Limiting, Backoff & Retry Policy

**Subsystem**: Traffic Pacing & Rate Control  
**Module**: `src-tauri/src/academic_sources/rate_limit.rs` & `search_service.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Upstream Rate Limiting Realities

Third-party scholarly indexing services impose strict request quotas to prevent scraping abuse:
- **arXiv Export API**: Strongly requests clients maintain at least 3 seconds between requests (0.33 RPS). Exceeding this rate results in progressive IP throttling or 403 Forbidden responses.
- **Semantic Scholar Graph API**: Enforces 1 request/second without an API key. Exceeding returns HTTP 429 with `x-rate-limit-retry-after-seconds`.
- **OpenAlex REST API**: Requests polite pool usage (including a `mailto:` parameter) with a limit of 10 RPS.
- **Crossref REST API**: Operates a polite pool at 50 RPS when a valid `mailto:` email is provided in the headers or query parameters.
- **Europe PMC**: Recommends 10 requests/second.

---

## 2. In-Memory Token Bucket Rate Limiter (`RateLimiter`)

The `RateLimiter` enforces rate pacing per provider in memory:

```rust
pub struct RateLimiter {
    state: Arc<Mutex<HashMap<ProviderId, ProviderRateState>>>,
}

struct ProviderRateState {
    last_request_at: Instant,
    min_interval: Duration,
}
```

### 2.1 Pacing Mechanism
Before an adapter transmits an HTTP request, it awaits permission:
```rust
pub async fn wait_for_slot(&self, provider_id: ProviderId) {
    let delay = {
        let mut state = self.state.lock().await;
        let entry = state.entry(provider_id).or_insert_with(|| ProviderRateState {
            last_request_at: Instant::now() - Duration::from_secs(10),
            min_interval: default_interval_for(provider_id),
        });

        let elapsed = entry.last_request_at.elapsed();
        if elapsed < entry.min_interval {
            let wait = entry.min_interval - elapsed;
            entry.last_request_at = Instant::now() + wait;
            Some(wait)
        } else {
            entry.last_request_at = Instant::now();
            None
        }
    };

    if let Some(wait_duration) = delay {
        tokio::time::sleep(wait_duration).await;
    }
}
```

---

## 3. Dynamic HTTP 429 & `Retry-After` Handling

When an upstream endpoint returns HTTP 429 Too Many Requests:
1. The adapter inspects the `Retry-After` HTTP response header.
2. If present as an integer, it extracts the seconds to wait.
3. If formatted as an HTTP-date, it computes the delta from the current UTC time.
4. If absent, a default backoff of 5 seconds is applied.
5. The adapter converts the response into `AcademicError::RateLimited { retry_after_secs }`.
6. The frontend displays the countdown timer on the provider status chip.

---

## 4. Bounded Concurrency Semaphore

To guarantee desktop resource limits:
- Global semaphore: `Arc<Semaphore>::new(5)`
- Maximum of 5 concurrent provider connections across all active searches.
- Prevents TCP socket exhaustion and Windows network thread starvation.

