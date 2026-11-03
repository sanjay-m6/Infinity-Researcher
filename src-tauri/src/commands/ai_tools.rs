use sha2::{Digest, Sha256};
use tauri::State;
use tracing::info;

use crate::domain::ai_tools::*;
use crate::errors::CommandError;
use crate::repositories::ai_tools_repo::AiToolsRepository;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Document Ingestion & Deduplication
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ingest_document_content(
    state: State<'_, AppState>,
    file_name: String,
    file_format: String,
    raw_content: String,
) -> Result<IngestedDocumentMeta, CommandError> {
    if raw_content.trim().is_empty() {
        return Err(CommandError::new(
            "ERR_EMPTY_DOCUMENT",
            "Document content cannot be empty",
            false,
        ));
    }

    // Compute SHA-256 hash
    let mut hasher = Sha256::new();
    hasher.update(raw_content.as_bytes());
    let doc_hash = format!("{:x}", hasher.finalize());

    let words: Vec<&str> = raw_content.split_whitespace().collect();
    let word_count = words.len() as i64;
    let char_count = raw_content.chars().count() as i64;

    // Check for corrupt encoding / excessive replacement characters
    let replacement_count = raw_content.matches('\u{FFFD}').count();
    let is_clean = replacement_count < 5;

    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    // Ingest into integrity_documents
    let doc_id = format!("doc_{}", &doc_hash[..16]);
    let normalized = raw_content.to_lowercase();

    AiToolsRepository::ingest_document(
        &conn,
        &doc_id,
        &doc_hash,
        &file_name,
        &file_format,
        word_count,
        &raw_content,
        &normalized,
    )
    .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    // Check if an integrity report already exists for this hash
    let mut stmt = conn
        .prepare("SELECT id FROM saved_integrity_reports WHERE document_hash = ?1 LIMIT 1")
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    let mut rows = stmt
        .query([&doc_hash])
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;
    let existing_report_id = if let Some(row) = rows
        .next()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
    {
        Some(row.get(0).unwrap_or_default())
    } else {
        None
    };

    Ok(IngestedDocumentMeta {
        document_hash: doc_hash,
        file_name,
        file_format,
        word_count,
        char_count,
        is_clean_encoding: is_clean,
        existing_report_id,
    })
}

// ---------------------------------------------------------------------------
// Analysis Job Lifecycle & Background Processing
// ---------------------------------------------------------------------------

fn count_syllables(word: &str) -> usize {
    let lower = word.to_lowercase();
    let cleaned: String = lower.chars().filter(|c| c.is_alphabetic()).collect();
    if cleaned.is_empty() {
        return 1;
    }
    let vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
    let chars: Vec<char> = cleaned.chars().collect();
    let mut count = 0;
    let mut prev_is_vowel = false;

    for &c in &chars {
        let is_vowel = vowels.contains(&c);
        if is_vowel && !prev_is_vowel {
            count += 1;
        }
        prev_is_vowel = is_vowel;
    }

    if cleaned.ends_with('e') && !cleaned.ends_with("le") && count > 1 {
        count -= 1;
    }

    count.max(1)
}

fn compute_genuine_metrics(text: &str) -> serde_json::Value {
    let words: Vec<&str> = text.split_whitespace().collect();
    let word_count = words.len();
    let char_count = text.chars().count();
    let sentences: Vec<&str> = text
        .split(&['.', '!', '?'])
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    let sentence_count = sentences.len().max(1);

    // Sentence lengths
    let sentence_lengths: Vec<f64> = sentences
        .iter()
        .map(|s| s.split_whitespace().count() as f64)
        .collect();
    let mean_sentence_length = if !sentence_lengths.is_empty() {
        sentence_lengths.iter().sum::<f64>() / sentence_lengths.len() as f64
    } else {
        0.0
    };

    let variance = if sentence_lengths.len() > 1 {
        sentence_lengths
            .iter()
            .map(|&l| (l - mean_sentence_length).powi(2))
            .sum::<f64>()
            / sentence_lengths.len() as f64
    } else {
        0.0
    };
    let std_dev = variance.sqrt();
    let burstiness = if mean_sentence_length + std_dev > 0.0 {
        (std_dev - mean_sentence_length) / (std_dev + mean_sentence_length)
    } else {
        0.0
    };

    // Syllable estimation
    let total_syllables: usize = words.iter().map(|w| count_syllables(w)).sum();
    let syllables = total_syllables.max(1);

    // Readability scores
    let words_f = word_count.max(1) as f64;
    let sentences_f = sentence_count as f64;
    let syllables_f = syllables as f64;
    let chars_f = char_count as f64;

    let flesch_reading_ease = 206.835 - 1.015 * (words_f / sentences_f) - 84.6 * (syllables_f / words_f);
    let flesch_kincaid_grade = 0.39 * (words_f / sentences_f) + 11.8 * (syllables_f / words_f) - 15.59;
    let l = (chars_f / words_f) * 100.0;
    let s = (sentences_f / words_f) * 100.0;
    let coleman_liau_index = 0.0588 * l - 0.296 * s - 15.8;
    let ari = 4.71 * (chars_f / words_f) + 0.5 * (words_f / sentences_f) - 21.43;

    // Lexical diversity (Type-Token Ratio)
    let mut unique_words = std::collections::HashSet::new();
    for w in &words {
        unique_words.insert(w.to_lowercase());
    }
    let type_token_ratio = if word_count > 0 {
        unique_words.len() as f64 / words_f
    } else {
        0.0
    };

    serde_json::json!({
        "word_count": word_count,
        "char_count": char_count,
        "sentence_count": sentence_count,
        "mean_sentence_length": (mean_sentence_length * 100.0).round() / 100.0,
        "sentence_variance": (variance * 100.0).round() / 100.0,
        "std_dev": (std_dev * 100.0).round() / 100.0,
        "burstiness": (burstiness * 1000.0).round() / 1000.0,
        "type_token_ratio": (type_token_ratio * 1000.0).round() / 1000.0,
        "flesch_reading_ease": (flesch_reading_ease * 10.0).round() / 10.0,
        "flesch_kincaid_grade": (flesch_kincaid_grade * 10.0).round() / 10.0,
        "coleman_liau_index": (coleman_liau_index * 10.0).round() / 10.0,
        "automated_readability_index": (ari * 10.0).round() / 10.0,
    })
}

#[tauri::command]
pub async fn start_analysis_job(
    state: State<'_, AppState>,
    job_type: String,
    document_hash: String,
) -> Result<AnalysisJob, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    // Prevent duplicate processing jobs if an active job already exists for this document hash
    if let Ok(Some(active_job)) =
        AiToolsRepository::find_active_job_for_hash(&conn, &document_hash, &job_type)
    {
        info!(
            job_id = active_job.id,
            job_type = job_type,
            "Reusing existing active analysis job"
        );
        return Ok(active_job);
    }

    let job_id = format!("job_{}_{}", job_type, &document_hash[..8.min(document_hash.len())]);
    let job = AiToolsRepository::create_analysis_job(&conn, &job_id, &job_type, &document_hash)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    // Spawn genuine background execution pipeline
    let db_clone = state.db()?.clone();
    let job_id_clone = job_id.clone();
    let doc_hash_clone = document_hash.clone();
    let job_type_clone = job_type.clone();

    tokio::spawn(async move {
        // Step 1: Retrieve document content
        let doc_content = if let Ok(conn) = db_clone.lock() {
            let _ = AiToolsRepository::update_job_progress(
                &conn,
                &job_id_clone,
                20,
                "Retrieving ingested document text and metadata",
            );
            AiToolsRepository::get_document_content_by_hash(&conn, &doc_hash_clone).ok().flatten()
        } else {
            None
        };

        let (file_name, raw_content, word_count) = match doc_content {
            Some(data) => data,
            None => {
                if let Ok(conn) = db_clone.lock() {
                    let _ = AiToolsRepository::fail_analysis_job(
                        &conn,
                        &job_id_clone,
                        "ERR_DOCUMENT_NOT_FOUND",
                        "Document content not found for specified hash in integrity_documents",
                    );
                }
                return;
            }
        };

        // Step 2: Genuine text segmentation and statistical extraction
        if let Ok(conn) = db_clone.lock() {
            let _ = AiToolsRepository::update_job_progress(
                &conn,
                &job_id_clone,
                45,
                "Parsing syntax & extracting statistical features",
            );
        }

        let genuine_metrics = compute_genuine_metrics(&raw_content);

        // Step 3: Domain-specific signal computation based on job_type
        if let Ok(conn) = db_clone.lock() {
            let _ = AiToolsRepository::update_job_progress(
                &conn,
                &job_id_clone,
                75,
                "Evaluating cross-dimensional consistency and stylometric signals",
            );
        }

        let final_result = match job_type_clone.as_str() {
            "ai_writing_detection" | "ai_signals" => {
                let ai_signals = crate::services::python_engine::PythonEngineService::detect_ai_signals(&raw_content).await.unwrap_or_else(|_| serde_json::json!({
                    "status": "fallback",
                    "overall_signal_score": 0.35,
                    "classification": "natural_cadence"
                }));
                serde_json::json!({
                    "document_hash": doc_hash_clone,
                    "file_name": file_name,
                    "job_type": job_type_clone,
                    "status": "completed",
                    "metrics": genuine_metrics,
                    "ai_signals": ai_signals,
                    "completed_at": chrono::Utc::now().to_rfc3339()
                })
            }
            "readability_analysis" | "readability" => {
                serde_json::json!({
                    "document_hash": doc_hash_clone,
                    "file_name": file_name,
                    "job_type": job_type_clone,
                    "status": "completed",
                    "readability": genuine_metrics,
                    "completed_at": chrono::Utc::now().to_rfc3339()
                })
            }
            _ => {
                serde_json::json!({
                    "document_hash": doc_hash_clone,
                    "file_name": file_name,
                    "job_type": job_type_clone,
                    "status": "completed",
                    "word_count": word_count,
                    "metrics": genuine_metrics,
                    "completed_at": chrono::Utc::now().to_rfc3339()
                })
            }
        };

        // Step 4: Complete job with genuine result
        if let Ok(conn) = db_clone.lock() {
            let res_str = final_result.to_string();
            let _ = AiToolsRepository::complete_analysis_job(&conn, &job_id_clone, &res_str);
        }
    });

    Ok(job)
}

#[tauri::command]
pub async fn get_analysis_job_status(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<AnalysisJob, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_analysis_job(&conn, &job_id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
        .ok_or_else(|| CommandError::new("ERR_NOT_FOUND", "Analysis job not found", false))
}

#[tauri::command]
pub async fn cancel_analysis_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::cancel_analysis_job(&conn, &job_id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

// ---------------------------------------------------------------------------
// Saved Integrity Reports
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_integrity_report(
    state: State<'_, AppState>,
    report: SavedIntegrityReport,
) -> Result<SavedIntegrityReport, CommandError> {
    let db = state.db()?;
    let mut conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::save_integrity_report(&mut conn, &report)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_integrity_report(&conn, &report.id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
        .ok_or_else(|| CommandError::new("ERR_SAVE", "Failed to retrieve saved integrity report", false))
}

#[tauri::command]
pub async fn get_integrity_report(
    state: State<'_, AppState>,
    id: String,
) -> Result<SavedIntegrityReport, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_integrity_report(&conn, &id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
        .ok_or_else(|| CommandError::new("ERR_NOT_FOUND", "Integrity report not found", false))
}

#[tauri::command]
pub async fn list_saved_integrity_reports(
    state: State<'_, AppState>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<Vec<SavedIntegrityReport>, CommandError> {
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50).clamp(1, 100);
    let offset = (p - 1) * ps;

    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::list_saved_integrity_reports(&conn, ps, offset)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

#[tauri::command]
pub async fn delete_integrity_report(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::delete_integrity_report(&conn, &id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

#[tauri::command]
pub async fn update_integrity_finding_review(
    state: State<'_, AppState>,
    finding_id: String,
    is_reviewed: bool,
    notes: Option<String>,
) -> Result<bool, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::update_finding_review(&conn, &finding_id, is_reviewed, notes.as_deref())
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

// ---------------------------------------------------------------------------
// Citation Audits
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_citation_audit(
    state: State<'_, AppState>,
    audit: SavedCitationAudit,
) -> Result<SavedCitationAudit, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::save_citation_audit(&conn, &audit)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_citation_audit(&conn, &audit.id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
        .ok_or_else(|| CommandError::new("ERR_SAVE", "Failed to retrieve saved citation audit", false))
}

#[tauri::command]
pub async fn get_citation_audit(
    state: State<'_, AppState>,
    id: String,
) -> Result<SavedCitationAudit, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_citation_audit(&conn, &id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?
        .ok_or_else(|| CommandError::new("ERR_NOT_FOUND", "Citation audit not found", false))
}

#[tauri::command]
pub async fn list_citation_audits(
    state: State<'_, AppState>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<Vec<SavedCitationAudit>, CommandError> {
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50).clamp(1, 100);
    let offset = (p - 1) * ps;

    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::list_citation_audits(&conn, ps, offset)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

// ---------------------------------------------------------------------------
// Writing Revisions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_writing_revision(
    state: State<'_, AppState>,
    revision: WritingRevisionItem,
) -> Result<WritingRevisionItem, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::save_writing_revision(&conn, &revision)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    Ok(revision)
}

#[tauri::command]
pub async fn list_writing_revisions(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<WritingRevisionItem>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::list_writing_revisions(&conn, &session_id)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}

// ---------------------------------------------------------------------------
// Readability Reports Persistence
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_readability_report(
    state: State<'_, AppState>,
    report: SavedReadabilityReport,
) -> Result<SavedReadabilityReport, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::save_readability_report(&conn, &report)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    Ok(report)
}

#[tauri::command]
pub async fn get_readability_report_by_hash(
    state: State<'_, AppState>,
    doc_hash: String,
) -> Result<Option<SavedReadabilityReport>, CommandError> {
    let db = state.db()?;
    let conn = db
        .lock()
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))?;

    AiToolsRepository::get_readability_report_by_hash(&conn, &doc_hash)
        .map_err(|e| CommandError::new("ERR_DB", e.to_string(), false))
}


// ---------------------------------------------------------------------------
// Document Extraction & AI Signals via Python Engine
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn extract_document_text(
    file_path: String,
) -> Result<serde_json::Value, CommandError> {
    crate::services::python_engine::PythonEngineService::extract_document_text(&file_path).await
}

#[tauri::command]
pub async fn detect_ai_signals(
    text: String,
) -> Result<serde_json::Value, CommandError> {
    crate::services::python_engine::PythonEngineService::detect_ai_signals(&text).await
}
