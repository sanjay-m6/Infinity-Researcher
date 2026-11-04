import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../hooks/useTheme";
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
  startDraggingWindow,
} from "../../lib/desktop-api";
import applicationIcon from "../../assets/application.png";
import { Minus, Square, Copy, X, ShieldCheck, Sun, Moon } from "lucide-react";
import { AppIcon } from "../icons/AppIcon";
import { GithubIcon } from "../ui/GithubIcon";

export const TitleBar: React.FC = () => {
  const { isTauri, setIsAboutModalOpen, activeSection, user } = useApp();
  const { resolvedTheme, toggleTheme } = useTheme();
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

  const handleTitleBarMouseDown = async (e: React.MouseEvent) => {
    if (
      e.button === 0 &&
      (e.target as HTMLElement).closest("button, a, input, select") === null
    ) {
      if (isTauri) {
        try {
          await startDraggingWindow();
        } catch {
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().startDragging();
          } catch {
            // Ignored
          }
        }
      }
    }
  };

  return (
    <header
      aria-label="Window title bar"
      data-tauri-drag-region
      onMouseDown={handleTitleBarMouseDown}
      onDoubleClick={handleToggleMaximize}
      className="h-9 w-full bg-slate-100 dark:bg-[#070b12] border-b border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 flex items-center justify-between select-none z-40 shrink-0 text-xs px-2 transition-colors duration-200"
    >
      {/* Left: App Logo & Title (Draggable region + click for About dialog) */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={() => setIsAboutModalOpen(true)}
          title="Infinity Researcher — Discover. Understand. Research. Created by Sanjay (Infinity Web Technology)"
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="w-5 h-5 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
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
          <AppIcon
            icon={ShieldCheck}
            size="xs"
            className="text-emerald-600 dark:text-emerald-400"
          />
          <span>Local Core</span>
        </span>
      </div>

      {/* Center: Draggable region with clean window title */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center px-4 text-center select-none"
      >
        <span
          data-tauri-drag-region
          className="font-medium text-slate-700 dark:text-slate-300 tracking-tight text-[11px]"
        >
          Infinity Researcher
        </span>
        {user && (
          <>
            <span
              data-tauri-drag-region
              className="mx-2 text-slate-300 dark:text-slate-700"
            >
              •
            </span>
            <span
              data-tauri-drag-region
              className="text-[11px] font-normal text-slate-500 dark:text-slate-400 capitalize"
            >
              {activeSection.replace("_", " ")}
            </span>
          </>
        )}
      </div>

      {/* Right: Window Control Buttons */}
      <div className="flex items-center h-full">
        {/* Quick Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer mr-0.5"
          title={
            resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>

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
            <AppIcon icon={Minus} size="sm" />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={handleToggleMaximize}
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
            title={isMaximized ? "Restore" : "Maximize"}
            className="w-10 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <AppIcon
              icon={isMaximized ? Copy : Square}
              size="xs"
              className={isMaximized ? "rotate-180" : ""}
            />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close window"
            title="Close"
            className="w-10 h-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
          >
            <AppIcon icon={X} size="sm" />
          </button>
        </div>
      </div>
    </header>
  );
};
