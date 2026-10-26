import React from "react";
import { Modal } from "./Modal";
import applicationIcon from "../../assets/application.png";
import {
  ShieldCheck,
  User,
  Building2,
  Copyright,
  Compass,
  TableProperties,
  Bot,
  FileCheck2,
  Bug,
  GitPullRequest,
  ExternalLink,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { useApp } from "../../context/AppContext";

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { setActiveSection, openFeedbackCenter } = useApp();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About Infinity Researcher"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <span className="text-slate-400 dark:text-slate-500">
            © 2026 Sanjay. All rights reserved.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveSection("settings");
              }}
              className="px-3 py-1.5 rounded-lg font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
            >
              Open Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 py-1 select-none">
        {/* Brand Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 text-white shadow-lg">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-inner flex items-center justify-center">
              <img
                src={applicationIcon}
                alt="Infinity Researcher"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Infinity Researcher
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v0.1.0
                </span>
              </div>
              <p className="text-sm font-medium text-indigo-200/90 tracking-wide">
                Discover. Understand. Research.
              </p>
              <p className="text-xs text-slate-300/80 pt-1">
                Infinity Researcher — An AI-powered research workspace, created by Sanjay.
              </p>
            </div>
          </div>
        </div>

        {/* Creator & Brand Metadata Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium">Author & Creator</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Sanjay
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Lead Architect
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium">Developer Brand</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Infinity Web Technology
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Publisher
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
              <Copyright className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium">Legal Copyright</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              © 2026 Sanjay
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              All rights reserved
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Integrated Research Workbench Capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Compass className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Paper Discovery & Scrapers
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Search across OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, and IEEE.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
              <TableProperties className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Literature Review Matrix
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Comparative analysis across 9 dimensions with claim-to-page evidence linking.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Bot className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Evidence-Linked Copilot
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Grounded multi-turn QA with clickable PDF page citations and passage inspection.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
              <FileCheck2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Research Integrity & Writing
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Local text similarity, AI-signal analysis, and academic writing polish.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Local Sovereign Architecture Badge */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">
              Local-First Sovereign Architecture: 100% offline-ready, zero telemetry, local SQLite WAL.
            </span>
          </div>
          <span className="font-mono text-[11px] opacity-80">Tauri 2 + Rust</span>
        </div>

        {/* Open Source, Contribute & Bug Reporting */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Open Source & Community
            </span>
            <span className="text-[11px] text-slate-400 font-mono">sanjay-m6/Infinity-Researcher</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* GitHub Repo */}
            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://github.com/sanjay-m6/Infinity-Researcher",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex items-center justify-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
            >
              <GithubIcon className="w-4 h-4 shrink-0" />
              <span>GitHub Repo</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            {/* Contribute */}
            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://github.com/sanjay-m6/Infinity-Researcher",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex items-center justify-center gap-2 p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              <GitPullRequest className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Contribute</span>
              <ExternalLink className="w-3 h-3 text-indigo-400" />
            </button>

            {/* Report a Bug */}
            <button
              type="button"
              onClick={() => {
                onClose();
                openFeedbackCenter("bug");
              }}
              className="flex items-center justify-center gap-2 p-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-medium transition-colors cursor-pointer"
            >
              <Bug className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Report Bug</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
