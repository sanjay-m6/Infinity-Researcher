import React, { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  Cpu,
  Sparkles,
} from "lucide-react";
import {
  AiSignalRun,
  IntegrityDocument,
  DocumentSegment,
  runAiSignalCheck,
} from "../../lib/desktop-api";


interface AiSignalWorkspaceProps {
  document: IntegrityDocument;
  segments: DocumentSegment[];
  existingRun: AiSignalRun | null;
  onBack: () => void;
  onRunCompleted: (run: AiSignalRun) => void;
}

export const AiSignalWorkspace: React.FC<AiSignalWorkspaceProps> = ({
  document,
  segments,
  existingRun,
  onBack,
  onRunCompleted,
}) => {
  const [currentRun, setCurrentRun] = useState<AiSignalRun | null>(existingRun);
  const [selectedModel, setSelectedModel] = useState<string>("baseline-statistical-v1");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeParagraphIdx, setActiveParagraphIdx] = useState<number | null>(null);

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const run = await runAiSignalCheck(document.id, selectedModel);
      setCurrentRun(run);
      onRunCompleted(run);
    } catch (err: any) {
      alert("Failed to run AI signal analysis: " + (err.message || String(err)));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case "low_ai_signal":
        return {
          label: "Low AI Signal (Typical Human Variation)",
          color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        };
      case "mixed_signals":
        return {
          label: "Mixed Stylometric Signals (Review Needed)",
          color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      case "elevated_ai_signal":
        return {
          label: "Elevated AI Stylometric Signal",
          color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        };
      case "insufficient_text":
        return {
          label: "Insufficient Text (<80 words)",
          color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700",
        };
      default:
        return {
          label: "Analysis Not Run",
          color: "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700",
        };
    }
  };

  const badge = currentRun
    ? getClassificationBadge(currentRun.signal_classification)
    : getClassificationBadge("not_run");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Top Bar */}
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
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI-Writing Signals (Experimental) &bull; {document.file_name}
          </h2>
        </div>

        {/* Model Execution Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="baseline-statistical-v1">
                Baseline Stylometric Model (Local Offline)
              </option>
              <option value="Hello-SimpleAI/chatgpt-detector-roberta" disabled>
                chatgpt-detector-roberta (Experimental / Optional)
              </option>
            </select>
          </div>

          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? "Evaluating Signals..." : currentRun ? "Re-evaluate" : "Analyze Signals"}
          </button>
        </div>
      </div>

      {/* Mandatory Uncertainty Disclosure Banner */}
      <div className="px-6 py-3 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <span className="font-bold">Strict Uncertainty Caveat: </span>
          AI origin classification models produce probabilistic estimates based on vocabulary distributions.
          They <span className="underline font-semibold">never constitute proof</span> of AI authorship or misconduct. Classifiers exhibit substantial false-positive rates on formal academic prose, ESL/EFL writing, and edited texts.
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Overall Assessment & Stylometric Gauges */}
        <div className="w-96 p-6 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 overflow-y-auto space-y-6 shrink-0">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Signal Classification
            </div>
            <div
              className={`p-4 rounded-xl border text-sm font-bold flex items-center justify-between ${badge.color}`}
            >
              <span>{badge.label}</span>
              {currentRun && currentRun.overall_signal_score !== null && (
                <span className="text-base font-mono">
                  {Math.round(currentRun.overall_signal_score * 100)}%
                </span>
              )}
            </div>
          </div>

          {currentRun && currentRun.status === "completed" && (
            <>
              {/* Signal Strength Gauge */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Relative Stylometric Uniformity</span>
                  <span className="font-mono">
                    {Math.round((currentRun.overall_signal_score || 0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                  <div className="w-1/3 bg-emerald-500/30" />
                  <div className="w-1/3 bg-amber-500/30" />
                  <div className="w-1/3 bg-indigo-500/30" />
                </div>
                <div
                  className="h-1.5 w-3 bg-slate-800 dark:bg-white rounded-full mx-auto transition-all"
                  style={{
                    transform: `translateX(${((currentRun.overall_signal_score || 0.5) - 0.5) * 200}px)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Human Variation</span>
                  <span>Mixed</span>
                  <span>Uniform Syntax</span>
                </div>
              </div>

              {/* Document Overview */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                  Analysis Provenance
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Evaluated Length:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {currentRun.analyzed_characters.toLocaleString()} chars
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Analyzed Paragraphs:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {currentRun.analyzed_paragraphs}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Execution Backend:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Local Device (100% Offline)
                  </span>
                </div>
              </div>

              {/* Evaluation Evidence & Limitations Box */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  Model Card & Limitations
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  The baseline model computes Shannon entropy, lexical burstiness, and sentence complexity standard deviation.
                  High burstiness indicates organic drafting rhythms, whereas synthetic generations tend to exhibit constrained coefficient of variation.
                </p>
              </div>
            </>
          )}

          {currentRun?.status === "insufficient_text" && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white mb-1">
                Insufficient Word Count
              </p>
              <p>
                This document contains {document.word_count} words. Origin classifier signals require at least 80 words of body text to establish statistical validity.
              </p>
            </div>
          )}
        </div>

        {/* Right: Paragraph Breakdown & Text Heatmap */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          <div className="h-10 px-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Paragraph-Level Signal Heatmap</span>
            <span>Click any paragraph to view localized stylometrics</span>
          </div>

          <div className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap space-y-4">
            {segments.map((seg, idx) => {
              const isSelected = activeParagraphIdx === idx;
              return (
                <div
                  key={seg.id}
                  onClick={() => setActiveParagraphIdx(idx)}
                  className={`p-3 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm"
                      : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 font-sans text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Paragraph #{idx + 1} &bull; {seg.segment_type}
                    </span>
                    {isSelected && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Inspecting Paragraph
                      </span>
                    )}
                  </div>
                  <p>{seg.raw_text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
