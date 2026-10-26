import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  Cpu,
  Folder,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { getAppHealth, isTauriEnvironment, pingBackend } from "../lib/tauri-bridge";
import { HealthResponse, CommandError } from "../types/health";

export const DiagnosticView: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [pingLatencyMs, setPingLatencyMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CommandError | null>(null);
  const [isTauri, setIsTauri] = useState<boolean>(true);

  // Probe backend asynchronously without synchronous setState in effect body
  const runProbe = useCallback(async () => {
    if (!isTauriEnvironment()) {
      setIsTauri(false);
      setIsLoading(false);
      setError({
        code: "ERR_RUNTIME_UNAVAILABLE",
        message:
          "Desktop runtime unavailable. You are running in standalone browser mode where Tauri native IPC is not present.",
        retryable: false,
      });
      return;
    }

    const start = performance.now();
    try {
      const pingResult = await pingBackend();
      const elapsed = Math.round(performance.now() - start);

      const healthData = await getAppHealth();
      if (pingResult === "pong") {
        setPingLatencyMs(elapsed);
      }
      setHealth(healthData);
      setIsTauri(true);
      setError(null);
    } catch (err) {
      setError(err as CommandError);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void runProbe();
  }, [runProbe]);

  const handleManualRefresh = () => {
    setIsLoading(true);
    setError(null);
    void runProbe();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 antialiased">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Infinity Researcher
              </h1>
            </div>
            <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
              Desktop Foundation / Phase 2 Diagnostics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300">
              v{health?.app_version ?? "0.1.0"}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50"
              aria-label="Refresh backend health check"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`}
                aria-hidden="true"
              />
              <span>{isLoading ? "Checking..." : "Re-check"}</span>
            </button>
          </div>
        </header>

        {/* Runtime Status Banner */}
        <section aria-label="System Connectivity Status">
          {!isTauri ? (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 flex items-start gap-3.5 shadow-sm">
              <AlertTriangle
                className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-amber-300">
                  Browser Fallback Mode (No Desktop IPC)
                </p>
                <p className="text-amber-200/80 leading-relaxed text-xs">
                  The frontend is rendering in standard browser mode. Native Rust commands
                  (IPC) require launching via the Tauri desktop shell (
                  <code>npm run tauri dev</code>).
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start justify-between gap-3.5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <AlertTriangle
                  className="w-5 h-5 text-rose-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-rose-300">
                    Backend Communication Failure
                  </p>
                  <p className="text-rose-200/80 text-xs">
                    Code:{" "}
                    <code className="bg-rose-900/40 px-1 py-0.5 rounded">
                      {error.code}
                    </code>{" "}
                    — {error.message}
                  </p>
                </div>
              </div>
              {error.retryable && (
                <button
                  onClick={handleManualRefresh}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-100 border border-rose-700/60 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Rust Native Backend Connected
                  </p>
                  <p className="text-xs text-emerald-200/70">
                    Tauri 2 IPC pipeline active & responding
                  </p>
                </div>
              </div>
              {pingLatencyMs !== null && (
                <span className="text-xs font-mono text-emerald-300/80 bg-emerald-900/40 px-2 py-1 rounded border border-emerald-800/40">
                  Round-trip: {pingLatencyMs}ms
                </span>
              )}
            </div>
          )}
        </section>

        {/* Diagnostic Metrics Grid */}
        <section
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          aria-label="System Metrics"
        >
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Platform Target</span>
              <Cpu className="w-4 h-4 text-slate-500" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-slate-100 font-mono">
              {health?.platform ?? (isTauri ? "Detecting..." : "Browser / Webview")}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Security & Sandbox</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-slate-100">Strict CSP Enforced</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Process Uptime</span>
              <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-slate-100 font-mono">
              {health ? `${health.uptime_secs}s` : "—"}
            </p>
          </div>
        </section>

        {/* Subsystems Roadmap / Readiness Status */}
        <section className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              Subsystem Readiness & Roadmap Alignment
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Phase 2 Foundation Baseline
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                Tauri 2 IPC Command Bridge
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                ACTIVE (app_health, app_ping)
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                Network & Resilient Engine
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                READY (Base Tokio / HTTP)
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                SQLite Database & FTS5 Indexing
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                {health?.subsystems?.database ? health.subsystems.database.toUpperCase() : "READY (SQLite 3, FTS5)"}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                Academic Source Connectors (OpenAlex, Crossref, arXiv)
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-800/80 text-slate-400 border border-slate-700/50">
                Scheduled for Phase 5
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                Safe PDF Ingestion & Normalization
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-800/80 text-slate-400 border border-slate-700/50">
                Scheduled for Phase 7
              </span>
            </div>
          </div>
        </section>

        {/* Storage Configuration Notice */}
        {health?.default_storage_dir && (
          <footer className="p-3.5 rounded-lg bg-slate-900/50 border border-slate-800/60 text-xs text-slate-400 flex items-center gap-2">
            <Folder className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Default Document Root:{" "}
              <code className="text-slate-300 font-mono">
                {health.default_storage_dir}
              </code>
            </span>
          </footer>
        )}
      </div>
    </main>
  );
};
