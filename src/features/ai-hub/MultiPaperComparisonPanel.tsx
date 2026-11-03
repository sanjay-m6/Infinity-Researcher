import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  AlertCircle,
  FileText,
  RefreshCw,
  AlertTriangle,
  Compass,
  BookOpen,
} from "lucide-react";
import type { Paper } from "../../types/domain";
import type {
  MultiPaperComparison,
  ResearchGapAnalysis,
  ResearchGap,
  VerifiedEvidence,
} from "../../lib/ai/types";
import {
  compareMultiplePapers,
  analyzeResearchGaps,
  NOVELTY_DISCLAIMER,
} from "../../lib/ai/paperUnderstandingEngine";
import type { CandidateChunk } from "../../lib/ai/evidenceValidator";
import { getPaperRagChunks } from "../../lib/desktop-api";
import { useApp } from "../../context/AppContext";
import { AITypingIndicator } from "../../components/loading";

interface MultiPaperComparisonPanelProps {
  papers: Paper[];
  onOpenPdfReader?: (pageNumber?: number) => void;
}

export const MultiPaperComparisonPanel: React.FC<MultiPaperComparisonPanelProps> = ({
  papers,
  onOpenPdfReader,
}) => {
  const { setReadingPaper, showToast } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    papers.slice(0, 2).map((p) => p.id)
  );
  const [activeMode, setActiveMode] = useState<"matrix" | "gaps">("matrix");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [comparisonData, setComparisonData] = useState<MultiPaperComparison | null>(null);
  const [gapData, setGapData] = useState<ResearchGapAnalysis | null>(null);

  const toggleSelectPaper = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(papers.map((p) => p.id));
  const clearSelection = () => setSelectedIds([]);

  const handleJumpToPage = (paperId: string, pageNumber: number, _snippet?: string) => {
    const target = papers.find((p) => p.id === paperId);
    if (target) {
      setReadingPaper(target);
      if (onOpenPdfReader) onOpenPdfReader(pageNumber);
      showToast(
        `Navigating to Page ${pageNumber} of "${target.title.slice(0, 30)}..."`,
        "info"
      );
    }
  };

  // Helper to load chunks for selected papers
  const loadSelectedPapersWithChunks = async () => {
    const targetPapers = papers.filter((p) => selectedIds.includes(p.id));
    const papersWithChunks: { id: string; title: string; chunks: CandidateChunk[] }[] = [];

    for (const p of targetPapers) {
      let chunks: CandidateChunk[];
      try {
        const rawChunks = await getPaperRagChunks(p.id);
        chunks = rawChunks.map((c) => ({
          id: c.id,
          paper_id: c.paper_id,
          content_text: c.content_text,
          page_number: c.page_number,
          section_heading: c.section_heading,
        }));
      } catch {
        // Fallback simulated chunk if unindexed
        chunks = [
          {
            id: `${p.id}_abstract`,
            paper_id: p.id,
            content_text: p.abstract || p.title,
            page_number: 1,
            section_heading: "Abstract",
          },
        ];
      }
      papersWithChunks.push({
        id: p.id,
        title: p.title,
        chunks,
      });
    }

    return papersWithChunks;
  };

  const runComparison = async () => {
    if (selectedIds.length < 2) {
      showToast("Please select at least 2 papers to perform comparative synthesis.", "warning");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const papersWithChunks = await loadSelectedPapersWithChunks();
      const res = await compareMultiplePapers(papersWithChunks);
      setComparisonData(res);
      showToast("Multi-paper comparison synthesis complete.", "success");
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to compare papers.");
    } finally {
      setIsLoading(false);
    }
  };

  const runGapAnalysis = async () => {
    if (selectedIds.length === 0) {
      showToast("Please select at least 1 paper to inspect research gaps.", "warning");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const papersWithChunks = await loadSelectedPapersWithChunks();
      const res = await analyzeResearchGaps(papersWithChunks);
      setGapData(res);
      showToast("Research gap analysis complete.", "success");
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to analyze research gaps.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderEvidenceBadges = (paperId: string, evidenceList?: VerifiedEvidence[]) => {
    if (!evidenceList || evidenceList.length === 0) return null;
    return (
      <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          {evidenceList.map((ev, i) => (
            <button
              key={`${ev.chunk_id}_${i}`}
              onClick={() => handleJumpToPage(paperId, ev.page_number, ev.snippet)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 shadow-2xs"
              title={ev.snippet}
            >
              <FileText className="w-3 h-3 text-slate-400" />
              p. {ev.page_number}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Paper Multi-Selector Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              Select papers to compare ({selectedIds.length} selected)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select 2 or more papers to generate an evidence-isolated comparative matrix or gap analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Select All
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={clearSelection}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Paper Chips */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
          {papers.map((p) => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-slate-100/90 border-slate-300 dark:bg-slate-800/90 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-medium"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectPaper(p.id)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                />
                <div className="truncate flex-1">
                  <div className="font-semibold truncate">{p.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                    {p.year || "Year unknown"} · {Array.isArray(p.authors) ? p.authors.join(", ") : p.authors || "Unknown authors"}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveMode("matrix")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeMode === "matrix"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Comparison Matrix
            </button>
            <button
              onClick={() => setActiveMode("gaps")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeMode === "gaps"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Research Gap Analysis
            </button>
          </div>

          <button
            onClick={() => (activeMode === "matrix" ? runComparison() : runGapAnalysis())}
            disabled={isLoading || (activeMode === "matrix" && selectedIds.length < 2)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {activeMode === "matrix" ? "Synthesize Comparison" : "Identify Research Gaps"}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading state with structured skeleton comparison matrix */}
      {isLoading && (
        <div className="space-y-4">
          <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <AITypingIndicator
              visible={isLoading}
              activityState="analyzing"
              context="comparison"
              statusMessage={`Synthesizing Evidence Across ${selectedIds.length} Papers (isolating citations & benchmarking claims)...`}
              variant="workspace"
            />
          </div>

          {/* Skeleton Dimensions & Evidence Matrix */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
              <div className="h-3 w-44 bg-indigo-200/70 dark:bg-indigo-800/60 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>

            {[1, 2].map((dimIdx) => (
              <div
                key={dimIdx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedIds.slice(0, 3).map((pId) => (
                    <div
                      key={pId}
                      className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      <div className="h-3 w-full bg-slate-200/70 dark:bg-slate-700/70 rounded animate-pulse" />
                      <div className="h-3 w-5/6 bg-slate-200/70 dark:bg-slate-700/70 rounded animate-pulse" />
                      <div className="pt-2 flex gap-1.5">
                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                        <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 1: COMPARISON MATRIX */}
      {!isLoading && activeMode === "matrix" && (
        <div className="space-y-4">
          {!comparisonData ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ready to Compare {selectedIds.length} Papers
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                Click &quot;Synthesize Comparison&quot; to build a dimension-by-dimension matrix with isolated citations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* High-level Synthesized Takeaway Card */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> High-Level Comparative Takeaway
                </div>
                <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                  {comparisonData.synthesized_takeaway}
                </p>
              </div>

              {/* Dimensions Accordion / Cards */}
              <div className="space-y-4">
                {comparisonData.dimensions.map((dim, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
                      <span>{dim.dimension}</span>
                    </h3>

                    {/* Per-Paper Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(dim.paper_values).map(([pId, cell]) => {
                        const title = comparisonData.paper_titles[pId] || pId;
                        const evidence = comparisonData.isolated_evidence[pId];
                        return (
                          <div
                            key={pId}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 flex flex-col justify-between"
                          >
                            <div>
                              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate mb-1">
                                {title}
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                {cell.summary}
                              </p>
                            </div>
                            {renderEvidenceBadges(pId, evidence)}
                          </div>
                        );
                      })}
                    </div>

                    {/* Consensus or Divergence callout */}
                    {dim.consensus_or_divergence && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          Synthesis:
                        </span>
                        <span>{dim.consensus_or_divergence}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: RESEARCH GAP ANALYSIS */}
      {!isLoading && activeMode === "gaps" && (
        <div className="space-y-4">
          {/* Prominent Novelty Disclaimer */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200 block mb-0.5">
                Collection Scope & Absolute Novelty Notice
              </span>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {NOVELTY_DISCLAIMER}
              </p>
            </div>
          </div>

          {!gapData ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Compass className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Identify Research Gaps Across Selected Papers
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                Examines unaddressed methodologies, dataset constraints, and conflicting findings grounded in paper text.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapData.identified_gaps.map((gap: ResearchGap, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 capitalize">
                          {gap.gap_type.replace(/_/g, " ")}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                        {gap.title}
                      </h4>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                        {gap.description}
                      </p>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 mb-3 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                          Scope Boundary:
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">{gap.scope_caveat}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 text-xs">
                        <span className="font-semibold text-indigo-900 dark:text-indigo-300 block mb-0.5">
                          Potential Investigation Protocol:
                        </span>
                        <span className="text-indigo-800 dark:text-indigo-200/90">
                          {gap.potential_investigation}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                      Grounded in: {gap.grounded_papers.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
