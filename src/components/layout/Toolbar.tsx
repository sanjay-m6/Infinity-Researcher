import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { Sun, Moon, Laptop, Command, Search, DownloadCloud } from "lucide-react";

export const Toolbar: React.FC = () => {
  const {
    activeSection,
    theme,
    setTheme,
    setIsCommandPaletteOpen,
    executeGlobalSearch,
    jobs,
    setActiveSection,
  } = useApp();

  const [searchInput, setSearchInput] = useState("");

  const sectionTitles: Record<string, string> = {
    dashboard: "Workspace Dashboard",
    discover: "Discover & Query Papers",
    library: "Saved Research Library",
    downloads: "Downloads & Retrieval Jobs",
    collections: "Research Collections",
    sources: "Academic Sources & Providers",
    activity: "Activity & System Logs",
    settings: "Settings & System Diagnostics",
  };

  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      executeGlobalSearch(searchInput.trim());
      setSearchInput("");
    }
  };

  return (
    <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Current Section Title */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate hidden md:block">
          {sectionTitles[activeSection] || "Research Workspace"}
        </h2>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md mx-2">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search papers across all sources..."
            className="w-full pl-9 pr-16 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label="Open command palette"
            className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center gap-0.5"
          >
            <Command className="w-3 h-3" /> K
          </button>
        </form>
      </div>

      {/* Actions: Download Indicator & Theme Switcher */}
      <div className="flex items-center gap-2">
        {/* Active Jobs Pill */}
        {activeJobs.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveSection("downloads")}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
          >
            <DownloadCloud className="w-3.5 h-3.5 animate-bounce" />
            <span className="hidden sm:inline">{activeJobs.length} active jobs</span>
            <span className="sm:hidden">{activeJobs.length}</span>
          </button>
        )}

        {/* Theme Mode Toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5">
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-label="Light mode"
            title="Light mode"
            className={`p-1.5 rounded-md transition-colors ${
              theme === "light"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-label="Dark mode"
            title="Dark mode"
            className={`p-1.5 rounded-md transition-colors ${
              theme === "dark"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme("system")}
            aria-label="System theme"
            title="Follow system theme"
            className={`p-1.5 rounded-md transition-colors ${
              theme === "system"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
