use tauri::State;

use crate::domain::projects::*;
use crate::errors::CommandError;
use crate::repositories::ProjectRepository;
use crate::services::ProjectService;
use crate::state::AppState;

// -----------------------------------------------------------------------------
// Domains
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_research_domains(
    state: State<'_, AppState>,
) -> Result<Vec<ResearchDomain>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_domains(&conn).map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_custom_research_domain(
    state: State<'_, AppState>,
    input: CreateDomainInput,
) -> Result<ResearchDomain, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::create_custom_domain(&conn, &input).map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// Projects CRUD
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn create_research_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<ResearchProject, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::create_project(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn update_research_project(
    state: State<'_, AppState>,
    input: UpdateProjectInput,
) -> Result<ResearchProject, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::update_project(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_research_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Option<ProjectWithDetails>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::get_project_with_details(&conn, &project_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_research_projects(
    state: State<'_, AppState>,
    status: Option<String>,
    domain_id: Option<String>,
    search: Option<String>,
) -> Result<Vec<ProjectWithDetails>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_projects(
        &conn,
        status.as_deref(),
        domain_id.as_deref(),
        search.as_deref(),
    )
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn archive_research_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::archive_project(&conn, &project_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_research_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::delete_project(&conn, &project_id).map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// Milestones
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn create_project_milestone(
    state: State<'_, AppState>,
    input: CreateMilestoneInput,
) -> Result<ProjectMilestone, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::create_milestone(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn update_project_milestone(
    state: State<'_, AppState>,
    input: UpdateMilestoneInput,
) -> Result<ProjectMilestone, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::update_milestone(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_project_milestone(
    state: State<'_, AppState>,
    milestone_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::delete_milestone(&conn, &milestone_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_project_milestones(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<ProjectMilestone>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_milestones(&conn, &project_id).map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// Tasks & Dependencies
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn create_project_task(
    state: State<'_, AppState>,
    input: CreateTaskInput,
) -> Result<ProjectTask, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::create_task(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn update_project_task(
    state: State<'_, AppState>,
    input: UpdateTaskInput,
) -> Result<ProjectTask, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::update_task(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn update_project_task_status(
    state: State<'_, AppState>,
    task_id: String,
    status: String,
) -> Result<ProjectTask, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::update_task_status(&conn, &task_id, &status).map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_project_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::delete_task(&conn, &task_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_project_tasks(
    state: State<'_, AppState>,
    project_id: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    search: Option<String>,
) -> Result<Vec<TaskWithDetails>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_tasks(
        &conn,
        project_id.as_deref(),
        status.as_deref(),
        priority.as_deref(),
        search.as_deref(),
    )
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn add_task_dependency(
    state: State<'_, AppState>,
    task_id: String,
    depends_on_task_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::add_dependency(&conn, &task_id, &depends_on_task_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn remove_task_dependency(
    state: State<'_, AppState>,
    task_id: String,
    depends_on_task_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::remove_dependency(&conn, &task_id, &depends_on_task_id)
        .map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// Project & Task Papers Linking
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn link_paper_to_project(
    state: State<'_, AppState>,
    project_id: String,
    paper_id: String,
    relationship_type: Option<String>,
    notes: Option<String>,
) -> Result<ProjectPaper, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::link_paper_to_project(
        &conn,
        &project_id,
        &paper_id,
        relationship_type.as_deref(),
        notes.as_deref(),
    )
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn unlink_paper_from_project(
    state: State<'_, AppState>,
    project_id: String,
    paper_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::unlink_paper_from_project(&conn, &project_id, &paper_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_project_papers(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<ProjectPaper>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_project_papers(&conn, &project_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn link_paper_to_task(
    state: State<'_, AppState>,
    task_id: String,
    paper_id: String,
    notes: Option<String>,
) -> Result<TaskPaper, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::link_paper_to_task(&conn, &task_id, &paper_id, notes.as_deref())
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn unlink_paper_from_task(
    state: State<'_, AppState>,
    task_id: String,
    paper_id: String,
) -> Result<(), CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::unlink_paper_from_task(&conn, &task_id, &paper_id)
        .map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// Activity
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_project_activity(
    state: State<'_, AppState>,
    project_id: String,
    limit: Option<usize>,
) -> Result<Vec<ProjectActivityEvent>, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectRepository::list_project_activity(&conn, &project_id, limit).map_err(CommandError::from)
}

// -----------------------------------------------------------------------------
// AI Project Plan Generation & Grounded Assistant
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn generate_ai_project_plan(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<AiProjectPlanProposal, CommandError> {
    let db = state.db()?;
    ProjectService::generate_ai_project_plan(db, &state.ai_provider_service, &project_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn apply_ai_project_plan(
    state: State<'_, AppState>,
    input: ApplyPlanInput,
) -> Result<usize, CommandError> {
    let db = state.db()?;
    let conn = db.lock()?;
    ProjectService::apply_ai_project_plan(&conn, &input).map_err(CommandError::from)
}

#[tauri::command]
pub async fn ask_project_ai_assistant(
    state: State<'_, AppState>,
    project_id: String,
    question: String,
) -> Result<String, CommandError> {
    let db = state.db()?;
    ProjectService::ask_project_ai_assistant(
        db,
        &state.ai_provider_service,
        &project_id,
        &question,
    )
    .await
    .map_err(CommandError::from)
}

