import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { DiagnosticView } from "../../components/DiagnosticView";
import { ThemeSettingsControl } from "../../components/theme/ThemeSettingsControl";
import {
  getProviderConfigStatus,
  setProviderApiKey,
  ProviderConfigStatus,
} from "../../lib/desktop-api";
import {
  Database,
  Activity,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Key,
  ShieldCheck,
  Trash2,
  Bug,
  HelpCircle,
  Compass,
  Lock,
  User,
  Palette,
  Columns2,
  Search,
  RefreshCw,
  Info,
  ChevronRight,
  Sliders,
  Check,
} from "lucide-react";
import applicationIcon from "../../assets/application.png";
import { UpdateSettingsCard } from "../updater/UpdateSettingsCard";
import { cn } from "../../lib/utils";

export type SettingsCategory =
  | "all"
  | "appearance"
  | "security"
  | "database"
  | "apikeys"
  | "system"
  | "updates"
  | "about";

interface SettingsCategoryItem {
  id: SettingsCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_CATEGORIES: SettingsCategoryItem[] = [
  {
    id: "all",
    label: "All Settings",
    description: "Side-by-side 2-column view",
    icon: Columns2,
  },
  {
    id: "appearance",
    label: "Appearance & Theme",
    description: "Visual workspace styling",
    icon: Palette,
  },
  {
    id: "security",
    label: "Account & Security",
    description: "Profile, lock timeout & auth",
    icon: Lock,
  },
  {
    id: "database",
    label: "Database & Storage",
    description: "SQLite 3, WAL mode & storage",
    icon: Database,
  },
  {
    id: "apikeys",
    label: "Academic API Keys",
    description: "OpenAlex & Semantic Scholar",
    icon: Key,
  },
  {
    id: "system",
    label: "Rust Core & Health",
    description: "Backend health & diagnostics",
    icon: Activity,
  },
  {
    id: "updates",
    label: "Automatic Updates",
    description: "Version checks & updater",
    icon: RefreshCw,
  },
  {
    id: "about",
    label: "About & Creator",
    description: "Infinity Researcher & Sanjay",
    icon: Info,
  },
];

export const SettingsView: React.FC = () => {
  const {
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
    user,
    userPreferences,
    updateUserPreferences,
    lockApplication,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lockTimeout, setLockTimeout] = useState<number>(
    userPreferences?.auto_lock_timeout_minutes ?? 10
  );
  const [rememberMePref, setRememberMePref] = useState<boolean>(
    userPreferences?.remember_me ?? false
  );

  useEffect(() => {
    if (userPreferences) {
      setLockTimeout(userPreferences.auto_lock_timeout_minutes);
      setRememberMePref(userPreferences.remember_me);
    }
  }, [userPreferences]);

  const handleSaveSecuritySettings = async () => {
    try {
      await updateUserPreferences({
        auto_lock_timeout_minutes: lockTimeout,
        remember_me: rememberMePref,
      });
      showToast("Security preferences saved successfully.", "success");
    } catch {
      // Toast handles error in AppContext
    }
  };

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
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save API key.";
      showToast(msg, "error");
    } finally {
      if (providerId === "semantic_scholar") setIsSavingS2Key(false);
      if (providerId === "openalex") setIsSavingOAKey(false);
    }
  };

  // Filter sections based on search query
  const matchesSearch = useCallback(
    (title: string, keywords: string[]) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        title.toLowerCase().includes(q) ||
        keywords.some((k) => k.toLowerCase().includes(q))
      );
    },
    [searchQuery]
  );

  const isSectionVisible = useCallback(
    (category: SettingsCategory, title: string, keywords: string[]) => {
      if (!matchesSearch(title, keywords)) return false;
      if (activeCategory === "all") return true;
      return activeCategory === category;
    },
    [activeCategory, matchesSearch]
  );

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Page Header with Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <PageHeader
          title="Settings & Diagnostics"
          description="Configure desktop application appearance, local storage directory, and inspect Rust backend health."
        />

        {/* View Switcher Pill */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto p-1 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
              activeCategory === "all"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveCategory(activeCategory === "all" ? "appearance" : activeCategory)
            }
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
              activeCategory !== "all"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Categorized</span>
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Panel Workspace */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Navigation & Category Sidebar Panel */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 space-y-4 lg:sticky lg:top-4">
          {/* Quick Settings Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search settings & options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation Category Items */}
          <nav
            aria-label="Settings categories"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 shadow-2xs space-y-0.5"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings Panels
            </div>
            {SETTINGS_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const isSelected = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(item.id);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer select-none",
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border-l-2 border-indigo-600 dark:border-indigo-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isSelected
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 dark:text-slate-500"
                      )}
                    />
                    <div className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Live System Status Summary Card */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-2.5 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
              Core Runtime Status
            </span>

            {/* SQLite Health */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                <Database className="w-3 h-3 text-indigo-500" />
                SQLite Engine
              </span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />v
                {databaseInfo?.schema_version || 14} (WAL)
              </span>
            </div>

            {/* Rust Core */}
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                <Activity className="w-3 h-3 text-violet-500" />
                Tauri / Rust Bridge
              </span>
              <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 font-medium">
                {isTauri ? `v${backendHealth?.app_version || "0.1.0"}` : "Preview"}
              </span>
            </div>

            {/* Storage Boundary */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-white/5">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Storage Privacy
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                100% Local-First
              </span>
            </div>
          </div>
        </aside>

        {/* Right Main Panel: Settings Content */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Active Category Header when in single category mode */}
          {activeCategory !== "all" && (
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Showing Category:
                </span>
                <strong className="text-indigo-700 dark:text-indigo-300 font-semibold capitalize">
                  {SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)?.label}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
              >
                View All Side-by-Side →
              </button>
            </div>
          )}

          {/* Side-by-Side 2-Column Grid or Focused Container */}
          <div
            className={cn(
              activeCategory === "all"
                ? "grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"
                : "space-y-6 max-w-4xl"
            )}
          >
            {/* COLUMN 1: Workspace Appearance, Security, and Database */}
            <div className="space-y-6">
              {/* Section 1: Appearance & Visual Theme */}
              {isSectionVisible("appearance", "Appearance & Visual Theme", [
                "theme",
                "light",
                "dark",
                "system",
                "colors",
                "styling",
              ]) && (
                <section className="p-6 rounded-xl border border-border bg-card shadow-2xs">
                  <ThemeSettingsControl
                    onThemeChanged={(newTheme) => {
                      showToast(
                        newTheme === "system"
                          ? "Synced theme with OS preference."
                          : `Switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme.`,
                        "info"
                      );
                    }}
                  />
                </section>
              )}

              {/* Section 2: Local Account & Security Configuration */}
              {isSectionVisible("security", "Local Account & Application Lock", [
                "account",
                "security",
                "lock",
                "timeout",
                "password",
                "remember me",
              ]) && (
                <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      Local Account & Application Lock
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Configure inactivity timeout, secure OS Remember Me, and screen
                      locking behavior.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <User className="w-4 h-4 text-indigo-500" />
                        <span>Active Account Profile</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-medium text-slate-900 dark:text-white">
                          User ID:{" "}
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {user?.username || "admin"}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Email: {user?.email || "Offline User"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Created:{" "}
                          {user?.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : "Local"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Lock Application Now
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Manually lock the workspace right now (Shortcut:{" "}
                          <kbd className="font-mono text-[10px] bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded">
                            Ctrl+L
                          </kbd>
                          ).
                        </p>
                      </div>
                      <div className="pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void lockApplication()}
                          className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1" />
                          Lock Workspace
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                          Auto-Lock Inactivity Timeout
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Automatically lock screen and protect sensitive data after
                          inactivity.
                        </span>
                      </div>
                      <select
                        value={lockTimeout}
                        onChange={(e) => setLockTimeout(Number(e.target.value))}
                        className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes (Default)</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={0}>Disabled (Never lock)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                          Remember Me (OS Credential Store)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Securely persist session in Windows Credential Locker without
                          plaintext tokens.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={rememberMePref}
                        onChange={(e) => setRememberMePref(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-slate-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500 dark:bg-white/5 cursor-pointer"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleSaveSecuritySettings}
                        className="text-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Save Security Preferences
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* Section 3: SQLite Database & Storage Management */}
              {isSectionVisible("database", "Local-First SQLite Database & Storage", [
                "database",
                "sqlite",
                "storage",
                "path",
                "wal",
                "fts5",
                "seed",
                "clear",
                "export",
              ]) && (
                <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Local-First SQLite Database & Storage
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Your entire scholarly research library, collections, notes, and tags
                      are stored in a local SQLite 3 database with WAL mode and FTS5
                      search.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Database File Path:
                        </span>
                        <Badge
                          variant="outline"
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          {databaseInfo
                            ? `SQLite 3 · v${databaseInfo.schema_version}`
                            : isTauri
                              ? "Connected"
                              : "Local Storage"}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 truncate select-all">
                        {databaseInfo?.path ||
                          (backendHealth?.default_storage_dir
                            ? `${backendHealth?.default_storage_dir}\\research-paper-scraper.sqlite3`
                            : "Local OS AppData Directory")}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Journal Mode
                        </span>
                        <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                          {databaseInfo?.journal_mode || "WAL"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Foreign Keys
                        </span>
                        <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {databaseInfo?.foreign_keys ? "ENABLED (ON)" : "ACTIVE"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Full-Text Search
                        </span>
                        <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">
                          FTS5 (Unicode)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                      <span className="text-[11px] text-slate-500">
                        Zero cloud telemetry. Complete local privacy.
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
                          className="text-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Refresh DB
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void clearAllData();
                          }}
                          isLoading={isDbLoading}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Clear Data
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            void seedSampleData();
                          }}
                          isLoading={isDbLoading}
                          className="text-xs cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5 mr-1" />
                          Seed Sample Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* COLUMN 2: API Keys, Rust Core Health, Updates, and About */}
            <div className="space-y-6">
              {/* Section 4: Academic Provider API Keys */}
              {isSectionVisible("apikeys", "Academic Provider API Keys (Optional)", [
                "api",
                "keys",
                "openalex",
                "semantic scholar",
                "rate limit",
                "quota",
              ]) && (
                <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Academic Provider API Keys (Optional)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      OpenAlex, Crossref, Semantic Scholar, arXiv, and Europe PMC work
                      without accounts. Providing optional keys unlocks increased rate
                      limits.
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
                          {providerStatuses.find(
                            (p) => p.provider_id === "semantic_scholar"
                          )?.is_configured ? (
                            <Badge variant="success" size="sm">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Key Configured (10 req/s)
                            </Badge>
                          ) : (
                            <Badge variant="default" size="sm">
                              Public Pool (1 req/s)
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Header: x-api-key
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Provides citation graphs and open access PDF detection.
                        Unauthenticated access is paced at 1 req/s; an API key unlocks 10
                        req/s.
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="password"
                          placeholder={
                            providerStatuses.find(
                              (p) => p.provider_id === "semantic_scholar"
                            )?.is_configured
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
                          onClick={() =>
                            void handleSaveApiKey("semantic_scholar", s2KeyInput)
                          }
                          disabled={isSavingS2Key || !s2KeyInput.trim()}
                          className="shrink-0 text-xs cursor-pointer"
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
                          {providerStatuses.find((p) => p.provider_id === "openalex")
                            ?.is_configured ? (
                            <Badge variant="success" size="sm">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Key Configured (50 req/s)
                            </Badge>
                          ) : (
                            <Badge variant="default" size="sm">
                              Polite Pool (10 req/s)
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Header: api_key
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Provides 250M+ records. Default polite pool provides 10 req/s; an
                        OpenAlex key unlocks 50 req/s.
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="password"
                          placeholder={
                            providerStatuses.find((p) => p.provider_id === "openalex")
                              ?.is_configured
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
                          onClick={() =>
                            void handleSaveApiKey("openalex", openAlexKeyInput)
                          }
                          disabled={isSavingOAKey || !openAlexKeyInput.trim()}
                          className="shrink-0 text-xs cursor-pointer"
                        >
                          {isSavingOAKey ? "Saving..." : "Save Key"}
                        </Button>
                      </div>
                    </div>

                    {/* Fully Open Providers notice */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>
                        <strong>arXiv, Crossref, and Europe PMC</strong> are fully open
                        with automated polite pacing.
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Section 5: Tauri 2 & Rust Core Health */}
              {isSectionVisible("system", "Tauri 2 & Rust Core Health", [
                "rust",
                "backend",
                "health",
                "diagnostics",
                "tauri",
                "memory",
                "os",
              ]) && (
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
                        className="text-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Re-probe
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDiagnosticModalOpen(true)}
                        className="text-xs cursor-pointer"
                      >
                        Deep Diagnostics
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase">
                        Rust Backend Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isTauri && backendHealth?.status === "ok" ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              Active & Responding
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {isTauri ? "Unavailable" : "Browser Preview"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase">
                        App Version
                      </span>
                      <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                        v{backendHealth?.app_version || "0.1.0"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase">
                        Operating System
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                        {backendHealth?.platform || "Windows 64-bit"}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Section 6: In-App Automatic Updates */}
              {isSectionVisible("updates", "In-App Automatic Updates", [
                "updates",
                "updater",
                "releases",
                "version",
                "download",
              ]) && (
                <UpdateSettingsCard
                  currentVersion={backendHealth?.app_version || "0.1.0"}
                />
              )}

              {/* Section 7: About & Creator Information */}
              {isSectionVisible("about", "About Infinity Researcher", [
                "about",
                "author",
                "creator",
                "sanjay",
                "license",
                "copyright",
                "setup",
                "bug",
              ]) && (
                <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                        <img
                          src={applicationIcon}
                          alt="Infinity Researcher"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Infinity Researcher
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
                            v{backendHealth?.app_version || "0.1.0"}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          Discover. Understand. Research.
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          An AI-powered academic workspace created by Sanjay.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openFeedbackCenter("bug")}
                        className="text-xs cursor-pointer"
                      >
                        <Bug className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                        <span>Bug / Feedback</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsOnboardingOpen(true)}
                        className="text-xs cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                        <span>Setup Wizard</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAboutModalOpen(true)}
                        className="text-xs cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        <span>About Info</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                        Author & Creator
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        Sanjay
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                        Publisher
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                        Infinity Web Tech
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                        Copyright
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        © 2026 Sanjay
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Deep Diagnostic Modal */}
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

export default SettingsView;
