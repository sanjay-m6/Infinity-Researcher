pub mod academic_sources;
pub mod commands;
pub mod config;
pub mod database;
pub mod domain;
pub mod errors;
pub mod logging;
pub mod repositories;
pub mod scrapers;
pub mod services;
pub mod state;

use std::sync::Arc;
use tauri::Manager;

use commands::*;
use database::Database;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init_logging();
    tracing::info!("Starting Infinity Researcher desktop backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve application data directory");
            let legacy_db_path = app_data_dir.join("research-paper-scraper.sqlite3");
            let db_path = if legacy_db_path.exists() {
                legacy_db_path
            } else {
                app_data_dir.join("infinity-researcher.sqlite3")
            };
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
            list_academic_providers,
            search_academic_sources,
            import_search_results,
            get_provider_config_status,
            set_provider_api_key,
            list_crawl_profiles,
            get_crawl_profile,
            create_crawl_profile,
            update_crawl_profile,
            delete_crawl_profile,
            preview_url_extraction,
            start_crawl_job,
            pause_crawl_job,
            resume_crawl_job,
            cancel_crawl_job,
            get_crawl_job,
            list_crawl_jobs,
            list_crawled_papers,
            import_crawled_papers,
            check_website_policy,
            import_single_page,
            search_website_sources,
            list_website_search_sources,
            get_scraping_engine_diagnostics,
            import_discovered_search_result,
            start_website_search_stream,
            cancel_website_search,
            start_python_search_stream,
            cancel_python_search,
            list_python_search_sources,
            get_python_engine_status,
            fetch_remote_pdf_preview,
            get_processing_overview,
            start_metadata_normalization,
            start_duplicate_scan,
            start_pdf_verification,
            list_duplicate_candidates,
            resolve_duplicate_candidate,
            merge_papers,
            list_paper_files,
            list_processing_jobs,
            get_paper_identifiers,
            set_paper_reading_status,
            set_paper_reading_progress,
            bulk_update_reading_status,
            rebuild_search_index,
            bulk_add_to_collection,
            bulk_remove_from_collection,
            create_tag,
            rename_tag,
            delete_tag,
            bulk_assign_tags,
            bulk_remove_tags,
            get_paper_document_status,
            open_paper_document,
            read_paper_pdf,
            get_paper_pdf_info,
            resolve_paper_pdf,
            enqueue_pdf_download,
            enqueue_bulk_pdf_downloads,
            cancel_pdf_download,
            retry_pdf_download,
            list_pdf_download_jobs,
            clear_completed_pdf_downloads,
            save_reader_state,
            get_reader_state,
            prepare_citation_export,
            execute_citation_export,
            import_ieee_paper,
            import_local_oa_pdf,
            get_open_access_stats,
            list_open_access_papers,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_is_maximized,
            list_ai_providers,
            get_ai_provider,
            save_ai_provider,
            delete_ai_provider,
            set_ai_provider_enabled,
            set_ai_provider_credential,
            clear_ai_provider_credential,
            test_ai_provider,
            list_ai_task_routes,
            set_ai_task_route,
            get_ai_settings,
            update_ai_settings,
            index_paper_for_rag,
            get_paper_rag_chunks,
            search_rag_passages,
            generate_ai_response,
            list_ai_chat_messages,
            save_ai_chat_message,
            clear_ai_chat_session,
            get_ai_recommendations,
            submit_recommendation_feedback,
            run_ai_evaluation,
            list_ai_evaluations,
            list_ai_finetuning_jobs,
            get_ai_hardware_info,
            create_ai_finetuning_job,
            ingest_integrity_document,
            get_integrity_document,
            list_integrity_documents,
            index_corpus_source,
            index_saved_library_papers,
            list_corpus_sources,
            delete_corpus_source,
            run_similarity_check,
            get_similarity_report,
            update_match_review_status,
            run_ai_signal_check,
            create_writing_session,
            generate_writing_revision,
            accept_writing_revision,
            list_writing_revisions,
            get_integrity_dashboard_summary,
            list_matrix_workspaces,
            get_matrix_workspace_detail,
            create_matrix_workspace,
            update_matrix_columns,
            delete_matrix_workspace,
            add_paper_to_matrix,
            remove_paper_from_matrix,
            upsert_matrix_extraction,
            extract_matrix_fields,
            export_matrix_csv,
            create_evidence_copilot_session,
            list_evidence_copilot_sessions,
            get_evidence_copilot_messages,
            ask_evidence_copilot,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to initialize and run Tauri desktop application");
}

