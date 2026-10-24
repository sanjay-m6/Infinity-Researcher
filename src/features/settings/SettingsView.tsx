import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { DiagnosticView } from "../../components/DiagnosticView";
import {
  Sun,
  Moon,
  Laptop,
  HardDrive,
  Activity,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Folder,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
    backendHealth,
    isTauri,
    isHealthLoading,
    refreshHealth,
    showToast,
  } = useApp();

  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Settings & Diagnostics"
        description="Configure desktop application appearance, local storage directory, and inspect Rust backend health."
      />

      {/* Section 1: Appearance & Theme */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Appearance & Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select your preferred visual mode or sync with system preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              showToast("Switched to Light theme.", "info");
            }}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              theme === "light"
                ? "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-sm font-medium">Light Theme</div>
              <div className="text-[11px] text-slate-500">Soft neutral light mode</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              showToast("Switched to Dark theme.", "info");
            }}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              theme === "dark"
                ? "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <div className="text-sm font-medium">Dark Theme</div>
              <div className="text-[11px] text-slate-500">Deep slate dark mode</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("system");
              showToast("Synced theme with OS preference.", "info");
            }}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              theme === "system"
                ? "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-200 font-semibold ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Laptop className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <div className="text-sm font-medium">System Default</div>
              <div className="text-[11px] text-slate-500">Follow OS appearance</div>
            </div>
          </button>
        </div>
      </section>

      {/* Section 2: Local Storage & Library Path */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Local-First Storage Location
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All downloaded PDF files, cached full-text records, and SQLite databases
            remain on your local disk.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Active Storage Directory:
            </span>
            <Badge variant="outline" size="sm">
              Local Machine
            </Badge>
          </div>
          <p className="text-xs font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 truncate">
            {backendHealth?.default_storage_dir ||
              "C:\\Users\\...\\AppData\\Local\\research_paper_scraper (Default)"}
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Custom folder relocation and backup tools are planned for Phase 4.
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Folder browsing bridge will be wired in Phase 4"
              className="text-xs"
            >
              <Folder className="w-3.5 h-3.5" />
              Browse (Phase 4)
            </Button>
          </div>
        </div>
      </section>

      {/* Section 3: Rust Backend Diagnostics */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Tauri 2 & Rust Core Health
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live status from the native Rust command bridge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshHealth}
              isLoading={isHealthLoading}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-probe
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDiagnosticModalOpen(true)}
              className="text-xs"
            >
              Deep Diagnostic View
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[11px] text-slate-400 block font-medium">
              Rust Backend Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              {isTauri && backendHealth?.status === "ok" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Active & Responding
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {isTauri ? "Unavailable" : "Browser Preview Mode"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[11px] text-slate-400 block font-medium">
              App Version
            </span>
            <span className="text-sm font-semibold font-mono text-slate-800 dark:text-slate-200 mt-1 block">
              v{backendHealth?.app_version || "0.1.0"}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[11px] text-slate-400 block font-medium">
              Operating System
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
              {backendHealth?.platform || "Windows 64-bit"}
            </span>
          </div>
        </div>
      </section>

      {/* Section 4: About & Build Info */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          About Research Paper Scraper
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Research Paper Scraper is a local-first scholarly workbench engineered with
          Tauri 2, Rust, React 19, and Tailwind CSS v4. Designed for scientists, PhD
          candidates, and deep readers requiring offline resilience and zero remote
          tracking.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Phase 3 — UI & Design System Release</span>
          <span>•</span>
          <span>License: MIT</span>
          <span>•</span>
          <span>Local First • No Remote Telemetry</span>
        </div>
      </section>

      {/* Diagnostic Modal */}
      <Modal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        title="Tauri Core Diagnostics"
        maxWidth="lg"
      >
        <div className="py-2">
          <DiagnosticView />
        </div>
      </Modal>
    </div>
  );
};
