use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::ai::{AiChatMessage, AiChatSession, AiChunkCitation};
use research_paper_scraper_lib::repositories::AiRepository;

#[test]
fn test_session_lifecycle_crud() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    // 1. Create a session
    let session = AiChatSession {
        id: "session_lifecycle_1".to_string(),
        paper_id: None,
        title: "Research on Quantum Computing".to_string(),
        created_at: "2026-11-01T10:00:00Z".to_string(),
        updated_at: "2026-11-01T10:00:00Z".to_string(),
    };
    AiRepository::create_session(&conn, &session).expect("failed to create session");

    // 2. Retrieve session
    let fetched = AiRepository::get_session(&conn, "session_lifecycle_1")
        .expect("query session")
        .expect("session must exist");
    assert_eq!(fetched.id, "session_lifecycle_1");
    assert_eq!(fetched.title, "Research on Quantum Computing");
    assert_eq!(fetched.paper_id, None);

    // 3. List sessions
    let list = AiRepository::list_sessions(&conn).expect("list sessions");
    assert!(list.iter().any(|s| s.id == "session_lifecycle_1"));

    // 4. Delete session
    AiRepository::delete_session(&conn, "session_lifecycle_1").expect("delete session");
    let after_delete =
        AiRepository::get_session(&conn, "session_lifecycle_1").expect("query session");
    assert!(after_delete.is_none(), "deleted session should be None");
}

#[test]
fn test_auto_create_parent_session_on_save_message() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let orphan_session_id = "orphan_session_101";

    // Verify session does not exist yet
    let initial = AiRepository::get_session(&conn, orphan_session_id).expect("query session");
    assert!(initial.is_none());

    // Save message directly to this non-existent session
    let msg = AiChatMessage {
        id: "msg_auto_1".to_string(),
        session_id: orphan_session_id.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "What are the core findings of this paper?".to_string(),
        citations: vec![],
        provider_id: Some("ollama_local".to_string()),
        model_id: Some("llama3".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T12:00:00Z".to_string(),
    };

    // This should NOT fail with FOREIGN KEY constraint failed error
    AiRepository::save_message(&conn, &msg)
        .expect("save_message should automatically ensure session exists");

    // Verify session was created automatically
    let created_session = AiRepository::get_session(&conn, orphan_session_id)
        .expect("query session")
        .expect("parent session must have been created");
    assert_eq!(created_session.id, orphan_session_id);

    // Verify message was saved successfully
    let msgs = AiRepository::list_messages(&conn, orphan_session_id).expect("list messages");
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].id, "msg_auto_1");
    assert_eq!(msgs[0].content, "What are the core findings of this paper?");
}

#[test]
fn test_unimported_paper_id_does_not_trigger_fk_violation() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_with_unimported_paper";
    let fake_paper_id = "arxiv_unimported_2401.99999";

    // Saving a message with a paper_id not in papers table should NOT fail
    let msg = AiChatMessage {
        id: "msg_unimported_1".to_string(),
        session_id: session_id.to_string(),
        paper_id: Some(fake_paper_id.to_string()),
        role: "user".to_string(),
        content: "Explain this unimported arXiv preprint.".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T14:00:00Z".to_string(),
    };

    AiRepository::save_message(&conn, &msg)
        .expect("saving message with unimported paper_id must sanitize FK to NULL");

    let messages = AiRepository::list_messages(&conn, session_id).expect("list messages");
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, "msg_unimported_1");
    assert_eq!(
        messages[0].paper_id, None,
        "Unknown paper_id must be sanitized to None to avoid foreign key violation"
    );

    // Now test with a REAL paper in the database
    conn.execute(
        "INSERT INTO papers (id, title, clean_title_key, is_open_access, has_file, is_saved, created_at, updated_at)
         VALUES ('real_paper_001', 'Attention Is All You Need', 'attention is all you need', 1, 0, 1, datetime('now'), datetime('now'))",
        [],
    ).expect("insert valid paper");

    let msg_real = AiChatMessage {
        id: "msg_real_paper_1".to_string(),
        session_id: session_id.to_string(),
        paper_id: Some("real_paper_001".to_string()),
        role: "assistant".to_string(),
        content: "The Transformer architecture relies entirely on self-attention mechanisms."
            .to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T14:01:00Z".to_string(),
    };

    AiRepository::save_message(&conn, &msg_real)
        .expect("saving message with valid paper_id must succeed");

    let all_msgs = AiRepository::list_messages(&conn, session_id).expect("list messages");
    assert_eq!(all_msgs.len(), 2);
    let real_msg = all_msgs
        .iter()
        .find(|m| m.id == "msg_real_paper_1")
        .unwrap();
    assert_eq!(real_msg.paper_id, Some("real_paper_001".to_string()));
}

#[test]
fn test_chronological_message_ordering() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_chronological";

    // Insert 3 messages with out-of-order created_at timestamps
    let msg_middle = AiChatMessage {
        id: "msg_mid".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content: "Second message".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-01T12:00:00Z".to_string(),
    };

    let msg_early = AiChatMessage {
        id: "msg_early".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "First message".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-01T10:00:00Z".to_string(),
    };

    let msg_late = AiChatMessage {
        id: "msg_late".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "Third message".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-01T14:00:00Z".to_string(),
    };

    // Insert out of order: middle, late, early
    AiRepository::save_message(&conn, &msg_middle).expect("save mid");
    AiRepository::save_message(&conn, &msg_late).expect("save late");
    AiRepository::save_message(&conn, &msg_early).expect("save early");

    let retrieved = AiRepository::list_messages(&conn, session_id).expect("list messages");
    assert_eq!(retrieved.len(), 3);
    assert_eq!(retrieved[0].id, "msg_early");
    assert_eq!(retrieved[1].id, "msg_mid");
    assert_eq!(retrieved[2].id, "msg_late");
}

#[test]
fn test_clear_session_messages() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_to_clear";

    for i in 1..=4 {
        let msg = AiChatMessage {
            id: format!("msg_clear_{}", i),
            session_id: session_id.to_string(),
            paper_id: None,
            role: if i % 2 == 1 {
                "user".to_string()
            } else {
                "assistant".to_string()
            },
            content: format!("Message content {}", i),
            citations: vec![],
            provider_id: None,
            model_id: None,
            retrieval_mode: "paper".to_string(),
            created_at: format!("2026-11-02T10:0{}:00Z", i),
        };
        AiRepository::save_message(&conn, &msg).expect("save message");
    }

    assert_eq!(
        AiRepository::list_messages(&conn, session_id)
            .expect("list")
            .len(),
        4
    );

    // Clear session messages
    AiRepository::clear_session_messages(&conn, session_id).expect("clear messages");

    assert_eq!(
        AiRepository::list_messages(&conn, session_id)
            .expect("list")
            .len(),
        0,
        "All messages should be deleted after clearing"
    );

    // The session itself should remain intact
    let session = AiRepository::get_session(&conn, session_id).expect("get session");
    assert!(
        session.is_some(),
        "Session record itself should not be deleted by clear_session_messages"
    );
}

#[test]
fn test_cascade_deletion_on_session_delete() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_cascade_target";

    let session = AiChatSession {
        id: session_id.to_string(),
        paper_id: None,
        title: "Session to Cascade Delete".to_string(),
        created_at: "2026-11-01T08:00:00Z".to_string(),
        updated_at: "2026-11-01T08:00:00Z".to_string(),
    };
    AiRepository::create_session(&conn, &session).expect("create session");

    // Add 3 messages
    for i in 1..=3 {
        let msg = AiChatMessage {
            id: format!("msg_cascade_{}", i),
            session_id: session_id.to_string(),
            paper_id: None,
            role: "user".to_string(),
            content: format!("Cascade test {}", i),
            citations: vec![],
            provider_id: None,
            model_id: None,
            retrieval_mode: "paper".to_string(),
            created_at: format!("2026-11-01T08:0{}:00Z", i),
        };
        AiRepository::save_message(&conn, &msg).expect("save message");
    }

    assert_eq!(
        AiRepository::list_messages(&conn, session_id)
            .expect("list")
            .len(),
        3
    );

    // Deleting the session must cascade-delete all messages
    AiRepository::delete_session(&conn, session_id).expect("delete session");

    assert!(AiRepository::get_session(&conn, session_id)
        .expect("get")
        .is_none());
    assert_eq!(
        AiRepository::list_messages(&conn, session_id)
            .expect("list")
            .len(),
        0,
        "Messages must be cascade deleted when parent session is deleted"
    );
}

#[test]
fn test_session_isolation() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_a = "session_panel_ai_hub";
    let session_b = "session_panel_pdf_viewer";

    let msg_a = AiChatMessage {
        id: "msg_a_1".to_string(),
        session_id: session_a.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "Question in AI Hub".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T15:00:00Z".to_string(),
    };

    let msg_b = AiChatMessage {
        id: "msg_b_1".to_string(),
        session_id: session_b.to_string(),
        paper_id: None,
        role: "user".to_string(),
        content: "Question in PDF Viewer".to_string(),
        citations: vec![],
        provider_id: None,
        model_id: None,
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T15:01:00Z".to_string(),
    };

    AiRepository::save_message(&conn, &msg_a).expect("save msg_a");
    AiRepository::save_message(&conn, &msg_b).expect("save msg_b");

    let msgs_a = AiRepository::list_messages(&conn, session_a).expect("list a");
    let msgs_b = AiRepository::list_messages(&conn, session_b).expect("list b");

    assert_eq!(msgs_a.len(), 1);
    assert_eq!(msgs_a[0].content, "Question in AI Hub");

    assert_eq!(msgs_b.len(), 1);
    assert_eq!(msgs_b[0].content, "Question in PDF Viewer");

    // Clearing session A does not touch session B
    AiRepository::clear_session_messages(&conn, session_a).expect("clear a");
    assert_eq!(
        AiRepository::list_messages(&conn, session_a)
            .expect("list a")
            .len(),
        0
    );
    assert_eq!(
        AiRepository::list_messages(&conn, session_b)
            .expect("list b")
            .len(),
        1
    );
}

#[test]
fn test_citation_roundtrip_persistence() {
    let db = Database::open_in_memory().expect("failed to open in-memory db");
    let conn = db.lock().expect("lock db");

    let session_id = "session_with_citations";

    let citation = AiChunkCitation {
        chunk_id: "chk_101".to_string(),
        paper_id: "paper_x".to_string(),
        paper_title: "Advances in Deep Learning".to_string(),
        page_number: 4,
        section_heading: Some("Methodology".to_string()),
        snippet: "We propose a novel attention layer with O(N) complexity.".to_string(),
        score: 0.94,
    };

    let msg = AiChatMessage {
        id: "msg_cit_1".to_string(),
        session_id: session_id.to_string(),
        paper_id: None,
        role: "assistant".to_string(),
        content:
            "According to the paper [Page 4], a novel attention layer achieves linear complexity."
                .to_string(),
        citations: vec![citation],
        provider_id: Some("nvidia_nim".to_string()),
        model_id: Some("nemotron-3".to_string()),
        retrieval_mode: "paper".to_string(),
        created_at: "2026-11-02T16:00:00Z".to_string(),
    };

    AiRepository::save_message(&conn, &msg).expect("save message with citations");

    let loaded = AiRepository::list_messages(&conn, session_id).expect("list");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].citations.len(), 1);
    assert_eq!(loaded[0].citations[0].chunk_id, "chk_101");
    assert_eq!(loaded[0].citations[0].page_number, 4);
    assert_eq!(
        loaded[0].citations[0].section_heading,
        Some("Methodology".to_string())
    );
    assert_eq!(loaded[0].citations[0].score, 0.94);
}
