use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::repositories::ai_tools_repo::AiToolsRepository;

fn count_syllables_oracle(word: &str) -> usize {
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

fn compute_genuine_metrics_oracle(text: &str) -> serde_json::Value {
    let words: Vec<&str> = text.split_whitespace().collect();
    let word_count = words.len();
    let char_count = text.chars().count();
    let sentences: Vec<&str> = text
        .split(&['.', '!', '?'])
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    let sentence_count = sentences.len().max(1);

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

    let total_syllables: usize = words.iter().map(|w| count_syllables_oracle(w)).sum();
    let syllables = total_syllables.max(1);

    let words_f = word_count.max(1) as f64;
    let sentences_f = sentence_count as f64;
    let syllables_f = syllables as f64;
    let chars_f = char_count as f64;

    let flesch_reading_ease =
        206.835 - 1.015 * (words_f / sentences_f) - 84.6 * (syllables_f / words_f);
    let flesch_kincaid_grade =
        0.39 * (words_f / sentences_f) + 11.8 * (syllables_f / words_f) - 15.59;
    let l = (chars_f / words_f) * 100.0;
    let s = (sentences_f / words_f) * 100.0;
    let coleman_liau_index = 0.0588 * l - 0.296 * s - 15.8;
    let ari = 4.71 * (chars_f / words_f) + 0.5 * (words_f / sentences_f) - 21.43;

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

#[test]
fn test_metrics_on_empty_and_whitespace_text() {
    let empty_res = compute_genuine_metrics_oracle("");
    assert_eq!(empty_res["word_count"], 0);
    assert_eq!(empty_res["sentence_count"], 1);
    assert_eq!(empty_res["burstiness"], 0.0);
    assert_eq!(empty_res["type_token_ratio"], 0.0);
    assert!(!empty_res["flesch_reading_ease"].as_f64().unwrap().is_nan());

    let ws_res = compute_genuine_metrics_oracle("   \n\t  ");
    assert_eq!(ws_res["word_count"], 0);
    assert_eq!(ws_res["sentence_count"], 1);
}

#[test]
fn test_metrics_on_uniform_vs_bursty_text() {
    // Uniform text: exactly 3 words per sentence -> variance should be 0.0, burstiness should be -1.0
    let uniform_text = "One two three. Four five six. Seven eight nine. Ten eleven twelve.";
    let uniform_res = compute_genuine_metrics_oracle(uniform_text);
    assert_eq!(uniform_res["word_count"], 12);
    assert_eq!(uniform_res["sentence_count"], 4);
    assert_eq!(uniform_res["sentence_variance"], 0.0);
    assert_eq!(uniform_res["std_dev"], 0.0);
    assert_eq!(uniform_res["burstiness"], -1.0);

    // Bursty text: 2 words, then 15 words, then 2 words -> variance > 0, burstiness > -1.0
    let bursty_text = "Wait here. The rapid advancement of distributed consensus mechanisms has enabled resilient decentralized architectures across diverse untrusted environments. Stop now.";
    let bursty_res = compute_genuine_metrics_oracle(bursty_text);
    assert_eq!(bursty_res["sentence_count"], 3);
    assert!(bursty_res["sentence_variance"].as_f64().unwrap() > 10.0);
    assert!(bursty_res["burstiness"].as_f64().unwrap() > -0.5);
}

#[test]
fn test_metrics_lexical_diversity_type_token_ratio() {
    // Exact token-matching verification without punctuation: 8 identical tokens
    let repetitive_tokens = "test test test test test test test test";
    let rep_res = compute_genuine_metrics_oracle(repetitive_tokens);
    assert_eq!(rep_res["word_count"], 8);
    // 1 unique word / 8 words = 0.125
    assert_eq!(rep_res["type_token_ratio"], 0.125);

    // All distinct words without punctuation: TTR should be 1.0
    let distinct_text = "Alpha beta gamma delta epsilon zeta";
    let dist_res = compute_genuine_metrics_oracle(distinct_text);
    assert_eq!(dist_res["word_count"], 6);
    assert_eq!(dist_res["type_token_ratio"], 1.0);
}

#[test]
fn test_analysis_job_missing_doc_failure_path() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let job_id = "job_test_missing_001";
    let doc_hash = "hash_non_existent_404";
    let job_type = "readability";

    // 1. Create job
    AiToolsRepository::create_analysis_job(&conn, job_id, job_type, doc_hash)
        .expect("create job failed");

    // 2. Query document content -> must be None
    let doc = AiToolsRepository::get_document_content_by_hash(&conn, doc_hash)
        .expect("get_document_content_by_hash");
    assert!(doc.is_none());

    // 3. Mark job failed
    AiToolsRepository::fail_analysis_job(
        &conn,
        job_id,
        "ERR_DOCUMENT_NOT_FOUND",
        "Document content not found for specified hash in integrity_documents",
    )
    .expect("fail_analysis_job failed");

    // 4. Verify job state
    let job = AiToolsRepository::get_analysis_job(&conn, job_id)
        .expect("get_analysis_job")
        .expect("job must exist");
    assert_eq!(job.status, "failed");
    assert_eq!(job.error_code.as_deref(), Some("ERR_DOCUMENT_NOT_FOUND"));
    assert_eq!(
        job.error_message.as_deref(),
        Some("Document content not found for specified hash in integrity_documents")
    );

    // 5. Active job lookup returns None for failed jobs
    let active = AiToolsRepository::find_active_job_for_hash(&conn, doc_hash, job_type)
        .expect("find active");
    assert!(active.is_none());
}

#[test]
fn test_analysis_job_end_to_end_genuine_metrics_pipeline() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let doc_text =
        "Transformers utilize self-attention mechanisms to process sequential representations. \
                    Dense matrix multiplications dominate computational overhead during inference. \
                    Quantization strategies reduce memory bandwidth bottlenecks effectively.";
    let doc_id = "doc_trans_01";
    let doc_hash = "hash_trans_7788";
    let file_name = "transformer_inference.txt";
    let words: Vec<&str> = doc_text.split_whitespace().collect();
    let word_count = words.len() as i64;
    let normalized = doc_text.to_lowercase();

    // 1. Ingest document
    AiToolsRepository::ingest_document(
        &conn,
        doc_id,
        doc_hash,
        file_name,
        "txt",
        word_count,
        doc_text,
        &normalized,
    )
    .expect("ingest doc failed");

    // 2. Create job
    let job_id = "job_trans_01";
    let job =
        AiToolsRepository::create_analysis_job(&conn, job_id, "ai_writing_detection", doc_hash)
            .expect("create job failed");
    assert_eq!(job.status, "running");

    // 3. Simulate pipeline execution steps
    AiToolsRepository::update_job_progress(
        &conn,
        job_id,
        20,
        "Retrieving ingested document text and metadata",
    )
    .expect("progress 20");
    let content = AiToolsRepository::get_document_content_by_hash(&conn, doc_hash)
        .expect("retrieve doc")
        .expect("doc must exist");

    assert_eq!(content.0, file_name);
    assert_eq!(content.1, doc_text);
    assert_eq!(content.2, word_count);

    AiToolsRepository::update_job_progress(
        &conn,
        job_id,
        45,
        "Parsing syntax & extracting statistical features",
    )
    .expect("progress 45");

    let metrics = compute_genuine_metrics_oracle(&content.1);
    assert_eq!(metrics["word_count"], 23);
    assert_eq!(metrics["sentence_count"], 3);
    assert!(
        metrics["burstiness"].as_f64().unwrap() >= -1.0
            && metrics["burstiness"].as_f64().unwrap() <= 1.0
    );
    // Non-NaN check for Flesch scores
    assert!(!metrics["flesch_reading_ease"].as_f64().unwrap().is_nan());
    assert!(!metrics["flesch_kincaid_grade"].as_f64().unwrap().is_nan());

    AiToolsRepository::update_job_progress(
        &conn,
        job_id,
        75,
        "Evaluating cross-dimensional consistency and stylometric signals",
    )
    .expect("progress 75");

    let final_res = serde_json::json!({
        "document_hash": doc_hash,
        "file_name": file_name,
        "job_type": "ai_writing_detection",
        "status": "completed",
        "metrics": metrics,
        "ai_signals": {
            "status": "fallback",
            "overall_signal_score": 0.35,
            "classification": "natural_cadence"
        },
        "completed_at": chrono::Utc::now().to_rfc3339()
    });

    AiToolsRepository::complete_analysis_job(&conn, job_id, &final_res.to_string())
        .expect("complete job failed");

    // 4. Verify completed job
    let completed = AiToolsRepository::get_analysis_job(&conn, job_id)
        .expect("get job")
        .expect("must exist");
    assert_eq!(completed.status, "completed");
    assert_eq!(completed.progress_pct, 100);
    assert_eq!(completed.current_step.as_deref(), Some("Done"));

    let parsed: serde_json::Value = serde_json::from_str(&completed.result_json.unwrap()).unwrap();
    assert_eq!(parsed["status"], "completed");
    assert_eq!(parsed["metrics"]["word_count"], 23);
    assert_eq!(parsed["metrics"]["sentence_count"], 3);
    assert_eq!(parsed["ai_signals"]["classification"], "natural_cadence");
}
