use crate::domain::export::{
    ExportFormat, ExportPreview, ExportRequest, ExportResult, ExportScope,
};
use crate::domain::paper::{Paper, PaperListQuery};
use crate::errors::AppError;
use crate::repositories::PaperRepository;
use rusqlite::Connection;
use std::collections::HashSet;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

pub struct ExportService;

impl ExportService {
    /// Previews record count and missing bibliographic field warnings for a chosen scope.
    pub fn prepare_preview(
        conn: &Connection,
        scope: ExportScope,
        paper_ids: Option<&[String]>,
        collection_id: Option<&str>,
        query: Option<&PaperListQuery>,
        format: ExportFormat,
    ) -> Result<ExportPreview, AppError> {
        let papers = Self::resolve_papers_for_scope(conn, scope, paper_ids, collection_id, query)?;

        let mut missing_doi_count = 0;
        let mut missing_authors_count = 0;
        let mut missing_year_count = 0;
        let mut missing_abstract_count = 0;

        for p in &papers {
            if p.canonical_doi.as_deref().unwrap_or("").trim().is_empty() {
                missing_doi_count += 1;
            }
            if p.authors.is_empty() {
                missing_authors_count += 1;
            }
            if p.publication_year.is_none() {
                missing_year_count += 1;
            }
            if p.abstract_text.as_deref().unwrap_or("").trim().is_empty() {
                missing_abstract_count += 1;
            }
        }

        let date_str = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let target_filename = format!("library_export_{}.{}", date_str, format.extension());

        Ok(ExportPreview {
            format: format.extension().to_string(),
            scope: match scope {
                ExportScope::Selected => "selected".to_string(),
                ExportScope::Filtered => "filtered".to_string(),
                ExportScope::Collection => "collection".to_string(),
                ExportScope::All => "all".to_string(),
            },
            total_records: papers.len(),
            missing_doi_count,
            missing_authors_count,
            missing_year_count,
            missing_abstract_count,
            target_filename,
        })
    }

    /// Serializes papers to the chosen format and writes output atomically to disk.
    pub fn execute_export(
        conn: &Connection,
        request: &ExportRequest,
    ) -> Result<ExportResult, AppError> {
        let format: ExportFormat = request.format.parse().map_err(AppError::Validation)?;
        let scope: ExportScope = request.scope.parse().map_err(AppError::Validation)?;

        let papers = Self::resolve_papers_for_scope(
            conn,
            scope,
            request.paper_ids.as_deref(),
            request.collection_id.as_deref(),
            request.query.as_ref(),
        )?;

        // Serialize into chosen format
        let serialized_content = match format {
            ExportFormat::Bibtex => Self::serialize_bibtex(&papers),
            ExportFormat::Ris => Self::serialize_ris(&papers),
            ExportFormat::Csv => Self::serialize_csv(&papers),
            ExportFormat::Json => Self::serialize_json(&papers)?,
        };

        let dest_path = PathBuf::from(&request.destination_path);

        // Ensure target directory exists
        if let Some(parent) = dest_path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    AppError::Internal(format!("Failed to create export directory: {}", e))
                })?;
            }
        }

        // Atomic write: write to temporary file first, then rename
        let temp_path = dest_path.with_extension(format!("tmp_{}", uuid::Uuid::new_v4()));
        {
            let mut file = File::create(&temp_path).map_err(|e| {
                AppError::Internal(format!("Failed to create temporary export file: {}", e))
            })?;
            file.write_all(serialized_content.as_bytes()).map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                AppError::Internal(format!("Failed to write export content: {}", e))
            })?;
            file.sync_all().map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                AppError::Internal(format!("Failed to sync export file to disk: {}", e))
            })?;
        }

        // Rename temp file to target destination atomically
        std::fs::rename(&temp_path, &dest_path).map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            AppError::Internal(format!("Failed to complete atomic export write: {}", e))
        })?;

        let metadata = std::fs::metadata(&dest_path).map_err(|e| {
            AppError::Internal(format!("Failed to read exported file metadata: {}", e))
        })?;

        Ok(ExportResult {
            success: true,
            format: format.extension().to_string(),
            output_path: dest_path.to_string_lossy().to_string(),
            exported_count: papers.len(),
            file_size_bytes: metadata.len(),
            error_message: None,
        })
    }

    /// Resolves canonical papers from database matching the requested export scope.
    fn resolve_papers_for_scope(
        conn: &Connection,
        scope: ExportScope,
        paper_ids: Option<&[String]>,
        collection_id: Option<&str>,
        query: Option<&PaperListQuery>,
    ) -> Result<Vec<Paper>, AppError> {
        match scope {
            ExportScope::Selected => {
                let ids = paper_ids.unwrap_or(&[]);
                let mut papers = Vec::new();
                let mut seen = HashSet::new();

                for id in ids {
                    if seen.insert(id.clone()) {
                        if let Some(paper) = PaperRepository::get_by_id(conn, id).map_err(|e| {
                            AppError::Internal(format!("Failed to fetch paper {}: {}", id, e))
                        })? {
                            papers.push(paper);
                        }
                    }
                }
                Ok(papers)
            }
            ExportScope::Collection => {
                let col_id = collection_id.ok_or_else(|| {
                    AppError::Validation(
                        "Collection ID is required for collection export scope".to_string(),
                    )
                })?;

                let q = PaperListQuery {
                    collection_id: Some(col_id.to_string()),
                    is_saved_only: Some(true),
                    page_size: Some(1000),
                    ..Default::default()
                };

                let paged = PaperRepository::list(conn, &q).map_err(|e| {
                    AppError::Internal(format!("Failed to query collection papers: {}", e))
                })?;
                Ok(paged.items)
            }
            ExportScope::Filtered => {
                let default_query = PaperListQuery {
                    is_saved_only: Some(true),
                    page_size: Some(1000),
                    ..Default::default()
                };
                let q = query.unwrap_or(&default_query);
                let mut effective_query = q.clone();
                effective_query.page_size = Some(1000);

                let paged = PaperRepository::list(conn, &effective_query).map_err(|e| {
                    AppError::Internal(format!("Failed to query filtered papers: {}", e))
                })?;
                Ok(paged.items)
            }
            ExportScope::All => {
                let q = PaperListQuery {
                    is_saved_only: Some(true),
                    page_size: Some(5000),
                    ..Default::default()
                };
                let paged = PaperRepository::list(conn, &q).map_err(|e| {
                    AppError::Internal(format!("Failed to query library papers: {}", e))
                })?;
                Ok(paged.items)
            }
        }
    }

    /// Serializes papers to BibTeX with deterministic keys and character escaping.
    pub fn serialize_bibtex(papers: &[Paper]) -> String {
        let mut out = String::new();
        let mut used_keys = HashSet::new();

        for paper in papers {
            // Determine entry type
            let entry_type = match paper
                .venue_type
                .as_deref()
                .unwrap_or("")
                .to_lowercase()
                .as_str()
            {
                "journal" => "article",
                "conference" | "inproceedings" => "inproceedings",
                "book" => "book",
                _ => "misc",
            };

            // Generate deterministic citation key: AuthorYearTitleToken
            let author_token = paper
                .authors
                .first()
                .map(|a| {
                    a.family_name
                        .as_deref()
                        .or_else(|| a.full_name.split_whitespace().last())
                        .unwrap_or("author")
                        .to_lowercase()
                })
                .unwrap_or_else(|| "paper".to_string());

            let year_token = paper
                .publication_year
                .map(|y| y.to_string())
                .unwrap_or_else(|| "nd".to_string());

            let title_token = paper.clean_title_key.chars().take(8).collect::<String>();

            let base_key = format!("{}{}{}", author_token, year_token, title_token);
            let mut citation_key = base_key.clone();
            let mut suffix_char = b'a';

            while used_keys.contains(&citation_key) {
                citation_key = format!("{}{}", base_key, suffix_char as char);
                suffix_char += 1;
            }
            used_keys.insert(citation_key.clone());

            out.push_str(&format!("@{}{{{},\n", entry_type, citation_key));
            out.push_str(&format!(
                "  title = {{{}}},\n",
                Self::escape_bibtex(&paper.title)
            ));

            if !paper.authors.is_empty() {
                let authors_str = paper
                    .authors
                    .iter()
                    .map(|a| Self::escape_bibtex(&a.full_name))
                    .collect::<Vec<_>>()
                    .join(" and ");
                out.push_str(&format!("  author = {{{}}},\n", authors_str));
            }

            if let Some(year) = paper.publication_year {
                out.push_str(&format!("  year = {{{}}},\n", year));
            }

            if let Some(ref venue) = paper.venue {
                if !venue.trim().is_empty() {
                    let field_name = if entry_type == "article" {
                        "journal"
                    } else {
                        "booktitle"
                    };
                    out.push_str(&format!(
                        "  {} = {{{}}},\n",
                        field_name,
                        Self::escape_bibtex(venue)
                    ));
                }
            }

            if let Some(ref doi) = paper.canonical_doi {
                if !doi.trim().is_empty() {
                    out.push_str(&format!("  doi = {{{}}},\n", Self::escape_bibtex(doi)));
                }
            }

            if let Some(ref url) = paper.primary_landing_url {
                if !url.trim().is_empty() {
                    out.push_str(&format!("  url = {{{}}},\n", url));
                }
            }

            if let Some(ref abs) = paper.abstract_text {
                if !abs.trim().is_empty() {
                    out.push_str(&format!("  abstract = {{{}}},\n", Self::escape_bibtex(abs)));
                }
            }

            out.push_str("}\n\n");
        }

        out
    }

    /// Escapes special characters reserved by BibTeX.
    pub fn escape_bibtex(text: &str) -> String {
        let mut escaped = String::with_capacity(text.len());
        for c in text.chars() {
            match c {
                '{' => escaped.push_str("\\{"),
                '}' => escaped.push_str("\\}"),
                '%' => escaped.push_str("\\%"),
                '&' => escaped.push_str("\\&"),
                '_' => escaped.push_str("\\_"),
                '#' => escaped.push_str("\\#"),
                '$' => escaped.push_str("\\$"),
                '~' => escaped.push_str("\\textasciitilde{}"),
                '^' => escaped.push_str("\\textasciicircum{}"),
                '\\' => escaped.push_str("\\textbackslash{}"),
                other => escaped.push(other),
            }
        }
        escaped
    }

    /// Serializes papers to standard RIS format.
    pub fn serialize_ris(papers: &[Paper]) -> String {
        let mut out = String::new();

        for paper in papers {
            let ty = match paper
                .venue_type
                .as_deref()
                .unwrap_or("")
                .to_lowercase()
                .as_str()
            {
                "journal" => "JOUR",
                "conference" | "inproceedings" => "CONF",
                "book" => "BOOK",
                _ => "GEN",
            };

            out.push_str(&format!("TY  - {}\n", ty));
            out.push_str(&format!("TI  - {}\n", paper.title.replace('\n', " ")));

            for author in &paper.authors {
                out.push_str(&format!("AU  - {}\n", author.full_name.replace('\n', " ")));
            }

            if let Some(year) = paper.publication_year {
                out.push_str(&format!("PY  - {}///\n", year));
            }

            if let Some(ref venue) = paper.venue {
                if !venue.trim().is_empty() {
                    out.push_str(&format!("JO  - {}\n", venue.replace('\n', " ")));
                }
            }

            if let Some(ref doi) = paper.canonical_doi {
                if !doi.trim().is_empty() {
                    out.push_str(&format!("DO  - {}\n", doi.trim()));
                }
            }

            if let Some(ref url) = paper.primary_landing_url {
                if !url.trim().is_empty() {
                    out.push_str(&format!("UR  - {}\n", url.trim()));
                }
            }

            if let Some(ref abs) = paper.abstract_text {
                if !abs.trim().is_empty() {
                    out.push_str(&format!(
                        "AB  - {}\n",
                        abs.replace('\r', "").replace('\n', " ")
                    ));
                }
            }

            for tag in &paper.tags {
                out.push_str(&format!("KW  - {}\n", tag.replace('\n', " ")));
            }

            out.push_str("ER  - \n\n");
        }

        out
    }

    /// Serializes papers to RFC 4180 CSV with formula-injection defenses.
    pub fn serialize_csv(papers: &[Paper]) -> String {
        let mut out = String::new();
        // Standard header row
        out.push_str("\"ID\",\"Title\",\"Authors\",\"Publication Year\",\"Venue\",\"DOI\",\"URL\",\"Abstract\",\"Tags\",\"Reading Status\"\n");

        for paper in papers {
            let authors_str = paper
                .authors
                .iter()
                .map(|a| a.full_name.as_str())
                .collect::<Vec<_>>()
                .join("; ");

            let tags_str = paper.tags.join("; ");
            let year_str = paper
                .publication_year
                .map(|y| y.to_string())
                .unwrap_or_default();

            let row = [
                Self::escape_csv_cell(&paper.id),
                Self::escape_csv_cell(&paper.title),
                Self::escape_csv_cell(&authors_str),
                Self::escape_csv_cell(&year_str),
                Self::escape_csv_cell(paper.venue.as_deref().unwrap_or("")),
                Self::escape_csv_cell(paper.canonical_doi.as_deref().unwrap_or("")),
                Self::escape_csv_cell(paper.primary_landing_url.as_deref().unwrap_or("")),
                Self::escape_csv_cell(paper.abstract_text.as_deref().unwrap_or("")),
                Self::escape_csv_cell(&tags_str),
                Self::escape_csv_cell(&paper.reading_status),
            ];

            out.push_str(&row.join(","));
            out.push('\n');
        }

        out
    }

    /// Escapes CSV cells per RFC 4180 and mitigates spreadsheet formula injection.
    pub fn escape_csv_cell(raw: &str) -> String {
        let mut text = raw.to_string();

        // Formula injection mitigation: If string (after trimming leading spaces/tabs)
        // starts with =, +, -, @, \t, or \r, prepend ' to neutralize formula execution in Excel/Calc.
        let trimmed_leading = text.trim_start();
        if let Some(first_char) = trimmed_leading.chars().next() {
            if matches!(first_char, '=' | '+' | '-' | '@' | '\t' | '\r') {
                text = format!("'{}", text);
            }
        }

        // RFC 4180 quoting: escape inner double-quotes by doubling them
        let escaped = text.replace('"', "\"\"");
        format!("\"{}\"", escaped)
    }

    /// Serializes papers into structured, versioned UTF-8 JSON.
    pub fn serialize_json(papers: &[Paper]) -> Result<String, AppError> {
        let payload = serde_json::json!({
            "schema_version": 1,
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "total_records": papers.len(),
            "papers": papers
        });

        serde_json::to_string_pretty(&payload)
            .map_err(|e| AppError::Internal(format!("Failed to serialize papers to JSON: {}", e)))
    }
}
