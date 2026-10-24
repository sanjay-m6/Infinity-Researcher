use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::collection::{CollectionCreateInput, CollectionUpdateInput};
use research_paper_scraper_lib::domain::note::NoteSaveInput;
use research_paper_scraper_lib::domain::paper::{PaperCreateInput, PaperListQuery, PaperUpdateInput};
use research_paper_scraper_lib::services::{
    CollectionService, NoteService, PaperService, SettingsService, SourceService, TagService,
};

#[test]
fn test_database_initialization_and_seeded_sources() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    let sources = SourceService::list_sources(&db).expect("failed to list sources");
    assert_eq!(sources.len(), 8, "Expected 8 academic sources to be seeded");

    let arxiv = sources.iter().find(|s| s.id == "arxiv").expect("arxiv source not found");
    assert_eq!(arxiv.name, "arXiv");
    assert_eq!(arxiv.tier, "tier_a");
    assert!(arxiv.is_enabled);
}

#[test]
fn test_paper_crud_and_deduplication() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    // 1. Create a paper
    let input = PaperCreateInput {
        title: "Attention Is All You Need".to_string(),
        canonical_doi: Some("10.48550/arXiv.1706.03762".to_string()),
        abstract_text: Some("The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...".to_string()),
        publication_date: Some("2017-06-12".to_string()),
        publication_year: Some(2017),
        venue: Some("NeurIPS".to_string()),
        venue_type: Some("conference".to_string()),
        language: Some("en".to_string()),
        is_open_access: Some(true),
        primary_landing_url: Some("https://arxiv.org/abs/1706.03762".to_string()),
        pdf_url: Some("https://arxiv.org/pdf/1706.03762.pdf".to_string()),
        is_saved: Some(true),
        authors: vec![
            "Ashish Vaswani".to_string(),
            "Noam Shazeer".to_string(),
            "Niki Parmar".to_string(),
        ],
        collection_ids: None,
        tags: Some(vec!["Deep Learning".to_string(), "Transformers".to_string()]),
        source_id: Some("arxiv".to_string()),
    };

    let created = PaperService::create_paper(&db, input).expect("failed to create paper");
    assert_eq!(created.title, "Attention Is All You Need");
    assert_eq!(created.authors.len(), 3);
    assert_eq!(created.authors[0].full_name, "Ashish Vaswani");
    assert_eq!(created.tags.len(), 2);
    assert!(created.is_saved);
    assert!(created.canonical_doi.is_some());

    // 2. Test duplicate detection by DOI
    let duplicate_doi_input = PaperCreateInput {
        title: "A Duplicate Submission".to_string(),
        canonical_doi: Some("https://doi.org/10.48550/arxiv.1706.03762".to_string()), // normalized matching
        abstract_text: None,
        publication_date: None,
        publication_year: None,
        venue: None,
        venue_type: None,
        language: None,
        is_open_access: None,
        primary_landing_url: None,
        pdf_url: None,
        is_saved: None,
        authors: vec![],
        collection_ids: None,
        tags: None,
        source_id: None,
    };
    let err_doi = PaperService::create_paper(&db, duplicate_doi_input);
    assert!(err_doi.is_err(), "Expected error on duplicate DOI");

    // 3. Test duplicate detection by clean_title_key
    let duplicate_title_input = PaperCreateInput {
        title: "attention is all you need!".to_string(), // cleans to "attentionisallyouneed"
        canonical_doi: None,
        abstract_text: None,
        publication_date: None,
        publication_year: None,
        venue: None,
        venue_type: None,
        language: None,
        is_open_access: None,
        primary_landing_url: None,
        pdf_url: None,
        is_saved: None,
        authors: vec![],
        collection_ids: None,
        tags: None,
        source_id: None,
    };
    let err_title = PaperService::create_paper(&db, duplicate_title_input);
    assert!(err_title.is_err(), "Expected error on duplicate title key");

    // 4. Update paper
    let update_input = PaperUpdateInput {
        id: created.id.clone(),
        title: Some("Attention Is All You Need (Revised)".to_string()),
        canonical_doi: None,
        abstract_text: None,
        publication_date: None,
        publication_year: Some(2017),
        venue: Some("NeurIPS 2017".to_string()),
        is_open_access: None,
        primary_landing_url: None,
        pdf_url: None,
        is_saved: Some(false),
        authors: None,
        collection_ids: None,
        tags: None,
    };
    let updated = PaperService::update_paper(&db, update_input).expect("failed to update paper");
    assert_eq!(updated.title, "Attention Is All You Need (Revised)");
    assert_eq!(updated.venue.as_deref(), Some("NeurIPS 2017"));
    assert!(!updated.is_saved);

    // 5. Toggle save paper
    let saved_state = PaperService::toggle_save_paper(&db, &created.id, true)
        .expect("failed to toggle save");
    assert!(saved_state);

    // 6. Delete paper and check cascading deletion
    let deleted = PaperService::delete_paper(&db, &created.id).expect("failed to delete paper");
    assert!(deleted);

    let retrieved = PaperService::get_paper(&db, &created.id).expect("failed to query paper");
    assert!(retrieved.is_none());
}

#[test]
fn test_fts5_full_text_search() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    // Seed 2 papers
    let paper1 = PaperCreateInput {
        title: "Quantum Computation and Quantum Information".to_string(),
        canonical_doi: Some("10.1017/CBO9780511976667".to_string()),
        abstract_text: Some("Comprehensive introduction to the main ideas and techniques of quantum computation.".to_string()),
        publication_date: Some("2010-01-01".to_string()),
        publication_year: Some(2010),
        venue: Some("Cambridge University Press".to_string()),
        venue_type: None,
        language: Some("en".to_string()),
        is_open_access: Some(false),
        primary_landing_url: None,
        pdf_url: None,
        is_saved: Some(true),
        authors: vec!["Michael Nielsen".to_string(), "Isaac Chuang".to_string()],
        collection_ids: None,
        tags: Some(vec!["Quantum Computing".to_string()]),
        source_id: None,
    };
    let _ = PaperService::create_paper(&db, paper1).expect("create paper 1 failed");

    let paper2 = PaperCreateInput {
        title: "Deep Residual Learning for Image Recognition".to_string(),
        canonical_doi: Some("10.1109/CVPR.2016.90".to_string()),
        abstract_text: Some("Deeper neural networks are more difficult to train. We present a residual learning framework.".to_string()),
        publication_date: Some("2016-06-01".to_string()),
        publication_year: Some(2016),
        venue: Some("CVPR".to_string()),
        venue_type: None,
        language: Some("en".to_string()),
        is_open_access: Some(true),
        primary_landing_url: None,
        pdf_url: None,
        is_saved: Some(true),
        authors: vec!["Kaiming He".to_string(), "Xiangyu Zhang".to_string()],
        collection_ids: None,
        tags: Some(vec!["Computer Vision".to_string()]),
        source_id: None,
    };
    let _ = PaperService::create_paper(&db, paper2).expect("create paper 2 failed");

    // Search by title keyword
    let query_quantum = PaperListQuery {
        query: Some("Quantum".to_string()),
        ..Default::default()
    };
    let results_quantum = PaperService::list_papers(&db, query_quantum).expect("search failed");
    assert_eq!(results_quantum.total_count, 1);
    assert_eq!(results_quantum.items[0].title, "Quantum Computation and Quantum Information");

    // Search by abstract keyword
    let query_residual = PaperListQuery {
        query: Some("residual".to_string()),
        ..Default::default()
    };
    let results_residual = PaperService::list_papers(&db, query_residual).expect("search failed");
    assert_eq!(results_residual.total_count, 1);
    assert_eq!(results_residual.items[0].title, "Deep Residual Learning for Image Recognition");

    // Search by author keyword
    let query_he = PaperListQuery {
        query: Some("Kaiming".to_string()),
        ..Default::default()
    };
    let results_he = PaperService::list_papers(&db, query_he).expect("search failed");
    assert_eq!(results_he.total_count, 1);
    assert_eq!(results_he.items[0].title, "Deep Residual Learning for Image Recognition");
}

#[test]
fn test_collection_crud_and_paper_relationships() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    // 1. Create collection
    let col = CollectionService::create_collection(
        &db,
        CollectionCreateInput {
            name: "Machine Learning Foundations".to_string(),
            description: Some("Key ML foundational literature".to_string()),
            color_hex: Some("#4f46e5".to_string()),
            parent_id: None,
        },
    )
    .expect("create collection failed");
    assert_eq!(col.name, "Machine Learning Foundations");
    assert_eq!(col.paper_count, 0);

    // 2. Reject duplicate name
    let dup_res = CollectionService::create_collection(
        &db,
        CollectionCreateInput {
            name: "Machine Learning Foundations".to_string(),
            description: None,
            color_hex: None,
            parent_id: None,
        },
    );
    assert!(dup_res.is_err());

    // 3. Create a paper and assign to collection
    let paper = PaperService::create_paper(
        &db,
        PaperCreateInput {
            title: "Supervised Learning Fundamentals".to_string(),
            canonical_doi: None,
            abstract_text: None,
            publication_date: None,
            publication_year: Some(2022),
            venue: None,
            venue_type: None,
            language: None,
            is_open_access: None,
            primary_landing_url: None,
            pdf_url: None,
            is_saved: Some(true),
            authors: vec!["Jane Doe".to_string()],
            collection_ids: Some(vec![col.id.clone()]),
            tags: None,
            source_id: None,
        },
    )
    .expect("create paper failed");

    let collections = CollectionService::list_collections(&db).expect("list collections failed");
    let target = collections.iter().find(|c| c.id == col.id).unwrap();
    assert_eq!(target.paper_count, 1);

    // 4. Update collection
    let updated = CollectionService::update_collection(
        &db,
        CollectionUpdateInput {
            id: col.id.clone(),
            name: "ML Foundations (Updated)".to_string(),
            description: Some("Updated description".to_string()),
            color_hex: Some("#10b981".to_string()),
        },
    )
    .expect("update collection failed");
    assert!(updated);

    // 5. Remove paper from collection
    let removed = CollectionService::remove_paper_from_collection(&db, &col.id, &paper.id)
        .expect("remove paper failed");
    assert!(removed);

    let collections_after = CollectionService::list_collections(&db).expect("list collections failed");
    let target_after = collections_after.iter().find(|c| c.id == col.id).unwrap();
    assert_eq!(target_after.paper_count, 0);

    // 6. Delete collection: Paper must NOT be deleted
    let deleted_col = CollectionService::delete_collection(&db, &col.id)
        .expect("delete collection failed");
    assert!(deleted_col);

    let paper_still_exists = PaperService::get_paper(&db, &paper.id).expect("query paper failed");
    assert!(paper_still_exists.is_some(), "Paper must not be deleted when collection is deleted");
}

#[test]
fn test_notes_and_tags_and_settings() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    // 1. Create a paper
    let paper = PaperService::create_paper(
        &db,
        PaperCreateInput {
            title: "Note Taking in Academic Research".to_string(),
            canonical_doi: None,
            abstract_text: None,
            publication_date: None,
            publication_year: Some(2023),
            venue: None,
            venue_type: None,
            language: None,
            is_open_access: None,
            primary_landing_url: None,
            pdf_url: None,
            is_saved: Some(true),
            authors: vec!["Alice Scholar".to_string()],
            collection_ids: None,
            tags: None,
            source_id: None,
        },
    )
    .expect("paper creation failed");

    // 2. Notes
    let note = NoteService::save_note(
        &db,
        NoteSaveInput {
            id: None,
            paper_id: paper.id.clone(),
            title: Some("Key Insights".to_string()),
            content_markdown: "Crucial methodological distinction on page 4.".to_string(),
        },
    )
    .expect("save note failed");
    assert_eq!(note.title, "Key Insights");

    let notes = NoteService::get_notes_for_paper(&db, &paper.id).expect("get notes failed");
    assert_eq!(notes.len(), 1);

    // 3. Tags
    let tag = TagService::assign_tag_to_paper(&db, &paper.id, "Methodology")
        .expect("assign tag failed");
    assert_eq!(tag.name, "Methodology");
    let all_tags = TagService::list_tags(&db).expect("list tags failed");
    assert_eq!(all_tags.len(), 1);

    // 4. Settings
    SettingsService::set_setting(&db, "theme_mode", "dark").expect("set setting failed");
    let theme = SettingsService::get_setting(&db, "theme_mode").expect("get setting failed");
    assert_eq!(theme.as_deref(), Some("dark"));

    let all_settings = SettingsService::list_settings(&db).expect("list settings failed");
    assert!(!all_settings.is_empty());
}
