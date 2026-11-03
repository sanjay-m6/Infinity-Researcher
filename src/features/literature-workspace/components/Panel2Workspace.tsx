import React from "react";
import {
  TableProperties,
  GitCompare,
  Lightbulb,
  PenTool,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Download,
  ChevronRight,
} from "lucide-react";
import { useProjectWorkspace } from "../ProjectWorkspaceContext";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";

export const Panel2Workspace: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    surveyRows,
    selectedMatrixCell,
    selectMatrixCell,
    comparedPaperIds,
    toggleComparedPaper,
    papers,
    researchGaps,
    selectedGapId,
    selectGap,
    sections,
    activeSectionId,
    setActiveSectionId,
    selectedClaim,
    selectClaim,
    updateSectionContent,
    notes,
    assets,
    selectAsset,
    reviewAllPapersWithAi,
    isAiReviewingAll,
  } = useProjectWorkspace();

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* 1. Panel 2 Top Tab Switcher */}
      <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("survey")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "survey"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Survey Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "compare"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Comparison ({comparedPaperIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gaps")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "gaps"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-slate-500" />
            <span>Research Gaps ({researchGaps.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("writer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "writer"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Paper Writer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "notes"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes ({notes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("figures")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "figures"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Figures & Tables</span>
          </button>
        </div>

        {/* Global Export Trigger */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 shrink-0"
          onClick={() => {
            const jsonStr = JSON.stringify(surveyRows, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `literature_matrix_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          title="Export Literature Matrix"
        >
          <Download className="w-3 h-3 mr-1 text-slate-500" />
          Export
        </Button>
      </div>

      {/* 2. Main Tab Body Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {/* TAB 1: LITERATURE SURVEY MATRIX */}
        {activeTab === "survey" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Literature Survey Matrix</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-normal tabular-nums">
                    {surveyRows.length} papers indexed
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every cell is grounded in verbatim source evidence. Click any entry to inspect its originating passage and page in Panel 3.
                </p>
              </div>

              {papers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isAiReviewingAll || papers.length === 0}
                    onClick={() => reviewAllPapersWithAi()}
                    className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 font-medium shadow-xs"
                    title="Automatically analyze all papers in your collection and populate the survey matrix"
                  >
                    {isAiReviewingAll ? (
                      <Sparkles className="w-3 h-3 mr-1.5 animate-spin" />
                    ) : (
                      <FileText className="w-3 h-3 mr-1.5" />
                    )}
                    {isAiReviewingAll ? "Synthesizing all papers..." : "AI Review All"}
                  </Button>
                </div>
              )}
            </div>

            {/* Matrix Table or Empty State */}
            {surveyRows.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto">
                  <TableProperties className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Literature Survey Matrix is empty
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                    {papers.length > 0
                      ? `${papers.length} papers in your collection are ready for synthesis. Run AI Review to extract research objectives, methodology, datasets, results, and grounded verbatim evidence.`
                      : "No papers in this collection yet. Import papers from your Library or Discover tab to begin literature synthesis."}
                  </p>
                </div>
                {papers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => reviewAllPapersWithAi()}
                    disabled={isAiReviewingAll}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-xs"
                  >
                    {isAiReviewingAll ? (
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    {isAiReviewingAll ? "Synthesizing papers with AI..." : `AI Review All (${papers.length} papers)`}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <th className="p-3 w-64">Paper</th>
                      <th className="p-3 w-64">Research objective</th>
                      <th className="p-3 w-64">Methodology</th>
                      <th className="p-3 w-60">Dataset</th>
                      <th className="p-3 w-60">Reported results</th>
                      <th className="p-3 w-64">Limitations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {surveyRows.map((row) => (
                      <tr key={row.paperId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Paper Title Column */}
                        <td className="p-3 align-top font-medium text-slate-900 dark:text-slate-100">
                          <div className="space-y-1">
                            <p className="line-clamp-2 leading-snug">{row.paperTitle}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-normal">
                              <span>{row.authors}</span>
                              <span>•</span>
                              <span className="font-mono tabular-nums">{row.year}</span>
                            </div>
                          </div>
                        </td>

                        {/* Objective Column */}
                        <td
                          onClick={() => selectMatrixCell(row.paperId, "objective")}
                          className={`p-3 align-top cursor-pointer transition-colors ${
                            selectedMatrixCell?.paperId === row.paperId && selectedMatrixCell?.columnKey === "objective"
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-600 rounded-md"
                              : "hover:bg-slate-100/50"
                          }`}
                        >
                          <p className="line-clamp-3 leading-relaxed">{row.objective}</p>
                        </td>

                        {/* Methodology Column */}
                        <td
                          onClick={() => selectMatrixCell(row.paperId, "methodology")}
                          className={`p-3 align-top cursor-pointer transition-colors ${
                            selectedMatrixCell?.paperId === row.paperId && selectedMatrixCell?.columnKey === "methodology"
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-600 rounded-md"
                              : "hover:bg-slate-100/50"
                          }`}
                        >
                          <p className="line-clamp-3 leading-relaxed">{row.methodology}</p>
                        </td>

                        {/* Dataset Column */}
                        <td
                          onClick={() => selectMatrixCell(row.paperId, "dataset")}
                          className={`p-3 align-top cursor-pointer transition-colors ${
                            selectedMatrixCell?.paperId === row.paperId && selectedMatrixCell?.columnKey === "dataset"
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-600 rounded-md"
                              : "hover:bg-slate-100/50"
                          }`}
                        >
                          <p className="line-clamp-3 leading-relaxed">{row.dataset}</p>
                        </td>

                        {/* Results Column */}
                        <td
                          onClick={() => selectMatrixCell(row.paperId, "results")}
                          className={`p-3 align-top cursor-pointer transition-colors ${
                            selectedMatrixCell?.paperId === row.paperId && selectedMatrixCell?.columnKey === "results"
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-600 rounded-md"
                              : "hover:bg-slate-100/50"
                          }`}
                        >
                          <p className="line-clamp-3 leading-relaxed font-medium text-slate-800 dark:text-slate-200">
                            {row.results}
                          </p>
                        </td>

                        {/* Limitations Column */}
                        <td
                          onClick={() => selectMatrixCell(row.paperId, "limitations")}
                          className={`p-3 align-top cursor-pointer transition-colors ${
                            selectedMatrixCell?.paperId === row.paperId && selectedMatrixCell?.columnKey === "limitations"
                              ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-600 rounded-md"
                              : "hover:bg-slate-100/50"
                          }`}
                        >
                          <p className="line-clamp-3 leading-relaxed text-slate-600 dark:text-slate-400">
                            {row.limitations}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LITERATURE COMPARISON */}
        {activeTab === "compare" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Multi-Paper Dimensional Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Compare selected papers side by side across methodologies, sample sizes, and experimental divergence.
              </p>
            </div>

            {/* Paper Selection Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 mr-2">Compare papers:</span>
              {papers.map((p) => {
                const isSelected = comparedPaperIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleComparedPaper(p.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {p.title.slice(0, 30)}...
                  </button>
                );
              })}
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparedPaperIds.map((pid) => {
                const row = surveyRows.find((r) => r.paperId === pid);
                if (!row) return null;
                return (
                  <div
                    key={pid}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
                  >
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {row.paperTitle}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{row.authors}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Objective
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{row.objective}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Methodology
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {row.methodology}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Dataset & evaluation
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{row.dataset}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Reported results
                      </span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {row.results}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Reported limitations
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {row.limitations}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectMatrixCell(row.paperId, "objective")}
                      className="w-full text-xs h-7"
                    >
                      Inspect source evidence
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: RESEARCH GAPS */}
        {activeTab === "gaps" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Synthesized Potential Research Gaps
                </h2>
                <p className="text-xs text-slate-500">
                  Candidate gaps synthesized from explicit limitations and conflicting findings across project literature.
                </p>
              </div>
              <Badge variant="outline" size="sm" className="text-slate-500">
                Advisory gaps (local collection)
              </Badge>
            </div>

            <div className="space-y-3">
              {researchGaps.map((gap) => (
                <div
                  key={gap.id}
                  onClick={() => selectGap(gap.id)}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer bg-white dark:bg-slate-900 space-y-3 shadow-xs ${
                    selectedGapId === gap.id
                      ? "border-slate-400 dark:border-slate-600 ring-1 ring-slate-400"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-slate-500 shrink-0" />
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {gap.title}
                      </h3>
                    </div>
                    <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                      {gap.potentialConfidence.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {gap.description}
                  </p>

                  {/* Supporting Evidence Passages */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-medium text-slate-400 block">
                      Grounded literature excerpts:
                    </span>
                    {gap.evidencePassages.map((ev, i) => (
                      <div key={i} className="text-xs border-l-2 border-slate-300 dark:border-slate-600 pl-2.5 py-0.5 space-y-0.5">
                        <p className="italic text-slate-700 dark:text-slate-300">"{ev.passage}"</p>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                          — {ev.paperTitle}, p. {ev.page}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Suggested Research Question */}
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-slate-600 dark:text-slate-400">Research question:</span> {gap.suggestedResearchQuestion}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: RESEARCH PAPER WRITER */}
        {activeTab === "writer" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Evidence-Linked Academic Manuscript Editor
                </h2>
                <p className="text-xs text-slate-500">
                  Click any sentence to inspect supporting literature citations and empirical claims in Panel 3.
                </p>
              </div>

              {/* Section Selector */}
              <div className="flex items-center gap-1 text-xs">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSectionId(s.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      activeSectionId === s.id
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Manuscript Editor Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {activeSection.title}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {activeSection.content.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <textarea
                value={activeSection.content}
                onChange={(e) => updateSectionContent(activeSection.id, e.target.value)}
                rows={12}
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-relaxed font-sans resize-y focus:outline-hidden focus:border-slate-400"
                placeholder="Draft academic prose here..."
              />

              {/* Embedded Claims List */}
              {activeSection.claims.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    Evidence-linked statements in section:
                  </span>
                  {activeSection.claims.map((claim) => (
                    <div
                      key={claim.id}
                      onClick={() => selectClaim(claim)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                        selectedClaim?.id === claim.id
                          ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                          : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/50"
                      }`}
                    >
                      <p className="flex-1 text-slate-800 dark:text-slate-200">"{claim.text}"</p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium shrink-0">
                        <span>Inspect source</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: RESEARCH NOTES */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Project Research Notes & Excerpt Quotations
                </h2>
                <p className="text-xs text-slate-500">
                  Persistent notes, architectural decisions, and verbatim excerpts linked to source publications.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" size="sm" className="text-slate-500 text-[10px]">
                      {note.category}
                    </Badge>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {note.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {note.content}
                  </p>

                  {note.paperTitle && (
                    <div className="pt-1 text-[10px] text-slate-400 font-mono tabular-nums">
                      Source: {note.paperTitle} {note.pageNumber ? `(p. ${note.pageNumber})` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: FIGURES & TABLES */}
        {activeTab === "figures" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Extracted Figures & Structured Tables Gallery
              </h2>
              <p className="text-xs text-slate-500">
                Visual assets and empirical tables extracted directly from project papers with source attribution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => selectAsset(asset.id)}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {asset.title}
                    </span>
                    <Badge variant="outline" size="sm" className="font-mono tabular-nums text-[10px]">
                      p. {asset.pageNumber}
                    </Badge>
                  </div>

                  {asset.tableData ? (
                    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 text-[11px]">
                      <table className="w-full text-left font-mono tabular-nums">
                        <tbody>
                          {asset.tableData.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "bg-slate-100 dark:bg-slate-800 font-medium" : ""}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-1.5 border border-slate-200 dark:border-slate-700">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/60 font-mono text-xs text-slate-700 dark:text-slate-300 text-center">
                      {asset.contentSnippet}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 italic">
                    {asset.caption}
                  </p>

                  <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    {asset.attributionNotice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
