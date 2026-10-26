use rusqlite::{Connection, Result};
use tracing::info;

pub const CURRENT_SCHEMA_VERSION: i32 = 9;

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
        assert_eq!(version, 9);

        // Verify key tables exist including AI, Integrity, and Matrix tables
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                    'papers', 'authors', 'sources', 'collections', 'tags', 'notes', 'app_settings',
                    'crawl_profiles', 'crawl_jobs', 'crawl_queue', 'crawl_job_papers',
                    'paper_identifiers', 'paper_files', 'duplicate_candidates', 'paper_merge_history',
                    'processing_jobs', 'processing_job_items',
                    'download_jobs', 'pdf_candidates', 'reader_state',
                    'ai_providers', 'ai_provider_task_routes', 'ai_paper_chunks',
                    'ai_chat_sessions', 'ai_chat_messages', 'ai_recommendations',
                    'ai_evaluation_results', 'ai_finetuning_jobs', 'ai_settings',
                    'integrity_documents', 'document_segments', 'corpus_sources', 'corpus_fingerprints',
                    'similarity_runs', 'similarity_matches', 'ai_signal_runs', 'ai_signal_segments',
                    'writing_sessions', 'writing_revisions', 'model_registry',
                    'matrix_workspaces', 'matrix_workspace_papers', 'matrix_extractions',
                    'evidence_copilot_sessions', 'evidence_copilot_messages'
                )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 45);

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
            .query_row("SELECT COUNT(*) FROM matrix_workspaces", [], |row| row.get(0))
            .unwrap();
        assert_eq!(matrix_count, 1);

        // Idempotency check: running again must succeed without error
        run_migrations(&mut conn).expect("second run_migrations must be idempotent");
        assert_eq!(get_schema_version(&conn).unwrap(), 9);
    }
}
