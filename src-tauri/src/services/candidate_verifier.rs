//! Candidate Verification Pipeline (IMARE Stage D)
//!
//! Validates candidate PDF URLs through:
//! 1. HTTP Redirect history and loop tracking
//! 2. Content-Type header inspection (rejecting HTML error/login pages)
//! 3. Login / CAPTCHA challenge detection
//! 4. Fast binary fingerprinting (SHA-256 of first 4KB & %PDF- signature check)
//! 5. Title consistency fuzzy matching against expected bibliographic record

use std::collections::HashSet;
use std::time::Duration;
use reqwest::header::{CONTENT_TYPE, LOCATION};
use sha2::{Digest, Sha256};

use crate::scrapers::url_guard::UrlGuard;

/// Verification outcome for a candidate retrieval URL
#[derive(Debug, Clone)]
pub struct VerificationReport {
    pub is_valid: bool,
    pub original_url: String,
    pub final_url: String,
    pub redirect_history: Vec<String>,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub is_html_login_challenge: bool,
    pub has_pdf_signature: bool,
    pub fingerprint_sha256_4kb: Option<String>,
    pub title_similarity: Option<f64>,
    pub score: f64,
    pub rejection_reason: Option<String>,
}

pub struct CandidateVerifier;

impl CandidateVerifier {
    pub const MAX_REDIRECT_HOPS: usize = 5;
    pub const FINGERPRINT_SAMPLE_SIZE: usize = 4096; // First 4KB

    /// Checks whether sample bytes contain a valid %PDF- header within the first 1024 bytes,
    /// allowing for UTF-8 BOM (\xef\xbb\xbf), carriage returns, newlines, or comments.
    pub fn has_valid_pdf_magic_bytes(bytes: &[u8]) -> bool {
        let window_len = bytes.len().min(1024);
        let window = &bytes[..window_len];

        if let Some(pos) = window.windows(5).position(|w| w == b"%PDF-") {
            let prefix = &window[..pos];
            // Reject if prefix contains HTML tags
            let prefix_lower = prefix.to_ascii_lowercase();
            if prefix_lower.windows(5).any(|w| w == b"<html")
                || prefix_lower.windows(9).any(|w| w == b"<!doctype")
                || prefix_lower.windows(5).any(|w| w == b"<head")
            {
                return false;
            }
            // All bytes before %PDF- must be BOM, whitespace (\r, \n, \t, ' '), or comments ('%')
            let mut i = 0;
            while i < prefix.len() {
                // Check for UTF-8 BOM: 0xEF, 0xBB, 0xBF
                if i + 2 < prefix.len()
                    && prefix[i] == 0xEF
                    && prefix[i + 1] == 0xBB
                    && prefix[i + 2] == 0xBF
                {
                    i += 3;
                    continue;
                }
                // Check for UTF-16 BOMs
                if i + 1 < prefix.len()
                    && ((prefix[i] == 0xFE && prefix[i + 1] == 0xFF)
                        || (prefix[i] == 0xFF && prefix[i + 1] == 0xFE))
                {
                    i += 2;
                    continue;
                }
                // Check for comment line: % ... until newline
                if prefix[i] == b'%' {
                    while i < prefix.len() && prefix[i] != b'\r' && prefix[i] != b'\n' {
                        i += 1;
                    }
                    continue;
                }
                let b = prefix[i];
                if b != b' ' && b != b'\t' && b != b'\r' && b != b'\n' {
                    return false;
                }
                i += 1;
            }
            true
        } else {
            false
        }
    }

    /// Computes a transparent, explainable confidence score (0.0 to 100.0)
    pub fn calculate_confidence_score(
        has_pdf_signature: bool,
        content_type: Option<&str>,
        title_similarity: Option<f64>,
        final_url: &str,
        is_html_login: bool,
    ) -> f64 {
        if is_html_login {
            return 0.0;
        }
        let mut score = 0.0;
        if has_pdf_signature {
            score += 40.0;
        }
        if let Some(ct) = content_type {
            let lower = ct.to_lowercase();
            if lower.contains("application/pdf") {
                score += 30.0;
            } else if lower.contains("application/octet-stream") {
                score += 15.0;
            }
        }
        if let Some(sim) = title_similarity {
            score += (sim * 20.0).clamp(0.0, 20.0);
        }
        let lower_url = final_url.to_lowercase();
        if lower_url.contains("arxiv.org")
            || lower_url.contains("biorxiv.org")
            || lower_url.contains("medrxiv.org")
            || lower_url.contains("plos.org")
            || lower_url.contains("ncbi.nlm.nih.gov")
            || lower_url.contains("europepmc.org")
            || lower_url.contains("nature.com")
            || lower_url.contains("ieee.org")
        {
            score += 10.0;
        }
        score.clamp(0.0, 100.0)
    }

    /// Detects if an HTML or text chunk represents a login, CAPTCHA, or access restriction page.
    pub fn is_login_or_challenge_page(body: &str) -> bool {
        let lower = body.to_lowercase();
        lower.contains("<input type=\"password\"")
            || lower.contains("type='password'")
            || lower.contains("challenge-platform")
            || lower.contains("cf-chl-")
            || lower.contains("cf-turnstile")
            || lower.contains("recaptcha")
            || lower.contains("hcaptcha")
            || lower.contains("<title>access denied")
            || lower.contains("<title>login")
            || lower.contains("<title>sign in")
            || lower.contains("id=\"shibboleth\"")
            || lower.contains("institutional login")
            || (lower.contains("login") && lower.contains("<form") && lower.contains("password"))
    }

    /// Computes token set similarity ratio (0.0 to 1.0) between two title strings.
    pub fn compute_title_similarity(target_title: &str, candidate_title: &str) -> f64 {
        let target_tokens = Self::extract_tokens(target_title);
        let candidate_tokens = Self::extract_tokens(candidate_title);

        if target_tokens.is_empty() || candidate_tokens.is_empty() {
            return 0.0;
        }

        let intersection: usize = target_tokens.intersection(&candidate_tokens).count();
        let union: usize = target_tokens.union(&candidate_tokens).count();

        if union == 0 {
            return 0.0;
        }

        // Jaccard similarity
        let jaccard = (intersection as f64) / (union as f64);
        // Overlap coefficient relative to target title
        let target_overlap = (intersection as f64) / (target_tokens.len() as f64);

        // Blended similarity favoring full target coverage
        0.4 * jaccard + 0.6 * target_overlap
    }

    fn extract_tokens(text: &str) -> HashSet<String> {
        let stop_words: HashSet<&str> = [
            "the", "and", "for", "with", "from", "that", "this", "what",
            "using", "based", "study", "studies", "about", "into", "over",
            "towards", "toward", "via", "through", "between", "under", "after",
            "during", "before", "an", "a", "in", "on", "at", "by", "to", "of",
        ]
        .into_iter()
        .collect();

        text.split(|c: char| !c.is_alphanumeric() && c != '-')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| s.len() >= 2 && !stop_words.contains(s.as_str()))
            .collect()
    }

    /// Verifies candidate URL with manual redirect tracking, anti-SSRF, headers check, and 4KB signature test.
    pub async fn verify_candidate(
        client: &reqwest::Client,
        start_url: &str,
        expected_title: Option<&str>,
        candidate_title: Option<&str>,
    ) -> VerificationReport {
        let mut current_url = start_url.to_string();
        let mut redirect_history = Vec::new();
        let mut visited = HashSet::new();

        // 1. Follow redirects manually up to MAX_REDIRECT_HOPS with SSRF guard on every hop
        for _ in 0..Self::MAX_REDIRECT_HOPS {
            let parsed_url = match UrlGuard::validate_url(&current_url) {
                Ok(u) => u,
                Err(e) => {
                    return VerificationReport {
                        is_valid: false,
                        original_url: start_url.to_string(),
                        final_url: current_url,
                        redirect_history,
                        content_type: None,
                        content_length: None,
                        is_html_login_challenge: false,
                        has_pdf_signature: false,
                        fingerprint_sha256_4kb: None,
                        title_similarity: None,
                        score: 0.0,
                        rejection_reason: Some(format!("URL failed security validation: {}", e)),
                    };
                }
            };

            if visited.contains(parsed_url.as_str()) {
                return VerificationReport {
                    is_valid: false,
                    original_url: start_url.to_string(),
                    final_url: current_url,
                    redirect_history,
                    content_type: None,
                    content_length: None,
                    is_html_login_challenge: false,
                    has_pdf_signature: false,
                    fingerprint_sha256_4kb: None,
                    title_similarity: None,
                    score: 0.0,
                    rejection_reason: Some("Detected HTTP redirect loop".to_string()),
                };
            }
            visited.insert(parsed_url.as_str().to_string());

            let head_resp = client
                .get(parsed_url.as_str())
                .timeout(Duration::from_secs(8))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) InfinityResearcher/1.0")
                .header("Accept", "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8")
                .send()
                .await;

            let resp = match head_resp {
                Ok(r) => r,
                Err(e) => {
                    return VerificationReport {
                        is_valid: false,
                        original_url: start_url.to_string(),
                        final_url: current_url,
                        redirect_history,
                        content_type: None,
                        content_length: None,
                        is_html_login_challenge: false,
                        has_pdf_signature: false,
                        fingerprint_sha256_4kb: None,
                        title_similarity: None,
                        score: 0.0,
                        rejection_reason: Some(format!("HTTP request failed: {}", e)),
                    };
                }
            };

            let status = resp.status();
            let final_resp_url = resp.url().as_str().to_string();
            if final_resp_url != current_url {
                redirect_history.push(current_url.clone());
                current_url = final_resp_url.clone();
            }

            if status.is_redirection() {
                if let Some(loc_val) = resp.headers().get(LOCATION).and_then(|v| v.to_str().ok()) {
                    let next_url = match UrlGuard::resolve_link(&parsed_url, loc_val) {
                        Some(u) => u,
                        None => {
                            return VerificationReport {
                                is_valid: false,
                                original_url: start_url.to_string(),
                                final_url: current_url,
                                redirect_history,
                                content_type: None,
                                content_length: None,
                                is_html_login_challenge: false,
                                has_pdf_signature: false,
                                fingerprint_sha256_4kb: None,
                                title_similarity: None,
                                score: 0.0,
                                rejection_reason: Some(format!("Unresolvable redirect location: {}", loc_val)),
                            };
                        }
                    };
                    redirect_history.push(current_url);
                    current_url = next_url;
                    continue;
                }
            }

            if !status.is_success() {
                return VerificationReport {
                    is_valid: false,
                    original_url: start_url.to_string(),
                    final_url: current_url,
                    redirect_history,
                    content_type: None,
                    content_length: None,
                    is_html_login_challenge: status.as_u16() == 401 || status.as_u16() == 403,
                    has_pdf_signature: false,
                    fingerprint_sha256_4kb: None,
                    title_similarity: None,
                    score: 0.0,
                    rejection_reason: Some(format!("Server returned HTTP {}", status)),
                };
            }

            // Headers inspection
            let content_type = resp
                .headers()
                .get(CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            let content_length = resp.content_length();

            // Stream first 4KB chunk
            let mut stream_resp = resp;
            let mut sample_bytes = Vec::new();

            while let Ok(Some(chunk)) = stream_resp.chunk().await {
                sample_bytes.extend_from_slice(&chunk);
                if sample_bytes.len() >= Self::FINGERPRINT_SAMPLE_SIZE {
                    break;
                }
            }

            // Check if HTML text / login challenge
            let sample_str = String::from_utf8_lossy(&sample_bytes);
            let is_login = Self::is_login_or_challenge_page(&sample_str);

            if is_login {
                return VerificationReport {
                    is_valid: false,
                    original_url: start_url.to_string(),
                    final_url: current_url,
                    redirect_history,
                    content_type,
                    content_length,
                    is_html_login_challenge: true,
                    has_pdf_signature: false,
                    fingerprint_sha256_4kb: None,
                    title_similarity: None,
                    score: 0.0,
                    rejection_reason: Some("Detected HTML authentication or CAPTCHA challenge".to_string()),
                };
            }

            // Check explicit HTML content-type
            if let Some(ref ct) = content_type {
                if ct.to_lowercase().contains("text/html") {
                    return VerificationReport {
                        is_valid: false,
                        original_url: start_url.to_string(),
                        final_url: current_url,
                        redirect_history,
                        content_type: Some(ct.clone()),
                        content_length,
                        is_html_login_challenge: false,
                        has_pdf_signature: false,
                        fingerprint_sha256_4kb: None,
                        title_similarity: None,
                        score: 0.0,
                        rejection_reason: Some("Content-Type is text/html, not a PDF document".to_string()),
                    };
                }
            }

            // Check %PDF- signature (tolerant to UTF-8 BOM, whitespace, comments)
            let has_pdf = Self::has_valid_pdf_magic_bytes(&sample_bytes);
            if !has_pdf {
                return VerificationReport {
                    is_valid: false,
                    original_url: start_url.to_string(),
                    final_url: current_url,
                    redirect_history,
                    content_type,
                    content_length,
                    is_html_login_challenge: false,
                    has_pdf_signature: false,
                    fingerprint_sha256_4kb: None,
                    title_similarity: None,
                    score: 0.0,
                    rejection_reason: Some("Missing %PDF- header magic signature".to_string()),
                };
            }

            // Compute SHA-256 fingerprint of the 4KB sample
            let mut hasher = Sha256::new();
            hasher.update(&sample_bytes[..sample_bytes.len().min(Self::FINGERPRINT_SAMPLE_SIZE)]);
            let fingerprint = format!("{:x}", hasher.finalize());

            // Optional title consistency check
            let mut sim_score = None;
            if let (Some(target), Some(cand)) = (expected_title, candidate_title) {
                let score = Self::compute_title_similarity(target, cand);
                sim_score = Some(score);

                if score < 0.40 {
                    let confidence = Self::calculate_confidence_score(
                        true,
                        content_type.as_deref(),
                        Some(score),
                        &current_url,
                        false,
                    );
                    return VerificationReport {
                        is_valid: false,
                        original_url: start_url.to_string(),
                        final_url: current_url,
                        redirect_history,
                        content_type,
                        content_length,
                        is_html_login_challenge: false,
                        has_pdf_signature: true,
                        fingerprint_sha256_4kb: Some(fingerprint),
                        title_similarity: Some(score),
                        score: confidence,
                        rejection_reason: Some(format!("Title consistency check failed (similarity {:.2} < 0.40)", score)),
                    };
                }
            }

            let confidence = Self::calculate_confidence_score(
                true,
                content_type.as_deref(),
                sim_score,
                &current_url,
                false,
            );

            return VerificationReport {
                is_valid: true,
                original_url: start_url.to_string(),
                final_url: current_url,
                redirect_history,
                content_type,
                content_length,
                is_html_login_challenge: false,
                has_pdf_signature: true,
                fingerprint_sha256_4kb: Some(fingerprint),
                title_similarity: sim_score,
                score: confidence,
                rejection_reason: None,
            };
        }

        VerificationReport {
            is_valid: false,
            original_url: start_url.to_string(),
            final_url: current_url,
            redirect_history,
            content_type: None,
            content_length: None,
            is_html_login_challenge: false,
            has_pdf_signature: false,
            fingerprint_sha256_4kb: None,
            title_similarity: None,
            score: 0.0,
            rejection_reason: Some("Exceeded maximum redirect hops limit".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_login_page_detection() {
        let html_login = "<html><body><form action='/login'><input type='password' name='p'/></form></body></html>";
        assert!(CandidateVerifier::is_login_or_challenge_page(html_login));

        let html_captcha = "<html><head><title>Cloudflare Challenge</title></head><body><div class='cf-turnstile'></div></body></html>";
        assert!(CandidateVerifier::is_login_or_challenge_page(html_captcha));

        let normal_html = "<html><head><title>Research Article</title></head><body><p>Abstract text here</p></body></html>";
        assert!(!CandidateVerifier::is_login_or_challenge_page(normal_html));
    }

    #[test]
    fn test_title_similarity_matching() {
        let t1 = "Attention Is All You Need";
        let t2 = "Attention Is All You Need (Transformer Architecture)";
        let sim = CandidateVerifier::compute_title_similarity(t1, t2);
        assert!(sim > 0.60);

        let t3 = "Completely Different Topic In Agricultural Soil Moisture";
        let sim2 = CandidateVerifier::compute_title_similarity(t1, t3);
        assert!(sim2 < 0.15);
    }

    #[test]
    fn test_valid_pdf_magic_bytes_detection() {
        // Standard PDF
        assert!(CandidateVerifier::has_valid_pdf_magic_bytes(b"%PDF-1.4\n1 0 obj"));

        // UTF-8 BOM + PDF
        assert!(CandidateVerifier::has_valid_pdf_magic_bytes(b"\xef\xbb\xbf%PDF-1.7\n"));

        // Leading whitespace and comment + PDF
        assert!(CandidateVerifier::has_valid_pdf_magic_bytes(b"   \r\n% Generated by repository\r\n%PDF-1.5"));

        // UTF-16 BOMs
        assert!(CandidateVerifier::has_valid_pdf_magic_bytes(b"\xfe\xff%PDF-1.4"));
        assert!(CandidateVerifier::has_valid_pdf_magic_bytes(b"\xff\xfe%PDF-1.4"));

        // HTML masquerading as PDF
        assert!(!CandidateVerifier::has_valid_pdf_magic_bytes(b"<!DOCTYPE html><html><body>%PDF-"));
        assert!(!CandidateVerifier::has_valid_pdf_magic_bytes(b"<html><head></head><body>%PDF-"));

        // Completely non-PDF data
        assert!(!CandidateVerifier::has_valid_pdf_magic_bytes(b"Random text string with no magic"));
    }

    #[test]
    fn test_calculate_confidence_score() {
        // High quality match: valid PDF, application/pdf, high title similarity, authoritative domain
        let high_score = CandidateVerifier::calculate_confidence_score(
            true,
            Some("application/pdf"),
            Some(0.95),
            "https://arxiv.org/pdf/1706.03762.pdf",
            false,
        );
        assert!(high_score >= 95.0);

        // HTML login returns 0.0 immediately
        let login_score = CandidateVerifier::calculate_confidence_score(
            true,
            Some("text/html"),
            Some(0.95),
            "https://example.com/login",
            true,
        );
        assert_eq!(login_score, 0.0);
    }
}
