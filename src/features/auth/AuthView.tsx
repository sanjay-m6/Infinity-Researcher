import React, { useState } from "react";
import { LoginView } from "./LoginView";
import { SignupView } from "./SignupView";
import applicationIcon from "../../assets/application.png";
import { Search, Database, ShieldCheck } from "lucide-react";

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-12 overflow-y-auto bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle radial center spotlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] rounded-full blur-3xl pointer-events-none" />
        {/* Subtle dot grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 dark:opacity-20 pointer-events-none" />
      </div>

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8 lg:gap-16 relative z-10 my-auto py-6">
        {/* Desktop Scholarly Hero Panel (Visible on lg screens to balance canvas & eliminate empty void) */}
        <div className="hidden lg:flex flex-col flex-1 max-w-lg space-y-6 text-left">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 p-2.5 shadow-xs flex items-center justify-center">
              <img
                src={applicationIcon}
                alt="Infinity Researcher"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/40 mb-1">
                Academic Research Platform
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Infinity Researcher
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            A private, 100% local-first academic research engine and workspace. Discover,
            synthesize, and organize scientific literature with total privacy.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Multi-Source Academic Discovery
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Live paper search across arXiv, ACM Digital Library, Google Scholar,
                  Semantic Scholar, Europe PMC, and OpenAlex.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Local-First Research Vault
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Full-text indexing, SQLite paper archive, and fast local PDF processing
                  right on your disk.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/[0.06] shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/40 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Zero Telemetry & 100% Privacy
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Local-only authentication and encrypted session storage. Your queries
                  and notes never leave your machine.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>100% Local Core • All data stored locally on your device</span>
          </div>
        </div>

        {/* Auth Form (Login / Signup) */}
        <div className="w-full max-w-[420px] flex-shrink-0 mx-auto lg:mx-0">
          {mode === "signup" ? (
            <SignupView onSwitchToLogin={() => setMode("login")} />
          ) : (
            <LoginView onSwitchToSignup={() => setMode("signup")} />
          )}
        </div>
      </div>

      {/* Subtle branding footer */}
      <div className="mt-auto py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 relative z-10 select-none">
        Infinity Researcher • 100% Local-First Academic Research Engine
      </div>
    </div>
  );
};
