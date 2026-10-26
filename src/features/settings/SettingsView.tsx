import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { DiagnosticView } from "../../components/DiagnosticView";
import {
  getProviderConfigStatus,
  setProviderApiKey,
  ProviderConfigStatus,
} from "../../lib/desktop-api";
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
  Key,
  ShieldCheck,
  Trash2,
  Bug,
  HelpCircle,
  Compass,
} from "lucide-react";
import applicationIcon from "../../assets/application.png";

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
    clearAllData,
    setIsAboutModalOpen,
    openFeedbackCenter,
    setIsOnboardingOpen,
  } = useApp();

  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<ProviderConfigStatus[]>([]);
  const [s2KeyInput, setS2KeyInput] = useState("");
  const [openAlexKeyInput, setOpenAlexKeyInput] = useState("");
  const [isSavingS2Key, setIsSavingS2Key] = useState(false);
  const [isSavingOAKey, setIsSavingOAKey] = useState(false);

  const loadProviderConfig = useCallback(async () => {
    if (!isTauri) return;
    try {
      const statuses = await getProviderConfigStatus();
      setProviderStatuses(statuses);
    } catch {
      // Ignored in preview
    }
  }, [isTauri]);

  useEffect(() => {
    void loadProviderConfig();
  }, [loadProviderConfig]);

  const handleSaveApiKey = async (providerId: string, key: string) => {
    if (!key.trim()) {
      showToast("Please enter an API key value.", "warning");
      return;
    }

    if (providerId === "semantic_scholar") setIsSavingS2Key(true);
    if (providerId === "openalex") setIsSavingOAKey(true);

    try {
      await setProviderApiKey(providerId, key.trim());
      showToast(`Saved API key for ${providerId.replace("_", " ")}.`, "success");
      if (providerId === "semantic_scholar") setS2KeyInput("");
      if (providerId === "openalex") setOpenAlexKeyInput("");
      await loadProviderConfig();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Failed to save API key.";
      showToast(msg, "error");
    } finally {
      if (providerId === "semantic_scholar") setIsSavingS2Key(false);
      if (providerId === "openalex") setIsSavingOAKey(false);
    }
  };

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
                {databaseInfo ? `SQLite 3 · v${databaseInfo.schema_version}` : isTauri ? "Connected" : "Local Storage"}
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
                variant="outline"
                size="sm"
                onClick={() => {
                  void clearAllData();
                }}
                isLoading={isDbLoading}
                className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Data
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

      {/* Section 3: Academic Source API Keys & Rate Limit Quotas */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Academic Provider API Keys (Optional)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All 5 supported academic sources (OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC) work without requiring any payment or account. Optional API keys increase rate limit quotas for high-volume searches.
          </p>
        </div>

        <div className="space-y-3.5">
          {/* Semantic Scholar Key */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Semantic Scholar Academic Graph
                </span>
                {providerStatuses.find((p) => p.provider_id === "semantic_scholar")?.is_configured ? (
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="w-3 h-3" />
                    Key Configured (10 req/s)
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Public Unauthenticated (1 req/s)
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-slate-400">Optional Header: x-api-key</span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Provides citation graphs and open access PDF detection. Unauthenticated access is paced at 1 request per second. Providing an official key unlocks up to 10 requests per second.
            </p>

            <div className="flex items-center gap-2 max-w-md pt-1">
              <input
                type="password"
                placeholder={
                  providerStatuses.find((p) => p.provider_id === "semantic_scholar")?.is_configured
                    ? "•••••••••••••••••••••••• (configured)"
                    : "Enter Semantic Scholar API Key..."
                }
                value={s2KeyInput}
                onChange={(e) => setS2KeyInput(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSaveApiKey("semantic_scholar", s2KeyInput)}
                disabled={isSavingS2Key || !s2KeyInput.trim()}
                className="shrink-0 text-xs"
              >
                {isSavingS2Key ? "Saving..." : "Save Key"}
              </Button>
            </div>
          </div>

          {/* OpenAlex Key */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  OpenAlex Global Scholarly Graph
                </span>
                {providerStatuses.find((p) => p.provider_id === "openalex")?.is_configured ? (
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="w-3 h-3" />
                    Key Configured (50 req/s)
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Polite Pool (10 req/s)
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-slate-400">Optional Header: api_key</span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Provides 250M+ normalized scholarly records and citation metrics. Default polite pool provides 10 requests per second. An OpenAlex API key unlocks 50 requests per second.
            </p>

            <div className="flex items-center gap-2 max-w-md pt-1">
              <input
                type="password"
                placeholder={
                  providerStatuses.find((p) => p.provider_id === "openalex")?.is_configured
                    ? "•••••••••••••••••••••••• (configured)"
                    : "Enter OpenAlex API Key..."
                }
                value={openAlexKeyInput}
                onChange={(e) => setOpenAlexKeyInput(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSaveApiKey("openalex", openAlexKeyInput)}
                disabled={isSavingOAKey || !openAlexKeyInput.trim()}
                className="shrink-0 text-xs"
              >
                {isSavingOAKey ? "Saving..." : "Save Key"}
              </Button>
            </div>
          </div>

          {/* Fully Open Providers (arXiv, Crossref, Europe PMC) */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                <strong>arXiv, Crossref, and Europe PMC</strong> are fully open public services with polite automated rate limiting enabled. No credentials needed.
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Section 4: Rust Backend Diagnostics */}
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
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-1">
              <img
                src={applicationIcon}
                alt="Infinity Researcher"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Infinity Researcher
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  v{backendHealth?.app_version || "0.1.0"}
                </span>
              </div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Discover. Understand. Research.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Infinity Researcher — An AI-powered research workspace, created by Sanjay.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openFeedbackCenter("bug")}
            >
              <Bug className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              <span>Report Bug / Feedback</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsOnboardingOpen(true)}
            >
              <Compass className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
              <span>Run Setup Wizard</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAboutModalOpen(true)}
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>About Infinity Researcher</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Author & Creator</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Sanjay</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Publisher</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Infinity Web Technology</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Copyright</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">© 2026 Sanjay</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
          <span>Release: v{backendHealth?.app_version || "0.1.0"}</span>
          <span>•</span>
          <span>© 2026 Sanjay. All rights reserved.</span>
          <span>•</span>
          <span>Local First • Zero Remote Telemetry</span>
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
