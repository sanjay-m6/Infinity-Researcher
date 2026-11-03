import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Trash2,
  Check,
  FolderOpen,
  LayoutList,
  Kanban,
} from "lucide-react";
import {
  TaskWithDetails,
  listProjectTasks,
  updateProjectTaskStatus,
  createProjectTask,
  deleteProjectTask,
  ProjectWithDetails,
  listResearchProjects,
} from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useApp } from "../../context/AppContext";

type ViewMode = "list" | "kanban" | "calendar";

const STATUS_COLUMNS = [
  { id: "backlog", label: "Backlog", color: "border-slate-400 text-slate-500" },
  { id: "todo", label: "To Do", color: "border-blue-500 text-blue-500" },
  { id: "in_progress", label: "In Progress", color: "border-amber-500 text-amber-500" },
  { id: "blocked", label: "Blocked", color: "border-red-500 text-red-500" },
  { id: "completed", label: "Completed", color: "border-emerald-500 text-emerald-500" },
];

export const TasksWorkspaceView: React.FC = () => {
  const { showToast } = useApp();
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(
    null
  );

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskPhase, setNewTaskPhase] = useState("literature_review");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  useEffect(() => {
    loadAllData();
  }, [projectFilter, priorityFilter, search]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [allTasks, allProjects] = await Promise.all([
        listProjectTasks(
          projectFilter || undefined,
          undefined,
          priorityFilter || undefined,
          search || undefined
        ),
        listResearchProjects("active"),
      ]);

      setTasks(allTasks);
      setProjects(allProjects);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateProjectTaskStatus(taskId, newStatus);
      await loadAllData();
    } catch (e) {
      console.error("Failed to change task status:", e);
    }
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteProjectTask(taskToDelete.id);
      showToast(`Task "${taskToDelete.title}" deleted.`, "info");
      await loadAllData();
    } catch (e) {
      console.error("Failed to delete task:", e);
      showToast("Failed to delete task.", "error");
    } finally {
      setTaskToDelete(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await createProjectTask({
        project_id: newTaskProjectId || undefined,
        title: newTaskTitle.trim(),
        phase: newTaskPhase,
        priority: newTaskPriority,
        due_date: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined,
        status: "todo",
      });
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setIsNewTaskOpen(false);
      await loadAllData();
    } catch (e) {
      console.error("Failed to create task:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-primary" />
            Research Tasks & To-Do Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage granular research tasks, track prerequisites, and link to academic
            papers
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode switcher */}
          <div className="flex items-center rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5" />
              Board
            </button>
          </div>

          <Button
            type="button"
            onClick={() => setIsNewTaskOpen(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.project.id} value={p.project.id}>
                {p.project.title}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Views */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-muted-foreground">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <CheckSquare className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-semibold text-foreground">No Tasks Found</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Create actionable tasks with dependencies or generate a complete roadmap
              from any project.
            </p>
          </div>
          <div>
            <Button
              type="button"
              onClick={() => setIsNewTaskOpen(true)}
              className="inline-flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Add First Task
            </Button>
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* LIST VIEW */
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
                    onClick={() =>
                      handleStatusChange(t.id, isCompleted ? "todo" : "completed")
                    }
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isCompleted
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {t.description}
                      </p>
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

                      {item.project_title && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                          <FolderOpen className="w-3 h-3 text-primary" />
                          {item.project_title}
                        </span>
                      )}

                      {t.due_date && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}

                      {item.is_blocked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Blocked by {item.dependencies.length} tasks
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={t.status}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setTaskToDelete({ id: t.id, title: t.title })}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-h-[500px]">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.task.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-card border border-border rounded-2xl p-3 flex flex-col space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${col.color}`}
                  >
                    {col.label}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.map((item) => {
                    const t = item.task;
                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-border bg-background hover:border-primary/40 transition-all space-y-2 shadow-2xs"
                      >
                        <div className="text-xs font-semibold text-foreground line-clamp-2">
                          {t.title}
                        </div>

                        {item.project_title && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {item.project_title}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                          <span
                            className={`font-semibold uppercase ${
                              t.priority === "critical"
                                ? "text-red-500"
                                : t.priority === "high"
                                  ? "text-amber-500"
                                  : "text-blue-500"
                            }`}
                          >
                            {t.priority}
                          </span>

                          <div className="flex items-center gap-1">
                            {col.id !== "completed" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(t.id, "completed")}
                                className="text-muted-foreground hover:text-emerald-500 p-0.5"
                                title="Mark Completed"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setTaskToDelete({ id: t.id, title: t.title })
                              }
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground">Create Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Project
                </label>
                <select
                  value={newTaskProjectId}
                  onChange={(e) => setNewTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs"
                >
                  <option value="">Independent (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.project.id} value={p.project.id}>
                      {p.project.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
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

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs"
                />
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

      {/* Modern Confirm Dialog for Deleting Task */}
      <ConfirmDialog
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title || "this task"}"? This action cannot be undone.`}
        confirmLabel="Delete Task"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
