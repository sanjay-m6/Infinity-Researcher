import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Clock,
  Plus,
  Trash2,
  BookOpen,
  Target,
  HelpCircle,
  Lightbulb,
  AlertCircle,
  Archive,
  Check,
} from "lucide-react";
import {
  ProjectWithDetails,
  getResearchProject,
  ProjectMilestone,
  listProjectMilestones,
  createProjectMilestone,
  updateProjectMilestone,
  deleteProjectMilestone,
  TaskWithDetails,
  listProjectTasks,
  createProjectTask,
  updateProjectTaskStatus,
  deleteProjectTask,
  ProjectPaper,
  listProjectPapers,
  unlinkPaperFromProject,
  linkPaperToProject,
  archiveResearchProject,
  deleteResearchProject,
  updateResearchProject,
  listPapers,
  DbPaper,
} from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useApp } from "../../context/AppContext";
import { AiProjectPlannerModal } from "./components/AiProjectPlannerModal";
import { ProjectAiAssistant } from "./components/ProjectAiAssistant";

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
  onProjectUpdated?: () => void;
}

type TabType =
  | "overview"
  | "tasks"
  | "timeline"
  | "papers"
  | "milestones"
  | "notes"
  | "assistant"
  | "settings";

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
  onBack,
  onProjectUpdated,
}) => {
  const { showToast } = useApp();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [papers, setLinkedPapers] = useState<ProjectPaper[]>([]);
  const [libraryPapers, setLibraryPapers] = useState<DbPaper[]>([]);
  const [isAiPlannerOpen, setIsAiPlannerOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPhase, setNewTaskPhase] = useState("literature_review");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [isNewMilestoneOpen, setIsNewMilestoneOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [isLinkPaperOpen, setIsLinkPaperOpen] = useState(false);
  const [selectedPaperToLink, setSelectedPaperToLink] = useState("");

  // Confirmation dialog states
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [milestoneToDelete, setMilestoneToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isDeleteProjectConfirmOpen, setIsDeleteProjectConfirmOpen] = useState(false);

  // Edit settings state
  const [editTitle, setEditTitle] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    loadAllData();
  }, [projectId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const proj = await getResearchProject(projectId);
      setProject(proj);
      if (proj) {
        setEditTitle(proj.project.title);
        setEditObjective(proj.project.objective || "");
        setEditNotes(proj.project.notes || "");
      }

      const [loadedTasks, loadedMilestones, loadedPapers, papersPaged] = await Promise.all([
        listProjectTasks(projectId),
        listProjectMilestones(projectId),
        listProjectPapers(projectId),
        listPapers(),
      ]);

      setTasks(loadedTasks);
      setMilestones(loadedMilestones);
      setLinkedPapers(loadedPapers);
      setLibraryPapers(papersPaged.items);
    } catch (e) {
      console.error("Failed to load project details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskStatusToggle = async (task: TaskWithDetails) => {
    const nextStatus = task.task.status === "completed" ? "todo" : "completed";
    try {
      await updateProjectTaskStatus(task.task.id, nextStatus);
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to toggle task status:", e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await createProjectTask({
        project_id: projectId,
        title: newTaskTitle.trim(),
        phase: newTaskPhase,
        priority: newTaskPriority,
        status: "todo",
      });
      setNewTaskTitle("");
      setIsNewTaskOpen(false);
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to create task:", e);
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteProjectTask(taskToDelete.id);
      showToast(`Task "${taskToDelete.title}" deleted.`, "info");
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to delete task:", e);
      showToast("Failed to delete task.", "error");
    } finally {
      setTaskToDelete(null);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;

    try {
      await createProjectMilestone({
        project_id: projectId,
        title: newMilestoneTitle.trim(),
        due_date: newMilestoneDate ? new Date(newMilestoneDate).toISOString() : undefined,
      });
      setNewMilestoneTitle("");
      setNewMilestoneDate("");
      setIsNewMilestoneOpen(false);
      await loadAllData();
    } catch (e) {
      console.error("Failed to create milestone:", e);
    }
  };

  const handleToggleMilestone = async (m: ProjectMilestone) => {
    try {
      await updateProjectMilestone({
        id: m.id,
        title: m.title,
        description: m.description || undefined,
        due_date: m.due_date || undefined,
        is_completed: !m.is_completed,
      });
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to update milestone:", e);
    }
  };

  const handleConfirmDeleteMilestone = async () => {
    if (!milestoneToDelete) return;
    try {
      await deleteProjectMilestone(milestoneToDelete.id);
      showToast(`Milestone "${milestoneToDelete.title}" deleted.`, "info");
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to delete milestone:", e);
      showToast("Failed to delete milestone.", "error");
    } finally {
      setMilestoneToDelete(null);
    }
  };

  const handleLinkPaper = async () => {
    if (!selectedPaperToLink) return;
    try {
      await linkPaperToProject(projectId, selectedPaperToLink, "reference");
      setSelectedPaperToLink("");
      setIsLinkPaperOpen(false);
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to link paper:", e);
    }
  };

  const handleUnlinkPaper = async (paperId: string) => {
    try {
      await unlinkPaperFromProject(projectId, paperId);
      await loadAllData();
      onProjectUpdated?.();
    } catch (e) {
      console.error("Failed to unlink paper:", e);
    }
  };

  const handleSaveSettings = async () => {
    if (!project) return;
    try {
      await updateResearchProject({
        id: projectId,
        title: editTitle,
        objective: editObjective,
        notes: editNotes,
        status: project.project.status,
        priority: project.project.priority,
      });
      await loadAllData();
      onProjectUpdated?.();
      showToast("Project settings saved successfully.", "success");
    } catch (e) {
      console.error("Failed to save project settings:", e);
      showToast("Failed to save project settings.", "error");
    }
  };

  const handleConfirmArchive = async () => {
    try {
      await archiveResearchProject(projectId);
      showToast("Project archived successfully.", "info");
      onProjectUpdated?.();
      onBack();
    } catch (e) {
      console.error("Failed to archive project:", e);
      showToast("Failed to archive project.", "error");
    } finally {
      setIsArchiveConfirmOpen(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    try {
      await deleteResearchProject(projectId);
      showToast("Project permanently deleted.", "info");
      onProjectUpdated?.();
      onBack();
    } catch (e) {
      console.error("Failed to delete project:", e);
      showToast("Failed to delete project.", "error");
    } finally {
      setIsDeleteProjectConfirmOpen(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Loading research project workspace...</p>
      </div>
    );
  }

  const p = project.project;
  const completedTasks = tasks.filter((t) => t.task.status === "completed").length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : p.progress_percent;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-muted transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{p.title}</h1>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                  p.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : p.status === "completed"
                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.status}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                  p.priority === "critical"
                    ? "bg-red-500/10 text-red-600"
                    : p.priority === "high"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-slate-500/10 text-slate-600"
                }`}
              >
                {p.priority}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              {project.primary_domain_name && (
                <span className="font-medium text-foreground">
                  {project.primary_domain_name}
                  {project.subdomain_name ? ` → ${project.subdomain_name}` : ""}
                </span>
              )}
              {p.custom_domain_text && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {p.custom_domain_text}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAiPlannerOpen(true)}
            className="flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI Project Planner
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsNewTaskOpen(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Progress & Quick Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Completion</span>
            <span className="font-bold text-foreground">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {completedTasks} of {tasks.length} tasks resolved
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs text-muted-foreground">Milestones</div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {milestones.filter((m) => m.is_completed).length} / {milestones.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Key research checkpoints
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs text-muted-foreground">Linked Literature</div>
          <div className="text-2xl font-bold text-foreground mt-1">{papers.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Verified academic papers
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs text-muted-foreground">Target Deadline</div>
          <div className="text-sm font-semibold text-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            {p.target_deadline
              ? new Date(p.target_deadline).toLocaleDateString()
              : "No deadline set"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {p.target_deadline && new Date(p.target_deadline) < new Date() ? (
              <span className="text-destructive font-semibold">Overdue</span>
            ) : (
              "Timeline on track"
            )}
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview" },
            { id: "tasks", label: `Tasks (${tasks.length})` },
            { id: "timeline", label: "Timeline" },
            { id: "papers", label: `Research Papers (${papers.length})` },
            { id: "milestones", label: `Milestones (${milestones.length})` },
            { id: "notes", label: "Notes" },
            { id: "assistant", label: "AI Copilot" },
            { id: "settings", label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {/* 1. OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Objective & Scope */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Research Objective
              </h3>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {p.objective || "No research objective documented yet. Add one in Settings or generate with AI."}
              </p>
            </div>

            {/* Questions & Hypotheses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  Research Questions
                </h4>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {p.research_questions || "None specified."}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                  Hypotheses & Outcomes
                </h4>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {p.hypotheses || "None specified."}
                </div>
              </div>
            </div>

            {/* Upcoming Milestones */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Upcoming Milestones</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("milestones")}
                  className="text-xs text-primary hover:underline"
                >
                  View All
                </button>
              </div>
              {milestones.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No milestones added yet. Click AI Project Planner to generate them!
                </div>
              ) : (
                <div className="space-y-2">
                  {milestones.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={m.is_completed}
                          onChange={() => handleToggleMilestone(m)}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span
                          className={`font-medium ${
                            m.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {m.title}
                        </span>
                      </div>
                      {m.due_date && (
                        <span className="text-[11px] text-muted-foreground">
                          Due {new Date(m.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick AI Actions & Activity */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Planning & Intelligence
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Need to decompose complex methodologies into scheduled tasks or check if any steps are blocked?
              </p>
              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAiPlannerOpen(true)}
                  className="w-full justify-center gap-2 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Open AI Project Planner
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("assistant")}
                  className="w-full justify-center gap-2 text-xs"
                >
                  Consult AI Copilot
                </Button>
              </div>
            </div>

            {/* Linked Literature Summary */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Linked Papers</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("papers")}
                  className="text-xs text-primary hover:underline"
                >
                  Manage ({papers.length})
                </button>
              </div>
              {papers.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center">
                  No papers attached yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {papers.slice(0, 3).map((pItem) => (
                    <div
                      key={pItem.id}
                      className="p-2.5 rounded-xl bg-muted/20 border border-border text-xs"
                    >
                      <div className="font-semibold text-foreground line-clamp-1">
                        {pItem.paper_title}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {pItem.relationship_type || "Reference"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {tasks.length} total tasks in this project
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewTaskOpen(true)}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Task
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl p-6">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <div className="text-sm font-semibold text-foreground">No Tasks Created Yet</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create tasks manually or use the AI Project Planner to automatically generate milestones and tasks.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAiPlannerOpen(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate AI Plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewTaskOpen(true)}
                  className="text-xs"
                >
                  Create Task
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden">
              {tasks.map((item) => {
                const t = item.task;
                const isCompleted = t.status === "completed";
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleTaskStatusToggle(item)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isCompleted
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {t.description}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {t.phase}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                              t.priority === "critical"
                                ? "bg-red-500/10 text-red-600"
                                : t.priority === "high"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {t.priority}
                          </span>
                          {item.milestone_title && (
                            <span className="text-[11px] text-muted-foreground">
                              Milestone: {item.milestone_title}
                            </span>
                          )}
                          {item.is_blocked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Blocked ({item.dependencies.length} prereqs)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setTaskToDelete({ id: t.id, title: t.title })}
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TIMELINE */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-bold text-foreground mb-4">Chronological Road Map</h3>
            <div className="relative border-l-2 border-primary/30 pl-6 ml-3 space-y-6">
              {milestones.map((m) => (
                <div key={m.id} className="relative">
                  <div
                    className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 ${
                      m.is_completed
                        ? "bg-primary border-primary"
                        : "bg-background border-primary"
                    }`}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{m.title}</span>
                      {m.due_date && (
                        <span className="text-[11px] text-muted-foreground">
                          Due {new Date(m.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. PAPERS */}
      {activeTab === "papers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {papers.length} scholarly papers linked to this project
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsLinkPaperOpen(true)}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Link Paper from Library
            </Button>
          </div>

          {papers.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl p-6">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <div className="text-sm font-semibold text-foreground">No Research Papers Linked</div>
              <p className="text-xs text-muted-foreground mt-1">
                Link relevant papers from your local library to ground AI summaries and plan literature extraction.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {papers.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-2">
                      {item.paper_title}
                    </h4>
                    {item.paper_authors && item.paper_authors.length > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {item.paper_authors.join(", ")}
                      </div>
                    )}
                    <span className="inline-block mt-2 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {item.relationship_type || "Reference"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="text-[10px] text-muted-foreground">
                      Linked {new Date(item.added_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnlinkPaper(item.paper_id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. MILESTONES */}
      {activeTab === "milestones" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {milestones.length} major research milestones
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewMilestoneOpen(true)}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Milestone
            </Button>
          </div>

          <div className="space-y-3">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={m.is_completed}
                    onChange={() => handleToggleMilestone(m)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <div>
                    <div
                      className={`text-sm font-semibold ${
                        m.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {m.title}
                    </div>
                    {m.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {m.due_date && (
                    <span className="text-muted-foreground">
                      Target: {new Date(m.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMilestoneToDelete({ id: m.id, title: m.title })}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. NOTES */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
            <h3 className="text-sm font-bold text-foreground">Project Notes & Scratchpad</h3>
            <textarea
              rows={8}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Record preliminary findings, lab notes, meeting logs, or methodology thoughts..."
              className="w-full p-3.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={handleSaveSettings} className="text-xs">
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. AI ASSISTANT */}
      {activeTab === "assistant" && (
        <ProjectAiAssistant projectId={projectId} projectTitle={p.title} />
      )}

      {/* 8. SETTINGS */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-bold text-foreground">Edit Project Details</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Project Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Research Objective</label>
              <textarea
                rows={3}
                value={editObjective}
                onChange={(e) => setEditObjective(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs"
              />
            </div>

            <Button type="button" size="sm" onClick={handleSaveSettings} className="text-xs">
              Save Changes
            </Button>
          </div>

          <div className="p-5 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
            <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">
              Archive this project to hide it from active dashboards, or permanently delete all associated milestones and tasks.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveConfirmOpen(true)}
                className="text-xs"
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                Archive Project
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteProjectConfirmOpen(true)}
                className="text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AiProjectPlannerModal
        projectId={projectId}
        projectTitle={p.title}
        isOpen={isAiPlannerOpen}
        onClose={() => setIsAiPlannerOpen(false)}
        onPlanApplied={loadAllData}
      />

      {/* Create Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground">Add New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Extract metrics from IEEE paper"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Phase
                  </label>
                  <select
                    value={newTaskPhase}
                    onChange={(e) => setNewTaskPhase(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-xs"
                  >
                    <option value="planning">Planning</option>
                    <option value="literature_review">Literature Review</option>
                    <option value="methodology">Methodology</option>
                    <option value="experimentation">Experimentation</option>
                    <option value="writing">Writing & Synthesis</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <Button type="submit" size="sm" className="text-xs">
                  Create Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Milestone Modal */}
      {isNewMilestoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground">Add Milestone</h3>
            <form onSubmit={handleCreateMilestone} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="e.g. Complete Literature Review Matrix"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewMilestoneOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <Button type="submit" size="sm" className="text-xs">
                  Create Milestone
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Paper Modal */}
      {isLinkPaperOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground">Link Paper from Library</h3>
            <div className="space-y-3">
              <select
                value={selectedPaperToLink}
                onChange={(e) => setSelectedPaperToLink(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-xs"
              >
                <option value="">Select paper...</option>
                {libraryPapers.map((lp) => (
                  <option key={lp.id} value={lp.id}>
                    {lp.title} {lp.publication_date ? `(${lp.publication_date.slice(0, 4)})` : ""}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkPaperOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLinkPaper}
                  disabled={!selectedPaperToLink}
                  className="text-xs"
                >
                  Link Paper
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Task Deletion */}
      <ConfirmDialog
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title || "this task"}"? This action cannot be undone.`}
        confirmLabel="Delete Task"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Confirm Milestone Deletion */}
      <ConfirmDialog
        isOpen={!!milestoneToDelete}
        onClose={() => setMilestoneToDelete(null)}
        onConfirm={handleConfirmDeleteMilestone}
        title="Delete Milestone"
        message={`Are you sure you want to delete "${milestoneToDelete?.title || "this milestone"}"? Associated tasks will remain in the project.`}
        confirmLabel="Delete Milestone"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Confirm Project Archive */}
      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={handleConfirmArchive}
        title="Archive Research Project"
        message={`Are you sure you want to archive "${p.title}"? It will be hidden from active dashboards but preserved in the archives.`}
        confirmLabel="Archive Project"
        cancelLabel="Cancel"
        isDestructive={false}
      />

      {/* Confirm Project Permanent Deletion */}
      <ConfirmDialog
        isOpen={isDeleteProjectConfirmOpen}
        onClose={() => setIsDeleteProjectConfirmOpen(false)}
        onConfirm={handleConfirmDeleteProject}
        title="Permanently Delete Project"
        message={`Are you sure you want to PERMANENTLY delete "${p.title}" and all its milestones and tasks? This action cannot be reversed.`}
        confirmLabel="Permanently Delete"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
