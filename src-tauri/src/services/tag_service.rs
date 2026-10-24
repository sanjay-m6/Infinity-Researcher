use crate::database::Database;
use crate::domain::tag::Tag;
use crate::errors::AppError;
use crate::repositories::TagRepository;

pub struct TagService;

impl TagService {
    pub fn list_tags(db: &Database) -> Result<Vec<Tag>, AppError> {
        let conn = db.lock()?;
        TagRepository::list(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to list tags: {}", e)))
    }

    pub fn assign_tag_to_paper(
        db: &Database,
        paper_id: &str,
        tag_name: &str,
    ) -> Result<Tag, AppError> {
        let trimmed = tag_name.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation("Tag name cannot be blank.".to_string()));
        }
        let conn = db.lock()?;
        let tag = TagRepository::create_or_get(&conn, trimmed, "#64748b")
            .map_err(|e| AppError::Internal(format!("Failed to create or retrieve tag: {}", e)))?;

        TagRepository::assign_tag(&conn, paper_id, &tag.id)
            .map_err(|e| AppError::Internal(format!("Failed to assign tag to paper: {}", e)))?;

        Ok(tag)
    }

    pub fn remove_tag_from_paper(
        db: &Database,
        paper_id: &str,
        tag_id: &str,
    ) -> Result<bool, AppError> {
        let conn = db.lock()?;
        TagRepository::remove_tag(&conn, paper_id, tag_id)
            .map_err(|e| AppError::Internal(format!("Failed to remove tag from paper: {}", e)))
    }
}
