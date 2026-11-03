import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { NavCategory, NavSection } from "../../types/domain";
import { IconButton } from "../icons/IconButton";
import { AppIcon } from "../icons/AppIcon";
import { Tooltip } from "../ui/Tooltip";
import { ThinkingOrb } from "thinking-orbs";
import {
  Compass,
  Library as LibraryIcon,
  TableProperties,
  ScanEye,
  FileSearch,
  PenTool,
  RefreshCw,
  CheckCircle2,
  BarChart2,
  ShieldCheck,
  FolderOpen,
  CheckSquare,
  Wrench,
  FileText,
  Clock,
  Cpu,
  Settings,
  Shield,
  Layers,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  Lock,
  LogOut,
  Heart,
} from "lucide-react";

interface SubNavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
  isNew?: boolean;
}

interface CategoryConfig {
  id: NavCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SubNavItem[];
}

export const Sidebar: React.FC = () => {
  const {
    user,
    lockApplication,
    logoutUser,
    activeSection,
    setActiveSection,
    jobs,
    collections,
    papers,
    setIsAboutModalOpen,
    setIsDonationModalOpen,
    setIsSidebarCollapsed,
  } = useApp();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const activeJobsCount = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  ).length;

  // Configuration of the 4 Main Two-Column Navigation Groups
  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        id: "research",
        label: "RESEARCH",
        shortLabel: "Research",
        icon: Compass,
        items: [
          {
            id: "dashboard",
            label: "Main Dashboard",
            icon: LayoutDashboard,
          },
          {
            id: "discover",
            label: "Discover Papers",
            icon: Compass,
          },
          {
            id: "literature_workspace",
            label: "Literature Workspace",
            icon: Layers,
            badge: "3-Pane",
            badgeColor: "bg-primary text-white",
          },
          {
            id: "library",
            label: "My Library",
            icon: LibraryIcon,
            badge: papers.length > 0 ? papers.length : undefined,
          },
          {
            id: "research_assistant",
            label: "Research Assistant",
            icon: FileText,
          },
          {
            id: "paper_comparison",
            label: "Paper Comparison",
            icon: TableProperties,
          },
          {
            id: "ieee",
            label: "IEEE Open Access",
            icon: ShieldCheck,
          },
        ],
      },
      {
        id: "ai_tools",
        label: "AI TOOLS",
        shortLabel: "AI Tools",
        icon: Wrench,
        items: [
          {
            id: "ai_tools",
            label: "AI Tools Hub",
            icon: Layers,
          },
          {
            id: "ai_writing_detector",
            label: "AI Writing Detector",
            icon: ScanEye,
          },
          {
            id: "plagiarism_checker",
            label: "Plagiarism Checker",
            icon: FileSearch,
          },
          {
            id: "ai_humanizer",
            label: "AI Humanizer",
            icon: RefreshCw,
          },
          {
            id: "academic_writing_assistant",
            label: "Academic Writing Assistant",
            icon: PenTool,
          },
          {
            id: "paraphrasing_tool",
            label: "Paraphrasing Tool",
            icon: RefreshCw,
          },
          {
            id: "citation_checker",
            label: "Citation Checker",
            icon: CheckCircle2,
          },
          {
            id: "readability_analyzer",
            label: "Readability Analyzer",
            icon: BarChart2,
          },
          {
            id: "research_integrity",
            label: "Research Integrity",
            icon: ShieldCheck,
          },
        ],
      },
      {
        id: "workspace",
        label: "WORKSPACE",
        shortLabel: "Workspace",
        icon: FolderOpen,
        items: [
          {
            id: "projects",
            label: "Research Projects",
            icon: FolderOpen,
          },
          {
            id: "tasks",
            label: "Tasks & To-Do",
            icon: CheckSquare,
          },
          {
            id: "collections",
            label: "Collections",
            icon: Layers,
            badge: collections.length > 0 ? collections.length : undefined,
          },
          {
            id: "saved_reports",
            label: "Saved Reports",
            icon: FileText,
          },
          {
            id: "history",
            label: "History & Activity",
            icon: Clock,
            badge: activeJobsCount > 0 ? activeJobsCount : undefined,
            badgeColor: "bg-amber-500/20 text-amber-500 border-amber-500/40",
          },
        ],
      },
      {
        id: "system",
        label: "SYSTEM",
        shortLabel: "System",
        icon: Settings,
        items: [
          {
            id: "ai_models",
            label: "AI Models & GPU",
            icon: Cpu,
          },
          {
            id: "ai_diagnostics",
            label: "AI Diagnostics",
            icon: Wrench,
          },
          {
            id: "sources",
            label: "Academic Sources",
            icon: Layers,
          },
          {
            id: "settings",
            label: "Settings",
            icon: Settings,
          },
          {
            id: "privacy_security",
            label: "Privacy & Security",
            icon: Shield,
          },
        ],
      },
    ],
    [papers.length, collections.length, activeJobsCount]
  );

  // Derive initial active category from activeSection
  const findCategoryForSection = useCallback(
    (section: NavSection): NavCategory => {
      if (section === "dashboard") return "research";
      for (const cat of categories) {
        if (cat.items.some((item) => item.id === section)) {
          return cat.id;
        }
      }
      // Default fallback
      if (section === "review_matrix") return "research";
      if (section === "downloads" || section === "collections" || section === "activity")
        return "workspace";
      if (section === "ai_hub") return "system";
      return "research";
    },
    [categories]
  );

  const [activeCategory, setActiveCategory] = useState<NavCategory>(() =>
    findCategoryForSection(activeSection)
  );

  // Sync category when activeSection changes externally
  useEffect(() => {
    const parentCategory = findCategoryForSection(activeSection);
    setActiveCategory(parentCategory);
  }, [activeSection, findCategoryForSection]);

  // Secondary Column collapsed state (persistence)
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("infinity_sidebar_v3_secondary_collapsed");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggleSecondaryColumn = useCallback(() => {
    setIsSecondaryCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("infinity_sidebar_v3_secondary_collapsed", String(next));
      } catch {
        // no-op
      }
      setIsSidebarCollapsed?.(next);
      return next;
    });
  }, [setIsSidebarCollapsed]);

  // When clicking a primary rail icon:
  const handlePrimaryCategoryClick = (catId: NavCategory) => {
    if (activeCategory === catId && !isSecondaryCollapsed) {
      // Toggle secondary column on repeated click
      toggleSecondaryColumn();
      return;
    }

    setActiveCategory(catId);
    if (isSecondaryCollapsed) {
      setIsSecondaryCollapsed(false);
      setIsSidebarCollapsed?.(false);
      try {
        localStorage.setItem("infinity_sidebar_v3_secondary_collapsed", "false");
      } catch {
        // no-op
      }
    }

    // Auto-select the first item in the category if current section is outside it
    const cat = categories.find((c) => c.id === catId);
    if (cat && !cat.items.some((i) => i.id === activeSection)) {
      setActiveSection(cat.items[0].id);
    }
  };

  const currentCategory = useMemo(() => {
    return categories.find((c) => c.id === activeCategory) || categories[0];
  }, [categories, activeCategory]);

  // Keyboard navigation within sub-navigation list
  const handleNavKeyDown = (e: React.KeyboardEvent, index: number) => {
    const items = currentCategory.items;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % items.length;
      const nextBtn = document.getElementById(`subnav-item-${items[nextIndex].id}`);
      nextBtn?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + items.length) % items.length;
      const prevBtn = document.getElementById(`subnav-item-${items[prevIndex].id}`);
      prevBtn?.focus();
    }
  };

  return (
    <aside
      className="h-full flex select-none z-30 shrink-0 border-r border-slate-200 dark:border-slate-800 transition-all duration-200"
      aria-label="Main Sidebar"
    >
      {/* =================================================================== */}
      {/* COLUMN 1: PRIMARY ICON RAIL (56px)                                */}
      {/* =================================================================== */}
      <div className="w-14 bg-slate-100 dark:bg-[#070b12] text-slate-500 dark:text-slate-400 flex flex-col items-center py-3 justify-between border-r border-slate-200 dark:border-slate-800/80 shrink-0 z-20 transition-colors duration-200">
        {/* Top: Brand Logo / Animated ThinkingOrb */}
        <div className="flex flex-col items-center gap-4">
          <Tooltip content="Infinity Researcher — About" side="right">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              aria-label="About Infinity Researcher"
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-xs select-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 overflow-hidden"
              title="Infinity Researcher — About"
            >
              <ThinkingOrb
                state={activeJobsCount > 0 ? "working" : "searching"}
                size={20}
              />
            </button>
          </Tooltip>

          {/* Primary Navigation Icons with Tooltips & Active Accent Bar */}
          <div className="flex flex-col items-center gap-1.5 pt-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isCatActive = activeCategory === cat.id;

              return (
                <Tooltip key={cat.id} content={cat.shortLabel} side="right">
                  <button
                    type="button"
                    onClick={() => handlePrimaryCategoryClick(cat.id)}
                    aria-label={`${cat.shortLabel} navigation group`}
                    aria-current={isCatActive ? "page" : undefined}
                    title={`${cat.shortLabel} (Click to open)`}
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                      isCatActive
                        ? "bg-slate-200/90 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300/80 dark:border-white/10 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Active Route Indicator Accent Line */}
                    {isCatActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r"
                        aria-hidden="true"
                      />
                    )}
                    <AppIcon icon={Icon} size="md" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Bottom: Quick Actions */}
        <div className="flex flex-col items-center gap-2">
          {/* Quick Collapse Secondary Column Toggle */}
          <IconButton
            icon={isSecondaryCollapsed ? ChevronRight : ChevronLeft}
            aria-label={
              isSecondaryCollapsed ? "Expand sidebar panel" : "Collapse sidebar panel"
            }
            tooltip={
              isSecondaryCollapsed ? "Expand sidebar panel" : "Collapse sidebar panel"
            }
            tooltipSide="right"
            size="sm"
            variant="ghost"
            onClick={toggleSecondaryColumn}
            isExpanded={!isSecondaryCollapsed}
            chevronAngle={180}
            className="w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]"
          />

          {/* User Profile / Creator Badge with Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title={user ? `${user.username} (${user.email})` : "Local Profile"}
              aria-label={user ? `User Profile for ${user.username}` : "Local Profile"}
              aria-expanded={isProfileMenuOpen}
              className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/80 hover:bg-indigo-200 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shadow-xs uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {user?.username ? user.username.slice(0, 2) : "IR"}
            </button>

            {isProfileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                <div className="absolute bottom-0 left-9 z-50 w-48 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-left-2 duration-150">
                  <div className="px-2.5 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {user?.username || "Researcher"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {user?.email || "Offline Account"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      void lockApplication();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                  >
                    <AppIcon icon={Lock} size="xs" />
                    <span>Lock Application</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsAboutModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  >
                    <AppIcon icon={ShieldCheck} size="xs" />
                    <span>About System</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsDonationModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 font-medium"
                  >
                    <AppIcon
                      icon={Heart}
                      size="xs"
                      className="fill-current text-rose-500"
                    />
                    <span>Support & Donate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      void logoutUser();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                  >
                    <AppIcon icon={LogOut} size="xs" />
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* COLUMN 2: CATEGORY SUB-NAVIGATION PANEL (216px)                    */}
      {/* =================================================================== */}
      {!isSecondaryCollapsed && (
        <div className="w-54 sm:w-56 bg-slate-50/90 dark:bg-[#0b101b] text-slate-700 dark:text-slate-300 flex flex-col justify-between h-full border-r border-slate-200 dark:border-slate-800/80 shrink-0 animate-in fade-in duration-150 transition-colors duration-200">
          {/* Header with Category Name */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {currentCategory.label}
            </span>

            <button
              type="button"
              onClick={toggleSecondaryColumn}
              title="Collapse category panel"
              aria-label="Collapse category panel"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sub-navigation Items List inside semantic <nav> */}
          <nav
            aria-label="Main Navigation"
            className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1"
          >
            {currentCategory.items.map((item, idx) => {
              const Icon = item.icon;
              // Check if active (with legacy alias mapping)
              const isActive =
                activeSection === item.id ||
                (item.id === "paper_comparison" && activeSection === "review_matrix") ||
                (item.id === "projects" && activeSection === "collections") ||
                (item.id === "history" &&
                  (activeSection === "activity" || activeSection === "downloads")) ||
                (item.id === "ai_models" && activeSection === "ai_hub");

              return (
                <button
                  key={item.id}
                  id={`subnav-item-${item.id}`}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  onKeyDown={(e) => handleNavKeyDown(e, idx)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-white dark:bg-white/[0.08] text-indigo-700 dark:text-white font-medium border border-indigo-200/80 dark:border-white/10 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <AppIcon
                    icon={Icon}
                    size="sm"
                    className={`transition-colors ${
                      isActive
                        ? "text-indigo-600 dark:text-slate-200"
                        : "text-slate-400 dark:text-slate-400"
                    }`}
                  />

                  <span className="flex-1 truncate">{item.label}</span>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums border ${
                        item.badgeColor ||
                        (isActive
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/10"
                          : "bg-slate-200/80 text-slate-600 border-slate-300 dark:bg-white/[0.05] dark:text-slate-400 dark:border-white/[0.08]")
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.isNew && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer Status & Storage info */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">Local Engine: Ready</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">SQLite</span>
          </div>
        </div>
      )}
    </aside>
  );
};
