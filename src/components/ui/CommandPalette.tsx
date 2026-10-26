import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import {
  Search,
  LayoutDashboard,
  Compass,
  Library,
  Download,
  FolderOpen,
  Layers,
  Clock,
  Settings,
  FileText,
  Sparkles,
  TableProperties,
  FileCheck2,
  Globe,
  Info,
  Bug,
  Compass as CompassIcon,
  GitPullRequest,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { NavSection } from "../../types/domain";

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveSection,
    setSelectedPaperId,
    papers,
    setIsAboutModalOpen,
    openFeedbackCenter,
    setIsOnboardingOpen,
  } = useApp();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === "Escape" && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  interface CommandItem {
    label: string;
    section?: NavSection;
    action?: () => void;
    icon: React.ReactNode;
  }

  const navItems: CommandItem[] = [
    {
      label: "Dashboard",
      section: "dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: "Discover Papers",
      section: "discover",
      icon: <Compass className="w-4 h-4" />,
    },
    {
      label: "Review Matrix (Literature Review)",
      section: "review_matrix",
      icon: <TableProperties className="w-4 h-4 text-indigo-500" />,
    },
    {
      label: "Paper Library",
      section: "library",
      icon: <Library className="w-4 h-4" />,
    },
    {
      label: "Research Integrity Suite",
      section: "integrity",
      icon: <FileCheck2 className="w-4 h-4 text-emerald-500" />,
    },
    {
      label: "AI Workspace & RAG",
      section: "ai_hub",
      icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
    },
    {
      label: "IEEE Open Access Hub",
      section: "ieee",
      icon: <Globe className="w-4 h-4 text-sky-500" />,
    },
    {
      label: "Download Queue",
      section: "downloads",
      icon: <Download className="w-4 h-4" />,
    },
    {
      label: "Collections",
      section: "collections",
      icon: <FolderOpen className="w-4 h-4" />,
    },
    {
      label: "Academic Sources",
      section: "sources",
      icon: <Layers className="w-4 h-4" />,
    },
    {
      label: "Activity Logs",
      section: "activity",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: "Settings",
      section: "settings",
      icon: <Settings className="w-4 h-4" />,
    },
    {
      label: "Report a Bug / Request a Feature",
      action: () => openFeedbackCenter("bug"),
      icon: <Bug className="w-4 h-4 text-rose-500" />,
    },
    {
      label: "Contribute on GitHub",
      action: () =>
        window.open(
          "https://github.com/sanjay-m6/Infinity-Researcher",
          "_blank",
          "noopener,noreferrer"
        ),
      icon: <GitPullRequest className="w-4 h-4 text-indigo-500" />,
    },
    {
      label: "Open GitHub Repository (sanjay-m6/Infinity-Researcher)",
      action: () =>
        window.open(
          "https://github.com/sanjay-m6/Infinity-Researcher",
          "_blank",
          "noopener,noreferrer"
        ),
      icon: <GithubIcon className="w-4 h-4" />,
    },
    {
      label: "Run Setup & Onboarding Wizard",
      action: () => setIsOnboardingOpen(true),
      icon: <CompassIcon className="w-4 h-4 text-indigo-500" />,
    },
    {
      label: "About Infinity Researcher (Created by Sanjay)",
      action: () => setIsAboutModalOpen(true),
      icon: <Info className="w-4 h-4 text-indigo-400" />,
    },
  ];

  const filteredNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredPapers = query.trim()
    ? papers
        .filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.authors.some((a) => a.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 5)
    : [];

  const totalResults = filteredNav.length + filteredPapers.length;

  const handleSelectNav = (item: CommandItem) => {
    if (item.action) {
      item.action();
    } else if (item.section) {
      setActiveSection(item.section);
    }
    setIsCommandPaletteOpen(false);
  };

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    setIsCommandPaletteOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalResults, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalResults) % Math.max(totalResults, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex < filteredNav.length) {
        handleSelectNav(filteredNav[selectedIndex]);
      } else {
        const paperIndex = selectedIndex - filteredNav.length;
        if (filteredPapers[paperIndex]) {
          handleSelectPaper(filteredPapers[paperIndex].id);
        }
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a screen name or search papers..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredNav.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
                Navigation
              </span>
              {filteredNav.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSelectNav(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-slate-400">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredPapers.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block">
                Matching Papers
              </span>
              {filteredPapers.map((paper, pIdx) => {
                const itemIdx = filteredNav.length + pIdx;
                const isSelected = selectedIndex === itemIdx;
                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => handleSelectPaper(paper.id)}
                    onMouseEnter={() => setSelectedIndex(itemIdx)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{paper.title}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{paper.year}</span>
                  </button>
                );
              })}
            </div>
          )}

          {totalResults === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching navigation or papers found for &quot;{query}&quot;
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Use <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> to
            navigate
          </span>
          <span>
            Press <kbd className="font-mono">Enter</kbd> to select
          </span>
        </div>
      </div>
    </div>
  );
};
