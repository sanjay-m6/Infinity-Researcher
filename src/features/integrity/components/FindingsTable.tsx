import React, { useState, useMemo } from "react";
import {
  IntegrityFinding,
  IntegrityDimension,
  FindingStatus,
  FindingSeverity,
} from "../types";
import {
  CheckCircle2,
  AlertOctagon,
  Wrench,
  HelpCircle,
  Check,
  Search,
  MessageSquare,
  CornerDownRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface FindingsTableProps {
  findings: IntegrityFinding[];
  selectedDimension: IntegrityDimension | "all";
  onSelectDimension: (dim: IntegrityDimension | "all") => void;
  onToggleReviewed: (findingId: string, isReviewed: boolean, notes?: string) => void;
}

export const FindingsTable: React.FC<FindingsTableProps> = ({
  findings,
  selectedDimension,
  onSelectDimension,
  onToggleReviewed,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      // Dimension filter
      if (selectedDimension !== "all" && f.dimension !== selectedDimension) {
        return false;
      }
      // Status filter
      if (statusFilter === "unreviewed" && f.isReviewed) return false;
      if (statusFilter === "reviewed" && !f.isReviewed) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "unreviewed" &&
        statusFilter !== "reviewed" &&
        f.status !== statusFilter
      ) {
        return false;
      }
      // Severity filter
      if (severityFilter !== "all" && f.severity !== severityFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          f.title.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.evidence.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          (f.reviewerNotes && f.reviewerNotes.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [findings, selectedDimension, statusFilter, severityFilter, searchQuery]);

  const getStatusBadge = (status: FindingStatus, isReviewed: boolean) => {
    if (isReviewed) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Reviewed
        </span>
      );
    }
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Verified Clean
          </span>
        );
      case "concern":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Integrity Concern
          </span>
        );
      case "technical_error":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            <Wrench className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Technical Error
          </span>
        );
      case "inconclusive":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Inconclusive
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: FindingSeverity) => {
    switch (sev) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
            Warning
          </span>
        );
      case "info":
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Info
          </span>
        );
    }
  };

  const handleSaveNotes = (id: string) => {
    const note = notesDraft[id] ?? "";
    onToggleReviewed(id, true, note);
    setExpandedNotesId(null);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Text Search */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings, evidence, location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Dimension Selector */}
          <select
            value={selectedDimension}
            onChange={(e) => onSelectDimension(e.target.value as IntegrityDimension | "all")}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Dimensions</option>
            <option value="similarity">Text Similarity</option>
            <option value="ai_signals">AI Statistical Signals</option>
            <option value="citations">Citation Consistency</option>
            <option value="references">Reference & DOI Metadata</option>
            <option value="readability">Linguistic Readability</option>
            <option value="structure">Document Structure</option>
            <option value="extraction">Extraction & OCR</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="unreviewed">Unreviewed Only</option>
            <option value="reviewed">Reviewed Only</option>
            <option value="concern">Concerns Found</option>
            <option value="verified">Verified Clean</option>
            <option value="technical_error">Technical Errors</option>
            <option value="inconclusive">Inconclusive</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredFindings.length}</span> of {findings.length} findings
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No matching findings
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status, or dimension filters to view other diagnostics.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isNoteExpanded = expandedNotesId === finding.id;
            const currentNote =
              notesDraft[finding.id] !== undefined
                ? notesDraft[finding.id]
                : finding.reviewerNotes || "";

            return (
              <div
                key={finding.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all shadow-xs ${
                  finding.isReviewed
                    ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 opacity-80"
                    : finding.status === "concern"
                    ? "border-rose-200 dark:border-rose-900/60 hover:border-rose-300"
                    : finding.status === "technical_error"
                    ? "border-sky-200 dark:border-sky-900/60 hover:border-sky-300"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {finding.dimension.replace("_", " ")}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    {getStatusBadge(finding.status, finding.isReviewed)}
                    {getSeverityBadge(finding.severity)}
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Location: <code className="text-slate-700 dark:text-slate-300 font-semibold">{finding.location}</code>
                    </span>
                  </div>

                  {/* Review Action Button */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={finding.isReviewed ? "outline" : "primary"}
                      size="sm"
                      onClick={() =>
                        onToggleReviewed(
                          finding.id,
                          !finding.isReviewed,
                          finding.reviewerNotes || undefined
                        )
                      }
                      className="text-xs py-1 px-2.5 h-7"
                    >
                      {finding.isReviewed ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-indigo-500" />
                          Mark Unreviewed
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          Mark as Reviewed
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNotesId(isNoteExpanded ? null : finding.id)
                      }
                      title="Reviewer notes"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Finding Title & Confidence */}
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {finding.title}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                    Confidence: <span className="text-slate-600 dark:text-slate-300">{finding.confidence}</span>
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                  {finding.description}
                </p>

                {/* Evidence Callout */}
                {finding.evidence && (
                  <div className="mb-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/60 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words leading-relaxed">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Identified Evidence:
                    </span>
                    {finding.evidence}
                  </div>
                )}

                {/* Suggested Action */}
                <div className="flex items-start gap-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-2.5 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
                  <CornerDownRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="leading-relaxed">
                    <strong className="font-semibold mr-1">Suggested Next Step:</strong>
                    {finding.suggestedAction}
                  </div>
                </div>

                {/* Reviewer Notes Section */}
                {(isNoteExpanded || finding.reviewerNotes) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        Auditor / Reviewer Notes
                        {finding.reviewedAt && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            (Reviewed on {new Date(finding.reviewedAt).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentNote}
                        onChange={(e) =>
                          setNotesDraft({ ...notesDraft, [finding.id]: e.target.value })
                        }
                        placeholder="Add verification context, author clarification, or resolution notes..."
                        className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSaveNotes(finding.id)}
                        className="text-xs h-7.5 px-3"
                      >
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
