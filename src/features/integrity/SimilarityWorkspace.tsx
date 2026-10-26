import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  Quote,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";

import {
  SimilarityReport,
  SimilarityMatchWithSource,
  updateMatchReviewStatus,
} from "../../lib/desktop-api";

interface SimilarityWorkspaceProps {
  report: SimilarityReport;
  onBack: () => void;
  onRefreshReport?: () => void;
}

export const SimilarityWorkspace: React.FC<SimilarityWorkspaceProps> = ({
  report,
  onBack,
  onRefreshReport,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<SimilarityMatchWithSource | null>(
    report.matches.length > 0 ? report.matches[0] : null
  );
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showFormulaExplanation, setShowFormulaExplanation] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isUpdatingReview, setIsUpdatingReview] = useState(false);

  const documentViewerRef = useRef<HTMLDivElement>(null);

  // Sync selected match review notes
  useEffect(() => {
    if (selectedMatch) {
      setReviewNotes(selectedMatch.review_notes || "");
    }
  }, [selectedMatch]);

  const handleReviewAction = async (newStatus: string) => {
    if (!selectedMatch) return;
    setIsUpdatingReview(true);
    try {
      await updateMatchReviewStatus(selectedMatch.id, newStatus, reviewNotes.trim() || null);
      // Update local state
      setSelectedMatch((prev) =>
        prev
          ? {
              ...prev,
              review_status: newStatus as any,
              review_notes: reviewNotes.trim() || null,
            }
          : null
      );
      if (onRefreshReport) {
        onRefreshReport();
      }
    } catch (err: any) {
      alert("Failed to update review status: " + (err.message || String(err)));
    } finally {
      setIsUpdatingReview(false);
    }
  };

  const filteredMatches = report.matches.filter((m) => {
    if (reviewFilter !== "all" && m.review_status !== reviewFilter) return false;
    if (sourceFilter !== "all" && m.corpus_source_id !== sourceFilter) return false;
    return true;
  });

  // Extract unique sources for filter dropdown
  const uniqueSources = Array.from(
    new Map(report.matches.map((m) => [m.corpus_source_id, m.source_title])).entries()
  );

  const scrollToMatch = (match: SimilarityMatchWithSource) => {
    setSelectedMatch(match);
    const elem = document.getElementById(`target-span-${match.id}`);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const similarityPercentage = Math.round(report.run.overall_similarity_ratio * 100);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Workspace Top Navigation Bar */}
      <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              {report.document.file_name}
            </h2>
          </div>
        </div>

        {/* Honest Integrity Badge & Disclaimer */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Body Similarity:</span>
              <span
                className={`text-sm font-bold ${
                  similarityPercentage === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : similarityPercentage > 35
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {similarityPercentage}%
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              * Similarity score is not a verdict of misconduct
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Review Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-slate-200 dark:divide-slate-800">
        {/* Left Column: Outline, Filters & Match List */}
        <div className="w-80 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden shrink-0">
          {/* Summary Metric Tiles */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {similarityPercentage}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Overall Ratio</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {report.run.matched_sources_count}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Sources</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {report.matches.length}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Passages</div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Review Status:</span>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All ({report.matches.length})</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="marked_quote">Marked as Quote</option>
                <option value="citation_present">Citation Present</option>
                <option value="excluded_boilerplate">Boilerplate Excluded</option>
                <option value="not_a_match">Not a Match</option>
              </select>
            </div>

            {uniqueSources.length > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 max-w-[150px] truncate focus:outline-none"
                >
                  <option value="all">All Sources</option>
                  {uniqueSources.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Match List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredMatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No passages match current filter criteria.
              </div>
            ) : (
              filteredMatches.map((m, idx) => {
                const isSelected = selectedMatch?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => scrollToMatch(m)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Match #{idx + 1}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {m.match_type}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2 italic mb-2">
                      "{m.target_passage}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[140px] font-medium text-slate-500 dark:text-slate-400">
                        {m.source_title}
                      </span>
                      <span>{m.overlap_chars} chars</span>
                    </div>

                    {m.review_status !== "unreviewed" && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <BookmarkCheck className="w-3 h-3" />
                        {m.review_status.replace("_", " ")}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Submitted Document Viewer with Match Highlighting */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="h-10 px-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Document View &bull; {report.document.word_count.toLocaleString()} words &bull; ~
              {report.document.page_count} pages
            </span>
            <span className="text-[11px]">Click any highlighted passage to inspect evidence</span>
          </div>

          {/* Viewer Text Area */}
          <div
            ref={documentViewerRef}
            className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap selection:bg-emerald-100 dark:selection:bg-emerald-950"
          >
            {report.segments.length > 0 ? (
              report.segments.map((seg) => {
                // Check if this segment contains matches
                const segMatches = report.matches.filter(
                  (m) =>
                    m.target_char_start >= seg.char_start &&
                    m.target_char_start <= seg.char_end
                );

                return (
                  <div
                    key={seg.id}
                    className={`mb-4 relative ${
                      seg.segment_type === "section_heading"
                        ? "font-sans font-bold text-base text-slate-900 dark:text-white mt-6 mb-2"
                        : seg.segment_type === "abstract"
                        ? "italic bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800"
                        : ""
                    }`}
                  >
                    {seg.raw_text}

                    {/* Overlay Match Highlights if any */}
                    {segMatches.map((m) => {
                      const isSelected = selectedMatch?.id === m.id;
                      return (
                        <div
                          key={`match-tag-${m.id}`}
                          id={`target-span-${m.id}`}
                          onClick={() => setSelectedMatch(m)}
                          className={`mt-2 p-2 rounded-lg cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-amber-100/80 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 shadow-sm"
                              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 hover:border-amber-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold text-amber-800 dark:text-amber-300 mb-1">
                            <span>Highlighted Match ({m.overlap_chars} chars)</span>
                            <span>&bull; Source: {m.source_title}</span>
                          </div>
                          <span className="font-serif italic text-xs text-amber-900 dark:text-amber-100">
                            "{m.target_passage}"
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div>{report.document.raw_content}</div>
            )}
          </div>
        </div>

        {/* Right Column: Match Details & Review Controls */}
        <div className="w-96 flex flex-col bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden shrink-0">
          <div className="h-10 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Match Evidence & Review</span>
            {selectedMatch && (
              <span className="text-[10px] text-slate-400">
                Confidence: {Math.round(selectedMatch.confidence_score * 100)}%
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedMatch ? (
              <>
                {/* Source Metadata Card */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Matched Source
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {selectedMatch.source_title}
                  </h4>
                  {selectedMatch.source_authors && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedMatch.source_authors}
                    </div>
                  )}
                  {selectedMatch.source_doi && (
                    <div className="mt-2 flex items-center gap-1 text-xs font-mono text-indigo-600 dark:text-indigo-400">
                      <span>DOI: {selectedMatch.source_doi}</span>
                    </div>
                  )}
                  {selectedMatch.source_canonical_url && (
                    <a
                      href={selectedMatch.source_canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>Open Source URL</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Side-by-Side Comparison */}
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Target Document Passage</span>
                      <span className="text-[10px] text-slate-400">
                        Offset: {selectedMatch.target_char_start}–{selectedMatch.target_char_end}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-serif text-slate-800 dark:text-slate-200">
                      "{selectedMatch.target_passage}"
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Source Document Passage</span>
                      <span className="text-[10px] text-slate-400">
                        Offset: {selectedMatch.source_char_start}–{selectedMatch.source_char_end}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-serif text-slate-800 dark:text-slate-200">
                      "{selectedMatch.source_passage}"
                    </div>
                  </div>
                </div>

                {/* Review Decision Controls */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Annotate & Review Match
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReviewAction("marked_quote")}
                      disabled={isUpdatingReview}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        selectedMatch.review_status === "marked_quote"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Quote className="w-3.5 h-3.5" />
                      Mark as Quote
                    </button>

                    <button
                      onClick={() => handleReviewAction("citation_present")}
                      disabled={isUpdatingReview}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        selectedMatch.review_status === "citation_present"
                          ? "bg-blue-500 text-white border-blue-600"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      Citation Present
                    </button>

                    <button
                      onClick={() => handleReviewAction("excluded_boilerplate")}
                      disabled={isUpdatingReview}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        selectedMatch.review_status === "excluded_boilerplate"
                          ? "bg-slate-500 text-white border-slate-600"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Boilerplate
                    </button>

                    <button
                      onClick={() => handleReviewAction("not_a_match")}
                      disabled={isUpdatingReview}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                        selectedMatch.review_status === "not_a_match"
                          ? "bg-rose-500 text-white border-rose-600"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Not a Match
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Auditor / Author Notes:
                    </label>
                    <textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add commentary or justification..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Expandable How This Was Calculated */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <button
                    onClick={() => setShowFormulaExplanation(!showFormulaExplanation)}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      How Similarity Score Was Calculated
                    </span>
                    {showFormulaExplanation ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showFormulaExplanation && (
                    <div className="p-4 pt-1 text-xs text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-100 dark:border-slate-800">
                      <p>{report.formula_explanation}</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {report.corpus_coverage_note}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Select a match from the left list to view side-by-side evidence.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
