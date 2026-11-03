use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

/// System platform diagnostic details surfaced to frontend and logging.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub family: String,
    pub app_version: String,
    pub is_apple_silicon: bool,
    pub app_data_dir: String,
    pub documents_dir: String,
}

/// Returns platform diagnostics for the current host environment.
pub fn get_platform_info() -> PlatformInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let family = std::env::consts::FAMILY.to_string();
    let is_apple_silicon = os == "macos" && arch == "aarch64";

    let app_data = default_app_data_dir().to_string_lossy().to_string();
    let documents = default_library_dir().to_string_lossy().to_string();

    PlatformInfo {
        os,
        arch,
        family,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        is_apple_silicon,
        app_data_dir: app_data,
        documents_dir: documents,
    }
}

/// Resolves standard cross-platform application data storage directory.
pub fn default_app_data_dir() -> PathBuf {
    if let Some(mut base) = dirs::data_dir() {
        #[cfg(target_os = "macos")]
        {
            base.push("com.infinitywebtechnology.infinityresearcher");
        }
        #[cfg(not(target_os = "macos"))]
        {
            base.push("infinity-researcher");
        }
        base
    } else {
        PathBuf::from(".").join("infinity-researcher-data")
    }
}

/// Resolves default scholarly documents research library directory.
pub fn default_library_dir() -> PathBuf {
    if let Some(doc_dir) = dirs::document_dir() {
        doc_dir.join("ResearchPapers")
    } else if let Some(home) = dirs::home_dir() {
        home.join("Documents").join("ResearchPapers")
    } else {
        PathBuf::from(".").join("ResearchPapers")
    }
}

/// Returns the platform-specific executable filename for llama-server.
pub fn llama_server_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    }
}

/// Returns the official download release archive URL for llama.cpp per OS/arch.
pub fn llama_server_download_url() -> Option<&'static str> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    match (os, arch) {
        ("windows", "x86_64") => Some(
            "https://github.com/ggml-org/llama.cpp/releases/download/b12032/llama-b12032-bin-win-cpu-x64.zip",
        ),
        ("linux", "x86_64") => Some(
            "https://github.com/ggml-org/llama.cpp/releases/download/b12032/llama-b12032-bin-ubuntu-x64.zip",
        ),
        ("macos", "aarch64") => Some(
            "https://github.com/ggml-org/llama.cpp/releases/download/b12032/llama-b12032-bin-macos-arm64.zip",
        ),
        ("macos", "x86_64") => Some(
            "https://github.com/ggml-org/llama.cpp/releases/download/b12032/llama-b12032-bin-macos-x64.zip",
        ),
        _ => None,
    }
}

/// Pure-Rust cross-platform zip archive extraction avoiding all shell dependencies.
pub fn extract_zip_archive(zip_path: &Path, destination_dir: &Path) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| format!("Cannot open zip file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

    fs::create_dir_all(destination_dir)
        .map_err(|e| format!("Failed to create extract directory: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Corrupt zip entry: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => destination_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {}: {}", outpath.display(), e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| {
                        format!("Failed to create parent directory {}: {}", p.display(), e)
                    })?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| {
                format!("Failed to create output file {}: {}", outpath.display(), e)
            })?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file {}: {}", outpath.display(), e))?;

            // On Unix platforms, restore executable permissions if appropriate
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
                } else if outpath
                    .file_name()
                    .map(|n| n == "llama-server")
                    .unwrap_or(false)
                {
                    let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(0o755));
                }
            }
        }
    }

    Ok(())
}

/// Searches the system PATH environment variable across platforms without shell spawns.
pub fn find_in_system_path(executable_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    let paths = std::env::split_paths(&path_var);

    for path in paths {
        let full = path.join(executable_name);
        if full.is_file() {
            return Some(full);
        }
        #[cfg(target_os = "windows")]
        {
            if !executable_name.ends_with(".exe") {
                let full_exe = path.join(format!("{}.exe", executable_name));
                if full_exe.is_file() {
                    return Some(full_exe);
                }
            }
        }
    }
    None
}
