use research_paper_scraper_lib::database::migrations::run_migrations;
use research_paper_scraper_lib::domain::pdf_workspace::{
    DownloadJob, PdfAvailabilityStatus, PdfCandidate,
};
use research_paper_scraper_lib::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use research_paper_scraper_lib::services::pdf_processor::{ExtractedPdfMetadata, PdfProcessor};
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&mut conn).expect("run_migrations failed");
    conn
}

fn create_sample_extracted_metadata(
    title: &str,
    text: &str,
    doi: Option<&str>,
) -> ExtractedPdfMetadata {
    ExtractedPdfMetadata {
        title: Some(title.to_string()),
        author: None,
        authors: vec!["Ashish Vaswani".to_string()],
        creator: None,
        producer: None,
        creation_date: None,
        publication_year: Some(2017),
        page_count: 15,
        text_preview: Some(text.to_string()),
        full_text: Some(text.to_string()),
        doi: doi.map(|d| d.to_string()),
        abstract_text: None,
        venue: None,
        license: None,
        status: "verified".to_string(),
        is_encrypted: false,
        is_scanned: false,
        warning: None,
        identity_reconciled: false,
        identity_score: 0.0,
        identity_status: "unknown".to_string(),
        reconciliation_notes: None,
        version_type: None,
    }
}

#[test]
fn test_reconcile_identity_verified_match() {
    let sample_pdf_text = r#"
        Attention Is All You Need
        Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit,
        Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin
        arXiv:1706.03762v5 [cs.CL]
        doi: 10.48550/arXiv.1706.03762
        Abstract
        The dominant sequence transduction models are based on complex recurrent or
        convolutional neural networks that include an encoder and a decoder.
    "#;

    let mut extracted = create_sample_extracted_metadata(
        "Attention Is All You Need",
        sample_pdf_text,
        Some("10.48550/arXiv.1706.03762"),
    );

    let authors = vec!["Vaswani".to_string(), "Shazeer".to_string()];
    let is_match = PdfProcessor::reconcile_identity(
        &mut extracted,
        "Attention Is All You Need",
        &authors,
        Some("10.48550/arXiv.1706.03762"),
    );

    assert!(
        is_match,
        "Reconciliation should return true for matching paper"
    );
    assert_eq!(extracted.identity_status, "verified_match");
    assert!(
        extracted.identity_score >= 0.85,
        "Expected high confidence score >= 0.85, got {}",
        extracted.identity_score
    );
    assert_eq!(extracted.version_type.as_deref(), Some("preprint"));
}

#[test]
fn test_reconcile_identity_wrong_document_conflicting_doi() {
    let conflicting_pdf_text = r#"
        High-Performance Machine Learning with Graphs
        Author: Jane Doe, John Smith
        Published in IEEE Transactions on Big Data
        doi: 10.1109/tbdata.2023.1234567
        Abstract
        This paper investigates graph machine learning architectures for distributed computing.
    "#;

    let mut extracted = create_sample_extracted_metadata(
        "High-Performance Machine Learning with Graphs",
        conflicting_pdf_text,
        Some("10.1109/tbdata.2023.1234567"),
    );

    let authors = vec!["He".to_string(), "Zhang".to_string()];
    let is_match = PdfProcessor::reconcile_identity(
        &mut extracted,
        "Deep Residual Learning for Image Recognition",
        &authors,
        Some("10.1109/cvpr.2016.90"),
    );

    assert!(!is_match, "Reconciliation must reject conflicting paper");
    assert_eq!(
        extracted.identity_status, "wrong_document",
        "Must flag conflicting DOI as wrong_document"
    );
    assert!(extracted.identity_score < 0.2);
    assert!(extracted
        .reconciliation_notes
        .unwrap()
        .contains("Conflicting DOI found"));
}

#[test]
fn test_reconcile_identity_uncertain_scanned_or_short_text() {
    let very_short_text = "Page 1. Scanned Document Archive.";
    let mut extracted = create_sample_extracted_metadata("", very_short_text, None);
    extracted.title = None;
    extracted.is_scanned = true;

    let authors = vec!["Bohr".to_string()];
    let is_match = PdfProcessor::reconcile_identity(
        &mut extracted,
        "Historical Analysis of Quantum Mechanics Foundations",
        &authors,
        Some("10.1000/182"),
    );

    assert!(!is_match);
    assert_eq!(extracted.identity_status, "identity_uncertain");
    assert!(extracted.identity_score < 0.5);
}

#[test]
fn test_detect_version_type_heuristics() {
    let preprint_text = "Submitted to arXiv:2401.12345v1 [cs.AI]. This is a preprint under review.";
    assert_eq!(PdfProcessor::detect_version_type(preprint_text), "preprint");

    let aam_text = "This is the Author Accepted Manuscript (AAM) version following peer review.";
    assert_eq!(
        PdfProcessor::detect_version_type(aam_text),
        "accepted_manuscript"
    );

    let published_text = "Nature Vol 610. Published Version of Record. All rights reserved.";
    assert_eq!(
        PdfProcessor::detect_version_type(published_text),
        "published_version"
    );

    let unknown_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    assert_eq!(
        PdfProcessor::detect_version_type(unknown_text),
        "unknown_version"
    );
}

#[test]
fn test_pdf_workspace_repo_candidate_and_job_v15_columns() {
    let conn = setup_test_db();

    // Insert minimal test paper
    conn.execute(
        "INSERT INTO papers (id, title, clean_title_key, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
        rusqlite::params!["paper-test-1", "Quantum Entanglement", "quantum entanglement"],
    ).unwrap();

    let candidate = PdfCandidate {
        id: "cand-1".to_string(),
        paper_id: "paper-test-1".to_string(),
        url: "https://arxiv.org/pdf/2001.0001.pdf".to_string(),
        provider_id: "arxiv".to_string(),
        source_type: "direct_api".to_string(),
        access_status: PdfAvailabilityStatus::OpenAccessAvailable,
        evidence_notes: Some("Direct open access PDF".to_string()),
        version_type: Some("preprint".to_string()),
        identity_status: Some("verified_match".to_string()),
        identity_score: Some(0.95),
        provenance_json: Some(r#"{"provider":"arxiv"}"#.to_string()),
        last_checked_at: "2026-01-01T00:00:00Z".to_string(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
    };

    PdfWorkspaceRepository::save_pdf_candidate(&conn, &candidate).unwrap();
    let candidates = PdfWorkspaceRepository::get_pdf_candidates(&conn, "paper-test-1").unwrap();
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].version_type.as_deref(), Some("preprint"));
    assert_eq!(
        candidates[0].identity_status.as_deref(),
        Some("verified_match")
    );
    assert_eq!(candidates[0].identity_score, Some(0.95));

    let job = DownloadJob {
        id: "job-test-1".to_string(),
        paper_id: "paper-test-1".to_string(),
        paper_title: "Quantum Entanglement".to_string(),
        url: "https://arxiv.org/pdf/2001.0001.pdf".to_string(),
        source_id: "arxiv".to_string(),
        status: "completed".to_string(),
        bytes_downloaded: 1024000,
        total_bytes: 1024000,
        progress_percent: 100.0,
        stage_message: "Verified and committed".to_string(),
        error_message: None,
        destination_path: Some("/test/paper-test-1.pdf".to_string()),
        sha256_hash: Some("abcdef123456".to_string()),
        retry_count: 0,
        speed_bps: Some(500000),
        version_type: Some("preprint".to_string()),
        identity_status: Some("verified_match".to_string()),
        identity_score: Some(0.95),
        identity_notes: Some("Exact DOI and title shingle match".to_string()),
        started_at: Some("2026-01-01T00:00:01Z".to_string()),
        completed_at: Some("2026-01-01T00:00:03Z".to_string()),
        error_category: None,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:03Z".to_string(),
    };

    PdfWorkspaceRepository::create_download_job(&conn, &job).unwrap();
    let retrieved_job = PdfWorkspaceRepository::get_download_job(&conn, "job-test-1")
        .unwrap()
        .unwrap();
    assert_eq!(retrieved_job.version_type.as_deref(), Some("preprint"));
    assert_eq!(
        retrieved_job.identity_status.as_deref(),
        Some("verified_match")
    );
    assert_eq!(retrieved_job.identity_score, Some(0.95));
}
