use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use sysinfo::System;
use tauri::{ipc::Channel, AppHandle, Manager, State};

pub struct LocalAiState {
    pub server_process: Mutex<Option<Child>>,
    pub active_model: Mutex<Option<String>>,
    pub port: u16,
}

impl Default for LocalAiState {
    fn default() -> Self {
        Self {
            server_process: Mutex::new(None),
            active_model: Mutex::new(None),
            port: 11435,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub status: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct HardwareProfile {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub cpu_cores: usize,
    pub recommended_tier: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct LocalAiStatus {
    pub is_running: bool,
    pub port: u16,
    pub active_model: Option<String>,
    pub endpoint: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct InstalledModelInfo {
    pub filename: String,
    pub size_mb: u64,
    pub full_path: String,
}

// ---------------------------------------------------------------------------
// 1. Hardware Profile Detection
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_hardware_profile() -> Result<HardwareProfile, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_ram_mb = sys.total_memory() / (1024 * 1024);
    let available_ram_mb = sys.available_memory() / (1024 * 1024);
    let cpu_cores = sys.physical_core_count().unwrap_or(2).max(1);

    let recommended_tier = if total_ram_mb <= 3500 {
        "nano".to_string()
    } else if total_ram_mb <= 7000 {
        "balanced".to_string()
    } else {
        "pro".to_string()
    };

    Ok(HardwareProfile {
        total_ram_mb,
        available_ram_mb,
        cpu_cores,
        recommended_tier,
    })
}

// ---------------------------------------------------------------------------
// 2. Resumable In-App GGUF Model Downloader
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn download_ai_model(
    app: AppHandle,
    model_id: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<String, String> {
    let (url, filename) = match model_id.as_str() {
        "deepseek-r1-8b" | "deepseek-r1" | "reasoning-8b" => (
            "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-8B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
            "DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
        ),
        "qwen2.5-7b" | "qwen-7b" | "flagship-7b" => (
            "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
            "qwen2.5-7b-instruct-q4_k_m.gguf",
        ),
        "llama-3.1-8b" | "llama3.1-8b" | "pro-8b" => (
            "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
            "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
        ),
        "qwen2.5-3b" | "pro-3b" | "pro-4b" | "fast-3b" => (
            "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
            "qwen2.5-3b-instruct-q4_k_m.gguf",
        ),
        "mistral-7b" | "mistral-7b-v0.3" => (
            "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
            "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
        ),
        // Backward compatibility
        "nano-0.6b" | "nano-0.5b" | "qwen2.5-0.5b" => (
            "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
            "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        ),
        "balanced-1b" | "llama-3.2-1b" => (
            "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
            "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        ),
        "balanced-1.7b" | "synthesis-1.5b" | "qwen2.5-1.5b" => (
            "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        ),
        "legacy-qwen3-0.6b" => (
            "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf",
            "Qwen3-0.6B-Q4_0.gguf",
        ),
        _ => return Err(format!("Unknown model identifier: {}", model_id)),
    };

    let models_dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");
    fs::create_dir_all(&models_dir).map_err(|e| format!("Failed to create models dir: {}", e))?;

    let file_path = models_dir.join(filename);
    let mut downloaded: u64 = file_path.metadata().map(|m| m.len()).unwrap_or(0);

    let client = Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut req = client.get(url);
    if downloaded > 0 {
        req = req.header("Range", format!("bytes={}-", downloaded));
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    // Check if range was ignored or 200 OK returned full file
    let status = res.status();
    if status == reqwest::StatusCode::OK && downloaded > 0 {
        downloaded = 0; // Server doesn't support range, restart from beginning
    }

    let content_len = res.content_length().unwrap_or(0);
    let total_size = if content_len > 0 {
        content_len + downloaded
    } else {
        downloaded
    };

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(downloaded > 0)
        .truncate(downloaded == 0)
        .open(&file_path)
        .map_err(|e| format!("Failed to open model destination file: {}", e))?;

    let mut stream = res.bytes_stream();
    let mut last_send = std::time::Instant::now();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Error receiving download stream: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
        downloaded += chunk.len() as u64;

        // Throttle progress events to 10/sec to prevent UI event flood
        if last_send.elapsed() >= std::time::Duration::from_millis(100) || downloaded >= total_size
        {
            let pct = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            };

            let _ = on_progress.send(DownloadProgress {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: (pct * 10.0).round() / 10.0,
                status: "downloading".into(),
            });
            last_send = std::time::Instant::now();
        }
    }

    let _ = on_progress.send(DownloadProgress {
        downloaded_bytes: total_size,
        total_bytes: total_size,
        percentage: 100.0,
        status: "completed".into(),
    });

    Ok(file_path.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// 3. List Installed GGUF Models
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_installed_ai_models(app: AppHandle) -> Result<Vec<InstalledModelInfo>, String> {
    let models_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    if !models_dir.exists() {
        return Ok(vec![]);
    }

    let mut list = Vec::new();
    let read_dir = fs::read_dir(&models_dir).map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "gguf" {
                    let filename = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let size_mb = path
                        .metadata()
                        .map(|m| m.len() / (1024 * 1024))
                        .unwrap_or(0);
                    list.push(InstalledModelInfo {
                        filename,
                        size_mb,
                        full_path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    Ok(list)
}

// ---------------------------------------------------------------------------
// 4. Start In-App AI Engine (llama-server Sidecar)
// ---------------------------------------------------------------------------

async fn resolve_or_download_sidecar_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let current_dir = std::env::current_dir().unwrap_or_default();
    let current_exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let binary_name = crate::platform::llama_server_binary_name();

    let candidate_paths = vec![
        app_data_dir.join("binaries").join(binary_name),
        current_dir
            .join("src-tauri")
            .join("binaries")
            .join(binary_name),
        current_dir.join("binaries").join(binary_name),
        resource_dir.join("binaries").join(binary_name),
        resource_dir.join(binary_name),
        current_exe_dir.join("binaries").join(binary_name),
        current_exe_dir.join(binary_name),
    ];

    for cand in candidate_paths {
        if cand.is_file() {
            return Ok(cand);
        }
    }

    // Try cross-platform PATH search
    if let Some(path) = crate::platform::find_in_system_path(binary_name) {
        return Ok(path);
    }

    // Download CPU release bundle for current platform
    let dest_dir = app_data_dir.join("binaries");
    fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Failed to create binaries directory: {}", e))?;
    let target_exe = dest_dir.join(binary_name);

    let url = crate::platform::llama_server_download_url()
        .ok_or_else(|| format!("Automated {} download is not supported on this platform/architecture. Please install it manually.", binary_name))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(url)
        .header("User-Agent", "InfinityResearcher/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download llama-server bundle: {}", e))?;

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read llama-server bundle bytes: {}", e))?;

    let temp_zip = dest_dir.join("llama-server-tmp.zip");
    fs::write(&temp_zip, &bytes).map_err(|e| format!("Failed to write temp zip: {}", e))?;

    // Extract using pure-Rust zip extractor (zero shell dependencies)
    crate::platform::extract_zip_archive(&temp_zip, &dest_dir)
        .map_err(|e| format!("Failed to extract llama-server archive: {}", e))?;

    let _ = fs::remove_file(&temp_zip);

    if target_exe.is_file() {
        Ok(target_exe)
    } else {
        Err(format!(
            "{} not found after download and extraction. Please verify permissions.",
            binary_name
        ))
    }
}

#[tauri::command]
pub async fn start_in_app_ai_engine(
    app: AppHandle,
    state: State<'_, LocalAiState>,
    model_filename: String,
) -> Result<LocalAiStatus, String> {
    let port = state.port;
    let endpoint = format!("http://127.0.0.1:{}", port);
    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(1000))
        .build()
        .map_err(|e| e.to_string())?;

    let models_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    // Auto-resolve model filename if empty or missing
    let chosen_model = if model_filename.trim().is_empty() {
        let mut found = None;
        if let Ok(entries) = fs::read_dir(&models_dir) {
            let mut ggufs = Vec::new();
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file()
                    && p.extension().map(|e| e.to_string_lossy().to_lowercase())
                        == Some("gguf".to_string())
                {
                    ggufs.push(
                        p.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                    );
                }
            }
            // Prefer instruct-tuned models, else first available
            found = ggufs
                .iter()
                .find(|g| g.to_lowercase().contains("instruct"))
                .cloned()
                .or_else(|| ggufs.into_iter().next());
        }
        found.ok_or_else(|| {
            "No downloaded GGUF models found. Please download a model from Tools Hub first."
                .to_string()
        })?
    } else {
        model_filename.clone()
    };

    let model_path = models_dir.join(&chosen_model);
    if !model_path.exists() {
        return Err(format!(
            "Model file '{}' not found in models directory.",
            chosen_model
        ));
    }

    // Check if port is already active and responding
    if let Ok(resp) = client.get(format!("{}/v1/models", endpoint)).send().await {
        if resp.status().is_success() {
            *state.active_model.lock().unwrap() = Some(chosen_model.clone());
            return Ok(LocalAiStatus {
                is_running: true,
                port,
                active_model: Some(chosen_model),
                endpoint,
            });
        }
    }

    // Check if tracked child is still alive
    {
        let mut guard = state.server_process.lock().map_err(|e| e.to_string())?;
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    let current_model = state.active_model.lock().unwrap().clone();
                    return Ok(LocalAiStatus {
                        is_running: true,
                        port,
                        active_model: current_model,
                        endpoint,
                    });
                }
                _ => {
                    *guard = None;
                }
            }
        }
    }

    // Resolve binary path
    let sidecar_path = resolve_or_download_sidecar_binary(&app).await?;

    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_ram_mb = sys.total_memory() / (1024 * 1024);
    let cores = sys.physical_core_count().unwrap_or(2).max(1);

    // Thread tuning: Cap at 4 to prevent CPU core contention and thermal throttling
    let num_threads = std::cmp::min(cores, 4).max(1);
    let threads_str = num_threads.to_string();

    // RAM-tier tuning optimized for 4GB RAM systems:
    // With -np 1 (single slot) and q4_0 KV cache, resident memory stays strictly under 1.5GB
    let (ctx_size, batch_size, ubatch_size) = if total_ram_mb <= 2600 {
        ("512", "128", "64")
    } else if total_ram_mb <= 4500 {
        ("1536", "256", "128")
    } else {
        ("2048", "256", "128")
    };

    let port_str = port.to_string();

    let mut cmd = Command::new(&sidecar_path);
    cmd.args([
        "-m",
        model_path.to_str().unwrap_or_default(),
        "-c",
        ctx_size,
        "-b",
        batch_size,
        "-ub",
        ubatch_size,
        "-t",
        &threads_str,
        "-tb",
        &threads_str,
        "-ctk",
        "q4_0",
        "-ctv",
        "q4_0",
        "-np",
        "1",
        "--port",
        &port_str,
        "--reasoning",
        "off",
        "--reasoning-budget",
        "0",
        "--repeat-penalty",
        "1.25",
        "--repeat-last-n",
        "128",
        "--presence-penalty",
        "0.4",
        "--frequency-penalty",
        "0.4",
    ]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    crate::platform::configure_background_process(&mut cmd);

    let child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to spawn local AI engine (path: {:?}): {}",
            sidecar_path, e
        )
    })?;

    {
        let mut guard = state.server_process.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
        *state.active_model.lock().unwrap() = Some(chosen_model.clone());
    }

    // Health verification loop (wait up to 12 seconds for model weights to load into memory)
    let poll_start = std::time::Instant::now();
    let mut is_live = false;
    while poll_start.elapsed() < std::time::Duration::from_secs(12) {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if let Ok(resp) = client.get(format!("{}/v1/models", endpoint)).send().await {
            if resp.status().is_success() {
                is_live = true;
                break;
            }
        }
    }

    if !is_live {
        let mut guard = state.server_process.lock().map_err(|e| e.to_string())?;
        if let Some(child_mut) = guard.as_mut() {
            if let Ok(Some(exit_status)) = child_mut.try_wait() {
                *guard = None;
                return Err(format!(
                    "Local AI engine stopped immediately upon startup (exit code: {:?}).",
                    exit_status
                ));
            }
        }
    }

    Ok(LocalAiStatus {
        is_running: true,
        port,
        active_model: Some(chosen_model),
        endpoint,
    })
}

// ---------------------------------------------------------------------------
// 5. Stop In-App AI Engine (Reclaim 100% RAM)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn stop_in_app_ai_engine(state: State<'_, LocalAiState>) -> Result<(), String> {
    let mut guard = state.server_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    *state.active_model.lock().unwrap() = None;
    Ok(())
}

// ---------------------------------------------------------------------------
// 6. Get Current AI Engine Status
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_ai_engine_status(state: State<'_, LocalAiState>) -> Result<LocalAiStatus, String> {
    let port = state.port;
    let endpoint = format!("http://127.0.0.1:{}", port);
    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(600))
        .build()
        .map_err(|e| e.to_string())?;

    let is_listening = match client.get(format!("{}/v1/models", endpoint)).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    let mut guard = state.server_process.lock().map_err(|e| e.to_string())?;
    let is_running = if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => true,
            _ => {
                *guard = None;
                is_listening
            }
        }
    } else {
        is_listening
    };

    let active_model = if is_running || is_listening {
        state.active_model.lock().unwrap().clone()
    } else {
        None
    };

    Ok(LocalAiStatus {
        is_running: is_running || is_listening,
        port,
        active_model,
        endpoint,
    })
}
