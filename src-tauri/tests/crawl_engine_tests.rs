use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::crawl::{
    CrawlJobStatus, CrawlProfileCreateInput, CrawlProfileUpdateInput, CrawlQueueItemStatus,
};
use research_paper_scraper_lib::repositories::CrawlRepository;
use research_paper_scraper_lib::scrapers::extractor::HtmlExtractor;
use research_paper_scraper_lib::scrapers::robots::RobotsTxt;
use research_paper_scraper_lib::scrapers::url_guard::UrlGuard;

#[test]
fn test_database_has_seeded_crawl_profiles() {
    let db = Database::open_in_memory().expect("in-memory db initialization failed");
    let conn = db.lock().expect("db lock failed");

    let profiles = CrawlRepository::list_profiles(&conn).expect("list_profiles failed");
    assert_eq!(profiles.len(), 5);

    let profile_ids: Vec<String> = profiles.into_iter().map(|p| p.id).collect();
    assert!(profile_ids.contains(&"biorxiv".to_string()));
    assert!(profile_ids.contains(&"nature".to_string()));
    assert!(profile_ids.contains(&"plos".to_string()));
    assert!(profile_ids.contains(&"acm".to_string()));
    assert!(profile_ids.contains(&"generic".to_string()));
}

#[test]
fn test_crawl_profile_crud_and_built_in_protection() {
    let db = Database::open_in_memory().expect("in-memory db initialization failed");
    let conn = db.lock().expect("db lock failed");

    // 1. Cannot delete built-in profile
    let deleted = CrawlRepository::delete_profile(&conn, "biorxiv").expect("delete call failed");
    assert!(!deleted, "Built-in profile must not be deleted");

    // 2. Create custom profile
    let input = CrawlProfileCreateInput {
        id: Some("custom_oxford".to_string()),
        name: "Oxford Academic Journals".to_string(),
        domain: "academic.oup.com".to_string(),
        description: Some("Oxford University Press academic papers".to_string()),
        allowed_patterns: Some(vec!["/article/".to_string()]),
        disallowed_patterns: Some(vec!["/search".to_string()]),
        paper_link_selectors: Some(vec!["a.article-link".to_string()]),
        title_selector: Some("h1.article-title".to_string()),
        authors_selector: None,
        abstract_selector: None,
        doi_selector: None,
        date_selector: None,
        venue_selector: None,
        pdf_link_selector: None,
        use_meta_tags: Some(true),
        request_delay_ms: Some(1500),
        max_depth: Some(3),
        max_pages: Some(25),
        headers: None,
    };

    let created = CrawlRepository::create_profile(&conn, &input).expect("create_profile failed");
    assert_eq!(created.id, "custom_oxford");
    assert_eq!(created.name, "Oxford Academic Journals");
    assert!(!created.is_built_in);

    // 3. Update custom profile
    let update = CrawlProfileUpdateInput {
        name: Some("Oxford Academic Journals (Updated)".to_string()),
        domain: None,
        description: None,
        allowed_patterns: None,
        disallowed_patterns: None,
        paper_link_selectors: None,
        title_selector: None,
        authors_selector: None,
        abstract_selector: None,
        doi_selector: None,
        date_selector: None,
        venue_selector: None,
        pdf_link_selector: None,
        use_meta_tags: None,
        request_delay_ms: Some(2000),
        max_depth: None,
        max_pages: None,
        headers: None,
    };

    let updated = CrawlRepository::update_profile(&conn, "custom_oxford", &update)
        .expect("update_profile failed")
        .expect("profile not found");
    assert_eq!(updated.name, "Oxford Academic Journals (Updated)");
    assert_eq!(updated.request_delay_ms, 2000);

    // 4. Delete custom profile succeeds
    let deleted_custom =
        CrawlRepository::delete_profile(&conn, "custom_oxford").expect("delete call failed");
    assert!(
        deleted_custom,
        "Custom profile should be successfully deleted"
    );
}

#[test]
fn test_crawl_job_and_queue_lifecycle() {
    let db = Database::open_in_memory().expect("in-memory db initialization failed");
    let conn = db.lock().expect("db lock failed");

    // Create job with start URL
    let start_url = "https://www.biorxiv.org/content/early/recent";
    let job = CrawlRepository::create_job(&conn, "biorxiv", start_url).expect("create_job failed");
    assert_eq!(job.status, CrawlJobStatus::Pending);
    assert_eq!(job.pages_queued, 1);
    assert_eq!(job.pages_visited, 0);

    // Get next item from queue
    let item = CrawlRepository::get_next_queue_item(&conn, &job.id)
        .expect("get_next_queue_item failed")
        .expect("queue should have initial item");
    assert_eq!(item.url, start_url);
    assert_eq!(item.depth, 0);
    assert_eq!(item.status, CrawlQueueItemStatus::Pending);

    // Mark processing and then completed
    CrawlRepository::update_queue_item_status(
        &conn,
        &item.id,
        CrawlQueueItemStatus::Completed,
        Some(200),
        None,
    )
    .expect("update_queue_item_status failed");

    // Increment job counters
    CrawlRepository::increment_job_counters(&conn, &job.id, 1, 0, 1)
        .expect("increment_job_counters failed");

    // Enqueue candidate link discovered at depth 1
    let enqueued = CrawlRepository::enqueue_url(
        &conn,
        &job.id,
        "https://www.biorxiv.org/content/10.1101/2026.02.01.123456",
        1,
    )
    .expect("enqueue_url failed");
    assert!(enqueued);

    // Save crawled paper
    let paper = CrawlRepository::save_crawled_paper(
        &conn,
        research_paper_scraper_lib::repositories::crawl_repo::CrawledPaperInput {
            job_id: &job.id,
            url: "https://www.biorxiv.org/content/10.1101/2026.02.01.123456",
            title: "Deep Learning Models for Transcriptomic Splicing",
            canonical_doi: Some("10.1101/2026.02.01.123456"),
            authors: &["Dr. Ada Lovelace".to_string()],
            abstract_text: Some(
                "Detailed neural network analysis for alternative splicing patterns.",
            ),
            publication_date: Some("2026-02-01"),
            venue: Some("bioRxiv"),
            pdf_url: Some("https://www.biorxiv.org/content/10.1101/2026.02.01.123456.full.pdf"),
        },
    )
    .expect("save_crawled_paper failed");

    assert_eq!(
        paper.title,
        "Deep Learning Models for Transcriptomic Splicing"
    );

    // Drop connection lock before calling PaperService to avoid Mutex deadlock
    drop(conn);

    // Insert real paper in library to satisfy foreign key constraint
    let real_paper = research_paper_scraper_lib::services::PaperService::create_paper(
        &db,
        research_paper_scraper_lib::domain::paper::PaperCreateInput {
            title: "Deep Learning Models for Transcriptomic Splicing".to_string(),
            canonical_doi: Some("10.1101/2026.02.01.123456".to_string()),
            abstract_text: Some(
                "Detailed neural network analysis for alternative splicing patterns.".to_string(),
            ),
            publication_date: Some("2026-02-01".to_string()),
            publication_year: Some(2026),
            venue: Some("bioRxiv".to_string()),
            venue_type: None,
            language: Some("en".to_string()),
            is_open_access: Some(true),
            primary_landing_url: Some(
                "https://www.biorxiv.org/content/10.1101/2026.02.01.123456".to_string(),
            ),
            pdf_url: Some(
                "https://www.biorxiv.org/content/10.1101/2026.02.01.123456.full.pdf".to_string(),
            ),
            is_saved: Some(true),
            authors: vec!["Dr. Ada Lovelace".to_string()],
            collection_ids: None,
            tags: None,
            source_id: None,
            reading_status: None,
            reading_progress: None,
            ..Default::default()
        },
    )
    .expect("create_paper failed");

    let conn = db.lock().expect("db lock re-acquisition failed");

    // Mark as imported linking to the real paper ID
    CrawlRepository::mark_crawled_paper_imported(&conn, &paper.id, &real_paper.id)
        .expect("mark_crawled_paper_imported failed");

    let papers = CrawlRepository::list_crawled_papers_for_job(&conn, &job.id)
        .expect("list_crawled_papers_for_job failed");
    assert_eq!(papers.len(), 1);
    assert!(papers[0].is_imported);
    assert_eq!(papers[0].paper_id.as_deref(), Some(real_paper.id.as_str()));
}

#[test]
fn test_anti_ssrf_comprehensive_protection() {
    let forbidden_urls = [
        "http://localhost:8080/api",
        "http://127.0.0.1:3000",
        "http://[::1]/secret",
        "http://10.0.0.5/admin",
        "http://172.16.0.1/config",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data/",
        "http://internal.service.local",
        "ftp://ftp.example.org",
        "file:///etc/shadow",
        "https://user:password@target.org",
    ];

    for url in forbidden_urls {
        let res = UrlGuard::validate_url(url);
        assert!(
            res.is_err(),
            "Expected URL '{url}' to be rejected by Anti-SSRF guard"
        );
    }
}

#[test]
fn test_robots_txt_rfc_compliance() {
    let robots_content = r#"
User-agent: SpecificBot
Disallow: /admin/
Disallow: /private/
Allow: /private/public-data/
Crawl-delay: 3

User-agent: *
Disallow: /restricted/
Crawl-delay: 1
"#;

    let robots = RobotsTxt::parse(robots_content);

    // SpecificBot rules
    assert!(robots.is_allowed("/articles/1", "SpecificBot"));
    assert!(!robots.is_allowed("/admin/users", "SpecificBot"));
    assert!(!robots.is_allowed("/private/secret", "SpecificBot"));
    assert!(robots.is_allowed("/private/public-data/item", "SpecificBot"));
    assert_eq!(
        robots.crawl_delay("SpecificBot"),
        Some(std::time::Duration::from_secs(3))
    );

    // Generic bot rules
    assert!(robots.is_allowed("/admin/users", "OtherCrawler"));
    assert!(!robots.is_allowed("/restricted/area", "OtherCrawler"));
    assert_eq!(
        robots.crawl_delay("OtherCrawler"),
        Some(std::time::Duration::from_secs(1))
    );
}

#[test]
fn test_html_metadata_extraction_end_to_end() {
    let html = r#"
<!DOCTYPE html>
<html>
<head>
    <meta name="citation_title" content="Robust Quantum Error Mitigation via Zero-Noise Extrapolation" />
    <meta name="citation_author" content="Dr. Robert Quantum" />
    <meta name="citation_author" content="Prof. Marie Curie" />
    <meta name="citation_doi" content="10.1038/s41586-026-0001-x" />
    <meta name="citation_publication_date" content="2026-04-10" />
    <meta name="citation_journal_title" content="Nature" />
    <meta name="citation_pdf_url" content="/articles/s41586-026-0001-x.pdf" />
    <meta name="dc.description" content="We demonstrate zero-noise extrapolation across multi-qubit systems." />
</head>
<body>
    <a href="/articles/s41586-026-0002-y" class="c-card__link">Related Work</a>
    <a href="https://evil.com/phishing">External Link</a>
</body>

</html>
"#;

    let base_url = "https://www.nature.com/articles/s41586-026-0001-x";
    let db = Database::open_in_memory().unwrap();
    let conn = db.lock().unwrap();
    let profile = CrawlRepository::get_profile_by_id(&conn, "nature")
        .unwrap()
        .unwrap();

    let preview = HtmlExtractor::extract(html, base_url, Some(&profile));

    assert_eq!(
        preview.title.as_deref(),
        Some("Robust Quantum Error Mitigation via Zero-Noise Extrapolation")
    );
    assert_eq!(
        preview.authors,
        vec!["Dr. Robert Quantum", "Prof. Marie Curie"]
    );
    assert_eq!(
        preview.canonical_doi.as_deref(),
        Some("10.1038/s41586-026-0001-x")
    );
    assert_eq!(preview.publication_date.as_deref(), Some("2026-04-10"));
    assert_eq!(preview.venue.as_deref(), Some("Nature"));
    assert_eq!(
        preview.pdf_url.as_deref(),
        Some("https://www.nature.com/articles/s41586-026-0001-x.pdf")
    );
    assert!(preview
        .extraction_methods_used
        .contains(&"highwire_press_meta".to_string()));

    // Verify paper links discovery (must keep nature.com and exclude external evil.com)
    assert!(preview
        .discovered_paper_links
        .contains(&"https://www.nature.com/articles/s41586-026-0002-y".to_string()));
    assert!(!preview
        .discovered_paper_links
        .iter()
        .any(|l| l.contains("evil.com")));
}
