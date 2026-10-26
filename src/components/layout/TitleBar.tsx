import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
} from "../../lib/desktop-api";
import applicationIcon from "../../assets/application.png";
import { Minus, Square, Copy, X, Search, ShieldCheck } from "lucide-react";
import { GithubIcon } from "../ui/GithubIcon";

export const TitleBar: React.FC = () => {
  const { isTauri, setIsCommandPaletteOpen, setIsAboutModalOpen, activeSection } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let isMounted = true;
    const checkMaximized = async () => {
      try {
        const max = await isWindowMaximized();
        if (isMounted) setIsMaximized(max);
      } catch {
        // Ignored in non-tauri or initial mount
      }
    };

    checkMaximized();
    const interval = setInterval(checkMaximized, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isTauri]);

  const handleMinimize = async () => {
    await minimizeWindow();
  };

  const handleToggleMaximize = async () => {
    const nextState = await toggleMaximizeWindow();
    setIsMaximized(nextState);
  };

  const handleClose = async () => {
    await closeWindow();
  };

  return (
    <header
      data-tauri-drag-region
      className="h-9 w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between select-none z-40 shrink-0 text-xs px-2 transition-colors duration-200"
    >
      {/* Left: App Logo & Title (Draggable region + click for About dialog) */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={() => setIsAboutModalOpen(true)}
          title="Infinity Researcher — Discover. Understand. Research. Created by Sanjay (Infinity Web Technology)"
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="w-5 h-5 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-white/10 border border-slate-300 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
            <img
              src={applicationIcon}
              alt="Infinity Researcher"
              className="w-full h-full object-contain"
            />
          </div>
          <span
            data-tauri-drag-region
            className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight text-[11px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
          >
            Infinity Researcher
          </span>
        </button>
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/50">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Local Core</span>
        </span>
      </div>

      {/* Center: Draggable region with modern Quick Search Command Pill */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center px-4 max-w-md mx-auto"
      >
        <button
          type="button"
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full max-w-xs h-6.5 px-3 rounded-full bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700/60 flex items-center justify-between text-[11px] transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Search className="w-3 h-3 text-slate-400 dark:text-slate-400 shrink-0" />
            <span className="truncate">Search papers, DOIs, commands...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-700/70">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Section tag & Window Control Buttons */}
      <div className="flex items-center h-full">
        {/* Active Section pill */}
        <div data-tauri-drag-region className="hidden md:flex items-center px-2 text-[10px] text-slate-400 dark:text-slate-400 font-mono capitalize mr-1">
          <span>{activeSection}</span>
        </div>

        {/* GitHub Repository Quick Link */}
        <button
          type="button"
          onClick={() =>
            window.open(
              "https://github.com/sanjay-m6/Infinity-Researcher",
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer mr-1"
          title="Open GitHub Repository (sanjay-m6/Infinity-Researcher)"
        >
          <GithubIcon className="w-3.5 h-3.5" />
        </button>

        {/* Window controls */}
        <div className="flex items-center h-full">
          {/* Minimize */}
          <button
            type="button"
            onClick={handleMinimize}
            aria-label="Minimize window"
            title="Minimize"
            className="w-10 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={handleToggleMaximize}
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
            title={isMaximized ? "Restore" : "Maximize"}
            className="w-10 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close window"
            title="Close"
            className="w-10 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
