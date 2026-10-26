use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::errors::CommandError;
use crate::scrapers::query_search::{
    DiscoveredSearchResult, SearchStreamEvent, WebsiteSearchQuery, WebsiteSourceDescriptor,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonEngineStatus {
    pub available: bool,
    pub python_path: Option<String>,
    pub engine_dir: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

pub struct PythonEngineService;

static ACTIVE_JOBS: std::sync::OnceLock<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>> =
    std::sync::OnceLock::new();

fn get_active_jobs() -> &'static Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>> {
    ACTIVE_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

impl PythonEngineService {
    /// Detects Python executable path
    pub fn resolve_python_command() -> Result<String, CommandError> {
        // Try common commands: python, python3
        for cmd in &["python", "python3"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--version").output() {
                if output.status.success() {
                    return Ok(cmd.to_string());
                }
            }
        }
        Err(CommandError::new(
            "PYTHON_NOT_FOUND",
            "Python 3.10+ was not found in PATH. Please ensure Python is installed.",
            false,
        ))
    }

    /// Resolves the python-engine directory
    pub fn resolve_engine_dir() -> Result<PathBuf, CommandError> {
        let candidates = [
            PathBuf::from("python-engine/src"),
            PathBuf::from("../python-engine/src"),
            PathBuf::from("../../python-engine/src"),
        ];

        for cand in &candidates {
            if cand.join("paper_scraper/__init__.py").exists() {
                if let Ok(canon) = cand.canonicalize() {
                    return Ok(canon);
                }
                return Ok(cand.clone());
            }
        }

        // Try relative to current executable
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let cand = parent.join("python-engine/src");
                if cand.join("paper_scraper/__init__.py").exists() {
                    return Ok(cand);
                }
            }
        }

        Err(CommandError::new(
            "ENGINE_DIR_NOT_FOUND",
            "Could not locate the python-engine/src directory.",
            false,
        ))
    }

    /// Check overall Python engine availability and status
    pub async fn get_status() -> PythonEngineStatus {
        let py_cmd = match Self::resolve_python_command() {
            Ok(cmd) => cmd,
            Err(e) => {
                return PythonEngineStatus {
                    available: false,
                    python_path: None,
                    engine_dir: None,
                    version: None,
                    error: Some(e.message),
                }
            }
        };

        let eng_dir = match Self::resolve_engine_dir() {
            Ok(dir) => dir,
            Err(e) => {
                return PythonEngineStatus {
                    available: false,
                    python_path: Some(py_cmd),
                    engine_dir: None,
                    version: None,
                    error: Some(e.message),
                }
            }
        };

        PythonEngineStatus {
            available: true,
            python_path: Some(py_cmd),
            engine_dir: Some(eng_dir.to_string_lossy().to_string()),
            version: Some("1.0.0".to_string()),
            error: None,
        }
    }

    /// Starts a streaming search session using the Python engine
    pub async fn start_streaming_search(
        app: AppHandle,
        session_id: String,
        query: WebsiteSearchQuery,
    ) -> Result<(), CommandError> {
        let py_cmd = Self::resolve_python_command()?;
        let eng_dir = Self::resolve_engine_dir()?;

        info!(
            session_id = %session_id,
            query = %query.query,
            engine_dir = %eng_dir.display(),
            "Launching Python scraping engine search"
        );

        let mut child = Command::new(&py_cmd)
            .arg("-m")
            .arg("paper_scraper")
            .current_dir(&eng_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                CommandError::new(
                    "PROCESS_SPAWN_ERROR",
                    format!("Failed to spawn Python process: {e}"),
                    false,
                )
            })?;

        let mut stdin = child.stdin.take().ok_or_else(|| {
            CommandError::new("IPC_ERROR", "Failed to open Python stdin pipe", false)
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            CommandError::new("IPC_ERROR", "Failed to open Python stdout pipe", false)
        })?;

        let stderr = child.stderr.take();
        if let Some(err_pipe) = stderr {
            tokio::spawn(async move {
                let reader = BufReader::new(err_pipe);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    info!(target: "python_engine", "{line}");
                }
            });
        }

        // Send start_search command to Python process over stdin
        let start_msg = json!({
            "type": "start_search",
            "request_id": format!("req_{session_id}"),
            "job_id": session_id,
            "query": query.query,
            "sources": query.sources,
            "filters": {
                "year_start": query.year_start,
                "year_end": query.year_end,
                "content_type": query.content_type,
                "open_access_only": query.open_access_only,
                "author": query.author,
                "limit_per_source": query.limit_per_source.unwrap_or(50),
            }
        });

        let mut msg_bytes = serde_json::to_vec(&start_msg).map_err(|e| {
            CommandError::new(
                "SERIALIZE_ERROR",
                format!("Failed to serialize query: {e}"),
                false,
            )
        })?;
        msg_bytes.push(b'\n');

        stdin.write_all(&msg_bytes).await.map_err(|e| {
            CommandError::new(
                "WRITE_ERROR",
                format!("Failed to write to Python stdin: {e}"),
                false,
            )
        })?;
        stdin.flush().await.map_err(|e| {
            CommandError::new(
                "FLUSH_ERROR",
                format!("Failed to flush Python stdin: {e}"),
                false,
            )
        })?;

        // Setup cancellation channel
        let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
        {
            let mut jobs = get_active_jobs().lock().await;
            jobs.insert(session_id.clone(), cancel_tx);
        }

        let sess_id = session_id.clone();
        let app_clone = app.clone();
        let event_channel = format!("search_stream_{session_id}");

        // Spawn stdout reader loop
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut is_terminal_emitted = false;
            let mut total_discovered_count = 0usize;
            let mut was_cancelled = false;
            let mut active_sources: HashMap<String, String> = HashMap::new();
            let start_instant = std::time::Instant::now();

            loop {
                tokio::select! {
                    _ = &mut cancel_rx => {
                        info!(session_id = %sess_id, "Python search cancellation requested");
                        was_cancelled = true;
                        let cancel_msg = json!({
                            "type": "cancel_search",
                            "request_id": format!("cancel_{sess_id}"),
                            "job_id": sess_id,
                        });
                        if let Ok(mut bytes) = serde_json::to_vec(&cancel_msg) {
                            bytes.push(b'\n');
                            let _ = stdin.write_all(&bytes).await;
                            let _ = stdin.flush().await;
                        }

                        // Give child a short grace window to finish or terminate
                        tokio::select! {
                            _ = tokio::time::sleep(std::time::Duration::from_millis(500)) => {
                                let _ = child.kill().await;
                            }
                            _ = child.wait() => {}
                        }
                        break;
                    }
                    line_res = lines.next_line() => {
                        match line_res {
                            Ok(Some(line)) => {
                                let trimmed = line.trim();
                                if trimmed.is_empty() {
                                    continue;
                                }

                                if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
                                    // Forward extended event
                                    let _ = app_clone.emit(&format!("python_engine_{sess_id}"), &val);

                                    // Translate to SearchStreamEvent for frontend DiscoverView
                                    let raw_type = val.get("type").and_then(|v| v.as_str());
                                    let evt_type = if raw_type == Some("event") {
                                        val.get("event").and_then(|v| v.as_str())
                                    } else {
                                        raw_type
                                    };

                                    if let Some(evt) = evt_type {
                                        let source_id = val.get("source_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        let payload = val.get("payload");

                                        match evt {
                                            "job.started" => {
                                                let q = payload.and_then(|p| p.get("query")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                                                let src_list: Vec<String> = payload
                                                    .and_then(|p| p.get("sources"))
                                                    .and_then(|v| v.as_array())
                                                    .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect())
                                                    .unwrap_or_default();

                                                for src in &src_list {
                                                    active_sources.insert(src.clone(), "queued".to_string());
                                                }

                                                let stream_evt = SearchStreamEvent::SearchStarted {
                                                    session_id: sess_id.clone(),
                                                    query: q,
                                                    sources: src_list,
                                                    schema_version: "2.0".to_string(),
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                            }
                                            "source.started" => {
                                                let s_name = payload.and_then(|p| p.get("source_name")).and_then(|v| v.as_str()).unwrap_or(&source_id).to_string();
                                                active_sources.insert(source_id.clone(), "searching".to_string());
                                                let stream_evt = SearchStreamEvent::SourceStatus {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    source_name: s_name,
                                                    status: "searching".to_string(),
                                                    message: None,
                                                    results_count: 0,
                                                    elapsed_ms: 0,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                            }
                                            "paper.discovered" => {
                                                total_discovered_count += 1;
                                                if let Some(paper_val) = payload.and_then(|p| p.get("paper")) {
                                                    if let Ok(paper) = serde_json::from_value::<DiscoveredSearchResult>(paper_val.clone()) {
                                                        let stream_evt = SearchStreamEvent::PaperFound {
                                                            session_id: sess_id.clone(),
                                                            source_id: source_id.clone(),
                                                            paper,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                }
                                            }
                                            "source.completed" => {
                                                let count = payload.and_then(|p| p.get("count")).and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                                                let elapsed = payload.and_then(|p| p.get("elapsed_ms")).and_then(|v| v.as_u64()).unwrap_or(0);
                                                let status_str = if count > 0 { "completed".to_string() } else { "no_results".to_string() };
                                                active_sources.insert(source_id.clone(), status_str.clone());

                                                let stream_evt = SearchStreamEvent::SourceCompleted {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    count,
                                                    elapsed_ms: elapsed,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);

                                                let status_evt = SearchStreamEvent::SourceStatus {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    source_name: source_id.clone(),
                                                    status: status_str,
                                                    message: None,
                                                    results_count: count,
                                                    elapsed_ms: elapsed,
                                                };
                                                let _ = app_clone.emit(&event_channel, &status_evt);
                                            }
                                            "source.blocked" => {
                                                let msg = payload.and_then(|p| p.get("message")).and_then(|v| v.as_str()).map(|s| s.to_string());
                                                let elapsed = payload.and_then(|p| p.get("elapsed_ms")).and_then(|v| v.as_u64()).unwrap_or(0);
                                                active_sources.insert(source_id.clone(), "blocked".to_string());

                                                let stream_evt = SearchStreamEvent::SourceStatus {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    source_name: source_id.clone(),
                                                    status: "blocked".to_string(),
                                                    message: msg,
                                                    results_count: 0,
                                                    elapsed_ms: elapsed,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                            }
                                            "source.failed" | "source.unsupported" | "source.timed_out" => {
                                                let status_str = match evt {
                                                    "source.timed_out" => "timeout",
                                                    "source.unsupported" => "unsupported",
                                                    _ => "failed",
                                                };
                                                let msg = payload.and_then(|p| p.get("message")).and_then(|v| v.as_str()).unwrap_or("Source search failed").to_string();
                                                let elapsed = payload.and_then(|p| p.get("elapsed_ms")).and_then(|v| v.as_u64()).unwrap_or(0);
                                                active_sources.insert(source_id.clone(), status_str.to_string());

                                                let stream_evt = SearchStreamEvent::SourceStatus {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    source_name: source_id.clone(),
                                                    status: status_str.to_string(),
                                                    message: Some(msg.clone()),
                                                    results_count: 0,
                                                    elapsed_ms: elapsed,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);

                                                let err_cat = match evt {
                                                    "source.timed_out" => crate::scrapers::types::SourceErrorCategory::Timeout,
                                                    "source.unsupported" => crate::scrapers::types::SourceErrorCategory::Unsupported,
                                                    _ => crate::scrapers::types::SourceErrorCategory::Network,
                                                };

                                                let fail_evt = SearchStreamEvent::SourceFailed {
                                                    session_id: sess_id.clone(),
                                                    source_id: source_id.clone(),
                                                    message: msg,
                                                    error_category: err_cat,
                                                    elapsed_ms: elapsed,
                                                };
                                                let _ = app_clone.emit(&event_channel, &fail_evt);
                                            }
                                            "job.completed" => {
                                                let total = payload.and_then(|p| p.get("total_unique").or_else(|| p.get("total_found"))).and_then(|v| v.as_u64()).unwrap_or(total_discovered_count as u64) as usize;
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);

                                                let stream_evt = if total == 0 {
                                                    SearchStreamEvent::SearchNoResults {
                                                        session_id: sess_id.clone(),
                                                        duration_ms: duration,
                                                    }
                                                } else {
                                                    SearchStreamEvent::SearchCompleted {
                                                        session_id: sess_id.clone(),
                                                        total_unique: total,
                                                        duration_ms: duration,
                                                    }
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            "job.no_results" => {
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);
                                                let stream_evt = SearchStreamEvent::SearchNoResults {
                                                    session_id: sess_id.clone(),
                                                    duration_ms: duration,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            "job.completed_with_warnings" => {
                                                let total = payload.and_then(|p| p.get("total_unique")).and_then(|v| v.as_u64()).unwrap_or(total_discovered_count as u64) as usize;
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);
                                                let failed_sources = payload.and_then(|p| p.get("failed_sources")).and_then(|v| v.as_array()).map(|arr| arr.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();

                                                let stream_evt = SearchStreamEvent::SearchCompletedWithErrors {
                                                    session_id: sess_id.clone(),
                                                    total_unique: total,
                                                    failed_sources,
                                                    duration_ms: duration,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            "job.cancelled" => {
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);
                                                let total = payload.and_then(|p| p.get("total_found")).and_then(|v| v.as_u64()).unwrap_or(total_discovered_count as u64) as usize;
                                                let stream_evt = SearchStreamEvent::SearchCancelled {
                                                    session_id: sess_id.clone(),
                                                    total_unique: total,
                                                    duration_ms: duration,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            "job.timed_out" => {
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);
                                                let total = payload.and_then(|p| p.get("total_found")).and_then(|v| v.as_u64()).unwrap_or(total_discovered_count as u64) as usize;
                                                let stream_evt = SearchStreamEvent::SearchTimedOut {
                                                    session_id: sess_id.clone(),
                                                    total_unique: total,
                                                    duration_ms: duration,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            "job.failed" => {
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);
                                                let err_msg = payload.and_then(|p| p.get("error")).and_then(|v| v.as_str()).unwrap_or("Search failed in Python engine").to_string();
                                                let stream_evt = SearchStreamEvent::SearchFailed {
                                                    session_id: sess_id.clone(),
                                                    error: err_msg,
                                                    duration_ms: duration,
                                                };
                                                let _ = app_clone.emit(&event_channel, &stream_evt);
                                                is_terminal_emitted = true;
                                                break;
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                            }
                            Ok(None) => {
                                // Process closed stdout
                                break;
                            }
                            Err(e) => {
                                warn!(session_id = %sess_id, "Error reading Python stdout: {e}");
                                break;
                            }
                        }
                    }
                }
            }

            // Guaranteed Terminal Event Delivery Fallback
            if !is_terminal_emitted {
                let duration = start_instant.elapsed().as_millis() as u64;

                // Close any hanging sources
                for (src_id, status) in &active_sources {
                    if status == "searching" || status == "queued" {
                        let _ = app_clone.emit(
                            &event_channel,
                            &SearchStreamEvent::SourceStatus {
                                session_id: sess_id.clone(),
                                source_id: src_id.clone(),
                                source_name: src_id.clone(),
                                status: "failed".to_string(),
                                message: Some(
                                    "Engine process exited before source completed".to_string(),
                                ),
                                results_count: 0,
                                elapsed_ms: duration,
                            },
                        );
                    }
                }

                if was_cancelled {
                    let _ = app_clone.emit(
                        &event_channel,
                        &SearchStreamEvent::SearchCancelled {
                            session_id: sess_id.clone(),
                            total_unique: total_discovered_count,
                            duration_ms: duration,
                        },
                    );
                } else if total_discovered_count > 0 {
                    let _ = app_clone.emit(
                        &event_channel,
                        &SearchStreamEvent::SearchCompletedWithErrors {
                            session_id: sess_id.clone(),
                            total_unique: total_discovered_count,
                            failed_sources: active_sources
                                .iter()
                                .filter(|(_, st)| {
                                    *st == "searching" || *st == "queued" || *st == "failed"
                                })
                                .map(|(sid, _)| sid.clone())
                                .collect(),
                            duration_ms: duration,
                        },
                    );
                } else {
                    let _ = app_clone.emit(
                        &event_channel,
                        &SearchStreamEvent::SearchFailed {
                            session_id: sess_id.clone(),
                            error: "Python scraping engine process terminated unexpectedly."
                                .to_string(),
                            duration_ms: duration,
                        },
                    );
                }
            }

            // Remove from active jobs and shutdown child
            {
                let mut jobs = get_active_jobs().lock().await;
                jobs.remove(&sess_id);
            }
            let _ = child.wait().await;
        });

        Ok(())
    }

    /// Cancels a running Python search session
    pub async fn cancel_search(session_id: &str) {
        let mut jobs = get_active_jobs().lock().await;
        if let Some(cancel_tx) = jobs.remove(session_id) {
            let _ = cancel_tx.send(());
        }
    }

    /// Returns list of sources supported by Python engine
    pub fn list_sources() -> Vec<WebsiteSourceDescriptor> {
        vec![
            WebsiteSourceDescriptor {
                id: "arxiv".to_string(),
                name: "arXiv (Python Engine)".to_string(),
                domain: "arxiv.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://arxiv.org/help/robots".to_string(),
                policy_notes: "Open access physics, math, and computer science preprints."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 400,
                content_types: vec!["Preprint".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "biorxiv".to_string(),
                name: "bioRxiv (Python Engine)".to_string(),
                domain: "biorxiv.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.biorxiv.org/about-biorxiv".to_string(),
                policy_notes: "Biological sciences preprints from Cold Spring Harbor Laboratory."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 500,
                content_types: vec!["Preprint".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "medrxiv".to_string(),
                name: "medRxiv (Python Engine)".to_string(),
                domain: "medrxiv.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.medrxiv.org/about/about-medrxiv".to_string(),
                policy_notes: "Health sciences and clinical research preprints from Cold Spring Harbor Laboratory."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 500,
                content_types: vec!["Preprint".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "pubmed".to_string(),
                name: "PubMed (Python Engine)".to_string(),
                domain: "pubmed.ncbi.nlm.nih.gov".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.ncbi.nlm.nih.gov/home/about/policies/".to_string(),
                policy_notes: "Biomedical literature with PMC open access full-text detection."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 400,
                content_types: vec!["Journal Article".to_string(), "Review".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "pmc".to_string(),
                name: "PMC (Python Engine)".to_string(),
                domain: "pmc.ncbi.nlm.nih.gov".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://pmc.ncbi.nlm.nih.gov/about/mou/".to_string(),
                policy_notes: "PubMed Central biomedical open access repository."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 400,
                content_types: vec!["Journal Article".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "plos".to_string(),
                name: "PLOS (Python Engine)".to_string(),
                domain: "journals.plos.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://plos.org/open-science/".to_string(),
                policy_notes: "Peer-reviewed open access scientific journals (CC BY 4.0)."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 500,
                content_types: vec!["Journal Article".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "nature_srep".to_string(),
                name: "Nature Scientific Reports (Python Engine)".to_string(),
                domain: "nature.com".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.nature.com/nature-research/terms-and-conditions".to_string(),
                policy_notes: "Open access peer-reviewed multidisciplinary research."
                    .to_string(),
                supports_native_years: false,
                request_delay_ms: 500,
                content_types: vec!["Journal Article".to_string()],
            },
        ]
    }
}
