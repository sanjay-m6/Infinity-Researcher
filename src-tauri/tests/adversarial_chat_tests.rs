use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::ai::{AiChatMessage, AiChatSession};
use research_paper_scraper_lib::repositories::AiRepository;
use rusqlite::params;

/// 1. Extreme payload stress: 50KB, 250KB, and 1MB message payloads
#[test]
fn test_extreme_payload_50kb_and_beyond() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_extreme_payloads";

    // 50KB payload
    let payload_50kb = "A".repeat(50 * 1024);
    let msg_50k = AiChatMessage {
        id: "msg_50k".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: payload_50kb.clone(),
        citations: vec![],
        provider_id: Some("local".to_string()),
        model_id: Some("gpt-4".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T01:00:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg_50k).expect("save 50KB message");

    // 250KB payload
    let payload_250kb = "B".repeat(250 * 1024);
    let msg_250k = AiChatMessage {
        id: "msg_250k".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content: payload_250kb.clone(),
        citations: vec![],
        provider_id: Some("local".to_string()),
        model_id: Some("gpt-4".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T01:01:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg_250k).expect("save 250KB message");

    // 1MB payload
    let payload_1mb = "C".repeat(1024 * 1024);
    let msg_1mb = AiChatMessage {
        id: "msg_1mb".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content: payload_1mb.clone(),
        citations: vec![],
        provider_id: Some("local".to_string()),
        model_id: Some("gpt-4".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T01:02:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg_1mb).expect("save 1MB message");

    let messages = AiRepository::list_messages(&conn, session_id).expect("list messages");
    assert_eq!(messages.len(), 3);
    assert_eq!(messages[0].content.len(), 50 * 1024);
    assert_eq!(messages[0].content, payload_50kb);
    assert_eq!(messages[1].content.len(), 250 * 1024);
    assert_eq!(messages[1].content, payload_250kb);
    assert_eq!(messages[2].content.len(), 1024 * 1024);
    assert_eq!(messages[2].content, payload_1mb);
}

/// 2. Extreme Unicode, RTL, Zalgo, and Markdown / HTML edge cases
#[test]
fn test_extreme_unicode_and_markdown_edge_cases() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_unicode_edge_cases";

    let exotic_title = "⚛️ Quantum 🧠 AI & 👨‍👩‍👧‍👦 RTL: سلام دنیا - שלום עולם - 日本語テスト - 🌟";
    let exotic_session = AiChatSession {
        id: session_id.to_string(),
        paper_id: None,
        title: exotic_title.to_string(),
        created_at: "2026-11-03T02:00:00Z".to_string(),
        updated_at: "2026-11-03T02:00:00Z".to_string(),
    };
    AiRepository::create_session(&conn, &exotic_session).expect("create exotic session");

    // Markdown with code fences, raw HTML, escaped quotes, newlines, tabs, and Zalgo
    let exotic_content = r#"
# 🚀 Research Copilot Analysis
Here is a sample code snippet with unescaped quotes and brackets:
```rust
fn test() -> Result<(), &str> {
    println!("Double \"quotes\" and 'single' quotes with \n newlines and \t tabs!");
    let html = "<script>alert('XSS & \"test\"')</script>";
    Ok(())
}
```
Math symbols: $\sum_{i=1}^N \frac{\alpha_i \times \beta_i}{\sqrt{\gamma^2 + \epsilon}} \approx \infty$
RTL text mixed with LTR: "This is Arabic: العربية and Hebrew: עִבְרִית with punctuation: ?!."
Zalgo text: H̶e̷l̸l̴o̵ ̶W̷o̸r̴l̶d̸ ̸Z̸a̷l̸g̴o̴!
Null representation: \0 \\0 null
"#;

    let msg = AiChatMessage {
        id: "msg_exotic_1".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content: exotic_content.to_string(),
        citations: vec![],
        provider_id: Some("ollama/深搜-r1:7b".to_string()),
        model_id: Some("qwen2.5:32b-instruct-q4_K_M".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T02:01:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg).expect("save exotic message");

    let session = AiRepository::get_session(&conn, session_id)
        .expect("get session")
        .expect("session must exist");
    assert_eq!(session.title, exotic_title);

    let msgs = AiRepository::list_messages(&conn, session_id).expect("list messages");
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].content, exotic_content);
    assert_eq!(msgs[0].provider_id.as_deref(), Some("ollama/深搜-r1:7b"));
}

/// 3. SQL injection resistance across all fields and methods
#[test]
fn test_sql_injection_resilience() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let malicious_session_id = "sess_inj'; DROP TABLE ai_chat_sessions; --";
    let malicious_title = "Title' OR '1'='1'; DROP TABLE ai_chat_messages; --";

    // 1. Create session with injection payload
    let session = AiChatSession {
        id: malicious_session_id.to_string(),
        paper_id: None,
        title: malicious_title.to_string(),
        created_at: "2026-11-03T03:00:00Z".to_string(),
        updated_at: "2026-11-03T03:00:00Z".to_string(),
    };
    AiRepository::create_session(&conn, &session).expect("create session with SQL payload");

    // Verify session table was NOT dropped
    let retrieved = AiRepository::get_session(&conn, malicious_session_id)
        .expect("get session with SQL payload")
        .expect("session must exist");
    assert_eq!(retrieved.id, malicious_session_id);
    assert_eq!(retrieved.title, malicious_title);

    // 2. Save message with injection payloads
    let malicious_msg_id = "msg_inj'; DELETE FROM papers; --";
    let malicious_content = "'; DROP TABLE papers; SELECT * FROM ai_chat_sessions WHERE '1'='1";
    let msg = AiChatMessage {
        id: malicious_msg_id.to_string(),
        session_id: malicious_session_id.to_string(),
        paper_id: Some("fake_paper' OR '1'='1".to_string()),
        role: "user' OR '1'='1".to_string(),
        content: malicious_content.to_string(),
        citations: vec![],
        provider_id: Some("prov'; DROP TABLE app_settings; --".to_string()),
        model_id: Some("model' OR 1=1; --".to_string()),
        retrieval_mode: "mode'; VACUUM; --".to_string(),
        created_at: "2026-11-03T03:01:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg).expect("save message with SQL payload");

    // 3. Verify messages table and papers table are intact
    let msgs = AiRepository::list_messages(&conn, malicious_session_id).expect("list messages");
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].id, malicious_msg_id);
    assert_eq!(msgs[0].content, malicious_content);

    // Verify critical tables are completely intact
    let papers_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM papers", [], |row| row.get(0))
        .expect("papers table must exist");
    assert_eq!(papers_count, 0);

    let sessions_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_chat_sessions", [], |row| {
            row.get(0)
        })
        .expect("sessions table must exist");
    assert_eq!(sessions_count, 1);

    // 4. Test delete_session with injection payload
    AiRepository::delete_session(&conn, malicious_session_id).expect("delete session");
    assert!(AiRepository::get_session(&conn, malicious_session_id)
        .expect("get")
        .is_none());

    // 5. Test clear_session_messages with injection payload
    AiRepository::clear_session_messages(&conn, "' OR '1'='1").expect("clear messages");
}

/// 4. Non-existent session IDs, empty boundaries, and default value fallbacks
#[test]
fn test_non_existent_ids_and_boundary_safety() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let ghost_id = "non_existent_ghost_session_999";

    // Query non-existent session
    let res = AiRepository::get_session(&conn, ghost_id).expect("get_session must not error");
    assert!(res.is_none(), "non-existent session should return None");

    // List messages for non-existent session
    let msgs = AiRepository::list_messages(&conn, ghost_id).expect("list_messages must not error");
    assert!(
        msgs.is_empty(),
        "non-existent session messages should be empty vector"
    );

    // Delete non-existent session (should be a safe no-op)
    let del_res = AiRepository::delete_session(&conn, ghost_id);
    assert!(
        del_res.is_ok(),
        "deleting non-existent session must succeed without error"
    );

    // Clear non-existent session messages (should be a safe no-op)
    let clear_res = AiRepository::clear_session_messages(&conn, ghost_id);
    assert!(
        clear_res.is_ok(),
        "clearing non-existent session must succeed without error"
    );

    // Ensure session exists with empty default title & timestamps
    AiRepository::ensure_session_exists(&conn, "auto_fallback_sess", None, "   ")
        .expect("ensure_session_exists with blank title");

    let auto_sess = AiRepository::get_session(&conn, "auto_fallback_sess")
        .expect("get session")
        .expect("must exist");
    assert_eq!(
        auto_sess.title, "Chat Session",
        "Blank title must fallback to 'Chat Session'"
    );
    assert!(!auto_sess.created_at.is_empty());
    assert!(!auto_sess.updated_at.is_empty());

    // Save message with empty ID should auto-generate valid UUID
    let msg_blank_id = AiChatMessage {
        id: "   ".to_string(),
        session_id: "auto_fallback_sess".to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "Message with blank id".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "".to_string(),
    };
    AiRepository::save_message(&conn, &msg_blank_id).expect("save message with blank id");

    let msgs_after = AiRepository::list_messages(&conn, "auto_fallback_sess").expect("list");
    assert_eq!(msgs_after.len(), 1);
    assert!(
        !msgs_after[0].id.trim().is_empty(),
        "Blank message id must be populated with a generated ID"
    );
    assert!(
        !msgs_after[0].created_at.is_empty(),
        "Blank created_at must be populated with current UTC timestamp"
    );
}

/// 5. Duplicate ID handling: primary key collision behavior and idempotency
#[test]
fn test_duplicate_ids_and_idempotency() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session = AiChatSession {
        id: "duplicate_session_check".to_string(),
        paper_id: None,
        title: "Session First Pass".to_string(),
        created_at: "2026-11-03T04:00:00Z".to_string(),
        updated_at: "2026-11-03T04:00:00Z".to_string(),
    };

    // First insertion succeeds
    AiRepository::create_session(&conn, &session).expect("first create_session must succeed");

    // Second insertion with identical ID must fail with UNIQUE constraint
    let err = AiRepository::create_session(&conn, &session);
    assert!(
        err.is_err(),
        "second create_session with same ID must error"
    );
    let err_str = err.unwrap_err().to_string();
    assert!(
        err_str.contains("UNIQUE constraint failed"),
        "error must indicate UNIQUE constraint failure, got: {}",
        err_str
    );

    // By contrast, ensure_session_exists must be idempotent (no error on repeated calls)
    for _ in 0..10 {
        AiRepository::ensure_session_exists(
            &conn,
            "duplicate_session_check",
            None,
            "Another Title",
        )
        .expect("ensure_session_exists must be idempotent");
    }
    // Verify title was not overwritten by ensure_session_exists
    let curr_sess = AiRepository::get_session(&conn, "duplicate_session_check")
        .unwrap()
        .unwrap();
    assert_eq!(curr_sess.title, "Session First Pass");

    // Test duplicate message IDs
    let msg = AiChatMessage {
        id: "fixed_message_id_001".to_string(),
        session_id: "duplicate_session_check".to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "Original message text".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T04:05:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg).expect("first save_message must succeed");

    // Second save_message with same ID must return an Err, not corrupt or duplicate
    let msg_dup = AiChatMessage {
        id: "fixed_message_id_001".to_string(),
        session_id: "duplicate_session_check".to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content: "Different content attempting collision".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T04:06:00Z".to_string(),
    };
    let save_err = AiRepository::save_message(&conn, &msg_dup);
    assert!(
        save_err.is_err(),
        "saving message with duplicate ID must fail"
    );

    // Verify original content preserved
    let msgs = AiRepository::list_messages(&conn, "duplicate_session_check").unwrap();
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].content, "Original message text");
}

/// 6. Foreign Key validation, PRAGMA foreign_keys = ON enforcement, and SET NULL semantics
#[test]
fn test_foreign_key_enforcement_and_set_null_semantics() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    // 1. Verify PRAGMA foreign_keys = ON
    let fk_status: i32 = conn
        .query_row("PRAGMA foreign_keys;", [], |row| row.get(0))
        .expect("query foreign_keys pragma");
    assert_eq!(fk_status, 1, "PRAGMA foreign_keys must be active (1)");

    // 2. Direct violation test: Attempt to insert message referencing non-existent session
    let direct_fk_err = conn.execute(
        "INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
         VALUES ('bad_fk_msg', 'completely_missing_session', 'user', 'should fail', datetime('now'))",
        [],
    );
    assert!(
        direct_fk_err.is_err(),
        "Direct SQL insertion into ai_chat_messages without valid session_id MUST fail foreign key check"
    );

    // 3. Test Paper foreign key SET NULL behavior on paper deletion
    conn.execute(
        "INSERT INTO papers (id, title, clean_title_key, is_open_access, has_file, is_saved, created_at, updated_at)
         VALUES ('paper_fk_victim', 'Paper To Be Deleted', 'paper to be deleted', 1, 0, 1, datetime('now'), datetime('now'))",
        [],
    ).expect("insert paper");

    let session = AiChatSession {
        id: "sess_with_paper_victim".to_string(),
        paper_id: Some("paper_fk_victim".to_string()),
        title: "Victim Session".to_string(),
        created_at: "2026-11-03T05:00:00Z".to_string(),
        updated_at: "2026-11-03T05:00:00Z".to_string(),
    };
    AiRepository::create_session(&conn, &session).expect("create session with valid paper");

    let msg = AiChatMessage {
        id: "msg_with_paper_victim".to_string(),
        session_id: "sess_with_paper_victim".to_string(),
        paper_id: Some("paper_fk_victim".to_string()),
        role: "user".to_string(),
        content: "Referencing victim paper".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-03T05:01:00Z".to_string(),
    };
    AiRepository::save_message(&conn, &msg).expect("save message with valid paper");

    // Verify paper_id is linked
    let s_before = AiRepository::get_session(&conn, "sess_with_paper_victim")
        .unwrap()
        .unwrap();
    assert_eq!(s_before.paper_id.as_deref(), Some("paper_fk_victim"));
    let m_before = AiRepository::list_messages(&conn, "sess_with_paper_victim").unwrap();
    assert_eq!(m_before[0].paper_id.as_deref(), Some("paper_fk_victim"));

    // Now DELETE the paper from papers table
    conn.execute("DELETE FROM papers WHERE id = 'paper_fk_victim'", [])
        .expect("delete victim paper");

    // Verify SET NULL: session and messages survive, paper_id becomes NULL
    let s_after = AiRepository::get_session(&conn, "sess_with_paper_victim")
        .unwrap()
        .unwrap();
    assert_eq!(
        s_after.paper_id, None,
        "ai_chat_sessions.paper_id must be set to NULL when referenced paper is deleted"
    );

    let m_after = AiRepository::list_messages(&conn, "sess_with_paper_victim").unwrap();
    assert_eq!(m_after.len(), 1);
    assert_eq!(
        m_after[0].paper_id, None,
        "ai_chat_messages.paper_id must be set to NULL when referenced paper is deleted"
    );
}

/// 7. Concurrent multi-threaded stress: 20 threads reading, writing, clearing
#[test]
fn test_multithreaded_concurrency_stress() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");

    let num_threads = 16;
    let ops_per_thread = 50;
    let mut handles = vec![];

    let shared_session = "shared_concurrent_session";

    for thread_idx in 0..num_threads {
        let db_clone = db.clone();
        let session_name = if thread_idx % 2 == 0 {
            shared_session.to_string()
        } else {
            format!("session_thread_{}", thread_idx)
        };

        handles.push(thread::spawn(move || {
            for op in 0..ops_per_thread {
                let conn = db_clone.lock().expect("lock in thread");

                match op % 4 {
                    0 => {
                        // Save message
                        let msg = AiChatMessage {
                            id: format!("msg_t{}_op{}", thread_idx, op),
                            session_id: session_name.clone(),
                            paper_id: None,
                            role: if op % 2 == 0 {
                                "user".to_string()
                            } else {
                                "assistant".to_string()
                            },
                            content: format!("Thread {} op {} message payload", thread_idx, op),
                            citations: vec![],
                            provider_id: None,
                            model_id: None,
                            retrieval_mode: "paper".to_string(),
                            created_at: format!("2026-11-03T06:{:02}:{:02}Z", thread_idx, op % 60),
                        };
                        let _ = AiRepository::save_message(&conn, &msg);
                    }
                    1 => {
                        // List messages
                        let _ = AiRepository::list_messages(&conn, &session_name);
                    }
                    2 => {
                        // List all sessions
                        let _ = AiRepository::list_sessions(&conn);
                    }
                    3 => {
                        // Ensure session exists
                        let _ = AiRepository::ensure_session_exists(
                            &conn,
                            &session_name,
                            None,
                            "Concurrent Test Session",
                        );
                    }
                    _ => unreachable!(),
                }
            }
        }));
    }

    for h in handles {
        h.join().expect("thread joined successfully without panic");
    }

    let conn = db.lock().expect("final lock");
    let all_sessions = AiRepository::list_sessions(&conn).expect("list sessions after concurrency");
    assert!(
        !all_sessions.is_empty(),
        "sessions must persist after concurrent load"
    );
}

/// 8. Session deleted while messages are being actively queried and inserted
#[test]
fn test_session_deleted_while_messages_queried() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let target_session = "target_race_session";

    // Prepopulate 30 messages
    {
        let conn = db.lock().unwrap();
        for i in 0..30 {
            let msg = AiChatMessage {
                id: format!("pre_msg_{}", i),
                session_id: target_session.to_string(),
                paper_id: None,
                role: "assistant".to_string(),
                content: format!("Pre-existing message {}", i),
                citations: vec![],
                provider_id: None,
                model_id: None,
                retrieval_mode: "paper".to_string(),
                created_at: format!("2026-11-03T07:00:{:02}Z", i),
            };
            AiRepository::save_message(&conn, &msg).unwrap();
        }
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let query_count = Arc::new(AtomicUsize::new(0));

    // Reader thread: repeatedly query messages
    let reader_db = db.clone();
    let reader_stop = stop_flag.clone();
    let reader_qc = query_count.clone();
    let reader_handle = thread::spawn(move || {
        while !reader_stop.load(Ordering::Relaxed) {
            let conn = reader_db.lock().unwrap();
            let msgs = AiRepository::list_messages(&conn, target_session);
            assert!(
                msgs.is_ok(),
                "querying messages during concurrent delete must never error"
            );
            reader_qc.fetch_add(1, Ordering::Relaxed);
            drop(conn);
            thread::sleep(Duration::from_millis(1));
        }
    });

    // Deleter thread: sleep briefly then delete target_session
    let deleter_db = db.clone();
    let deleter_handle = thread::spawn(move || {
        thread::sleep(Duration::from_millis(15));
        let conn = deleter_db.lock().unwrap();
        AiRepository::delete_session(&conn, target_session).expect("delete session must succeed");
    });

    deleter_handle.join().expect("deleter joined");
    thread::sleep(Duration::from_millis(20));
    stop_flag.store(true, Ordering::Relaxed);
    reader_handle.join().expect("reader joined");

    // Verify final state: session and all messages are completely gone
    let conn = db.lock().unwrap();
    assert!(AiRepository::get_session(&conn, target_session)
        .unwrap()
        .is_none());
    assert_eq!(
        AiRepository::list_messages(&conn, target_session)
            .unwrap()
            .len(),
        0
    );
    assert!(query_count.load(Ordering::Relaxed) > 0);
}

/// 9. Malformed / corrupted citations recovery
#[test]
fn test_corrupted_citations_json_recovery() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "sess_corrupt_citations";
    AiRepository::ensure_session_exists(&conn, session_id, None, "Corrupt Cits").unwrap();

    // Directly insert raw row with invalid JSON in citations_json
    conn.execute(
        "INSERT INTO ai_chat_messages (
            id, session_id, paper_id, role, content, citations_json, created_at
         ) VALUES (?1, ?2, NULL, 'assistant', 'Response with bad JSON citations', '{NOT_VALID_JSON}', datetime('now'))",
        params!["msg_corrupt_cits", session_id],
    ).expect("raw insert bad JSON");

    // list_messages should safely handle the unparseable JSON by returning empty citations vec
    let msgs = AiRepository::list_messages(&conn, session_id)
        .expect("list_messages should not fail on malformed JSON");
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].id, "msg_corrupt_cits");
    assert!(
        msgs[0].citations.is_empty(),
        "Malformed citations_json must fall back to empty vector without crashing"
    );
}
