import React from "react";
import {
  FileSearch,
  Cpu,
  BookmarkCheck,
  ExternalLink,
  BookOpen,
  LayoutTemplate,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
} from "lucide-react";
import { IntegrityDimension, DimensionSummary, DimensionStatus } from "../types";

interface DimensionCardsProps {
  dimensions: Record<IntegrityDimension, DimensionSummary>;
  selectedDimension: IntegrityDimension | "all";
  onSelectDimension: (dim: IntegrityDimension | "all") => void;
}

const DIMENSION_ICONS: Record<IntegrityDimension, React.ReactNode> = {
  similarity: <FileSearch className="w-5 h-5 text-indigo-500" />,
  ai_signals: <Cpu className="w-5 h-5 text-purple-500" />,
  citations: <BookmarkCheck className="w-5 h-5 text-blue-500" />,
  references: <ExternalLink className="w-5 h-5 text-cyan-500" />,
  readability: <BookOpen className="w-5 h-5 text-emerald-500" />,
  structure: <LayoutTemplate className="w-5 h-5 text-amber-500" />,
  extraction: <FileCode className="w-5 h-5 text-rose-500" />,
};

export const DimensionCards: React.FC<DimensionCardsProps> = ({
  dimensions,
  selectedDimension,
  onSelectDimension,
}) => {
  const getStatusBadge = (status: DimensionStatus, label: string) => {
    switch (status) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {label}
          </span>
        );
      case "attention_needed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {label}
          </span>
        );
      case "concerns_found":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            {label}
          </span>
        );
      case "technical_issue":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            <Wrench className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            {label}
          </span>
        );
    }
  };

  const dimensionKeys: IntegrityDimension[] = [
    "similarity",
    "ai_signals",
    "citations",
    "references",
    "readability",
    "structure",
    "extraction",
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {dimensionKeys.map((dimKey) => {
        const dim = dimensions[dimKey];
        if (!dim) return null;
        const isSelected = selectedDimension === dimKey;

        return (
          <button
            key={dimKey}
            type="button"
            onClick={() => onSelectDimension(isSelected ? "all" : dimKey)}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              isSelected
                ? "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {DIMENSION_ICONS[dimKey]}
                </div>
                {getStatusBadge(dim.status, dim.statusLabel)}
              </div>

              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                {dim.label}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {dim.summaryText}
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {dim.findingsCount} findings
              </span>
              {dim.unreviewedCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {dim.unreviewedCount} unreviewed
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  All reviewed
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

