use crate::errors::CommandError;
use crate::scrapers::ieee_fetcher::{is_ieee_target, resolve_and_fetch_ieee_pdf};
use crate::scrapers::query_search::{
    cancel_search_session, register_search_session, DiscoveredSearchResult, SearchStreamEvent,
    WebsiteSearchEngine, WebsiteSearchQuery, WebsiteSearchResponse, WebsiteSourceDescriptor,
};
use crate::scrapers::url_guard::UrlGuard;
use crate::services::pdf_resolver::PdfResolverService;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};
use tracing::{info, warn};

async fn try_recover_open_access_pdf(
    client: &reqwest::Client,
    failed_url: &str,
    doi: Option<&str>,
    title: Option<&str>,
    max_bytes: usize,
) -> Option<Vec<u8>> {
    if doi.is_none() && title.is_none() {
        return None;
    }
    info!(
        failed_url = %failed_url,
        doi = ?doi,
        title = ?title,
        "Initiating universal Open Access preprint & repository recovery"
    );

    let resolution = PdfResolverService::resolve_with_metadata(
        None,
        client,
        "transient_stream_recovery",
        title.unwrap_or(""),
        doi,
        Some(failed_url),
        Some(failed_url),
        None,
        false,
    )
    .await
    .ok()?;

    let mut trial_urls = Vec::new();
    if let Some(ref best) = resolution.best_url {
        trial_urls.push(best.clone());
    }
    for c in &resolution.candidates {
        if !trial_urls.contains(&c.url) {
            trial_urls.push(c.url.clone());
        }
    }

    for trial_url in trial_urls {
        if trial_url == failed_url {
            continue;
        }
        if let Ok(valid_fallback) = UrlGuard::validate_url(&trial_url) {
            if let Ok(mut fb_resp) = client
                .get(valid_fallback.as_str())
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                )
                .header(
                    "Accept",
                    "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
                )
                .send()
                .await
            {
                if fb_resp.status().is_success() {
                    let mut fb_bytes = Vec::new();
                    let mut ok = true;
                    while let Ok(Some(chunk)) = fb_resp.chunk().await {
                        if fb_bytes.len() + chunk.len() > max_bytes {
                            ok = false;
                            break;
                        }
                        fb_bytes.extend_from_slice(&chunk);
                    }
                    if ok && fb_bytes.len() >= 5 && fb_bytes.starts_with(b"%PDF-") {
                        info!(
                            recovered_url = %trial_url,
                            size_bytes = fb_bytes.len(),
                            "Recovered verified full-text PDF from Open Access mirror"
                        );
                        return Some(fb_bytes);
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn start_website_search_stream(
    app: AppHandle,
    session_id: String,
    query: WebsiteSearchQuery,
) -> Result<(), CommandError> {
    info!(
        session_id = %session_id,
        query = %query.query,
        sources = ?query.sources,
        "Starting streaming website search"
    );

    let cancel_signal = register_search_session(&session_id);
    let engine = WebsiteSearchEngine::new();
    let app_clone = app.clone();
    let sess_id = session_id.clone();
    let event_name = format!("search_stream_{}", session_id);

    let handle = tokio::spawn(async move {
        engine
            .execute_streaming_search(
                sess_id,
                query,
                cancel_signal,
                move |event: SearchStreamEvent| {
                    let _ = app_clone.emit(&event_name, &event);
                },
            )
            .await;
    });

    crate::scrapers::query_search::attach_session_abort_handle(&session_id, handle.abort_handle());

    Ok(())
}

#[tauri::command]
pub async fn cancel_website_search(session_id: String) -> Result<(), CommandError> {
    info!(session_id = %session_id, "Cancelling streaming website search");
    cancel_search_session(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn fetch_remote_pdf_preview(
    url: String,
    doi: Option<String>,
    title: Option<String>,
) -> Result<tauri::ipc::Response, CommandError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "INVALID_ARG",
            "URL cannot be empty",
            false,
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 4 {
                attempt.error("Too many redirects")
            } else if let Ok(u) = UrlGuard::validate_url(attempt.url().as_str()) {
                if u.scheme() != "https" {
                    attempt.error("Insecure redirect blocked")
                } else {
                    attempt.follow()
                }
            } else {
                attempt.error("Redirect to private or disallowed destination blocked by Anti-SSRF")
            }
        }))
        .build()
        .map_err(|e| CommandError::new("CLIENT_ERROR", e.to_string(), false))?;

    let max_bytes: usize = 50 * 1024 * 1024; // 50 MB

    // Proprietary Multi-Tiered IEEE Open Access Resolution & Binary Stream
    if is_ieee_target(clean_url, doi.as_deref()) {
        info!(
            url = %clean_url,
            doi = ?doi,
            title = ?title,
            "Detected IEEE scholarly paper target — executing multi-tiered IEEE Open Access resolution pipeline"
        );
        match resolve_and_fetch_ieee_pdf(
            clean_url,
            doi.as_deref(),
            title.as_deref(),
            &client,
            max_bytes,
        )
        .await
        {
            Ok(pdf_bytes) => {
                info!(
                    size_bytes = pdf_bytes.len(),
                    "IEEE Open Access resolution succeeded — streaming verified %PDF- binary payload"
                );
                return Ok(tauri::ipc::Response::new(pdf_bytes));
            }
            Err(e) => {
                warn!(
                    error = %e,
                    "IEEE Open Access resolution pipeline exhausted"
                );
                if let Some(oa_bytes) = try_recover_open_access_pdf(&client, clean_url, doi.as_deref(), title.as_deref(), max_bytes).await {
                    return Ok(tauri::ipc::Response::new(oa_bytes));
                }
                if clean_url.contains("ieeexplore.ieee.org") {
                    return Err(CommandError::new(
                        "IEEE_ACCESS_RESTRICTED",
                        format!("IEEE Xplore protects this document with publisher access controls. Direct automated PDF streaming is restricted without an institutional or member login ({e})."),
                        false,
                    ));
                }
            }
        }
    }

    let parsed = UrlGuard::validate_url(clean_url).map_err(|e| {
        CommandError::new(
            "SECURITY_ERROR",
            format!("URL blocked by Anti-SSRF guard: {e}"),
            false,
        )
    })?;

    if parsed.scheme() != "https" {
        return Err(CommandError::new(
            "INSECURE_SCHEME",
            "Only secure HTTPS URLs are permitted for PDF preview streaming",
            false,
        ));
    }

    let host = parsed.host_str().unwrap_or("").to_lowercase();
    let referer = if host.contains("ieee.org") {
        "https://ieeexplore.ieee.org/"
    } else {
        parsed.as_str()
    };

    let resp = client
        .get(parsed.as_str())
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header(
            "Accept",
            "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        )
        .header("Referer", referer)
        .send()
        .await
        .map_err(|e| {
            CommandError::new(
                "NETWORK_ERROR",
                format!("Failed to reach remote PDF host: {e}"),
                true,
            )
        })?;

    if !resp.status().is_success() {
        if let Some(oa_bytes) = try_recover_open_access_pdf(&client, clean_url, doi.as_deref(), title.as_deref(), max_bytes).await {
            return Ok(tauri::ipc::Response::new(oa_bytes));
        }
        return Err(CommandError::new(
            "HTTP_ERROR",
            format!("Remote PDF host responded with HTTP {}", resp.status()),
            resp.status().is_server_error(),
        ));
    }

    let max_bytes: usize = 50 * 1024 * 1024; // 50 MB
    if let Some(cl) = resp.content_length() {
        if cl > max_bytes as u64 {
            return Err(CommandError::new(
                "SIZE_EXCEEDED",
                format!(
                    "PDF size exceeds the 50MB in-panel streaming limit ({} bytes)",
                    cl
                ),
                false,
            ));
        }
    }

    let mut resp = resp;
    let mut bytes = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        CommandError::new(
            "STREAM_ERROR",
            format!("Error streaming PDF chunk: {e}"),
            true,
        )
    })? {
        if bytes.len() + chunk.len() > max_bytes {
            return Err(CommandError::new(
                "SIZE_EXCEEDED",
                "PDF stream exceeded the 50MB in-panel streaming limit",
                false,
            ));
        }
        bytes.extend_from_slice(&chunk);
    }

    // Check for PDF signature (%PDF-)
    if bytes.len() < 5 || !bytes.starts_with(b"%PDF-") {
        let sample = String::from_utf8_lossy(&bytes[..bytes.len().min(16384)]);

        // Check if there is an embedded iframe pointing to a PDF (e.g. IEEE Open Access stamp)
        static RE_PDF_FRAME: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        let re = RE_PDF_FRAME.get_or_init(|| {
            regex::Regex::new(r#"(?i)<i?frame[^>]+src=["'](https?://[^"']*(?:ielx|iel\d+|pdf)[^"']*\.pdf[^"']*)["']"#).unwrap()
        });
        if let Some(caps) = re.captures(&sample) {
            if let Some(iframe_match) = caps.get(1) {
                let iframe_url = iframe_match.as_str();
                if let Ok(valid_iframe_url) = UrlGuard::validate_url(iframe_url) {
                    if valid_iframe_url.scheme() == "https" {
                        let iframe_resp = client
                            .get(valid_iframe_url.as_str())
                            .header(
                                "User-Agent",
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                            )
                            .header(
                                "Accept",
                                "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
                            )
                            .header("Referer", parsed.as_str())
                            .send()
                            .await;

                        if let Ok(mut pdf_resp) = iframe_resp {
                            if pdf_resp.status().is_success() {
                                let mut pdf_bytes = Vec::new();
                                while let Ok(Some(chunk)) = pdf_resp.chunk().await {
                                    if pdf_bytes.len() + chunk.len() > max_bytes {
                                        break;
                                    }
                                    pdf_bytes.extend_from_slice(&chunk);
                                }
                                if pdf_bytes.len() >= 5 && pdf_bytes.starts_with(b"%PDF-") {
                                    return Ok(tauri::ipc::Response::new(pdf_bytes));
                                }
                            }
                        }
                    }
                }
            }
        }

        let sample_lower = sample.to_lowercase();
        if sample_lower.contains("<!doc")
            || sample_lower.contains("<html")
            || sample_lower.contains("<head")
            || sample_lower.contains("<title")
        {
            if let Some(oa_bytes) = try_recover_open_access_pdf(&client, clean_url, doi.as_deref(), title.as_deref(), max_bytes).await {
                return Ok(tauri::ipc::Response::new(oa_bytes));
            }
            return Err(CommandError::new(
                "NOT_A_PDF",
                "Remote server returned an HTML webpage instead of a direct PDF. This paper may require an institutional login or subscription on the source website.",
                false,
            ));
        }
        if let Some(oa_bytes) = try_recover_open_access_pdf(&client, clean_url, doi.as_deref(), title.as_deref(), max_bytes).await {
            return Ok(tauri::ipc::Response::new(oa_bytes));
        }
        return Err(CommandError::new(
            "INVALID_PDF",
            "Remote file did not contain a valid PDF signature (%PDF-).",
            false,
        ));
    }

    Ok(tauri::ipc::Response::new(bytes))
}


#[tauri::command]
pub async fn search_website_sources(
    query: WebsiteSearchQuery,
) -> Result<WebsiteSearchResponse, CommandError> {
    info!(
        "Executing query-first website search for: '{}', sources: {:?}",
        query.query, query.sources
    );
    let engine = WebsiteSearchEngine::new();
    let resp = engine.execute_search(query).await;
    Ok(resp)
}

#[tauri::command]
pub async fn list_website_search_sources() -> Result<Vec<WebsiteSourceDescriptor>, CommandError> {
    Ok(WebsiteSearchEngine::list_sources())
}

#[tauri::command]
pub async fn get_scraping_engine_diagnostics(
) -> Result<crate::scrapers::EngineDiagnostics, CommandError> {
    Ok(WebsiteSearchEngine::get_diagnostics())
}

#[tauri::command]
pub async fn import_discovered_search_result(
    state: State<'_, AppState>,
    result: DiscoveredSearchResult,
    target_collection_id: Option<String>,
) -> Result<crate::domain::paper::Paper, CommandError> {
    let db = state.db()?;
    let title = result.title.trim().to_string();
    if title.is_empty() {
        return Err(CommandError::new(
            "ERR_VALIDATION",
            "Paper title is missing",
            false,
        ));
    }

    let authors = if result.authors.is_empty() {
        vec!["Unknown Author".to_string()]
    } else {
        result.authors
    };

    // Graceful duplicate check: if paper exists by DOI or clean title, return existing paper
    {
        let conn = db
            .lock()
            .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
        let existing = if let Some(ref doi) = result.canonical_doi {
            crate::repositories::PaperRepository::get_by_doi(&conn, doi)
                .ok()
                .flatten()
        } else {
            None
        };
        let existing = match existing {
            Some(p) => Some(p),
            None => {
                let clean = crate::domain::paper::compute_clean_title_key(&title);
                crate::repositories::PaperRepository::get_by_clean_title(&conn, &clean)
                    .ok()
                    .flatten()
            }
        };

        if let Some(paper) = existing {
            if let Some(ref cid) = target_collection_id {
                let now = chrono::Utc::now().to_rfc3339();
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, added_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![cid, &paper.id, &now],
                );
            }
            return Ok(paper);
        }
    }

    let input = crate::domain::paper::PaperCreateInput {
        title,
        canonical_doi: result.canonical_doi,
        abstract_text: result.abstract_text,
        publication_date: result.publication_date,
        publication_year: result.publication_year,
        venue: result.venue,
        venue_type: None,
        language: result.language.or(Some("en".to_string())),
        is_open_access: Some(result.is_open_access),
        primary_landing_url: Some(result.landing_url),
        pdf_url: result.pdf_url,
        is_saved: Some(true),
        reading_status: None,
        reading_progress: None,
        last_opened_at: None,
        open_access_status: if result.is_open_access {
            Some("verified_open_access".to_string())
        } else {
            Some("access_unverified".to_string())
        },
        access_evidence_type: Some("permitted_source_search".to_string()),
        access_evidence_note: Some(format!(
            "Discovered via {} website search",
            result.source_name
        )),
        license_name: result.license_name,
        license_url: None,
        source_name: Some(result.source_name),
        retrieval_method: Some("public_web_connector".to_string()),
        access_confirmed_at: Some(chrono::Utc::now().to_rfc3339()),
        authors,
        collection_ids: target_collection_id.map(|id| vec![id]),
        tags: None,
        source_id: Some(result.source_id),
    };

    crate::services::PaperService::create_paper(db, input).map_err(|e| {
        CommandError::new(
            "ERR_IMPORT",
            format!("Failed to import paper into library: {e}"),
            false,
        )
    })
}

#[tauri::command]
pub async fn start_python_search_stream(
    app: AppHandle,
    session_id: String,
    query: WebsiteSearchQuery,
) -> Result<(), CommandError> {
    crate::services::PythonEngineService::start_streaming_search(app, session_id, query).await
}

#[tauri::command]
pub async fn cancel_python_search(session_id: String) -> Result<(), CommandError> {
    crate::services::PythonEngineService::cancel_search(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn list_python_search_sources() -> Result<Vec<WebsiteSourceDescriptor>, CommandError> {
    Ok(crate::services::PythonEngineService::list_sources())
}

#[tauri::command]
pub async fn get_python_engine_status() -> Result<crate::services::PythonEngineStatus, CommandError>
{
    Ok(crate::services::PythonEngineService::get_status().await)
}
