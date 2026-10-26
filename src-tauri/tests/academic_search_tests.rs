use research_paper_scraper_lib::academic_sources::{
    AcademicSearchService, NormalizedAuthor, NormalizedWork, ProviderId, ProviderProvenance,
};
use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::collection::CollectionCreateInput;
use research_paper_scraper_lib::services::{CollectionService, PaperService};

#[test]
fn test_import_search_results_into_database() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    let work = NormalizedWork {
        id: "s2_rec_123".to_string(),
        canonical_doi: Some("10.1145/3292500.3330964".to_string()),
        title: "Deep Learning for Search and Recommendation".to_string(),
        clean_title_key: "deep learning for search and recommendation".to_string(),
        abstract_text: Some("This paper reviews recent advances in deep learning for search and recommendation engines.".to_string()),
        publication_year: Some(2019),
        publication_date: Some("2019-07-25".to_string()),
        venue: Some("KDD '19: Proceedings of the 25th ACM SIGKDD".to_string()),
        venue_type: Some("conference".to_string()),
        authors: vec![
            NormalizedAuthor {
                name: "Guorui Zhou".to_string(),
                orcid: None,
                affiliation: Some("Alibaba Group".to_string()),
            },
            NormalizedAuthor {
                name: "Na Mou".to_string(),
                orcid: None,
                affiliation: Some("Alibaba Group".to_string()),
            },
        ],
        landing_url: Some("https://doi.org/10.1145/3292500.3330964".to_string()),
        pdf_url: Some("https://dl.acm.org/doi/pdf/10.1145/3292500.3330964".to_string()),
        is_open_access: true,
        citation_count: Some(152),
        provider_id: ProviderId::SemanticScholar,
        provider_record_id: "s2_rec_123".to_string(),
        provenance: vec![ProviderProvenance {
            provider_id: ProviderId::SemanticScholar,
            record_id: "s2_rec_123".to_string(),
            landing_url: Some("https://www.semanticscholar.org/paper/s2_rec_123".to_string()),
            retrieved_at: "2026-10-24T00:00:00Z".to_string(),
        }],
    };

    let summary = AcademicSearchService::import_works(&db, vec![work.clone()], None)
        .expect("importing works failed");

    assert_eq!(summary.added, 1);
    assert_eq!(summary.updated, 0);
    assert_eq!(summary.already_present, 0);
    assert_eq!(summary.failed, 0);

    // Verify paper exists in SQLite by checking PaperService
    let papers = PaperService::list_papers(&db, Default::default()).expect("failed to list papers");
    assert_eq!(papers.total_count, 1);
    let paper = &papers.items[0];

    assert_eq!(paper.title, "Deep Learning for Search and Recommendation");
    assert_eq!(
        paper.canonical_doi.as_deref(),
        Some("10.1145/3292500.3330964")
    );
    assert_eq!(paper.authors.len(), 2);
    assert_eq!(paper.authors[0].full_name, "Guorui Zhou");
    assert!(paper.is_saved);
    assert!(paper.is_open_access);

    // 2. Test re-import deduplication
    let second_summary =
        AcademicSearchService::import_works(&db, vec![work], None).expect("second import failed");

    assert_eq!(second_summary.added, 0);
    assert_eq!(second_summary.already_present, 1);

    let papers_after =
        PaperService::list_papers(&db, Default::default()).expect("failed to list papers");
    assert_eq!(
        papers_after.total_count, 1,
        "Duplicate paper should not be created"
    );
}

#[test]
fn test_import_with_target_collection() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    let collection = CollectionService::create_collection(
        &db,
        CollectionCreateInput {
            name: "Neural Information Retrieval".to_string(),
            description: Some("Collection for IR papers".to_string()),
            color_hex: Some("#2563EB".to_string()),
            parent_id: None,
        },
    )
    .expect("failed to create collection");

    let work = NormalizedWork {
        id: "arxiv_1706_03762".to_string(),
        canonical_doi: Some("10.48550/arXiv.1706.03762".to_string()),
        title: "Attention Is All You Need".to_string(),
        clean_title_key: "attention is all you need".to_string(),
        abstract_text: Some("The dominant sequence transduction models...".to_string()),
        publication_year: Some(2017),
        publication_date: Some("2017-06-12".to_string()),
        venue: Some("NeurIPS".to_string()),
        venue_type: Some("conference".to_string()),
        authors: vec![NormalizedAuthor {
            name: "Ashish Vaswani".to_string(),
            orcid: None,
            affiliation: None,
        }],
        landing_url: Some("https://arxiv.org/abs/1706.03762".to_string()),
        pdf_url: Some("https://arxiv.org/pdf/1706.03762.pdf".to_string()),
        is_open_access: true,
        citation_count: Some(95000),
        provider_id: ProviderId::Arxiv,
        provider_record_id: "1706.03762".to_string(),
        provenance: vec![ProviderProvenance {
            provider_id: ProviderId::Arxiv,
            record_id: "1706.03762".to_string(),
            landing_url: Some("https://arxiv.org/abs/1706.03762".to_string()),
            retrieved_at: "2026-10-24T00:00:00Z".to_string(),
        }],
    };

    let summary = AcademicSearchService::import_works(&db, vec![work], Some(collection.id.clone()))
        .expect("import failed");

    assert_eq!(summary.added, 1);

    let papers = PaperService::list_papers(&db, Default::default()).expect("list papers failed");
    assert_eq!(papers.total_count, 1);
    assert!(papers.items[0].collection_ids.contains(&collection.id));
}

#[test]
fn test_deduplicate_and_merge_cross_provider_records() {
    let work_arxiv = NormalizedWork {
        id: "arxiv_2301_00001".to_string(),
        canonical_doi: Some("10.48550/arXiv.2301.00001".to_string()),
        title: "Advances in Quantum Computing".to_string(),
        clean_title_key: "advances in quantum computing".to_string(),
        abstract_text: Some("Detailed preprint abstract on quantum algorithms...".to_string()),
        publication_year: Some(2023),
        publication_date: Some("2023-01-01".to_string()),
        venue: Some("arXiv".to_string()),
        venue_type: Some("repository".to_string()),
        authors: vec![NormalizedAuthor {
            name: "Alice Smith".to_string(),
            orcid: None,
            affiliation: None,
        }],
        landing_url: Some("https://arxiv.org/abs/2301.00001".to_string()),
        pdf_url: Some("https://arxiv.org/pdf/2301.00001.pdf".to_string()),
        is_open_access: true,
        citation_count: None,
        provider_id: ProviderId::Arxiv,
        provider_record_id: "2301.00001".to_string(),
        provenance: vec![ProviderProvenance {
            provider_id: ProviderId::Arxiv,
            record_id: "2301.00001".to_string(),
            landing_url: Some("https://arxiv.org/abs/2301.00001".to_string()),
            retrieved_at: "2026-10-24T00:00:00Z".to_string(),
        }],
    };

    let work_crossref = NormalizedWork {
        id: "crossref_doi_2301".to_string(),
        canonical_doi: Some("10.48550/arXiv.2301.00001".to_string()),
        title: "Advances in Quantum Computing".to_string(),
        clean_title_key: "advances in quantum computing".to_string(),
        abstract_text: None, // Crossref often lacks abstracts
        publication_year: Some(2023),
        publication_date: Some("2023-01-05".to_string()),
        venue: Some("Nature Quantum".to_string()),
        venue_type: Some("journal".to_string()),
        authors: vec![
            NormalizedAuthor {
                name: "Alice Smith".to_string(),
                orcid: Some("0000-0001-2345-6789".to_string()),
                affiliation: Some("Oxford".to_string()),
            },
            NormalizedAuthor {
                name: "Bob Jones".to_string(),
                orcid: None,
                affiliation: Some("Cambridge".to_string()),
            },
        ],
        landing_url: Some("https://doi.org/10.48550/arXiv.2301.00001".to_string()),
        pdf_url: None,
        is_open_access: true,
        citation_count: Some(12),
        provider_id: ProviderId::Crossref,
        provider_record_id: "10.48550/arXiv.2301.00001".to_string(),
        provenance: vec![ProviderProvenance {
            provider_id: ProviderId::Crossref,
            record_id: "10.48550/arXiv.2301.00001".to_string(),
            landing_url: Some("https://doi.org/10.48550/arXiv.2301.00001".to_string()),
            retrieved_at: "2026-10-24T00:01:00Z".to_string(),
        }],
    };

    let merged =
        AcademicSearchService::deduplicate_and_merge_works(vec![work_arxiv, work_crossref]);
    assert_eq!(
        merged.len(),
        1,
        "Expected the two provider records to merge into 1 record"
    );

    let item = &merged[0];
    assert_eq!(item.title, "Advances in Quantum Computing");
    assert!(
        item.abstract_text.is_some(),
        "Abstract from arXiv should be preserved"
    );
    assert_eq!(
        item.provenance.len(),
        2,
        "Both provider provenances should be preserved"
    );
    assert_eq!(
        item.authors.len(),
        2,
        "More complete author list should be preserved"
    );
    assert_eq!(
        item.citation_count,
        Some(12),
        "Citation count from Crossref should be retained"
    );
    assert_eq!(
        item.pdf_url.as_deref(),
        Some("https://arxiv.org/pdf/2301.00001.pdf"),
        "PDF URL from arXiv should be preserved"
    );
}
