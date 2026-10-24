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
  Database,
  Activity,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
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
    databaseInfo,
    isDbLoading,
    refreshDatabase,
    seedSampleData,
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
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Local-First SQLite Database & Storage
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your entire scholarly research library, collections, notes, and tags are stored in a local SQLite 3 database with WAL mode and FTS5 search.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Database File Path:
              </span>
              <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                {databaseInfo ? `SQLite 3 · v${databaseInfo.schema_version}` : isTauri ? "Connected" : "Web Preview"}
              </Badge>
            </div>
            <p className="text-xs font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 truncate">
              {databaseInfo?.path ||
                backendHealth?.default_storage_dir
                  ? `${backendHealth?.default_storage_dir}\\research-paper-scraper.sqlite3`
                  : "Local OS AppData Directory"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Journal Mode</span>
              <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                {databaseInfo?.journal_mode || "WAL (Write-Ahead Log)"}
              </span>
            </div>
            <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Foreign Keys</span>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {databaseInfo?.foreign_keys ? "ENABLED (ON)" : "ACTIVE"}
              </span>
            </div>
            <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Full-Text Search</span>
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">
                FTS5 (Unicode Tokenizer)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <span className="text-[11px] text-slate-500">
              Zero cloud sync, no tracking, complete privacy for academic citations.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refreshDatabase();
                  showToast("Database diagnostics refreshed.", "info");
                }}
                isLoading={isDbLoading}
                className="text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refresh DB
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void seedSampleData();
                }}
                isLoading={isDbLoading}
                className="text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Seed Sample Papers
              </Button>
            </div>
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
