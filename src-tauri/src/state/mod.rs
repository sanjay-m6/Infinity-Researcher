use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::academic_sources::AcademicSearchService;
use crate::config::AppConfig;
use crate::database::Database;
use crate::errors::AppError;
use crate::scrapers::CrawlEngine;
use crate::services::DownloadManager;

/// Shared application state managed by the Tauri runtime.
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub start_time: Instant,
    pub database: Option<Arc<Database>>,
    pub search_service: Arc<AcademicSearchService>,
    pub crawl_engine: Arc<CrawlEngine>,
    pub download_manager: Arc<DownloadManager>,
    pub ai_provider_service: Arc<crate::services::AiProviderService>,
}

impl Default for AppState {
    fn default() -> Self {
        let config = AppConfig::default();
        let storage_dir = config.default_library_dir.clone();
        let download_manager = Arc::new(DownloadManager::new(None, storage_dir));

        Self {
            config: Arc::new(RwLock::new(config)),
            start_time: Instant::now(),
            database: None,
            search_service: Arc::new(AcademicSearchService::new()),
            crawl_engine: Arc::new(CrawlEngine::new()),
            download_manager,
            ai_provider_service: Arc::new(crate::services::AiProviderService::new()),
        }
    }
}

impl AppState {
    pub fn new(config: AppConfig, database: Option<Arc<Database>>) -> Self {
        let storage_dir = config.default_library_dir.clone();
        let download_manager = Arc::new(DownloadManager::new(database.clone(), storage_dir));
        let _ = download_manager.recover_interrupted_jobs();

        Self {
            config: Arc::new(RwLock::new(config)),
            start_time: Instant::now(),
            database,
            search_service: Arc::new(AcademicSearchService::new()),
            crawl_engine: Arc::new(CrawlEngine::new()),
            download_manager,
            ai_provider_service: Arc::new(crate::services::AiProviderService::new()),
        }
    }

    /// Returns elapsed uptime in seconds.
    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Returns a reference to the active Database or errors if not initialized.
    pub fn db(&self) -> Result<&Arc<Database>, AppError> {
        self.database
            .as_ref()
            .ok_or_else(|| AppError::Internal("Database is not initialized".to_string()))
    }
}
