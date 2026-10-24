import React from "react";
import { useApp } from "../../context/AppContext";
import { NavSection } from "../../types/domain";
import {
  LayoutDashboard,
  Compass,
  Library as LibraryIcon,
  Download,
  FolderOpen,
  Layers,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    jobs,
    collections,
    backendHealth,
    isTauri,
    isHealthLoading,
  } = useApp();

  const activeJobsCount = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  ).length;

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      id: "discover",
      label: "Discover",
      icon: <Compass className="w-5 h-5 shrink-0" />,
    },
    {
      id: "library",
      label: "Library",
      icon: <LibraryIcon className="w-5 h-5 shrink-0" />,
    },
    {
      id: "downloads",
      label: "Downloads",
      icon: <Download className="w-5 h-5 shrink-0" />,
      badge: activeJobsCount > 0 ? activeJobsCount : undefined,
    },
    {
      id: "collections",
      label: "Collections",
      icon: <FolderOpen className="w-5 h-5 shrink-0" />,
      badge: collections.length,
    },
    {
      id: "sources",
      label: "Sources",
      icon: <Layers className="w-5 h-5 shrink-0" />,
    },
    {
      id: "activity",
      label: "Activity",
      icon: <Clock className="w-5 h-5 shrink-0" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
  ];

  return (
    <aside
      className={`h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 select-none z-30 shrink-0 ${
        isSidebarCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                Research Paper
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Local Workbench
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5"
        aria-label="Main Navigation"
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span
                className={
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 group-hover:text-slate-600"
                }
              >
                {item.icon}
              </span>
              {!isSidebarCollapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {!isSidebarCollapsed && item.badge !== undefined && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                    isActive
                      ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Backend Status Pill */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
        {!isSidebarCollapsed ? (
          <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 truncate">
              {isHealthLoading ? (
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              ) : isTauri && backendHealth?.status === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="truncate text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                {isHealthLoading
                  ? "Checking Rust core..."
                  : isTauri && backendHealth?.status === "ok"
                    ? `Rust v${backendHealth.app_version} Active`
                    : "Web Preview (Demo)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("settings")}
              title="View system diagnostics"
              aria-label="View system diagnostics"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => setActiveSection("settings")}
              title={
                isTauri && backendHealth?.status === "ok"
                  ? "Rust Core: Healthy"
                  : "Preview / Offline"
              }
              aria-label="System status"
              className="p-1 rounded-full"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isTauri && backendHealth?.status === "ok"
                    ? "bg-emerald-500"
                    : "bg-amber-400"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
