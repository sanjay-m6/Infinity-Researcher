use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::warn;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleType {
    Allow,
    Disallow,
}

#[derive(Debug, Clone)]
pub struct RobotRule {
    pub rule_type: RuleType,
    pub pattern: String,
}

#[derive(Debug, Clone, Default)]
pub struct UserAgentGroup {
    pub rules: Vec<RobotRule>,
    pub crawl_delay: Option<Duration>,
}

#[derive(Debug, Clone, Default)]
pub struct RobotsTxt {
    pub groups: HashMap<String, UserAgentGroup>,
}

impl RobotsTxt {
    /// Parses the raw robots.txt content into structured groups and rules.
    pub fn parse(content: &str) -> Self {
        let mut robots = RobotsTxt::default();
        let mut current_agents: Vec<String> = Vec::new();
        let mut in_agent_block = false;

        for line in content.lines() {
            let clean = line.split('#').next().unwrap_or("").trim();
            if clean.is_empty() {
                continue;
            }

            if let Some((directive, value)) = clean.split_once(':') {
                let directive = directive.trim().to_lowercase();
                let value = value.trim();

                match directive.as_str() {
                    "user-agent" => {
                        if !in_agent_block {
                            current_agents.clear();
                            in_agent_block = true;
                        }
                        current_agents.push(value.to_lowercase());
                    }
                    "disallow" => {
                        in_agent_block = false;
                        if !current_agents.is_empty() && !value.is_empty() {
                            for agent in &current_agents {
                                robots.groups.entry(agent.clone()).or_default().rules.push(
                                    RobotRule {
                                        rule_type: RuleType::Disallow,
                                        pattern: value.to_string(),
                                    },
                                );
                            }
                        }
                    }
                    "allow" => {
                        in_agent_block = false;
                        if !current_agents.is_empty() && !value.is_empty() {
                            for agent in &current_agents {
                                robots.groups.entry(agent.clone()).or_default().rules.push(
                                    RobotRule {
                                        rule_type: RuleType::Allow,
                                        pattern: value.to_string(),
                                    },
                                );
                            }
                        }
                    }
                    "crawl-delay" => {
                        in_agent_block = false;
                        if !current_agents.is_empty() {
                            if let Ok(seconds) = value.parse::<f64>() {
                                let duration = Duration::from_millis((seconds * 1000.0) as u64);
                                for agent in &current_agents {
                                    robots.groups.entry(agent.clone()).or_default().crawl_delay =
                                        Some(duration);
                                }
                            }
                        }
                    }
                    _ => {
                        in_agent_block = false;
                    }
                }
            }
        }

        robots
    }

    /// Checks if a path is allowed for the specified user agent.
    pub fn is_allowed(&self, path: &str, user_agent: &str) -> bool {
        let agent_lower = user_agent.to_lowercase();

        // 1. Try finding specific agent group
        let group = self
            .groups
            .iter()
            .find(|(k, _)| {
                k.as_str() != "*" && (agent_lower.contains(k.as_str()) || k.as_str() == agent_lower)
            })
            .map(|(_, g)| g)
            .or_else(|| self.groups.get("*"));

        let group = match group {
            Some(g) => g,
            None => return true, // No matching group found, default is allowed
        };

        let mut longest_match_len = 0;
        let mut allowed = true;

        for rule in &group.rules {
            if Self::matches_path(&rule.pattern, path) {
                let match_len = rule.pattern.len();
                if match_len > longest_match_len {
                    longest_match_len = match_len;
                    allowed = rule.rule_type == RuleType::Allow;
                } else if match_len == longest_match_len && rule.rule_type == RuleType::Allow {
                    // Equal length ties favor Allow
                    allowed = true;
                }
            }
        }

        allowed
    }

    /// Returns the crawl delay (if configured) for the user agent.
    pub fn crawl_delay(&self, user_agent: &str) -> Option<Duration> {
        let agent_lower = user_agent.to_lowercase();
        let specific = self.groups.iter().find(|(k, _)| {
            k.as_str() != "*" && (agent_lower.contains(k.as_str()) || k.as_str() == agent_lower)
        });

        if let Some((_, g)) = specific {
            g.crawl_delay
        } else {
            self.groups.get("*").and_then(|g| g.crawl_delay)
        }
    }

    fn matches_path(pattern: &str, path: &str) -> bool {
        if pattern == "/" {
            return true;
        }

        // Handle $ anchor (end of path)
        let (pattern, end_anchor) = if let Some(stripped) = pattern.strip_suffix('$') {
            (stripped, true)
        } else {
            (pattern, false)
        };

        // Convert wildcard pattern to regex
        let mut regex_str = String::from("^");
        for part in pattern.split('*') {
            regex_str.push_str(&regex::escape(part));
            regex_str.push_str(".*");
        }
        if !pattern.ends_with('*') && regex_str.ends_with(".*") {
            regex_str.truncate(regex_str.len() - 2);
        }

        if end_anchor {
            regex_str.push('$');
        }

        if let Ok(re) = regex::Regex::new(&regex_str) {
            re.is_match(path)
        } else {
            path.starts_with(pattern)
        }
    }
}

/// In-memory cache for robots.txt policies per domain origin.
#[derive(Clone, Default)]
pub struct RobotsCache {
    cache: Arc<RwLock<HashMap<String, Arc<RobotsTxt>>>>,
}

impl RobotsCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Retrieves cached robots.txt or fetches from origin.
    pub async fn get_or_fetch(
        &self,
        origin: &str,
        client: &reqwest::Client,
        user_agent: &str,
    ) -> Arc<RobotsTxt> {
        {
            let reader = self.cache.read().await;
            if let Some(cached) = reader.get(origin) {
                return cached.clone();
            }
        }

        let robots_url = format!("{}/robots.txt", origin.trim_end_matches('/'));
        let parsed = match client
            .get(&robots_url)
            .header("User-Agent", user_agent)
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let text = resp.text().await.unwrap_or_default();
                RobotsTxt::parse(&text)
            }
            Ok(resp) => {
                warn!(
                    status = %resp.status(),
                    url = %robots_url,
                    "Failed to fetch robots.txt; assuming default allow"
                );
                RobotsTxt::default()
            }
            Err(e) => {
                warn!(
                    error = %e,
                    url = %robots_url,
                    "Error requesting robots.txt; assuming default allow"
                );
                RobotsTxt::default()
            }
        };

        let arc = Arc::new(parsed);
        let mut writer = self.cache.write().await;
        writer.insert(origin.to_string(), arc.clone());
        arc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_ROBOTS: &str = r#"
# robots.txt for example scholarly site
User-agent: Googlebot
Disallow: /admin/
Allow: /

User-agent: *
Disallow: /private/
Disallow: /downloads/*.zip$
Disallow: /search?*
Allow: /private/open-access/
Crawl-delay: 2.5
"#;

    #[test]
    fn test_robots_txt_parsing() {
        let robots = RobotsTxt::parse(SAMPLE_ROBOTS);
        assert!(robots.groups.contains_key("googlebot"));
        assert!(robots.groups.contains_key("*"));

        let default_group = robots.groups.get("*").unwrap();
        assert_eq!(default_group.crawl_delay, Some(Duration::from_millis(2500)));
    }

    #[test]
    fn test_is_allowed_rules() {
        let robots = RobotsTxt::parse(SAMPLE_ROBOTS);

        // General crawler rules
        assert!(robots.is_allowed("/articles/123", "ResearchPaperScraper"));
        assert!(!robots.is_allowed("/private/secret-paper", "ResearchPaperScraper"));
        assert!(!robots.is_allowed("/search?q=biology", "ResearchPaperScraper"));

        // Allow override with longer match
        assert!(robots.is_allowed("/private/open-access/paper1", "ResearchPaperScraper"));

        // Wildcard + anchor ($)
        assert!(!robots.is_allowed("/downloads/archive.zip", "ResearchPaperScraper"));
        assert!(robots.is_allowed("/downloads/archive.zip.html", "ResearchPaperScraper"));

        // Googlebot specific rules
        assert!(robots.is_allowed("/private/secret-paper", "Googlebot"));
        assert!(!robots.is_allowed("/admin/panel", "Googlebot"));
    }

    #[test]
    fn test_crawl_delay() {
        let robots = RobotsTxt::parse(SAMPLE_ROBOTS);
        assert_eq!(
            robots.crawl_delay("ResearchPaperScraper"),
            Some(Duration::from_millis(2500))
        );
        assert_eq!(robots.crawl_delay("Googlebot"), None);
    }
}
