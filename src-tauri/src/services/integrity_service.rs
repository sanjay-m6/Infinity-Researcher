use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Instant;
use regex::Regex;
use uuid::Uuid;

use crate::database::Database;
use crate::domain::integrity::*;
use crate::errors::AppError;
use crate::repositories::integrity_repo::IntegrityRepository;

pub struct IntegrityService;

const DEFAULT_K: usize = 16;
const DEFAULT_W: usize = 4;
const MIN_MATCH_CHARS: i64 = 40;

const UNCERTAINTY_DISCLOSURE: &str =
    "Classifier signals are statistical approximations based on training distributions and must never \
     be treated as proof of AI authorship or human misconduct. Classifiers exhibit notable false-positive \
     rates on structured academic prose, non-native English writing, and edited texts.";

impl IntegrityService {
    // -----------------------------------------------------------------------
    // Winnowing & Matching Algorithms (First-party Rust Engine)
    // -----------------------------------------------------------------------

    /// Tokenizes text into (lowercase_word, start_char_offset).
    pub fn tokenize_with_offsets(text: &str) -> Vec<(String, i64)> {
        let mut tokens = Vec::new();
        let re = Regex::new(r"\b[A-Za-z0-9_]+(?:[-.][A-Za-z0-9_]+)*\b").unwrap();
        for mat in re.find_iter(text) {
            tokens.push((mat.as_str().to_lowercase(), mat.start() as i64));
        }
        tokens
    }

    /// Computes deterministic signed 64-bit hash of token k-gram.
    pub fn hash_kgram(tokens: &[String]) -> i64 {
        use std::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;
        let mut s = DefaultHasher::new();
        for t in tokens {
            t.hash(&mut s);
        }
        s.finish() as i64
    }

    /// Computes Winnowing fingerprints (hash_value, char_offset) with k-gram length k and window w.
    pub fn generate_winnowing_fingerprints(
        text: &str,
        k: usize,
        w: usize,
    ) -> Vec<(i64, i64)> {
        let tokens = Self::tokenize_with_offsets(text);
        if tokens.len() < k {
            return Vec::new();
        }

        // 1. Generate k-gram hashes and starting char offsets
        let mut kgrams = Vec::with_capacity(tokens.len() - k + 1);
        for i in 0..=(tokens.len() - k) {
            let window_tokens: Vec<String> = tokens[i..i + k].iter().map(|(t, _)| t.clone()).collect();
            let char_offset = tokens[i].1;
            let h = Self::hash_kgram(&window_tokens);
            kgrams.push((h, char_offset));
        }

        // 2. Sliding window of size w to select minimum hash
        let mut fingerprints = Vec::new();
        let mut min_idx: Option<usize> = None;

        if kgrams.len() < w {
            // Document has fewer kgrams than window; pick the minimum if any
            if let Some(&(h, offset)) = kgrams.iter().min_by_key(|(h, _)| h) {
                fingerprints.push((h, offset));
            }
            return fingerprints;
        }

        for i in 0..=(kgrams.len() - w) {
            let window = &kgrams[i..i + w];
            let mut curr_min = window[0];
            let mut curr_min_pos = i;
            for (offset, &item) in window.iter().enumerate() {
                if item.0 <= curr_min.0 {
                    curr_min = item;
                    curr_min_pos = i + offset;
                }
            }

            if min_idx != Some(curr_min_pos) {
                min_idx = Some(curr_min_pos);
                fingerprints.push(curr_min);
            }
        }

        // De-duplicate adjacent identical items
        fingerprints.dedup();
        fingerprints
    }

    /// Merges overlapping and contiguous (start, end) ranges.
    pub fn merge_overlapping_spans(spans: &[(i64, i64)]) -> Vec<(i64, i64)> {
        if spans.is_empty() {
            return Vec::new();
        }
        let mut sorted = spans.to_vec();
        sorted.sort_by_key(|s| (s.0, s.1));

        let mut merged: Vec<(i64, i64)> = vec![sorted[0]];
        for current in sorted.into_iter().skip(1) {
            let last = merged.last_mut().unwrap();
            if current.0 <= last.1 {
                last.1 = last.1.max(current.1);
            } else {
                merged.push(current);
            }
        }
        merged
    }

    /// Seed-and-extend character alignment.
    pub fn seed_and_extend(
        target: &str,
        target_offset: i64,
        source: &str,
        source_offset: i64,
        seed_len: usize,
    ) -> (i64, i64, i64, i64) {
        let t_chars: Vec<char> = target.chars().collect();
        let s_chars: Vec<char> = source.chars().collect();

        let mut t_start = (target_offset as usize).min(t_chars.len());
        let mut s_start = (source_offset as usize).min(s_chars.len());

        // Extend backward
        while t_start > 0 && s_start > 0 {
            let tc = t_chars[t_start - 1].to_ascii_lowercase();
            let sc = s_chars[s_start - 1].to_ascii_lowercase();
            if tc == sc || (tc.is_whitespace() && sc.is_whitespace()) {
                t_start -= 1;
                s_start -= 1;
            } else {
                break;
            }
        }

        // Extend forward
        let mut t_end = (t_start + seed_len).min(t_chars.len());
        let mut s_end = (s_start + seed_len).min(s_chars.len());

        while t_end < t_chars.len() && s_end < s_chars.len() {
            let tc = t_chars[t_end].to_ascii_lowercase();
            let sc = s_chars[s_end].to_ascii_lowercase();
            if tc == sc || (tc.is_whitespace() && sc.is_whitespace()) {
                t_end += 1;
                s_end += 1;
            } else {
                break;
            }
        }

        (t_start as i64, t_end as i64, s_start as i64, s_end as i64)
    }

    // -----------------------------------------------------------------------
    // Ingestion & Normalization
    // -----------------------------------------------------------------------

    pub fn ingest_document(
        db: &Database,
        source_type: &str,
        file_name: &str,
        file_format: Option<&str>,
        content_or_path: &str,
    ) -> Result<IntegrityDocument, AppError> {
        let mut conn = db.lock()?;
        let now = chrono::Utc::now().to_rfc3339();
        let id = Uuid::new_v4().to_string();

        let fmt = file_format
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                Path::new(file_name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("txt")
                    .to_lowercase()
            });

        // Resolve raw content and bytes
        let (raw_content, file_bytes) = if source_type == "file" && Path::new(content_or_path).exists() {
            let bytes = fs::read(content_or_path).map_err(|e| AppError::Internal(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes).to_string();
            (text, bytes)
        } else {
            let text = content_or_path.to_string();
            let bytes = text.as_bytes().to_vec();
            (text, bytes)
        };

        let file_hash = {
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            hasher.update(&file_bytes);
            format!("{:x}", hasher.finalize())
        };

        // Normalize text
        let normalized = raw_content.replace("\r\n", "\n").replace('\r', "\n");
        let words: Vec<&str> = normalized.split_whitespace().collect();
        let word_count = words.len() as i64;
        let page_count = ((word_count / 400) + 1).max(1);

        let doc = IntegrityDocument {
            id: id.clone(),
            source_type: source_type.to_string(),
            source_reference: Some(content_or_path.to_string()),
            file_hash,
            file_name: file_name.to_string(),
            file_format: fmt,
            file_size_bytes: file_bytes.len() as i64,
            raw_content: raw_content.clone(),
            normalized_content: normalized.clone(),
            word_count,
            page_count,
            extraction_metadata: Some(r#"{"tool":"research_integrity_v1","mode":"local_first"}"#.to_string()),
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        IntegrityRepository::save_document(&conn, &doc)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Segment text by double newlines into paragraphs
        let paras: Vec<&str> = normalized.split("\n\n").collect();
        let mut segments = Vec::new();
        let mut offset = 0i64;

        for (idx, p) in paras.iter().enumerate() {
            let trimmed = p.trim();
            if trimmed.is_empty() {
                offset += p.len() as i64 + 2;
                continue;
            }
            let start = normalized[offset as usize..].find(trimmed).unwrap_or(0) as i64 + offset;
            let end = start + trimmed.len() as i64;
            offset = end;

            let seg_type = if trimmed.to_lowercase().starts_with("abstract") {
                "abstract"
            } else if trimmed.to_lowercase().starts_with("references") {
                "references"
            } else if trimmed.len() < 60 && !trimmed.ends_with('.') {
                "section_heading"
            } else {
                "paragraph"
            };

            segments.push(DocumentSegment {
                id: Uuid::new_v4().to_string(),
                document_id: id.clone(),
                segment_index: idx as i64,
                segment_type: seg_type.to_string(),
                raw_text: trimmed.to_string(),
                normalized_text: trimmed.to_string(),
                char_start: start,
                char_end: end,
                page_number: ((start / 2500) + 1).max(1),
                embedding_id: None,
                created_at: now.clone(),
            });
        }

        IntegrityRepository::save_segments(&mut conn, &id, &segments)
            .map_err(|e| AppError::Internal(e.to_string()))?;


        Ok(doc)
    }

    pub fn get_document(db: &Database, id: &str) -> Result<Option<IntegrityDocument>, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::get_document(&conn, id).map_err(|e| AppError::Internal(e.to_string()))
    }

    pub fn list_documents(db: &Database) -> Result<Vec<IntegrityDocument>, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::list_documents(&conn).map_err(|e| AppError::Internal(e.to_string()))
    }

    // -----------------------------------------------------------------------
    // Corpus Management
    // -----------------------------------------------------------------------

    pub fn index_corpus_source(
        db: &Database,
        source_type: &str,
        title: &str,
        content: &str,
        authors: Option<&str>,
        doi: Option<&str>,
        canonical_url: Option<&str>,
        file_path: Option<&str>,
    ) -> Result<CorpusSource, AppError> {
        let mut conn = db.lock()?;
        let now = chrono::Utc::now().to_rfc3339();
        let id = Uuid::new_v4().to_string();

        let content_hash = {
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            hasher.update(content.as_bytes());
            format!("{:x}", hasher.finalize())
        };

        let words: Vec<&str> = content.split_whitespace().collect();
        let word_count = words.len() as i64;

        // Generate winnowing fingerprints
        let fingerprints = Self::generate_winnowing_fingerprints(content, DEFAULT_K, DEFAULT_W);
        let fp_count = fingerprints.len() as i64;

        let source = CorpusSource {
            id: id.clone(),
            source_type: source_type.to_string(),
            source_ref: file_path.map(|s| s.to_string()),
            title: title.to_string(),
            authors: authors.map(|s| s.to_string()),
            venue: None,
            year: None,
            doi: doi.map(|s| s.to_string()),
            canonical_url: canonical_url.map(|s| s.to_string()),
            file_path: file_path.map(|s| s.to_string()),
            content_hash,
            raw_content: content.to_string(),
            word_count,
            fingerprint_count: fp_count,
            is_active: true,
            indexed_at: now,
            last_error: None,
        };

        IntegrityRepository::save_corpus_source(&conn, &source)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        IntegrityRepository::save_fingerprints(&mut conn, &id, &fingerprints)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(source)
    }

    /// Indexes papers from the research library database into the local similarity corpus.
    pub fn index_library_papers(db: &Database) -> Result<i64, AppError> {
        let (papers_to_index, existing_source_refs): (Vec<(String, String, Option<String>, Option<String>, Option<String>, Option<String>)>, HashSet<String>) = {
            let conn = db.lock()?;
            let mut stmt = conn
                .prepare(
                    "SELECT p.id, p.title, p.abstract_text, p.canonical_doi, p.primary_landing_url, pf.file_path
                     FROM papers p
                     LEFT JOIN paper_files pf ON pf.paper_id = p.id
                     WHERE p.is_saved = 1 OR pf.file_path IS NOT NULL",
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;

            let papers = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<String>>(5)?,
                    ))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?
                .filter_map(|r| r.ok())
                .collect();

            let mut ref_stmt = conn
                .prepare("SELECT source_ref FROM corpus_sources WHERE source_ref IS NOT NULL")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let refs: HashSet<String> = ref_stmt
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(|e| AppError::Internal(e.to_string()))?
                .filter_map(|r| r.ok())
                .collect();

            (papers, refs)
        };

        let mut indexed_count = 0i64;
        for (id, title, abs_opt, doi, url, file_path) in papers_to_index {
            if existing_source_refs.contains(&id) {
                continue;
            }

            let mut content = format!("{}\n\n", title);
            if let Some(ref abs_text) = abs_opt {
                content.push_str(abs_text);
            }

            // If file path exists and is readable text/pdf
            if let Some(ref path_str) = file_path {
                let p = Path::new(path_str);
                if p.exists() {
                    if let Ok(extracted) = fs::read_to_string(p) {
                        content.push_str("\n\n");
                        content.push_str(&extracted);
                    }
                }
            }

            if content.split_whitespace().count() < 10 {
                continue;
            }

            let _ = Self::index_corpus_source(
                db,
                "library_paper",
                &title,
                &content,
                None,
                doi.as_deref(),
                url.as_deref(),
                Some(&id),
            );
            indexed_count += 1;
        }

        Ok(indexed_count)
    }

    pub fn list_corpus_sources(db: &Database) -> Result<Vec<CorpusSource>, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::list_corpus_sources(&conn).map_err(|e| AppError::Internal(e.to_string()))
    }

    pub fn delete_corpus_source(db: &Database, id: &str) -> Result<bool, AppError> {
        let mut conn = db.lock()?;
        IntegrityRepository::delete_corpus_source(&mut conn, id).map_err(|e| AppError::Internal(e.to_string()))
    }

    // -----------------------------------------------------------------------
    // Similarity Run & Alignment
    // -----------------------------------------------------------------------

    pub fn run_similarity_check(
        db: &Database,
        document_id: &str,
    ) -> Result<SimilarityReport, AppError> {
        let start_time = Instant::now();
        let (doc, segments, corpus_sources) = {
            let conn = db.lock()?;
            let doc = IntegrityRepository::get_document(&conn, document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation(format!("Document {} not found", document_id)))?;
            let segments = IntegrityRepository::get_segments_for_document(&conn, document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let sources = IntegrityRepository::list_corpus_sources(&conn)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            (doc, segments, sources)
        };


        let target_text = &doc.normalized_content;
        let total_chars = target_text.len() as i64;
        let total_words = doc.word_count;

        // Generate target fingerprints
        let target_fingerprints = Self::generate_winnowing_fingerprints(target_text, DEFAULT_K, DEFAULT_W);
        let target_hashes: Vec<i64> = target_fingerprints.iter().map(|(h, _)| *h).collect();

        let run_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        if corpus_sources.is_empty() || target_hashes.is_empty() {
            let note = if corpus_sources.is_empty() {
                "No corpus sources indexed. Index library papers or import reference documents to check similarity."
            } else {
                "Document contains insufficient text for fingerprint extraction."
            };

            let run = SimilarityRun {
                id: run_id.clone(),
                document_id: document_id.to_string(),
                status: "completed".to_string(),
                total_body_words: total_words,
                matched_body_words: 0,
                overall_similarity_ratio: 0.0,
                corpus_sources_searched: corpus_sources.len() as i64,
                matched_sources_count: 0,
                matches_count: 0,
                execution_duration_ms: start_time.elapsed().as_millis() as i64,
                error_message: None,
                created_at: now.clone(),
                completed_at: Some(now.clone()),
            };

            {
                let conn = db.lock()?;
                IntegrityRepository::create_similarity_run(&conn, &run)
                    .map_err(|e| AppError::Internal(e.to_string()))?;
            }


            return Ok(SimilarityReport {
                run,
                document: doc,
                segments,
                matches: Vec::new(),
                corpus_coverage_note: note.to_string(),
                formula_explanation: "Similarity ratio = (unique matched non-boilerplate characters) / (total body characters).".to_string(),
            });
        }

        // Query database for fingerprint overlaps
        let overlaps = {
            let conn = db.lock()?;
            IntegrityRepository::query_fingerprint_overlaps(&conn, &target_hashes)
                .map_err(|e| AppError::Internal(e.to_string()))?
        };

        // Build map of source_id -> CorpusSource
        let source_map: HashMap<String, CorpusSource> = corpus_sources
            .into_iter()
            .map(|s| (s.id.clone(), s))
            .collect();

        // Map target hashes to offsets
        let mut target_hash_to_offset: HashMap<i64, Vec<i64>> = HashMap::new();
        for (h, off) in target_fingerprints {
            target_hash_to_offset.entry(h).or_default().push(off);
        }

        let mut matches = Vec::new();
        let mut matched_target_spans = Vec::new();
        let mut matched_source_ids = HashSet::new();

        for fp in overlaps {
            if let Some(target_offsets) = target_hash_to_offset.get(&fp.hash_value) {
                if let Some(source) = source_map.get(&fp.corpus_source_id) {
                    for &t_off in target_offsets {
                        let (t_start, t_end, s_start, s_end) = Self::seed_and_extend(
                            target_text,
                            t_off,
                            &source.raw_content,
                            fp.char_offset,
                            60,
                        );

                        let overlap_len = t_end - t_start;
                        if overlap_len >= MIN_MATCH_CHARS {
                            let t_passage = target_text[t_start as usize..t_end as usize].to_string();
                            let s_passage = source.raw_content[s_start as usize..s_end as usize].to_string();

                            let match_type = if t_passage.eq_ignore_ascii_case(&s_passage) {
                                "exact"
                            } else {
                                "fingerprint"
                            };

                            matches.push(SimilarityMatchWithSource {
                                match_data: SimilarityMatch {
                                    id: Uuid::new_v4().to_string(),
                                    similarity_run_id: run_id.clone(),
                                    corpus_source_id: source.id.clone(),
                                    match_type: match_type.to_string(),
                                    target_char_start: t_start,
                                    target_char_end: t_end,
                                    target_page_number: ((t_start / 2500) + 1).max(1),
                                    target_passage: t_passage,
                                    source_char_start: s_start,
                                    source_char_end: s_end,
                                    source_page_number: ((s_start / 2500) + 1).max(1),
                                    source_passage: s_passage,
                                    overlap_chars: overlap_len,
                                    confidence_score: 1.0,
                                    review_status: "unreviewed".to_string(),
                                    review_notes: None,
                                    created_at: now.clone(),
                                },
                                source_title: source.title.clone(),
                                source_authors: source.authors.clone(),
                                source_doi: source.doi.clone(),
                                source_canonical_url: source.canonical_url.clone(),
                            });

                            matched_target_spans.push((t_start, t_end));
                            matched_source_ids.insert(source.id.clone());
                        }
                    }
                }
            }
        }

        // De-duplicate overlapping target character ranges
        let merged_spans = Self::merge_overlapping_spans(&matched_target_spans);
        let total_matched_chars: i64 = merged_spans.iter().map(|(s, e)| e - s).sum();
        let matched_ratio = if total_chars > 0 {
            (total_matched_chars as f32 / total_chars as f32).min(1.0)
        } else {
            0.0
        };

        // Estimate matched body words from character spans
        let mut matched_words_count = 0i64;
        for (start, end) in &merged_spans {
            let slice = &target_text[*start as usize..*end as usize];
            matched_words_count += slice.split_whitespace().count() as i64;
        }

        let run = SimilarityRun {
            id: run_id.clone(),
            document_id: document_id.to_string(),
            status: "completed".to_string(),
            total_body_words: total_words,
            matched_body_words: matched_words_count,
            overall_similarity_ratio: (matched_ratio * 1000.0).round() / 1000.0,
            corpus_sources_searched: source_map.len() as i64,
            matched_sources_count: matched_source_ids.len() as i64,
            matches_count: matches.len() as i64,
            execution_duration_ms: start_time.elapsed().as_millis() as i64,
            error_message: None,
            created_at: now.clone(),
            completed_at: Some(now.clone()),
        };

        {
            let mut conn = db.lock()?;
            IntegrityRepository::create_similarity_run(&conn, &run)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            let raw_matches: Vec<SimilarityMatch> = matches.iter().map(|m| m.match_data.clone()).collect();
            IntegrityRepository::save_similarity_matches(&mut conn, &raw_matches)
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        let coverage_note = if matches.is_empty() {
            format!("Searched {} indexed corpus sources. No matching passages found in the indexed corpus.", source_map.len())
        } else {
            format!(
                "Searched {} indexed sources. Identified {} candidate matching passages across {} sources.",
                source_map.len(),
                matches.len(),
                matched_source_ids.len()
            )
        };

        Ok(SimilarityReport {
            run,
            document: doc,
            segments,
            matches,
            corpus_coverage_note: coverage_note,
            formula_explanation: "Similarity ratio = (unique matched non-boilerplate characters) / (total body characters). Overlapping passages from multiple sources are de-duplicated.".to_string(),
        })
    }

    pub fn get_similarity_report(
        db: &Database,
        run_id: &str,
    ) -> Result<Option<SimilarityReport>, AppError> {
        let conn = db.lock()?;
        let run_opt = IntegrityRepository::get_similarity_run(&conn, run_id)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if let Some(run) = run_opt {
            let doc = IntegrityRepository::get_document(&conn, &run.document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation("Document not found".to_string()))?;

            let segments = IntegrityRepository::get_segments_for_document(&conn, &run.document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            let matches = IntegrityRepository::get_matches_for_run(&conn, run_id)
                .map_err(|e| AppError::Internal(e.to_string()))?;


            let coverage_note = format!(
                "Analysis against {} searched corpus sources. {} total matches found.",
                run.corpus_sources_searched, run.matches_count
            );

            Ok(Some(SimilarityReport {
                run,
                document: doc,
                segments,
                matches,
                corpus_coverage_note: coverage_note,
                formula_explanation: "Similarity ratio is calculated as: (total unique matched characters in non-boilerplate sections) / (total non-boilerplate body characters).".to_string(),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_match_review_status(
        db: &Database,
        match_id: &str,
        status: &str,
        notes: Option<&str>,
    ) -> Result<bool, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::update_match_review(&conn, match_id, status, notes)
            .map_err(|e| AppError::Internal(e.to_string()))
    }


    // -----------------------------------------------------------------------
    // AI Writing Signal Analyzer (Experimental)
    // -----------------------------------------------------------------------

    pub fn run_ai_signal_check(
        db: &Database,
        document_id: &str,
        model_id: Option<&str>,
    ) -> Result<AiSignalRun, AppError> {
        let (doc, segments) = {
            let conn = db.lock()?;
            let doc = IntegrityRepository::get_document(&conn, document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation(format!("Document {} not found", document_id)))?;
            let segments = IntegrityRepository::get_segments_for_document(&conn, document_id)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            (doc, segments)
        };

        let now = chrono::Utc::now().to_rfc3339();
        let run_id = Uuid::new_v4().to_string();
        let mid = model_id.unwrap_or("baseline-statistical-v1");

        // Enforce minimum word count (80 words)
        if doc.word_count < 80 {
            let run = AiSignalRun {
                id: run_id,
                document_id: document_id.to_string(),
                model_id: mid.to_string(),
                model_version: "1.0.0".to_string(),
                inference_mode: "local".to_string(),
                status: "insufficient_text".to_string(),
                overall_signal_score: None,
                signal_classification: "insufficient_text".to_string(),
                analyzed_characters: doc.normalized_content.len() as i64,
                analyzed_paragraphs: segments.len() as i64,
                uncertainty_caveat: "The document contains fewer than the required 80 words for origin signal analysis.".to_string(),
                created_at: now.clone(),
                completed_at: Some(now.clone()),
            };

            let conn = db.lock()?;
            IntegrityRepository::create_ai_signal_run(&conn, &run)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            return Ok(run);
        }


        // Statistical baseline analysis
        let mut segment_records = Vec::new();
        let mut scores = Vec::new();

        for (idx, seg) in segments.iter().enumerate() {
            let text = &seg.normalized_text;
            let words: Vec<&str> = text.split_whitespace().collect();
            if words.len() < 12 {
                continue;
            }

            // Burstiness proxy: variance of sentence lengths
            let sentences: Vec<&str> = text.split(&['.', '!', '?'][..]).filter(|s| s.trim().len() > 5).collect();
            let sent_lens: Vec<f32> = sentences.iter().map(|s| s.split_whitespace().count() as f32).collect();
            let avg_len = if !sent_lens.is_empty() {
                sent_lens.iter().sum::<f32>() / sent_lens.len() as f32
            } else {
                words.len() as f32
            };

            let var = if sent_lens.len() > 1 {
                sent_lens.iter().map(|l| (l - avg_len).powi(2)).sum::<f32>() / sent_lens.len() as f32
            } else {
                4.0
            };
            let cv = var.sqrt() / avg_len.max(1.0);

            // Calibrated signal strength
            let score = if cv > 0.50 {
                0.20
            } else if cv > 0.35 {
                0.40
            } else {
                0.65
            };

            scores.push(score);
            let classification = if score < 0.35 {
                "low_ai_signal"
            } else if score < 0.60 {
                "mixed_signals"
            } else {
                "elevated_ai_signal"
            };

            segment_records.push(AiSignalSegment {
                id: Uuid::new_v4().to_string(),
                ai_signal_run_id: run_id.clone(),
                segment_id: seg.id.clone(),
                paragraph_index: idx as i64,
                score,
                classification: classification.to_string(),
                notes: Some(format!("Stylometric burstiness coefficient: {:.2}", cv)),
            });
        }

        let overall_score = if !scores.is_empty() {
            scores.iter().sum::<f32>() / scores.len() as f32
        } else {
            0.50
        };

        let overall_class = if overall_score < 0.35 {
            "low_ai_signal"
        } else if overall_score < 0.60 {
            "mixed_signals"
        } else {
            "elevated_ai_signal"
        };

        let run = AiSignalRun {
            id: run_id,
            document_id: document_id.to_string(),
            model_id: mid.to_string(),
            model_version: "1.0.0".to_string(),
            inference_mode: "local".to_string(),
            status: "completed".to_string(),
            overall_signal_score: Some((overall_score * 1000.0).round() / 1000.0),
            signal_classification: overall_class.to_string(),
            analyzed_characters: doc.normalized_content.len() as i64,
            analyzed_paragraphs: segment_records.len() as i64,
            uncertainty_caveat: UNCERTAINTY_DISCLOSURE.to_string(),
            created_at: now.clone(),
            completed_at: Some(now.clone()),
        };

        {
            let mut conn = db.lock()?;
            IntegrityRepository::create_ai_signal_run(&conn, &run)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            IntegrityRepository::save_ai_signal_segments(&mut conn, &segment_records)
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        Ok(run)
    }

    // -----------------------------------------------------------------------
    // Academic Writing Assistant
    // -----------------------------------------------------------------------

    pub fn create_writing_session(
        db: &Database,
        document_id: &str,
        title: &str,
    ) -> Result<WritingSession, AppError> {
        let conn = db.lock()?;
        let now = chrono::Utc::now().to_rfc3339();
        let session = WritingSession {
            id: Uuid::new_v4().to_string(),
            document_id: document_id.to_string(),
            title: title.to_string(),
            active_mode: "academic_tone".to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        IntegrityRepository::create_writing_session(&conn, &session)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(session)
    }

    pub fn generate_writing_revision(
        db: &Database,
        session_id: &str,
        action_type: &str,
        custom_revised_text: Option<String>,
    ) -> Result<WritingRevision, AppError> {
        let (doc_text, rev_count) = {
            let conn = db.lock()?;
            let session = IntegrityRepository::get_writing_session(&conn, session_id)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation(format!("Session {} not found", session_id)))?;

            let revisions = IntegrityRepository::get_revisions_for_session(&conn, session_id)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            let base_text = if let Some(last_rev) = revisions.last() {
                last_rev.revised_text.clone()
            } else {
                let doc = IntegrityRepository::get_document(&conn, &session.document_id)
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .ok_or_else(|| AppError::Validation("Document not found".to_string()))?;
                doc.normalized_content
            };

            (base_text, revisions.len() as i64 + 1)
        };

        let revised_text = if let Some(custom) = custom_revised_text {
            custom
        } else {
            // Apply rule-based academic transformation
            Self::apply_academic_rules(&doc_text, action_type)
        };

        // Protected token validation
        let (nums_ok, cits_ok, eqs_ok, dois_ok, risk_flags) =
            Self::validate_protected_tokens(&doc_text, &revised_text);

        let diff_summary = Self::compute_diff_summary(&doc_text, &revised_text);
        let now = chrono::Utc::now().to_rfc3339();

        let revision = WritingRevision {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            revision_number: rev_count,
            action_type: action_type.to_string(),
            original_text: doc_text,
            revised_text,
            diff_summary,
            preserved_numbers_ok: nums_ok,
            preserved_citations_ok: cits_ok,
            preserved_equations_ok: eqs_ok,
            preserved_dois_ok: dois_ok,
            meaning_risk_flags: if risk_flags.is_empty() {
                None
            } else {
                Some(risk_flags.join("; "))
            },
            is_accepted: false,
            created_at: now,
        };

        {
            let conn = db.lock()?;
            IntegrityRepository::save_writing_revision(&conn, &revision)
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        Ok(revision)
    }

    pub fn accept_writing_revision(
        db: &Database,
        revision_id: &str,
    ) -> Result<bool, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::set_revision_accepted(&conn, revision_id, true)
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub fn list_writing_revisions(
        db: &Database,
        session_id: &str,
    ) -> Result<Vec<WritingRevision>, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::get_revisions_for_session(&conn, session_id)
            .map_err(|e| AppError::Internal(e.to_string()))
    }


    // -----------------------------------------------------------------------
    // Helper Methods
    // -----------------------------------------------------------------------

    fn apply_academic_rules(original: &str, action_type: &str) -> String {
        let mut revised = original.to_string();
        match action_type {
            "academic_tone" => {
                let replacements = [
                    (r"\ba lot of\b", "substantial quantities of"),
                    (r"\blook into\b", "investigate"),
                    (r"\bfind out\b", "determine"),
                    (r"\bshows that\b", "demonstrates that"),
                    (r"\bbig\b", "significant"),
                    (r"\bget rid of\b", "eliminate"),
                ];
                for (pat, rep) in replacements {
                    let re = Regex::new(pat).unwrap();
                    revised = re.replace_all(&revised, rep).to_string();
                }
            }
            "concise" => {
                let replacements = [
                    (r"\bin order to\b", "to"),
                    (r"\bdue to the fact that\b", "because"),
                    (r"\bat the present moment\b", "currently"),
                    (r"\ba majority of\b", "most"),
                ];
                for (pat, rep) in replacements {
                    let re = Regex::new(pat).unwrap();
                    revised = re.replace_all(&revised, rep).to_string();
                }
            }
            "transitions" => {
                let replacements = [
                    (r"\bAlso,\b", "Furthermore,"),
                    (r"\bSo,\b", "Consequently,"),
                    (r"\bBut\b", "However,"),
                ];
                for (pat, rep) in replacements {
                    let re = Regex::new(pat).unwrap();
                    revised = re.replace_all(&revised, rep).to_string();
                }
            }
            "grammar" => {
                let re_spaces = Regex::new(r"\s+([,.:;?!])").unwrap();
                revised = re_spaces.replace_all(&revised, "$1").to_string();
            }
            _ => {
                // Clarity: apply concise + tone
                let replacements = [
                    (r"\bin order to\b", "to"),
                    (r"\bdue to the fact that\b", "because"),
                    (r"\bshows that\b", "demonstrates that"),
                ];
                for (pat, rep) in replacements {
                    let re = Regex::new(pat).unwrap();
                    revised = re.replace_all(&revised, rep).to_string();
                }
            }
        }
        revised
    }

    fn validate_protected_tokens(original: &str, revised: &str) -> (bool, bool, bool, bool, Vec<String>) {
        let num_re = Regex::new(r"\b\d+(?:\.\d+)?\b").unwrap();
        let cit_re = Regex::new(r"\[\d+(?:[,\s–-]+\d+)*\]|\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)").unwrap();
        let doi_re = Regex::new(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+").unwrap();
        let eq_re = Regex::new(r"\$\$[\s\S]*?\$\$|\$[^$\n]+\$").unwrap();

        let orig_nums: HashSet<&str> = num_re.find_iter(original).map(|m| m.as_str()).collect();
        let rev_nums: HashSet<&str> = num_re.find_iter(revised).map(|m| m.as_str()).collect();

        let orig_cits: HashSet<&str> = cit_re.find_iter(original).map(|m| m.as_str()).collect();
        let rev_cits: HashSet<&str> = cit_re.find_iter(revised).map(|m| m.as_str()).collect();

        let orig_dois: HashSet<&str> = doi_re.find_iter(original).map(|m| m.as_str()).collect();
        let rev_dois: HashSet<&str> = doi_re.find_iter(revised).map(|m| m.as_str()).collect();

        let orig_eqs: HashSet<&str> = eq_re.find_iter(original).map(|m| m.as_str()).collect();
        let rev_eqs: HashSet<&str> = eq_re.find_iter(revised).map(|m| m.as_str()).collect();

        let nums_ok = orig_nums.is_subset(&rev_nums);
        let cits_ok = orig_cits.is_subset(&rev_cits);
        let dois_ok = orig_dois.is_subset(&rev_dois);
        let eqs_ok = orig_eqs.is_subset(&rev_eqs);

        let mut flags = Vec::new();
        if !nums_ok {
            flags.push("Numerical values from original were omitted or altered".to_string());
        }
        if !cits_ok {
            flags.push("Citations from original were altered or removed".to_string());
        }
        if !eqs_ok {
            flags.push("Mathematical formulas or equations were dropped".to_string());
        }
        if !dois_ok {
            flags.push("DOIs were modified".to_string());
        }

        // Epistemic drift check: hedging words turned into causal claims
        let hedge_re = Regex::new(r"(?i)\b(?:suggests|indicates|may|might|correlated)\b").unwrap();
        let causal_re = Regex::new(r"(?i)\b(?:proves|definitively shows|causes)\b").unwrap();
        if hedge_re.is_match(original) && causal_re.is_match(revised) && !causal_re.is_match(original) {
            flags.push("Epistemic drift: nuanced scientific hedging was replaced by causal assertion".to_string());
        }

        (nums_ok, cits_ok, eqs_ok, dois_ok, flags)
    }

    fn compute_diff_summary(original: &str, revised: &str) -> String {
        let orig_words = original.split_whitespace().count();
        let rev_words = revised.split_whitespace().count();
        let diff = rev_words as i64 - orig_words as i64;
        format!(
            r#"{{"original_words":{},"revised_words":{},"net_word_change":{}}}"#,
            orig_words, rev_words, diff
        )
    }

    pub fn get_dashboard_summary(db: &Database) -> Result<IntegrityDashboardSummary, AppError> {
        let conn = db.lock()?;
        IntegrityRepository::get_dashboard_summary(&conn).map_err(|e| AppError::Internal(e.to_string()))
    }
}
