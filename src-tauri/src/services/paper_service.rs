use crate::database::Database;
use crate::domain::pagination::PagedResponse;
use crate::domain::paper::{
    compute_clean_title_key, normalize_doi, Author, Paper, PaperCreateInput, PaperListQuery,
    PaperUpdateInput,
};
use crate::errors::AppError;
use crate::repositories::PaperRepository;

pub struct PaperService;

impl PaperService {
    pub fn create_paper(db: &Database, input: PaperCreateInput) -> Result<Paper, AppError> {
        let title = input.title.trim();
        if title.is_empty() {
            return Err(AppError::Validation("Paper title cannot be blank.".to_string()));
        }

        let normalized_doi = input.canonical_doi.as_deref().and_then(normalize_doi);
        let clean_title = compute_clean_title_key(title);

        // Validation & Duplicate checks
        if let Some(year) = input.publication_year {
            if year < 1600 || year > 2100 {
                return Err(AppError::Validation(format!(
                    "Publication year {} is outside the valid range (1600-2100).",
                    year
                )));
            }
        }

        // Check duplicate by DOI
        if let Some(ref doi) = normalized_doi {
            let conn = db.lock()?;
            if let Some(existing) = PaperRepository::get_by_doi(&conn, doi)
                .map_err(|e| AppError::Internal(format!("Database error checking DOI: {}", e)))?
            {
                return Err(AppError::Validation(format!(
                    "A paper with DOI '{}' already exists in your library (\"{}\").",
                    doi, existing.title
                )));
            }
        }

        // Check duplicate by normalized clean title key
        {
            let conn = db.lock()?;
            if let Some(existing) = PaperRepository::get_by_clean_title(&conn, &clean_title)
                .map_err(|e| AppError::Internal(format!("Database error checking title: {}", e)))?
            {
                return Err(AppError::Validation(format!(
                    "A paper with an identical normalized title already exists in your library (\"{}\").",
                    existing.title
                )));
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        let paper_id = uuid::Uuid::new_v4().to_string();

        let authors: Vec<Author> = input
            .authors
            .into_iter()
            .enumerate()
            .map(|(idx, full_name)| Author {
                id: uuid::Uuid::new_v4().to_string(),
                full_name: full_name.trim().to_string(),
                family_name: None,
                given_name: None,
                orcid: None,
                affiliation: None,
                author_order: idx as i32,
                created_at: now.clone(),
            })
            .collect();

        let paper = Paper {
            id: paper_id,
            canonical_doi: normalized_doi,
            title: title.to_string(),
            clean_title_key: clean_title,
            abstract_text: input.abstract_text.map(|a| a.trim().to_string()),
            publication_date: input.publication_date,
            publication_year: input.publication_year,
            venue: input.venue.map(|v| v.trim().to_string()),
            venue_type: input.venue_type,
            language: input.language.unwrap_or_else(|| "en".to_string()),
            citation_count: 0,
            reference_count: 0,
            is_open_access: input.is_open_access.unwrap_or(false),
            license: None,
            primary_landing_url: input.primary_landing_url,
            pdf_url: input.pdf_url,
            has_file: false,
            local_pdf_path: None,
            content_hash: None,
            metadata_confidence: "verified".to_string(),
            is_saved: input.is_saved.unwrap_or(true),
            created_at: now.clone(),
            updated_at: now,
            authors,
            collection_ids: input.collection_ids.unwrap_or_default(),
            tags: input.tags.unwrap_or_default(),
            source_names: input.source_id.into_iter().collect(),
        };

        {
            let mut conn = db.lock()?;
            PaperRepository::create(&mut conn, &paper)
                .map_err(|e| AppError::Internal(format!("Failed to save paper to database: {}", e)))?;
        }

        Ok(paper)
    }

    pub fn get_paper(db: &Database, id: &str) -> Result<Option<Paper>, AppError> {
        let conn = db.lock()?;
        PaperRepository::get_by_id(&conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to get paper: {}", e)))
    }

    pub fn list_papers(db: &Database, query: PaperListQuery) -> Result<PagedResponse<Paper>, AppError> {
        let conn = db.lock()?;
        PaperRepository::list(&conn, &query)
            .map_err(|e| AppError::Internal(format!("Failed to query papers: {}", e)))
    }

    pub fn update_paper(db: &Database, input: PaperUpdateInput) -> Result<Paper, AppError> {
        let mut paper = Self::get_paper(db, &input.id)?
            .ok_or_else(|| AppError::Validation(format!("Paper not found with ID: {}", input.id)))?;

        if let Some(t) = input.title {
            let trimmed = t.trim();
            if trimmed.is_empty() {
                return Err(AppError::Validation("Paper title cannot be blank.".to_string()));
            }
            paper.title = trimmed.to_string();
            paper.clean_title_key = compute_clean_title_key(trimmed);
        }

        if let Some(doi) = input.canonical_doi {
            paper.canonical_doi = normalize_doi(&doi);
        }

        if let Some(a) = input.abstract_text {
            paper.abstract_text = Some(a.trim().to_string());
        }

        if let Some(v) = input.venue {
            paper.venue = Some(v.trim().to_string());
        }

        if let Some(oa) = input.is_open_access {
            paper.is_open_access = oa;
        }

        if let Some(saved) = input.is_saved {
            paper.is_saved = saved;
        }

        if let Some(url) = input.primary_landing_url {
            paper.primary_landing_url = Some(url);
        }

        if let Some(pdf) = input.pdf_url {
            paper.pdf_url = Some(pdf);
        }

        if let Some(c_ids) = input.collection_ids {
            paper.collection_ids = c_ids;
        }

        if let Some(t_names) = input.tags {
            paper.tags = t_names;
        }

        if let Some(author_names) = input.authors {
            let now = chrono::Utc::now().to_rfc3339();
            paper.authors = author_names
                .into_iter()
                .enumerate()
                .map(|(idx, full_name)| Author {
                    id: uuid::Uuid::new_v4().to_string(),
                    full_name: full_name.trim().to_string(),
                    family_name: None,
                    given_name: None,
                    orcid: None,
                    affiliation: None,
                    author_order: idx as i32,
                    created_at: now.clone(),
                })
                .collect();
        }

        paper.updated_at = chrono::Utc::now().to_rfc3339();

        {
            let mut conn = db.lock()?;
            PaperRepository::update(&mut conn, &paper)
                .map_err(|e| AppError::Internal(format!("Failed to update paper: {}", e)))?;
        }

        Ok(paper)
    }

    pub fn delete_paper(db: &Database, id: &str) -> Result<bool, AppError> {
        let mut conn = db.lock()?;
        PaperRepository::delete(&mut conn, id)
            .map_err(|e| AppError::Internal(format!("Failed to delete paper: {}", e)))
    }

    pub fn toggle_save_paper(db: &Database, id: &str, is_saved: bool) -> Result<bool, AppError> {
        let conn = db.lock()?;
        PaperRepository::set_saved(&conn, id, is_saved)
            .map_err(|e| AppError::Internal(format!("Failed to toggle saved status: {}", e)))
    }
}
