import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
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
  ShieldCheck,
  Sparkles,
  FileCheck,
  TableProperties,
  Bug,
  GitPullRequest,
} from "lucide-react";

import applicationIcon from "../../assets/application.png";
import { GithubIcon } from "../ui/GithubIcon";

interface NavItemConfig {
  id: NavSection;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: number;
  badgeColor?: string;
}

interface NavSectionGroup {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    jobs,
    collections,
    setIsAboutModalOpen,
    openFeedbackCenter,
  } = useApp();

  const sidebarRef = useRef<HTMLElement>(null);
  const navContainerRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const iconsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const chevronRef = useRef<HTMLDivElement>(null);
  const logoAuraRef = useRef<HTMLDivElement>(null);

  const activeJobsCount = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  ).length;

  const sectionGroups: NavSectionGroup[] = [
    {
      title: "Core",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: (active) => (
            <LayoutDashboard
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"
              }`}
            />
          ),
        },
        {
          id: "discover",
          label: "Discover",
          icon: (active) => (
            <Compass
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400"
              }`}
            />
          ),
        },
        {
          id: "ieee",
          label: "IEEE Open Access",
          icon: (active) => (
            <ShieldCheck
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-sky-400" : "text-slate-400 group-hover:text-sky-400"
              }`}
            />
          ),
        },
        {
          id: "library",
          label: "Library",
          icon: (active) => (
            <LibraryIcon
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"
              }`}
            />
          ),
        },
      ],
    },
    {
      title: "Analysis & AI",
      items: [
        {
          id: "review_matrix",
          label: "Review Matrix",
          icon: (active) => (
            <TableProperties
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-cyan-300" : "text-cyan-500/80 group-hover:text-cyan-400"
              }`}
            />
          ),
        },
        {
          id: "integrity",
          label: "Research Integrity",
          icon: (active) => (
            <FileCheck
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-emerald-300" : "text-emerald-500/80 group-hover:text-emerald-400"
              }`}
            />
          ),
        },
        {
          id: "ai_hub",
          label: "AI Workspace",
          icon: (active) => (
            <Sparkles
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-violet-300" : "text-indigo-400 group-hover:text-violet-400"
              }`}
            />
          ),
        },
      ],
    },
    {
      title: "Workspace",
      items: [
        {
          id: "downloads",
          label: "Downloads",
          icon: (active) => (
            <Download
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-amber-400" : "text-slate-400 group-hover:text-amber-400"
              }`}
            />
          ),
          badge: activeJobsCount > 0 ? activeJobsCount : undefined,
          badgeColor: "bg-amber-500/15 text-amber-500 dark:text-amber-300 border-amber-500/30",
        },
        {
          id: "collections",
          label: "Collections",
          icon: (active) => (
            <FolderOpen
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"
              }`}
            />
          ),
          badge: collections.length,
          badgeColor: "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
        },
        {
          id: "sources",
          label: "Sources",
          icon: (active) => (
            <Layers
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400"
              }`}
            />
          ),
        },
        {
          id: "activity",
          label: "Activity",
          icon: (active) => (
            <Clock
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-slate-300" : "text-slate-400 group-hover:text-slate-200"
              }`}
            />
          ),
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: (active) => (
            <Settings
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"
              }`}
            />
          ),
        },
      ],
    },
  ];

  // GSAP: Initial staggered entry animation
  useEffect(() => {
    const itemElements = Array.from(itemsRef.current.values());
    if (itemElements.length > 0) {
      gsap.fromTo(
        itemElements,
        { opacity: 0, x: -14 },
        {
          opacity: 1,
          x: 0,
          duration: 0.35,
          stagger: 0.02,
          ease: "power2.out",
        }
      );
    }
  }, []);

  // GSAP: Animate active item change
  useEffect(() => {
    const activeEl = itemsRef.current.get(activeSection);
    if (activeEl) {
      gsap.fromTo(
        activeEl,
        { scale: 0.97 },
        { scale: 1, duration: 0.3, ease: "back.out(2)" }
      );
    }
  }, [activeSection]);

  // GSAP: Animate collapse/expand chevron
  useEffect(() => {
    if (chevronRef.current) {
      gsap.to(chevronRef.current, {
        rotation: isSidebarCollapsed ? 180 : 0,
        duration: 0.28,
        ease: "power2.inOut",
      });
    }
  }, [isSidebarCollapsed]);

  // Micro-hover physics handlers using GSAP
  const handleItemMouseEnter = (id: string) => {
    const itemEl = itemsRef.current.get(id);
    const iconEl = iconsRef.current.get(id);
    if (itemEl && !isSidebarCollapsed) {
      gsap.to(itemEl, { x: 3, duration: 0.2, ease: "power2.out" });
    }
    if (iconEl) {
      gsap.to(iconEl, { scale: 1.15, duration: 0.2, ease: "back.out(2)" });
    }
  };

  const handleItemMouseLeave = (id: string) => {
    const itemEl = itemsRef.current.get(id);
    const iconEl = iconsRef.current.get(id);
    if (itemEl) {
      gsap.to(itemEl, { x: 0, duration: 0.2, ease: "power2.out" });
    }
    if (iconEl) {
      gsap.to(iconEl, { scale: 1, duration: 0.2, ease: "power2.out" });
    }
  };

  const handleLogoMouseEnter = () => {
    if (logoAuraRef.current) {
      gsap.to(logoAuraRef.current, {
        scale: 1.25,
        opacity: 0.8,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  };

  const handleLogoMouseLeave = () => {
    if (logoAuraRef.current) {
      gsap.to(logoAuraRef.current, {
        scale: 1,
        opacity: 0.4,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className={`relative h-full bg-slate-50/90 dark:bg-[#0b101b] border-r border-slate-200/90 dark:border-slate-800/80 flex flex-col transition-all duration-300 select-none z-30 shrink-0 backdrop-blur-xl ${
        isSidebarCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Ambient gradient aura */}
      <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl" />

      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-slate-200/80 dark:border-slate-800/80 relative z-10">
        <button
          type="button"
          onClick={() => setIsAboutModalOpen(true)}
          onMouseEnter={handleLogoMouseEnter}
          onMouseLeave={handleLogoMouseLeave}
          title="Infinity Researcher — Discover. Understand. Research. Created by Sanjay (Infinity Web Technology)"
          className="flex items-center gap-2.5 overflow-hidden text-left group cursor-pointer"
        >
          {/* Logo container with animated glow */}
          <div className="relative shrink-0">
            <div
              ref={logoAuraRef}
              className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-40 blur-xs transition-opacity duration-300"
            />
            <div className="relative w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-md shadow-indigo-600/15">
              <img
                src={applicationIcon}
                alt="Infinity Researcher"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                Infinity Researcher
              </span>
              <span className="text-[10px] font-semibold tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent truncate">
                Discover. Understand.
              </span>
            </div>
          )}
        </button>

        {/* Smooth collapse toggle button */}
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-6 h-6 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer shadow-2xs"
        >
          <div ref={chevronRef} className="flex items-center justify-center">
            {isSidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </div>
        </button>
      </div>

      {/* Navigation List */}
      <nav
        ref={navContainerRef}
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 relative z-10"
        aria-label="Main Navigation"
      >
        {sectionGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isSidebarCollapsed ? (
              <span className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                {group.title}
              </span>
            ) : (
              <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-auto my-1.5" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      if (el) itemsRef.current.set(item.id, el);
                      else itemsRef.current.delete(item.id);
                    }}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    onMouseEnter={() => handleItemMouseEnter(item.id)}
                    onMouseLeave={() => handleItemMouseLeave(item.id)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                      isActive
                        ? "bg-indigo-50/90 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 font-semibold border border-indigo-200/80 dark:border-indigo-500/30 shadow-xs shadow-indigo-500/10"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent"
                    } ${isSidebarCollapsed ? "justify-center px-0" : ""}`}
                  >
                    {/* Glowing active edge bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.7)]" />
                    )}

                    <span
                      ref={(el) => {
                        if (el) iconsRef.current.set(item.id, el);
                        else iconsRef.current.delete(item.id);
                      }}
                      className="shrink-0 flex items-center justify-center"
                    >
                      {item.icon(isActive)}
                    </span>

                    {!isSidebarCollapsed && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}

                    {!isSidebarCollapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums border ${
                          item.badgeColor ||
                          (isActive
                            ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700")
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Community, GitHub & Bug Reporting Card */}
      <div className="px-2.5 pb-2 relative z-10">
        <div className="p-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md space-y-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => openFeedbackCenter("bug")}
            title="Open GitHub Bug Reporting Center"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer group ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-rose-500 shrink-0 group-hover:scale-110 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Report Bug</span>}
          </button>

          <button
            type="button"
            onClick={() =>
              window.open(
                "https://github.com/sanjay-m6/Infinity-Researcher",
                "_blank",
                "noopener,noreferrer"
              )
            }
            title="Contribute on GitHub"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer group ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Contribute</span>}
          </button>

          <button
            type="button"
            onClick={() =>
              window.open(
                "https://github.com/sanjay-m6/Infinity-Researcher",
                "_blank",
                "noopener,noreferrer"
              )
            }
            title="Open GitHub Repository (sanjay-m6/Infinity-Researcher)"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">GitHub</span>}
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/50 relative z-10">
        {!isSidebarCollapsed ? (
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 dark:text-slate-500">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate cursor-pointer font-medium flex items-center gap-1.5"
              title="Infinity Researcher — Created by Sanjay"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Created by Sanjay</span>
            </button>
            <span className="truncate opacity-75">Infinity Web Tech</span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer font-bold text-[10px]"
              title="Infinity Researcher — Created by Sanjay"
              aria-label="About Infinity Researcher"
            >
              IR
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
