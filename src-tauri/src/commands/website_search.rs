use crate::errors::CommandError;
use crate::scrapers::query_search::{
    cancel_search_session, register_search_session, DiscoveredSearchResult, SearchStreamEvent,
    WebsiteSearchEngine, WebsiteSearchQuery, WebsiteSearchResponse, WebsiteSourceDescriptor,
};
use crate::scrapers::url_guard::UrlGuard;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};
use tracing::info;

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
pub async fn fetch_remote_pdf_preview(url: String) -> Result<tauri::ipc::Response, CommandError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(CommandError::new(
            "INVALID_ARG",
            "URL cannot be empty",
            false,
        ));
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

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
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

    let resp = client
        .get(parsed.as_str())
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .header(
            "Accept",
            "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        )
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
        if bytes.starts_with(b"<!DOC") || bytes.starts_with(b"<html") || bytes.starts_with(b"<HTML")
        {
            return Err(CommandError::new(
                "NOT_A_PDF",
                "Remote server returned an HTML webpage instead of a direct PDF. This paper may require an institutional login or subscription on the source website.",
                false,
            ));
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
