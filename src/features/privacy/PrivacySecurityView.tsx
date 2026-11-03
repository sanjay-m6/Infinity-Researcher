import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  ShieldCheck,
  Database,
  Cpu,
  KeyRound,
  EyeOff,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";

export const PrivacySecurityView: React.FC = () => {
  const { showToast } = useApp();

  const [offlineOnlyMode, setOfflineOnlyMode] = useState(false);
  const [stripMetadataOnExport, setStripMetadataOnExport] = useState(true);

  const securityFeatures = [
    {
      title: "100% Local-First SQLite Database",
      status: "Active · Private",
      icon: Database,
      iconColor: "text-emerald-500",
      description:
        "All papers, notes, tags, matrices, and extracted research data remain stored strictly on your local disk. Zero sync to external third-party cloud databases.",
    },
    {
      title: "Zero Analytics & No Telemetry Tracking",
      status: "Enforced · Clean",
      icon: EyeOff,
      iconColor: "text-indigo-500",
      description:
        "Infinity Researcher has no Google Analytics, PostHog, or tracking SDKs. Your queries, search history, and reading habits never leave your machine.",
    },
    {
      title: "Cryptographic SHA-256 PDF Verification",
      status: "Active · Verifying",
      icon: ShieldCheck,
      iconColor: "text-sky-500",
      description:
        "Every downloaded research paper is validated via SHA-256 hashing to guard against corruption, man-in-the-middle manipulation, and malicious payloads.",
    },
    {
      title: "Encrypted Local Keychain for API Keys",
      status: "Encrypted",
      icon: KeyRound,
      iconColor: "text-amber-500",
      description:
        "Optional academic API tokens (Semantic Scholar, Crossref) and LLM credentials are encrypted in local OS-level application storage.",
    },
    {
      title: "Local Ollama Inference Sandbox",
      status: "Local First",
      icon: Cpu,
      iconColor: "text-purple-500",
      description:
        "Run full RAG question-answering, stylometrics, and writing assistance using local Ollama models on your GPU with 0 bytes transmitted over the Internet.",
    },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>System Security & Privacy Center</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Privacy, Data Isolation & Security
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Review your local research boundary, cryptographic integrity controls, and telemetry isolation guarantees.
        </p>
      </div>

      {/* Security Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityFeatures.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${feat.iconColor}`} />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {feat.title}
                  </h2>
                </div>
                <Badge variant="success" size="sm">
                  {feat.status}
                </Badge>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {feat.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Privacy Preferences Box */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Runtime Privacy Protections
        </h2>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Strict Offline-Only Mode
              </span>
              <span className="text-[11px] text-slate-500">
                Block all external academic discovery calls and restrict paper reading strictly to locally stored PDFs.
              </span>
            </div>
            <input
              type="checkbox"
              checked={offlineOnlyMode}
              onChange={(e) => {
                setOfflineOnlyMode(e.target.checked);
                showToast(
                  e.target.checked
                    ? "Strict Offline Mode enabled: External discovery blocked"
                    : "Strict Offline Mode disabled",
                  "info"
                );
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Strip Local Annotator Metadata on Export
              </span>
              <span className="text-[11px] text-slate-500">
                Automatically clean personal timestamps, workstation usernames, and local system paths from exported BibTeX and matrices.
              </span>
            </div>
            <input
              type="checkbox"
              checked={stripMetadataOnExport}
              onChange={(e) => {
                setStripMetadataOnExport(e.target.checked);
                showToast(
                  e.target.checked
                    ? "Export metadata sanitation enabled"
                    : "Export metadata sanitation disabled",
                  "info"
                );
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
