use crate::academic_sources::ImportSummary;
use crate::domain::crawl::{
    CrawlJob, CrawlJobPaper, CrawlProfile, CrawlProfileCreateInput, CrawlProfileUpdateInput,
    ExtractionPreviewResult,
};
use crate::errors::CommandError;
use crate::repositories::CrawlRepository;
use crate::scrapers::url_guard::UrlGuard;
use crate::state::AppState;
use tauri::State;
use tracing::info;

// ----------------------------------------------------------------------------
// Profile Commands
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_crawl_profiles(
    state: State<'_, AppState>,
) -> Result<Vec<CrawlProfile>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::list_profiles(&conn).map_err(|e| {
        CommandError::new(
            "ERR_DB",
            format!("Failed to list crawl profiles: {e}"),
            true,
        )
    })
}

#[tauri::command]
pub async fn get_crawl_profile(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<CrawlProfile>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::get_profile_by_id(&conn, &id)
        .map_err(|e| CommandError::new("ERR_DB", format!("Failed to get crawl profile: {e}"), true))
}

#[tauri::command]
pub async fn create_crawl_profile(
    state: State<'_, AppState>,
    input: CrawlProfileCreateInput,
) -> Result<CrawlProfile, CommandError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Profile name cannot be empty",
            false,
        ));
    }

    let domain = input.domain.trim();
    if domain.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Target domain cannot be empty",
            false,
        ));
    }

    info!(name = %name, domain = %domain, "Creating custom crawl profile");
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::create_profile(&conn, &input).map_err(|e| {
        CommandError::new(
            "ERR_DB",
            format!("Failed to create crawl profile: {e}"),
            false,
        )
    })
}

#[tauri::command]
pub async fn update_crawl_profile(
    state: State<'_, AppState>,
    id: String,
    input: CrawlProfileUpdateInput,
) -> Result<Option<CrawlProfile>, CommandError> {
    info!(profile_id = %id, "Updating crawl profile");
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::update_profile(&conn, &id, &input).map_err(|e| {
        CommandError::new(
            "ERR_DB",
            format!("Failed to update crawl profile: {e}"),
            false,
        )
    })
}

#[tauri::command]
pub async fn delete_crawl_profile(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    info!(profile_id = %id, "Deleting custom crawl profile");
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::delete_profile(&conn, &id).map_err(|e| {
        CommandError::new(
            "ERR_DB",
            format!("Failed to delete crawl profile: {e}"),
            false,
        )
    })
}

// ----------------------------------------------------------------------------
// Preview & Extraction Sandbox Command
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn preview_url_extraction(
    state: State<'_, AppState>,
    url: String,
    profile_id: Option<String>,
) -> Result<ExtractionPreviewResult, CommandError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Target URL cannot be empty",
            false,
        ));
    }

    let parsed_url = UrlGuard::validate_url(clean_url)
        .map_err(|e| CommandError::new("ERR_SECURITY", format!("Disallowed URL: {e}"), false))?;

    let host_lower = parsed_url.host_str().unwrap_or("").to_lowercase();
    if host_lower == "ieeexplore.ieee.org"
        || host_lower == "ieee.org"
        || host_lower.ends_with(".ieee.org")
    {
        return Err(CommandError::new(
            "IEEE_POLICY_RESTRICTION",
            "IEEE Xplore terms prohibit automated agent access. Automated extraction is blocked. Please use the IEEE Open Access manual import workflow.",
            false,
        ));
    }

    let db = state.db()?;

    let profile = {
        let conn = db.lock().map_err(CommandError::from)?;
        if let Some(ref pid) = profile_id {
            CrawlRepository::get_profile_by_id(&conn, pid).map_err(|e| {
                CommandError::new("ERR_DB", format!("Error loading profile: {e}"), false)
            })?
        } else {
            CrawlRepository::get_profile_for_url(&conn, clean_url).map_err(|e| {
                CommandError::new("ERR_DB", format!("Error matching profile: {e}"), false)
            })?
        }
    };

    info!(url = %clean_url, profile = ?profile.as_ref().map(|p| &p.name), "Running URL extraction preview");
    state
        .crawl_engine
        .preview_url(clean_url, profile.as_ref())
        .await
        .map_err(|e| CommandError::new("ERR_EXTRACTION", e, false))
}

// ----------------------------------------------------------------------------
// Crawl Job Management Commands
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn start_crawl_job(
    state: State<'_, AppState>,
    start_url: String,
    profile_id: Option<String>,
) -> Result<CrawlJob, CommandError> {
    let clean_url = start_url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Start URL cannot be empty",
            false,
        ));
    }

    // Anti-SSRF check upfront
    let parsed_url = UrlGuard::validate_url(clean_url).map_err(|e| {
        CommandError::new("ERR_SECURITY", format!("Disallowed start URL: {e}"), false)
    })?;

    let host_lower = parsed_url.host_str().unwrap_or("").to_lowercase();
    if host_lower == "ieeexplore.ieee.org"
        || host_lower == "ieee.org"
        || host_lower.ends_with(".ieee.org")
    {
        return Err(CommandError::new(
            "IEEE_POLICY_RESTRICTION",
            "IEEE Xplore terms prohibit automated web crawling. Please use the dedicated IEEE Open Access manual discovery and import workflow.",
            false,
        ));
    }

    let db = state.db()?.clone();

    let profile = {
        let conn = db.lock().map_err(CommandError::from)?;
        if let Some(ref pid) = profile_id {
            CrawlRepository::get_profile_by_id(&conn, pid)
                .map_err(|e| {
                    CommandError::new("ERR_DB", format!("Error loading profile: {e}"), false)
                })?
                .ok_or_else(|| {
                    CommandError::new("ERR_NOT_FOUND", "Specified profile not found", false)
                })?
        } else {
            CrawlRepository::get_profile_for_url(&conn, clean_url)
                .map_err(|e| {
                    CommandError::new("ERR_DB", format!("Error finding profile: {e}"), false)
                })?
                .ok_or_else(|| {
                    CommandError::new(
                        "ERR_NOT_FOUND",
                        "No matching crawl profile found for target domain",
                        false,
                    )
                })?
        }
    };

    // Ensure start URL matches domain of profile
    UrlGuard::matches_domain(&parsed_url, &profile.domain).map_err(|e| {
        CommandError::new(
            "ERR_VALIDATION",
            format!("Start URL domain does not match profile: {e}"),
            false,
        )
    })?;

    info!(start_url = %clean_url, profile = %profile.name, "Creating and starting crawl job");
    let job = {
        let conn = db.lock().map_err(CommandError::from)?;
        CrawlRepository::create_job(&conn, &profile.id, clean_url).map_err(|e| {
            CommandError::new("ERR_DB", format!("Failed to create crawl job: {e}"), true)
        })?
    };

    // Launch background worker
    state
        .crawl_engine
        .start_crawl_job(db, job.id.clone(), profile)
        .await
        .map_err(|e| CommandError::new("ERR_CRAWL", e, true))?;

    Ok(job)
}

#[tauri::command]
pub async fn pause_crawl_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), CommandError> {
    info!(job_id = %job_id, "Pausing crawl job");
    let db = state.db()?;
    state
        .crawl_engine
        .pause_crawl_job(db, &job_id)
        .await
        .map_err(|e| CommandError::new("ERR_CRAWL", e, false))
}

#[tauri::command]
pub async fn resume_crawl_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), CommandError> {
    info!(job_id = %job_id, "Resuming crawl job");
    let db = state.db()?.clone();
    let job = {
        let conn = db.lock().map_err(CommandError::from)?;
        CrawlRepository::get_job(&conn, &job_id)
            .map_err(|e| CommandError::new("ERR_DB", format!("Error querying job: {e}"), false))?
            .ok_or_else(|| CommandError::new("ERR_NOT_FOUND", "Job not found", false))?
    };

    let profile = {
        let conn = db.lock().map_err(CommandError::from)?;
        CrawlRepository::get_profile_by_id(&conn, &job.profile_id)
            .map_err(|e| {
                CommandError::new("ERR_DB", format!("Error querying profile: {e}"), false)
            })?
            .ok_or_else(|| CommandError::new("ERR_NOT_FOUND", "Profile not found", false))?
    };

    state
        .crawl_engine
        .resume_crawl_job(db, &job_id, profile)
        .await
        .map_err(|e| CommandError::new("ERR_CRAWL", e, false))
}

#[tauri::command]
pub async fn cancel_crawl_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), CommandError> {
    info!(job_id = %job_id, "Cancelling crawl job");
    let db = state.db()?;
    state
        .crawl_engine
        .cancel_crawl_job(db, &job_id)
        .await
        .map_err(|e| CommandError::new("ERR_CRAWL", e, false))
}

#[tauri::command]
pub async fn get_crawl_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<Option<CrawlJob>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::get_job(&conn, &job_id)
        .map_err(|e| CommandError::new("ERR_DB", format!("Failed to get crawl job: {e}"), true))
}

#[tauri::command]
pub async fn list_crawl_jobs(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<CrawlJob>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::list_jobs(&conn, limit)
        .map_err(|e| CommandError::new("ERR_DB", format!("Failed to list crawl jobs: {e}"), true))
}

#[tauri::command]
pub async fn list_crawled_papers(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<Vec<CrawlJobPaper>, CommandError> {
    let db = state.db()?;
    let conn = db.lock().map_err(CommandError::from)?;
    CrawlRepository::list_crawled_papers_for_job(&conn, &job_id).map_err(|e| {
        CommandError::new(
            "ERR_DB",
            format!("Failed to list crawled papers: {e}"),
            true,
        )
    })
}

#[tauri::command]
pub async fn import_crawled_papers(
    state: State<'_, AppState>,
    job_id: String,
    paper_ids: Option<Vec<String>>,
    target_collection_id: Option<String>,
) -> Result<ImportSummary, CommandError> {
    info!(job_id = %job_id, count = ?paper_ids.as_ref().map(|v| v.len()), "Importing crawled papers to library");
    let db = state.db()?;
    state
        .crawl_engine
        .import_crawled_papers(db, &job_id, paper_ids, target_collection_id)
        .map_err(|e| CommandError::new("ERR_IMPORT", e, false))
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebsitePolicyCheck {
    pub url: String,
    pub origin: String,
    pub domain: String,
    pub is_allowed: bool,
    pub crawl_delay_ms: u64,
    pub policy_state: String, // "allowed", "restricted", "disallowed", "unknown"
    pub robots_found: bool,
    pub message: String,
    pub detected_platform: String,
}

#[tauri::command]
pub async fn check_website_policy(
    _state: State<'_, AppState>,
    url: String,
) -> Result<WebsitePolicyCheck, CommandError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Target URL cannot be empty",
            false,
        ));
    }

    // Anti-SSRF check upfront
    let parsed_url = UrlGuard::validate_url(clean_url)
        .map_err(|e| CommandError::new("ERR_SECURITY", format!("Disallowed URL: {e}"), false))?;

    let domain = parsed_url.host_str().unwrap_or("").to_string();
    let domain_lower = domain.to_lowercase();
    if domain_lower == "ieeexplore.ieee.org"
        || domain_lower == "ieee.org"
        || domain_lower.ends_with(".ieee.org")
    {
        return Ok(WebsitePolicyCheck {
            url: clean_url.to_string(),
            origin: format!("{}://{}", parsed_url.scheme(), domain),
            domain,
            is_allowed: false,
            crawl_delay_ms: 0,
            policy_state: "prohibited_by_terms".to_string(),
            robots_found: true,
            message: "IEEE Xplore terms prohibit robots and intelligent agents from automated indexing, crawling, or systematic downloading. Automated crawling is blocked. Please use the dedicated IEEE Open Access manual discovery and import workflow.".to_string(),
            detected_platform: "ieee_xplore_manual_only".to_string(),
        });
    }

    let origin = format!(
        "{}://{}",
        parsed_url.scheme(),
        parsed_url.host_str().unwrap_or("")
    );

    let robots_url = format!("{}/robots.txt", origin);
    let user_agent = "ResearchPaperScraper/1.0 (+https://github.com/sanja/paper-scraper)";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .unwrap_or_default();

    let (robots_found, is_allowed, crawl_delay_ms, policy_state, message) = match client
        .get(&robots_url)
        .header("User-Agent", user_agent)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await.unwrap_or_default();
            let parsed_robots = crate::scrapers::robots::RobotsTxt::parse(&body);
            let path = parsed_url.path();
            let allowed = parsed_robots.is_allowed(path, user_agent);
            let delay = parsed_robots
                .crawl_delay(user_agent)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(1000);

            if allowed {
                (
                    true,
                    true,
                    delay,
                    "allowed".to_string(),
                    format!(
                        "Robots.txt permits automated public retrieval with {}ms delay.",
                        delay
                    ),
                )
            } else {
                (
                    true,
                    false,
                    delay,
                    "disallowed".to_string(),
                    "Robots.txt restricts automated requests to this path. Manual page import recommended.".to_string(),
                )
            }
        }
        Ok(resp) if resp.status().as_u16() == 404 => (
            false,
            true,
            1000,
            "allowed".to_string(),
            "No robots.txt found (404). Default polite crawl rate (1000ms delay) applies."
                .to_string(),
        ),
        _ => (
            false,
            true,
            1500,
            "unknown".to_string(),
            "Could not fetch robots.txt. Proceeding with conservative default delay (1500ms)."
                .to_string(),
        ),
    };

    let detected_platform = if domain.contains("biorxiv.org") || domain.contains("medrxiv.org") {
        "bioRxiv / medRxiv Preprints (Highwire Press)".to_string()
    } else if domain.contains("nature.com") {
        "Nature Publishing Group (Open-Access / Metadata)".to_string()
    } else if domain.contains("journals.plos.org") {
        "PLOS Open Access Journals".to_string()
    } else if domain.contains("dl.acm.org") {
        "ACM Digital Library".to_string()
    } else if domain.contains("arxiv.org") {
        "arXiv Preprints".to_string()
    } else if domain.contains(".edu") || domain.contains(".ac.") {
        "Academic / Institutional Repository".to_string()
    } else {
        "Generic Scholarly Website (HTML & Meta Tags)".to_string()
    };

    Ok(WebsitePolicyCheck {
        url: clean_url.to_string(),
        origin,
        domain,
        is_allowed,
        crawl_delay_ms,
        policy_state,
        robots_found,
        message,
        detected_platform,
    })
}

#[tauri::command]
pub async fn import_single_page(
    state: State<'_, AppState>,
    url: String,
    profile_id: Option<String>,
    target_collection_id: Option<String>,
) -> Result<crate::domain::paper::Paper, CommandError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "URL cannot be empty",
            false,
        ));
    }

    let preview = preview_url_extraction(state.clone(), clean_url.to_string(), profile_id).await?;

    let title = preview.title.unwrap_or_else(|| {
        clean_url
            .split('/')
            .rfind(|s| !s.is_empty())
            .unwrap_or("Imported Web Document")
            .to_string()
    });

    let authors = if preview.authors.is_empty() {
        vec!["Unknown Author".to_string()]
    } else {
        preview.authors
    };

    let year = preview
        .publication_date
        .as_deref()
        .and_then(|d| d.split('-').next())
        .and_then(|y| y.parse::<i32>().ok());

    let db = state.db()?;
    let input = crate::domain::paper::PaperCreateInput {
        title,
        canonical_doi: preview.canonical_doi,
        abstract_text: preview.abstract_text,
        publication_date: preview.publication_date,
        publication_year: year,
        venue: preview.venue,
        venue_type: None,
        language: Some("en".to_string()),
        is_open_access: Some(preview.pdf_url.is_some()),
        primary_landing_url: Some(clean_url.to_string()),
        pdf_url: preview.pdf_url,
        is_saved: Some(true),
        reading_status: None,
        reading_progress: None,
        open_access_status: Some("verified_open_access".to_string()),
        access_evidence_type: Some("explicit_source_label".to_string()),
        access_evidence_note: Some("Imported from single-page web crawl".to_string()),
        license_name: None,
        license_url: None,
        source_name: Some("Web Crawl".to_string()),
        retrieval_method: Some("permitted_html_connector".to_string()),
        access_confirmed_at: Some(chrono::Utc::now().to_rfc3339()),
        authors,
        collection_ids: target_collection_id.map(|id| vec![id]),
        tags: None,
        source_id: None,
    };

    crate::services::PaperService::create_paper(db, input)
        .map_err(|e| CommandError::new("ERR_IMPORT", format!("Failed to import paper: {e}"), false))
}
