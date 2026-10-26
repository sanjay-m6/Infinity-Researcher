use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::services::IntegrityService;


#[test]
fn test_winnowing_fingerprint_generation() {
    let text = "Quantum computing harnesses quantum mechanics to perform complex computations \
                beyond the reach of classical supercomputers. In this paper we present a novel \
                cryogenic architecture for superconducting qubits with minimal decoherence.";
    let fps = IntegrityService::generate_winnowing_fingerprints(text, 16, 4);
    assert!(!fps.is_empty(), "Fingerprints should be generated for text >= k tokens");

    // Test determinism
    let fps2 = IntegrityService::generate_winnowing_fingerprints(text, 16, 4);
    assert_eq!(fps, fps2, "Fingerprints must be 100% deterministic");
}

#[test]
fn test_seed_and_extend_alignment() {
    let source = "In this work, we demonstrate a 10-qubit quantum processor with 99.8% two-qubit gate fidelity.";
    let target = "Previous results showed limitations. In this work, we demonstrate a 10-qubit quantum processor with 99.8% two-qubit gate fidelity. Furthermore, cryogenic performance was stable.";

    let target_offset = target.find("In this work").unwrap() as i64;
    let source_offset = source.find("In this work").unwrap() as i64;

    let (t_start, t_end, s_start, s_end) = IntegrityService::seed_and_extend(
        target,
        target_offset,
        source,
        source_offset,
        40,
    );

    assert_eq!(t_start, target_offset);
    assert_eq!(s_start, source_offset);
    assert!(t_end > t_start);
    assert_eq!(t_end - t_start, s_end - s_start);
}

#[test]
fn test_merge_overlapping_spans() {
    let spans = vec![(10, 50), (40, 80), (120, 160), (150, 200)];
    let merged = IntegrityService::merge_overlapping_spans(&spans);

    assert_eq!(merged.len(), 2);
    assert_eq!(merged[0], (10, 80));
    assert_eq!(merged[1], (120, 200));
}

#[test]
fn test_full_integrity_workflow_in_memory() {
    let db = Database::open_in_memory().expect("In-memory database should initialize");

    // 1. Index a known source paper into the local corpus
    let source_content = "Superconducting circuits are a leading platform for scalable quantum computing. \
                          We demonstrate a 64-qubit quantum processor operating at 15 mK dilution temperature \
                          with high-fidelity readout resonators and crosstalk suppression algorithms [1]. \
                          The measured average gate error was below 0.15% across all qubit pairs.";
    let source = IntegrityService::index_corpus_source(
        &db,
        "library_paper",
        "Scalable Superconducting Quantum Processor",
        source_content,
        Some("Alice Smith, Bob Jones"),
        Some("10.1038/s41586-021-0001-x"),
        Some("https://example.org/quantum-paper"),
        None,
    )
    .expect("Corpus source indexing should succeed");

    assert!(!source.id.is_empty());
    assert!(source.fingerprint_count > 0);

    // 2. Ingest a document that copies a section from the indexed source
    let target_doc_content = "Quantum technology continues to advance rapidly across multiple research institutions. \
                              Superconducting circuits are a leading platform for scalable quantum computing. \
                              We demonstrate a 64-qubit quantum processor operating at 15 mK dilution temperature \
                              with high-fidelity readout resonators and crosstalk suppression algorithms [1]. \
                              The measured average gate error was below 0.15% across all qubit pairs. \
                              In future research we plan to implement surface code error correction.";
    let doc = IntegrityService::ingest_document(
        &db,
        "pasted_text",
        "quantum_review.txt",
        Some("txt"),
        target_doc_content,
    )
    .expect("Document ingestion should succeed");

    assert!(!doc.id.is_empty());
    assert!(doc.word_count > 40);

    // 3. Run similarity check
    let report = IntegrityService::run_similarity_check(&db, &doc.id)
        .expect("Similarity check should run cleanly");

    assert_eq!(report.run.status, "completed");
    assert!(report.run.matches_count > 0, "Should detect matching passage from corpus");
    assert!(report.run.overall_similarity_ratio > 0.40, "Similarity ratio should reflect copied passage");
    assert_eq!(report.matches[0].source_title, "Scalable Superconducting Quantum Processor");

    // 4. Update match review status
    let match_id = &report.matches[0].match_data.id;
    let review_ok = IntegrityService::update_match_review_status(
        &db,
        match_id,
        "marked_quote",
        Some("Direct quotation properly attributed in introduction"),
    )
    .expect("Review status update should succeed");
    assert!(review_ok);

    // 5. Run AI writing signal check on short document (< 80 words) -> honest insufficient_text
    let ai_run_short = IntegrityService::run_ai_signal_check(&db, &doc.id, None)
        .expect("AI signal check should run");
    assert_eq!(ai_run_short.status, "insufficient_text", "Must honestly report insufficient_text for <80 words");
    assert_eq!(ai_run_short.signal_classification, "insufficient_text");
    assert!(!ai_run_short.uncertainty_caveat.is_empty(), "Must always include uncertainty caveat");

    // Ingest a longer document (>80 words) to test completed AI signal analysis
    let long_text = "Superconducting circuits represent an established experimental paradigm for quantum information processing. \
                     In this investigation, we synthesize a multi-layer microwave resonator network designed for dispersive readout. \
                     By controlling Josephson junction inductance and shunt capacitance, we systematically evaluate single-qubit relaxation times. \
                     The observed T1 lifetimes average 85 microseconds across four independent fabrication cycles. \
                     Furthermore, randomized benchmarking confirms single-qubit Clifford gate errors below 0.04%. \
                     Cross-resonance gate calibration indicates minimal spectator qubit dephasing during simultaneous operation. \
                     These findings confirm that microwave shielding significantly mitigates stray thermal photon occupation in millikelvin stages.";
    let long_doc = IntegrityService::ingest_document(&db, "pasted_text", "long_quantum.txt", Some("txt"), long_text)
        .expect("Long document ingestion should succeed");
    assert!(long_doc.word_count >= 80);

    let ai_run_long = IntegrityService::run_ai_signal_check(&db, &long_doc.id, None)
        .expect("AI signal check on long document should run");
    assert_eq!(ai_run_long.status, "completed");
    assert!(ai_run_long.overall_signal_score.is_some());
    assert!(!ai_run_long.uncertainty_caveat.is_empty());

    // 6. Test Academic Writing Assistant with token preservation validation
    let session = IntegrityService::create_writing_session(&db, &doc.id, "Draft Revision 1")
        .expect("Writing session should be created");


    let rev = IntegrityService::generate_writing_revision(&db, &session.id, "academic_tone", None)
        .expect("Writing revision should generate");

    assert!(rev.preserved_numbers_ok, "Preserved numbers (64, 15, 0.15) must be intact");
    assert!(rev.preserved_citations_ok, "Preserved citation [1] must be intact");

    // 7. Dashboard summary
    let summary = IntegrityService::get_dashboard_summary(&db)
        .expect("Dashboard summary should compute");
    assert_eq!(summary.total_documents_analyzed, 2);
    assert_eq!(summary.total_corpus_sources, 1);
    assert!(summary.total_fingerprints_indexed > 0);
}

