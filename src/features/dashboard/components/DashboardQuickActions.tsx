import React from "react";
import {
  Plus,
  BookOpen,
  Bot,
  Table,
  GitCompare,
  UploadCloud,
} from "lucide-react";
import { AppIcon } from "../../../components/icons/AppIcon";
import { Button } from "../../../components/ui/Button";
import { useApp } from "../../../context/AppContext";

interface DashboardQuickActionsProps {
  onNewTaskClick?: () => void;
  onQuickIngestClick?: () => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onNewTaskClick,
  onQuickIngestClick,
}) => {
  const { setActiveSection } = useApp();

  return (
    <div
      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
      data-testid="dashboard-quick-actions"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quick Actions
          </span>
          <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-xs text-slate-400 hidden sm:inline-block">
            High-frequency research workflows
          </span>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Add Task Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onNewTaskClick}
            aria-label="Add new research task"
            className="h-8 text-xs font-medium gap-1.5 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <AppIcon icon={Plus} size="xs" className="text-indigo-500" />
            <span>New Task</span>
          </Button>

          {/* 2. Ingest / Discover Paper */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onQuickIngestClick) onQuickIngestClick();
              else setActiveSection("discover");
            }}
            aria-label="Search or ingest research paper"
            className="h-8 text-xs font-medium gap-1.5 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <AppIcon icon={UploadCloud} size="xs" className="text-emerald-500" />
            <span>Ingest Paper</span>
          </Button>

          {/* 3. Literature Workspace */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection("literature_workspace")}
            aria-label="Launch Workspace"
            className="h-8 text-xs font-medium gap-1.5 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <AppIcon icon={BookOpen} size="xs" className="text-indigo-500" />
            <span>Literature Workspace</span>
          </Button>

          {/* 4. AI Copilot */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection("research_assistant")}
            aria-label="Quick launch AI assistant"
            className="h-8 text-xs font-medium gap-1.5 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400"
          >
            <AppIcon icon={Bot} size="xs" className="text-purple-500" />
            <span>AI Copilot</span>
          </Button>

          {/* 5. Review Matrix */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection("review_matrix")}
            aria-label="Quick open review matrix"
            className="h-8 text-xs font-medium gap-1.5 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hidden md:inline-flex"
          >
            <AppIcon icon={Table} size="xs" className="text-amber-500" />
            <span>Review Matrix</span>
          </Button>

          {/* 6. Compare Papers */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection("paper_comparison")}
            aria-label="Quick compare papers"
            className="h-8 text-xs font-medium gap-1.5 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hidden lg:inline-flex"
          >
            <AppIcon icon={GitCompare} size="xs" className="text-sky-500" />
            <span>Compare Papers</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

