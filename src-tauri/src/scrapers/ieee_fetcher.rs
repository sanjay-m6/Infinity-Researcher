//! IEEE Open Access Proprietary Resolution and Streaming Pipeline
//!
//! Multi-tiered algorithmic sequence:
//! 1. IEEE Context & Identifier Extraction (arnumber, doi, title)
//! 2. Primary Tier: Crossref Metadata Index & xplorestaging Full-Text Content Resolver
//! 3. Secondary Tier: Unpaywall Open Access Gold/Green Mirror Resolver
//! 4. Tertiary Tier: Semantic Scholar Graph API OpenAccessPdf Provider
//! 5. Quaternary Tier: Browser-Mimic Stamp Session Handshake & IFRAME Extraction
//! 6. Strict Binary Validation: Verify %PDF- signature and stream to memory or disk.

use regex::Regex;
use std::sync::OnceLock;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::scrapers::url_guard::UrlGuard;

static RE_ARNUMBER: OnceLock<Regex> = OnceLock::new();
static RE_PDF_FRAME: OnceLock<Regex> = OnceLock::new();
static RE_JS_REDIRECT: OnceLock<Regex> = OnceLock::new();

/// Detects if the given URL or DOI targets an IEEE publication.
pub fn is_ieee_target(url: &str, doi: Option<&str>) -> bool {
    let url_lower = url.to_lowercase();
    if url_lower.contains("ieeexplore.ieee.org")
        || url_lower.contains("xplorestaging.ieee.org")
        || url_lower.contains("arnumber=")
        || url_lower.contains("/ielx")
        || url_lower.contains("/iel5")
        || url_lower.contains("/iel7")
    {
        return true;
    }

    if let Some(d) = doi {
        let d_lower = d.to_lowercase();
        if d_lower.starts_with("10.1109/") || d_lower.contains("10.1109") {
            return true;
        }
    }

    false
}

/// Extracts the numeric IEEE article number (arnumber) from any IEEE URL or document link.
pub fn extract_arnumber(url: &str) -> Option<String> {
    let re = RE_ARNUMBER.get_or_init(|| {
        Regex::new(r"(?:arnumber=|/document/|/stamp/stamp\.jsp\?tp=&arnumber=|/iel[a-z0-9]*/\d+/\d+/0*)(\d{6,10})").unwrap()
    });

    if let Some(caps) = re.captures(url) {
        if let Some(m) = caps.get(1) {
            return Some(m.as_str().to_string());
        }
    }
    None
}

/// Normalizes DOI string by stripping URL prefixes.
pub fn normalize_doi(raw_doi: &str) -> String {
    let cleaned = raw_doi.trim();
    if let Some(idx) = cleaned.find("10.1109/") {
        cleaned[idx..].trim().to_string()
    } else {
        cleaned.to_string()
    }
}

/// Resolves the canonical DOI for an IEEE paper if only a title or arnumber is available.
pub async fn resolve_ieee_doi_by_title(title: &str, client: &reqwest::Client) -> Option<String> {
    let clean_title = title.trim();
    if clean_title.is_empty() {
        return None;
    }

    let encoded_title: String = clean_title
        .chars()
        .map(|c| match c {
            ' ' => '+',
            c if c.is_alphanumeric() || c == '-' || c == '_' => c,
            _ => '+',
        })
        .collect();

    let query_url = format!(
        "https://api.crossref.org/works?query.title={}&rows=1",
        encoded_title
    );

    let resp = client
        .get(&query_url)
        .timeout(Duration::from_secs(4))
        .header("User-Agent", "mailto:research@infinityresearcher.org")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let json: serde_json::Value = resp.json().await.ok()?;
    let items = json.get("message")?.get("items")?.as_array()?;
    if let Some(first) = items.first() {
        if let Some(doi) = first.get("DOI").and_then(|d| d.as_str()) {
            let norm = normalize_doi(doi);
            if norm.starts_with("10.1109/") {
                return Some(norm);
            }
        }
    }

    None
}

/// Resolves direct Open Access IEEE PDF stream URL via multi-tiered sequence.
pub async fn resolve_ieee_direct_pdf_url(
    url: &str,
    doi_opt: Option<&str>,
    title_opt: Option<&str>,
    client: &reqwest::Client,
) -> Result<String, String> {
    info!(
        url = %url,
        doi = ?doi_opt,
        title = ?title_opt,
        "Initiating proprietary IEEE Open Access resolution sequence"
    );

    // Step 1: Normalize or resolve DOI
    let mut resolved_doi = doi_opt.map(normalize_doi);
    if resolved_doi.is_none() || resolved_doi.as_deref() == Some("") {
        if let Some(t) = title_opt {
            debug!("Attempting Crossref title lookup for missing IEEE DOI");
            resolved_doi = resolve_ieee_doi_by_title(t, client).await;
        }
    }

    // TIER 1: Primary Crossref Similarity & Full-Text Content Link (xplorestaging content mirror)
    if let Some(ref doi) = resolved_doi {
        if doi.starts_with("10.1109/") {
            debug!(doi = %doi, "Tier 1: Querying Crossref works API for official IEEE full-text stream");
            let cr_url = format!("https://api.crossref.org/works/{}", doi);
            if let Ok(resp) = client
                .get(&cr_url)
                .timeout(Duration::from_secs(4))
                .header("User-Agent", "mailto:research@infinityresearcher.org")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(links) = json
                            .get("message")
                            .and_then(|m| m.get("link"))
                            .and_then(|l| l.as_array())
                        {
                            for l in links {
                                if let Some(raw_link) = l.get("URL").and_then(|u| u.as_str()) {
                                    let candidate_url = if raw_link.starts_with("http://") {
                                        raw_link.replacen("http://", "https://", 1)
                                    } else {
                                        raw_link.to_string()
                                    };

                                    if (candidate_url.contains("xplorestaging.ieee.org")
                                        || candidate_url.contains("ieeexplore.ieee.org"))
                                        && (candidate_url.contains(".pdf")
                                            || candidate_url.contains("arnumber="))
                                    {
                                        debug!(url = %candidate_url, "Tier 1: Verifying xplorestaging direct PDF stream");
                                        if verify_pdf_endpoint(&candidate_url, client).await {
                                            info!(url = %candidate_url, "Tier 1 SUCCESS: Verified direct IEEE Open Access PDF stream");
                                            return Ok(candidate_url);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // TIER 2: Secondary Unpaywall OA Location Index
    if let Some(ref doi) = resolved_doi {
        if doi.starts_with("10.1109/") {
            debug!(doi = %doi, "Tier 2: Querying Unpaywall API for Open Access mirrors");
            let unp_url = format!(
                "https://api.unpaywall.org/v2/{}?email=research@infinityresearcher.org",
                doi
            );
            if let Ok(resp) = client
                .get(&unp_url)
                .timeout(Duration::from_secs(4))
                .header("User-Agent", "InfinityResearcher/1.0 (Scholarly Core)")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let mut candidates = Vec::new();
                        if let Some(best) = json
                            .get("best_oa_location")
                            .and_then(|b| b.get("url_for_pdf"))
                            .and_then(|u| u.as_str())
                        {
                            candidates.push(best.to_string());
                        }
                        if let Some(locations) = json.get("oa_locations").and_then(|l| l.as_array())
                        {
                            for loc in locations {
                                if let Some(u) = loc.get("url_for_pdf").and_then(|u| u.as_str()) {
                                    let s = u.to_string();
                                    if !candidates.contains(&s) {
                                        candidates.push(s);
                                    }
                                }
                            }
                        }

                        for cand in candidates {
                            let cand_https = if cand.starts_with("http://") {
                                cand.replacen("http://", "https://", 1)
                            } else {
                                cand
                            };
                            if verify_pdf_endpoint(&cand_https, client).await {
                                info!(url = %cand_https, "Tier 2 SUCCESS: Unpaywall verified Open Access PDF stream");
                                return Ok(cand_https);
                            }
                        }
                    }
                }
            }
        }
    }

    // TIER 3: Tertiary Semantic Scholar Graph API
    if let Some(ref doi) = resolved_doi {
        if doi.starts_with("10.1109/") {
            debug!(doi = %doi, "Tier 3: Querying Semantic Scholar for Open Access PDF link");
            let s2_url = format!(
                "https://api.semanticscholar.org/graph/v1/paper/DOI:{}?fields=openAccessPdf,title",
                doi
            );
            if let Ok(resp) = client
                .get(&s2_url)
                .timeout(Duration::from_secs(4))
                .header("User-Agent", "InfinityResearcher/1.0")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(pdf_u) = json
                            .get("openAccessPdf")
                            .and_then(|p| p.get("url"))
                            .and_then(|u| u.as_str())
                        {
                            let cand_https = if pdf_u.starts_with("http://") {
                                pdf_u.replacen("http://", "https://", 1)
                            } else {
                                pdf_u.to_string()
                            };
                            if verify_pdf_endpoint(&cand_https, client).await {
                                info!(url = %cand_https, "Tier 3 SUCCESS: Semantic Scholar verified Open Access PDF stream");
                                return Ok(cand_https);
                            }
                        }
                    }
                }
            }
        }
    }

    // TIER 4: Quaternary Browser-Mimic Stamp.jsp IFRAME / Redirect Handshake
    let stamp_target = if url.contains("/stamp/stamp.jsp") {
        Some(url.to_string())
    } else if let Some(arnumber) = extract_arnumber(url) {
        Some(format!(
            "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber={}",
            arnumber
        ))
    } else {
        None
    };

    if let Some(ref stamp_url) = stamp_target {
        debug!(stamp_url = %stamp_url, "Tier 4: Performing browser-mimic stamp.jsp handshake");
        let stamp_resp = client
            .get(stamp_url)
            .timeout(Duration::from_secs(5))
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            )
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Referer", "https://ieeexplore.ieee.org/")
            .header("Sec-Ch-Ua", "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
            .header("Sec-Ch-Ua-Mobile", "?0")
            .header("Sec-Ch-Ua-Platform", "\"Windows\"")
            .header("Sec-Fetch-Dest", "document")
            .header("Sec-Fetch-Mode", "navigate")
            .header("Sec-Fetch-Site", "same-origin")
            .header("Upgrade-Insecure-Requests", "1")
            .send()
            .await;

        if let Ok(resp) = stamp_resp {
            if resp.status().is_success() {
                if let Ok(body) = resp.text().await {
                    let re_frame = RE_PDF_FRAME.get_or_init(|| {
                        Regex::new(r#"(?i)<i?frame[^>]+src=["'](https?://[^"']*(?:ielx|iel\d+|pdf)[^"']*\.pdf[^"']*)["']"#).unwrap()
                    });
                    if let Some(caps) = re_frame.captures(&body) {
                        if let Some(matched) = caps.get(1) {
                            let frame_url = matched.as_str();
                            if verify_pdf_endpoint(frame_url, client).await {
                                info!(url = %frame_url, "Tier 4 SUCCESS: Extracted verified direct PDF from stamp IFRAME");
                                return Ok(frame_url.to_string());
                            }
                        }
                    }

                    let re_js = RE_JS_REDIRECT.get_or_init(|| {
                        Regex::new(r#"(?i)(?:window\.location\.replace|var\s+pdfUrl\s*=)\s*\(?["'](https?://[^"']*\.pdf[^"']*)["']"#).unwrap()
                    });
                    if let Some(caps) = re_js.captures(&body) {
                        if let Some(matched) = caps.get(1) {
                            let js_url = matched.as_str();
                            if verify_pdf_endpoint(js_url, client).await {
                                info!(url = %js_url, "Tier 4 SUCCESS: Extracted verified direct PDF from JavaScript redirect");
                                return Ok(js_url.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // TIER 5: Fallback to existing URL if it already looks like a direct PDF
    if url.contains(".pdf") && !url.contains("stamp.jsp") {
        if verify_pdf_endpoint(url, client).await {
            return Ok(url.to_string());
        }
    }

    warn!(url = %url, "All IEEE Open Access resolution tiers exhausted without finding direct %PDF- stream");
    Err("IEEE Open Access stream resolution exhausted. The document may be under publisher embargo or require institutional campus authentication.".to_string())
}

/// Helper function to perform a fast byte-level check on an endpoint to verify it serves raw %PDF-.
async fn verify_pdf_endpoint(url_str: &str, client: &reqwest::Client) -> bool {
    let validated = match UrlGuard::validate_url(url_str) {
        Ok(v) => v,
        Err(_) => return false,
    };

    if validated.scheme() != "https" && validated.scheme() != "http" {
        return false;
    }

    let resp = client
        .get(validated.as_str())
        .timeout(Duration::from_secs(4))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "application/pdf,*/*")
        .header("Range", "bytes=0-1024")
        .send()
        .await;

    match resp {
        Ok(mut r) if r.status().is_success() || r.status().as_u16() == 206 => {
            if let Ok(Some(first_chunk)) = r.chunk().await {
                if first_chunk.len() >= 5 && first_chunk.starts_with(b"%PDF-") {
                    return true;
                }
            }
            false
        }
        _ => false,
    }
}

/// Resolves and fetches the full binary PDF bytes for an IEEE paper.
pub async fn resolve_and_fetch_ieee_pdf(
    url: &str,
    doi: Option<&str>,
    title: Option<&str>,
    client: &reqwest::Client,
    max_bytes: usize,
) -> Result<Vec<u8>, String> {
    let direct_url = resolve_ieee_direct_pdf_url(url, doi, title, client).await?;

    let validated = UrlGuard::validate_url(&direct_url)
        .map_err(|e| format!("Security validation failed for resolved IEEE PDF link: {e}"))?;

    let resp = client
        .get(validated.as_str())
        .timeout(Duration::from_secs(10))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8")
        .header("Referer", "https://ieeexplore.ieee.org/")
        .send()
        .await
        .map_err(|e| format!("Failed to download resolved IEEE PDF stream: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "IEEE PDF server returned HTTP error status {}",
            resp.status()
        ));
    }

    let mut resp = resp;
    let mut bytes = Vec::new();
    while let Ok(Some(chunk)) = resp.chunk().await {
        if bytes.len() + chunk.len() > max_bytes {
            return Err("IEEE PDF stream exceeded max allowed size limit".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }

    if bytes.len() < 5 || !bytes.starts_with(b"%PDF-") {
        return Err("Downloaded document did not contain a valid %PDF- binary header".to_string());
    }

    info!(
        size_bytes = bytes.len(),
        url = %direct_url,
        "Successfully fetched and validated raw IEEE Open Access PDF bytes"
    );

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ieee_target() {
        assert!(is_ieee_target(
            "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=9269337",
            None
        ));
        assert!(is_ieee_target(
            "https://ieeexplore.ieee.org/document/9269337",
            None
        ));
        assert!(is_ieee_target(
            "https://xplorestaging.ieee.org/ielx7/6287639/8948470/09269337.pdf?arnumber=9269337",
            None
        ));
        assert!(is_ieee_target(
            "https://doi.org/10.1109/ACCESS.2020.3040083",
            Some("10.1109/ACCESS.2020.3040083")
        ));
        assert!(is_ieee_target(
            "https://example.com/paper.pdf",
            Some("10.1109/CVPR.2016.90")
        ));
        assert!(!is_ieee_target(
            "https://arxiv.org/abs/2401.12345",
            Some("10.48550/arXiv.2401.12345")
        ));
        assert!(!is_ieee_target(
            "https://nature.com/articles/s41586-020-0001",
            None
        ));
    }

    #[test]
    fn test_extract_arnumber() {
        assert_eq!(
            extract_arnumber("https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=9269337"),
            Some("9269337".to_string())
        );
        assert_eq!(
            extract_arnumber("https://ieeexplore.ieee.org/document/9269337"),
            Some("9269337".to_string())
        );
        assert_eq!(
            extract_arnumber(
                "https://xplorestaging.ieee.org/ielx7/6287639/8948470/09269337.pdf?arnumber=9269337"
            ),
            Some("9269337".to_string())
        );
        assert_eq!(extract_arnumber("https://arxiv.org/abs/2401.12345"), None);
    }

    #[test]
    fn test_normalize_doi() {
        assert_eq!(
            normalize_doi("10.1109/ACCESS.2020.3040083"),
            "10.1109/ACCESS.2020.3040083"
        );
        assert_eq!(
            normalize_doi("https://doi.org/10.1109/ACCESS.2020.3040083"),
            "10.1109/ACCESS.2020.3040083"
        );
        assert_eq!(
            normalize_doi("http://dx.doi.org/10.1109/ACCESS.2020.3040083"),
            "10.1109/ACCESS.2020.3040083"
        );
    }
}
