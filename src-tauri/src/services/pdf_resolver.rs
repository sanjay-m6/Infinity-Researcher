use chrono::Utc;
use serde_json::Value;
use std::time::Duration;
use uuid::Uuid;

use crate::database::Database;
use crate::domain::pdf_workspace::{PdfAvailabilityStatus, PdfCandidate, PdfResolutionResult};
use crate::errors::AppError;
use crate::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use crate::scrapers::url_guard::UrlGuard;
use crate::services::candidate_verifier::CandidateVerifier;

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
        title: &str,
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
        let mut deferred_pmc_candidate: Option<PdfCandidate> = None;
        if let Some(url_str) = direct_pdf_url {
            let clean_url = url_str.trim();
            if !clean_url.is_empty() {
                if let Ok(validated_url) = UrlGuard::validate_url(clean_url) {
                    let is_ncbi_pmc = clean_url.contains("ncbi.nlm.nih.gov/pmc/articles/");
                    let is_ieee_stamp = clean_url.contains("ieeexplore.ieee.org/stamp/stamp.jsp");

                    if is_ieee_stamp {
                        if let Some(ieee_cand) =
                            Self::extract_pdf_from_ieee_stamp(client, &validated_url, paper_id)
                                .await
                        {
                            if let Some(db) = db_opt {
                                if let Ok(conn) = db.lock() {
                                    let _ = PdfWorkspaceRepository::save_pdf_candidate(
                                        &conn, &ieee_cand,
                                    );
                                }
                            }
                            evidence.push(format!(
                                "Direct PDF link resolved from IEEE Open Access stamp: {}",
                                ieee_cand.url
                            ));
                            candidates.push(ieee_cand);
                        } else {
                            evidence.push("IEEE document is paywalled or requires authentication (no direct Open Access PDF stream available)".to_string());
                        }
                    } else {
                        let cand = PdfCandidate {
                            id: Uuid::new_v4().to_string(),
                            paper_id: paper_id.to_string(),
                            url: validated_url.to_string(),
                            provider_id: if is_ncbi_pmc {
                                "ncbi_pmc_web".to_string()
                            } else {
                                "direct_source".to_string()
                            },
                            source_type: if is_ncbi_pmc {
                                "pmc_challenge".to_string()
                            } else {
                                "direct_api".to_string()
                            },
                            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                            evidence_notes: Some(if is_ncbi_pmc {
                                "PubMed Central web link (requires interactive browser POW verification)".to_string()
                            } else {
                                "Direct PDF link provided by scholarly source adapter".to_string()
                            }),
                            version_type: Some(if is_ncbi_pmc {
                                "accepted_manuscript".to_string()
                            } else {
                                "published_version".to_string()
                            }),
                            identity_status: Some("unknown".to_string()),
                            identity_score: Some(0.0),
                            provenance_json: None,
                            last_checked_at: Utc::now().to_rfc3339(),
                            created_at: Utc::now().to_rfc3339(),
                        };
                        if let Some(db) = db_opt {
                            if let Ok(conn) = db.lock() {
                                let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &cand);
                            }
                        }
                        if is_ncbi_pmc {
                            deferred_pmc_candidate = Some(cand);
                        } else {
                            candidates.push(cand);
                            evidence.push(format!(
                                "Source connector provided direct PDF URL: {}",
                                validated_url
                            ));
                        }
                    }
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
                        "Unpaywall confirmed open-access location [{}]: {}",
                        oa_candidate.version_type.as_deref().unwrap_or("unknown"),
                        oa_candidate.url
                    ));
                    candidates.push(oa_candidate);
                }

                // --------------------------------------------------------------------
                // Step 3.2: OpenAlex Open-Access Locations (Green OA, Institutional Repositories)
                // --------------------------------------------------------------------
                let openalex_cands =
                    Self::query_openalex_oa_locations(client, clean_doi, paper_id).await;
                for oac in openalex_cands {
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &oac);
                        }
                    }
                    evidence.push(format!(
                        "OpenAlex discovered alternative OA location [{}]: {}",
                        oac.version_type.as_deref().unwrap_or("unknown"),
                        oac.url
                    ));
                    candidates.push(oac);
                }

                // --------------------------------------------------------------------
                // Step 3.3: Europe PMC Full-Text API Lookup
                // --------------------------------------------------------------------
                if let Some(epmc_cand) =
                    Self::query_europe_pmc_oa(client, clean_doi, paper_id).await
                {
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &epmc_cand);
                        }
                    }
                    evidence.push(format!(
                        "Europe PMC confirmed repository full-text PDF: {}",
                        epmc_cand.url
                    ));
                    candidates.push(epmc_cand);
                }

                // --------------------------------------------------------------------
                // Step 3.4: Semantic Scholar Open-Access Graph API Lookup
                // --------------------------------------------------------------------
                if let Some(s2_cand) =
                    Self::query_semantic_scholar_oa(client, clean_doi, paper_id).await
                {
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &s2_cand);
                        }
                    }
                    evidence.push(format!(
                        "Semantic Scholar discovered open-access PDF [{}]: {}",
                        s2_cand.version_type.as_deref().unwrap_or("unknown"),
                        s2_cand.url
                    ));
                    candidates.push(s2_cand);
                }

                // --------------------------------------------------------------------
                // Step 3.5: Crossref Works Link API Lookup
                // --------------------------------------------------------------------
                let crossref_cands =
                    Self::query_crossref_oa_links(client, clean_doi, paper_id).await;
                for crc in crossref_cands {
                    if let Some(db) = db_opt {
                        if let Ok(conn) = db.lock() {
                            let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &crc);
                        }
                    }
                    evidence.push(format!(
                        "Crossref registered open-access PDF location: {}",
                        crc.url
                    ));
                    candidates.push(crc);
                }
            }
        }

        // If no direct PDF candidate was found by direct source or Unpaywall, append deferred PMC candidate
        if candidates.is_empty() {
            if let Some(pmc_cand) = deferred_pmc_candidate {
                evidence.push(format!(
                    "Using PubMed Central web link (interactive browser verification may be required): {}",
                    pmc_cand.url
                ));
                candidates.push(pmc_cand);
            }
        }

        // --------------------------------------------------------------------
        // Step 3.5: Deterministic Canonical Open-Access Routes (arXiv, bioRxiv, PLOS, PMC)
        // --------------------------------------------------------------------
        let canonical_routes =
            Self::generate_canonical_candidates(canonical_doi, primary_landing_url, paper_id);
        for canon_cand in canonical_routes {
            evidence.push(format!(
                "Generated canonical {} route: {}",
                canon_cand.provider_id, canon_cand.url
            ));
            candidates.push(canon_cand);
        }

        // --------------------------------------------------------------------
        // Step 4: Publisher / Landing Page Meta Tag Extraction
        // --------------------------------------------------------------------
        let landing_candidate: Option<String> = primary_landing_url
            .map(|s| s.to_string())
            .or_else(|| canonical_doi.map(|d| format!("https://doi.org/{}", d.trim())));

        let has_verified_candidate = candidates
            .iter()
            .any(|c| c.access_status == PdfAvailabilityStatus::VerifiedOpenAccess);

        if !has_verified_candidate {
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
        // Step 4.5: Title-Based Preprint & Green Open-Access Mirror Recovery
        // (CRUCIAL for paywalled IEEE, Elsevier, Springer, Nature, ACM, Wiley papers)
        // --------------------------------------------------------------------
        let clean_title = title.trim();
        if clean_title.len() >= 5 {
            let preprint_cands = Self::query_title_preprint_oa(client, clean_title, paper_id).await;
            for pc in preprint_cands {
                if let Some(db) = db_opt {
                    if let Ok(conn) = db.lock() {
                        let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, &pc);
                    }
                }
                evidence.push(format!(
                    "Discovered open-access preprint / mirror by title [{}]: {}",
                    pc.version_type.as_deref().unwrap_or("preprint"),
                    pc.url
                ));
                candidates.push(pc);
            }
        }

        // --------------------------------------------------------------------
        // Step 5: Verification & Explainable Scoring across candidates
        // --------------------------------------------------------------------
        // Deduplicate candidates by URL
        let mut seen_urls = std::collections::HashSet::new();
        candidates.retain(|c| seen_urls.insert(c.url.clone()));

        // Prioritize verifying known open-access sources over commercial publisher paywalls
        candidates.sort_by_key(|c| {
            let url = c.url.to_lowercase();
            let pid = c.provider_id.to_lowercase();
            if url.contains("arxiv.org") || pid.contains("arxiv") {
                0
            } else if url.contains("europepmc.org") || pid.contains("europe_pmc") {
                1
            } else if pid.contains("unpaywall")
                || pid.contains("openalex")
                || pid.contains("semantic_scholar")
            {
                2
            } else if url.contains(".pdf") {
                3
            } else {
                4
            }
        });

        let mut scored_candidates: Vec<(PdfCandidate, f64, bool)> = Vec::new();
        // Evaluate candidates (limit to top 8 to prevent network saturation)
        for mut cand in candidates {
            if scored_candidates.len() < 8 {
                let report =
                    CandidateVerifier::verify_candidate(client, &cand.url, Some(title), None).await;
                if report.is_valid && report.has_pdf_signature {
                    cand.url = report.final_url;
                    cand.access_status = PdfAvailabilityStatus::VerifiedOpenAccess;
                    cand.evidence_notes = Some(format!(
                        "{} (Verified %PDF- signature, confidence {:.0}%)",
                        cand.evidence_notes.as_deref().unwrap_or(""),
                        report.score
                    ));
                    scored_candidates.push((cand, report.score, true));
                    continue;
                } else if report.score > 0.0 {
                    cand.evidence_notes = Some(format!(
                        "{} (Confidence {:.0}%)",
                        cand.evidence_notes.as_deref().unwrap_or(""),
                        report.score
                    ));
                    scored_candidates.push((cand, report.score, false));
                    continue;
                }
            }
            scored_candidates.push((cand, 10.0, false));
        }

        // Sort descending: verified first, then highest confidence score
        scored_candidates.sort_by(|a, b| {
            b.2.cmp(&a.2)
                .then_with(|| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal))
        });

        let sorted_candidates: Vec<PdfCandidate> =
            scored_candidates.into_iter().map(|(c, _, _)| c).collect();

        // Persist verified candidates to database
        if let Some(db) = db_opt {
            if let Ok(conn) = db.lock() {
                for c in &sorted_candidates {
                    let _ = PdfWorkspaceRepository::save_pdf_candidate(&conn, c);
                }
            }
        }

        // --------------------------------------------------------------------
        // Step 6: Evaluate Status Machine
        // --------------------------------------------------------------------
        let (status, best_url) = if let Some(best) = sorted_candidates.first() {
            evidence.push(format!(
                "Selected best candidate from {} [{}]: {}",
                best.provider_id,
                best.access_status.as_str(),
                best.url
            ));
            (best.access_status, Some(best.url.clone()))
        } else if is_open_access_hint {
            (
                PdfAvailabilityStatus::OpenAccessAvailable,
                landing_candidate,
            )
        } else if landing_candidate.is_some() {
            (PdfAvailabilityStatus::LandingPageOnly, None)
        } else if canonical_doi.is_some() {
            (PdfAvailabilityStatus::PublicMetadataOnly, None)
        } else {
            (PdfAvailabilityStatus::NotFound, None)
        };

        Ok(PdfResolutionResult {
            paper_id: paper_id.to_string(),
            status,
            best_url,
            candidates: sorted_candidates,
            evidence,
            local_file_path: None,
            sha256_hash: None,
        })
    }

    /// Generates canonical open-access direct PDF URLs based on deterministic provider patterns
    pub fn generate_canonical_candidates(
        doi_opt: Option<&str>,
        landing_opt: Option<&str>,
        paper_id: &str,
    ) -> Vec<PdfCandidate> {
        let mut generated = Vec::new();

        // 1. arXiv canonical route
        let mut arxiv_id = None;
        if let Some(doi) = doi_opt {
            let lower_doi = doi.to_lowercase();
            if let Some(pos) = lower_doi.find("arxiv.") {
                arxiv_id = Some(doi[pos + 6..].trim().to_string());
            } else if lower_doi.starts_with("arxiv:") {
                arxiv_id = Some(doi[6..].trim().to_string());
            } else if lower_doi.starts_with("10.48550/") {
                arxiv_id = Some(doi[9..].trim().to_string());
            }
        }
        if arxiv_id.is_none() {
            if let Some(landing) = landing_opt {
                let lower_landing = landing.to_lowercase();
                if let Some(pos) = lower_landing.find("arxiv.org/abs/") {
                    let rest = &landing[pos + 14..];
                    let id = rest.split(['?', '#', '/']).next().unwrap_or("").trim();
                    if !id.is_empty() {
                        arxiv_id = Some(id.to_string());
                    }
                } else if let Some(pos) = lower_landing.find("arxiv.org/pdf/") {
                    let rest = &landing[pos + 14..];
                    let id = rest.split(['?', '#', '/']).next().unwrap_or("").trim();
                    if !id.is_empty() {
                        arxiv_id = Some(id.to_string());
                    }
                } else if let Some(pos) = lower_landing.find("arxiv.org/html/") {
                    let rest = &landing[pos + 15..];
                    let id = rest.split(['?', '#', '/']).next().unwrap_or("").trim();
                    if !id.is_empty() {
                        arxiv_id = Some(id.to_string());
                    }
                } else if let Some(pos) = lower_landing.find("ar5iv.labs.arxiv.org/html/") {
                    let rest = &landing[pos + 25..];
                    let id = rest.split(['?', '#', '/']).next().unwrap_or("").trim();
                    if !id.is_empty() {
                        arxiv_id = Some(id.to_string());
                    }
                }
            }
        }
        if let Some(aid) = arxiv_id {
            let clean_id = aid.trim_end_matches(".pdf").trim();
            if !clean_id.is_empty() {
                let url = format!("https://arxiv.org/pdf/{}.pdf", clean_id);
                if let Ok(val) = UrlGuard::validate_url(&url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_arxiv".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some("Deterministic canonical arXiv PDF route".to_string()),
                        version_type: Some("preprint".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"arxiv\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        // 2. bioRxiv / medRxiv canonical routes (DOI prefix 10.1101/ or landing URL)
        let mut biorxiv_doi = None;
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.1101/") {
                biorxiv_doi = Some(clean_doi.to_string());
            }
        }
        if biorxiv_doi.is_none() {
            if let Some(landing) = landing_opt {
                if landing.contains("biorxiv.org/content/")
                    || landing.contains("medrxiv.org/content/")
                {
                    if let Some(pos) = landing.find("/content/") {
                        let rest = &landing[pos + 9..];
                        let clean_path = rest
                            .trim_end_matches(".full.pdf")
                            .trim_end_matches(".full")
                            .trim_matches('/');
                        if clean_path.starts_with("10.1101/") {
                            biorxiv_doi = Some(clean_path.to_string());
                        }
                    }
                }
            }
        }
        if let Some(clean_doi) = biorxiv_doi {
            let biorxiv_url = format!("https://www.biorxiv.org/content/{}.full.pdf", clean_doi);
            if let Ok(val) = UrlGuard::validate_url(&biorxiv_url) {
                generated.push(PdfCandidate {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper_id.to_string(),
                    url: val.to_string(),
                    provider_id: "canonical_biorxiv".to_string(),
                    source_type: "canonical_open_access".to_string(),
                    access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                    evidence_notes: Some(
                        "Deterministic canonical bioRxiv/medRxiv PDF route".to_string(),
                    ),
                    version_type: Some("preprint".to_string()),
                    identity_status: Some("unknown".to_string()),
                    identity_score: Some(0.0),
                    provenance_json: Some(
                        "{\"provider\":\"biorxiv\",\"canonical\":true}".to_string(),
                    ),
                    last_checked_at: Utc::now().to_rfc3339(),
                    created_at: Utc::now().to_rfc3339(),
                });
            }
        }

        // 3. PLOS canonical route (DOI prefix 10.1371/ or journals.plos.org)
        let mut plos_doi = None;
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.1371/") {
                plos_doi = Some(clean_doi.to_string());
            }
        }
        if plos_doi.is_none() {
            if let Some(landing) = landing_opt {
                if landing.contains("journals.plos.org") {
                    if let Some(pos) = landing.find("id=10.1371/") {
                        let rest = &landing[pos + 3..];
                        let id = rest.split('&').next().unwrap_or("").trim();
                        if !id.is_empty() {
                            plos_doi = Some(id.to_string());
                        }
                    }
                }
            }
        }
        if let Some(clean_doi) = plos_doi {
            let plos_url = format!(
                "https://journals.plos.org/plosone/article/file?id={}&type=printable",
                clean_doi
            );
            if let Ok(val) = UrlGuard::validate_url(&plos_url) {
                generated.push(PdfCandidate {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper_id.to_string(),
                    url: val.to_string(),
                    provider_id: "canonical_plos".to_string(),
                    source_type: "canonical_open_access".to_string(),
                    access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                    evidence_notes: Some(
                        "Deterministic canonical PLOS printable PDF route".to_string(),
                    ),
                    version_type: Some("published_version".to_string()),
                    identity_status: Some("unknown".to_string()),
                    identity_score: Some(0.0),
                    provenance_json: Some("{\"provider\":\"plos\",\"canonical\":true}".to_string()),
                    last_checked_at: Utc::now().to_rfc3339(),
                    created_at: Utc::now().to_rfc3339(),
                });
            }
        }

        // 4. MDPI (100% Gold Open Access - DOI prefix 10.3390/)
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.3390/") {
                let mdpi_url = format!("https://www.mdpi.com/{}/pdf", clean_doi);
                if let Ok(val) = UrlGuard::validate_url(&mdpi_url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_mdpi".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Deterministic canonical MDPI Gold Open Access route".to_string(),
                        ),
                        version_type: Some("published_version".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"mdpi\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        // 5. PubMed Central (PMC) canonical route
        let mut pmc_id = None;
        for s in [doi_opt, landing_opt].into_iter().flatten() {
            let upper = s.to_uppercase();
            let mut search_from = 0;
            while let Some(rel_pos) = upper[search_from..].find("PMC") {
                let pos = search_from + rel_pos;
                let digits: String = upper[pos + 3..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect();
                if !digits.is_empty() {
                    pmc_id = Some(format!("PMC{}", digits));
                    break;
                }
                search_from = pos + 3;
            }
            if pmc_id.is_some() {
                break;
            }
        }
        if let Some(pmcid) = pmc_id {
            let pmc_url = format!("https://www.ncbi.nlm.nih.gov/pmc/articles/{}/pdf/", pmcid);
            if let Ok(val) = UrlGuard::validate_url(&pmc_url) {
                generated.push(PdfCandidate {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper_id.to_string(),
                    url: val.to_string(),
                    provider_id: "canonical_pmc".to_string(),
                    source_type: "canonical_open_access".to_string(),
                    access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                    evidence_notes: Some(format!(
                        "Deterministic canonical PMC repository route ({})",
                        pmcid
                    )),
                    version_type: Some("accepted_manuscript".to_string()),
                    identity_status: Some("unknown".to_string()),
                    identity_score: Some(0.0),
                    provenance_json: Some(format!(
                        "{{\"provider\":\"pmc\",\"pmcid\":\"{}\"}}",
                        pmcid
                    )),
                    last_checked_at: Utc::now().to_rfc3339(),
                    created_at: Utc::now().to_rfc3339(),
                });
            }
        }

        // 6. SpringerLink / BioMed Central / Nature (DOI prefix 10.1007/, 10.1186/, 10.1038/)
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.1007/")
                || clean_doi.starts_with("10.1186/")
                || clean_doi.starts_with("10.1038/")
            {
                let springer_url =
                    format!("https://link.springer.com/content/pdf/{}.pdf", clean_doi);
                if let Ok(val) = UrlGuard::validate_url(&springer_url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_springer".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Deterministic canonical Springer/Nature PDF route".to_string(),
                        ),
                        version_type: Some("published_version".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"springer\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        // 7. Wiley Online Library (DOI prefix 10.1002/, 10.1111/)
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.1002/") || clean_doi.starts_with("10.1111/") {
                let wiley_url = format!(
                    "https://onlinelibrary.wiley.com/doi/pdfdirect/{}",
                    clean_doi
                );
                if let Ok(val) = UrlGuard::validate_url(&wiley_url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_wiley".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Deterministic canonical Wiley Online Library direct PDF route"
                                .to_string(),
                        ),
                        version_type: Some("published_version".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"wiley\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        // 8. ACM Digital Library (DOI prefix 10.1145/)
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.1145/") {
                let acm_url = format!("https://dl.acm.org/doi/pdf/{}", clean_doi);
                if let Ok(val) = UrlGuard::validate_url(&acm_url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_acm".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Deterministic canonical ACM Digital Library direct PDF route"
                                .to_string(),
                        ),
                        version_type: Some("published_version".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"acm\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        // 9. Frontiers (DOI prefix 10.3389/)
        if let Some(doi) = doi_opt {
            let clean_doi = doi
                .trim()
                .trim_start_matches("https://doi.org/")
                .trim_start_matches("http://doi.org/");
            if clean_doi.starts_with("10.3389/") {
                let frontiers_url =
                    format!("https://www.frontiersin.org/articles/{}/pdf", clean_doi);
                if let Ok(val) = UrlGuard::validate_url(&frontiers_url) {
                    generated.push(PdfCandidate {
                        id: Uuid::new_v4().to_string(),
                        paper_id: paper_id.to_string(),
                        url: val.to_string(),
                        provider_id: "canonical_frontiers".to_string(),
                        source_type: "canonical_open_access".to_string(),
                        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                        evidence_notes: Some(
                            "Deterministic canonical Frontiers Gold Open Access route".to_string(),
                        ),
                        version_type: Some("published_version".to_string()),
                        identity_status: Some("unknown".to_string()),
                        identity_score: Some(0.0),
                        provenance_json: Some(
                            "{\"provider\":\"frontiers\",\"canonical\":true}".to_string(),
                        ),
                        last_checked_at: Utc::now().to_rfc3339(),
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        generated
    }

    /// Queries OpenAlex works API for available open-access locations across institutional repositories and preprints
    pub async fn query_openalex_oa_locations(
        client: &reqwest::Client,
        doi: &str,
        paper_id: &str,
    ) -> Vec<PdfCandidate> {
        let mut candidates = Vec::new();
        let encoded_doi = url::form_urlencoded::byte_serialize(doi.as_bytes()).collect::<String>();
        let url = format!(
            "https://api.openalex.org/works/https://doi.org/{}",
            encoded_doi
        );

        let req = client
            .get(&url)
            .timeout(Duration::from_secs(6))
            .header(
                "User-Agent",
                "InfinityResearcher/0.1.0 (Desktop; scholarly metadata and OA resolver; mailto:scholar@infinityresearcher.local)",
            );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return candidates,
        };

        let json: Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return candidates,
        };

        if let Some(locations) = json.get("oa_locations").and_then(|v| v.as_array()) {
            for loc in locations {
                let pdf_url_opt = loc
                    .get("pdf_url")
                    .and_then(|v| v.as_str())
                    .or_else(|| loc.get("landing_page_url").and_then(|v| v.as_str()));
                if let Some(pdf_url) = pdf_url_opt {
                    if let Ok(validated) = UrlGuard::validate_url(pdf_url) {
                        let version_raw = loc
                            .get("version")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let version_type = match version_raw {
                            "publishedVersion" => "published_version",
                            "acceptedVersion" => "accepted_manuscript",
                            "submittedVersion" => "preprint",
                            _ => "repository_version",
                        };
                        let source_name = loc
                            .get("source")
                            .and_then(|s| s.get("display_name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("OpenAlex OA Repository");
                        let license = loc
                            .get("license")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Open Access");

                        candidates.push(PdfCandidate {
                            id: Uuid::new_v4().to_string(),
                            paper_id: paper_id.to_string(),
                            url: validated.to_string(),
                            provider_id: "openalex_oa".to_string(),
                            source_type: "open_access_resolver".to_string(),
                            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                            evidence_notes: Some(format!(
                                "{} ({} - {})",
                                source_name, version_type, license
                            )),
                            version_type: Some(version_type.to_string()),
                            identity_status: Some("unknown".to_string()),
                            identity_score: Some(0.0),
                            provenance_json: Some(format!(
                                "{{\"source\":\"openalex\",\"repository\":\"{}\"}}",
                                source_name
                            )),
                            last_checked_at: Utc::now().to_rfc3339(),
                            created_at: Utc::now().to_rfc3339(),
                        });
                    }
                }
            }
        }
        candidates
    }

    /// Queries Europe PMC for legally available open-access full-text PDFs
    pub async fn query_europe_pmc_oa(
        client: &reqwest::Client,
        doi: &str,
        paper_id: &str,
    ) -> Option<PdfCandidate> {
        let encoded_doi = url::form_urlencoded::byte_serialize(doi.as_bytes()).collect::<String>();
        let url = format!(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:\"{}\"&format=json&resultType=core",
            encoded_doi
        );
        let req = client.get(&url).timeout(Duration::from_secs(6)).header(
            "User-Agent",
            "InfinityResearcher/0.1.0 (Desktop; EuropePMC resolver)",
        );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return None,
        };

        let json: Value = resp.json().await.ok()?;
        let results = json.get("resultList")?.get("result")?.as_array()?;
        let first = results.first()?;
        let is_oa = first
            .get("isOpenAccess")
            .and_then(|v| v.as_str())
            .unwrap_or("N")
            == "Y";
        if !is_oa {
            return None;
        }

        let pmcid = first.get("pmcid").and_then(|v| v.as_str());
        if let Some(id) = pmcid {
            let pdf_url = format!(
                "https://europepmc.org/backend/ptpmcrender.fcgi?accid={}&blobtype=pdf",
                id
            );
            if let Ok(validated) = UrlGuard::validate_url(&pdf_url) {
                return Some(PdfCandidate {
                    id: Uuid::new_v4().to_string(),
                    paper_id: paper_id.to_string(),
                    url: validated.to_string(),
                    provider_id: "europe_pmc_oa".to_string(),
                    source_type: "open_access_resolver".to_string(),
                    access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                    evidence_notes: Some(format!("Europe PMC Open Access repository ({})", id)),
                    version_type: Some("accepted_manuscript".to_string()),
                    identity_status: Some("unknown".to_string()),
                    identity_score: Some(0.0),
                    provenance_json: Some(format!(
                        "{{\"source\":\"europe_pmc\",\"pmcid\":\"{}\"}}",
                        id
                    )),
                    last_checked_at: Utc::now().to_rfc3339(),
                    created_at: Utc::now().to_rfc3339(),
                });
            }
        }
        None
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
        let version_str = best_loc
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("publishedVersion");
        let version_type = match version_str {
            "publishedVersion" => "published_version",
            "acceptedVersion" => "accepted_manuscript",
            "submittedVersion" => "preprint",
            _ => "unknown_version",
        };

        Some(PdfCandidate {
            id: Uuid::new_v4().to_string(),
            paper_id: paper_id.to_string(),
            url: validated.to_string(),
            provider_id: "unpaywall".to_string(),
            source_type: "open_access_resolver".to_string(),
            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
            evidence_notes: Some(format!("License: {} ({})", license, version_type)),
            version_type: Some(version_type.to_string()),
            identity_status: Some("unknown".to_string()),
            identity_score: Some(0.0),
            provenance_json: Some("{\"source\":\"unpaywall\"}".to_string()),
            last_checked_at: Utc::now().to_rfc3339(),
            created_at: Utc::now().to_rfc3339(),
        })
    }

    /// Queries Semantic Scholar Graph API for Open Access PDF locations
    pub async fn query_semantic_scholar_oa(
        client: &reqwest::Client,
        doi: &str,
        paper_id: &str,
    ) -> Option<PdfCandidate> {
        let clean_doi = doi
            .trim()
            .trim_start_matches("https://doi.org/")
            .trim_start_matches("http://doi.org/");
        let url = format!(
            "https://api.semanticscholar.org/graph/v1/paper/DOI:{}?fields=openAccessPdf,title,isOpenAccess",
            clean_doi
        );
        let req = client.get(&url).timeout(Duration::from_secs(5)).header(
            "User-Agent",
            "InfinityResearcher/0.1.0 (Desktop; scholarly OA resolver)",
        );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return None,
        };

        let json: Value = resp.json().await.ok()?;
        let oa_pdf = json.get("openAccessPdf")?;
        let pdf_url = oa_pdf.get("url").and_then(|v| v.as_str())?;
        let validated = UrlGuard::validate_url(pdf_url).ok()?;

        let status_str = oa_pdf
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("open_access");
        let version_type = match status_str.to_uppercase().as_str() {
            "GOLD" | "HYBRID" => "published_version",
            "GREEN" => "accepted_manuscript",
            _ => "unknown_version",
        };

        Some(PdfCandidate {
            id: Uuid::new_v4().to_string(),
            paper_id: paper_id.to_string(),
            url: validated.to_string(),
            provider_id: "semantic_scholar_oa".to_string(),
            source_type: "open_access_resolver".to_string(),
            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
            evidence_notes: Some(format!("Semantic Scholar OpenAccessPdf ({})", status_str)),
            version_type: Some(version_type.to_string()),
            identity_status: Some("unknown".to_string()),
            identity_score: Some(0.0),
            provenance_json: Some(format!(
                "{{\"source\":\"semantic_scholar\",\"status\":\"{}\"}}",
                status_str
            )),
            last_checked_at: Utc::now().to_rfc3339(),
            created_at: Utc::now().to_rfc3339(),
        })
    }

    /// Queries Crossref Works API for direct publisher full-text PDF links
    pub async fn query_crossref_oa_links(
        client: &reqwest::Client,
        doi: &str,
        paper_id: &str,
    ) -> Vec<PdfCandidate> {
        let mut candidates = Vec::new();
        let clean_doi = doi
            .trim()
            .trim_start_matches("https://doi.org/")
            .trim_start_matches("http://doi.org/");
        let url = format!("https://api.crossref.org/works/{}", clean_doi);
        let req = client.get(&url).timeout(Duration::from_secs(5)).header(
            "User-Agent",
            "InfinityResearcher/0.1.0 (Desktop; mailto:scholar@infinityresearcher.local)",
        );

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            _ => return candidates,
        };

        let json: Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return candidates,
        };

        if let Some(links) = json
            .get("message")
            .and_then(|m| m.get("link"))
            .and_then(|v| v.as_array())
        {
            for link in links {
                let content_type = link
                    .get("content-type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let url_str = match link.get("URL").and_then(|v| v.as_str()) {
                    Some(u) => u,
                    None => continue,
                };

                let is_pdf = content_type.contains("application/pdf")
                    || url_str.to_lowercase().ends_with(".pdf")
                    || url_str.to_lowercase().contains("/pdf/");

                if is_pdf {
                    if let Ok(validated) = UrlGuard::validate_url(url_str) {
                        let version = link
                            .get("content-version")
                            .and_then(|v| v.as_str())
                            .unwrap_or("vor");
                        let version_type = if version == "vor" {
                            "published_version"
                        } else {
                            "accepted_manuscript"
                        };

                        candidates.push(PdfCandidate {
                            id: Uuid::new_v4().to_string(),
                            paper_id: paper_id.to_string(),
                            url: validated.to_string(),
                            provider_id: "crossref_work".to_string(),
                            source_type: "open_access_resolver".to_string(),
                            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                            evidence_notes: Some(format!("Crossref Registered PDF ({})", version)),
                            version_type: Some(version_type.to_string()),
                            identity_status: Some("unknown".to_string()),
                            identity_score: Some(0.0),
                            provenance_json: Some(format!(
                                "{{\"source\":\"crossref\",\"content_type\":\"{}\"}}",
                                content_type
                            )),
                            last_checked_at: Utc::now().to_rfc3339(),
                            created_at: Utc::now().to_rfc3339(),
                        });
                    }
                }
            }
        }

        candidates
    }

    pub fn is_title_sufficiently_similar(a: &str, b: &str) -> bool {
        let clean_words = |s: &str| -> std::collections::HashSet<String> {
            s.to_lowercase()
                .chars()
                .map(|c| if c.is_alphanumeric() { c } else { ' ' })
                .collect::<String>()
                .split_whitespace()
                .filter(|w| w.len() > 2)
                .map(|w| w.to_string())
                .collect()
        };

        let words_a = clean_words(a);
        let words_b = clean_words(b);

        if words_a.is_empty() || words_b.is_empty() {
            return false;
        }

        let intersection = words_a.intersection(&words_b).count();
        let total = words_a.len() + words_b.len();
        let dice = (2.0 * intersection as f64) / (total as f64);
        let min_len = words_a.len().min(words_b.len());

        dice >= 0.60 || (intersection as f64 / min_len as f64) >= 0.70
    }

    /// Searches Open-Access repositories (Semantic Scholar Graph, Europe PMC, arXiv)
    /// using title text matching to recover author-accepted manuscripts and preprints
    /// when the publisher DOI is locked behind a paywall.
    pub async fn query_title_preprint_oa(
        client: &reqwest::Client,
        title: &str,
        paper_id: &str,
    ) -> Vec<PdfCandidate> {
        let mut candidates = Vec::new();
        let clean_title = title.trim();
        if clean_title.len() < 5 {
            return candidates;
        }

        // 1. Semantic Scholar Title Graph API Lookup
        if let Ok(s2_url) = url::Url::parse_with_params(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            &[
                ("query", clean_title),
                ("limit", "3"),
                ("fields", "title,openAccessPdf,externalIds,year"),
            ],
        ) {
            let req = client
                .get(s2_url.as_str())
                .timeout(Duration::from_secs(6))
                .header(
                    "User-Agent",
                    "InfinityResearcher/0.1.0 (Desktop; scholarly OA preprint mirror resolver)",
                );

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<Value>().await {
                        if let Some(items) = json.get("data").and_then(|d| d.as_array()) {
                            for item in items {
                                let item_title =
                                    item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                                if !Self::is_title_sufficiently_similar(clean_title, item_title) {
                                    continue;
                                }

                                // Check direct OpenAccessPdf url
                                if let Some(oa_pdf) = item.get("openAccessPdf") {
                                    if let Some(pdf_url) =
                                        oa_pdf.get("url").and_then(|u| u.as_str())
                                    {
                                        if let Ok(validated) = UrlGuard::validate_url(pdf_url) {
                                            candidates.push(PdfCandidate {
                                                id: Uuid::new_v4().to_string(),
                                                paper_id: paper_id.to_string(),
                                                url: validated.to_string(),
                                                provider_id: "semantic_scholar_mirror".to_string(),
                                                source_type: "open_access_preprint_mirror"
                                                    .to_string(),
                                                access_status:
                                                    PdfAvailabilityStatus::OpenAccessAvailable,
                                                evidence_notes: Some(
                                                    "Semantic Scholar verified Open Access mirror"
                                                        .to_string(),
                                                ),
                                                version_type: Some(
                                                    "accepted_manuscript".to_string(),
                                                ),
                                                identity_status: Some("unknown".to_string()),
                                                identity_score: Some(0.0),
                                                provenance_json: Some(format!(
                                                    "{{\"title_matched\":true,\"item\":\"{}\"}}",
                                                    item_title.replace('\"', "\\\"")
                                                )),
                                                last_checked_at: Utc::now().to_rfc3339(),
                                                created_at: Utc::now().to_rfc3339(),
                                            });
                                        }
                                    }
                                }

                                // Check arXiv externalId
                                if let Some(arxiv_id) = item
                                    .get("externalIds")
                                    .and_then(|e| e.get("ArXiv"))
                                    .and_then(|a| a.as_str())
                                {
                                    let arxiv_pdf =
                                        format!("https://arxiv.org/pdf/{}.pdf", arxiv_id);
                                    if let Ok(validated) = UrlGuard::validate_url(&arxiv_pdf) {
                                        candidates.push(PdfCandidate {
                                            id: Uuid::new_v4().to_string(),
                                            paper_id: paper_id.to_string(),
                                            url: validated.to_string(),
                                            provider_id: "arxiv_mirror".to_string(),
                                            source_type: "open_access_preprint_mirror".to_string(),
                                            access_status:
                                                PdfAvailabilityStatus::OpenAccessAvailable,
                                            evidence_notes: Some(format!(
                                                "Discovered author preprint on arXiv: {}",
                                                arxiv_id
                                            )),
                                            version_type: Some("preprint".to_string()),
                                            identity_status: Some("unknown".to_string()),
                                            identity_score: Some(0.0),
                                            provenance_json: Some(format!(
                                                "{{\"source\":\"arxiv\",\"id\":\"{}\"}}",
                                                arxiv_id
                                            )),
                                            last_checked_at: Utc::now().to_rfc3339(),
                                            created_at: Utc::now().to_rfc3339(),
                                        });
                                    }
                                }

                                // Check PubMedCentral externalId
                                if let Some(pmc_id) = item
                                    .get("externalIds")
                                    .and_then(|e| e.get("PubMedCentral"))
                                    .and_then(|p| p.as_str())
                                {
                                    let pmc_num = pmc_id.trim_start_matches("PMC");
                                    let pmc_pdf = format!(
                                        "https://europepmc.org/backend/ptpmcrender.fcgi?accid=PMC{}&blobtype=pdf",
                                        pmc_num
                                    );
                                    if let Ok(validated) = UrlGuard::validate_url(&pmc_pdf) {
                                        candidates.push(PdfCandidate {
                                            id: Uuid::new_v4().to_string(),
                                            paper_id: paper_id.to_string(),
                                            url: validated.to_string(),
                                            provider_id: "europe_pmc_mirror".to_string(),
                                            source_type: "open_access_preprint_mirror".to_string(),
                                            access_status:
                                                PdfAvailabilityStatus::OpenAccessAvailable,
                                            evidence_notes: Some(format!(
                                                "Discovered full text on PubMed Central: PMC{}",
                                                pmc_num
                                            )),
                                            version_type: Some("accepted_manuscript".to_string()),
                                            identity_status: Some("unknown".to_string()),
                                            identity_score: Some(0.0),
                                            provenance_json: Some(format!(
                                                "{{\"source\":\"europe_pmc\",\"pmcid\":\"PMC{}\"}}",
                                                pmc_num
                                            )),
                                            last_checked_at: Utc::now().to_rfc3339(),
                                            created_at: Utc::now().to_rfc3339(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Europe PMC Title Search
        let ep_query = format!("TITLE:\"{}\"", clean_title);
        if let Ok(ep_url) = url::Url::parse_with_params(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            &[
                ("query", ep_query.as_str()),
                ("format", "json"),
                ("resultType", "core"),
                ("pageSize", "2"),
            ],
        ) {
            let req = client
                .get(ep_url.as_str())
                .timeout(Duration::from_secs(6))
                .header(
                    "User-Agent",
                    "InfinityResearcher/0.1.0 (Desktop; Europe PMC title mirror resolver)",
                );

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<Value>().await {
                        if let Some(items) = json
                            .get("resultList")
                            .and_then(|r| r.get("result"))
                            .and_then(|res| res.as_array())
                        {
                            for item in items {
                                let item_title =
                                    item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                                if !Self::is_title_sufficiently_similar(clean_title, item_title) {
                                    continue;
                                }

                                if let Some(pmcid) = item.get("pmcid").and_then(|p| p.as_str()) {
                                    let pdf_url = format!(
                                        "https://europepmc.org/backend/ptpmcrender.fcgi?accid={}&blobtype=pdf",
                                        pmcid
                                    );
                                    if let Ok(validated) = UrlGuard::validate_url(&pdf_url) {
                                        candidates.push(PdfCandidate {
                                            id: Uuid::new_v4().to_string(),
                                            paper_id: paper_id.to_string(),
                                            url: validated.to_string(),
                                            provider_id: "europe_pmc_title".to_string(),
                                            source_type: "open_access_preprint_mirror".to_string(),
                                            access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                                            evidence_notes: Some(format!("Discovered open-access PMC repository full text: {}", pmcid)),
                                            version_type: Some("accepted_manuscript".to_string()),
                                            identity_status: Some("unknown".to_string()),
                                            identity_score: Some(0.0),
                                            provenance_json: Some(format!("{{\"source\":\"europe_pmc\",\"pmcid\":\"{}\"}}", pmcid)),
                                            last_checked_at: Utc::now().to_rfc3339(),
                                            created_at: Utc::now().to_rfc3339(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        candidates
    }

    /// Safely attempts to fetch a publisher landing page and inspect academic metadata tags and link elements
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
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ResearchPaperScraper/0.1.0",
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
        let candidate_urls: Vec<(String, &'static str)> = {
            let parsed_html = scraper::Html::parse_document(&body);
            let mut urls = Vec::new();

            // 1. Highwire Press citation_pdf_url
            if let Ok(sel) = scraper::Selector::parse(
                "meta[name='citation_pdf_url'], meta[property='citation_pdf_url']",
            ) {
                for el in parsed_html.select(&sel) {
                    if let Some(content) = el.value().attr("content") {
                        let trimmed = content.trim();
                        if !trimmed.is_empty() {
                            urls.push((trimmed.to_string(), "citation_pdf_url"));
                        }
                    }
                }
            }

            // 2. EPrints / Repository eprints.document_url
            if let Ok(sel) = scraper::Selector::parse("meta[name='eprints.document_url']") {
                for el in parsed_html.select(&sel) {
                    if let Some(content) = el.value().attr("content") {
                        let trimmed = content.trim();
                        if !trimmed.is_empty() {
                            urls.push((trimmed.to_string(), "eprints.document_url"));
                        }
                    }
                }
            }

            // 3. bioRxiv / medRxiv metadata
            if let Ok(sel) =
                scraper::Selector::parse("meta[name='biorxiv_pdf'], meta[name='biorxiv_url']")
            {
                for el in parsed_html.select(&sel) {
                    if let Some(content) = el.value().attr("content") {
                        let trimmed = content.trim();
                        if !trimmed.is_empty() {
                            urls.push((trimmed.to_string(), "biorxiv_meta"));
                        }
                    }
                }
            }

            // 4. HTML5 link rel="alternate" type="application/pdf"
            if let Ok(sel) = scraper::Selector::parse("link[type='application/pdf']") {
                for el in parsed_html.select(&sel) {
                    if let Some(href) = el.value().attr("href") {
                        let trimmed = href.trim();
                        if !trimmed.is_empty() {
                            urls.push((trimmed.to_string(), "link_alternate_pdf"));
                        }
                    }
                }
            }

            // 5. Direct article PDF download buttons / links
            if let Ok(sel) = scraper::Selector::parse(
                "a[data-article-pdf='true'], a.c-pdf-download__link, a.pdf-link, a.download-pdf",
            ) {
                for el in parsed_html.select(&sel).take(3) {
                    if let Some(href) = el.value().attr("href") {
                        let trimmed = href.trim();
                        if !trimmed.is_empty() {
                            urls.push((trimmed.to_string(), "download_button"));
                        }
                    }
                }
            }

            urls
        };

        // Verify each discovered candidate URL
        for (content, tag_name) in candidate_urls {
            if let Some(resolved) = UrlGuard::resolve_link(landing_url, &content) {
                if let Ok(validated) = UrlGuard::validate_url(&resolved) {
                    let report =
                        CandidateVerifier::verify_candidate(client, validated.as_str(), None, None)
                            .await;
                    if report.is_valid && report.has_pdf_signature {
                        return Some(PdfCandidate {
                            id: Uuid::new_v4().to_string(),
                            paper_id: paper_id.to_string(),
                            url: report.final_url,
                            provider_id: "landing_page".to_string(),
                            source_type: "landing_page_meta".to_string(),
                            access_status: PdfAvailabilityStatus::VerifiedOpenAccess,
                            evidence_notes: Some(format!(
                                "Discovered via <{}> tag; verified %PDF- signature",
                                tag_name
                            )),
                            version_type: Some("published_version".to_string()),
                            identity_status: Some("unknown".to_string()),
                            identity_score: Some(0.0),
                            provenance_json: Some(format!(
                                "{{\"source\":\"landing_page\",\"tag\":\"{}\"}}",
                                tag_name
                            )),
                            last_checked_at: Utc::now().to_rfc3339(),
                            created_at: Utc::now().to_rfc3339(),
                        });
                    }
                }
            }
        }

        None
    }

    /// Safely attempts to resolve direct IEEE Open Access PDF stream via multi-tiered resolver
    async fn extract_pdf_from_ieee_stamp(
        client: &reqwest::Client,
        stamp_url: &url::Url,
        paper_id: &str,
    ) -> Option<PdfCandidate> {
        let clean_url = stamp_url.as_str();
        if let Ok(direct_url) = crate::scrapers::ieee_fetcher::resolve_ieee_direct_pdf_url(
            clean_url, None, None, client,
        )
        .await
        {
            return Some(PdfCandidate {
                id: Uuid::new_v4().to_string(),
                paper_id: paper_id.to_string(),
                url: direct_url,
                provider_id: "ieee_xplore".to_string(),
                source_type: "ieee_open_access_stream".to_string(),
                access_status: PdfAvailabilityStatus::OpenAccessAvailable,
                evidence_notes: Some(
                    "Direct PDF link resolved via proprietary IEEE Open Access algorithm"
                        .to_string(),
                ),
                version_type: Some("published_version".to_string()),
                identity_status: Some("unknown".to_string()),
                identity_score: Some(0.0),
                provenance_json: Some("{\"provider\":\"ieee\"}".to_string()),
                last_checked_at: Utc::now().to_rfc3339(),
                created_at: Utc::now().to_rfc3339(),
            });
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_route_generation() {
        // arXiv via DOI
        let arxiv_candidates = PdfResolverService::generate_canonical_candidates(
            Some("10.48550/arXiv.1706.03762"),
            None,
            "paper-1",
        );
        assert_eq!(arxiv_candidates.len(), 1);
        assert_eq!(
            arxiv_candidates[0].url,
            "https://arxiv.org/pdf/1706.03762.pdf"
        );
        assert_eq!(arxiv_candidates[0].provider_id, "canonical_arxiv");

        // arXiv via landing URL
        let arxiv_landing = PdfResolverService::generate_canonical_candidates(
            None,
            Some("https://arxiv.org/abs/2301.00001"),
            "paper-2",
        );
        assert_eq!(arxiv_landing.len(), 1);
        assert_eq!(arxiv_landing[0].url, "https://arxiv.org/pdf/2301.00001.pdf");

        // bioRxiv via DOI
        let biorxiv_candidates = PdfResolverService::generate_canonical_candidates(
            Some("10.1101/2020.01.01.123456"),
            None,
            "paper-3",
        );
        assert_eq!(biorxiv_candidates.len(), 1);
        assert_eq!(
            biorxiv_candidates[0].url,
            "https://www.biorxiv.org/content/10.1101/2020.01.01.123456.full.pdf"
        );

        // PLOS via DOI
        let plos_candidates = PdfResolverService::generate_canonical_candidates(
            Some("10.1371/journal.pone.0123456"),
            None,
            "paper-4",
        );
        assert_eq!(plos_candidates.len(), 1);
        assert_eq!(
            plos_candidates[0].url,
            "https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0123456&type=printable"
        );

        // PMC via landing URL
        let pmc_candidates = PdfResolverService::generate_canonical_candidates(
            None,
            Some("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7654321/"),
            "paper-5",
        );
        assert_eq!(pmc_candidates.len(), 1);
        assert_eq!(
            pmc_candidates[0].url,
            "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7654321/pdf/"
        );

        // arXiv via HTML landing URL
        let arxiv_html = PdfResolverService::generate_canonical_candidates(
            None,
            Some("https://arxiv.org/html/2301.00001v2"),
            "paper-6",
        );
        assert_eq!(arxiv_html.len(), 1);
        assert_eq!(arxiv_html[0].url, "https://arxiv.org/pdf/2301.00001v2.pdf");

        // bioRxiv via landing URL
        let biorxiv_landing = PdfResolverService::generate_canonical_candidates(
            None,
            Some("https://www.biorxiv.org/content/10.1101/2024.01.01.573821v1"),
            "paper-7",
        );
        assert_eq!(biorxiv_landing.len(), 1);
        assert_eq!(
            biorxiv_landing[0].url,
            "https://www.biorxiv.org/content/10.1101/2024.01.01.573821v1.full.pdf"
        );

        // MDPI via DOI
        let mdpi_cand = PdfResolverService::generate_canonical_candidates(
            Some("10.3390/e25010001"),
            None,
            "paper-8",
        );
        assert_eq!(mdpi_cand.len(), 1);
        assert_eq!(
            mdpi_cand[0].url,
            "https://www.mdpi.com/10.3390/e25010001/pdf"
        );
        assert_eq!(mdpi_cand[0].provider_id, "canonical_mdpi");
    }
}
