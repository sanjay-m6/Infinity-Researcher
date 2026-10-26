use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::paper::{Author, Paper, PaperCreateInput};
use research_paper_scraper_lib::scrapers::url_guard::{UrlGuard, UrlValidationError};
use research_paper_scraper_lib::services::file_integrity::FileIntegrityService;
use research_paper_scraper_lib::services::pdf_processor::{PdfProcessor, PdfVerificationStatus};
use research_paper_scraper_lib::services::{ExportService, PaperService};
use std::fs::File;
use std::io::Write;

#[test]
fn test_ssrf_and_url_security_validations() {
    // 1. Forbidden schemes
    let schemes = [
        "file:///etc/passwd",
        "file:///C:/Windows/System32/cmd.exe",
        "javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "ftp://ftp.example.com/paper.pdf",
        "chrome://settings",
    ];
    for url in schemes {
        let res = UrlGuard::validate_url(url);
        assert!(
            res.is_err(),
            "Expected scheme error for unsafe url: {}",
            url
        );
    }

    // 2. Embedded credentials
    let cred_urls = [
        "http://admin:secret@example.com/paper",
        "https://user:password@arxiv.org/abs/1234",
        "https://api_key:@example.com/doc",
    ];
    for url in cred_urls {
        assert_eq!(
            UrlGuard::validate_url(url),
            Err(UrlValidationError::ContainsCredentials),
            "Expected ContainsCredentials for {}",
            url
        );
    }

    // 3. Blocked loopback and private IPv4 / IPv6 addresses
    let blocked_ips = [
        "http://127.0.0.1/admin",
        "http://127.100.50.1/status",
        "http://localhost:8080/metrics",
        "http://sub.localhost/api",
        "http://node.local/data",
        "http://service.internal/secret",
        "http://10.0.0.1/private",
        "http://10.255.255.254/internal",
        "http://172.16.0.1/server",
        "http://172.31.255.255/meta",
        "http://192.168.1.1/router",
        "http://192.168.100.50/setup",
        "http://169.254.169.254/latest/meta-data/", // AWS/GCP cloud metadata
        "http://169.254.1.1/link-local",
        "http://100.64.0.1/carrier-nat",
        "http://[::1]/ipv6-loopback",
        "http://[fe80::1]/link-local-ipv6",
        "http://[fc00::1]/unique-local-ipv6",
    ];
    for url in blocked_ips {
        let res = UrlGuard::validate_url(url);
        assert!(
            matches!(res, Err(UrlValidationError::BlockedPrivateIp(_))),
            "Expected BlockedPrivateIp for {}: got {:?}",
            url,
            res
        );
    }

    // 4. Valid public academic URLs must pass
    let valid_urls = [
        "https://arxiv.org/abs/1706.03762",
        "https://api.semanticscholar.org/graph/v1/paper/10.1101/2026.01.01",
        "https://www.nature.com/articles/s41586-020-2649-2",
        "https://ieeexplore.ieee.org/document/8099726",
    ];
    for url in valid_urls {
        assert!(
            UrlGuard::validate_url(url).is_ok(),
            "Expected valid URL to pass: {}",
            url
        );
    }
}

#[test]
fn test_filesystem_path_traversal_defenses() {
    let temp_root = std::env::temp_dir().join(format!("sec_fs_{}", uuid::Uuid::new_v4()));
    let storage_dir = temp_root.join("storage");
    std::fs::create_dir_all(&storage_dir).unwrap();

    // 1. Path containing ".." must be rejected
    let traversal = storage_dir.join("../secret.txt");
    let res = FileIntegrityService::validate_file_path(&storage_dir, &traversal);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("Path traversal"));

    // 2. Safe file within storage directory
    let safe_file = storage_dir.join("document.pdf");
    {
        let mut f = File::create(&safe_file).unwrap();
        f.write_all(b"%PDF-1.4 Minimal test").unwrap();
    }
    let validated = FileIntegrityService::validate_file_path(&storage_dir, &safe_file);
    assert!(validated.is_ok());

    // Clean up
    let _ = std::fs::remove_dir_all(&temp_root);
}

#[test]
fn test_csv_formula_injection_defense() {
    let test_cases = [
        ("=1+1", "\"'=1+1\""),
        ("+cmd|' /C calc'!A0", "\"'+cmd|' /C calc'!A0\""),
        ("-2+3*4", "\"'-2+3*4\""),
        ("@SUM(A1:A10)", "\"'@SUM(A1:A10)\""),
        ("\t=DDE()", "\"'\t=DDE()\""),
        ("\r=cmd()", "\"'\r=cmd()\""),
        ("   =SUM(1,2)", "\"'   =SUM(1,2)\""),
        ("  +alert(1)", "\"'  +alert(1)\""),
        (
            "Normal Title with \"Quotes\"",
            "\"Normal Title with \"\"Quotes\"\"\"",
        ),
    ];

    for (input, expected) in test_cases {
        let escaped = ExportService::escape_csv_cell(input);
        assert_eq!(
            escaped, expected,
            "Failed formula injection defense for input: {}",
            input
        );
    }
}

#[test]
fn test_bibtex_character_escaping() {
    let test_string = "Research & Development: 100% of $10, #1_Choice {Draft} ~ Test ^ Slash \\";
    let escaped = ExportService::escape_bibtex(test_string);

    assert!(escaped.contains("\\&"));
    assert!(escaped.contains("\\%"));
    assert!(escaped.contains("\\$"));
    assert!(escaped.contains("\\#"));
    assert!(escaped.contains("\\_"));
    assert!(escaped.contains("\\{"));
    assert!(escaped.contains("\\}"));
    assert!(escaped.contains("\\textasciitilde{}"));
    assert!(escaped.contains("\\textasciicircum{}"));
    assert!(escaped.contains("\\textbackslash{}"));
}

#[test]
fn test_citation_serializers_roundtrip_integrity() {
    let paper = Paper {
        id: "paper-test-uuid-001".to_string(),
        canonical_doi: Some("10.1234/test.2026".to_string()),
        title: "Robustness in Modern Distributed Systems".to_string(),
        clean_title_key: "robustnessinmoderndistributedsystems".to_string(),
        abstract_text: Some(
            "This paper studies fault tolerance and crash recovery under network partitions."
                .to_string(),
        ),
        publication_date: Some("2026-05-10".to_string()),
        publication_year: Some(2026),
        venue: Some("IEEE Transactions on Dependable Computing".to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 42,
        reference_count: 18,
        is_open_access: true,
        license: Some("CC-BY-4.0".to_string()),
        primary_landing_url: Some("https://example.org/papers/10.1234/test.2026".to_string()),
        pdf_url: Some("https://example.org/papers/10.1234/test.2026.pdf".to_string()),
        has_file: true,
        local_pdf_path: Some("storage/papers/10.1234.pdf".to_string()),
        content_hash: Some("abcd1234ef5678".to_string()),
        metadata_confidence: "verified".to_string(),
        is_saved: true,
        reading_status: "reading".to_string(),
        reading_progress: 0.65,
        authors: vec![
            Author {
                id: "auth-1".to_string(),
                full_name: "Alice Researcher".to_string(),
                family_name: Some("Researcher".to_string()),
                given_name: Some("Alice".to_string()),
                orcid: None,
                affiliation: None,
                author_order: 0,
                created_at: "2026-05-10T12:00:00Z".to_string(),
            },
            Author {
                id: "auth-2".to_string(),
                full_name: "Bob Engineer".to_string(),
                family_name: Some("Engineer".to_string()),
                given_name: Some("Bob".to_string()),
                orcid: None,
                affiliation: None,
                author_order: 1,
                created_at: "2026-05-10T12:00:00Z".to_string(),
            },
        ],
        collection_ids: vec!["col-1".to_string()],
        tags: vec![
            "Distributed Systems".to_string(),
            "Fault Tolerance".to_string(),
        ],
        created_at: "2026-05-10T12:00:00Z".to_string(),
        updated_at: "2026-05-10T12:00:00Z".to_string(),
        ..Default::default()
    };

    let papers = vec![paper];

    // 1. BibTeX
    let bib = ExportService::serialize_bibtex(&papers);
    assert!(bib.contains("@article{"));
    assert!(bib.contains("Robustness in Modern Distributed Systems"));
    assert!(bib.contains("Alice Researcher and Bob Engineer"));
    assert!(bib.contains("10.1234/test.2026"));

    // 2. RIS
    let ris = ExportService::serialize_ris(&papers);
    assert!(ris.contains("TY  - JOUR"));
    assert!(ris.contains("TI  - Robustness in Modern Distributed Systems"));
    assert!(ris.contains("AU  - Alice Researcher"));
    assert!(ris.contains("AU  - Bob Engineer"));
    assert!(ris.contains("PY  - 2026"));
    assert!(ris.contains("ER  - \n"));

    // 3. CSV
    let csv = ExportService::serialize_csv(&papers);
    assert!(csv.contains("\"ID\",\"Title\",\"Authors\""));
    assert!(csv.contains("\"Robustness in Modern Distributed Systems\""));
    assert!(csv.contains("\"Alice Researcher; Bob Engineer\""));
    assert!(csv.contains("\"reading\""));

    // 4. JSON
    let json_str = ExportService::serialize_json(&papers).expect("JSON serialization failed");
    let json_val: serde_json::Value = serde_json::from_str(&json_str).expect("Valid JSON");
    assert_eq!(json_val["schema_version"], 1);
    assert_eq!(json_val["total_records"], 1);
    assert_eq!(
        json_val["papers"][0]["title"],
        "Robustness in Modern Distributed Systems"
    );
}

#[test]
fn test_pdf_processor_corrupt_and_missing_handling() {
    let temp_dir = std::env::temp_dir().join(format!("pdf_test_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();

    // 1. Missing file
    let missing_path = temp_dir.join("non_existent.pdf");
    let meta_missing = PdfProcessor::process_pdf_file(&missing_path);
    assert_eq!(meta_missing.status, PdfVerificationStatus::Missing.as_str());

    // 2. Corrupt / fake non-PDF file
    let corrupt_path = temp_dir.join("corrupt.pdf");
    {
        let mut f = File::create(&corrupt_path).unwrap();
        f.write_all(b"<html><body>502 Bad Gateway</body></html>")
            .unwrap();
    }
    let meta_corrupt = PdfProcessor::process_pdf_file(&corrupt_path);
    assert_eq!(meta_corrupt.status, PdfVerificationStatus::Corrupt.as_str());

    // 3. Valid minimal synthetic PDF
    let valid_path = temp_dir.join("valid.pdf");
    PdfProcessor::create_test_pdf(&valid_path).expect("create test pdf failed");
    let meta_valid = PdfProcessor::process_pdf_file(&valid_path);
    assert!(
        meta_valid.status == PdfVerificationStatus::Verified.as_str()
            || meta_valid.status == PdfVerificationStatus::NoText.as_str()
    );
    assert_eq!(meta_valid.page_count, 1);

    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_transactional_rollback_on_failed_database_operation() {
    let db = Database::open_in_memory().expect("failed to open test db");

    // Seed a valid paper
    let input = PaperCreateInput {
        title: "Original Paper on Reliability".to_string(),
        canonical_doi: Some("10.5555/rel.2026".to_string()),
        abstract_text: None,
        publication_date: Some("2026-01-01".to_string()),
        publication_year: Some(2026),
        venue: None,
        venue_type: None,
        language: None,
        is_open_access: None,
        primary_landing_url: None,
        pdf_url: None,
        is_saved: Some(true),
        authors: vec!["Reliability Author".to_string()],
        collection_ids: None,
        tags: None,
        source_id: None,
        reading_status: None,
        reading_progress: None,
        ..Default::default()
    };
    let created = PaperService::create_paper(&db, input).expect("seed failed");

    // Attempt an illegal operation inside a transactional block:
    // Try to insert a second paper with an identical DOI, which must fail and rollback.
    let duplicate_input = PaperCreateInput {
        title: "Conflicting Duplicate".to_string(),
        canonical_doi: Some("10.5555/rel.2026".to_string()),
        abstract_text: None,
        publication_date: None,
        publication_year: Some(2026),
        venue: None,
        venue_type: None,
        language: None,
        is_open_access: None,
        primary_landing_url: None,
        pdf_url: None,
        is_saved: Some(true),
        authors: vec![],
        collection_ids: None,
        tags: None,
        source_id: None,
        reading_status: None,
        reading_progress: None,
        ..Default::default()
    };

    let result = PaperService::create_paper(&db, duplicate_input);
    assert!(result.is_err(), "Duplicate DOI insert must fail");

    // Verify database state is untouched and original paper exists unaltered
    let original = PaperService::get_paper(&db, &created.id)
        .expect("query failed")
        .expect("original paper must exist");
    assert_eq!(original.title, "Original Paper on Reliability");
}
