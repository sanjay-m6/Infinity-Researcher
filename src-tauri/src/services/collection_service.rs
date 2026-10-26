use crate::database::Database;
use crate::domain::collection::{Collection, CollectionCreateInput, CollectionUpdateInput};
use crate::errors::AppError;
use crate::repositories::CollectionRepository;

pub struct CollectionService;

impl CollectionService {
    pub fn create_collection(
        db: &Database,
        input: CollectionCreateInput,
    ) -> Result<Collection, AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation(
                "Collection name cannot be blank.".to_string(),
            ));
        }
        if name.len() > 50 {
            return Err(AppError::Validation(
                "Collection name must be 50 characters or less.".to_string(),
            ));
        }

        let conn = db.lock()?;

        // Check for duplicate name (case-insensitive)
        if CollectionRepository::get_by_name(&conn, name)
            .map_err(|e| AppError::Internal(format!("Database error checking duplicate: {}", e)))?
            .is_some()
        {
            return Err(AppError::Validation(format!(
                "A collection named \"{}\" already exists.",
                name
            )));
        }

        let collection = Collection {
            id: uuid::Uuid::new_v4().to_string(),
            parent_id: input.parent_id,
            name: name.to_string(),
            description: input.description.map(|d| d.trim().to_string()),
            color_hex: input.color_hex.unwrap_or_else(|| "#6366f1".to_string()),
            paper_count: 0,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        CollectionRepository::create(&conn, &collection)
            .map_err(|e| AppError::Internal(format!("Failed to create collection: {}", e)))?;

        Ok(collection)
    }

    pub fn list_collections(db: &Database) -> Result<Vec<Collection>, AppError> {
        let conn = db.lock()?;
        CollectionRepository::list(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to list collections: {}", e)))
    }

    pub fn get_collection(db: &Database, id: &str) -> Result<Option<Collection>, AppError> {
        let conn = db.lock()?;
        CollectionRepository::get_by_id(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to get collection: {}", e)))
    }

    pub fn update_collection(
        db: &Database,
        input: CollectionUpdateInput,
    ) -> Result<bool, AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation(
                "Collection name cannot be blank.".to_string(),
            ));
        }

        let conn = db.lock()?;

        // Check duplicate if name is changing
        if let Some(existing) = CollectionRepository::get_by_name(&conn, name)
            .map_err(|e| AppError::Internal(format!("Database error checking duplicate: {}", e)))?
        {
            if existing.id != input.id {
                return Err(AppError::Validation(format!(
                    "Another collection is already named \"{}\".",
                    name
                )));
            }
        }

        CollectionRepository::update(
            &conn,
            &input.id,
            name,
            input.description.as_deref(),
            &input.color_hex.unwrap_or_else(|| "#6366f1".to_string()),
        )
        .map_err(|e| AppError::Internal(format!("Failed to update collection: {}", e)))
    }

    pub fn delete_collection(db: &Database, id: &str) -> Result<bool, AppError> {
        let conn = db.lock()?;
        CollectionRepository::delete(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to delete collection: {}", e)))
    }

    pub fn add_paper_to_collection(
        db: &Database,
        collection_id: &str,
        paper_id: &str,
    ) -> Result<(), AppError> {
        let conn = db.lock()?;
        CollectionRepository::add_paper(&conn, collection_id, paper_id)
            .map_err(|e| AppError::Internal(format!("Failed to add paper to collection: {}", e)))
    }

    pub fn remove_paper_from_collection(
        db: &Database,
        collection_id: &str,
        paper_id: &str,
    ) -> Result<bool, AppError> {
        let conn = db.lock()?;
        CollectionRepository::remove_paper(&conn, collection_id, paper_id).map_err(|e| {
            AppError::Internal(format!("Failed to remove paper from collection: {}", e))
        })
    }

    pub fn bulk_add_papers(
        db: &Database,
        collection_id: &str,
        paper_ids: &[String],
    ) -> Result<usize, AppError> {
        let conn = db.lock()?;
        CollectionRepository::bulk_add_papers(&conn, collection_id, paper_ids).map_err(|e| {
            AppError::Internal(format!("Failed to bulk add papers to collection: {}", e))
        })
    }

    pub fn bulk_remove_papers(
        db: &Database,
        collection_id: &str,
        paper_ids: &[String],
    ) -> Result<usize, AppError> {
        let conn = db.lock()?;
        CollectionRepository::bulk_remove_papers(&conn, collection_id, paper_ids).map_err(|e| {
            AppError::Internal(format!(
                "Failed to bulk remove papers from collection: {}",
                e
            ))
        })
    }
}
