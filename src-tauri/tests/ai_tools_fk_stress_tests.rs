use std::sync::Arc;
use std::thread;

use rand::Rng;
use rusqlite::params;
use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::ai_tools::*;
use research_paper_scraper_lib::repositories::ai_tools_repo::AiToolsRepository;
use uuid::Uuid;

#[test]
fn test_fk_stability_arbitrary_random_nonexistent_ids() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    // 1. Enforce and verify PRAGMA foreign_keys = ON
    let fk_status: i64 = conn
        .query_row("PRAGMA foreign_keys;", [], |r| r.get(0))
        .expect("check PRAGMA foreign_keys");
    assert_eq!(fk_status, 1, "PRAGMA foreign_keys must be strictly ON");

    // 2. Confirm database starts with zero sessions and zero documents
    let initial_docs: i64 = conn
        .query_row("SELECT COUNT(*) FROM integrity_documents", [], |r| r.get(0))
        .expect("count integrity_documents");
    let initial_sessions: i64 = conn
        .query_row("SELECT COUNT(*) FROM writing_sessions", [], |r| r.get(0))
        .expect("count writing_sessions");
    assert_eq!(initial_docs, 0);
    assert_eq!(initial_sessions, 0);

    // 3. Generate arbitrary random non-existent session_id and revision_id
    let random_session_id = format!("sess_{}", Uuid::new_v4());
    let random_revision_id = format!("rev_{}", Uuid::new_v4());

    let rev = WritingRevisionItem {
        id: random_revision_id.clone(),
        session_id: random_session_id.clone(),
        revision_number: 1,
        action_type: "clarity".to_string(),
        original_text: "We demonstrate the efficacy of our method across diverse benchmarks.".to_string(),
        revised_text: "Our experimental evaluation verifies efficacy across benchmark distributions.".to_string(),
        diff_summary: "Formalized vocabulary and tightened syntax.".to_string(),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: true,
        created_at: String::new(),
    };

    // 4. Save revision: must not fail with FOREIGN KEY constraint failed
    let save_res = AiToolsRepository::save_writing_revision(&conn, &rev);
    assert!(
        save_res.is_ok(),
        "save_writing_revision must succeed with non-existent session: {:?}",
        save_res.err()
    );

    // 5. Verify parent rows are automatically ensured
    let doc_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM integrity_documents WHERE id = 'doc_default_session'",
            [],
            |r| r.get(0),
        )
        .expect("check default document");
    assert_eq!(doc_count, 1, "Parent document 'doc_default_session' must be ensured");

    let session_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_sessions WHERE id = ?1",
            [&random_session_id],
            |r| r.get(0),
        )
        .expect("check session");
    assert_eq!(session_count, 1, "Parent writing_session must be ensured");

    let session_doc_id: String = conn
        .query_row(
            "SELECT document_id FROM writing_sessions WHERE id = ?1",
            [&random_session_id],
            |r| r.get(0),
        )
        .expect("check session document_id");
    assert_eq!(
        session_doc_id, "doc_default_session",
        "Writing session must reference valid document"
    );

    let revision_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_revisions WHERE id = ?1 AND session_id = ?2",
            [&random_revision_id, &random_session_id],
            |r| r.get(0),
        )
        .expect("check revision");
    assert_eq!(revision_count, 1, "Writing revision must be stored");

    // 6. Comprehensive SQLite foreign key check
    let fk_violations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_foreign_key_check()",
            [],
            |r| r.get(0),
        )
        .expect("pragma_foreign_key_check failed");
    assert_eq!(fk_violations, 0, "No foreign key violations allowed in database");
}

#[test]
fn test_fk_stability_stress_100_random_sessions() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();

    // Insert 100 distinct random sessions each with 2 revisions
    for i in 1..=100 {
        let session_id = format!("stress_sess_{}_{}", i, Uuid::new_v4());

        for rev_num in 1..=2 {
            let revision_id = format!("rev_{}_{}_{}", i, rev_num, Uuid::new_v4());
            let rev = WritingRevisionItem {
                id: revision_id,
                session_id: session_id.clone(),
                revision_number: rev_num,
                action_type: if rev_num == 1 { "academic_tone".to_string() } else { "conciseness".to_string() },
                original_text: format!("Raw sentence number {} iteration {}", rev_num, i),
                revised_text: format!("Refined academic sentence number {} iteration {}", rev_num, i),
                diff_summary: format!("Revision {} of batch {}", rev_num, i),
                preserved_numbers_ok: true,
                preserved_citations_ok: true,
                preserved_equations_ok: true,
                preserved_dois_ok: true,
                is_accepted: rev_num == 2,
                created_at: String::new(),
            };

            let res = AiToolsRepository::save_writing_revision(&conn, &rev);
            assert!(
                res.is_ok(),
                "Failed to save revision {} for session {}: {:?}",
                rev_num,
                session_id,
                res.err()
            );
        }

        let retrieved = AiToolsRepository::list_writing_revisions(&conn, &session_id)
            .expect("list_writing_revisions");
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].revision_number, 2);
        assert_eq!(retrieved[1].revision_number, 1);
    }

    // Verify database total counts
    let total_revisions: i64 = conn
        .query_row("SELECT COUNT(*) FROM writing_revisions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(total_revisions, 200);

    let total_sessions: i64 = conn
        .query_row("SELECT COUNT(*) FROM writing_sessions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(total_sessions, 100);

    // Verify foreign key integrity across all 300 rows
    let fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |r| r.get(0))
        .unwrap();
    assert_eq!(fk_violations, 0, "All 200 revisions and 100 sessions must satisfy foreign key constraints");
}

#[test]
fn test_fk_stability_with_custom_document_id_preservation() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();

    // Ingest a custom document with arbitrary random UUID document_id
    let custom_doc_id = format!("doc_custom_{}", Uuid::new_v4());
    let custom_doc_hash = format!("hash_{}", Uuid::new_v4());
    AiToolsRepository::ingest_document(
        &conn,
        &custom_doc_id,
        &custom_doc_hash,
        "custom_manuscript.pdf",
        "pdf",
        1500,
        "Original custom text content for stress test.",
        "original custom text content for stress test.",
    )
    .expect("ingest custom document");

    // Pre-create a writing_session pointing to this custom document
    let custom_session_id = format!("sess_custom_{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO writing_sessions (id, document_id, title, active_mode, created_at, updated_at)
         VALUES (?1, ?2, 'Custom Session Title', 'clarity', datetime('now'), datetime('now'))",
        params![&custom_session_id, &custom_doc_id],
    )
    .expect("pre-insert writing session");

    // Now save a writing revision on this custom session
    let rev = WritingRevisionItem {
        id: format!("rev_{}", Uuid::new_v4()),
        session_id: custom_session_id.clone(),
        revision_number: 1,
        action_type: "structure".to_string(),
        original_text: "Original custom text content for stress test.".to_string(),
        revised_text: "Rigorous empirical stress test of custom document foreign keys.".to_string(),
        diff_summary: "Updated text under custom document session".to_string(),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: true,
        created_at: String::new(),
    };

    AiToolsRepository::save_writing_revision(&conn, &rev).expect("save revision on custom session");

    // Ensure session STILL points to custom_doc_id and was NOT overwritten by doc_default_session
    let actual_doc_id: String = conn
        .query_row(
            "SELECT document_id FROM writing_sessions WHERE id = ?1",
            [&custom_session_id],
            |r| r.get(0),
        )
        .expect("query session document_id");
    assert_eq!(
        actual_doc_id, custom_doc_id,
        "Custom session document_id must be preserved (INSERT OR IGNORE semantics)"
    );

    let fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |r| r.get(0))
        .unwrap();
    assert_eq!(fk_violations, 0);
}

#[test]
fn test_fk_stability_edge_cases_special_characters_and_cascade() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let conn = db.lock().expect("db lock failed");

    conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();

    let very_long = "sess_very_long_0123456789".repeat(10);
    let weird_session_ids: Vec<&str> = vec![
        "sess with spaces and tabs \t",
        "sess_unicode_🔥_日本語_русский_عربي",
        "sess_punct_!@#$%^&*()_+-=[]{}|;':\",.<>?/~`",
        &very_long,
    ];

    for (idx, weird_sess) in weird_session_ids.iter().enumerate() {
        let rev = WritingRevisionItem {
            id: format!("rev_weird_{}", idx),
            session_id: weird_sess.to_string(),
            revision_number: 1,
            action_type: "punctuation".to_string(),
            original_text: "Text before.".to_string(),
            revised_text: "Text after.".to_string(),
            diff_summary: "Punctuation diff".to_string(),
            preserved_numbers_ok: true,
            preserved_citations_ok: true,
            preserved_equations_ok: true,
            preserved_dois_ok: true,
            is_accepted: false,
            created_at: String::new(),
        };

        AiToolsRepository::save_writing_revision(&conn, &rev)
            .expect("save_writing_revision with weird session_id must succeed");

        let retrieved = AiToolsRepository::list_writing_revisions(&conn, weird_sess)
            .expect("list revisions for weird session_id");
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].id, format!("rev_weird_{}", idx));
    }

    let fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |r| r.get(0))
        .unwrap();
    assert_eq!(fk_violations, 0);

    // Test Cascade Delete:
    // Deleting a writing_session must cascade delete its writing_revisions
    let target_sess = &weird_session_ids[0];
    let before_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_revisions WHERE session_id = ?1",
            [target_sess],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(before_count, 1);

    conn.execute("DELETE FROM writing_sessions WHERE id = ?1", [target_sess])
        .expect("delete writing session");

    let after_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_revisions WHERE session_id = ?1",
            [target_sess],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(after_count, 0, "Revisions must cascade delete when session is deleted");

    // Test deletion of default document:
    // Deleting doc_default_session cascades to all remaining default sessions
    conn.execute("DELETE FROM integrity_documents WHERE id = 'doc_default_session'", [])
        .expect("delete doc_default_session");

    let remaining_sessions: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM writing_sessions WHERE document_id = 'doc_default_session'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(remaining_sessions, 0, "Sessions referencing deleted document must cascade delete");

    // Now test resilience: Saving another revision after doc_default_session deletion
    // must recreate doc_default_session and succeed cleanly
    let new_rev = WritingRevisionItem {
        id: "rev_resilience_001".to_string(),
        session_id: "sess_resilience_001".to_string(),
        revision_number: 1,
        action_type: "recovery".to_string(),
        original_text: "System recovers.".to_string(),
        revised_text: "System cleanly self-heals parent document reference.".to_string(),
        diff_summary: "Self-healing test".to_string(),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: true,
        created_at: String::new(),
    };

    AiToolsRepository::save_writing_revision(&conn, &new_rev)
        .expect("save_writing_revision must re-ensure parent document and succeed");

    let recovered_doc: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM integrity_documents WHERE id = 'doc_default_session'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(recovered_doc, 1, "doc_default_session must be re-created");

    let final_fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |r| r.get(0))
        .unwrap();
    assert_eq!(final_fk_violations, 0);
}

#[test]
fn test_fk_stability_concurrent_threads_random_sessions() {
    let db = Arc::new(Database::open_in_memory().expect("in-memory db open failed"));

    // Verify foreign keys active
    {
        let conn = db.lock().unwrap();
        let fk: i64 = conn.query_row("PRAGMA foreign_keys;", [], |r| r.get(0)).unwrap();
        assert_eq!(fk, 1);
    }

    let mut handles = Vec::new();
    let num_threads = 8;
    let revisions_per_thread = 25;

    for thread_idx in 0..num_threads {
        let db_clone = Arc::clone(&db);
        let handle = thread::spawn(move || {
            let mut rng = rand::thread_rng();
            for i in 0..revisions_per_thread {
                let session_id = format!("thread_{}_sess_{}_{}", thread_idx, i, rng.gen::<u32>());
                let revision_id = format!("thread_{}_rev_{}_{}", thread_idx, i, rng.gen::<u32>());

                let rev = WritingRevisionItem {
                    id: revision_id,
                    session_id,
                    revision_number: 1,
                    action_type: "concurrency_test".to_string(),
                    original_text: format!("Thread {} sentence {}", thread_idx, i),
                    revised_text: format!("Thread {} refined sentence {}", thread_idx, i),
                    diff_summary: "Concurrent edit".to_string(),
                    preserved_numbers_ok: true,
                    preserved_citations_ok: true,
                    preserved_equations_ok: true,
                    preserved_dois_ok: true,
                    is_accepted: false,
                    created_at: String::new(),
                };

                let conn = db_clone.lock().unwrap();
                AiToolsRepository::save_writing_revision(&conn, &rev)
                    .expect("concurrent save_writing_revision must not fail");
            }
        });
        handles.push(handle);
    }

    for h in handles {
        h.join().expect("thread join failed");
    }

    let conn = db.lock().unwrap();
    let total_revisions: i64 = conn
        .query_row("SELECT COUNT(*) FROM writing_revisions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        total_revisions,
        (num_threads * revisions_per_thread) as i64,
        "All concurrent revisions must be saved"
    );

    let fk_violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |r| r.get(0))
        .unwrap();
    assert_eq!(fk_violations, 0, "No FK violations under concurrent load");
}
