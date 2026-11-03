import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import { SemanticValidationResult, ValidationIssue } from "../types";
import { Badge } from "../../../components/ui/Badge";

interface TokenGuardBannerProps {
  validation: SemanticValidationResult | null;
  onApplyFix?: (issue: ValidationIssue) => void;
}

export const TokenGuardBanner: React.FC<TokenGuardBannerProps> = ({
  validation,
  onApplyFix,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validation) return null;

  const {
    score,
    issues,
    criticalIssuesCount,
    warningIssuesCount,
    preservedTokensCount,
    disclaimer,
  } = validation;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        criticalIssuesCount > 0
          ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
          : warningIssuesCount > 0
          ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
          : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
      } p-4 sm:p-5 space-y-3 shadow-xs`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Status Icon & Title */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              criticalIssuesCount > 0
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
                : warningIssuesCount > 0
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
            }`}
          >
            {criticalIssuesCount > 0 ? (
              <AlertOctagon className="w-5 h-5" />
            ) : warningIssuesCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {criticalIssuesCount > 0
                  ? "Critical Semantic Drift or Missing Invariants Detected"
                  : warningIssuesCount > 0
                  ? "Semantic Warnings: Hedges or Metrics Require Inspection"
                  : "Token Preservation & Semantic Fidelity Verified"}
              </h3>
              <Badge
                variant={
                  criticalIssuesCount > 0
                    ? "destructive"
                    : warningIssuesCount > 0
                    ? "warning"
                    : "success"
                }
              >
                {criticalIssuesCount > 0
                  ? "Requires Author Confirmation"
                  : warningIssuesCount > 0
                  ? "Inspect Warnings"
                  : "High Fidelity"}
              </Badge>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              {criticalIssuesCount > 0
                ? "Scientific certainty, statistical findings, or essential citations were altered. Inspect the items below before applying."
                : warningIssuesCount > 0
                ? `${warningIssuesCount} cautionary note(s) regarding altered quantities, hedging language, or technical descriptors.`
                : `All ${preservedTokensCount} invariant tokens (citations, DOIs, equations, numbers, units) verified across original and revised text.`}
            </p>
          </div>
        </div>

        {/* Right: Fidelity Index & Action */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Fidelity Index
            </span>
            <span
              className={`text-lg font-black ${
                score >= 85
                  ? "text-emerald-600 dark:text-emerald-400"
                  : score >= 60
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {score}/100
            </span>
          </div>

          {issues.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span>{isExpanded ? "Hide Details" : `Inspect Issues (${issues.length})`}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Issue Inspector */}
      {isExpanded && issues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Detected Invariance & Semantic Findings
          </h4>

          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  issue.severity === "critical"
                    ? "bg-rose-100/50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                    : issue.severity === "warning"
                    ? "bg-amber-100/50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        issue.severity === "critical"
                          ? "bg-rose-500"
                          : issue.severity === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <strong className="font-bold">{issue.title}</strong>
                  </div>

                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white/60 dark:bg-black/30">
                    {issue.category.replace("_", " ")}
                  </span>
                </div>

                <p className="leading-relaxed opacity-90">{issue.description}</p>

                {issue.originalSnippet && (
                  <div className="text-[11px] font-mono bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-slate-400 mr-2">Original:</span>
                    <span>{issue.originalSnippet}</span>
                  </div>
                )}

                {issue.suggestedFix && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] italic text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>{issue.suggestedFix}</span>
                    </div>

                    {onApplyFix && (
                      <button
                        type="button"
                        onClick={() => onApplyFix(issue)}
                        className="px-2 py-1 rounded text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                      >
                        Apply Fix
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ethical Disclaimer */}
      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p className="leading-tight">{disclaimer}</p>
      </div>
    </div>
  );
};
