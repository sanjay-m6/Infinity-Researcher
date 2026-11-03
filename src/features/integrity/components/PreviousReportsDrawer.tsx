import React, { useEffect, useState } from "react";
import { UnifiedIntegrityReport } from "../types";
import { loadSavedReportsFromStorage, deleteReportFromStorage } from "../reportStore";
import {
  History,
  X,
  Trash2,
  FileText,
  AlertOctagon,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface PreviousReportsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReport: (report: UnifiedIntegrityReport) => void;
  onToast: (msg: string, type: "success" | "info" | "warning" | "error") => void;
}

export const PreviousReportsDrawer: React.FC<PreviousReportsDrawerProps> = ({
  isOpen,
  onClose,
  onSelectReport,
  onToast,
}) => {
  const [savedReports, setSavedReports] = useState<UnifiedIntegrityReport[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSavedReports(loadSavedReportsFromStorage());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteReportFromStorage(id);
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
    onToast("Audit report removed from saved storage.", "info");
  };

  const handleSelect = (report: UnifiedIntegrityReport) => {
    onSelectReport(report);
    onClose();
    onToast(`Loaded audit for "${report.fileName}"`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-md h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Saved Integrity Audits
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {savedReports.length === 0 ? (
            <div className="text-center py-12 px-4">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No saved audit reports yet.
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Audits you run can be saved locally to review and track findings over
                time.
              </p>
            </div>
          ) : (
            savedReports.map((r) => {
              const concernsCount = r.findings.filter(
                (f) => f.status === "concern" && !f.isReviewed
              ).length;
              const reviewedCount = r.findings.filter((f) => f.isReviewed).length;

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl p-3.5 transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">
                        {r.fileName}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(r.id, e)}
                      title="Delete saved report"
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                    {r.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(r.analyzedAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span>{r.findings.length} findings</span>
                    {concernsCount > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5">
                        <AlertOctagon className="w-3 h-3" />
                        {concernsCount} concerns
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Clean
                      </span>
                    )}
                    {reviewedCount > 0 && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        ({reviewedCount} reviewed)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>{savedReports.length} stored audit(s)</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
