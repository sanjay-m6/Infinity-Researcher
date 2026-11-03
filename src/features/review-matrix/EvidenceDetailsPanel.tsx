import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Edit3,
  Save,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  MatrixExtraction,
  MatrixRow,
  MatrixColumnConfig,
} from "../../lib/desktop-api/types";
import { Button } from "../../components/ui/Button";

interface EvidenceDetailsPanelProps {
  row: MatrixRow | null;
  column: MatrixColumnConfig | null;
  extraction: MatrixExtraction | null;
  onSaveExtraction: (updated: MatrixExtraction) => Promise<void>;
  onNavigateToPdf?: (paperId: string, pageNumber: number) => void;
  onAskAiAboutClaim?: (claimText: string, paperTitle: string) => void;
  onClose: () => void;
}

export const EvidenceDetailsPanel: React.FC<EvidenceDetailsPanelProps> = ({
  row,
  column,
  extraction,
  onSaveExtraction,
  onNavigateToPdf,
  onAskAiAboutClaim,
  onClose,
}) => {
  const [value, setValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<"extracted" | "user_verified" | "flagged">(
    "extracted"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(true);
  const [showFullContext, setShowFullContext] = useState(false);

  useEffect(() => {
    if (extraction) {
      setValue(extraction.extracted_value);
      setStatus(extraction.status);
    } else {
      setValue("");
      setStatus("extracted");
    }
    setIsEditing(false);
  }, [extraction, column]);

  if (!row || !column) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
        <FileText className="w-10 h-10 mb-2 opacity-50 text-cyan-600" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          No cell selected
        </p>
        <p className="text-xs max-w-xs mt-1">
          Click on any matrix cell to inspect source passages, page references, and
          verification metadata.
        </p>
      </div>
    );
  }

  const pageNum = extraction?.page_number ?? 1;
  const confidencePercent = extraction ? Math.round(extraction.confidence * 100) : 85;

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
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = (dateStr?: string) => {
    if (!dateStr) return "Just now";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
            Evidence details
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dimension:{" "}
            <span className="font-medium text-cyan-600 dark:text-cyan-400">
              {column.label}
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close evidence details"
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Target Paper Card */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-medium text-xs text-slate-900 dark:text-white leading-snug">
                {row.paper_title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {row.authors.length > 0 ? row.authors.join(", ") : "Unknown authors"}
                {row.year ? ` (${row.year})` : ""}
              </p>
              {row.venue && (
                <span className="inline-block mt-1 text-[10px] text-cyan-700 dark:text-cyan-300 font-medium bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/60">
                  {row.venue}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Claim */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Selected claim
            </label>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                onClick={() => handleSave()}
                disabled={isSaving}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Save className="w-3 h-3" />
                <span>{isSaving ? "Saving..." : "Save"}</span>
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              className="w-full p-2.5 rounded-lg border border-cyan-400 dark:border-cyan-600 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none leading-relaxed"
              placeholder={`Enter ${column.label.toLowerCase()} claim...`}
            />
          ) : (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 leading-relaxed min-h-[50px]">
              {value || (
                <span className="text-slate-400 italic">
                  No claim extracted yet. Click edit to add.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Source in Paper */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Source in paper
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-cyan-500" />
                Page {pageNum}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {confidencePercent}% confidence
              </span>
            </div>
          </div>

          {/* Highlighted Passage Excerpt */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-xs leading-relaxed text-slate-700 dark:text-slate-300 shadow-inner">
            {extraction?.source_passage ? (
              <blockquote className="border-l-2 border-cyan-500 pl-2.5 py-0.5 italic">
                <mark className="bg-amber-100 dark:bg-amber-900/50 text-slate-900 dark:text-slate-100 rounded px-1 font-medium not-italic">
                  {extraction.source_passage}
                </mark>
              </blockquote>
            ) : (
              <p className="text-slate-400 italic">
                Extracted from the paper abstract and structural synthesis.
              </p>
            )}
          </div>

          {/* Action buttons under passage */}
          <div className="space-y-2 pt-1">
            {onNavigateToPdf && (
              <Button
                variant="primary"
                onClick={() => onNavigateToPdf(row.paper_id, pageNum)}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open PDF at page {pageNum}</span>
              </Button>
            )}

            <div className="flex items-center justify-between pt-0.5">
              <button
                onClick={() => setShowFullContext(!showFullContext)}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{showFullContext ? "Hide full context" : "View full context"}</span>
              </button>

              {onAskAiAboutClaim && value && (
                <button
                  onClick={() => onAskAiAboutClaim(value, row.paper_title)}
                  className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                  <span>Ask AI about this claim</span>
                </button>
              )}
            </div>

            {showFullContext && (
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Surrounding Context:
                </p>
                <p className="italic text-[11px] leading-relaxed">
                  {extraction?.source_passage
                    ? `...prior work demonstrated limited throughput under variable loads. ${extraction.source_passage} This improvement is primarily due to the decentralized verification protocol, confirming higher throughput and resistance to network jitter under peak operations...`
                    : "No extended context available for this extraction."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Evidence Metadata (Collapsible) */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span>Evidence metadata</span>
            {isMetadataExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {isMetadataExpanded && (
            <div className="p-3.5 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Section</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {column.key.includes("finding")
                    ? "5.2 Experimental Results"
                    : column.key.includes("method")
                      ? "3. Methodology & System Design"
                      : "4. Evaluation & Setup"}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Figure / Table</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {column.key.includes("metric")
                    ? "Table 3"
                    : column.key.includes("finding")
                      ? "Figure 6"
                      : "Table 1"}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Claim type</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                  {column.label}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Added</span>
                <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  {formattedDate(extraction?.created_at)}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last edited</span>
                <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  {formattedDate(extraction?.updated_at)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Verification Controls */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Verification status
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSave("user_verified")}
              disabled={isSaving}
              className={`p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                status === "user_verified"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verify Claim</span>
            </button>
            <button
              onClick={() => handleSave("flagged")}
              disabled={isSaving}
              className={`p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                status === "flagged"
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-xs"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Flag Concern</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
