use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::collections::{HashSet, VecDeque};
use uuid::Uuid;

use crate::domain::projects::*;
use crate::errors::AppError;

pub struct ProjectRepository;

impl ProjectRepository {
    // -------------------------------------------------------------------------
    // Domains
    // -------------------------------------------------------------------------

    pub fn list_domains(conn: &Connection) -> Result<Vec<ResearchDomain>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, name, slug, description, icon, color, is_custom, created_at, updated_at
             FROM research_domains
             ORDER BY parent_id IS NOT NULL, name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ResearchDomain {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                slug: row.get(3)?,
                description: row.get(4)?,
                icon: row.get(5)?,
                color: row.get(6)?,
                is_custom: row.get::<_, i64>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn create_custom_domain(
        conn: &Connection,
        input: &CreateDomainInput,
    ) -> Result<ResearchDomain, AppError> {
        let id = format!(
            "dom_custom_{}",
            Uuid::new_v4().to_string().replace('-', "")[..10].to_string()
        );
        let slug = input
            .name
            .to_lowercase()
            .replace(' ', "-")
            .replace(|c: char| !c.is_alphanumeric() && c != '-', "");
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO research_domains (id, parent_id, name, slug, description, icon, color, is_custom, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)",
            params![
                id,
                input.parent_id,
                input.name,
                slug,
                input.description,
                input.icon.as_deref().unwrap_or("Folder"),
                input.color.as_deref().unwrap_or("#6366f1"),
                now,
            ],
        )?;

        Ok(ResearchDomain {
            id,
            parent_id: input.parent_id.clone(),
            name: input.name.clone(),
            slug,
            description: input.description.clone(),
            icon: input.icon.clone().or_else(|| Some("Folder".to_string())),
            color: input.color.clone().or_else(|| Some("#6366f1".to_string())),
            is_custom: true,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    // -------------------------------------------------------------------------
    // Projects CRUD
    // -------------------------------------------------------------------------

    pub fn create_project(
        conn: &Connection,
        input: &CreateProjectInput,
    ) -> Result<ResearchProject, AppError> {
        let id = format!("proj_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let tags_json = input
            .tags
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| "[]".into());

        conn.execute(
            "INSERT INTO research_projects (
                id, title, description, objective, research_questions, hypotheses, expected_outcomes,
                primary_domain_id, subdomain_id, custom_domain_text, status, priority, progress_percent,
                start_date, target_deadline, completed_at, tags_json, template_type, notes,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'active', ?11, 0.0, ?12, ?13, NULL, ?14, ?15, ?16, ?17, ?17)",
            params![
                id,
                input.title,
                input.description,
                input.objective,
                input.research_questions,
                input.hypotheses,
                input.expected_outcomes,
                input.primary_domain_id,
                input.subdomain_id,
                input.custom_domain_text,
                input.priority.as_deref().unwrap_or("medium"),
                input.start_date,
                input.target_deadline,
                tags_json,
                input.template_type,
                input.notes,
                now,
            ],
        )?;

        Self::log_activity(
            conn,
            &id,
            "project_created",
            "Research project initialized",
            Some(&format!("Project \"{}\" created", input.title)),
        )?;

        Self::get_project(conn, &id)?
            .ok_or_else(|| AppError::Internal("Failed to retrieve created project".into()))
    }

    pub fn update_project(
        conn: &Connection,
        input: &UpdateProjectInput,
    ) -> Result<ResearchProject, AppError> {
        let now = Utc::now().to_rfc3339();
        let tags_json = input
            .tags
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| "[]".into());

        let completed_at = if input.status == "completed" {
            Some(now.clone())
        } else {
            None
        };

        conn.execute(
            "UPDATE research_projects SET
                title = ?1, description = ?2, objective = ?3, research_questions = ?4,
                hypotheses = ?5, expected_outcomes = ?6, primary_domain_id = ?7,
                subdomain_id = ?8, custom_domain_text = ?9, status = ?10, priority = ?11,
                start_date = ?12, target_deadline = ?13, completed_at = ?14,
                tags_json = ?15, notes = ?16, updated_at = ?17
             WHERE id = ?18",
            params![
                input.title,
                input.description,
                input.objective,
                input.research_questions,
                input.hypotheses,
                input.expected_outcomes,
                input.primary_domain_id,
                input.subdomain_id,
                input.custom_domain_text,
                input.status,
                input.priority,
                input.start_date,
                input.target_deadline,
                completed_at,
                tags_json,
                input.notes,
                now,
                input.id,
            ],
        )?;

        Self::recalculate_project_progress(conn, &input.id)?;
        Self::get_project(conn, &input.id)?
            .ok_or_else(|| AppError::Internal("Failed to retrieve updated project".into()))
    }

    pub fn get_project(conn: &Connection, id: &str) -> Result<Option<ResearchProject>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, objective, research_questions, hypotheses, expected_outcomes,
                    primary_domain_id, subdomain_id, custom_domain_text, status, priority, progress_percent,
                    start_date, target_deadline, completed_at, tags_json, template_type, notes,
                    created_at, updated_at
             FROM research_projects WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(ResearchProject {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                objective: row.get(3)?,
                research_questions: row.get(4)?,
                hypotheses: row.get(5)?,
                expected_outcomes: row.get(6)?,
                primary_domain_id: row.get(7)?,
                subdomain_id: row.get(8)?,
                custom_domain_text: row.get(9)?,
                status: row.get(10)?,
                priority: row.get(11)?,
                progress_percent: row.get(12)?,
                start_date: row.get(13)?,
                target_deadline: row.get(14)?,
                completed_at: row.get(15)?,
                tags_json: row.get(16)?,
                template_type: row.get(17)?,
                notes: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_project_with_details(
        conn: &Connection,
        id: &str,
    ) -> Result<Option<ProjectWithDetails>, AppError> {
        let project = match Self::get_project(conn, id)? {
            Some(p) => p,
            None => return Ok(None),
        };

        let primary_domain_name: Option<String> = if let Some(ref d_id) = project.primary_domain_id
        {
            conn.query_row(
                "SELECT name FROM research_domains WHERE id = ?1",
                params![d_id],
                |r| r.get(0),
            )
            .ok()
        } else {
            None
        };

        let subdomain_name: Option<String> = if let Some(ref d_id) = project.subdomain_id {
            conn.query_row(
                "SELECT name FROM research_domains WHERE id = ?1",
                params![d_id],
                |r| r.get(0),
            )
            .ok()
        } else {
            None
        };

        let total_tasks: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let completed_tasks: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1 AND status = 'completed'",
                params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let open_tasks: i64 = total_tasks - completed_tasks;
        let overdue_tasks: i64 = conn.query_row(
            "SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1 AND status NOT IN ('completed', 'cancelled') AND due_date IS NOT NULL AND due_date < date('now')",
            params![id],
            |r| r.get(0)
        ).unwrap_or(0);

        let total_milestones: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM project_milestones WHERE project_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let completed_milestones: i64 = conn.query_row("SELECT COUNT(*) FROM project_milestones WHERE project_id = ?1 AND is_completed = 1", params![id], |r| r.get(0)).unwrap_or(0);
        let linked_papers_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM project_papers WHERE project_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        Ok(Some(ProjectWithDetails {
            project,
            primary_domain_name,
            subdomain_name,
            total_tasks,
            completed_tasks,
            open_tasks,
            overdue_tasks,
            total_milestones,
            completed_milestones,
            linked_papers_count,
        }))
    }

    pub fn list_projects(
        conn: &Connection,
        status: Option<&str>,
        domain_id: Option<&str>,
        search: Option<&str>,
    ) -> Result<Vec<ProjectWithDetails>, AppError> {
        let mut query = "SELECT id FROM research_projects WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(st) = status {
            query.push_str(" AND status = ?");
            params_vec.push(Box::new(st.to_string()));
        }
        if let Some(did) = domain_id {
            query.push_str(" AND (primary_domain_id = ? OR subdomain_id = ?)");
            params_vec.push(Box::new(did.to_string()));
            params_vec.push(Box::new(did.to_string()));
        }
        if let Some(q) = search {
            if !q.trim().is_empty() {
                query.push_str(" AND (title LIKE ? OR description LIKE ? OR objective LIKE ?)");
                let pattern = format!("%{}%", q.trim());
                params_vec.push(Box::new(pattern.clone()));
                params_vec.push(Box::new(pattern.clone()));
                params_vec.push(Box::new(pattern));
            }
        }

        query.push_str(" ORDER BY updated_at DESC");

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
        let ids: Vec<String> = stmt
            .query_map(&param_refs[..], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        let mut result = Vec::new();
        for id in ids {
            if let Some(details) = Self::get_project_with_details(conn, &id)? {
                result.push(details);
            }
        }
        Ok(result)
    }

    pub fn archive_project(conn: &Connection, id: &str) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE research_projects SET status = 'archived', updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Self::log_activity(conn, id, "project_archived", "Project archived", None)?;
        Ok(())
    }

    pub fn delete_project(conn: &Connection, id: &str) -> Result<(), AppError> {
        conn.execute("DELETE FROM research_projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn recalculate_project_progress(
        conn: &Connection,
        project_id: &str,
    ) -> Result<f64, AppError> {
        let total_tasks: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1",
                params![project_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let progress = if total_tasks == 0 {
            0.0
        } else {
            let completed_tasks: i64 = conn.query_row(
                "SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1 AND status = 'completed'",
                params![project_id],
                |r| r.get(0),
            ).unwrap_or(0);
            ((completed_tasks as f64 / total_tasks as f64) * 100.0).round()
        };

        conn.execute(
            "UPDATE research_projects SET progress_percent = ?1, updated_at = ?2 WHERE id = ?3",
            params![progress, Utc::now().to_rfc3339(), project_id],
        )?;

        Ok(progress)
    }

    // -------------------------------------------------------------------------
    // Milestones
    // -------------------------------------------------------------------------

    pub fn create_milestone(
        conn: &Connection,
        input: &CreateMilestoneInput,
    ) -> Result<ProjectMilestone, AppError> {
        let id = format!("ms_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let sort_order = input.sort_order.unwrap_or(0);

        conn.execute(
            "INSERT INTO project_milestones (id, project_id, title, description, due_date, is_completed, completed_at, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, ?7, ?7)",
            params![
                id,
                input.project_id,
                input.title,
                input.description,
                input.due_date,
                sort_order,
                now,
            ],
        )?;

        Self::log_activity(
            conn,
            &input.project_id,
            "milestone_created",
            &format!("Milestone added: {}", input.title),
            None,
        )?;

        Ok(ProjectMilestone {
            id,
            project_id: input.project_id.clone(),
            title: input.title.clone(),
            description: input.description.clone(),
            due_date: input.due_date.clone(),
            is_completed: false,
            completed_at: None,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn update_milestone(
        conn: &Connection,
        input: &UpdateMilestoneInput,
    ) -> Result<ProjectMilestone, AppError> {
        let now = Utc::now().to_rfc3339();
        let completed_at = if input.is_completed {
            Some(now.clone())
        } else {
            None
        };

        conn.execute(
            "UPDATE project_milestones SET
                title = ?1, description = ?2, due_date = ?3, is_completed = ?4,
                completed_at = ?5, sort_order = ?6, updated_at = ?7
             WHERE id = ?8",
            params![
                input.title,
                input.description,
                input.due_date,
                if input.is_completed { 1 } else { 0 },
                completed_at,
                input.sort_order.unwrap_or(0),
                now,
                input.id,
            ],
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, due_date, is_completed, completed_at, sort_order, created_at, updated_at
             FROM project_milestones WHERE id = ?1",
        )?;
        let ms = stmt.query_row(params![input.id], |row| {
            Ok(ProjectMilestone {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                due_date: row.get(4)?,
                is_completed: row.get::<_, i64>(5)? != 0,
                completed_at: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        Ok(ms)
    }

    pub fn delete_milestone(conn: &Connection, id: &str) -> Result<(), AppError> {
        conn.execute("DELETE FROM project_milestones WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_milestones(
        conn: &Connection,
        project_id: &str,
    ) -> Result<Vec<ProjectMilestone>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, due_date, is_completed, completed_at, sort_order, created_at, updated_at
             FROM project_milestones WHERE project_id = ?1 ORDER BY sort_order ASC, due_date ASC",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            Ok(ProjectMilestone {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                due_date: row.get(4)?,
                is_completed: row.get::<_, i64>(5)? != 0,
                completed_at: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------------------
    // Tasks & Dependencies
    // -------------------------------------------------------------------------

    pub fn create_task(
        conn: &Connection,
        input: &CreateTaskInput,
    ) -> Result<ProjectTask, AppError> {
        let id = format!("task_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let tags_json = input
            .tags
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| "[]".into());

        conn.execute(
            "INSERT INTO project_tasks (
                id, project_id, parent_task_id, milestone_id, title, description,
                phase, status, priority, start_date, due_date, completed_at,
                estimated_hours, actual_hours, tags_json, completion_notes, sort_order,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL, ?12, NULL, ?13, NULL, 0, ?14, ?14)",
            params![
                id,
                input.project_id,
                input.parent_task_id,
                input.milestone_id,
                input.title,
                input.description,
                input.phase.as_deref().unwrap_or("planning"),
                input.status.as_deref().unwrap_or("todo"),
                input.priority.as_deref().unwrap_or("medium"),
                input.start_date,
                input.due_date,
                input.estimated_hours,
                tags_json,
                now,
            ],
        )?;

        // Attach dependencies if provided
        if let Some(ref deps) = input.dependency_task_ids {
            for dep_id in deps {
                let _ = Self::add_dependency(conn, &id, dep_id);
            }
        }

        // Attach linked papers if provided
        if let Some(ref pids) = input.linked_paper_ids {
            for pid in pids {
                let _ = Self::link_paper_to_task(conn, &id, pid, None);
            }
        }

        if let Some(ref pid) = input.project_id {
            Self::recalculate_project_progress(conn, pid)?;
            Self::log_activity(
                conn,
                pid,
                "task_created",
                &format!("Task added: {}", input.title),
                None,
            )?;
        }

        Self::get_task(conn, &id)?
            .ok_or_else(|| AppError::Internal("Failed to retrieve created task".into()))
    }

    pub fn update_task(
        conn: &Connection,
        input: &UpdateTaskInput,
    ) -> Result<ProjectTask, AppError> {
        let now = Utc::now().to_rfc3339();
        let tags_json = input
            .tags
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| "[]".into());

        let completed_at = if input.status == "completed" {
            Some(now.clone())
        } else {
            None
        };

        conn.execute(
            "UPDATE project_tasks SET
                title = ?1, description = ?2, phase = ?3, status = ?4, priority = ?5,
                milestone_id = ?6, start_date = ?7, due_date = ?8, completed_at = ?9,
                estimated_hours = ?10, actual_hours = ?11, tags_json = ?12, completion_notes = ?13,
                updated_at = ?14
             WHERE id = ?15",
            params![
                input.title,
                input.description,
                input.phase,
                input.status,
                input.priority,
                input.milestone_id,
                input.start_date,
                input.due_date,
                completed_at,
                input.estimated_hours,
                input.actual_hours,
                tags_json,
                input.completion_notes,
                now,
                input.id,
            ],
        )?;

        let task = Self::get_task(conn, &input.id)?
            .ok_or_else(|| AppError::Internal("Failed to find updated task".into()))?;
        if let Some(ref pid) = task.project_id {
            Self::recalculate_project_progress(conn, pid)?;
        }

        Ok(task)
    }

    pub fn update_task_status(
        conn: &Connection,
        task_id: &str,
        status: &str,
    ) -> Result<ProjectTask, AppError> {
        let now = Utc::now().to_rfc3339();
        let completed_at = if status == "completed" {
            Some(now.clone())
        } else {
            None
        };

        conn.execute(
            "UPDATE project_tasks SET status = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, completed_at, now, task_id],
        )?;

        let task = Self::get_task(conn, task_id)?
            .ok_or_else(|| AppError::Internal("Failed to find updated task".into()))?;
        if let Some(ref pid) = task.project_id {
            Self::recalculate_project_progress(conn, pid)?;
            if status == "completed" {
                Self::log_activity(
                    conn,
                    pid,
                    "task_completed",
                    &format!("Completed task: {}", task.title),
                    None,
                )?;
            }
        }

        Ok(task)
    }

    pub fn delete_task(conn: &Connection, id: &str) -> Result<(), AppError> {
        let project_id: Option<String> = conn
            .query_row(
                "SELECT project_id FROM project_tasks WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .ok();

        conn.execute("DELETE FROM project_tasks WHERE id = ?1", params![id])?;

        if let Some(pid) = project_id {
            Self::recalculate_project_progress(conn, &pid)?;
        }
        Ok(())
    }

    pub fn get_task(conn: &Connection, id: &str) -> Result<Option<ProjectTask>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_task_id, milestone_id, title, description,
                    phase, status, priority, start_date, due_date, completed_at,
                    estimated_hours, actual_hours, tags_json, completion_notes, sort_order,
                    created_at, updated_at
             FROM project_tasks WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(ProjectTask {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_task_id: row.get(2)?,
                milestone_id: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                phase: row.get(6)?,
                status: row.get(7)?,
                priority: row.get(8)?,
                start_date: row.get(9)?,
                due_date: row.get(10)?,
                completed_at: row.get(11)?,
                estimated_hours: row.get(12)?,
                actual_hours: row.get(13)?,
                tags_json: row.get(14)?,
                completion_notes: row.get(15)?,
                sort_order: row.get(16)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_tasks(
        conn: &Connection,
        project_id: Option<&str>,
        status: Option<&str>,
        priority: Option<&str>,
        search: Option<&str>,
    ) -> Result<Vec<TaskWithDetails>, AppError> {
        let mut query = "SELECT id, project_id, parent_task_id, milestone_id, title, description,
                                phase, status, priority, start_date, due_date, completed_at,
                                estimated_hours, actual_hours, tags_json, completion_notes, sort_order,
                                created_at, updated_at
                         FROM project_tasks WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(pid) = project_id {
            query.push_str(" AND project_id = ?");
            params_vec.push(Box::new(pid.to_string()));
        }
        if let Some(st) = status {
            query.push_str(" AND status = ?");
            params_vec.push(Box::new(st.to_string()));
        }
        if let Some(pr) = priority {
            query.push_str(" AND priority = ?");
            params_vec.push(Box::new(pr.to_string()));
        }
        if let Some(q) = search {
            if !q.trim().is_empty() {
                query.push_str(" AND (title LIKE ? OR description LIKE ?)");
                let pattern = format!("%{}%", q.trim());
                params_vec.push(Box::new(pattern.clone()));
                params_vec.push(Box::new(pattern));
            }
        }

        query.push_str(" ORDER BY due_date IS NULL, due_date ASC, priority = 'critical' DESC, priority = 'high' DESC, created_at DESC");

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let raw_tasks: Vec<ProjectTask> = stmt
            .query_map(&param_refs[..], |row| {
                Ok(ProjectTask {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    parent_task_id: row.get(2)?,
                    milestone_id: row.get(3)?,
                    title: row.get(4)?,
                    description: row.get(5)?,
                    phase: row.get(6)?,
                    status: row.get(7)?,
                    priority: row.get(8)?,
                    start_date: row.get(9)?,
                    due_date: row.get(10)?,
                    completed_at: row.get(11)?,
                    estimated_hours: row.get(12)?,
                    actual_hours: row.get(13)?,
                    tags_json: row.get(14)?,
                    completion_notes: row.get(15)?,
                    sort_order: row.get(16)?,
                    created_at: row.get(17)?,
                    updated_at: row.get(18)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut detailed_tasks = Vec::new();
        for task in raw_tasks {
            let project_title: Option<String> = if let Some(ref pid) = task.project_id {
                conn.query_row(
                    "SELECT title FROM research_projects WHERE id = ?1",
                    params![pid],
                    |r| r.get(0),
                )
                .ok()
            } else {
                None
            };

            let milestone_title: Option<String> = if let Some(ref mid) = task.milestone_id {
                conn.query_row(
                    "SELECT title FROM project_milestones WHERE id = ?1",
                    params![mid],
                    |r| r.get(0),
                )
                .ok()
            } else {
                None
            };

            // Dependencies
            let mut dep_stmt = conn.prepare(
                "SELECT d.depends_on_task_id, t.title, t.status
                 FROM task_dependencies d
                 JOIN project_tasks t ON d.depends_on_task_id = t.id
                 WHERE d.task_id = ?1",
            )?;
            let dep_rows = dep_stmt.query_map(params![task.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;

            let mut dependencies = Vec::new();
            let mut dependency_titles = Vec::new();
            let mut is_blocked = false;

            for r in dep_rows {
                if let Ok((d_id, d_title, d_status)) = r {
                    dependencies.push(d_id);
                    dependency_titles.push(d_title);
                    if d_status != "completed" {
                        is_blocked = true;
                    }
                }
            }

            // Linked papers
            let linked_papers = Self::list_task_papers(conn, &task.id)?;

            // Subtasks count
            let subtask_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM project_tasks WHERE parent_task_id = ?1",
                    params![task.id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            let completed_subtask_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM project_tasks WHERE parent_task_id = ?1 AND status = 'completed'",
                params![task.id],
                |r| r.get(0),
            ).unwrap_or(0);

            detailed_tasks.push(TaskWithDetails {
                task,
                project_title,
                milestone_title,
                dependencies,
                dependency_titles,
                is_blocked,
                linked_papers,
                subtask_count,
                completed_subtask_count,
            });
        }

        Ok(detailed_tasks)
    }

    // -------------------------------------------------------------------------
    // Task Dependencies & Cycle Prevention
    // -------------------------------------------------------------------------

    pub fn add_dependency(
        conn: &Connection,
        task_id: &str,
        depends_on_task_id: &str,
    ) -> Result<(), AppError> {
        if task_id == depends_on_task_id {
            return Err(AppError::Validation(
                "A task cannot depend on itself".into(),
            ));
        }

        // Circular Dependency Detection via Directed Graph BFS
        if Self::detect_dependency_cycle(conn, task_id, depends_on_task_id)? {
            return Err(AppError::Validation(
                "Circular dependency detected: adding this prerequisite would create a closed loop of tasks.".into(),
            ));
        }

        let id = format!("dep_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type, created_at)
             VALUES (?1, ?2, ?3, 'finish_to_start', ?4)",
            params![id, task_id, depends_on_task_id, now],
        )?;

        Ok(())
    }

    pub fn remove_dependency(
        conn: &Connection,
        task_id: &str,
        depends_on_task_id: &str,
    ) -> Result<(), AppError> {
        conn.execute(
            "DELETE FROM task_dependencies WHERE task_id = ?1 AND depends_on_task_id = ?2",
            params![task_id, depends_on_task_id],
        )?;
        Ok(())
    }

    pub fn detect_dependency_cycle(
        conn: &Connection,
        task_id: &str,
        candidate_prereq_id: &str,
    ) -> Result<bool, AppError> {
        // If candidate_prereq already directly or transitively depends on task_id,
        // making task_id depend on candidate_prereq will create a cycle.
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(candidate_prereq_id.to_string());

        let mut stmt =
            conn.prepare("SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?1")?;

        while let Some(current) = queue.pop_front() {
            if current == task_id {
                return Ok(true); // Cycle detected!
            }

            if visited.insert(current.clone()) {
                let mut rows = stmt.query(params![current])?;
                while let Some(row) = rows.next()? {
                    let next_task: String = row.get(0)?;
                    if !visited.contains(&next_task) {
                        queue.push_back(next_task);
                    }
                }
            }
        }

        Ok(false)
    }

    // -------------------------------------------------------------------------
    // Project and Task Papers Linking
    // -------------------------------------------------------------------------

    pub fn link_paper_to_project(
        conn: &Connection,
        project_id: &str,
        paper_id: &str,
        relationship_type: Option<&str>,
        notes: Option<&str>,
    ) -> Result<ProjectPaper, AppError> {
        let id = format!("pp_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let rel = relationship_type.unwrap_or("reference");

        conn.execute(
            "INSERT OR REPLACE INTO project_papers (id, project_id, paper_id, relationship_type, notes, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, paper_id, rel, notes, now],
        )?;

        let paper_title: String = conn
            .query_row(
                "SELECT title FROM papers WHERE id = ?1",
                params![paper_id],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "Unknown Paper".to_string());

        Self::log_activity(
            conn,
            project_id,
            "paper_linked",
            &format!("Paper attached: {}", paper_title),
            notes,
        )?;

        Self::list_project_papers(conn, project_id)?
            .into_iter()
            .find(|p| p.paper_id == paper_id)
            .ok_or_else(|| AppError::Internal("Failed to find linked paper".into()))
    }

    pub fn unlink_paper_from_project(
        conn: &Connection,
        project_id: &str,
        paper_id: &str,
    ) -> Result<(), AppError> {
        conn.execute(
            "DELETE FROM project_papers WHERE project_id = ?1 AND paper_id = ?2",
            params![project_id, paper_id],
        )?;
        Ok(())
    }

    pub fn list_project_papers(
        conn: &Connection,
        project_id: &str,
    ) -> Result<Vec<ProjectPaper>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT pp.id, pp.project_id, pp.paper_id, p.title, p.publication_year, p.venue, pp.relationship_type, pp.notes, pp.added_at
             FROM project_papers pp
             JOIN papers p ON pp.paper_id = p.id
             WHERE pp.project_id = ?1
             ORDER BY pp.added_at DESC",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            let paper_id: String = row.get(2)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                paper_id,
                row.get::<_, String>(3)?,
                row.get::<_, Option<i32>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, String>(8)?,
            ))
        })?;

        let mut list = Vec::new();
        for r in rows {
            let (id, proj_id, paper_id, title, year, venue, rel_type, notes, added_at) = r?;
            // Fetch authors
            let mut auth_stmt = conn.prepare(
                "SELECT a.full_name FROM authors a JOIN paper_authors pa ON a.id = pa.author_id WHERE pa.paper_id = ?1 ORDER BY pa.author_order ASC"
            )?;
            let authors: Vec<String> = auth_stmt
                .query_map(params![paper_id], |row| row.get(0))?
                .filter_map(|x| x.ok())
                .collect();

            list.push(ProjectPaper {
                id,
                project_id: proj_id,
                paper_id,
                paper_title: title,
                paper_authors: authors,
                publication_year: year,
                venue,
                relationship_type: rel_type,
                notes,
                added_at,
            });
        }

        Ok(list)
    }

    pub fn link_paper_to_task(
        conn: &Connection,
        task_id: &str,
        paper_id: &str,
        notes: Option<&str>,
    ) -> Result<TaskPaper, AppError> {
        let id = format!("tp_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO task_papers (id, task_id, paper_id, notes, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, task_id, paper_id, notes, now],
        )?;

        let paper_title: String = conn
            .query_row(
                "SELECT title FROM papers WHERE id = ?1",
                params![paper_id],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "Linked Paper".to_string());

        Ok(TaskPaper {
            id,
            task_id: task_id.to_string(),
            paper_id: paper_id.to_string(),
            paper_title,
            notes: notes.map(|s| s.to_string()),
            added_at: now,
        })
    }

    pub fn unlink_paper_from_task(
        conn: &Connection,
        task_id: &str,
        paper_id: &str,
    ) -> Result<(), AppError> {
        conn.execute(
            "DELETE FROM task_papers WHERE task_id = ?1 AND paper_id = ?2",
            params![task_id, paper_id],
        )?;
        Ok(())
    }

    pub fn list_task_papers(conn: &Connection, task_id: &str) -> Result<Vec<TaskPaper>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT tp.id, tp.task_id, tp.paper_id, p.title, tp.notes, tp.added_at
             FROM task_papers tp
             JOIN papers p ON tp.paper_id = p.id
             WHERE tp.task_id = ?1
             ORDER BY tp.added_at DESC",
        )?;

        let rows = stmt.query_map(params![task_id], |row| {
            Ok(TaskPaper {
                id: row.get(0)?,
                task_id: row.get(1)?,
                paper_id: row.get(2)?,
                paper_title: row.get(3)?,
                notes: row.get(4)?,
                added_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // -------------------------------------------------------------------------
    // Activity Stream
    // -------------------------------------------------------------------------

    pub fn log_activity(
        conn: &Connection,
        project_id: &str,
        activity_type: &str,
        title: &str,
        details: Option<&str>,
    ) -> Result<(), AppError> {
        let id = format!("act_{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO project_activity (id, project_id, activity_type, title, details, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, activity_type, title, details, now],
        )?;

        Ok(())
    }

    pub fn list_project_activity(
        conn: &Connection,
        project_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<ProjectActivityEvent>, AppError> {
        let limit_val = limit.unwrap_or(20) as i64;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, activity_type, title, details, created_at
             FROM project_activity
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![project_id, limit_val], |row| {
            Ok(ProjectActivityEvent {
                id: row.get(0)?,
                project_id: row.get(1)?,
                activity_type: row.get(2)?,
                title: row.get(3)?,
                details: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }
}
