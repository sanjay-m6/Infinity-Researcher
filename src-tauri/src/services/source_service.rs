use crate::database::Database;
use crate::domain::source::Source;
use crate::errors::AppError;
use crate::repositories::SourceRepository;

pub struct SourceService;

impl SourceService {
    pub fn list_sources(db: &Database) -> Result<Vec<Source>, AppError> {
        let conn = db.lock()?;
        SourceRepository::list(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to list sources: {}", e)))
    }

    pub fn get_source(db: &Database, id: &str) -> Result<Option<Source>, AppError> {
        let conn = db.lock()?;
        SourceRepository::get_by_id(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to retrieve source: {}", e)))
    }
}
