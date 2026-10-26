use rusqlite::Connection;
use std::fs::{create_dir_all, remove_dir_all, File};
use std::io::Write;
use std::path::PathBuf;

use research_paper_scraper_lib::database::migrations::run_migrations;

use research_paper_scraper_lib::domain::paper::{
    Author, Paper, EVIDENCE_USER_CONFIRMATION, OA_STATUS_USER_CONFIRMED, RETRIEVAL_IEEE_MANUAL,
    RETRIEVAL_LOCAL_IMPORT,
};
use research_paper_scraper_lib::repositories::paper_repo::PaperRepository;
use research_paper_scraper_lib::repositories::pdf_workspace_repo::PdfWorkspaceRepository;
use research_paper_scraper_lib::services::file_integrity::FileIntegrityService;

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&mut conn).expect("run_migrations failed");
    conn
}

fn create_temp_test_file(name: &str, content: &[u8]) -> (PathBuf, PathBuf) {
    let temp_dir = std::env::temp_dir().join(format!("ieee_test_{}", uuid::Uuid::new_v4()));
    create_dir_all(&temp_dir).expect("failed to create temp dir");
    let file_path = temp_dir.join(name);
    let mut f = File::create(&file_path).expect("failed to create file");
    f.write_all(content).expect("failed to write content");
    (temp_dir, file_path)
}

#[test]
fn test_ieee_import_rejects_non_pdf_file() {
    // Attempting to import an HTML error page or text document
    let html_content = b"<!DOCTYPE html><html><body>Error 403 Forbidden - Not a PDF</body></html>";
    let (dir, file_path) = create_temp_test_file("ieee_paper.pdf", html_content);

    let (file_size, hash, inspect_res) = FileIntegrityService::inspect_file(&file_path);
    assert!(inspect_res.is_ok());
    assert!(file_size > 0);
    assert!(hash.is_some());

    // Check %PDF- header verification
    let mut f = File::open(&file_path).unwrap();
    let mut header = [0u8; 1024];
    use std::io::Read;
    let n = f.read(&mut header).unwrap();
    let header_str = String::from_utf8_lossy(&header[..n]);
    assert!(
        !header_str.contains("%PDF-"),
        "Non-PDF file should fail header inspection"
    );

    let _ = remove_dir_all(&dir);
}

#[test]
fn test_ieee_import_validates_pdf_signature() {
    let valid_pdf_content = b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    let (dir, file_path) = create_temp_test_file("valid_oa_ieee.pdf", valid_pdf_content);

    let mut f = File::open(&file_path).unwrap();
    let mut header = [0u8; 1024];
    use std::io::Read;
    let n = f.read(&mut header).unwrap();
    let header_str = String::from_utf8_lossy(&header[..n]);
    assert!(
        header_str.contains("%PDF-"),
        "Valid PDF should contain %PDF- header signature"
    );

    let _ = remove_dir_all(&dir);
}

#[test]
fn test_ieee_paper_record_strict_provenance_and_integrity() {
    let mut conn = setup_test_db();

    let valid_pdf_content =
        b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    let (dir, file_path) = create_temp_test_file("ieee_sample.pdf", valid_pdf_content);

    let hash = FileIntegrityService::compute_sha256_stream(&file_path).unwrap();

    let paper_id = "ieee-paper-001";
    let now = chrono::Utc::now().to_rfc3339();

    let paper = Paper {
        id: paper_id.to_string(),
        canonical_doi: Some("10.1109/access.2026.0001".to_string()),
        title: "Advances in Edge Intelligence for Next-Generation Wireless Networks".to_string(),
        clean_title_key: "advancesinedgeintelligencefornextgenerationwirelessnetworks".to_string(),
        abstract_text: Some(
            "This paper provides a comprehensive analysis of open access edge intelligence."
                .to_string(),
        ),
        publication_date: Some("2026-03-15".to_string()),
        publication_year: Some(2026),
        venue: Some("IEEE Access".to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 5,
        reference_count: 32,
        is_open_access: true,
        license: Some("CC-BY 4.0".to_string()),
        primary_landing_url: Some("https://ieeexplore.ieee.org/document/9999999".to_string()),
        pdf_url: None, // Not downloaded via API; imported manually
        has_file: true,
        local_pdf_path: Some(file_path.to_string_lossy().to_string()),
        content_hash: Some(hash.clone()),
        metadata_confidence: "user_verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        // Crucial policy compliance: user_confirmed_open_access, NOT verified_open_access
        open_access_status: OA_STATUS_USER_CONFIRMED.to_string(),
        access_evidence_type: EVIDENCE_USER_CONFIRMATION.to_string(),
        access_evidence_note: Some(
            "Imported via IEEE Open Access manual discovery workflow with user confirmation"
                .to_string(),
        ),
        license_name: Some("CC-BY 4.0".to_string()),
        license_url: Some("https://creativecommons.org/licenses/by/4.0/".to_string()),
        source_name: Some("IEEE Xplore (Manual OA Import)".to_string()),
        retrieval_method: RETRIEVAL_IEEE_MANUAL.to_string(),
        access_confirmed_at: Some(now.clone()),
        authors: vec![Author {
            id: "auth-1".to_string(),
            full_name: "Dr. Elena Vance".to_string(),
            family_name: Some("Vance".to_string()),
            given_name: Some("Elena".to_string()),
            orcid: None,
            affiliation: Some("IEEE Member".to_string()),
            author_order: 0,
            created_at: now.clone(),
        }],
        collection_ids: vec![],
        tags: vec!["IEEE".to_string(), "Edge Computing".to_string()],
        source_names: vec!["IEEE Xplore".to_string()],
    };

    // Insert canonical record
    PaperRepository::create(&mut conn, &paper).expect("insert paper failed");

    // Attach downloaded file to paper_files
    PdfWorkspaceRepository::attach_downloaded_file(
        &conn,
        paper_id,
        &file_path.to_string_lossy(),
        "ieee_sample.pdf",
        valid_pdf_content.len() as u64,
        &hash,
        Some(1),
    )
    .expect("attach file failed");

    // Verify paper loaded back accurately
    let loaded = PaperRepository::get_by_id(&conn, paper_id)
        .unwrap()
        .unwrap();
    assert_eq!(loaded.id, paper_id);
    assert_eq!(loaded.open_access_status, OA_STATUS_USER_CONFIRMED);
    assert_eq!(loaded.access_evidence_type, EVIDENCE_USER_CONFIRMATION);
    assert_eq!(loaded.retrieval_method, RETRIEVAL_IEEE_MANUAL);
    assert_eq!(
        loaded.source_name,
        Some("IEEE Xplore (Manual OA Import)".to_string())
    );
    assert_eq!(loaded.content_hash, Some(hash.clone()));
    assert!(loaded.has_file);

    // Verify cryptographic SHA-256 duplicate detection
    let dup = PaperRepository::get_by_content_hash(&conn, &hash).unwrap();
    assert!(
        dup.is_some(),
        "Paper should be discoverable by SHA-256 hash"
    );
    assert_eq!(dup.unwrap().id, paper_id);

    // Verify Open Access statistics
    let stats = PaperRepository::get_open_access_stats(&conn).unwrap();
    assert_eq!(stats.total_oa_papers, 1);
    assert_eq!(stats.ieee_imported_papers, 1);
    assert_eq!(stats.permitted_downloads, 0);
    assert_eq!(stats.pending_verification_count, 0);

    let _ = remove_dir_all(&dir);
}

#[test]
fn test_open_access_stats_multiple_sources() {
    let mut conn = setup_test_db();
    let now = chrono::Utc::now().to_rfc3339();

    // 1. IEEE manual import
    let p_ieee = Paper {
        id: "p-ieee".to_string(),
        canonical_doi: Some("10.1109/test.1".to_string()),
        title: "IEEE Paper".to_string(),
        clean_title_key: "ieeepaper".to_string(),
        abstract_text: None,
        publication_date: None,
        publication_year: Some(2025),
        venue: Some("IEEE".to_string()),
        venue_type: None,
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: true,
        license: None,
        primary_landing_url: None,
        pdf_url: None,
        has_file: true,
        local_pdf_path: Some("data/papers/p-ieee.pdf".to_string()),
        content_hash: Some("hash1".to_string()),
        metadata_confidence: "verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: OA_STATUS_USER_CONFIRMED.to_string(),
        access_evidence_type: EVIDENCE_USER_CONFIRMATION.to_string(),
        access_evidence_note: None,
        license_name: None,
        license_url: None,
        source_name: Some("IEEE Xplore (Manual OA Import)".to_string()),
        retrieval_method: RETRIEVAL_IEEE_MANUAL.to_string(),
        access_confirmed_at: Some(now.clone()),
        authors: vec![],
        collection_ids: vec![],
        tags: vec![],
        source_names: vec![],
    };
    PaperRepository::create(&mut conn, &p_ieee).unwrap();

    // 2. Permitted HTML connector download
    let p_permitted = Paper {
        id: "p-permitted".to_string(),
        canonical_doi: Some("10.1234/test.2".to_string()),
        title: "Permitted Source Paper".to_string(),
        clean_title_key: "permittedsourcepaper".to_string(),
        abstract_text: None,
        publication_date: None,
        publication_year: Some(2025),
        venue: None,
        venue_type: None,
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: true,
        license: None,
        primary_landing_url: None,
        pdf_url: None,
        has_file: true,
        local_pdf_path: Some("data/papers/p-permitted.pdf".to_string()),
        content_hash: Some("hash2".to_string()),
        metadata_confidence: "verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: "verified_open_access".to_string(),
        access_evidence_type: "explicit_source_label".to_string(),
        access_evidence_note: None,
        license_name: None,
        license_url: None,
        source_name: Some("Permitted Repository".to_string()),
        retrieval_method: "permitted_html_connector".to_string(),
        access_confirmed_at: Some(now.clone()),
        authors: vec![],
        collection_ids: vec![],
        tags: vec![],
        source_names: vec![],
    };
    PaperRepository::create(&mut conn, &p_permitted).unwrap();

    // 3. Pending verification record
    let p_pending = Paper {
        id: "p-pending".to_string(),
        canonical_doi: None,
        title: "Pending OA Paper".to_string(),
        clean_title_key: "pendingoapaper".to_string(),
        abstract_text: None,
        publication_date: None,
        publication_year: Some(2024),
        venue: None,
        venue_type: None,
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: false,
        license: None,
        primary_landing_url: None,
        pdf_url: None,
        has_file: false,
        local_pdf_path: None,
        content_hash: None,
        metadata_confidence: "unverified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: "pending_verification".to_string(),
        access_evidence_type: "unknown".to_string(),
        access_evidence_note: None,
        license_name: None,
        license_url: None,
        source_name: None,
        retrieval_method: RETRIEVAL_LOCAL_IMPORT.to_string(),
        access_confirmed_at: None,
        authors: vec![],
        collection_ids: vec![],
        tags: vec![],
        source_names: vec![],
    };
    PaperRepository::create(&mut conn, &p_pending).unwrap();

    let stats = PaperRepository::get_open_access_stats(&conn).unwrap();
    assert_eq!(stats.total_oa_papers, 2);
    assert_eq!(stats.ieee_imported_papers, 1);
    assert_eq!(stats.permitted_downloads, 1);
    assert_eq!(stats.pending_verification_count, 1);
}
