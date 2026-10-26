use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::review_matrix::*;
use research_paper_scraper_lib::services::MatrixService;

#[test]
fn test_literature_review_matrix_and_copilot_workflow() {
    let db = Database::open_in_memory().expect("failed to open in-memory database");

    // 1. Verify default matrix workspace exists
    let detail = MatrixService::get_workspace_detail(&db, "default_matrix")
        .expect("should load default workspace");
    assert_eq!(detail.workspace.id, "default_matrix");
    assert!(detail.columns.len() >= 8);
    assert_eq!(detail.total_papers, 0);

    // 2. Insert test paper
    {
        let conn = db.lock().expect("lock failed");
        conn.execute(
            "INSERT INTO papers (id, title, clean_title_key, abstract, publication_year, venue, canonical_doi, local_pdf_path, created_at, updated_at)
             VALUES ('p_quant_1', 'Scalable Fault-Tolerant Quantum Architecture', 'scalable fault tolerant quantum architecture',
                     'In this work, we propose a novel surface code decoder. We evaluate on simulated syndrome graphs with N = 10,000 samples. Results show that our decoder achieves superior fault tolerance with F1 of 98.5%. However, computational overhead remains a limitation.',
                     2025, 'Physical Review X', '10.1103/PhysRevX.15.011001', 'C:/papers/quantum.pdf', datetime('now'), datetime('now'))",
            [],
        ).unwrap();
    }

    // 3. Add paper to workspace with auto-extraction
    MatrixService::add_paper_and_extract(&db, "default_matrix", "p_quant_1")
        .expect("adding paper should succeed");

    // 4. Verify updated workspace detail
    let updated = MatrixService::get_workspace_detail(&db, "default_matrix")
        .expect("should load updated detail");
    assert_eq!(updated.total_papers, 1);
    let row = &updated.rows[0];
    assert_eq!(row.paper_id, "p_quant_1");
    assert_eq!(row.paper_title, "Scalable Fault-Tolerant Quantum Architecture");

    // Check extracted fields
    assert!(row.extractions.contains_key("research_question") || row.extractions.contains_key("main_findings"));
    if let Some(findings) = row.extractions.get("main_findings") {
        assert!(findings.extracted_value.to_lowercase().contains("superior") || findings.extracted_value.to_lowercase().contains("results"));
        assert!(findings.confidence > 0.5);
    }
    if let Some(sample) = row.extractions.get("sample_size") {
        assert!(sample.extracted_value.contains("10,000") || sample.extracted_value.contains("samples"));
    }

    // 5. Test updating an extraction manually
    let manual_ext = MatrixExtraction {
        id: "ext_test_1".to_string(),
        workspace_id: "default_matrix".to_string(),
        paper_id: "p_quant_1".to_string(),
        field_key: "sample_size".to_string(),
        extracted_value: "N = 10,000 Monte Carlo syndrome cycles".to_string(),
        confidence: 1.0,
        page_number: Some(3),
        char_offset_start: Some(120),
        char_offset_end: Some(160),
        source_passage: Some("evaluated on simulated syndrome graphs with N = 10,000 samples".to_string()),
        status: "user_verified".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    };
    MatrixService::upsert_extraction(&db, manual_ext).expect("upsert should succeed");

    let detail_after_edit = MatrixService::get_workspace_detail(&db, "default_matrix").unwrap();
    let edited_sample = detail_after_edit.rows[0].extractions.get("sample_size").unwrap();
    assert_eq!(edited_sample.extracted_value, "N = 10,000 Monte Carlo syndrome cycles");
    assert_eq!(edited_sample.status, "user_verified");
    assert_eq!(edited_sample.page_number, Some(3));

    // 6. Test CSV Export
    let csv_content = MatrixService::export_csv(&db, "default_matrix").expect("csv export failed");
    assert!(csv_content.contains("Scalable Fault-Tolerant Quantum Architecture"));
    assert!(csv_content.contains("N = 10,000"));

    // 7. Test Evidence-Linked Copilot
    // Insert a chunk into ai_paper_chunks
    {
        let conn = db.lock().expect("lock failed");
        conn.execute(
            "INSERT INTO ai_paper_chunks (id, paper_id, chunk_index, page_number, section_heading, content_text, token_count, created_at)
             VALUES ('chk_1', 'p_quant_1', 0, 4, 'Decoder Complexity', 'The minimum-weight perfect matching decoder processes error graphs with polynomial scaling.', 120, datetime('now'))",
            [],
        ).unwrap();
    }

    let (copilot_msg, evidence) = MatrixService::ask_copilot(
        &db,
        "session_test_1",
        "How does the decoder scale?",
        Some("default_matrix"),
        Some("p_quant_1"),
    ).expect("ask_copilot should succeed");

    assert_eq!(copilot_msg.role, "assistant");
    assert!(!evidence.is_empty());
    assert_eq!(evidence[0].page_number, Some(4));
    assert!(evidence[0].passage.contains("minimum-weight"));

    // 8. Test removing paper
    MatrixService::remove_paper_from_workspace(&db, "default_matrix", "p_quant_1").unwrap();
    let final_detail = MatrixService::get_workspace_detail(&db, "default_matrix").unwrap();
    assert_eq!(final_detail.total_papers, 0);
    assert_eq!(final_detail.total_extractions, 0);
}
