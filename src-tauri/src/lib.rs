pub mod commands;
pub mod config;
pub mod database;
pub mod domain;
pub mod errors;
pub mod logging;
pub mod repositories;
pub mod services;
pub mod state;

use std::sync::Arc;
use tauri::Manager;

use commands::{
    add_paper_to_collection, app_health, app_ping, assign_tag_to_paper, create_collection,
    create_paper, delete_collection, delete_note, delete_paper, get_app_setting,
    get_database_info, get_notes_for_paper, get_paper, list_app_settings, list_collections,
    list_papers, list_sources, list_tags, remove_paper_from_collection, remove_tag_from_paper,
    save_note, set_app_setting, toggle_save_paper, update_collection, update_paper,
};
use database::Database;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init_logging();
    tracing::info!("Starting Research Paper Scraper desktop backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve application data directory");
            let db_path = app_data_dir.join("research-paper-scraper.sqlite3");
            tracing::info!(path = %db_path.display(), "Initializing SQLite database");

            let database = Database::open_file(&db_path)
                .expect("Failed to initialize SQLite database at app-data path");

            let state = AppState::new(
                crate::config::AppConfig::default(),
                Some(Arc::new(database)),
            );
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_health,
            app_ping,
            list_papers,
            get_paper,
            create_paper,
            update_paper,
            delete_paper,
            toggle_save_paper,
            list_collections,
            create_collection,
            update_collection,
            delete_collection,
            add_paper_to_collection,
            remove_paper_from_collection,
            list_tags,
            assign_tag_to_paper,
            remove_tag_from_paper,
            get_notes_for_paper,
            save_note,
            delete_note,
            get_app_setting,
            set_app_setting,
            list_app_settings,
            list_sources,
            get_database_info,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to initialize and run Tauri desktop application");
}
