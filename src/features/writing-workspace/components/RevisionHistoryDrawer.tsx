import React from "react";
import { History, RotateCcw, Clock, Trash2, X } from "lucide-react";
import { RevisionSnapshot } from "../types";
import { Button } from "../../../components/ui/Button";

interface RevisionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: RevisionSnapshot[];
  onRestore: (snapshot: RevisionSnapshot) => void;
  onClear: () => void;
}

export const RevisionHistoryDrawer: React.FC<RevisionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  snapshots,
  onRestore,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Revision History
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {snapshots.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                title="Clear all history"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List of snapshots */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {snapshots.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <Clock className="w-8 h-8 mx-auto stroke-1" />
              <p className="text-xs">No saved revisions yet.</p>
              <p className="text-[11px] max-w-xs mx-auto">
                Each time you run the rewriter, a snapshot with token validation results
                is safely archived here.
              </p>
            </div>
          ) : (
            snapshots.map((snap) => {
              const dateStr = new Date(snap.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={snap.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {snap.modeName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {dateStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {snap.providerName}
                    </span>
                    <span
                      className={`font-semibold ${
                        snap.wordCountDiff >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {snap.wordCountDiff >= 0
                        ? `+${snap.wordCountDiff}`
                        : snap.wordCountDiff}{" "}
                      words
                    </span>
                    <span>· Fidelity: {snap.validationSummary.score}%</span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic bg-white dark:bg-slate-900/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                    "{snap.revisedText.slice(0, 120)}..."
                  </p>

                  <div className="pt-1 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onRestore(snap);
                        onClose();
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore This Version</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
