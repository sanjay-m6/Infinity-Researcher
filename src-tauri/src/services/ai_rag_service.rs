use lopdf::Document;
use regex::Regex;
use std::path::Path;
use tracing::{info, warn};

use crate::database::Database;
use crate::domain::ai::*;
use crate::errors::AppError;
use crate::repositories::AiRepository;

pub struct AiRagService;

impl AiRagService {
    /// Max length per chunk in characters (~300 tokens)
    pub const CHUNK_SIZE_CHARS: usize = 1200;
    /// Overlap between sequential chunks
    pub const CHUNK_OVERLAP_CHARS: usize = 150;

    /// Indexes a paper PDF file into searchable chunks with page and section attribution.
    pub fn index_paper_pdf(
        db: &Database,
        paper_id: &str,
        pdf_path: &Path,
    ) -> Result<usize, AppError> {
        if !pdf_path.exists() {
            return Err(AppError::Storage(format!(
                "PDF file not found at path: {}",
                pdf_path.display()
            )));
        }

        let doc = Document::load(pdf_path)
            .map_err(|e| AppError::Internal(format!("Failed to load PDF for indexing: {}", e)))?;

        if doc.is_encrypted() {
            return Err(AppError::Validation(
                "PDF is encrypted or password-protected and cannot be indexed for RAG".into(),
            ));
        }

        let pages = doc.get_pages();
        let total_pages = pages.len();
        let mut all_chunks: Vec<AiPaperChunk> = Vec::new();
        let mut global_chunk_idx: i64 = 0;
        let mut current_heading: Option<String> = None;

        let heading_re = Regex::new(
            r"(?i)^(abstract|introduction|related work|background|methodology|proposed method|architecture|experiments|results|discussion|conclusion|limitations|references|acknowledgements|\d+(\.\d+)*\s+[A-Z][A-Za-z0-9\s]+)$"
        ).unwrap();

        for page_num in 1..=total_pages as u32 {
            let page_text = match doc.extract_text(&[page_num]) {
                Ok(t) => t,
                Err(e) => {
                    warn!(page = page_num, error = %e, "Could not extract text from page");
                    continue;
                }
            };

            let trimmed = page_text.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Detect section headings from lines
            for line in trimmed.lines() {
                let l_trim = line.trim();
                if l_trim.len() > 3 && l_trim.len() < 80 && heading_re.is_match(l_trim) {
                    current_heading = Some(l_trim.to_string());
                }
            }

            // Split into semantic chunks by paragraphs / sentence boundaries
            let page_chunks = Self::chunk_text(
                paper_id,
                page_num as i64,
                current_heading.as_deref(),
                trimmed,
                &mut global_chunk_idx,
            );
            all_chunks.extend(page_chunks);
        }

        if all_chunks.is_empty() {
            return Err(AppError::Validation(
                "No extractable text found in this PDF (it may be scanned or image-only)".into(),
            ));
        }

        let count = all_chunks.len();
        let conn = db.lock()?;
        AiRepository::delete_chunks_for_paper(&conn, paper_id)
            .map_err(|e| AppError::Database(e.to_string()))?;
        AiRepository::insert_chunks(&conn, &all_chunks)
            .map_err(|e| AppError::Database(e.to_string()))?;

        info!(paper_id = %paper_id, chunks = count, "Successfully indexed paper PDF for RAG");
        Ok(count)
    }

    /// Indexes plain text (e.g. from scrape or abstract) when full PDF is not yet downloaded
    pub fn index_paper_text(
        db: &Database,
        paper_id: &str,
        title: &str,
        abstract_text: Option<&str>,
        full_text: Option<&str>,
    ) -> Result<usize, AppError> {
        let mut chunks: Vec<AiPaperChunk> = Vec::new();
        let mut chunk_idx: i64 = 0;

        if let Some(abs) = abstract_text {
            let trimmed = abs.trim();
            if !trimmed.is_empty() {
                let c = Self::chunk_text(paper_id, 1, Some("Abstract"), trimmed, &mut chunk_idx);
                chunks.extend(c);
            }
        }

        if let Some(ft) = full_text {
            let trimmed = ft.trim();
            if !trimmed.is_empty() {
                let c =
                    Self::chunk_text(paper_id, 1, Some("Document Text"), trimmed, &mut chunk_idx);
                chunks.extend(c);
            }
        }

        if chunks.is_empty() {
            // Index at least the title
            chunks.push(AiPaperChunk {
                id: format!("{}_title", paper_id),
                paper_id: paper_id.to_string(),
                chunk_index: 0,
                page_number: 1,
                section_heading: Some("Title".into()),
                content_text: title.to_string(),
                token_count: (title.len() / 4).max(1) as i64,
                embedding_json: None,
                created_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        let count = chunks.len();
        let conn = db.lock()?;
        AiRepository::delete_chunks_for_paper(&conn, paper_id)
            .map_err(|e| AppError::Database(e.to_string()))?;
        AiRepository::insert_chunks(&conn, &chunks)
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(count)
    }

    fn chunk_text(
        paper_id: &str,
        page_number: i64,
        section_heading: Option<&str>,
        text: &str,
        global_idx: &mut i64,
    ) -> Vec<AiPaperChunk> {
        let mut chunks = Vec::new();
        let chars: Vec<char> = text.chars().collect();
        let len = chars.len();

        let mut start = 0;
        while start < len {
            let end = (start + Self::CHUNK_SIZE_CHARS).min(len);
            let snippet: String = chars[start..end].iter().collect();
            let token_count = (snippet.len() / 4).max(1) as i64;

            let chunk_id = format!("{}_p{}_c{}", paper_id, page_number, *global_idx);
            chunks.push(AiPaperChunk {
                id: chunk_id,
                paper_id: paper_id.to_string(),
                chunk_index: *global_idx,
                page_number,
                section_heading: section_heading.map(|s| s.to_string()),
                content_text: snippet,
                token_count,
                embedding_json: None,
                created_at: chrono::Utc::now().to_rfc3339(),
            });

            *global_idx += 1;

            if end >= len {
                break;
            }
            start = end.saturating_sub(Self::CHUNK_OVERLAP_CHARS);
        }

        chunks
    }

    /// Hybrid search retrieving passages matching the query with exact page numbers.
    pub fn retrieve_context(
        db: &Database,
        query: &str,
        paper_id: Option<&str>,
        scope: &str,
        limit: usize,
    ) -> Result<AiRagContext, AppError> {
        if scope == "none" {
            return Ok(AiRagContext {
                query: query.to_string(),
                scope: "none".into(),
                paper_id: paper_id.map(String::from),
                passages: Vec::new(),
                warnings: vec!["No retrieval requested (general model response).".into()],
                is_grounded: false,
            });
        }

        let pid_filter = match scope {
            "paper" => paper_id,
            "library" => None,
            _ => paper_id,
        };

        let conn = db.lock()?;
        let results = AiRepository::search_chunks(&conn, query, pid_filter, limit)
            .map_err(|e| AppError::Database(e.to_string()))?;

        if results.is_empty() {
            return Ok(AiRagContext {
                query: query.to_string(),
                scope: scope.to_string(),
                paper_id: paper_id.map(String::from),
                passages: Vec::new(),
                warnings: vec!["No relevant evidence found in the indexed paper(s).".into()],
                is_grounded: false,
            });
        }

        Ok(AiRagContext {
            query: query.to_string(),
            scope: scope.to_string(),
            paper_id: paper_id.map(String::from),
            passages: results,
            warnings: Vec::new(),
            is_grounded: true,
        })
    }
}
