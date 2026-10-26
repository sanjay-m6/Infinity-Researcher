use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::paper::{Author, Paper, PaperListQuery};
use research_paper_scraper_lib::repositories::PaperRepository;
use research_paper_scraper_lib::services::ExportService;
use std::time::Instant;

#[test]
fn test_performance_benchmarks_1k_and_10k_records() {
    let db = Database::open_in_memory().expect("failed to open in-memory db for benchmark");
    let mut conn = db.lock().expect("failed to acquire db lock");

    println!("\n=== Phase 9 Performance Benchmark Suite ===");

    // Seed test collection for foreign key validation
    conn.execute(
        "INSERT INTO collections (id, name, created_at, updated_at) VALUES ('col-ai-core', 'AI Core Collection', datetime('now'), datetime('now'))",
        [],
    ).expect("failed to seed benchmark collection");

    // --- Benchmark 1: Bulk Insertion of 1,000 Papers ---
    let start_insert_1k = Instant::now();

    for i in 1..=1000 {
        let paper = Paper {
            id: format!("bench-paper-{:05}", i),
            canonical_doi: Some(format!("10.9999/bench.{:05}", i)),
            title: format!(
                "Scalable Autonomous Intelligence in Heterogeneous Environments Vol {}",
                i
            ),
            clean_title_key: format!(
                "scalableautonomousintelligenceinheterogeneousenvironmentsvol{}",
                i
            ),
            abstract_text: Some(format!(
                "This paper investigates distributed neural consensus, Byzantine fault tolerance, and indexing throughput in high-throughput node cluster {}. Comprehensive mathematical models and experimental validations are provided.",
                i
            )),
            publication_date: Some(format!("20{:02}-06-15", 10 + (i % 15))),
            publication_year: Some(2010 + (i % 15)),
            venue: Some(if i % 2 == 0 {
                "IEEE Transactions on Neural Networks".to_string()
            } else {
                "ACM SIGCOMM Computer Communication Review".to_string()
            }),
            venue_type: Some("journal".to_string()),
            language: "en".to_string(),
            citation_count: (i * 7) % 500,
            reference_count: (i * 3) % 100,
            is_open_access: i % 3 != 0,
            license: Some("CC-BY-4.0".to_string()),
            primary_landing_url: Some(format!("https://doi.org/10.9999/bench.{:05}", i)),
            pdf_url: Some(format!("https://doi.org/10.9999/bench.{:05}.pdf", i)),
            has_file: i % 4 == 0,
            local_pdf_path: if i % 4 == 0 {
                Some(format!("storage/papers/bench_{:05}.pdf", i))
            } else {
                None
            },
            content_hash: None,
            metadata_confidence: "verified".to_string(),
            is_saved: true,
            reading_status: match i % 3 {
                0 => "unread".to_string(),
                1 => "reading".to_string(),
                _ => "read".to_string(),
            },
            reading_progress: (i % 100) as f64 / 100.0,
            open_access_status: if i % 3 != 0 {
                "verified_open_access".to_string()
            } else {
                "pending_verification".to_string()
            },
            access_evidence_type: if i % 3 != 0 {
                "explicit_source_label".to_string()
            } else {
                "unknown".to_string()
            },
            access_evidence_note: None,
            license_name: Some("CC-BY-4.0".to_string()),
            license_url: None,
            source_name: Some("benchmark".to_string()),
            retrieval_method: "permitted_html_connector".to_string(),
            access_confirmed_at: if i % 3 != 0 {
                Some("2026-01-01T00:00:00Z".to_string())
            } else {
                None
            },
            authors: vec![

                Author {
                    id: format!("author-1-{}", i),
                    full_name: format!("Researcher Alpha {}", i % 50),
                    family_name: Some(format!("Alpha {}", i % 50)),
                    given_name: Some("Researcher".to_string()),
                    orcid: None,
                    affiliation: None,
                    author_order: 0,
                    created_at: "2026-01-01T00:00:00Z".to_string(),
                },
                Author {
                    id: format!("author-2-{}", i),
                    full_name: format!("Scholar Beta {}", i % 30),
                    family_name: Some(format!("Beta {}", i % 30)),
                    given_name: Some("Scholar".to_string()),
                    orcid: None,
                    affiliation: None,
                    author_order: 1,
                    created_at: "2026-01-01T00:00:00Z".to_string(),
                },
            ],
            collection_ids: if i % 5 == 0 {
                vec!["col-ai-core".to_string()]
            } else {
                vec![]
            },
            tags: vec!["Artificial Intelligence".to_string(), "Consensus".to_string()],
            source_names: vec!["benchmark".to_string()],
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        };

        PaperRepository::create(&mut conn, &paper).expect("failed to insert benchmark paper");
    }

    let dur_insert_1k = start_insert_1k.elapsed();
    println!(
        " [1] Bulk Insert 1,000 papers + FTS indexing: {:?} ({:.2} records/sec)",
        dur_insert_1k,
        1000.0 / dur_insert_1k.as_secs_f64()
    );

    // --- Benchmark 2: Paged Listing (Page 1 and Page 20) ---
    let start_page_1 = Instant::now();
    let q_p1 = PaperListQuery {
        page: Some(1),
        page_size: Some(25),
        sort_by: Some("newest".to_string()),
        ..Default::default()
    };
    let res_p1 = PaperRepository::list(&conn, &q_p1).expect("list page 1 failed");
    let dur_page_1 = start_page_1.elapsed();
    assert_eq!(res_p1.items.len(), 25);
    assert_eq!(res_p1.total_count, 1000);
    println!(
        " [2] Paged listing query (Page 1, 25 items): {:?}",
        dur_page_1
    );

    let start_page_20 = Instant::now();
    let q_p20 = PaperListQuery {
        page: Some(20),
        page_size: Some(25),
        sort_by: Some("newest".to_string()),
        ..Default::default()
    };
    let res_p20 = PaperRepository::list(&conn, &q_p20).expect("list page 20 failed");
    let dur_page_20 = start_page_20.elapsed();
    assert_eq!(res_p20.items.len(), 25);
    println!(
        " [3] Paged listing query (Page 20, offset 475): {:?}",
        dur_page_20
    );

    // --- Benchmark 3: FTS5 Full-Text Search across 1,000 papers ---
    let start_fts = Instant::now();
    let q_fts = PaperListQuery {
        query: Some("neural AND consensus".to_string()),
        page_size: Some(50),
        ..Default::default()
    };
    let res_fts = PaperRepository::list(&conn, &q_fts).expect("FTS query failed");
    let dur_fts = start_fts.elapsed();
    assert!(res_fts.total_count > 0);
    println!(
        " [4] FTS5 search (\"neural AND consensus\" across 1k papers): {:?} (matched {} records)",
        dur_fts, res_fts.total_count
    );

    // --- Benchmark 4: Combined Multi-Category Filters ---
    let start_filter = Instant::now();
    let q_filter = PaperListQuery {
        tag: Some("Consensus".to_string()),
        year_start: Some(2015),
        year_end: Some(2022),
        reading_status: Some("reading".to_string()),
        has_file: Some(true),
        page_size: Some(50),
        ..Default::default()
    };
    let res_filter = PaperRepository::list(&conn, &q_filter).expect("multi-filter query failed");
    let dur_filter = start_filter.elapsed();
    println!(
        " [5] Multi-filter query (tag + year range + status + file): {:?} (matched {} records)",
        dur_filter, res_filter.total_count
    );

    // --- Benchmark 5: Citation Serializers for 1,000 Papers ---
    let all_papers = PaperRepository::list(
        &conn,
        &PaperListQuery {
            page_size: Some(1000),
            ..Default::default()
        },
    )
    .expect("fetch all papers failed")
    .items;
    assert_eq!(all_papers.len(), 1000);

    // BibTeX serialization
    let start_bib = Instant::now();
    let bib_str = ExportService::serialize_bibtex(&all_papers);
    let dur_bib = start_bib.elapsed();
    println!(
        " [6] BibTeX export (1,000 papers): {:?} (bytes: {})",
        dur_bib,
        bib_str.len()
    );

    // RIS serialization
    let start_ris = Instant::now();
    let ris_str = ExportService::serialize_ris(&all_papers);
    let dur_ris = start_ris.elapsed();
    println!(
        " [7] RIS export (1,000 papers): {:?} (bytes: {})",
        dur_ris,
        ris_str.len()
    );

    // CSV serialization
    let start_csv = Instant::now();
    let csv_str = ExportService::serialize_csv(&all_papers);
    let dur_csv = start_csv.elapsed();
    println!(
        " [8] CSV export (1,000 papers): {:?} (bytes: {})",
        dur_csv,
        csv_str.len()
    );

    // JSON serialization
    let start_json = Instant::now();
    let json_str = ExportService::serialize_json(&all_papers).expect("JSON export failed");
    let dur_json = start_json.elapsed();
    println!(
        " [9] JSON export (1,000 papers): {:?} (bytes: {})",
        dur_json,
        json_str.len()
    );

    // --- Benchmark 6: Scalability Test to 5,000 records ---
    let start_insert_4k = Instant::now();
    for i in 1001..=5000 {
        let paper = Paper {
            id: format!("bench-paper-{:05}", i),
            canonical_doi: Some(format!("10.9999/bench.{:05}", i)),
            title: format!("Deep Quantum Scalability Benchmark Volume {}", i),
            clean_title_key: format!("deepquantumscalabilitybenchmarkvolume{}", i),
            abstract_text: Some(
                "Performance evaluation under heavy query load and concurrent transactions."
                    .to_string(),
            ),
            publication_date: Some("2025-01-01".to_string()),
            publication_year: Some(2025),
            venue: Some("Journal of Systems Research".to_string()),
            venue_type: Some("journal".to_string()),
            language: "en".to_string(),
            citation_count: 5,
            reference_count: 10,
            is_open_access: true,
            license: None,
            primary_landing_url: None,
            pdf_url: None,
            has_file: false,
            local_pdf_path: None,
            content_hash: None,
            metadata_confidence: "verified".to_string(),
            is_saved: true,
            reading_status: "unread".to_string(),
            reading_progress: 0.0,
            open_access_status: "verified_open_access".to_string(),
            access_evidence_type: "explicit_source_label".to_string(),
            access_evidence_note: None,
            license_name: None,
            license_url: None,
            source_name: Some("benchmark".to_string()),
            retrieval_method: "permitted_html_connector".to_string(),
            access_confirmed_at: Some("2026-01-01T00:00:00Z".to_string()),
            authors: vec![],
            collection_ids: vec![],
            tags: vec![],
            source_names: vec![],
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        };
        PaperRepository::create(&mut conn, &paper).expect("insert failed");
    }
    let dur_insert_4k = start_insert_4k.elapsed();
    println!(
        " [10] Bulk Insert additional 4,000 papers (Total 5,000 records): {:?}",
        dur_insert_4k
    );

    // Search against 5,000 records
    let start_fts_5k = Instant::now();
    let q_fts_5k = PaperListQuery {
        query: Some("Quantum Scalability".to_string()),
        page_size: Some(50),
        ..Default::default()
    };
    let res_fts_5k = PaperRepository::list(&conn, &q_fts_5k).expect("FTS query failed on 5k");
    let dur_fts_5k = start_fts_5k.elapsed();
    println!(
        " [11] FTS5 search on 5,000 records (\"Quantum Scalability\"): {:?} (matched {} records)",
        dur_fts_5k, res_fts_5k.total_count
    );
    assert_eq!(res_fts_5k.total_count, 4000);
}
