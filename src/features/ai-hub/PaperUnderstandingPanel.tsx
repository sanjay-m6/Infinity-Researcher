import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Search,
  Scale,
  Award,
  Layers,
  HelpCircle,
} from "lucide-react";
import type { Paper } from "../../types/domain";
import type {
  StructuredPaperSummary,
  MethodologyAnalysis,
  ResultsAnalysis,
  LimitationsAnalysis,
  TerminologyExplanation,
  VerifiedEvidence,
} from "../../lib/ai/types";
import {
  generateStructuredSummary,
  generateMethodologyAnalysis,
  generateResultsAnalysis,
  generateLimitationsAnalysis,
  explainTerminology,
} from "../../lib/ai/paperUnderstandingEngine";
import type { CandidateChunk } from "../../lib/ai/evidenceValidator";
import { useApp } from "../../context/AppContext";
import { AITypingIndicator } from "../../components/loading";

type UnderstandingSubTab =
  "summary" | "methodology" | "results" | "limitations" | "terminology";

interface PaperUnderstandingPanelProps {
  activePaper?: Paper | null;
  paperChunks: CandidateChunk[];
  onOpenPdfReader?: (pageNumber?: number) => void;
}

export const PaperUnderstandingPanel: React.FC<PaperUnderstandingPanelProps> = ({
  activePaper,
  paperChunks,
  onOpenPdfReader,
}) => {
  const { setReadingPaper, showToast } = useApp();
  const [subTab, setSubTab] = useState<UnderstandingSubTab>("summary");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stored analysis states
  const [summaryData, setSummaryData] = useState<StructuredPaperSummary | null>(null);
  const [methodologyData, setMethodologyData] = useState<MethodologyAnalysis | null>(
    null
  );
  const [resultsData, setResultsData] = useState<ResultsAnalysis | null>(null);
  const [limitationsData, setLimitationsData] = useState<LimitationsAnalysis | null>(
    null
  );
  const [termQuery, setTermQuery] = useState("");
  const [termData, setTermData] = useState<TerminologyExplanation | null>(null);

  const handleJumpToPage = (pageNumber: number, snippet?: string) => {
    if (activePaper) {
      setReadingPaper(activePaper);
      if (onOpenPdfReader) onOpenPdfReader(pageNumber);
      showToast(
        `Navigating to Page ${pageNumber}${snippet ? ` ("${snippet.slice(0, 40)}...")` : ""}`,
        "info"
      );
    }
  };

  const runSummary = async (bypass = false) => {
    if (!activePaper) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await generateStructuredSummary(
        activePaper.id,
        activePaper.title,
        paperChunks,
        { bypassCache: bypass }
      );
      setSummaryData(res);
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to generate structured summary."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runMethodology = async () => {
    if (!activePaper) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await generateMethodologyAnalysis(
        activePaper.id,
        activePaper.title,
        paperChunks
      );
      setMethodologyData(res);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to analyze methodology.");
    } finally {
      setIsLoading(false);
    }
  };

  const runResults = async () => {
    if (!activePaper) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await generateResultsAnalysis(
        activePaper.id,
        activePaper.title,
        paperChunks
      );
      setResultsData(res);
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to extract results & metrics."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runLimitations = async () => {
    if (!activePaper) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await generateLimitationsAnalysis(
        activePaper.id,
        activePaper.title,
        paperChunks
      );
      setLimitationsData(res);
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to analyze paper limitations."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runTermExplanation = async (termToExplain?: string) => {
    const targetTerm = termToExplain || termQuery;
    if (!activePaper || !targetTerm.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await explainTerminology(
        targetTerm.trim(),
        activePaper.id,
        paperChunks
      );
      setTermData(res);
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to explain technical term."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run analysis when switching subtabs if not already fetched
  const handleTabChange = (newTab: UnderstandingSubTab) => {
    setSubTab(newTab);
    if (!activePaper) return;
    if (newTab === "summary" && !summaryData) runSummary();
    if (newTab === "methodology" && !methodologyData) runMethodology();
    if (newTab === "results" && !resultsData) runResults();
    if (newTab === "limitations" && !limitationsData) runLimitations();
  };

  const renderEvidenceBadges = (evidenceList: VerifiedEvidence[]) => {
    if (!evidenceList || evidenceList.length === 0) return null;
    return (
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-indigo-500" /> Grounded Evidence & Page
          Citations:
        </div>
        <div className="flex flex-wrap gap-2">
          {evidenceList.map((ev, i) => (
            <button
              key={`${ev.chunk_id}_${i}`}
              onClick={() => handleJumpToPage(ev.page_number, ev.snippet)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-2xs transition-all ${
                ev.is_verified
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100"
              }`}
              title={ev.snippet}
            >
              {ev.is_verified ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>Page {ev.page_number}</span>
              <span className="text-[10px] opacity-75">
                ({ev.verification_method.replace(/_/g, " ")})
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!activePaper) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <BookOpen className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No Paper Selected
        </h3>
        <p className="text-xs max-w-sm mt-1 text-slate-500">
          Select a research paper from your library to perform grounded synthesis,
          methodology inspection, and limitations extraction.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Paper Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 mb-1.5">
            <Sparkles className="w-3 h-3" /> Paper Understanding Engine
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {activePaper.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {Array.isArray(activePaper.authors)
              ? activePaper.authors.join(", ")
              : activePaper.authors || "Unknown authors"}{" "}
            · {activePaper.year || "Year unknown"} · {paperChunks.length} indexed chunks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (subTab === "summary") runSummary(true);
              else if (subTab === "methodology") runMethodology();
              else if (subTab === "results") runResults();
              else if (subTab === "limitations") runLimitations();
              else if (subTab === "terminology") runTermExplanation();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Re-Analyze Section
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: "summary", label: "Structured Summary", icon: FileText },
          { id: "methodology", label: "Methodology Deep-Dive", icon: Layers },
          { id: "results", label: "Results & Empirical Findings", icon: Award },
          { id: "limitations", label: "Limitations & Validity", icon: Scale },
          { id: "terminology", label: "Technical Terminology", icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as UnderstandingSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <AITypingIndicator
            visible={isLoading}
            activityState="analyzing"
            context="paper_understanding"
            statusMessage="Formulating Grounded Scientific Synthesis (matching chunks & extracting dimensions)..."
            variant="workspace"
          />
        </div>
      )}

      {/* SUBTAB 1: STRUCTURED SUMMARY */}
      {!isLoading && subTab === "summary" && (
        <div className="space-y-4">
          {!summaryData ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 mb-3">
                Structured summary has not been generated yet.
              </p>
              <button
                onClick={() => runSummary()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Generate Grounded Summary
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Core Problem Addressed
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {summaryData.core_problem}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Proposed Method
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {summaryData.proposed_method}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Primary Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {summaryData.primary_objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Key Scientific Contributions
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {summaryData.key_contributions.map((con, i) => (
                    <li key={i}>{con}</li>
                  ))}
                </ul>
              </div>

              <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Empirical Findings & Metrics
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {summaryData.empirical_findings.map((fin, i) => (
                    <li key={i}>{fin}</li>
                  ))}
                </ul>
                {renderEvidenceBadges(summaryData.evidence)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: METHODOLOGY DEEP-DIVE */}
      {!isLoading && subTab === "methodology" && (
        <div className="space-y-4">
          {!methodologyData ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 mb-3">
                Methodology analysis not generated yet.
              </p>
              <button
                onClick={() => runMethodology()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Inspect Methodology
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Study Design & Theoretical Framework
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 mb-2">
                  <strong>Design:</strong> {methodologyData.research_design}
                </p>
                {methodologyData.theoretical_framework && (
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <strong>Theory:</strong> {methodologyData.theoretical_framework}
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Reproducibility Assessment
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {methodologyData.reproducibility_assessment}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Datasets & Experimental Materials
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {methodologyData.datasets_or_materials.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Baseline Comparisons & Metrics
                </h3>
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <div>
                    <span className="font-semibold">Baselines:</span>{" "}
                    {methodologyData.baseline_comparisons.join(", ")}
                  </div>
                  <div>
                    <span className="font-semibold">Metrics:</span>{" "}
                    {methodologyData.evaluation_metrics.join(", ")}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Experimental Protocol & Execution Setup
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {methodologyData.experimental_protocol}
                </p>
                {renderEvidenceBadges(methodologyData.evidence)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: RESULTS & METRICS */}
      {!isLoading && subTab === "results" && (
        <div className="space-y-4">
          {!resultsData ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 mb-3">
                Empirical results not extracted yet.
              </p>
              <button
                onClick={() => runResults()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Extract Results & Metrics
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Metrics Table */}
              {resultsData.key_metrics && resultsData.key_metrics.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs overflow-x-auto">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
                    Extracted Performance Benchmarks
                  </h3>
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-2.5 rounded-l-lg">Metric Name</th>
                        <th className="p-2.5">Reported Value</th>
                        <th className="p-2.5">Baseline Value</th>
                        <th className="p-2.5 rounded-r-lg">Evaluation Context</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {resultsData.key_metrics.map((m, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        >
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">
                            {m.name}
                          </td>
                          <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                            {m.value}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {m.baseline_value || "—"}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            {m.context || "Standard test split"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Ablation & Component Analysis
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {resultsData.ablation_insights.map((ab, i) => (
                      <li key={i}>{ab}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Statistical Significance & Unexpected Findings
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                    <strong>Significance:</strong>{" "}
                    {resultsData.statistical_significance || "Not stated"}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {resultsData.unexpected_outcomes.map((un, i) => (
                      <li key={i}>{un}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {renderEvidenceBadges(resultsData.evidence)}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: LIMITATIONS ANALYSIS */}
      {!isLoading && subTab === "limitations" && (
        <div className="space-y-4">
          {!limitationsData ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 mb-3">
                Limitations analysis not generated yet.
              </p>
              <button
                onClick={() => runLimitations()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Inspect Paper Limitations
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Author-Acknowledged */}
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Author-Acknowledged
                    Limitations
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {limitationsData.author_acknowledged.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Inferred Methodological */}
                <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider mb-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Inferred Methodological
                    Vulnerabilities
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {limitationsData.inferred_methodological.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Scope Boundaries */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Scope Boundaries & Unaddressed Contexts
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {limitationsData.inferred_scope_boundaries.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Computational Constraints */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Computational & Data Constraints
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {limitationsData.computational_or_data_constraints.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {renderEvidenceBadges(limitationsData.evidence)}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: TECHNICAL TERMINOLOGY */}
      {!isLoading && subTab === "terminology" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              Explain Technical Term from Paper
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. FlashAttention, LoRA, Contrastive Loss..."
                value={termQuery}
                onChange={(e) => setTermQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runTermExplanation();
                }}
                className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
              />
              <button
                onClick={() => runTermExplanation()}
                disabled={!termQuery.trim() || isLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Explain Term
              </button>
            </div>
          </div>

          {termData && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  Concept: {termData.term}
                </h3>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  How This Paper Defines It:
                </span>
                <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  {termData.paper_definition}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Simplified Plain-English Explanation:
                </span>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {termData.simplified_explanation}
                </p>
              </div>

              {termData.related_concepts && termData.related_concepts.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Related Concepts:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {termData.related_concepts.map((rc, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setTermQuery(rc);
                          runTermExplanation(rc);
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 dark:border-slate-700"
                      >
                        {rc}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {renderEvidenceBadges(termData.evidence)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
