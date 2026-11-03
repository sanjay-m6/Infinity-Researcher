use crate::database::Database;
use crate::domain::saved_search::{
    SavedSearch, SavedSearchCreateInput, SavedSearchUpdateInput,
};
use crate::errors::AppError;
use crate::repositories::SavedSearchRepository;

pub struct SavedSearchService;

impl SavedSearchService {
    pub fn list_saved_searches(db: &Database) -> Result<Vec<SavedSearch>, AppError> {
        let conn = db.lock()?;
        SavedSearchRepository::list(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to list saved searches: {}", e)))
    }

    pub fn get_saved_search(db: &Database, id: &str) -> Result<Option<SavedSearch>, AppError> {
        let conn = db.lock()?;
        SavedSearchRepository::get_by_id(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to get saved search: {}", e)))
    }

    pub fn create_saved_search(
        db: &Database,
        input: SavedSearchCreateInput,
    ) -> Result<SavedSearch, AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation(
                "Saved search name cannot be empty.".to_string(),
            ));
        }

        let conn = db.lock()?;
        SavedSearchRepository::create(&conn, input)
            .map_err(|e| AppError::Internal(format!("Failed to create saved search: {}", e)))
    }

    pub fn update_saved_search(
        db: &Database,
        input: SavedSearchUpdateInput,
    ) -> Result<bool, AppError> {
        let conn = db.lock()?;
        SavedSearchRepository::update(&conn, input)
            .map_err(|e| AppError::Internal(format!("Failed to update saved search: {}", e)))
    }

    pub fn delete_saved_search(db: &Database, id: &str) -> Result<bool, AppError> {
        let conn = db.lock()?;
        SavedSearchRepository::delete(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to delete saved search: {}", e)))
    }

    pub fn touch_saved_search(db: &Database, id: &str) -> Result<bool, AppError> {
        let conn = db.lock()?;
        SavedSearchRepository::touch(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to touch saved search: {}", e)))
    }
}

