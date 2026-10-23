pub mod commands;
pub mod config;
pub mod errors;
pub mod logging;
pub mod services;
pub mod state;

use commands::health::{app_health, app_ping};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init_logging();
    tracing::info!("Starting Research Paper Scraper desktop backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![app_health, app_ping])
        .run(tauri::generate_context!())
        .expect("Failed to initialize and run Tauri desktop application");
}
