use rusqlite::Connection;
use serde_json::Value;
use std::sync::Arc;
use tracing::info;

use crate::database::Database;
use crate::domain::ai::GenerateRequestInput;
use crate::domain::projects::*;
use crate::errors::AppError;
use crate::repositories::project_repo::ProjectRepository;
use crate::services::ai_provider_service::AiProviderService;

pub struct ProjectService;

impl ProjectService {
    // -------------------------------------------------------------------------
    // AI Project Planning & Roadmap Generation
    // -------------------------------------------------------------------------

    pub async fn generate_ai_project_plan(
        db: &Database,
        ai_service: &Arc<AiProviderService>,
        project_id: &str,
    ) -> Result<AiProjectPlanProposal, AppError> {
        let (project, domain_name) = {
            let conn = db.lock()?;
            let proj = ProjectRepository::get_project(&conn, project_id)?.ok_or_else(|| {
                AppError::Validation(format!("Project '{}' not found", project_id))
            })?;

            let domain_name: Option<String> = if let Some(ref did) = proj.primary_domain_id {
                conn.query_row(
                    "SELECT name FROM research_domains WHERE id = ?1",
                    rusqlite::params![did],
                    |r| r.get::<_, String>(0),
                )
                .ok()
            } else {
                None
            };
            (proj, domain_name)
        };

        let objective = project.objective.unwrap_or_else(|| project.title.clone());
        let research_questions = project
            .research_questions
            .unwrap_or_else(|| "None specified".to_string());
        let hypotheses = project
            .hypotheses
            .unwrap_or_else(|| "None specified".to_string());
        let domain_str = domain_name.unwrap_or_else(|| {
            project
                .custom_domain_text
                .unwrap_or_else(|| "Interdisciplinary".to_string())
        });

        let prompt = format!(
            "Generate a rigorous, multi-phase academic research project roadmap for the following scientific initiative:\n\n\
             Project Title: \"{}\"\n\
             Research Domain: {}\n\
             Primary Objective: {}\n\
             Research Questions: {}\n\
             Hypotheses: {}\n\n\
             You must return a strictly valid JSON object matching this exact schema:\n\
             {{\n\
               \"project_title\": \"{}\",\n\
               \"objective_summary\": \"High-level synthesis of core research contribution\",\n\
               \"methodology_strategy\": \"Empirical or analytical approach chosen\",\n\
               \"estimated_total_weeks\": 16,\n\
               \"milestones\": [\n\
                 {{\n\
                   \"title\": \"Milestone 1: Literature Review & Problem Formulation\",\n\
                   \"description\": \"Comprehensive survey of existing work and baseline identification\",\n\
                   \"suggested_days_from_start\": 21,\n\
                   \"tasks\": [\n\
                     {{\n\
                       \"title\": \"Systematic search across OpenAlex, arXiv, and Crossref\",\n\
                       \"description\": \"Retrieve 30+ candidate papers using domain keywords\",\n\
                       \"phase\": \"literature_review\",\n\
                       \"priority\": \"high\",\n\
                       \"estimated_hours\": 15.0,\n\
                       \"suggested_days_from_start\": 7,\n\
                       \"prerequisite_indexes\": [],\n\
                       \"deliverable\": \"Initial corpus bibliography\"\n\
                     }},\n\
                     {{\n\
                       \"title\": \"Extract methodologies into Literature Review Matrix\",\n\
                       \"description\": \"Compare baseline architectures and dataset sizes\",\n\
                       \"phase\": \"literature_review\",\n\
                       \"priority\": \"high\",\n\
                       \"estimated_hours\": 20.0,\n\
                       \"suggested_days_from_start\": 18,\n\
                       \"prerequisite_indexes\": [0],\n\
                       \"deliverable\": \"Populated matrix with evidence citations\"\n\
                     }}\n\
                   ]\n\
                 }}\n\
               ],\n\
               \"recommended_paper_search_queries\": [\"query 1\", \"query 2\", \"query 3\"]\n\
             }}\n\n\
             Phases should include: 'planning', 'literature_review', 'methodology', 'experimentation', 'writing', 'review'.\n\
             Priorities must be one of: 'low', 'medium', 'high', 'critical'.\n\
             Ensure every task has realistic estimated hours and prerequisite relationships.\n\
             Output pure JSON only, no explanatory markdown or preamble.",
            project.title, domain_str, objective, research_questions, hypotheses, project.title
        );

        let input = GenerateRequestInput {
            prompt,
            system_instruction: Some(
                "You are a premier principal investigator and academic research project architect. Respond with valid JSON only conforming to the exact schema.".to_string(),
            ),
            paper_id: None,
            task_type: Some("deep_analysis".to_string()),
            audience_level: Some("researcher".to_string()),
            reading_mode: None,
            rag_scope: Some("none".to_string()),
            provider_override: None,
            model_override: None,
            ui_context: None,
        };

        let response = ai_service.generate(db, &input, None).await?;
        let parsed_plan = Self::parse_ai_plan_json(&response.text, &project.title, &objective)?;

        Ok(parsed_plan)
    }

    fn parse_ai_plan_json(
        text: &str,
        project_title: &str,
        objective: &str,
    ) -> Result<AiProjectPlanProposal, AppError> {
        let clean_json = if let Some(start) = text.find('{') {
            if let Some(end) = text.rfind('}') {
                &text[start..=end]
            } else {
                text
            }
        } else {
            text
        };

        let val: Value = match serde_json::from_str(clean_json) {
            Ok(v) => v,
            Err(e) => {
                info!(
                    "Failed to parse JSON plan directly: {}. Falling back to default scaffold.",
                    e
                );
                return Ok(Self::create_default_plan_scaffold(project_title, objective));
            }
        };

        let mut milestones = Vec::new();
        if let Some(ms_arr) = val.get("milestones").and_then(|v| v.as_array()) {
            for ms in ms_arr {
                let ms_title = ms
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Research Phase")
                    .to_string();
                let ms_desc = ms
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let ms_days = ms
                    .get("suggested_days_from_start")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(30);

                let mut tasks = Vec::new();
                if let Some(t_arr) = ms.get("tasks").and_then(|v| v.as_array()) {
                    for t in t_arr {
                        let t_title = t
                            .get("title")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Research Task")
                            .to_string();
                        let t_desc = t
                            .get("description")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let t_phase = t
                            .get("phase")
                            .and_then(|v| v.as_str())
                            .unwrap_or("planning")
                            .to_string();
                        let t_priority = t
                            .get("priority")
                            .and_then(|v| v.as_str())
                            .unwrap_or("medium")
                            .to_string();
                        let t_hours = t
                            .get("estimated_hours")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(10.0);
                        let t_days = t
                            .get("suggested_days_from_start")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(14);
                        let t_deliverable = t
                            .get("deliverable")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        let mut prereqs = Vec::new();
                        if let Some(p_arr) =
                            t.get("prerequisite_indexes").and_then(|v| v.as_array())
                        {
                            for p in p_arr {
                                if let Some(idx) = p.as_u64() {
                                    prereqs.push(idx as usize);
                                }
                            }
                        }

                        tasks.push(ProposedTask {
                            title: t_title,
                            description: t_desc,
                            phase: t_phase,
                            priority: t_priority,
                            estimated_hours: t_hours,
                            suggested_days_from_start: t_days,
                            prerequisite_indexes: prereqs,
                            deliverable: t_deliverable,
                        });
                    }
                }

                milestones.push(ProposedMilestone {
                    title: ms_title,
                    description: ms_desc,
                    suggested_days_from_start: ms_days,
                    tasks,
                });
            }
        }

        if milestones.is_empty() {
            return Ok(Self::create_default_plan_scaffold(project_title, objective));
        }

        let mut queries = Vec::new();
        if let Some(q_arr) = val
            .get("recommended_paper_search_queries")
            .and_then(|v| v.as_array())
        {
            for q in q_arr {
                if let Some(qs) = q.as_str() {
                    queries.push(qs.to_string());
                }
            }
        }

        Ok(AiProjectPlanProposal {
            project_title: val
                .get("project_title")
                .and_then(|v| v.as_str())
                .unwrap_or(project_title)
                .to_string(),
            objective_summary: val
                .get("objective_summary")
                .and_then(|v| v.as_str())
                .unwrap_or(objective)
                .to_string(),
            methodology_strategy: val
                .get("methodology_strategy")
                .and_then(|v| v.as_str())
                .unwrap_or("Iterative scientific evaluation")
                .to_string(),
            estimated_total_weeks: val
                .get("estimated_total_weeks")
                .and_then(|v| v.as_i64())
                .unwrap_or(16),
            milestones,
            recommended_paper_search_queries: queries,
        })
    }

    fn create_default_plan_scaffold(title: &str, objective: &str) -> AiProjectPlanProposal {
        AiProjectPlanProposal {
            project_title: title.to_string(),
            objective_summary: objective.to_string(),
            methodology_strategy: "Comprehensive literature review, rigorous empirical validation, and scholarly peer dissemination".to_string(),
            estimated_total_weeks: 16,
            milestones: vec![
                ProposedMilestone {
                    title: "Milestone 1: Literature Survey & Baseline Identification".to_string(),
                    description: "Establish foundational state of the art and map existing benchmark architectures".to_string(),
                    suggested_days_from_start: 21,
                    tasks: vec![
                        ProposedTask {
                            title: "Search & ingest foundational papers across OpenAlex and arXiv".to_string(),
                            description: "Assemble relevant corpus covering theoretical foundations and recent advancements.".to_string(),
                            phase: "literature_review".to_string(),
                            priority: "high".to_string(),
                            estimated_hours: 12.0,
                            suggested_days_from_start: 7,
                            prerequisite_indexes: vec![],
                            deliverable: Some("Curated reading library".to_string()),
                        },
                        ProposedTask {
                            title: "Synthesize findings in Literature Review Matrix".to_string(),
                            description: "Extract sample sizes, models, datasets, metrics, and limitations side-by-side.".to_string(),
                            phase: "literature_review".to_string(),
                            priority: "high".to_string(),
                            estimated_hours: 18.0,
                            suggested_days_from_start: 18,
                            prerequisite_indexes: vec![0],
                            deliverable: Some("Matrix comparative analysis".to_string()),
                        },
                    ],
                },
                ProposedMilestone {
                    title: "Milestone 2: Methodology Design & Experimental Protocol".to_string(),
                    description: "Formulate technical architecture, data pipeline, and evaluation metrics".to_string(),
                    suggested_days_from_start: 45,
                    tasks: vec![
                        ProposedTask {
                            title: "Design architectural formulation and validation protocols".to_string(),
                            description: "Specify mathematical equations, loss functions, or experimental variables.".to_string(),
                            phase: "methodology".to_string(),
                            priority: "critical".to_string(),
                            estimated_hours: 24.0,
                            suggested_days_from_start: 35,
                            prerequisite_indexes: vec![],
                            deliverable: Some("Methodology formal specification".to_string()),
                        },
                        ProposedTask {
                            title: "Execute baseline experiments and quantitative benchmarking".to_string(),
                            description: "Run benchmark evaluations and record reproducible performance metrics.".to_string(),
                            phase: "experimentation".to_string(),
                            priority: "high".to_string(),
                            estimated_hours: 32.0,
                            suggested_days_from_start: 45,
                            prerequisite_indexes: vec![0],
                            deliverable: Some("Experimental results dataset".to_string()),
                        },
                    ],
                },
                ProposedMilestone {
                    title: "Milestone 3: Scholarly Manuscript Preparation & Dissemination".to_string(),
                    description: "Draft manuscript with verified evidence citations and peer review revisions".to_string(),
                    suggested_days_from_start: 90,
                    tasks: vec![
                        ProposedTask {
                            title: "Draft manuscript sections with traceable literature citations".to_string(),
                            description: "Write Introduction, Related Work, Method, Results, and Limitations with direct citations.".to_string(),
                            phase: "writing".to_string(),
                            priority: "critical".to_string(),
                            estimated_hours: 40.0,
                            suggested_days_from_start: 75,
                            prerequisite_indexes: vec![],
                            deliverable: Some("Complete manuscript draft".to_string()),
                        },
                        ProposedTask {
                            title: "Run Research Integrity and Readability Audits".to_string(),
                            description: "Verify citation integrity, check style guidelines, and audit reference accuracy.".to_string(),
                            phase: "review".to_string(),
                            priority: "medium".to_string(),
                            estimated_hours: 10.0,
                            suggested_days_from_start: 85,
                            prerequisite_indexes: vec![0],
                            deliverable: Some("Verified submission-ready paper".to_string()),
                        },
                    ],
                },
            ],
            recommended_paper_search_queries: vec![
                format!("{} survey review", title),
                format!("{} state of the art benchmarks", title),
                format!("{} empirical evaluation", title),
            ],
        }
    }

    // -------------------------------------------------------------------------
    // Apply Approved Plan
    // -------------------------------------------------------------------------

    pub fn apply_ai_project_plan(
        conn: &Connection,
        input: &ApplyPlanInput,
    ) -> Result<usize, AppError> {
        let mut created_task_count = 0;
        let today = chrono::Local::now().date_naive();

        for (m_idx, ms) in input.milestones.iter().enumerate() {
            let due_date = today + chrono::Duration::days(ms.suggested_days_from_start);
            let ms_input = CreateMilestoneInput {
                project_id: input.project_id.clone(),
                title: ms.title.clone(),
                description: Some(ms.description.clone()),
                due_date: Some(due_date.format("%Y-%m-%d").to_string()),
                sort_order: Some(m_idx as i64),
            };

            let created_ms = ProjectRepository::create_milestone(conn, &ms_input)?;
            let mut created_task_ids = Vec::new();

            for t in &ms.tasks {
                let task_due = today + chrono::Duration::days(t.suggested_days_from_start);
                let task_input = CreateTaskInput {
                    project_id: Some(input.project_id.clone()),
                    parent_task_id: None,
                    milestone_id: Some(created_ms.id.clone()),
                    title: t.title.clone(),
                    description: Some(format!(
                        "{}\nDeliverable: {}",
                        t.description,
                        t.deliverable.as_deref().unwrap_or("None")
                    )),
                    phase: Some(t.phase.clone()),
                    status: Some("todo".to_string()),
                    priority: Some(t.priority.clone()),
                    start_date: Some(today.format("%Y-%m-%d").to_string()),
                    due_date: Some(task_due.format("%Y-%m-%d").to_string()),
                    estimated_hours: Some(t.estimated_hours),
                    tags: Some(vec![t.phase.clone()]),
                    dependency_task_ids: None,
                    linked_paper_ids: None,
                };

                let created_task = ProjectRepository::create_task(conn, &task_input)?;
                created_task_ids.push(created_task.id.clone());
                created_task_count += 1;
            }

            // Wire up internal dependencies from prerequisite_indexes
            for (t_idx, t) in ms.tasks.iter().enumerate() {
                if t_idx < created_task_ids.len() {
                    let task_id = &created_task_ids[t_idx];
                    for &prereq_idx in &t.prerequisite_indexes {
                        if prereq_idx < created_task_ids.len() && prereq_idx != t_idx {
                            let prereq_id = &created_task_ids[prereq_idx];
                            let _ = ProjectRepository::add_dependency(conn, task_id, prereq_id);
                        }
                    }
                }
            }
        }

        ProjectRepository::recalculate_project_progress(conn, &input.project_id)?;
        ProjectRepository::log_activity(
            conn,
            &input.project_id,
            "plan_generated",
            "Applied AI Research Roadmap",
            Some(&format!(
                "Created {} milestones and {} tasks",
                input.milestones.len(),
                created_task_count
            )),
        )?;

        Ok(created_task_count)
    }

    // -------------------------------------------------------------------------
    // Project-Grounded AI Research Assistant
    // -------------------------------------------------------------------------

    pub async fn ask_project_ai_assistant(
        db: &Database,
        ai_service: &Arc<AiProviderService>,
        project_id: &str,
        query: &str,
    ) -> Result<String, AppError> {
        let (project_context_text, domain_name) = {
            let conn = db.lock()?;
            let proj = ProjectRepository::get_project(&conn, project_id)?.ok_or_else(|| {
                AppError::Validation(format!("Project '{}' not found", project_id))
            })?;

            let domain_name: Option<String> = if let Some(ref did) = proj.primary_domain_id {
                conn.query_row(
                    "SELECT name FROM research_domains WHERE id = ?1",
                    rusqlite::params![did],
                    |r| r.get::<_, String>(0),
                )
                .ok()
            } else {
                None
            };

            let tasks = ProjectRepository::list_tasks(&conn, Some(project_id), None, None, None)?;
            let milestones = ProjectRepository::list_milestones(&conn, project_id)?;
            let papers = ProjectRepository::list_project_papers(&conn, project_id)?;

            let mut ctx = format!(
                "RESEARCH PROJECT CONTEXT:\n\
                 Title: \"{}\"\n\
                 Domain: {}\n\
                 Status: {} (Progress: {:.0}%)\n\
                 Objective: {}\n\
                 Research Questions: {}\n\
                 Hypotheses: {}\n\
                 Target Deadline: {}\n\n",
                proj.title,
                domain_name.as_deref().unwrap_or("Interdisciplinary"),
                proj.status,
                proj.progress_percent,
                proj.objective.as_deref().unwrap_or("Not set"),
                proj.research_questions.as_deref().unwrap_or("None"),
                proj.hypotheses.as_deref().unwrap_or("None"),
                proj.target_deadline.as_deref().unwrap_or("Unscheduled")
            );

            ctx.push_str("MILESTONES:\n");
            for m in &milestones {
                ctx.push_str(&format!(
                    "- [{}] {} (Due: {}, Completed: {})\n",
                    if m.is_completed { "DONE" } else { "OPEN" },
                    m.title,
                    m.due_date.as_deref().unwrap_or("None"),
                    m.is_completed
                ));
            }

            ctx.push_str("\nKEY TASKS:\n");
            for t in tasks.iter().take(15) {
                ctx.push_str(&format!(
                    "- [{}] {} (Status: {}, Priority: {}, Phase: {}, Blocked: {})\n",
                    t.task.priority,
                    t.task.title,
                    t.task.status,
                    t.task.priority,
                    t.task.phase,
                    t.is_blocked
                ));
            }

            ctx.push_str("\nLINKED PAPERS:\n");
            for p in &papers {
                ctx.push_str(&format!(
                    "- \"{}\" ({}, {}) | Relationship: {}\n",
                    p.paper_title,
                    p.publication_year
                        .map(|y| y.to_string())
                        .unwrap_or_else(|| "n.d.".into()),
                    p.venue.as_deref().unwrap_or("Scholarly Venue"),
                    p.relationship_type
                ));
            }

            (ctx, domain_name)
        };

        let system_instruction = format!(
            "You are an elite scientific advisor and project copilot embedded in Infinity Researcher.\n\
             Domain focus: {}.\n\
             Ground your advice strictly in the provided project context, tasks, and research questions.\n\
             Provide clear, actionable, structured steps.",
            domain_name.as_deref().unwrap_or("Interdisciplinary Science")
        );

        let prompt = format!(
            "{}\n\nUSER QUESTION / ACTION REQUEST:\n{}\n\nProvide a structured, helpful answer grounded in this project's real state.",
            project_context_text, query
        );

        let input = GenerateRequestInput {
            prompt,
            system_instruction: Some(system_instruction),
            paper_id: None,
            task_type: Some("deep_analysis".to_string()),
            audience_level: Some("researcher".to_string()),
            reading_mode: None,
            rag_scope: Some("none".to_string()),
            provider_override: None,
            model_override: None,
            ui_context: None,
        };

        let response = ai_service.generate(db, &input, None).await?;
        Ok(response.text)
    }
}
