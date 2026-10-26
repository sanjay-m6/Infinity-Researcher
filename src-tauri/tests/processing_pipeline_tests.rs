use rusqlite::Connection;
use std::fs::{create_dir_all, remove_dir_all, File};
use std::io::Write;
use std::path::Path;

use research_paper_scraper_lib::database::migrations::run_migrations;
use research_paper_scraper_lib::domain::paper::{Author, Paper};
use research_paper_scraper_lib::domain::processing::MergeRequest;
use research_paper_scraper_lib::repositories::paper_repo::PaperRepository;
use research_paper_scraper_lib::repositories::processing_repo::ProcessingRepository;
use research_paper_scraper_lib::services::file_integrity::FileIntegrityService;
use research_paper_scraper_lib::services::metadata_normalizer::MetadataNormalizer;
use research_paper_scraper_lib::services::paper_merger::PaperMerger;
use research_paper_scraper_lib::services::pdf_processor::PdfProcessor;
use research_paper_scraper_lib::services::processing_pipeline::ProcessingPipeline;

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&mut conn).expect("run_migrations failed");
    conn
}

fn create_sample_paper(
    id: &str,
    title: &str,
    doi: Option<&str>,
    year: Option<i32>,
    author: &str,
) -> Paper {
    Paper {
        id: id.to_string(),
        canonical_doi: doi.map(|d| d.to_string()),
        title: title.to_string(),
        clean_title_key: MetadataNormalizer::compute_title_key(title),
        abstract_text: Some(format!("Abstract text for {}", title)),
        publication_date: year.map(|y| format!("{}-05-12", y)),
        publication_year: year,
        venue: Some("Nature Journal".to_string()),
        venue_type: Some("journal".to_string()),
        language: "en".to_string(),
        citation_count: 42,
        reference_count: 15,
        is_open_access: true,
        license: Some("CC-BY".to_string()),
        primary_landing_url: Some(format!("https://example.com/papers/{}", id)),
        pdf_url: Some(format!("https://example.com/papers/{}.pdf", id)),
        has_file: false,
        local_pdf_path: None,
        content_hash: None,
        metadata_confidence: "verified".to_string(),
        is_saved: true,
        reading_status: "unread".to_string(),
        reading_progress: 0.0,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
        open_access_status: "verified_open_access".to_string(),
        access_evidence_type: "explicit_source_label".to_string(),
        access_evidence_note: None,
        license_name: Some("CC-BY".to_string()),
        license_url: None,
        source_name: Some("openalex".to_string()),
        retrieval_method: "permitted_html_connector".to_string(),
        access_confirmed_at: Some("2026-01-01T00:00:00Z".to_string()),
        authors: vec![Author {
            id: format!("author-{}", id),
            full_name: author.to_string(),
            family_name: None,
            given_name: None,
            orcid: None,
            affiliation: Some("Oxford University".to_string()),
            author_order: 0,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }],
        collection_ids: vec![],
        tags: vec!["AI".to_string()],
        source_names: vec!["openalex".to_string()],
    }
}

#[test]
fn test_metadata_normalization_pipeline_end_to_end() {
    let mut conn = setup_test_db();

    // Insert paper with unnormalized DOI
    let p = create_sample_paper(
        "p-norm-1",
        "  Deep Learning for Medical Imaging: A Survey  ",
        Some("https://doi.org/10.1038/S41586-020-0001-X."),
        Some(2023),
        "Jane Doe",
    );
    PaperRepository::create(&mut conn, &p).unwrap();

    // Run metadata normalization pipeline
    let job = ProcessingPipeline::run_metadata_normalization(&conn).unwrap();
    assert_eq!(job.status, "succeeded");
    assert_eq!(job.completed_items, 1);

    // Verify paper in DB has canonicalized DOI
    let updated = PaperRepository::get_by_id(&conn, "p-norm-1")
        .unwrap()
        .unwrap();
    assert_eq!(
        updated.canonical_doi,
        Some("10.1038/s41586-020-0001-x".to_string())
    );
    assert_eq!(
        updated.clean_title_key,
        "deeplearningformedicalimagingasurvey"
    );

    // Verify paper_identifiers has recorded entry
    let idents = ProcessingRepository::get_identifiers_for_paper(&conn, "p-norm-1").unwrap();
    assert_eq!(idents.len(), 1);
    assert_eq!(idents[0].identifier_type, "doi");
    assert_eq!(idents[0].canonical_value, "10.1038/s41586-020-0001-x");
}

#[test]
fn test_duplicate_detection_and_candidate_generation() {
    let mut conn = setup_test_db();

    // Paper 1 has DOI
    let p1 = create_sample_paper(
        "p-dup-1",
        "Quantum Teleportation Across Cities",
        Some("10.1103/physrevlett.123"),
        Some(2021),
        "Bob Smith",
    );
    // Paper 2 has same title, author, year, but no DOI (incoming from another source) -> High confidence candidate
    let p2 = create_sample_paper(
        "p-dup-2",
        "Quantum Teleportation Across Cities",
        None,
        Some(2021),
        "Bob Smith",
    );

    // Paper 3 has conflicting DOI -> Distinct
    let p3 = create_sample_paper(
        "p-dup-3",
        "Quantum Teleportation Across Cities",
        Some("10.1103/physrevlett.999"),
        Some(2021),
        "Bob Smith",
    );

    // Paper 4 has near duplicate title without DOI -> Review Required
    let p4 = create_sample_paper(
        "p-dup-4",
        "Quantum Teleportation Across Distributed Cities",
        None,
        Some(2021),
        "Bob Smith",
    );

    PaperRepository::create(&mut conn, &p1).unwrap();
    PaperRepository::create(&mut conn, &p2).unwrap();
    PaperRepository::create(&mut conn, &p3).unwrap();
    PaperRepository::create(&mut conn, &p4).unwrap();

    let job = ProcessingPipeline::run_duplicate_scan(&conn).unwrap();
    assert_eq!(job.status, "succeeded");

    let candidates = ProcessingRepository::list_duplicate_candidates(&conn, None, 50, 0).unwrap();
    assert!(!candidates.is_empty());

    // Check same title & author candidate (p1 vs p2)
    let p1_p2 = candidates.iter().find(|c| {
        (c.paper_a_id == "p-dup-1" && c.paper_b_id == "p-dup-2")
            || (c.paper_a_id == "p-dup-2" && c.paper_b_id == "p-dup-1")
    });
    assert!(p1_p2.is_some());
    let cand = p1_p2.unwrap();
    assert!(cand.score >= 0.85);

    // Check conflicting DOI pair was classified as distinct (p1 vs p3)
    let conflicting = candidates.iter().find(|c| {
        (c.paper_a_id == "p-dup-1" && c.paper_b_id == "p-dup-3")
            || (c.paper_a_id == "p-dup-3" && c.paper_b_id == "p-dup-1")
    });
    if let Some(c) = conflicting {
        assert_eq!(c.match_tier, "distinct");
    }
}

#[test]
fn test_transactional_paper_merge_with_audit_trail() {
    let mut conn = setup_test_db();

    let p_canon = create_sample_paper(
        "p-canon",
        "CRISPR-Cas9 Genome Editing",
        Some("10.1016/cell.2014"),
        Some(2014),
        "Jennifer Doudna",
    );
    let mut p_incoming = create_sample_paper(
        "p-incoming",
        "CRISPR-Cas9 Genome Editing (Preprint)",
        None,
        Some(2014),
        "Jennifer Doudna",
    );
    p_incoming.abstract_text =
        Some("Unique detailed experimental abstract from preprint.".to_string());
    p_incoming.pdf_url = Some("https://biorxiv.org/content/early/2014.pdf".to_string());

    PaperRepository::create(&mut conn, &p_canon).unwrap();
    PaperRepository::create(&mut conn, &p_incoming).unwrap();

    // Add note to incoming paper
    conn.execute(
        "INSERT INTO notes (id, paper_id, title, content_markdown, created_at, updated_at) VALUES ('n-1', 'p-incoming', 'Preprint Note', 'Important findings', datetime('now'), datetime('now'))",
        [],
    ).unwrap();

    let merge_req = MergeRequest {
        candidate_id: None,
        canonical_paper_id: "p-canon".to_string(),
        merged_paper_id: "p-incoming".to_string(),
        preferred_title_source: None,
        preserve_notes: true,
        preserve_tags: true,
        preserve_collections: true,
        merge_notes: Some("Merged preprint observation into canonical paper".to_string()),
    };

    let result = PaperMerger::merge_papers(&mut conn, &merge_req).unwrap();
    assert!(result.success);
    assert_eq!(result.canonical_paper_id, "p-canon");

    // Check incoming paper is soft-merged
    let incoming_after = conn
        .query_row(
            "SELECT merged_into_id, is_saved FROM papers WHERE id = 'p-incoming'",
            [],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, i32>(1)?)),
        )
        .unwrap();
    assert_eq!(incoming_after.0, Some("p-canon".to_string()));
    assert_eq!(incoming_after.1, 0); // is_saved flipped to 0

    // Check notes were reassigned to canonical paper
    let note_paper_id: String = conn
        .query_row("SELECT paper_id FROM notes WHERE id = 'n-1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(note_paper_id, "p-canon");

    // Check audit history row exists
    let history_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM paper_merge_history WHERE canonical_paper_id = 'p-canon' AND merged_paper_id = 'p-incoming'",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(history_count, 1);
}

#[test]
fn test_pdf_integrity_and_text_extraction() {
    let temp_dir = std::env::temp_dir().join(format!("test_paper_proc_{}", uuid::Uuid::new_v4()));
    create_dir_all(&temp_dir).unwrap();

    let pdf_path = temp_dir.join("test_sample.pdf");
    PdfProcessor::create_test_pdf(&pdf_path).unwrap();

    // Inspect file characteristics & stream SHA-256
    let (size, hash, inspect_res) = FileIntegrityService::inspect_file(&pdf_path);
    assert!(size > 0);
    assert!(hash.is_some());
    assert!(inspect_res.is_ok());

    // Process PDF metadata
    let pdf_meta = PdfProcessor::process_pdf_file(&pdf_path);
    assert_eq!(pdf_meta.page_count, 1);
    assert_eq!(pdf_meta.status, "no_text"); // Legitimate rasterized/minimal PDF without text stream

    // 2. Corrupt PDF check
    let corrupt_path = temp_dir.join("corrupt.pdf");
    {
        let mut f = File::create(&corrupt_path).unwrap();
        f.write_all(b"%PDF-1.4\nBroken bytes that will fail")
            .unwrap();
    }
    let corrupt_meta = PdfProcessor::process_pdf_file(&corrupt_path);
    assert_eq!(corrupt_meta.status, "corrupt");

    // 3. Path Traversal security check
    let malicious = Path::new("../../sensitive.pdf");
    let sec_check = FileIntegrityService::validate_file_path(&temp_dir, malicious);
    assert!(sec_check.is_err());
    assert!(sec_check.unwrap_err().contains("Path traversal"));

    // Cleanup
    let _ = remove_dir_all(&temp_dir);
}
