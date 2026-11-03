use research_paper_scraper_lib::database::migrations::{get_schema_version, run_migrations};
use research_paper_scraper_lib::domain::projects::*;
use research_paper_scraper_lib::repositories::project_repo::ProjectRepository;
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&mut conn).expect("run_migrations failed");
    conn
}

#[test]
fn test_schema_migration_18_applied_cleanly() {
    let conn = setup_test_db();
    let version = get_schema_version(&conn).expect("get_schema_version failed");
    assert_eq!(version, 18, "Current schema version must be 18");

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                'research_domains', 'research_projects', 'project_milestones',
                'project_tasks', 'task_dependencies', 'project_papers',
                'task_papers', 'task_reminders', 'project_activity'
            )",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 9, "All 9 project management tables must exist");
}

#[test]
fn test_hierarchical_domains_and_custom_creation() {
    let conn = setup_test_db();

    // Verify pre-seeded domains exist
    let domains = ProjectRepository::list_domains(&conn).expect("list_domains failed");
    assert!(
        domains.len() >= 25,
        "Expected 25+ pre-seeded domains and subdomains"
    );

    let cs = domains
        .iter()
        .find(|d| d.id == "dom_cs")
        .expect("Computer Science must exist");
    assert_eq!(cs.name, "Computer Science");
    assert!(cs.parent_id.is_none());

    let ai = domains
        .iter()
        .find(|d| d.id == "sub_cs_ai")
        .expect("AI subdomain must exist");
    assert_eq!(ai.parent_id.as_deref(), Some("dom_cs"));

    // Create a custom domain
    let custom_input = CreateDomainInput {
        name: "Quantum Information Systems".to_string(),
        parent_id: Some("dom_cs".to_string()),
        description: Some("Quantum computing & quantum cryptography".to_string()),
        icon: Some("Atom".to_string()),
        color: Some("#8b5cf6".to_string()),
    };

    let created = ProjectRepository::create_custom_domain(&conn, &custom_input)
        .expect("create_custom_domain failed");
    assert_eq!(created.name, "Quantum Information Systems");
    assert!(created.is_custom);
    assert_eq!(created.parent_id.as_deref(), Some("dom_cs"));
}

#[test]
fn test_project_crud_and_progress_calculation() {
    let conn = setup_test_db();

    let project_input = CreateProjectInput {
        title: "AI-Based Research Paper Recommendation System".to_string(),
        description: Some("Building multi-source neural recommendations".to_string()),
        objective: Some("Improve recall of relevant Green Open Access literature".to_string()),
        research_questions: Some(
            "How does citation topology improve cold-start recommendations?".to_string(),
        ),
        hypotheses: Some(
            "Graph neural networks outperform keyword-only search by >25%.".to_string(),
        ),
        expected_outcomes: Some(
            "A peer-reviewed benchmark and functional recommendation engine".to_string(),
        ),
        primary_domain_id: Some("dom_cs".to_string()),
        subdomain_id: Some("sub_cs_ai".to_string()),
        custom_domain_text: None,
        priority: Some("high".to_string()),
        start_date: Some("2026-01-01".to_string()),
        target_deadline: Some("2026-06-01".to_string()),
        template_type: Some("experimental_ml".to_string()),
        tags: Some(vec!["recsys".to_string(), "gnn".to_string()]),
        notes: Some("Initial project setup notes".to_string()),
    };

    let project =
        ProjectRepository::create_project(&conn, &project_input).expect("create_project failed");
    assert_eq!(
        project.title,
        "AI-Based Research Paper Recommendation System"
    );
    assert_eq!(project.progress_percent, 0.0);

    // Add Milestone
    let ms_input = CreateMilestoneInput {
        project_id: project.id.clone(),
        title: "Milestone 1: Literature Matrix & Baselines".to_string(),
        description: Some("Extract 20 papers into matrix".to_string()),
        due_date: Some("2026-02-15".to_string()),
        sort_order: Some(0),
    };
    let milestone =
        ProjectRepository::create_milestone(&conn, &ms_input).expect("create_milestone failed");
    assert_eq!(
        milestone.title,
        "Milestone 1: Literature Matrix & Baselines"
    );

    // Add Task 1
    let t1_input = CreateTaskInput {
        project_id: Some(project.id.clone()),
        parent_task_id: None,
        milestone_id: Some(milestone.id.clone()),
        title: "Ingest 30 benchmark papers".to_string(),
        description: Some("Query OpenAlex and Europe PMC".to_string()),
        phase: Some("literature_review".to_string()),
        status: Some("todo".to_string()),
        priority: Some("high".to_string()),
        start_date: Some("2026-01-05".to_string()),
        due_date: Some("2026-01-20".to_string()),
        estimated_hours: Some(15.0),
        tags: Some(vec!["discovery".to_string()]),
        dependency_task_ids: None,
        linked_paper_ids: None,
    };
    let task1 = ProjectRepository::create_task(&conn, &t1_input).expect("create task1 failed");

    // Add Task 2
    let t2_input = CreateTaskInput {
        project_id: Some(project.id.clone()),
        parent_task_id: None,
        milestone_id: Some(milestone.id.clone()),
        title: "Extract methods and sample sizes".to_string(),
        description: Some("Populate literature matrix".to_string()),
        phase: Some("literature_review".to_string()),
        status: Some("todo".to_string()),
        priority: Some("high".to_string()),
        start_date: Some("2026-01-21".to_string()),
        due_date: Some("2026-02-10".to_string()),
        estimated_hours: Some(20.0),
        tags: Some(vec!["matrix".to_string()]),
        dependency_task_ids: Some(vec![task1.id.clone()]),
        linked_paper_ids: None,
    };
    let _task2 = ProjectRepository::create_task(&conn, &t2_input).expect("create task2 failed");

    // Initially progress is 0% (0 of 2 tasks completed)
    let details = ProjectRepository::get_project_with_details(&conn, &project.id)
        .unwrap()
        .unwrap();
    assert_eq!(details.total_tasks, 2);
    assert_eq!(details.completed_tasks, 0);
    assert_eq!(details.project.progress_percent, 0.0);

    // Complete task 1
    ProjectRepository::update_task_status(&conn, &task1.id, "completed")
        .expect("update_task_status failed");

    // Progress should now be exactly 50%
    let details_after = ProjectRepository::get_project_with_details(&conn, &project.id)
        .unwrap()
        .unwrap();
    assert_eq!(details_after.completed_tasks, 1);
    assert_eq!(details_after.project.progress_percent, 50.0);
}

#[test]
fn test_task_dependency_cycle_rejection() {
    let conn = setup_test_db();

    // Create 3 tasks
    let t1 = ProjectRepository::create_task(
        &conn,
        &CreateTaskInput {
            project_id: None,
            parent_task_id: None,
            milestone_id: None,
            title: "Task A".to_string(),
            description: None,
            phase: None,
            status: None,
            priority: None,
            start_date: None,
            due_date: None,
            estimated_hours: None,
            tags: None,
            dependency_task_ids: None,
            linked_paper_ids: None,
        },
    )
    .unwrap();

    let t2 = ProjectRepository::create_task(
        &conn,
        &CreateTaskInput {
            project_id: None,
            parent_task_id: None,
            milestone_id: None,
            title: "Task B".to_string(),
            description: None,
            phase: None,
            status: None,
            priority: None,
            start_date: None,
            due_date: None,
            estimated_hours: None,
            tags: None,
            dependency_task_ids: None,
            linked_paper_ids: None,
        },
    )
    .unwrap();

    let t3 = ProjectRepository::create_task(
        &conn,
        &CreateTaskInput {
            project_id: None,
            parent_task_id: None,
            milestone_id: None,
            title: "Task C".to_string(),
            description: None,
            phase: None,
            status: None,
            priority: None,
            start_date: None,
            due_date: None,
            estimated_hours: None,
            tags: None,
            dependency_task_ids: None,
            linked_paper_ids: None,
        },
    )
    .unwrap();

    // B depends on A (A -> B)
    ProjectRepository::add_dependency(&conn, &t2.id, &t1.id)
        .expect("B depends on A should succeed");

    // C depends on B (A -> B -> C)
    ProjectRepository::add_dependency(&conn, &t3.id, &t2.id)
        .expect("C depends on B should succeed");

    // Self dependency (A depends on A) must fail
    let self_dep_res = ProjectRepository::add_dependency(&conn, &t1.id, &t1.id);
    assert!(self_dep_res.is_err(), "Self dependency must be rejected");

    // Attempting to make A depend on C would create cycle: A -> B -> C -> A
    let cycle_res = ProjectRepository::add_dependency(&conn, &t1.id, &t3.id);
    assert!(
        cycle_res.is_err(),
        "Cycle A -> B -> C -> A must be rejected"
    );

    let err_msg = cycle_res.err().unwrap().to_string();
    assert!(err_msg.contains("Circular dependency detected"));
}

#[test]
fn test_project_and_task_paper_links() {
    let conn = setup_test_db();

    // Seed a paper
    conn.execute(
        "INSERT INTO papers (id, title, clean_title_key, created_at, updated_at) VALUES ('paper-101', 'Attention Is All You Need', 'attention is all you need', datetime('now'), datetime('now'))",
        [],
    ).unwrap();

    let project = ProjectRepository::create_project(
        &conn,
        &CreateProjectInput {
            title: "Transformer Architecture Survey".to_string(),
            description: None,
            objective: None,
            research_questions: None,
            hypotheses: None,
            expected_outcomes: None,
            primary_domain_id: None,
            subdomain_id: None,
            custom_domain_text: None,
            priority: None,
            start_date: None,
            target_deadline: None,
            template_type: None,
            tags: None,
            notes: None,
        },
    )
    .unwrap();

    let task = ProjectRepository::create_task(
        &conn,
        &CreateTaskInput {
            project_id: Some(project.id.clone()),
            parent_task_id: None,
            milestone_id: None,
            title: "Analyze Self-Attention Mechanism".to_string(),
            description: None,
            phase: None,
            status: None,
            priority: None,
            start_date: None,
            due_date: None,
            estimated_hours: None,
            tags: None,
            dependency_task_ids: None,
            linked_paper_ids: None,
        },
    )
    .unwrap();

    // Link paper to project
    let pp = ProjectRepository::link_paper_to_project(
        &conn,
        &project.id,
        "paper-101",
        Some("baseline"),
        Some("Foundational self-attention architecture"),
    )
    .expect("link_paper_to_project failed");
    assert_eq!(pp.paper_title, "Attention Is All You Need");
    assert_eq!(pp.relationship_type, "baseline");

    // Link paper to task
    let tp = ProjectRepository::link_paper_to_task(
        &conn,
        &task.id,
        "paper-101",
        Some("Review Section 3 for multi-head attention formulation"),
    )
    .expect("link_paper_to_task failed");
    assert_eq!(tp.paper_title, "Attention Is All You Need");

    let project_papers = ProjectRepository::list_project_papers(&conn, &project.id).unwrap();
    assert_eq!(project_papers.len(), 1);

    let task_papers = ProjectRepository::list_task_papers(&conn, &task.id).unwrap();
    assert_eq!(task_papers.len(), 1);

    // Unlink
    ProjectRepository::unlink_paper_from_project(&conn, &project.id, "paper-101").unwrap();
    let after_unlink = ProjectRepository::list_project_papers(&conn, &project.id).unwrap();
    assert_eq!(after_unlink.len(), 0);
}
