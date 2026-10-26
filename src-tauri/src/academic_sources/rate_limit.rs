use crate::academic_sources::types::ProviderId;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Per-provider request rate limiter and pacing controller.
/// Ensures desktop searches never violate documented academic API quotas or trigger IP bans.
#[derive(Clone)]
pub struct RateLimiter {
    state: Arc<Mutex<HashMap<ProviderId, Instant>>>,
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Determines the minimum mandatory delay between consecutive requests for each provider.
    fn minimum_interval(&self, provider: ProviderId) -> Duration {
        match provider {
            // arXiv explicitly requests no more than 1 request per 3 seconds in API user manual
            ProviderId::Arxiv => Duration::from_millis(3000),
            // Semantic Scholar free/unauthenticated shared pool requires 1 req/sec pacing
            ProviderId::SemanticScholar => Duration::from_millis(1000),
            // Crossref polite pool supports up to 10 req/sec
            ProviderId::Crossref => Duration::from_millis(100),
            // OpenAlex supports 10 req/sec public pool
            ProviderId::OpenAlex => Duration::from_millis(100),
            // Europe PMC supports ~10 req/sec fair use
            ProviderId::EuropePmc => Duration::from_millis(100),
        }
    }

    /// Asynchronously acquires permission to issue a request to the specified provider,
    /// waiting the required duration if the provider was accessed recently.
    pub async fn wait_for_slot(&self, provider: ProviderId) {
        let interval = self.minimum_interval(provider);
        let mut map = self.state.lock().await;

        if let Some(last_time) = map.get(&provider) {
            let elapsed = last_time.elapsed();
            if elapsed < interval {
                let wait_duration = interval - elapsed;
                drop(map); // Release mutex lock before sleeping!
                tokio::time::sleep(wait_duration).await;
                let mut map = self.state.lock().await;
                map.insert(provider, Instant::now());
                return;
            }
        }

        map.insert(provider, Instant::now());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_pacing_calculation() {
        let limiter = RateLimiter::new();
        assert_eq!(
            limiter.minimum_interval(ProviderId::Arxiv),
            Duration::from_millis(3000)
        );
        assert_eq!(
            limiter.minimum_interval(ProviderId::SemanticScholar),
            Duration::from_millis(1000)
        );
        assert_eq!(
            limiter.minimum_interval(ProviderId::OpenAlex),
            Duration::from_millis(100)
        );

        // First slot should be immediate
        let start = Instant::now();
        limiter.wait_for_slot(ProviderId::Crossref).await;
        assert!(start.elapsed() < Duration::from_millis(50));
    }
}
