import React from "react";
import { CitationAuditSummary } from "../types";

interface CitationSummaryCardsProps {
  summary: CitationAuditSummary;
}

export const CitationSummaryCards: React.FC<CitationSummaryCardsProps> = ({ summary }) => {
  const matchRate =
    summary.totalInTextCitations > 0
      ? Math.round(
          (summary.matchedCitationsCount / summary.totalInTextCitations) * 100
        )
      : 100;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Health Score */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Health Score
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-black ${
              summary.overallHealthScore >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : summary.overallHealthScore >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {summary.overallHealthScore}
          </span>
          <span className="text-xs text-slate-400 font-semibold">/100</span>
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          {summary.overallHealthScore >= 80
            ? "High Compliance"
            : summary.overallHealthScore >= 50
            ? "Issues Require Review"
            : "Critical Fixes Needed"}
        </span>
      </div>

      {/* 2. In-Text Citations */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          In-Text Citations
        </span>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
          {summary.totalInTextCitations}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          Match Rate: {matchRate}%
        </span>
      </div>

      {/* 3. References in Bib */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Bibliography
        </span>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
          {summary.totalUniqueReferences}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          Style: {summary.dominantStyle.toUpperCase()}
        </span>
      </div>

      {/* 4. Missing References (Orphans) */}
      <div
        className={`rounded-2xl border p-4 shadow-xs space-y-1 ${
          summary.orphanCitationsCount > 0
            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Missing References
        </span>
        <div
          className={`text-2xl font-black ${
            summary.orphanCitationsCount > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {summary.orphanCitationsCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          {summary.orphanCitationsCount === 0 ? "Zero Missing" : "Orphan Citations"}
        </span>
      </div>

      {/* 5. Uncited References */}
      <div
        className={`rounded-2xl border p-4 shadow-xs space-y-1 ${
          summary.uncitedReferencesCount > 0
            ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Uncited Entries
        </span>
        <div
          className={`text-2xl font-black ${
            summary.uncitedReferencesCount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {summary.uncitedReferencesCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          {summary.uncitedReferencesCount === 0 ? "All Cited" : "Never Cited in Body"}
        </span>
      </div>

      {/* 6. DOI Health */}
      <div
        className={`rounded-2xl border p-4 shadow-xs space-y-1 ${
          summary.malformedDoiCount > 0
            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          DOI Syntax & Verified
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {summary.verifiedDoiCount}
          </span>
          {summary.malformedDoiCount > 0 && (
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              ({summary.malformedDoiCount} bad)
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          {summary.malformedDoiCount > 0 ? "Malformed Syntax" : "Syntactically Sound"}
        </span>
      </div>
    </div>
  );
};
