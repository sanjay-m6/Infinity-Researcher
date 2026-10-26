use chrono::Utc;
use serde_json::Value;
use std::time::Duration;
use uuid::Uuid;

use crate::database::Database;
use crate::domain::pdf_workspace::{PdfAvailabilityStatus, PdfCandidate, PdfResolutionResult};
use crate::errors::AppError;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::scrapers::url_guard::UrlGuard;

pub struct PdfResolverService;

impl PdfResolverService {
    /// Resolves PDF availability for a paper in the library by executing the 6-step sequence.
    pub async fn resolve_for_paper(
        db: &Database,
        client: &reqwest::Client,
        paper_id: &str,
    ) -> Result<PdfResolutionResult, AppError> {
        // 1. Fetch paper metadata synchronously without holding lock across await
        let (title, canonical_doi, primary_landing_url, pdf_url, local_pdf_path, is_open_access) = {
            let conn = db.lock()?;
            conn.query_row(
                "SELECT title, canonical_doi, primary_landing_url, pdf_url, local_pdf_path, is_open_access
                 FROM papers WHERE id = ?1",
                [paper_id],
                |row| {
                    let oa_int: i64 = row.get(5)?;
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        oa_int > 0,
                    ))
                },
            )
            .map_err(|e| AppError::Internal(format!("Failed to fetch paper {}: {}", paper_id, e)))?
        };

        Self::resolve_with_metadata(
            Some(db),
            client,
            paper_id,
            &title,
            canonical_doi.as_deref(),
            primary_landing_url.as_deref(),
            pdf_url.as_deref(),
            local_pdf_path.as_deref(),
            is_open_access,
        )
        .await
    }

    /// Resolves PDF availability given bibliographic attributes (works for both library papers and search results).
    #[allow(clippy::too_many_arguments)]
    pub async fn resolve_with_metadata(
        db_opt: Option<&Database>,
        client: &reqwest::Client,
        paper_id: &str,
        _title: &str,
        canonical_doi: Option<&str>,
        primary_landing_url: Option<&str>,
        direct_pdf_url: Option<&str>,
        local_pdf_path: Option<&str>,
        is_open_access_hint: bool,
    ) -> Result<PdfResolutionResult, AppError> {
        let mut candidates = Vec::new();
        let mut evidence = Vec::new();

        // --------------------------------------------------------------------
        // Step 1: Check if already downloaded locally
        // --------------------------------------------------------------------
        if let Some(path_str) = local_pdf_path {
            let path = std::path::Path::new(path_str);
            if path.exists() {
                evidence.push(format!("Verified local PDF file exists at {}", path_str));
                let sha256 = if let Some(db) = db_opt {
                    let conn = db.lock()?;
                    conn.query_row(
                        "SELECT sha256_hash FROM paper_files WHERE paper_id = ?1 AND file_path = ?2
                         UNION ALL
                         SELECT content_hash FROM papers WHERE id = ?1 AND local_pdf_path = ?2
                         LIMIT 1",
                        rusqlite::params![paper_id, path_str],
                        |r| r.get::<_, Option<String>>(0),
                    )
                    .unwrap_or(None)
                } else {
                    None
                };

                return Ok(PdfResolutionResult {
                    paper_id: paper_id.to_string(),
                    status: PdfAvailabilityStatus::Downloaded,
                    best_url: None,
                    candidates: vec![],
                    evidence,
                    local_file_path: Some(path_str.to_string()),
                    sha256_hash: sha256,
                });
            } else {
                evidence.push(format!(
                    "Local file record exists but file is missing on disk: {}",
                    path_str
                ));
            }
        }

        // --------------------------------------------------------------------
        // Step 2: Check direct PDF link from source/adapter
        // --------------------------------------------------------------------
        if let Some(url_str) = direct_pdf_url {
            let clean_url = url_str.trim();
            if !clean_url.is_empty() {
                if let Ok(validated_url) = UrlGuard::validate_url(clean_url) {
                    let cand = PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: validated_url.to_string(),
                        provider_id: "direct_source".to_string(),
                        source_type: "direct_api".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Direct PDF link provided by scholarly source adapter".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    };
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &cand);
                        }
                    }
                    candidates.push(cand);
                    evidence.push(format!(
                        "Source connector provided direct PDF URL: {}",
                        validated_url
                    ));
                }
            }
        }

        // --------------------------------------------------------------------
        // Step 3: Unpaywall Open-Access Lookup (if canonical DOI is present)
        // --------------------------------------------------------------------
        if let Some(doi) = canonical_doi {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if !clean_doi.is_empty() {
                if let Some(oa_candidate) =
                    Self::query_unpaywall_oa(client, clean_doi, paper_id).await
                {
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ =
                                PdfWorkspaceRepository::save_pdf_candidate(&conn, &oa_candidate);
                        }
                    }
                    evidence.push(format!(
                        "Unpaywall confirmed open-access location: {}",
                        oa_candidate.url
                    ));
                    candidates.push(oa_candidate);
                }
            }
        }

        // --------------------------------------------------------------------
        // Step 4: Publisher / Landing Page Meta Tag Extraction
        // --------------------------------------------------------------------
        let landing_candidate: Option<String> = primary_landing_url
            .map(|s| s.to_string())
            .or_else(|| canonical_doi.map(|d| format!("https://doi.org/{}", d.trim())));

        if candidates.is_empty() {
            if let Some(ref landing_url) = landing_candidate {
                if let Ok(valid_landing) = UrlGuard::validate_url(landing_url) {
                    if let Some(meta_pdf) =
                        Self::extract_pdf_from_landing_page(client, &valid_landing, paper_id).await
                    {
                        if let Some(db) = db_opt {
                            if let Ok(conn) = db.lock() {
                                let _ =
                                    PdfWorkspaceRepository::save_pdf_candidate(&conn, &meta_pdf);
                            }
                        }
                        evidence.push(format!(
                            "Discovered citation_pdf_url from landing page metadata: {}",
                            meta_pdf.url
                        ));
                        candidates.push(meta_pdf);
                    }
                }
            }
        }

        // --------------------------------------------------------------------
        // Step 5: Evaluate Status Machine
        // --------------------------------------------------------------------
        let (status, best_url) = if let Some(best) = candidates.first() {
            (
                PdfAvailabilityStatus::OpenAccessAvailable,
                Some(best.url.clone()),
            )
        } else if is_open_access_hint {
            (
                PdfAvailabilityStatus::OpenAccessAvailable,
                landing_candidate,
            )
        } else if landing_candidate.is_some() {
            (PdfAvailabilityStatus::LandingPageOnly, None)
        } else if canonical_doi.is_some() {
            (PdfAvailabilityStatus::MetadataOnly, None)
        } else {
            (PdfAvailabilityStatus::NotFound, None)
        };

        Ok(PdfResolutionResult {
            paper_id: paper_id.to_string(),
            status,
            best_url,
            candidates,
            evidence,
            local_file_path: None,
            sha256_hash: None,
        })
    }

    /// Queries the public Unpaywall API using compliant polite identification
    async fn query_unpaywall_oa(
        client: &reqwest::Client,
        doi: &str,
        paper_id: &str,
    ) -> Option<PdfCandidate> {
        let encoded_doi = url::form_urlencoded::byte_serialize(doi.as_bytes()).collect::<String>();
        let unpaywall_url = format!(
            "https://api.unpaywall.org/v2/{}?email=unpaywall@researchpaperscraper.local",
            encoded_doi
        );

        let req = client
            .get(&unpaywall_url)
            .timeout(Duration::from_secs(6))
            .header(
                "User-Agent",
                "ResearchPaperScraper/0.1.0 (Desktop; OpenAccessResolver)",
            );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return None,
        };

        let json: Value = resp.json().await.ok()?;
        let is_oa = json.get("is_oa").and_then(|v| v.as_bool()).unwrap_or(false);
        if !is_oa {
            return None;
        }

        let best_loc = json.get("best_oa_location")?;
        let pdf_url = best_loc
            .get("url_for_pdf")
            .and_then(|v| v.as_str())
            .or_else(|| best_loc.get("url").and_then(|v| v.as_str()))?;

        let validated = UrlGuard::validate_url(pdf_url).ok()?;
        let license = best_loc
            .get("license")
            .and_then(|v| v.as_str())
            .unwrap_or("Open Access (Unpaywall)");

        Some(PdfCandidate {
            id: Uuid::new_v4().to_string(),
            paper_id: paper_id.to_string(),
            url: validated.to_string(),
            provider_id: "unpaywall".to_string(),
            source_type: "open_access_resolver".to_string(),
            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
            evidence_notes: Some(format!("License: {}", license)),
            last_checked_at: Utc::now().to_rfc3339(),
            created_at: Utc::now().to_rfc3339(),
        })
    }

    /// Safely attempts to fetch a publisher landing page and inspect `<meta name="citation_pdf_url">`
    async fn extract_pdf_from_landing_page(
        client: &reqwest::Client,
        landing_url: &url::Url,
        paper_id: &str,
    ) -> Option<PdfCandidate> {
        let req = client
            .get(landing_url.as_str())
            .timeout(Duration::from_secs(5))
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ResearchPaperScraper/0.1.0",
            );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return None,
        };

        // Guard against massive pages
        if let Some(len) = resp.content_length() {
            if len > 5 * 1024 * 1024 {
                return None;
            }
        }

        let body = resp.text().await.ok()?;
        let parsed_html = scraper::Html::parse_document(&body);
        let meta_selector = scraper::Selector::parse("meta[name='citation_pdf_url']").ok()?;

        if let Some(element) = parsed_html.select(&meta_selector).next() {
            if let Some(content) = element.value().attr("content") {
                let resolved = UrlGuard::resolve_link(landing_url, content)?;
                let validated = UrlGuard::validate_url(&resolved).ok()?;
                return Some(PdfCandidate {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper_id.to_string(),
                    url: validated.to_string(),
                    provider_id: "landing_page".to_string(),
                    source_type: "landing_page_meta".to_string(),
                    access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                    evidence_notes: Some("citation_pdf_url meta tag on publisher page".to_string()),
                    last_checked_at: Utc::now().to_rfc3339(),
                    created_at: Utc::now().to_rfc3339(),
                });
            }
        }

        None
    }
}
