import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Edit3,
  Save,
} from "lucide-react";
import { MatrixExtraction, MatrixRow, MatrixColumnConfig } from "../../lib/desktop-api/types";
import { Button } from "../../components/ui/Button";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row: MatrixRow | null;
  column: MatrixColumnConfig | null;
  extraction: MatrixExtraction | null;
  onSaveExtraction: (updated: MatrixExtraction) => Promise<void>;
  onNavigateToPdf?: (paperId: string, pageNumber: number) => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  row,
  column,
  extraction,
  onSaveExtraction,
  onNavigateToPdf,
}) => {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"extracted" | "user_verified" | "flagged">("extracted");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (extraction) {
      setValue(extraction.extracted_value);
      setStatus(extraction.status);
    } else {
      setValue("");
      setStatus("extracted");
    }
  }, [extraction]);

  if (!isOpen || !row || !column) return null;

  const handleSave = async (newStatus?: "extracted" | "user_verified" | "flagged") => {
    setIsSaving(true);
    try {
      const activeStatus = newStatus || status;
      const updated: MatrixExtraction = extraction
        ? {
            ...extraction,
            extracted_value: value,
            status: activeStatus,
            updated_at: new Date().toISOString(),
          }
        : {
            id: "",
            workspace_id: "default_matrix",
            paper_id: row.paper_id,
            field_key: column.key,
            extracted_value: value,
            confidence: 1.0,
            page_number: 1,
            char_offset_start: 0,
            char_offset_end: value.length,
            source_passage: null,
            status: activeStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

      await onSaveExtraction(updated);
      setStatus(activeStatus);
    } finally {
      setIsSaving(false);
    }
  };

  const pageNum = extraction?.page_number ?? 1;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Evidence & Claim Inspector
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dimension: <span className="font-medium text-slate-700 dark:text-slate-300">{column.label}</span>
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Source Paper Banner */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Target Paper
            </span>
            {row.year && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {row.year}
              </span>
            )}
          </div>
          <h4 className="font-medium text-sm text-slate-900 dark:text-white leading-snug">
            {row.paper_title}
          </h4>
          {row.authors.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {row.authors.join(", ")}
            </p>
          )}
        </div>

        {/* Supporting Evidence Passage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <FileText className="w-4 h-4 text-cyan-500" />
              <span>Supporting Source Passage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                Page {pageNum}
              </span>
              {extraction && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {Math.round(extraction.confidence * 100)}% Match
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 font-serif text-sm leading-relaxed text-slate-800 dark:text-slate-200 italic shadow-inner">
            {extraction?.source_passage ? (
              <span>"{extraction.source_passage}"</span>
            ) : (
              <span className="text-slate-400 italic">
                Extracted from abstract text and paper metadata.
              </span>
            )}
          </div>

          {onNavigateToPdf && (
            <button
              onClick={() => onNavigateToPdf(row.paper_id, pageNum)}
              className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Jump to Page {pageNum} in PDF Reader
            </button>
          )}
        </div>

        {/* Extracted Claim Value Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-slate-400" />
              <span>Extracted Claim / Synthesis</span>
            </label>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                status === "user_verified"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                  : status === "flagged"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {status === "user_verified" ? "User Verified" : status === "flagged" ? "Flagged for Review" : "Automated Extraction"}
            </span>
          </div>

          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none"
            placeholder={`Enter or edit ${column.label.toLowerCase()}...`}
          />
        </div>

        {/* Verification Status Controls */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Review Status
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={status === "user_verified" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleSave("user_verified")}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Verify Claim</span>
            </Button>
            <Button
              variant={status === "flagged" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleSave("flagged")}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Flag Concern</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Changes persist to local SQLite
        </span>
        <Button
          variant="primary"
          onClick={() => handleSave()}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Saving..." : "Save Value"}</span>
        </Button>
      </div>
    </div>
  );
};
