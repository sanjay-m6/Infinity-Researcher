import React, { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { ThemeSelector } from "../theme/ThemeSelector";
import { Command, Search, DownloadCloud, ChevronRight, Wrench, X } from "lucide-react";
import { AppIcon } from "../icons/AppIcon";
import { IconButton } from "../icons/IconButton";
import { Tooltip } from "../ui/Tooltip";
import { NavSection } from "../../types/domain";

export const Toolbar: React.FC = () => {
  const {
    activeSection,
    setIsCommandPaletteOpen,
    executeGlobalSearch,
    jobs,
    setActiveSection,
  } = useApp();

  const [searchInput, setSearchInput] = useState("");

  // Determine keyboard shortcut modifier (⌘ on Mac, Ctrl on Windows/Linux)
  const isMac = useMemo(() => {
    if (typeof navigator !== "undefined") {
      return /(Mac|iPhone|iPod|iPad)/i.test(
        navigator.userAgent || navigator.platform || ""
      );
    }
    return false;
  }, []);

  const sectionMetadata: Record<
    string,
    { category: string; categorySection: NavSection; title: string }
  > = {
    // Research
    discover: {
      category: "Research",
      categorySection: "discover",
      title: "Discover & Query Papers",
    },
    literature_workspace: {
      category: "Research",
      categorySection: "literature_workspace",
      title: "Literature Workspace",
    },
    library: {
      category: "Research",
      categorySection: "library",
      title: "Saved Research Library",
    },
    research_assistant: {
      category: "Research",
      categorySection: "research_assistant",
      title: "Research Assistant",
    },
    paper_comparison: {
      category: "Research",
      categorySection: "paper_comparison",
      title: "Paper Comparison Matrix",
    },
    review_matrix: {
      category: "Research",
      categorySection: "paper_comparison",
      title: "Literature Review Matrix",
    },
    ieee: {
      category: "Research",
      categorySection: "ieee",
      title: "IEEE Open Access (Mode A)",
    },

    // AI Tools
    ai_tools: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "AI Tools Hub",
    },
    ai_writing_detector: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "AI Writing Detector",
    },
    plagiarism_checker: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Plagiarism Checker",
    },
    ai_humanizer: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "AI Humanizer",
    },
    academic_writing_assistant: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Academic Writing Assistant",
    },
    paraphrasing_tool: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Paraphrasing Tool",
    },
    citation_checker: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Citation Checker",
    },
    readability_analyzer: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Readability Analyzer",
    },
    research_integrity: {
      category: "AI Tools",
      categorySection: "ai_tools",
      title: "Research Integrity",
    },

    // Workspace
    projects: {
      category: "Workspace",
      categorySection: "projects",
      title: "Projects & Collections",
    },
    collections: {
      category: "Workspace",
      categorySection: "projects",
      title: "Research Collections",
    },
    saved_reports: {
      category: "Workspace",
      categorySection: "saved_reports",
      title: "Saved Reports & Exports",
    },
    history: {
      category: "Workspace",
      categorySection: "history",
      title: "History & Retrieval Jobs",
    },
    downloads: {
      category: "Workspace",
      categorySection: "history",
      title: "Downloads & Retrieval Jobs",
    },
    activity: {
      category: "Workspace",
      categorySection: "history",
      title: "Activity & System Logs",
    },
    dashboard: {
      category: "Research",
      categorySection: "dashboard",
      title: "Main Dashboard",
    },

    // System
    ai_models: {
      category: "System",
      categorySection: "ai_models",
      title: "AI Models & GPU Acceleration",
    },
    ai_hub: { category: "System", categorySection: "ai_models", title: "AI Workspace" },
    sources: {
      category: "System",
      categorySection: "sources",
      title: "Academic Sources & Scrapers",
    },
    settings: {
      category: "System",
      categorySection: "settings",
      title: "Settings & System Diagnostics",
    },
    privacy_security: {
      category: "System",
      categorySection: "privacy_security",
      title: "Privacy & Security",
    },
  };

  const currentMeta = sectionMetadata[activeSection] || {
    category: "Workspace",
    categorySection: "dashboard" as NavSection,
    title: "Infinity Researcher",
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
    <header className="h-12 px-4 bg-white dark:bg-[#0b101b] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-4 shrink-0 select-none transition-colors duration-200">
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs min-w-0">
        <button
          type="button"
          onClick={() => setActiveSection(currentMeta.categorySection)}
          className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium truncate cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1"
        >
          {currentMeta.category}
        </button>

        <AppIcon
          icon={ChevronRight}
          size="xs"
          className="text-slate-300 dark:text-slate-600 shrink-0"
        />

        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
          {currentMeta.title}
        </h1>
      </nav>

      {/* Global Search Bar (Phase 10 Integration Point) */}
      <div className="flex-1 max-w-md mx-2">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex items-center"
        >
          <AppIcon
            icon={Search}
            size="sm"
            className="text-slate-400 absolute left-3 pointer-events-none"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search papers across all sources..."
            aria-label="Search papers across all sources"
            className="w-full pl-9 pr-20 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-white/[0.08] transition-all shadow-2xs"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchInput && (
              <IconButton
                icon={X}
                size="xs"
                variant="ghost"
                aria-label="Clear search query"
                onClick={() => setSearchInput("")}
                className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              />
            )}
            <Tooltip content="Open Command Palette" side="bottom">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                aria-label="Open command palette"
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-white/10 hover:text-slate-600 dark:hover:text-white transition-colors flex items-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              >
                {isMac ? (
                  <Command className="w-3 h-3" />
                ) : (
                  <AppIcon icon={Command} size="xs" />
                )}
                <span>K</span>
              </button>
            </Tooltip>
          </div>
        </form>
      </div>

      {/* Right Actions: AI Tools Hub Launcher, Download Indicator & Theme Switcher */}
      <div className="flex items-center gap-2">
        {/* Quick Tools Button */}
        <Tooltip content="Explore Research Tools" side="bottom">
          <button
            type="button"
            onClick={() => setActiveSection("ai_tools")}
            title="Open Research Tools"
            aria-label="Open Research Tools"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            <AppIcon
              icon={Wrench}
              size="sm"
              className="text-slate-500 dark:text-slate-400"
            />
            <span>Tools</span>
          </button>
        </Tooltip>

        {/* Active Jobs Pill */}
        {activeJobs.length > 0 && (
          <Tooltip
            content={`${activeJobs.length} active retrieval/crawl tasks in progress`}
            side="bottom"
          >
            <button
              type="button"
              onClick={() => setActiveSection("downloads")}
              aria-label={`${activeJobs.length} active download jobs`}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            >
              <AppIcon
                icon={DownloadCloud}
                size="sm"
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="hidden sm:inline">{activeJobs.length} active jobs</span>
              <span className="sm:hidden">{activeJobs.length}</span>
            </button>
          </Tooltip>
        )}

        {/* Theme Mode Toggle */}
        <ThemeSelector variant="segmented" />
      </div>
    </header>
  );
};

export default Toolbar;
