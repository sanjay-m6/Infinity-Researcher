use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchDomain {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_custom: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDomainInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchProject {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub objective: Option<String>,
    pub research_questions: Option<String>,
    pub hypotheses: Option<String>,
    pub expected_outcomes: Option<String>,
    pub primary_domain_id: Option<String>,
    pub subdomain_id: Option<String>,
    pub custom_domain_text: Option<String>,
    pub status: String, // 'active', 'completed', 'archived', 'on_hold'
    pub priority: String, // 'low', 'medium', 'high', 'critical'
    pub progress_percent: f64,
    pub start_date: Option<String>,
    pub target_deadline: Option<String>,
    pub completed_at: Option<String>,
    pub tags_json: String,
    pub template_type: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectInput {
    pub title: String,
    pub description: Option<String>,
    pub objective: Option<String>,
    pub research_questions: Option<String>,
    pub hypotheses: Option<String>,
    pub expected_outcomes: Option<String>,
    pub primary_domain_id: Option<String>,
    pub subdomain_id: Option<String>,
    pub custom_domain_text: Option<String>,
    pub priority: Option<String>,
    pub start_date: Option<String>,
    pub target_deadline: Option<String>,
    pub template_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProjectInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub objective: Option<String>,
    pub research_questions: Option<String>,
    pub hypotheses: Option<String>,
    pub expected_outcomes: Option<String>,
    pub primary_domain_id: Option<String>,
    pub subdomain_id: Option<String>,
    pub custom_domain_text: Option<String>,
    pub status: String,
    pub priority: String,
    pub start_date: Option<String>,
    pub target_deadline: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMilestone {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub is_completed: bool,
    pub completed_at: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMilestoneInput {
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMilestoneInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub is_completed: bool,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTask {
    pub id: String,
    pub project_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub milestone_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub phase: String, // 'planning', 'literature_review', 'methodology', 'experimentation', 'writing', 'review'
    pub status: String, // 'backlog', 'todo', 'in_progress', 'blocked', 'completed', 'cancelled'
    pub priority: String, // 'low', 'medium', 'high', 'critical'
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub estimated_hours: Option<f64>,
    pub actual_hours: Option<f64>,
    pub tags_json: String,
    pub completion_notes: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub project_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub milestone_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub phase: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub estimated_hours: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub dependency_task_ids: Option<Vec<String>>,
    pub linked_paper_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub phase: String,
    pub status: String,
    pub priority: String,
    pub milestone_id: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub estimated_hours: Option<f64>,
    pub actual_hours: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub completion_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDependency {
    pub id: String,
    pub task_id: String,
    pub depends_on_task_id: String,
    pub dependency_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectPaper {
    pub id: String,
    pub project_id: String,
    pub paper_id: String,
    pub paper_title: String,
    pub paper_authors: Vec<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub relationship_type: String,
    pub notes: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPaper {
    pub id: String,
    pub task_id: String,
    pub paper_id: String,
    pub paper_title: String,
    pub notes: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskWithDetails {
    pub task: ProjectTask,
    pub project_title: Option<String>,
    pub milestone_title: Option<String>,
    pub dependencies: Vec<String>, // task_ids this task depends on
    pub dependency_titles: Vec<String>,
    pub is_blocked: bool,
    pub linked_papers: Vec<TaskPaper>,
    pub subtask_count: i64,
    pub completed_subtask_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWithDetails {
    pub project: ResearchProject,
    pub primary_domain_name: Option<String>,
    pub subdomain_name: Option<String>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub open_tasks: i64,
    pub overdue_tasks: i64,
    pub total_milestones: i64,
    pub completed_milestones: i64,
    pub linked_papers_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectActivityEvent {
    pub id: String,
    pub project_id: String,
    pub activity_type: String,
    pub title: String,
    pub details: Option<String>,
    pub created_at: String,
}

// -----------------------------------------------------------------------------
// AI Project Plan Proposals (Structured Plans generated by AI for user review)
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedTask {
    pub title: String,
    pub description: String,
    pub phase: String,
    pub priority: String,
    pub estimated_hours: f64,
    pub suggested_days_from_start: i64,
    pub prerequisite_indexes: Vec<usize>,
    pub deliverable: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedMilestone {
    pub title: String,
    pub description: String,
    pub suggested_days_from_start: i64,
    pub tasks: Vec<ProposedTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProjectPlanProposal {
    pub project_title: String,
    pub objective_summary: String,
    pub methodology_strategy: String,
    pub estimated_total_weeks: i64,
    pub milestones: Vec<ProposedMilestone>,
    pub recommended_paper_search_queries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyPlanInput {
    pub project_id: String,
    pub milestones: Vec<ProposedMilestone>,
}

