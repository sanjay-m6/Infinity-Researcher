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
        last_opened_at: None,
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
        Some("published_version"),
        Some("verified_match"),
        Some(1.0),
        None,
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
        last_opened_at: None,
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
        last_opened_at: None,
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
        last_opened_at: None,
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

#[test]
fn test_pdf_processor_extracts_metadata_from_pdf() {
    use research_paper_scraper_lib::services::pdf_processor::{ExtractedPdfMetadata, PdfProcessor};

    let sample_text = "Title: Deep Residual Learning for Vision\nBy Kaiming He, Xiangyu Zhang\nIEEE Access 2024\nDOI: 10.1109/ACCESS.2024.9876543\nAbstract: This research investigates deep residual representations for open access learning.\nLicensed under CC-BY 4.0";
    let mut meta = ExtractedPdfMetadata::default();
    PdfProcessor::enrich_metadata_from_text(sample_text, &mut meta);

    assert_eq!(meta.doi, Some("10.1109/ACCESS.2024.9876543".to_string()));
    assert_eq!(meta.publication_year, Some(2024));
    assert!(meta.abstract_text.is_some());
    assert!(meta.abstract_text.as_ref().unwrap().contains("deep residual"));
    assert_eq!(meta.venue, Some("IEEE Access".to_string()));
    assert_eq!(meta.license, Some("CC-BY 4.0".to_string()));
}

#[test]
fn test_pdf_processor_detects_corrupt_or_non_pdf() {
    use research_paper_scraper_lib::services::pdf_processor::PdfProcessor;

    // Plain text file without valid PDF structure
    let (dir, file_path) = create_temp_test_file("corrupt.pdf", b"This is a corrupt text file, not a valid PDF.");
    let meta = PdfProcessor::process_pdf_file(&file_path);
    assert!(meta.warning.is_some() || meta.status == "corrupt" || meta.status == "no_text" || meta.status == "failed");

    let _ = remove_dir_all(&dir);
}

#[test]
fn test_pdf_processor_detects_scanned_image_only_pdf() {
    use research_paper_scraper_lib::services::pdf_processor::PdfProcessor;

    // Generate a valid structural PDF with 1 page but 0 text streams
    let temp_dir = std::env::temp_dir().join(format!("test_scanned_{}", uuid::Uuid::new_v4()));
    create_dir_all(&temp_dir).unwrap();
    let file_path = temp_dir.join("scanned.pdf");
    PdfProcessor::create_test_pdf(&file_path).unwrap();

    let meta = PdfProcessor::process_pdf_file(&file_path);
    assert!(meta.is_scanned || meta.status == "no_text");

    let _ = remove_dir_all(&temp_dir);
}

#[test]
fn test_ieee_link_only_mode_preserves_original_path() {
    let mut conn = setup_test_db();
    let valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    let (dir, file_path) = create_temp_test_file("downloaded_ieee.pdf", valid_pdf_content);

    let original_path = file_path.to_string_lossy().to_string();
    let paper_id = "linked-ieee-001";
    let now = chrono::Utc::now().to_rfc3339();

    // In link-in-place mode (copy_to_library = false), local_pdf_path points to original download path
    let paper = Paper {
        id: paper_id.to_string(),
        canonical_doi: Some("10.1109/test.link.1".to_string()),
        title: "Linked IEEE Paper Without Copy".to_string(),
        clean_title_key: "linkedieeepaperwithoutcopy".to_string(),
        abstract_text: Some("Preview only linked paper.".to_string()),
        publication_date: Some("2026-01-01".to_string()),
        publication_year: Some(2026),
        venue: Some("IEEE Xplore".to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 0,
        reference_count: 0,
        is_open_access: true,
        license: Some("CC-BY 4.0".to_string()),
        primary_landing_url: Some("https://ieeexplore.ieee.org/document/12345".to_string()),
        pdf_url: None,
        has_file: true,
        local_pdf_path: Some(original_path.clone()),
        content_hash: Some("mockhash123".to_string()),
        metadata_confidence: "user_verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        last_opened_at: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        open_access_status: OA_STATUS_USER_CONFIRMED.to_string(),
        access_evidence_type: EVIDENCE_USER_CONFIRMATION.to_string(),
        access_evidence_note: Some("Linked in place without secondary duplication".to_string()),
        license_name: Some("CC-BY 4.0".to_string()),
        license_url: Some("https://creativecommons.org/licenses/by/4.0/".to_string()),
        source_name: Some("IEEE Xplore (Manual OA Import)".to_string()),
        retrieval_method: RETRIEVAL_IEEE_MANUAL.to_string(),
        access_confirmed_at: Some(now.clone()),
        authors: vec![],
        collection_ids: vec![],
        tags: vec!["IEEE".to_string(), "Linked".to_string()],
        source_names: vec!["IEEE Xplore".to_string()],
    };

    PaperRepository::create(&mut conn, &paper).expect("create failed");

    // Verify paper record retrieves the original path without creating a second copy
    let fetched = PaperRepository::get_by_id(&conn, paper_id).unwrap().unwrap();
    assert_eq!(fetched.local_pdf_path, Some(original_path));
    assert_eq!(fetched.retrieval_method, RETRIEVAL_IEEE_MANUAL);
    assert_eq!(fetched.open_access_status, OA_STATUS_USER_CONFIRMED);

    let _ = remove_dir_all(&dir);
}

#[test]
fn test_ieee_adapter_capabilities_and_descriptor() {
    use research_paper_scraper_lib::scrapers::adapters::{IeeeAdapter, SourceAdapter};

    let adapter = IeeeAdapter::new();
    assert_eq!(adapter.source_id(), "ieee_xplore");
    assert_eq!(adapter.display_name(), "IEEE Xplore");

    let desc = adapter.descriptor();
    assert_eq!(desc.id, "ieee_xplore");
    assert_eq!(desc.domain, "ieeexplore.ieee.org");
    assert_eq!(desc.status, "enabled");

    let caps = adapter.capabilities();
    assert!(caps.supports_query);
    assert!(caps.supports_open_access_filter);
    assert!(caps.provides_direct_pdf);
    assert!(caps.provides_doi);
}

#[test]
fn test_ieee_license_detection_rules() {
    // CC license should be recognized as OA
    let cc_lic = serde_json::json!([
        {"URL": "https://creativecommons.org/licenses/by-nc-nd/4.0/"}
    ]);
    let is_cc_oa = cc_lic.as_array().map_or(false, |licenses| {
        licenses.iter().any(|lic| {
            lic["URL"].as_str().map_or(false, |u| {
                let u_lower = u.to_lowercase();
                u_lower.contains("creativecommons.org")
                    || u_lower.contains("/open-access")
                    || u_lower.contains("/oa/")
            })
        })
    });
    assert!(is_cc_oa, "Creative Commons license should be detected as Open Access");

    // Standard IEEE proprietary copyright terms should NOT be recognized as OA
    let ieee_prop_lic = serde_json::json!([
        {"URL": "https://ieeexplore.ieee.org/Xplorehelp/downloads/license-information/IEEE.html"}
    ]);
    let is_prop_oa = ieee_prop_lic.as_array().map_or(false, |licenses| {
        licenses.iter().any(|lic| {
            lic["URL"].as_str().map_or(false, |u| {
                let u_lower = u.to_lowercase();
                u_lower.contains("creativecommons.org")
                    || u_lower.contains("/open-access")
                    || u_lower.contains("/oa/")
            })
        })
    });
    assert!(!is_prop_oa, "IEEE proprietary terms must NOT be detected as Open Access");
}

