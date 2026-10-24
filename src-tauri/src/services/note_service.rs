use crate::database::Database;
use crate::domain::note::{Note, NoteSaveInput};
use crate::errors::AppError;
use crate::repositories::NoteRepository;

pub struct NoteService;

impl NoteService {
    pub fn get_notes_for_paper(db: &Database, paper_id: &str) -> Result<Vec<Note>, AppError> {
        let conn = db.lock()?;
        NoteRepository::get_by_paper_id(&conn, paper_id)
            .map_err(|e| AppError::Internal(format!("Failed to retrieve notes: {}", e)))
    }

    pub fn save_note(db: &Database, input: NoteSaveInput) -> Result<Note, AppError> {
        let content = input.content_markdown.trim();
        if content.is_empty() {
            return Err(AppError::Validation("Note content cannot be empty.".to_string()));
        }

        let now = chrono::Utc::now().to_rfc3339();
        let note = Note {
            id: input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            paper_id: input.paper_id,
            title: input.title.unwrap_or_else(|| "Research Notes".to_string()),
            content_markdown: content.to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        let conn = db.lock()?;
        NoteRepository::save(&conn, &note)
            .map_err(|e| AppError::Internal(format!("Failed to save note: {}", e)))?;

        Ok(note)
    }

    pub fn delete_note(db: &Database, id: &str) -> Result<bool, AppError> {
        let conn = db.lock()?;
        NoteRepository::delete(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to delete note: {}", e)))
    }
}
