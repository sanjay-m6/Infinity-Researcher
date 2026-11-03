import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Tag,
} from "lucide-react";
import { AppIcon } from "../../../components/icons/AppIcon";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

export type TaskPriority = "high" | "medium" | "low";

export interface DashboardTaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  phase: string;
  dueDate?: string;
  createdAt: string;
}

const DEFAULT_STARTER_TASKS: DashboardTaskItem[] = [
  {
    id: "task_init_1",
    title: "Formulate primary research hypothesis and project scope",
    completed: false,
    priority: "high",
    phase: "Literature Review",
    createdAt: new Date().toISOString(),
  },
  {
    id: "task_init_2",
    title: "Identify top 5 baseline papers and benchmark datasets in library",
    completed: false,
    priority: "medium",
    phase: "Methodology",
    createdAt: new Date().toISOString(),
  },
  {
    id: "task_init_3",
    title: "Extract methodology excerpts and equations into review matrix",
    completed: true,
    priority: "low",
    phase: "Synthesis",
    createdAt: new Date().toISOString(),
  },
];

const STORAGE_KEY = "infinity_researcher_dashboard_tasks_v1";

interface DashboardTasksModuleProps {
  onFocusInputRef?: (focusFn: () => void) => void;
}

export const DashboardTasksModule: React.FC<DashboardTasksModuleProps> = ({
  onFocusInputRef,
}) => {
  const [tasks, setTasks] = useState<DashboardTaskItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_STARTER_TASKS;
  });

  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newPhase, setNewPhase] = useState("Literature Review");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    if (onFocusInputRef) {
      onFocusInputRef(() => {
        setIsAdding(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    }
  }, [onFocusInputRef]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const newTask: DashboardTaskItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: trimmed,
      completed: false,
      priority: newPriority,
      phase: newPhase,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTitle("");
    setIsAdding(false);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  return (
    <section
      aria-label="Research Milestones & To-Do Tasks"
      className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0b101b] p-5 shadow-xs transition-all space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
              <AppIcon icon={CheckSquare} size="xs" />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Research To-Do & Milestones
            </h2>
            <Badge variant="secondary" size="sm" className="font-mono tabular-nums text-[10px]">
              {completedCount}/{tasks.length}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Actionable research targets, literature review tasks, and paper annotations.
          </p>
        </div>

        {/* Action Controls & Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center rounded-lg bg-slate-100 dark:bg-white/[0.04] p-0.5 border border-slate-200 dark:border-white/[0.06] text-[11px]">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filter === "active"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Active ({tasks.length - completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("done")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filter === "done"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Done ({completedCount})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAdding((prev) => !prev);
              if (!isAdding) setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <AppIcon icon={Plus} size="xs" />
            <span>Add Task</span>
          </Button>

          {completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer px-1.5"
              title="Clear all completed tasks"
            >
              Clear Done
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.04]">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Milestone Progress</span>
          </span>
          <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-indigo-500 to-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Add Task Input Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleAddTask}
            className="overflow-hidden p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What research task needs to be completed next?"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button type="submit" variant="primary" size="sm" className="h-8 text-xs px-3">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="h-8 text-xs px-2 text-slate-400"
              >
                Cancel
              </Button>
            </div>

            {/* Quick selectors for Priority and Phase */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-medium">Priority:</span>
                {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider capitalize cursor-pointer border ${
                      newPriority === p
                        ? p === "high"
                          ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : p === "medium"
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/20"
                        : "text-slate-400 border-transparent hover:border-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-medium">Phase:</span>
                {["Literature Review", "Methodology", "Synthesis", "Drafting"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setNewPhase(ph)}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer border ${
                      newPhase === ph
                        ? "bg-indigo-600 text-white border-indigo-600 font-medium"
                        : "text-slate-400 border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Task Item List */}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {filteredTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1.5"
            >
              <CheckCircle2 className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
              <p>No {filter !== "all" ? filter : ""} tasks found</p>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
              >
                + Add a research task
              </button>
            </motion.div>
          ) : (
            filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  task.completed
                    ? "bg-slate-50/50 dark:bg-white/[0.01] border-slate-200/50 dark:border-white/[0.03] text-slate-400 dark:text-slate-500"
                    : "bg-white dark:bg-white/[0.03] border-slate-200/90 dark:border-white/[0.06] hover:border-indigo-400/50 dark:hover:border-indigo-500/30 text-slate-800 dark:text-slate-200 shadow-2xs"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className="shrink-0 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    aria-label={`Toggle task: ${task.title}`}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={`text-xs font-medium truncate ${
                        task.completed ? "line-through opacity-70" : ""
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                      <span className="flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        <span>{task.phase}</span>
                      </span>
                      <span>•</span>
                      <span
                        className={`font-semibold uppercase tracking-wider text-[9px] ${
                          task.priority === "high"
                            ? "text-rose-500 dark:text-rose-400"
                            : task.priority === "medium"
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-slate-400"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Delete task ${task.title}`}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all cursor-pointer rounded shrink-0 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default DashboardTasksModule;

