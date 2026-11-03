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

#[derive(Debug, Clone)]
pub enum EngineExecutionPlan {
    /// Standalone packaged executable (PyInstaller sidecar with zero python dependencies)
    StandaloneBinary(PathBuf),
    /// Development fallback: system Python interpreter with python-engine module
    PythonModule {
        python_cmd: String,
        engine_dir: PathBuf,
    },
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

    /// Resolves either the standalone sidecar binary or system Python environment
    pub fn resolve_engine_execution_plan() -> Result<EngineExecutionPlan, CommandError> {
        let binary_names = [
            "paper-scraper-x86_64-pc-windows-msvc.exe",
            "paper-scraper.exe",
        ];

        // In development mode, prefer PythonModule if available so edits take effect immediately
        if cfg!(debug_assertions) {
            if let Ok(py_cmd) = Self::resolve_python_command() {
                if let Ok(eng_dir) = Self::resolve_engine_dir() {
                    return Ok(EngineExecutionPlan::PythonModule {
                        python_cmd: py_cmd,
                        engine_dir: eng_dir,
                    });
                }
            }
        }

        // 1. Check alongside current executable (production installed app)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                for name in &binary_names {
                    let cand = parent.join(name);
                    if cand.is_file() {
                        return Ok(EngineExecutionPlan::StandaloneBinary(cand));
                    }
                    let cand_bin = parent.join("binaries").join(name);
                    if cand_bin.is_file() {
                        return Ok(EngineExecutionPlan::StandaloneBinary(cand_bin));
                    }
                    let cand_res = parent.join("resources").join(name);
                    if cand_res.is_file() {
                        return Ok(EngineExecutionPlan::StandaloneBinary(cand_res));
                    }
                }
            }
        }

        // 2. Check relative to workspace (standalone binaries)
        for cand_dir in &[
            PathBuf::from("src-tauri/binaries"),
            PathBuf::from("binaries"),
            PathBuf::from("../src-tauri/binaries"),
        ] {
            for name in &binary_names {
                let cand = cand_dir.join(name);
                if cand.is_file() {
                    return Ok(EngineExecutionPlan::StandaloneBinary(cand));
                }
            }
        }

        // 3. Fall back to Python module if Python & directory exist
        if let Ok(py_cmd) = Self::resolve_python_command() {
            if let Ok(eng_dir) = Self::resolve_engine_dir() {
                return Ok(EngineExecutionPlan::PythonModule {
                    python_cmd: py_cmd,
                    engine_dir: eng_dir,
                });
            }
        }

        Err(CommandError::new(
            "ENGINE_NOT_FOUND",
            "Neither standalone paper-scraper executable nor Python environment was found.",
            false,
        ))
    }

    /// Check overall Python engine availability and status
    pub async fn get_status() -> PythonEngineStatus {
        match Self::resolve_engine_execution_plan() {
            Ok(EngineExecutionPlan::StandaloneBinary(bin_path)) => PythonEngineStatus {
                available: true,
                python_path: Some(bin_path.to_string_lossy().to_string()),
                engine_dir: Some("bundled-standalone".to_string()),
                version: Some("1.0.0 (Standalone Binary)".to_string()),
                error: None,
            },
            Ok(EngineExecutionPlan::PythonModule {
                python_cmd,
                engine_dir,
            }) => PythonEngineStatus {
                available: true,
                python_path: Some(python_cmd),
                engine_dir: Some(engine_dir.to_string_lossy().to_string()),
                version: Some("1.0.0 (Python Module)".to_string()),
                error: None,
            },
            Err(e) => PythonEngineStatus {
                available: false,
                python_path: None,
                engine_dir: None,
                version: None,
                error: Some(e.message),
            },
        }
    }

    /// Starts a streaming search session using the Python engine
    pub async fn start_streaming_search(
        app: AppHandle,
        session_id: String,
        query: WebsiteSearchQuery,
    ) -> Result<(), CommandError> {
        let plan = Self::resolve_engine_execution_plan()?;

        let mut child = match &plan {
            EngineExecutionPlan::StandaloneBinary(bin_path) => {
                info!(
                    session_id = %session_id,
                    query = %query.query,
                    binary = %bin_path.display(),
                    "Launching standalone bundled Python scraper binary (zero dependencies)"
                );
                let mut cmd = Command::new(bin_path);
                if let Some(parent) = bin_path.parent() {
                    cmd.current_dir(parent);
                }
                cmd.stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
            }
            EngineExecutionPlan::PythonModule {
                python_cmd,
                engine_dir,
            } => {
                info!(
                    session_id = %session_id,
                    query = %query.query,
                    engine_dir = %engine_dir.display(),
                    "Launching Python scraping engine search"
                );
                Command::new(python_cmd)
                    .arg("-m")
                    .arg("paper_scraper")
                    .current_dir(engine_dir)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
            }
        }
        .map_err(|e| {
            CommandError::new(
                "PROCESS_SPAWN_ERROR",
                format!("Failed to spawn scraping engine process: {e}"),
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
                                                let explicit_status = payload.and_then(|p| p.get("status")).and_then(|v| v.as_str());
                                                let status_str = match explicit_status {
                                                    Some("blocked") => "blocked".to_string(),
                                                    Some("rate_limited") => "rate_limited".to_string(),
                                                    Some("failed") => "failed".to_string(),
                                                    Some("timeout") | Some("timed_out") => "timeout".to_string(),
                                                    Some("unsupported") => "unsupported".to_string(),
                                                    Some("completed") => "completed".to_string(),
                                                    Some("no_results") => "no_results".to_string(),
                                                    _ => if count > 0 { "completed".to_string() } else { "no_results".to_string() },
                                                };
                                                let msg = payload.and_then(|p| p.get("message")).and_then(|v| v.as_str()).map(|s| s.to_string());
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
                                                    message: msg,
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
                                            "job.completed" | "job.no_results" | "job.completed_with_warnings" | "job.cancelled" | "job.timed_out" | "job.failed" => {
                                                let total = payload.and_then(|p| p.get("total_unique").or_else(|| p.get("total_found"))).and_then(|v| v.as_u64()).unwrap_or(total_discovered_count as u64) as usize;
                                                let duration = payload.and_then(|p| p.get("duration_ms")).and_then(|v| v.as_u64()).unwrap_or_else(|| start_instant.elapsed().as_millis() as u64);

                                                // 1. Process explicit source statuses in payload if provided
                                                if let Some(statuses) = payload.and_then(|p| p.get("statuses")).and_then(|v| v.as_array()) {
                                                    for st_val in statuses {
                                                        if let Some(sid) = st_val.get("source_id").and_then(|v| v.as_str()) {
                                                            let st_str = st_val.get("status").and_then(|v| v.as_str()).unwrap_or("no_results");
                                                            let cnt = st_val.get("results_count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                                                            let el = st_val.get("elapsed_ms").and_then(|v| v.as_u64()).unwrap_or(duration);
                                                            active_sources.insert(sid.to_string(), st_str.to_string());

                                                            let _ = app_clone.emit(
                                                                &event_channel,
                                                                &SearchStreamEvent::SourceStatus {
                                                                    session_id: sess_id.clone(),
                                                                    source_id: sid.to_string(),
                                                                    source_name: sid.to_string(),
                                                                    status: st_str.to_string(),
                                                                    message: None,
                                                                    results_count: cnt,
                                                                    elapsed_ms: el,
                                                                },
                                                            );
                                                            let _ = app_clone.emit(
                                                                &event_channel,
                                                                &SearchStreamEvent::SourceCompleted {
                                                                    session_id: sess_id.clone(),
                                                                    source_id: sid.to_string(),
                                                                    count: cnt,
                                                                    elapsed_ms: el,
                                                                },
                                                            );

                                                            crate::scrapers::query_search::record_source_metric(
                                                                sid,
                                                                cnt > 0,
                                                                cnt,
                                                                el,
                                                                if st_str == "failed" { Some("Source search failed".to_string()) } else { None },
                                                            );
                                                        }
                                                    }
                                                }

                                                // 2. Guarantee that any remaining sources in active_sources transition out of searching/queued
                                                let default_final = if evt == "job.failed" { "failed" } else { "no_results" };
                                                for (src_id, status) in active_sources.iter_mut() {
                                                    if status == "searching" || status == "queued" {
                                                        *status = default_final.to_string();
                                                        let _ = app_clone.emit(
                                                            &event_channel,
                                                            &SearchStreamEvent::SourceStatus {
                                                                session_id: sess_id.clone(),
                                                                source_id: src_id.clone(),
                                                                source_name: src_id.clone(),
                                                                status: default_final.to_string(),
                                                                message: None,
                                                                results_count: 0,
                                                                elapsed_ms: duration,
                                                            },
                                                        );
                                                        let _ = app_clone.emit(
                                                            &event_channel,
                                                            &SearchStreamEvent::SourceCompleted {
                                                                session_id: sess_id.clone(),
                                                                source_id: src_id.clone(),
                                                                count: 0,
                                                                elapsed_ms: duration,
                                                            },
                                                        );

                                                        crate::scrapers::query_search::record_source_metric(
                                                            src_id,
                                                            false,
                                                            0,
                                                            duration,
                                                            Some("Zero papers found".to_string()),
                                                        );
                                                    }
                                                }

                                                // 3. Emit terminal job event
                                                match evt {
                                                    "job.completed" => {
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
                                                    }
                                                    "job.no_results" => {
                                                        let stream_evt = SearchStreamEvent::SearchNoResults {
                                                            session_id: sess_id.clone(),
                                                            duration_ms: duration,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                    "job.completed_with_warnings" => {
                                                        let failed_sources = payload
                                                            .and_then(|p| p.get("failed_sources"))
                                                            .and_then(|v| v.as_array())
                                                            .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|s| s.to_string())).collect())
                                                            .unwrap_or_default();
                                                        let stream_evt = SearchStreamEvent::SearchCompletedWithErrors {
                                                            session_id: sess_id.clone(),
                                                            total_unique: total,
                                                            failed_sources,
                                                            duration_ms: duration,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                    "job.cancelled" => {
                                                        let stream_evt = SearchStreamEvent::SearchCancelled {
                                                            session_id: sess_id.clone(),
                                                            total_unique: total,
                                                            duration_ms: duration,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                    "job.timed_out" => {
                                                        let stream_evt = SearchStreamEvent::SearchTimedOut {
                                                            session_id: sess_id.clone(),
                                                            total_unique: total,
                                                            duration_ms: duration,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                    "job.failed" => {
                                                        let err_msg = payload.and_then(|p| p.get("error")).and_then(|v| v.as_str()).unwrap_or("Search failed in Python engine").to_string();
                                                        let stream_evt = SearchStreamEvent::SearchFailed {
                                                            session_id: sess_id.clone(),
                                                            error: err_msg,
                                                            duration_ms: duration,
                                                        };
                                                        let _ = app_clone.emit(&event_channel, &stream_evt);
                                                    }
                                                    _ => {}
                                                }

                                                // 4. Record summary in recent jobs for Diagnostics panel
                                                let job_state = match evt {
                                                    "job.completed" => if total == 0 { crate::scrapers::SearchJobState::NoResults } else { crate::scrapers::SearchJobState::Completed },
                                                    "job.no_results" => crate::scrapers::SearchJobState::NoResults,
                                                    "job.completed_with_warnings" => crate::scrapers::SearchJobState::CompletedWithErrors,
                                                    "job.cancelled" => crate::scrapers::SearchJobState::Cancelled,
                                                    _ => crate::scrapers::SearchJobState::Failed,
                                                };

                                                crate::scrapers::query_search::record_job_summary(crate::scrapers::SearchJobSummary {
                                                    session_id: sess_id.clone(),
                                                    query: query.query.clone(),
                                                    sources: active_sources.keys().cloned().collect(),
                                                    state: job_state,
                                                    total_results: total,
                                                    duration_ms: duration,
                                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                                });

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

    /// Executes a request-response RPC command against the Python scraper engine
    pub async fn execute_rpc(msg_type: &str, mut payload: Value) -> Result<Value, CommandError> {
        let plan = Self::resolve_engine_execution_plan()?;
        let req_id = format!("rpc_{}_{}", msg_type, uuid::Uuid::new_v4());

        let mut child = match &plan {
            EngineExecutionPlan::StandaloneBinary(bin_path) => {
                let mut cmd = Command::new(bin_path);
                if let Some(parent) = bin_path.parent() {
                    cmd.current_dir(parent);
                }
                cmd.stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
            }
            EngineExecutionPlan::PythonModule {
                python_cmd,
                engine_dir,
            } => Command::new(python_cmd)
                .arg("-m")
                .arg("paper_scraper")
                .current_dir(engine_dir)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn(),
        }
        .map_err(|e| {
            CommandError::new(
                "PROCESS_SPAWN_ERROR",
                format!("Failed to spawn Python engine process: {e}"),
                false,
            )
        })?;

        let mut stdin = child.stdin.take().ok_or_else(|| {
            CommandError::new("IPC_ERROR", "Failed to open Python stdin pipe", false)
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            CommandError::new("IPC_ERROR", "Failed to open Python stdout pipe", false)
        })?;

        if let Value::Object(ref mut map) = payload {
            map.insert("type".to_string(), Value::String(msg_type.to_string()));
            map.insert("request_id".to_string(), Value::String(req_id.clone()));
        }

        let mut msg_bytes = serde_json::to_vec(&payload).map_err(|e| {
            CommandError::new(
                "SERIALIZE_ERROR",
                format!("Failed to serialize RPC request: {e}"),
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

        let shutdown_bytes = b"{\"type\":\"shutdown\"}\n";
        let _ = stdin.write_all(shutdown_bytes).await;
        let _ = stdin.flush().await;

        let expected_result_type = format!("{msg_type}_result");
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        let timeout_duration = std::time::Duration::from_secs(30);
        let read_future = async {
            while let Ok(Some(line)) = lines.next_line().await {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
                    if parsed.get("type").and_then(|v| v.as_str()) == Some("response") {
                        if parsed.get("reply_to").and_then(|v| v.as_str()) == Some(&req_id) {
                            let resp_type = parsed
                                .get("response_type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if resp_type == expected_result_type {
                                return Ok(parsed.get("payload").cloned().unwrap_or(parsed));
                            } else if resp_type == "error" {
                                let err_msg = parsed
                                    .get("payload")
                                    .and_then(|p| p.get("error"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Python engine error");
                                return Err(CommandError::new(
                                    "PYTHON_RPC_ERROR",
                                    err_msg.to_string(),
                                    false,
                                ));
                            }
                        }
                    }
                }
            }
            Err(CommandError::new(
                "PYTHON_RPC_EOF",
                "Python engine closed connection without returning result",
                false,
            ))
        };

        tokio::time::timeout(timeout_duration, read_future)
            .await
            .map_err(|_| CommandError::new("TIMEOUT", "Python engine RPC call timed out", false))?
    }

    /// Safely extracts text from a document (PDF, DOCX, TXT, MD) using Python or local reader
    pub async fn extract_document_text(file_path: &str) -> Result<Value, CommandError> {
        let path = std::path::Path::new(file_path);
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if ext_lower == "txt" || ext_lower == "md" || ext_lower == "markdown" {
                if let Ok(content) = tokio::fs::read_to_string(path).await {
                    let fname = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("document")
                        .to_string();
                    let c_count = content.chars().count();
                    let w_count = content.split_whitespace().count();
                    return Ok(serde_json::json!({
                        "file_name": fname,
                        "file_type": ext_lower,
                        "text": content,
                        "char_count": c_count,
                        "word_count": w_count,
                        "warning": null,
                    }));
                }
            }
        }

        Self::execute_rpc(
            "extract_document_text",
            serde_json::json!({
                "file_path": file_path
            }),
        )
        .await
    }

    /// Evaluates statistical AI writing signals and stylistic cadence via Python engine
    pub async fn detect_ai_signals(text: &str) -> Result<Value, CommandError> {
        match Self::execute_rpc(
            "detect_ai_signals",
            serde_json::json!({
                "text": text
            }),
        )
        .await
        {
            Ok(res) => Ok(res),
            Err(err) => {
                warn!(
                    "Python AI signal detection RPC failed: {:?}; fallback to local heuristic",
                    err
                );
                let words: Vec<&str> = text.split_whitespace().collect();
                let word_count = words.len();
                let sentences: Vec<&str> = text
                    .split(&['.', '!', '?'])
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .collect();
                let sentence_count = sentences.len();

                if sentence_count < 4 || word_count < 30 {
                    return Ok(serde_json::json!({
                        "status": "insufficient_text",
                        "overall_signal_score": 0.0,
                        "classification": "insufficient_text",
                        "sentence_count": sentence_count,
                        "mean_sentence_length": if sentence_count > 0 { word_count as f64 / sentence_count as f64 } else { 0.0 },
                        "variance": 0.0,
                        "burstiness": 0.0,
                        "uncertainty_caveat": "Fewer than 4 valid sentences; statistical features have low diagnostic sensitivity."
                    }));
                }

                let lengths: Vec<f64> = sentences
                    .iter()
                    .map(|s| s.split_whitespace().count() as f64)
                    .collect();
                let mean_len: f64 = lengths.iter().sum::<f64>() / lengths.len() as f64;
                let var: f64 = lengths.iter().map(|l| (l - mean_len).powi(2)).sum::<f64>()
                    / lengths.len() as f64;
                let std_dev = var.sqrt();
                let burstiness = if mean_len + std_dev > 0.0 {
                    (std_dev - mean_len) / (std_dev + mean_len)
                } else {
                    0.0
                };

                let score = if burstiness < -0.2 { 0.65 } else { 0.35 };

                Ok(serde_json::json!({
                    "status": "completed",
                    "overall_signal_score": score,
                    "classification": if score > 0.6 { "elevated_uniformity" } else { "natural_cadence" },
                    "sentence_count": sentence_count,
                    "mean_sentence_length": (mean_len * 100.0).round() / 100.0,
                    "std_dev": (std_dev * 100.0).round() / 100.0,
                    "variance": (var * 100.0).round() / 100.0,
                    "burstiness": (burstiness * 1000.0).round() / 1000.0,
                    "uncertainty_caveat": "Statistical cadence measures linguistic uniformity rather than authorship. Rigorous technical manuscripts frequently adopt standardized, uniform phraseology. This diagnostic must never be treated as definitive evidence of AI authorship."
                }))
            }
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
            WebsiteSourceDescriptor {
                id: "ieee_xplore".to_string(),
                name: "IEEE Xplore (Python Engine)".to_string(),
                domain: "ieeexplore.ieee.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://ieeexplore.ieee.org/XploreHelp/legal-terms".to_string(),
                policy_notes: "IEEE conference and journal research publications via official REST and Crossref prefix index."
                    .to_string(),
                supports_native_years: true,
                request_delay_ms: 1000,
                content_types: vec!["Conference Paper".to_string(), "Journal Article".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "acm_dl".to_string(),
                name: "ACM Digital Library (Python Engine)".to_string(),
                domain: "dl.acm.org".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://www.acm.org/about-acm/terms-of-use".to_string(),
                policy_notes: "ACM Digital Library publications and conference proceedings via Crossref prefix 10.1145 and ACM DL indexing."
                    .to_string(),
                supports_native_years: true,
                request_delay_ms: 1000,
                content_types: vec!["Conference Paper".to_string(), "Journal Article".to_string()],
            },
            WebsiteSourceDescriptor {
                id: "google_scholar".to_string(),
                name: "Google Scholar (Python Engine)".to_string(),
                domain: "scholar.google.com".to_string(),
                status: "enabled".to_string(),
                policy_url: "https://policies.google.com/terms".to_string(),
                policy_notes: "Google Scholar query discovery with live parsing and automated open scholarly catalog fallback."
                    .to_string(),
                supports_native_years: true,
                request_delay_ms: 1500,
                content_types: vec!["Article".to_string(), "Preprint".to_string(), "Conference Paper".to_string()],
            },
        ]
    }
}
