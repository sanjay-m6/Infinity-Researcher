import React from "react";
import { useApp } from "../../context/AppContext";
import {
  Database,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Sun,
  Moon,
  Laptop,
  Bug,
  GitPullRequest,
} from "lucide-react";
import { GithubIcon } from "../ui/GithubIcon";

export const BottomBar: React.FC = () => {
  const {
    papers,
    jobs,
    backendHealth,
    readingPaper,
    theme,
    setTheme,
    setActiveSection,
    setIsAboutModalOpen,
    openFeedbackCenter,
  } = useApp();

  const savedPapersCount = papers.filter((p) => p.isSaved).length;
  const activeJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  );

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  return (
    <footer className="h-7 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between select-none z-30 shrink-0 px-3 font-sans transition-colors duration-200">
      {/* Left Group: Core Engine & Workload Status */}
      <div className="flex items-center gap-3 truncate">
        {/* SQLite Status */}
        <div
          className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => setActiveSection("settings")}
          title="Local SQLite Database Engine Active"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Database className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span className="font-mono text-[10px] font-medium">
            {backendHealth?.status === "healthy" ? "SQLite Ready" : "Ready"}
          </span>
        </div>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Papers Count */}
        <div
          className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => setActiveSection("library")}
          title="View Saved Library"
        >
          <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          <span>{savedPapersCount} papers</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

        {/* Background Crawl Engine Status */}
        <div
          className="hidden sm:flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          onClick={() => setActiveSection("downloads")}
          title="Crawl Engine Status"
        >
          {activeJobs.length > 0 ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber-500 dark:text-amber-400 animate-spin" />
              <span className="text-amber-600 dark:text-amber-300 font-medium">
                {activeJobs.length} active {activeJobs.length === 1 ? "job" : "jobs"}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Crawler Idle</span>
            </>
          )}
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden md:inline">|</span>

        {/* IEEE Compliance Tag */}
        <div
          className="hidden md:flex items-center gap-1 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
          onClick={() => setActiveSection("ieee")}
          title="Terms-Compliant Mode A IEEE Discovery & Provenance Workflow"
        >
          <ShieldCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          <span className="text-[10px]">IEEE Mode A</span>
        </div>
      </div>

      {/* Center: Reading Indicator or Hotkey Hint */}
      <div className="hidden lg:flex items-center gap-2 text-slate-500 dark:text-slate-400 max-w-sm truncate">
        {readingPaper ? (
          <span className="truncate text-sky-600 dark:text-sky-300 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
            Reading: {readingPaper.title}
          </span>
        ) : (
          <span className="text-[10px]">
            Press <kbd className="px-1 py-0.2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[9px] shadow-2xs">Ctrl+K</kbd> to open Command Palette
          </span>
        )}
      </div>

      {/* Right Group: Privacy, Theme, Version */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Offline / Privacy Badge */}
        <div
          className="hidden sm:flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-help"
          title="100% Local-First Application: Zero telemetry, zero tracking, zero remote cloud calls"
        >
          <Lock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px]">Local-First</span>
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

        {/* Theme quick switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          title={`Current Theme: ${theme}. Click to switch.`}
          aria-label="Toggle theme"
          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
        >
          {theme === "dark" ? (
            <Moon className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
          ) : theme === "light" ? (
            <Sun className="w-3 h-3 text-amber-500 dark:text-amber-400" />
          ) : (
            <Laptop className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          )}
          <span className="capitalize text-[10px] hidden sm:inline">{theme}</span>
        </button>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Bug Report */}
        <button
          type="button"
          onClick={() => openFeedbackCenter("bug")}
          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
          title="Open GitHub Bug Reporting Center"
        >
          <Bug className="w-3 h-3 text-rose-500 shrink-0" />
          <span className="text-[10px] hidden sm:inline">Bug Report</span>
        </button>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Contribute */}
        <button
          type="button"
          onClick={() =>
            window.open(
              "https://github.com/sanjay-m6/Infinity-Researcher",
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          title="Contribute to Infinity Researcher on GitHub"
        >
          <GitPullRequest className="w-3 h-3 text-indigo-500 shrink-0" />
          <span className="text-[10px] hidden sm:inline">Contribute</span>
        </button>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* GitHub Repository Link with Real Icon */}
        <button
          type="button"
          onClick={() =>
            window.open(
              "https://github.com/sanjay-m6/Infinity-Researcher",
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
          title="View GitHub Repository (sanjay-m6/Infinity-Researcher)"
        >
          <GithubIcon className="w-3 h-3 shrink-0" />
          <span className="text-[10px] hidden sm:inline">GitHub</span>
        </button>

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Creator & Brand */}
        <button
          type="button"
          onClick={() => setIsAboutModalOpen(true)}
          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hidden md:inline truncate cursor-pointer"
          title="Infinity Researcher — Created by Sanjay (Infinity Web Technology)"
        >
          Created by Sanjay
        </button>

        <span className="text-slate-300 dark:text-slate-700 hidden md:inline">|</span>

        {/* Version */}
        <span
          className="font-mono text-[10px] text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          onClick={() => setIsAboutModalOpen(true)}
          title="Infinity Researcher v0.1.0 — Infinity Web Technology"
        >
          v{backendHealth?.app_version || "0.1.0"}
        </span>
      </div>
    </footer>
  );
};
