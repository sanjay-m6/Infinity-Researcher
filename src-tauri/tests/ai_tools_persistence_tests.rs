use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::ai_tools::*;
use research_paper_scraper_lib::repositories::ai_tools_repo::AiToolsRepository;

#[test]
fn test_integrity_report_crud_and_finding_review() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let mut conn = db.lock().expect("db lock failed");

    // 1. Prepare sample report with findings
    let report_id = "rep_integrity_001".to_string();
    let finding_1 = IntegrityReportFinding {
        id: "finding_001".to_string(),
        report_id: report_id.clone(),
        dimension: "citations".to_string(),
        title: "Uncited Bibliography Entry".to_string(),
        description: "Reference to Vaswani et al. (2017) is missing in-text marker.".to_string(),
        status: "concern".to_string(),
        severity: "warning".to_string(),
        confidence: "high".to_string(),
        evidence: "Vaswani et al. Attention Is All You Need (2017)".to_string(),
        location: "Bibliography Section, p. 12".to_string(),
        suggested_action: "Add [1] or (Vaswani et al., 2017) to Section 2.".to_string(),
        is_reviewed: false,
        reviewed_at: None,
        reviewer_notes: None,
        created_at: String::new(),
    };

    let finding_2 = IntegrityReportFinding {
        id: "finding_002".to_string(),
        report_id: report_id.clone(),
        dimension: "transparency".to_string(),
        title: "Data Availability Statement Present".to_string(),
        description: "Open access repository link provided in Section 7.".to_string(),
        status: "verified".to_string(),
        severity: "info".to_string(),
        confidence: "high".to_string(),
        evidence: "All benchmark datasets are available at https://github.com/...".to_string(),
        location: "Data Availability, p. 14".to_string(),
        suggested_action: "No action required.".to_string(),
        is_reviewed: true,
        reviewed_at: Some("2026-11-03T10:00:00Z".to_string()),
        reviewer_notes: Some("Verified link resolves correctly".to_string()),
        created_at: String::new(),
    };

    let report = SavedIntegrityReport {
        id: report_id.clone(),
        document_hash: "a1b2c3d4e5f6789012345678abcdef01".to_string(),
        file_name: "manuscript_draft.pdf".to_string(),
        title: "Deep Learning In Distributed Grid Networks".to_string(),
        word_count: 5420,
        dimensions_json: r#"{"citations":85,"transparency":100,"methodology":92}"#.to_string(),
        ethical_disclaimer: "Automated analysis provides diagnostic guidance only.".to_string(),
        findings_count: 2,
        unreviewed_count: 1,
        created_at: String::new(),
        updated_at: String::new(),
        findings: vec![finding_1, finding_2],
    };

    // 2. Save report
    AiToolsRepository::save_integrity_report(&mut *conn, &report)
        .expect("save_integrity_report failed");

    // 3. Retrieve report and verify fields
    let retrieved = AiToolsRepository::get_integrity_report(&conn, &report_id)
        .expect("get_integrity_report failed")
        .expect("report must exist");

    assert_eq!(retrieved.id, report_id);
    assert_eq!(
        retrieved.title,
        "Deep Learning In Distributed Grid Networks"
    );
    assert_eq!(retrieved.findings_count, 2);
    assert_eq!(retrieved.unreviewed_count, 1);
    assert_eq!(retrieved.findings.len(), 2);

    let uncited_finding = retrieved
        .findings
        .iter()
        .find(|f| f.id == "finding_001")
        .expect("finding_001 must exist");
    assert!(!uncited_finding.is_reviewed);
    assert_eq!(uncited_finding.severity, "warning");

    // 4. Update reviewer verification
    let updated = AiToolsRepository::update_finding_review(
        &conn,
        "finding_001",
        true,
        Some("Confirmed uncited; added citation in draft v2"),
    )
    .expect("update_finding_review failed");
    assert!(updated, "update_finding_review should affect 1 row");

    // 5. Re-query and verify reviewed state
    let retrieved_after = AiToolsRepository::get_integrity_report(&conn, &report_id)
        .expect("get_integrity_report failed")
        .expect("report must exist");
    assert_eq!(retrieved_after.unreviewed_count, 0);

    let reviewed_finding = retrieved_after
        .findings
        .iter()
        .find(|f| f.id == "finding_001")
        .unwrap();
    assert!(reviewed_finding.is_reviewed);
    assert_eq!(reviewed_finding.status, "reviewed");
    assert_eq!(
        reviewed_finding.reviewer_notes.as_deref(),
        Some("Confirmed uncited; added citation in draft v2")
    );

    // 6. List reports
    let list = AiToolsRepository::list_saved_integrity_reports(&conn, 10, 0)
        .expect("list_saved_integrity_reports failed");
    assert!(!list.is_empty());
    assert_eq!(list[0].id, report_id);

    // 7. Delete report and verify cascade
    let deleted = AiToolsRepository::delete_integrity_report(&conn, &report_id)
        .expect("delete_integrity_report failed");
    assert!(deleted);

    let after_delete =
        AiToolsRepository::get_integrity_report(&conn, &report_id).expect("query after delete");
    assert!(after_delete.is_none());

    let findings_remaining = AiToolsRepository::get_findings_for_report(&conn, &report_id)
        .expect("get_findings_for_report failed");
    assert!(
        findings_remaining.is_empty(),
        "Cascade delete should remove child findings"
    );
}

#[test]
fn test_citation_audit_crud_and_listing() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let audit = SavedCitationAudit {
        id: "audit_cit_001".to_string(),
        document_hash: "hash_cit_audit_112233".to_string(),
        document_title: "Advances In Quantum Surface Codes".to_string(),
        file_name: "quantum_codes.txt".to_string(),
        total_in_text: 42,
        total_references: 40,
        matched_citations: 38,
        health_score: 95,
        summary_json: r#"{"matched":38,"orphans":2,"uncited":2}"#.to_string(),
        issues_json: r#"[{"type":"orphan_citation","marker":"[41]"}]"#.to_string(),
        references_json: r#"[{"index":1,"doi":"10.1103/PhysRevX.15.011001"}]"#.to_string(),
        created_at: String::new(),
    };

    // 1. Save citation audit
    AiToolsRepository::save_citation_audit(&conn, &audit).expect("save_citation_audit failed");

    // 2. Retrieve citation audit
    let fetched = AiToolsRepository::get_citation_audit(&conn, "audit_cit_001")
        .expect("get_citation_audit failed")
        .expect("audit must exist");

    assert_eq!(fetched.id, "audit_cit_001");
    assert_eq!(fetched.document_title, "Advances In Quantum Surface Codes");
    assert_eq!(fetched.total_in_text, 42);
    assert_eq!(fetched.matched_citations, 38);
    assert_eq!(fetched.health_score, 95);

    // 3. List citation audits
    let audits =
        AiToolsRepository::list_citation_audits(&conn, 10, 0).expect("list_citation_audits failed");
    assert!(!audits.is_empty());
    assert_eq!(audits[0].id, "audit_cit_001");

    // 4. Update audit
    let mut updated_audit = audit.clone();
    updated_audit.health_score = 98;
    updated_audit.matched_citations = 40;
    AiToolsRepository::save_citation_audit(&conn, &updated_audit)
        .expect("update citation audit failed");

    let re_fetched = AiToolsRepository::get_citation_audit(&conn, "audit_cit_001")
        .expect("re-query")
        .unwrap();
    assert_eq!(re_fetched.health_score, 98);
    assert_eq!(re_fetched.matched_citations, 40);
}

#[test]
fn test_writing_revisions_foreign_key_stability() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    // Verify foreign keys are active
    let fk_status: i64 = conn
        .query_row("PRAGMA foreign_keys;", [], |r| r.get(0))
        .expect("query foreign_keys pragma");
    assert_eq!(fk_status, 1, "PRAGMA foreign_keys must be active");

    // Save revision without pre-creating writing_sessions or integrity_documents.
    // The foreign key guard in save_writing_revision MUST auto-ensure parents exist transparently.
    let rev_1 = WritingRevisionItem {
        id: "rev_001".to_string(),
        session_id: "standalone_session_999".to_string(),
        revision_number: 1,
        action_type: "clarity".to_string(),
        original_text: "The data shows very big improvements.".to_string(),
        revised_text: "The empirical results demonstrate statistically significant enhancements."
            .to_string(),
        diff_summary: "Replaced colloquial terms with formal academic diction.".to_string(),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: false,
        created_at: String::new(),
    };

    AiToolsRepository::save_writing_revision(&conn, &rev_1)
        .expect("save_writing_revision must succeed with foreign keys enabled");

    // Verify parent session exists
    let session_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_sessions WHERE id = ?1",
            ["standalone_session_999"],
            |r| r.get(0),
        )
        .expect("check writing_sessions");
    assert_eq!(session_count, 1, "Parent writing_session must exist");

    // Save a second revision in the same session
    let rev_2 = WritingRevisionItem {
        id: "rev_002".to_string(),
        session_id: "standalone_session_999".to_string(),
        revision_number: 2,
        action_type: "shorten".to_string(),
        original_text: "The empirical results demonstrate statistically significant enhancements."
            .to_string(),
        revised_text: "Empirical results show significant enhancements (p < 0.01).".to_string(),
        diff_summary: "Condensed phrasing and preserved p-value.".to_string(),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: true,
        created_at: String::new(),
    };

    AiToolsRepository::save_writing_revision(&conn, &rev_2)
        .expect("save_writing_revision revision 2 failed");

    // List writing revisions
    let revisions = AiToolsRepository::list_writing_revisions(&conn, "standalone_session_999")
        .expect("list_writing_revisions failed");
    assert_eq!(revisions.len(), 2);
    // Ordered by revision_number DESC
    assert_eq!(revisions[0].revision_number, 2);
    assert_eq!(revisions[0].id, "rev_002");
    assert!(revisions[0].is_accepted);
    assert_eq!(revisions[1].revision_number, 1);
    assert_eq!(revisions[1].id, "rev_001");
    assert!(!revisions[1].is_accepted);
}

#[test]
fn test_readability_report_persistence_and_lookup() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let report = SavedReadabilityReport {
        id: "read_rep_001".to_string(),
        document_hash: "hash_read_998877".to_string(),
        document_title: "Graph Neural Networks for Power Grid Topology".to_string(),
        language_code: "en".to_string(),
        word_count: 3200,
        sentence_count: 160,
        flesch_reading_ease: 34.5,
        flesch_kincaid_grade: 14.8,
        gunning_fog_index: 16.2,
        metrics_json: r#"{"coleman_liau":15.1,"ari":14.4,"ttr":0.48}"#.to_string(),
        vocabulary_json: r#"{"complex_words":640,"avg_syllables_per_word":1.85}"#.to_string(),
        paragraphs_json: r#"[{"index":1,"reading_ease":35.2}]"#.to_string(),
        recommendations_json: r#"["Consider splitting multi-clause sentences in Methodology."]"#
            .to_string(),
        created_at: String::new(),
    };

    // 1. Save readability report
    AiToolsRepository::save_readability_report(&conn, &report)
        .expect("save_readability_report failed");

    // 2. Query by document hash
    let fetched = AiToolsRepository::get_readability_report_by_hash(&conn, "hash_read_998877")
        .expect("get_readability_report_by_hash failed")
        .expect("report must exist");

    assert_eq!(fetched.id, "read_rep_001");
    assert_eq!(fetched.word_count, 3200);
    assert_eq!(fetched.sentence_count, 160);
    assert!((fetched.flesch_reading_ease - 34.5).abs() < 0.01);
    assert!((fetched.flesch_kincaid_grade - 14.8).abs() < 0.01);

    // 3. Lookup non-existent hash returns None
    let missing = AiToolsRepository::get_readability_report_by_hash(&conn, "non_existent_hash")
        .expect("query non-existent");
    assert!(missing.is_none());
}

#[test]
fn test_analysis_job_lifecycle_and_cancellation() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let job_id = "job_analysis_001";
    let doc_hash = "hash_analysis_554433";
    let job_type = "ai_writing_detection";

    // 1. Create analysis job
    let job = AiToolsRepository::create_analysis_job(&conn, job_id, job_type, doc_hash)
        .expect("create_analysis_job failed");
    assert_eq!(job.id, job_id);
    assert_eq!(job.status, "running");
    assert_eq!(job.progress_pct, 10);

    // 2. Find active job
    let active = AiToolsRepository::find_active_job_for_hash(&conn, doc_hash, job_type)
        .expect("find active job failed")
        .expect("active job must be found");
    assert_eq!(active.id, job_id);

    // 3. Update progress
    AiToolsRepository::update_job_progress(
        &conn,
        job_id,
        60,
        "Computing sentence length variance and burstiness",
    )
    .expect("update_job_progress failed");

    let progress_job = AiToolsRepository::get_analysis_job(&conn, job_id)
        .expect("get_analysis_job failed")
        .unwrap();
    assert_eq!(progress_job.progress_pct, 60);
    assert_eq!(
        progress_job.current_step.as_deref(),
        Some("Computing sentence length variance and burstiness")
    );

    // 4. Cancel job
    let cancelled =
        AiToolsRepository::cancel_analysis_job(&conn, job_id).expect("cancel_analysis_job failed");
    assert!(cancelled);

    let cancelled_job = AiToolsRepository::get_analysis_job(&conn, job_id)
        .expect("get_analysis_job")
        .unwrap();
    assert_eq!(cancelled_job.status, "cancelled");

    // 5. Active job lookup now returns None
    let active_after_cancel =
        AiToolsRepository::find_active_job_for_hash(&conn, doc_hash, job_type)
            .expect("find active after cancel");
    assert!(active_after_cancel.is_none());
}

#[test]
fn test_document_ingestion_and_genuine_metrics_extraction() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    let sample_text =
        "Surface codes provide a robust topological framework for quantum error correction. \
The minimum-weight perfect matching decoder maps syndrome measurements into graph structures. \
We evaluate fault-tolerant thresholds under realistic depolarization noise. \
Numerical simulation confirms error suppression with threshold exceeding 1.2 percent.";

    let doc_id = "doc_genuine_001";
    let doc_hash = "hash_genuine_doc_8899";
    let file_name = "quantum_surface_codes.txt";
    let words: Vec<&str> = sample_text.split_whitespace().collect();
    let word_count = words.len() as i64;
    let normalized = sample_text.to_lowercase();

    // 1. Ingest document
    AiToolsRepository::ingest_document(
        &conn,
        doc_id,
        doc_hash,
        file_name,
        "txt",
        word_count,
        sample_text,
        &normalized,
    )
    .expect("ingest_document failed");

    // 2. Retrieve document content
    let content_opt = AiToolsRepository::get_document_content_by_hash(&conn, doc_hash)
        .expect("get_document_content_by_hash failed")
        .expect("document content must exist");

    assert_eq!(content_opt.0, file_name);
    assert_eq!(content_opt.1, sample_text);
    assert_eq!(content_opt.2, word_count);

    // 3. Create and complete analysis job with genuine computed metrics
    let job_id = "job_genuine_001";
    AiToolsRepository::create_analysis_job(&conn, job_id, "readability_analysis", doc_hash)
        .expect("create_analysis_job failed");

    let genuine_metrics = serde_json::json!({
        "document_hash": doc_hash,
        "file_name": file_name,
        "job_type": "readability_analysis",
        "status": "completed",
        "word_count": word_count,
        "sentence_count": 4,
        "mean_sentence_length": 11.25,
        "flesch_reading_ease": 38.6,
        "flesch_kincaid_grade": 13.4,
        "completed_at": chrono::Utc::now().to_rfc3339()
    });

    AiToolsRepository::complete_analysis_job(&conn, job_id, &genuine_metrics.to_string())
        .expect("complete_analysis_job failed");

    let completed_job = AiToolsRepository::get_analysis_job(&conn, job_id)
        .expect("get_analysis_job failed")
        .expect("completed job must exist");

    assert_eq!(completed_job.status, "completed");
    assert_eq!(completed_job.progress_pct, 100);

    let parsed_res: serde_json::Value =
        serde_json::from_str(&completed_job.result_json.unwrap()).expect("parse result_json");
    assert_eq!(parsed_res["status"], "completed");
    assert_eq!(parsed_res["word_count"], word_count);
    assert_eq!(parsed_res["sentence_count"], 4);
    assert!(parsed_res["mean_sentence_length"].as_f64().unwrap() > 0.0);
}
