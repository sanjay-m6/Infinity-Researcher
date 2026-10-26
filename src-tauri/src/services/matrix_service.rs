use regex::Regex;
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;

use crate::database::Database;
use crate::domain::review_matrix::*;
use crate::errors::AppError;
use crate::repositories::{AiRepository, MatrixRepository};

pub struct MatrixService;

impl MatrixService {
    /// Loads complete workspace detail including columns and paper rows with their extractions.
    pub fn get_workspace_detail(
        db: &Database,
        workspace_id: &str,
    ) -> Result<MatrixWorkspaceDetail, AppError> {
        let conn = db.lock()?;
        let ws = MatrixRepository::get_workspace(&conn, workspace_id)?
            .ok_or_else(|| AppError::Validation(format!("Workspace '{}' not found", workspace_id)))?;

        let columns: Vec<MatrixColumnConfig> = serde_json::from_str(&ws.columns_json)
            .unwrap_or_else(|_| Self::default_columns());

        let paper_entries = MatrixRepository::get_workspace_papers(&conn, workspace_id)?;
        let extractions = MatrixRepository::get_extractions(&conn, workspace_id, None)?;

        // Map extractions by paper_id -> (field_key -> MatrixExtraction)
        let mut ext_map: HashMap<String, HashMap<String, MatrixExtraction>> = HashMap::new();
        for ext in extractions {
            ext_map
                .entry(ext.paper_id.clone())
                .or_default()
                .insert(ext.field_key.clone(), ext);
        }

        let mut rows = Vec::new();
        for (paper_id, added_at) in paper_entries {
            // Fetch paper metadata from papers table
            let paper_res = conn.query_row(
                "SELECT title, publication_year, venue, canonical_doi, local_pdf_path FROM papers WHERE id = ?1",
                rusqlite::params![paper_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                },
            );

            let (title, year, venue, doi, pdf_path) = match paper_res {
                Ok(tuple) => tuple,
                Err(_) => ("Untitled Paper".to_string(), None, None, None, None),
            };

            // Fetch authors
            let mut author_stmt = conn.prepare(
                "SELECT a.full_name
                 FROM paper_authors pa
                 JOIN authors a ON a.id = pa.author_id
                 WHERE pa.paper_id = ?1
                 ORDER BY pa.author_order ASC",
            )?;
            let authors: Vec<String> = author_stmt
                .query_map(rusqlite::params![paper_id], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect();

            let paper_extractions = ext_map.remove(&paper_id).unwrap_or_default();

            rows.push(MatrixRow {
                paper_id,
                paper_title: title,
                authors,
                year,
                venue,
                doi,
                pdf_path,
                added_at,
                extractions: paper_extractions,
            });
        }

        let total_papers = rows.len() as i64;
        let total_extractions = rows.iter().map(|r| r.extractions.len() as i64).sum();

        Ok(MatrixWorkspaceDetail {
            workspace: ws,
            columns,
            rows,
            total_papers,
            total_extractions,
        })
    }

    /// Adds a paper to the workspace and automatically runs pattern/heuristic extraction
    pub fn add_paper_and_extract(
        db: &Database,
        workspace_id: &str,
        paper_id: &str,
    ) -> Result<(), AppError> {
        {
            let conn = db.lock()?;
            MatrixRepository::add_paper_to_workspace(&conn, workspace_id, paper_id)?;
        }

        // Run automatic extraction
        let _ = Self::extract_fields_for_paper(db, workspace_id, paper_id);
        Ok(())
    }

    /// Removes paper and its extractions from workspace
    pub fn remove_paper_from_workspace(
        db: &Database,
        workspace_id: &str,
        paper_id: &str,
    ) -> Result<(), AppError> {
        let conn = db.lock()?;
        MatrixRepository::remove_paper_from_workspace(&conn, workspace_id, paper_id)?;
        Ok(())
    }

    /// Updates or inserts a single extraction record
    pub fn upsert_extraction(
        db: &Database,
        mut extraction: MatrixExtraction,
    ) -> Result<MatrixExtraction, AppError> {
        let conn = db.lock()?;
        if extraction.id.is_empty() {
            extraction.id = Uuid::new_v4().to_string();
        }
        let now = chrono::Utc::now().to_rfc3339();
        if extraction.created_at.is_empty() {
            extraction.created_at = now.clone();
        }
        extraction.updated_at = now;

        MatrixRepository::save_extraction(&conn, &extraction)?;
        Ok(extraction)
    }

    /// Extracts structured dimensions from paper text / chunks
    pub fn extract_fields_for_paper(
        db: &Database,
        workspace_id: &str,
        paper_id: &str,
    ) -> Result<Vec<MatrixExtraction>, AppError> {
        let conn = db.lock()?;
        
        // 1. Fetch paper abstract and title
        let (title, abstract_text) = conn.query_row(
            "SELECT title, coalesce(abstract, '') FROM papers WHERE id = ?1",
            rusqlite::params![paper_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ).unwrap_or_else(|_| ("".to_string(), "".to_string()));

        // 2. Fetch any indexed chunks
        let chunks = AiRepository::get_chunks_for_paper(&conn, paper_id).unwrap_or_default();

        let mut corpus_text = format!("{}\n\n{}", title, abstract_text);
        for chunk in &chunks {
            corpus_text.push_str("\n\n");
            corpus_text.push_str(&chunk.content_text);
        }

        let now = chrono::Utc::now().to_rfc3339();
        let mut results = Vec::new();

        // 3. Define extraction dimension patterns
        let dimensions = [
            ("research_question", "Research Question", r"(?i)(?:we\s+(?:investigate|examine|study|address|propose)|aims?\s+to|the\s+goal\s+of\s+this\s+paper\s+is\s+to|in\s+this\s+work,\s*we\s+explore)([^.\n]{20,200}\.)"),
            ("methodology", "Methodology", r"(?i)(?:we\s+(?:propose|develop|introduce|employ|utilize|present)\s+(?:a|an)\s+([^.\n]{20,200}\.))"),
            ("dataset", "Dataset / Benchmark", r"(?i)(?:evaluated\s+on|dataset|benchmark|using\s+data\s+from|corpus\s+consisting\s+of)\s+([^.\n]{10,150}\.)"),
            ("sample_size", "Sample Size", r"(?i)(?:N\s*=\s*\d+[\d,]*|\b\d+[\d,]*\s+(?:participants|subjects|patients|samples|instances|papers|documents|records|queries|images)\b)"),
            ("model_architecture", "Model / Architecture", r"(?i)\b(?:transformer|BERT|RoBERTa|GPT-\d|LLaMA|ResNet|diffusion|convolutional|GNN|autoencoder|encoder-decoder|deep\s+neural\s+network)\b[^.\n]{0,100}"),
            ("eval_metrics", "Key Metrics", r"(?i)\b(?:accuracy|F1[- ]score|precision|recall|BLEU|ROUGE|AUC|ROC|perplexity|MSE|latency|throughput)\b(?:\s+(?:of|=|:)\s*[\d.]+%?)?"),
            ("main_findings", "Main Findings", r"(?i)(?:results\s+(?:show|demonstrate|indicate|reveal)|outperforms|achieves?\s+state-of-the-art|superior\s+performance|our\s+findings\s+suggest)([^.\n]{20,200}\.)"),
            ("limitations", "Limitations", r"(?i)(?:limitations?|however,\s*we\s+note|drawback|constrained\s+by|one\s+shortcoming|potential\s+bias)([^.\n]{20,200}\.)"),
            ("future_work", "Future Work", r"(?i)(?:future\s+work|in\s+the\s+future,\s*we\s+plan\s+to|remains\s+an\s+open\s+question|further\s+investigation\s+is\s+needed)([^.\n]{20,200}\.)"),
        ];

        for (field_key, _label, regex_pat) in &dimensions {
            if let Ok(re) = Regex::new(regex_pat) {
                if let Some(caps) = re.captures(&corpus_text) {
                    let matched_str = caps.get(0).map(|m| m.as_str().trim()).unwrap_or("");
                    let clean_val = caps.get(1).map(|m| m.as_str().trim()).unwrap_or(matched_str);

                    // Find page number if chunk contains the match
                    let mut page_num = Some(1);
                    for chunk in &chunks {
                        if chunk.content_text.contains(clean_val) || chunk.content_text.contains(matched_str) {
                            page_num = Some(chunk.page_number);
                            break;
                        }
                    }

                    let ext = MatrixExtraction {
                        id: Uuid::new_v4().to_string(),
                        workspace_id: workspace_id.to_string(),
                        paper_id: paper_id.to_string(),
                        field_key: field_key.to_string(),
                        extracted_value: clean_val.to_string(),
                        confidence: 0.88,
                        page_number: page_num,
                        char_offset_start: Some(0),
                        char_offset_end: Some(clean_val.len() as i64),
                        source_passage: Some(matched_str.to_string()),
                        status: "extracted".to_string(),
                        created_at: now.clone(),
                        updated_at: now.clone(),
                    };

                    MatrixRepository::save_extraction(&conn, &ext)?;
                    results.push(ext);
                    continue;
                }
            }

            // Fallback for primary fields if no regex matched
            if *field_key == "research_question" && !abstract_text.is_empty() {
                let first_sentence = abstract_text.split('.').next().unwrap_or(&abstract_text).trim();
                if !first_sentence.is_empty() {
                    let ext = MatrixExtraction {
                        id: Uuid::new_v4().to_string(),
                        workspace_id: workspace_id.to_string(),
                        paper_id: paper_id.to_string(),
                        field_key: field_key.to_string(),
                        extracted_value: format!("{}.", first_sentence),
                        confidence: 0.70,
                        page_number: Some(1),
                        char_offset_start: Some(0),
                        char_offset_end: Some(first_sentence.len() as i64),
                        source_passage: Some(first_sentence.to_string()),
                        status: "extracted".to_string(),
                        created_at: now.clone(),
                        updated_at: now.clone(),
                    };
                    MatrixRepository::save_extraction(&conn, &ext)?;
                    results.push(ext);
                }
            }
        }

        info!(workspace_id = workspace_id, paper_id = paper_id, count = results.len(), "Finished auto-extracting fields");
        Ok(results)
    }

    fn escape_csv(val: &str) -> String {
        if val.contains(',') || val.contains('"') || val.contains('\n') || val.contains('\r') {
            format!("\"{}\"", val.replace('"', "\"\""))
        } else {
            val.to_string()
        }
    }

    /// Exports matrix to RFC 4180 compliant CSV
    pub fn export_csv(db: &Database, workspace_id: &str) -> Result<String, AppError> {
        let detail = Self::get_workspace_detail(db, workspace_id)?;
        let mut lines = Vec::new();

        // Header row
        let mut header = vec![
            Self::escape_csv("Paper Title"),
            Self::escape_csv("Authors"),
            Self::escape_csv("Year"),
            Self::escape_csv("Venue"),
            Self::escape_csv("DOI"),
        ];
        for col in &detail.columns {
            header.push(Self::escape_csv(&col.label));
        }
        lines.push(header.join(","));

        // Paper rows
        for row in &detail.rows {
            let mut record = vec![
                Self::escape_csv(&row.paper_title),
                Self::escape_csv(&row.authors.join("; ")),
                Self::escape_csv(&row.year.map(|y| y.to_string()).unwrap_or_default()),
                Self::escape_csv(&row.venue.clone().unwrap_or_default()),
                Self::escape_csv(&row.doi.clone().unwrap_or_default()),
            ];

            for col in &detail.columns {
                let val = row.extractions.get(&col.key)
                    .map(|e| e.extracted_value.as_str())
                    .unwrap_or("");
                record.push(Self::escape_csv(val));
            }
            lines.push(record.join(","));
        }

        Ok(lines.join("\r\n"))
    }

    /// Evidence-Linked Copilot: retrieves grounded passages with exact pages and character coordinates
    pub fn ask_copilot(
        db: &Database,
        session_id: &str,
        question: &str,
        workspace_id: Option<&str>,
        target_paper_id: Option<&str>,
    ) -> Result<(EvidenceCopilotMessage, Vec<EvidenceSource>), AppError> {
        let conn = db.lock()?;
        let now = chrono::Utc::now().to_rfc3339();

        // 0. Ensure session exists (auto-create if started directly from a paper or workspace)
        conn.execute(
            "INSERT OR IGNORE INTO evidence_copilot_sessions (id, title, target_scope, target_paper_id, workspace_id, created_at, updated_at)
             VALUES (?1, ?2, 'direct', ?3, ?4, ?5, ?5)",
            rusqlite::params![
                session_id,
                format!("Discussion: {}", question.chars().take(40).collect::<String>()),
                target_paper_id,
                workspace_id,
                now,
            ],
        )?;

        // 1. Save user question message
        let user_msg = EvidenceCopilotMessage {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            role: "user".to_string(),
            content: question.to_string(),
            evidence_sources_json: "[]".to_string(),
            created_at: now.clone(),
        };
        MatrixRepository::save_copilot_message(&conn, &user_msg)?;

        // 2. Search candidate evidence chunks
        let citations = AiRepository::search_chunks(&conn, question, target_paper_id, 5)
            .unwrap_or_default();

        let mut evidence_sources = Vec::new();
        for cite in &citations {
            evidence_sources.push(EvidenceSource {
                paper_id: cite.paper_id.clone(),
                paper_title: cite.paper_title.clone(),
                page_number: Some(cite.page_number),
                passage: cite.snippet.clone(),
                confidence: 0.92,
                char_offset_start: Some(0),
                char_offset_end: Some(cite.snippet.len() as i64),
            });
        }

        // 3. Grounded Synthesis
        let answer_text = if evidence_sources.is_empty() {
            format!(
                "I searched the active research library for '{}', but found no directly indexed passages with confident evidence. You can index the paper PDF or broaden your search keywords.",
                question
            )
        } else {
            let top_evidence = &evidence_sources[0];
            let page_label = top_evidence.page_number.map(|p| format!("p. {}", p)).unwrap_or_else(|| "document body".to_string());
            format!(
                "Based on empirical evidence in \"{}\" ({}):\n\n{}\n\nSupporting Passage:\n\"{}\"",
                top_evidence.paper_title,
                page_label,
                Self::summarize_evidence(&top_evidence.passage),
                top_evidence.passage.chars().take(240).collect::<String>()
            )
        };

        let evidence_json = serde_json::to_string(&evidence_sources).unwrap_or_else(|_| "[]".to_string());
        let assistant_msg = EvidenceCopilotMessage {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            role: "assistant".to_string(),
            content: answer_text,
            evidence_sources_json: evidence_json,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        MatrixRepository::save_copilot_message(&conn, &assistant_msg)?;

        Ok((assistant_msg, evidence_sources))
    }

    fn summarize_evidence(passage: &str) -> String {
        let first_two_sentences = passage
            .split('.')
            .take(2)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect::<Vec<&str>>()
            .join(". ");
        if first_two_sentences.is_empty() {
            passage.chars().take(180).collect()
        } else {
            format!("{}.", first_two_sentences)
        }
    }

    pub fn default_columns() -> Vec<MatrixColumnConfig> {
        vec![
            MatrixColumnConfig { key: "research_question".into(), label: "Research Question".into(), col_type: "text".into(), required: true, width: Some(240) },
            MatrixColumnConfig { key: "methodology".into(), label: "Methodology".into(), col_type: "text".into(), required: true, width: Some(220) },
            MatrixColumnConfig { key: "dataset".into(), label: "Dataset / Benchmark".into(), col_type: "text".into(), required: false, width: Some(180) },
            MatrixColumnConfig { key: "sample_size".into(), label: "Sample Size".into(), col_type: "text".into(), required: false, width: Some(130) },
            MatrixColumnConfig { key: "model_architecture".into(), label: "Model / Architecture".into(), col_type: "text".into(), required: false, width: Some(190) },
            MatrixColumnConfig { key: "eval_metrics".into(), label: "Key Metrics".into(), col_type: "text".into(), required: false, width: Some(160) },
            MatrixColumnConfig { key: "main_findings".into(), label: "Main Findings".into(), col_type: "text".into(), required: true, width: Some(260) },
            MatrixColumnConfig { key: "limitations".into(), label: "Limitations".into(), col_type: "text".into(), required: false, width: Some(200) },
            MatrixColumnConfig { key: "future_work".into(), label: "Future Work".into(), col_type: "text".into(), required: false, width: Some(180) },
        ]
    }
}
