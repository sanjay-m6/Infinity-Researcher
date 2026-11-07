import React from "react";
import { useAppUpdater } from "./useAppUpdater";
import { getAppPlatform, type AppPlatformInfo } from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sparkles,
  RefreshCw,
  BellRing,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface UpdateSettingsCardProps {
  currentVersion?: string;
}

export const UpdateSettingsCard: React.FC<UpdateSettingsCardProps> = ({
  currentVersion = "0.1.1",
}) => {
  const {
    status,
    updateInfo,
    progress,
    errorMessage,
    lastChecked,
    autoCheckEnabled,
    channel,
    isTauri,
    checkForUpdates,
    downloadAndInstall,
    restartToApply,
    dismissUpdate,
    setAutoCheckEnabled,
    setChannel,
  } = useAppUpdater(currentVersion);

  const [showNotes, setShowNotes] = React.useState(true);
  const [platform, setPlatform] = React.useState<AppPlatformInfo | null>(null);

  React.useEffect(() => {
    let active = true;
    void getAppPlatform()
      .then((info) => {
        if (active) setPlatform(info);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <section
      aria-label="Application Updates"
      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Application Updates & Releases
            </h3>
            <Badge variant="primary" size="sm">
              v{currentVersion}
            </Badge>
            {channel === "beta" && (
              <Badge variant="warning" size="sm">
                Beta Channel
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Signed automatic delivery powered by Minisign Ed25519 cryptography.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={status === "checking" || status === "downloading"}
            onClick={() => void checkForUpdates(true)}
            aria-label="Check for new updates now"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${
                status === "checking" ? "animate-spin text-indigo-500" : ""
              }`}
            />
            <span>{status === "checking" ? "Checking..." : "Check for Updates"}</span>
          </Button>
        </div>
      </div>

      {/* Main Status Display */}
      {status === "checking" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200">
          <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold">Querying release distribution network...</p>
            <p className="text-indigo-700/80 dark:text-indigo-300/80">
              Verifying release manifest signature against embedded public keys.
            </p>
          </div>
        </div>
      )}

      {status === "up-to-date" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold">You are running the latest version.</p>
            <p className="text-emerald-700/80 dark:text-emerald-300/80">
              Infinity Researcher v{currentVersion} is completely up to date.
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">Update check failed</p>
              <p className="text-rose-700 dark:text-rose-300/90 font-mono text-[11px]">
                {errorMessage || "Unable to contact release repository."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void checkForUpdates(true)}
              className="shrink-0 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry Check
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("https://github.com/sanjay-m6/Infinity-Researcher/releases", "_blank", "noopener,noreferrer")}
              className="text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
            >
              GitHub Releases
            </Button>
          </div>
        </div>
      )}

      {status === "available" && updateInfo && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                New Update Available: v{updateInfo.version}
              </span>
              {updateInfo.date && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Released {updateInfo.date.split("T")[0]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void downloadAndInstall()}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {updateInfo.isExternalDownload ? "Download Installer" : "Download & Install"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissUpdate}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Remind Me Later
              </Button>
            </div>
          </div>

          {updateInfo.body && (
            <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <span>What's New in v{updateInfo.version}</span>
                {showNotes ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showNotes && (
                <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pt-1 border-t border-slate-100 dark:border-slate-700/40">
                  {updateInfo.body}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === "downloading" && progress && (
        <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500 animate-bounce" />
              Downloading signed package ({progress.percentage}%)
            </span>
            <span className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
              {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-indigo-200/60 dark:bg-indigo-950 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-200"
              style={{ width: `${Math.max(5, progress.percentage)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Verifying cryptographic signature in background. Please do not close the app.
          </p>
        </div>
      )}

      {status === "downloaded" && (
        <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-emerald-950 dark:text-emerald-200">
                  Update Ready to Install
                </p>
                <p className="text-emerald-800 dark:text-emerald-300/90">
                  The update has been downloaded, verified, and staged. Restart now to
                  finalize installation.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => void restartToApply()}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Restart to Finish Update
            </Button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-emerald-100 dark:border-emerald-800/40 pt-2">
            Safe Upgrade Guarantee: Your research database, notes, tags, and local papers
            will remain 100% intact.
          </p>
        </div>
      )}

      {/* Settings Options Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
        {/* Auto check toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Automatic Update Checking
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={autoCheckEnabled}
              onChange={(e) => setAutoCheckEnabled(e.target.checked)}
              aria-label="Toggle automatic update checks"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Release Channel Selector */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Release Channel
            </span>
          </div>
          <div className="flex items-center rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setChannel("stable")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                channel === "stable"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Stable
            </button>
            <button
              type="button"
              onClick={() => setChannel("beta")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                channel === "beta"
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Beta
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
        <span>
          Last checked: {lastChecked ? lastChecked : "Never during this session"}
        </span>
        <span>
          Platform:{" "}
          {isTauri && platform
            ? `${platform.os.toUpperCase()} (${platform.arch}) · ${platform.target_triple || platform.family || platform.arch || "x86_64"}`
            : isTauri
              ? "Native Desktop"
              : "Web Preview"}
        </span>
      </div>
    </section>
  );
};
