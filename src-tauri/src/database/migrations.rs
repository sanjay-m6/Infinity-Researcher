use rusqlite::{Connection, Result};
use tracing::info;

pub const CURRENT_SCHEMA_VERSION: i32 = 18;

const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial_schema.sql");
const MIGRATION_0002: &str = include_str!("../../migrations/0002_website_scraping_engine.sql");
const MIGRATION_0003: &str = include_str!("../../migrations/0003_processing_and_deduplication.sql");
const MIGRATION_0004: &str =
    include_str!("../../migrations/0004_research_workflows_and_exports.sql");
const MIGRATION_0005: &str = include_str!("../../migrations/0005_unified_pdf_workspace.sql");
const MIGRATION_0006: &str = include_str!("../../migrations/0006_ieee_open_access_workflow.sql");
const MIGRATION_0007: &str = include_str!("../../migrations/0007_ai_workspace_and_knowledge.sql");
const MIGRATION_0008: &str =
    include_str!("../../migrations/0008_research_integrity_and_writing.sql");
const MIGRATION_0009: &str =
    include_str!("../../migrations/0009_literature_review_matrix_and_copilot.sql");
const MIGRATION_0010: &str =
    include_str!("../../migrations/0010_imare_retrieval_state.sql");
const MIGRATION_0011: &str =
    include_str!("../../migrations/0011_ai_tools_and_integrity_persistence.sql");
const MIGRATION_0012: &str =
    include_str!("../../migrations/0012_local_auth_system.sql");
const MIGRATION_0013: &str =
    include_str!("../../migrations/0013_research_library_and_knowledge.sql");
const MIGRATION_0014: &str =
    include_str!("../../migrations/0014_download_manager_modernization.sql");
const MIGRATION_0015: &str =
    include_str!("../../migrations/0015_multi_source_retrieval_and_verification.sql");
const MIGRATION_0016: &str =
    include_str!("../../migrations/0016_research_projects_and_tasks.sql");
const MIGRATION_0017: &str =
    include_str!("../../migrations/0017_in_app_ai_engine_default.sql");
const MIGRATION_0018: &str =
    include_str!("../../migrations/0018_ensure_nvidia_nim_and_provider_health.sql");


pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    // Ensure migrations tracking table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )?;

    let applied_version: Option<i32> = conn
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .unwrap_or(None);

    let current = applied_version.unwrap_or(0);
    info!(
        current_version = current,
        target_version = CURRENT_SCHEMA_VERSION,
        "Checking database schema migrations"
    );

    if current < 1 {
        info!("Applying migration 0001: initial schema");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0001)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (1, "0001_initial_schema"),
        )?;
        tx.commit()?;
        info!("Migration 0001 applied successfully");
    }

    if current < 2 {
        info!("Applying migration 0002: website scraping engine");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0002)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (2, "0002_website_scraping_engine"),
        )?;
        tx.commit()?;
        info!("Migration 0002 applied successfully");
    }

    if current < 3 {
        info!("Applying migration 0003: paper processing and deduplication");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0003)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (3, "0003_processing_and_deduplication"),
        )?;
        tx.commit()?;
        info!("Migration 0003 applied successfully");
    }

    if current < 4 {
        info!("Applying migration 0004: research workflows, notes, and citation exports");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0004)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (4, "0004_research_workflows_and_exports"),
        )?;
        tx.commit()?;
        info!("Migration 0004 applied successfully");
    }

    if current < 5 {
        info!("Applying migration 0005: unified PDF workspace, download jobs, candidates, and reader state");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0005)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (5, "0005_unified_pdf_workspace"),
        )?;
        tx.commit()?;
        info!("Migration 0005 applied successfully");
    }

    if current < 6 {
        info!("Applying migration 0006: IEEE Open Access manual import and strict OA workflow");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0006)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (6, "0006_ieee_open_access_workflow"),
        )?;
        tx.commit()?;
        info!("Migration 0006 applied successfully");
    }

    if current < 7 {
        info!("Applying migration 0007: AI Workspace, Provider Registry, Section Chunks, Shared RAG, Recommendations, and Evaluations");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0007)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (7, "0007_ai_workspace_and_knowledge"),
        )?;
        tx.commit()?;
        info!("Migration 0007 applied successfully");
    }

    if current < 8 {
        info!("Applying migration 0008: Research Integrity, Document Ingestion, Corpus Fingerprints, Similarity Engine, AI-Writing Signals, and Writing Revisions");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0008)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (8, "0008_research_integrity_and_writing"),
        )?;
        tx.commit()?;
        info!("Migration 0008 applied successfully");
    }

    if current < 9 {
        info!("Applying migration 0009: Literature Review Matrix & Evidence-Linked Copilot");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0009)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (9, "0009_literature_review_matrix_and_copilot"),
        )?;
        tx.commit()?;
        info!("Migration 0009 applied successfully");
    }

    if current < 10 {
        info!("Applying migration 0010: IMARE Multi-Stage Academic Retrieval Engine State Persistence & Cache");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0010)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (10, "0010_imare_retrieval_state"),
        )?;
        tx.commit()?;
        info!("Migration 0010 applied successfully");
    }

    if current < 11 {
        info!("Applying migration 0011: AI Tools, Citation Audits & Integrity Persistence");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0011)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (11, "0011_ai_tools_and_integrity_persistence"),
        )?;
        tx.commit()?;
        info!("Migration 0011 applied successfully");
    }

    if current < 12 {
        info!("Applying migration 0012: local authentication system and user data protection");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0012)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (12, "0012_local_auth_system"),
        )?;
        tx.commit()?;
        info!("Migration 0012 applied successfully");
    }

    if current < 13 {
        info!("Applying migration 0013: research library, saved searches and knowledge management");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0013)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (13, "0013_research_library_and_knowledge"),
        )?;
        tx.commit()?;
        info!("Migration 0013 applied successfully");
    }

    if current < 14 {
        info!("Applying migration 0014: download manager modernization");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0014)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (14, "0014_download_manager_modernization"),
        )?;
        tx.commit()?;
        info!("Migration 0014 applied successfully");
    }

    if current < 15 {
        info!("Applying migration 0015: multi source retrieval and verification");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0015)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (15, "0015_multi_source_retrieval_and_verification"),
        )?;
        tx.commit()?;
        info!("Migration 0015 applied successfully");
    }

    if current < 16 {
        info!("Applying migration 0016: research projects and tasks");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0016)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (16, "0016_research_projects_and_tasks"),
        )?;
        tx.commit()?;
        info!("Migration 0016 applied successfully");
    }

    if current < 17 {
        info!("Applying migration 0017: in-app local AI engine as system default");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0017)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (17, "0017_in_app_ai_engine_default"),
        )?;
        tx.commit()?;
        info!("Migration 0017 applied successfully");
    }

    if current < 18 {
        info!("Applying migration 0018: Ensure NVIDIA NIM is enabled and provider health guarded");
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_0018)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
            (18, "0018_ensure_nvidia_nim_and_provider_health"),
        )?;
        tx.commit()?;
        info!("Migration 0018 applied successfully");
    }

    Ok(())
}

pub fn get_schema_version(conn: &Connection) -> Result<i32> {
    let version: Option<i32> = conn
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .unwrap_or(None);

    Ok(version.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_run_successfully_on_clean_db() {
        let mut conn = Connection::open_in_memory().expect("in-memory db open failed");
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        run_migrations(&mut conn).expect("run_migrations failed");

        let version = get_schema_version(&conn).expect("get_schema_version failed");
        assert_eq!(version, 18);

        // Verify key tables exist including AI, Integrity, Matrix, Retrieval State, Auth, Saved Searches, and Projects/Tasks
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                    'papers', 'authors', 'sources', 'collections', 'tags', 'notes', 'app_settings',
                    'crawl_profiles', 'crawl_jobs', 'crawl_queue', 'crawl_job_papers',
                    'paper_identifiers', 'paper_files', 'duplicate_candidates', 'paper_merge_history',
                    'processing_jobs', 'processing_job_items',
                    'download_jobs', 'pdf_candidates', 'reader_state', 'retrieval_state',
                    'ai_providers', 'ai_provider_task_routes', 'ai_paper_chunks',
                    'ai_chat_sessions', 'ai_chat_messages', 'ai_recommendations',
                    'ai_evaluation_results', 'ai_finetuning_jobs', 'ai_settings',
                    'integrity_documents', 'document_segments', 'corpus_sources', 'corpus_fingerprints',
                    'similarity_runs', 'similarity_matches', 'ai_signal_runs', 'ai_signal_segments',
                    'writing_sessions', 'writing_revisions', 'model_registry',
                    'matrix_workspaces', 'matrix_workspace_papers', 'matrix_extractions',
                    'evidence_copilot_sessions', 'evidence_copilot_messages',
                    'saved_integrity_reports', 'integrity_report_findings', 'citation_audits',
                    'readability_reports', 'analysis_jobs', 'doi_cache',
                    'users', 'user_preferences', 'saved_searches',
                    'research_domains', 'research_projects', 'project_milestones', 'project_tasks',
                    'task_dependencies', 'project_papers', 'task_papers', 'task_reminders', 'project_activity'
                )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 64);

        // Verify doc_text_fts and ai_chunks_fts virtual tables exist
        let fts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('doc_text_fts', 'ai_chunks_fts')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(fts_count, 2);

        // Verify seeded sources (from migration 1)
        let source_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sources", [], |row| row.get(0))
            .unwrap();
        assert_eq!(source_count, 8);

        // Verify seeded crawl profiles (from migration 2)
        let profile_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM crawl_profiles", [], |row| row.get(0))
            .unwrap();
        assert_eq!(profile_count, 5);

        // Verify seeded ai settings (from migration 7)
        let ai_setting_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ai_settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(ai_setting_count, 6);

        // Verify seeded models (from migration 8)
        let model_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM model_registry", [], |row| row.get(0))
            .unwrap();
        assert_eq!(model_count, 3);

        // Verify seeded default matrix workspace (from migration 9)
        let matrix_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM matrix_workspaces", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(matrix_count, 1);

        // Idempotency check: running again must succeed without error
        run_migrations(&mut conn).expect("second run_migrations must be idempotent");
        assert_eq!(get_schema_version(&conn).unwrap(), 18);
    }
}
