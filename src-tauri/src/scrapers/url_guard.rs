use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use url::Url;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum UrlValidationError {
    #[error("Invalid URL format: {0}")]
    ParseError(String),
    #[error("Unsupported URL scheme: {0}. Only http and https are permitted.")]
    UnsupportedScheme(String),
    #[error("URL contains embedded credentials (userinfo), which is prohibited for security.")]
    ContainsCredentials,
    #[error("URL host is missing or invalid.")]
    MissingHost,
    #[error("Blocked private or reserved IP address (anti-SSRF): {0}")]
    BlockedPrivateIp(String),
    #[error("Disallowed or dangerous network port: {0}. Only standard web ports are permitted.")]
    BlockedPort(u16),
    #[error("Host '{0}' does not belong to the allowed domain '{1}'")]
    DomainMismatch(String, String),
    #[error("URL does not match allowed crawl patterns")]
    PatternNotAllowed,
    #[error("URL matches a disallowed crawl pattern: {0}")]
    PatternDisallowed(String),
}

pub struct UrlGuard;

impl UrlGuard {
    /// Validates a URL against Anti-SSRF policies, valid schemes, permitted ports, and credential checks.
    pub fn validate_url(raw_url: &str) -> Result<Url, UrlValidationError> {
        let parsed =
            Url::parse(raw_url).map_err(|e| UrlValidationError::ParseError(e.to_string()))?;

        // 1. Check scheme
        let scheme = parsed.scheme();
        if scheme != "http" && scheme != "https" {
            return Err(UrlValidationError::UnsupportedScheme(scheme.to_string()));
        }

        // 2. Reject userinfo
        if !parsed.username().is_empty() || parsed.password().is_some() {
            return Err(UrlValidationError::ContainsCredentials);
        }

        // 3. Verify host exists
        let host = parsed.host_str().ok_or(UrlValidationError::MissingHost)?;
        if host.trim().is_empty() {
            return Err(UrlValidationError::MissingHost);
        }

        // 4. Port safety: allow standard HTTP/HTTPS web ports; block dangerous service ports (e.g. SSH 22, SMTP 25, Redis 6379)
        if let Some(port) = parsed.port() {
            let is_permitted_port = matches!(port, 80 | 443 | 8000 | 8080 | 8443 | 3000 | 5000);
            if !is_permitted_port {
                return Err(UrlValidationError::BlockedPort(port));
            }
        }

        // 5. Anti-SSRF IP check
        // Check if host itself is an IP literal (strip brackets for IPv6)
        let host_for_ip = host.trim_matches(|c| c == '[' || c == ']');
        if let Ok(ip) = host_for_ip.parse::<IpAddr>() {
            Self::check_ip_safety(&ip)?;
        }

        // Reject localhost and well-known local/internal names
        let host_lower = host_for_ip.to_lowercase();
        if host_lower == "localhost"
            || host_lower.ends_with(".localhost")
            || host_lower.ends_with(".local")
            || host_lower.ends_with(".internal")
            || host_lower == "127.0.0.1"
            || host_lower == "::1"
            || host_lower == "169.254.169.254"
            || host_lower == "instance-data"
            || host_lower == "metadata.google.internal"
        {
            return Err(UrlValidationError::BlockedPrivateIp(host.to_string()));
        }

        Ok(parsed)
    }

    /// Checks whether an IP address belongs to private, loopback, link-local, multicast, or reserved ranges.
    pub fn check_ip_safety(ip: &IpAddr) -> Result<(), UrlValidationError> {
        match ip {
            IpAddr::V4(ipv4) => {
                if ipv4.is_loopback()
                    || ipv4.is_multicast()
                    || ipv4.is_broadcast()
                    || ipv4.is_unspecified()
                    || Self::is_private_v4(ipv4)
                    || Self::is_link_local_v4(ipv4)
                    || Self::is_reserved_v4(ipv4)
                {
                    return Err(UrlValidationError::BlockedPrivateIp(ipv4.to_string()));
                }
            }
            IpAddr::V6(ipv6) => {
                // If it is an IPv4-mapped IPv6 address (e.g., ::ffff:127.0.0.1 or ::ffff:169.254.169.254),
                // validate the underlying IPv4 address against all IPv4 restrictions
                if let Some(ipv4) = ipv6.to_ipv4_mapped() {
                    return Self::check_ip_safety(&IpAddr::V4(ipv4));
                }

                if ipv6.is_loopback()
                    || ipv6.is_multicast()
                    || ipv6.is_unspecified()
                    || Self::is_link_local_v6(ipv6)
                    || Self::is_unique_local_v6(ipv6)
                {
                    return Err(UrlValidationError::BlockedPrivateIp(ipv6.to_string()));
                }
            }
        }
        Ok(())
    }

    fn is_private_v4(ipv4: &Ipv4Addr) -> bool {
        let octets = ipv4.octets();
        // 10.0.0.0/8
        octets[0] == 10
            // 172.16.0.0/12
            || (octets[0] == 172 && (16..=31).contains(&octets[1]))
            // 192.168.0.0/16
            || (octets[0] == 192 && octets[1] == 168)
    }

    fn is_link_local_v4(ipv4: &Ipv4Addr) -> bool {
        let octets = ipv4.octets();
        // 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
        octets[0] == 169 && octets[1] == 254
    }

    fn is_reserved_v4(ipv4: &Ipv4Addr) -> bool {
        let octets = ipv4.octets();
        // 0.0.0.0/8
        octets[0] == 0
            // 100.64.0.0/10 (Carrier-grade NAT)
            || (octets[0] == 100 && (64..=127).contains(&octets[1]))
            // 192.0.0.0/24 (IETF Protocol Assignments)
            || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
            // 192.0.2.0/24 (TEST-NET-1)
            || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
            // 198.51.100.0/24 (TEST-NET-2)
            || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
            // 203.0.113.0/24 (TEST-NET-3)
            || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
            // 240.0.0.0/4 (Reserved / Future use)
            || octets[0] >= 240
    }

    fn is_link_local_v6(ipv6: &Ipv6Addr) -> bool {
        // fe80::/10
        let segments = ipv6.segments();
        (segments[0] & 0xffc0) == 0xfe80
    }

    fn is_unique_local_v6(ipv6: &Ipv6Addr) -> bool {
        // fc00::/7
        let segments = ipv6.segments();
        (segments[0] & 0xfe00) == 0xfc00
    }

    /// Normalizes a URL:
    /// - Strips fragments
    /// - Strips tracking query parameters (utm_*, ref, etc.)
    /// - Normalizes standard ports
    pub fn normalize_url(url: &Url) -> String {
        let mut clean = url.clone();
        clean.set_fragment(None);

        // Filter tracking query params
        let tracking_params = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "ref",
            "source",
            "fbclid",
            "gclid",
            "msclkid",
        ];

        let filtered_pairs: Vec<(String, String)> = clean
            .query_pairs()
            .filter(|(k, _)| !tracking_params.contains(&k.to_lowercase().as_str()))
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        if filtered_pairs.is_empty() {
            clean.set_query(None);
        } else {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            for (k, v) in filtered_pairs {
                serializer.append_pair(&k, &v);
            }
            clean.set_query(Some(&serializer.finish()));
        }

        clean.to_string()
    }

    /// Checks if a candidate URL belongs to the allowed base domain (or its subdomains).
    pub fn matches_domain(url: &Url, allowed_domain: &str) -> Result<(), UrlValidationError> {
        let host = url
            .host_str()
            .ok_or(UrlValidationError::MissingHost)?
            .to_lowercase();
        let allowed = allowed_domain.trim().to_lowercase();

        if host == allowed || host.ends_with(&format!(".{allowed}")) {
            Ok(())
        } else {
            Err(UrlValidationError::DomainMismatch(host, allowed))
        }
    }

    /// Checks whether the URL matches the profile's allowed/disallowed patterns.
    pub fn matches_patterns(
        url_str: &str,
        allowed_patterns: &[String],
        disallowed_patterns: &[String],
    ) -> Result<(), UrlValidationError> {
        // Disallowed patterns take precedence
        for pattern in disallowed_patterns {
            if pattern.trim().is_empty() {
                continue;
            }
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(url_str) {
                    return Err(UrlValidationError::PatternDisallowed(pattern.clone()));
                }
            } else if url_str.contains(pattern) {
                return Err(UrlValidationError::PatternDisallowed(pattern.clone()));
            }
        }

        // Allowed patterns: if empty, all are allowed. If non-empty, at least one must match.
        if !allowed_patterns.is_empty() {
            let mut matched = false;
            for pattern in allowed_patterns {
                if pattern.trim().is_empty() {
                    continue;
                }
                if let Ok(re) = regex::Regex::new(pattern) {
                    if re.is_match(url_str) {
                        matched = true;
                        break;
                    }
                } else if url_str.contains(pattern) {
                    matched = true;
                    break;
                }
            }
            if !matched {
                return Err(UrlValidationError::PatternNotAllowed);
            }
        }

        Ok(())
    }

    /// Resolves a potentially relative link against a base URL.
    pub fn resolve_link(base_url: &Url, link: &str) -> Option<String> {
        let trimmed = link.trim();
        if trimmed.is_empty()
            || trimmed.starts_with('#')
            || trimmed.starts_with("javascript:")
            || trimmed.starts_with("mailto:")
            || trimmed.starts_with("tel:")
        {
            return None;
        }

        match base_url.join(trimmed) {
            Ok(resolved) => {
                if resolved.scheme() == "http" || resolved.scheme() == "https" {
                    Some(Self::normalize_url(&resolved))
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_urls() {
        assert!(
            UrlGuard::validate_url("https://www.biorxiv.org/content/10.1101/2026.01.01").is_ok()
        );
        assert!(UrlGuard::validate_url("http://arxiv.org/abs/2301.00001").is_ok());
    }

    #[test]
    fn test_rejects_unsupported_schemes() {
        assert_eq!(
            UrlGuard::validate_url("file:///etc/passwd"),
            Err(UrlValidationError::UnsupportedScheme("file".to_string()))
        );
        assert_eq!(
            UrlGuard::validate_url("ftp://ftp.example.com"),
            Err(UrlValidationError::UnsupportedScheme("ftp".to_string()))
        );
        assert_eq!(
            UrlGuard::validate_url("javascript:alert(1)"),
            Err(UrlValidationError::UnsupportedScheme(
                "javascript".to_string()
            ))
        );
    }

    #[test]
    fn test_rejects_credentials() {
        assert_eq!(
            UrlGuard::validate_url("https://admin:secret@example.com/paper"),
            Err(UrlValidationError::ContainsCredentials)
        );
    }

    #[test]
    fn test_anti_ssrf_blocking() {
        // Localhost
        assert!(UrlGuard::validate_url("http://localhost:8080").is_err());
        assert!(UrlGuard::validate_url("http://127.0.0.1:3000").is_err());
        assert!(UrlGuard::validate_url("http://[::1]:80").is_err());

        // Private IPv4
        assert!(UrlGuard::validate_url("http://10.0.0.1/admin").is_err());
        assert!(UrlGuard::validate_url("http://172.16.5.10").is_err());
        assert!(UrlGuard::validate_url("http://192.168.1.1").is_err());

        // Cloud metadata service (169.254.169.254)
        assert!(UrlGuard::validate_url("http://169.254.169.254/latest/meta-data").is_err());
        assert!(
            UrlGuard::validate_url("http://metadata.google.internal/computeMetadata/v1").is_err()
        );

        // IPv4-mapped IPv6 literal anti-SSRF bypass attempt
        assert!(UrlGuard::validate_url("http://[::ffff:127.0.0.1]").is_err());
        assert!(UrlGuard::validate_url("http://[::ffff:169.254.169.254]").is_err());
        assert!(UrlGuard::validate_url("http://[::ffff:10.0.0.1]").is_err());

        // Dangerous / internal service ports (SSH 22, SMTP 25, Redis 6379, MySQL 3306)
        assert_eq!(
            UrlGuard::validate_url("https://example.com:22/paper.pdf"),
            Err(UrlValidationError::BlockedPort(22))
        );
        assert_eq!(
            UrlGuard::validate_url("https://example.com:25/mail"),
            Err(UrlValidationError::BlockedPort(25))
        );
        assert_eq!(
            UrlGuard::validate_url("https://example.com:6379/data"),
            Err(UrlValidationError::BlockedPort(6379))
        );

        // Permitted web ports
        assert!(UrlGuard::validate_url("https://example.com:443/paper.pdf").is_ok());
        assert!(UrlGuard::validate_url("https://example.com:8443/paper.pdf").is_ok());

        // Internal domain suffixes
        assert!(UrlGuard::validate_url("http://service.local").is_err());
        assert!(UrlGuard::validate_url("http://db.internal").is_err());
    }

    #[test]
    fn test_url_normalization() {
        let raw = Url::parse("https://biorxiv.org/content/10.1101/test?utm_source=twitter&utm_medium=social&page=1#abstract").unwrap();
        let normalized = UrlGuard::normalize_url(&raw);
        assert_eq!(
            normalized,
            "https://biorxiv.org/content/10.1101/test?page=1"
        );
    }

    #[test]
    fn test_matches_domain() {
        let url1 = Url::parse("https://biorxiv.org/content/123").unwrap();
        let url2 = Url::parse("https://sub.biorxiv.org/content/123").unwrap();
        let url3 = Url::parse("https://evilbiorxiv.org/content/123").unwrap();

        assert!(UrlGuard::matches_domain(&url1, "biorxiv.org").is_ok());
        assert!(UrlGuard::matches_domain(&url2, "biorxiv.org").is_ok());
        assert!(UrlGuard::matches_domain(&url3, "biorxiv.org").is_err());
    }

    #[test]
    fn test_pattern_matching() {
        let allowed = vec![r"/content/10\.1101/".to_string()];
        let disallowed = vec![r"/download/".to_string(), r"\.zip$".to_string()];

        let good = "https://biorxiv.org/content/10.1101/2026.01.01.500";
        let bad_disallowed = "https://biorxiv.org/content/10.1101/download/file.zip";
        let bad_not_allowed = "https://biorxiv.org/about-us";

        assert!(UrlGuard::matches_patterns(good, &allowed, &disallowed).is_ok());
        assert!(UrlGuard::matches_patterns(bad_disallowed, &allowed, &disallowed).is_err());
        assert!(UrlGuard::matches_patterns(bad_not_allowed, &allowed, &disallowed).is_err());
    }

    #[test]
    fn test_resolve_link() {
        let base = Url::parse("https://biorxiv.org/content/10.1101/1234").unwrap();
        assert_eq!(
            UrlGuard::resolve_link(&base, "/content/10.1101/5678.full.pdf"),
            Some("https://biorxiv.org/content/10.1101/5678.full.pdf".to_string())
        );
        assert_eq!(
            UrlGuard::resolve_link(&base, "https://other.org/paper"),
            Some("https://other.org/paper".to_string())
        );
        assert_eq!(UrlGuard::resolve_link(&base, "#section2"), None);
        assert_eq!(UrlGuard::resolve_link(&base, "javascript:void(0)"), None);
    }
}
