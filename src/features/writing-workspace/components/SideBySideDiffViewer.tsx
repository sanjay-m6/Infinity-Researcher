import React, { useState, useMemo } from "react";
import { Columns, GitCompare, ListFilter, Check, X, Copy, Sparkles } from "lucide-react";
import { computeWordDiff, computeTextStatistics } from "../writingEngine";
import { Button } from "../../../components/ui/Button";

interface SideBySideDiffViewerProps {
  originalText: string;
  revisedText: string;
  onOriginalChange: (val: string) => void;
  onRevisedChange: (val: string) => void;
  onAcceptParagraph?: (index: number) => void;
  onRejectParagraph?: (index: number) => void;
  isProcessing: boolean;
  onCopyRevised: () => void;
  hasCopied: boolean;
}

export type DiffViewMode = "split" | "diff" | "paragraph";

export const SideBySideDiffViewer: React.FC<SideBySideDiffViewerProps> = ({
  originalText,
  revisedText,
  onOriginalChange,
  onRevisedChange,
  isProcessing,
  onCopyRevised,
  hasCopied,
}) => {
  const [viewMode, setViewMode] = useState<DiffViewMode>("split");

  const origStats = useMemo(() => computeTextStatistics(originalText), [originalText]);
  const revStats = useMemo(() => computeTextStatistics(revisedText), [revisedText]);

  // Word-level diff segments
  const diffSegments = useMemo(() => {
    if (!originalText || !revisedText) return [];
    return computeWordDiff(originalText, revisedText);
  }, [originalText, revisedText]);

  // Paragraph-by-paragraph breakdown
  const paragraphPairs = useMemo(() => {
    const origParas = originalText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const revParas = revisedText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const maxLen = Math.max(origParas.length, revParas.length);

    const pairs = [];
    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        index: i,
        orig: origParas[i] || "",
        rev: revParas[i] || "",
      });
    }
    return pairs;
  }, [originalText, revisedText]);

  return (
    <div className="flex flex-col space-y-3">
      {/* View Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === "split"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("diff")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === "diff"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Visual Diff</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("paragraph")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === "paragraph"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Paragraph Review</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <span>
            Original:{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {origStats.wordCount}
            </strong>{" "}
            words
          </span>
          <span>·</span>
          <span>
            Revised:{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {revStats.wordCount}
            </strong>{" "}
            words
            {revStats.wordCount > 0 && (
              <span
                className={`ml-1 text-[11px] font-semibold ${
                  revStats.wordCount >= origStats.wordCount
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                ({revStats.wordCount >= origStats.wordCount ? "+" : ""}
                {revStats.wordCount - origStats.wordCount})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* VIEW 1: SIDE-BY-SIDE SPLIT EDITORS */}
      {viewMode === "split" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Original Editor */}
          <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Original Source Manuscript
                </span>
                <span className="text-slate-400 font-medium">· Protected</span>
              </div>
              <span className="text-slate-400 font-mono">
                {origStats.wordCount} words · {origStats.charCount} chars
              </span>
            </div>

            <textarea
              value={originalText}
              onChange={(e) => onOriginalChange(e.target.value)}
              placeholder="Paste or type your draft manuscript, abstract, or methodology here..."
              rows={14}
              className="w-full flex-1 p-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm leading-relaxed font-sans resize-y focus:outline-hidden"
            />
          </div>

          {/* Right: Revised Editor */}
          <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Revised Scholarly Prose
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono">
                  {revStats.wordCount} words · {revStats.charCount} chars
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCopyRevised}
                  disabled={!revisedText}
                  className="h-7 text-xs"
                >
                  {hasCopied ? (
                    <Check className="w-3 h-3 text-emerald-500 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  <span>{hasCopied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <div className="relative flex-1">
              <textarea
                value={revisedText}
                onChange={(e) => onRevisedChange(e.target.value)}
                placeholder="Click 'Run Rewriter' to generate the academic revision. The revised text will appear here."
                rows={14}
                disabled={isProcessing}
                className="w-full h-full p-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm leading-relaxed font-sans resize-y focus:outline-hidden"
              />

              {isProcessing && (
                <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs flex items-center justify-center">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700">
                    <span className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Transforming scholarly text...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: VISUAL WORD DIFF */}
      {viewMode === "diff" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Token & Phrase Level Differences
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-200 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700" />
                <span>Removed / Replaced</span>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700" />
                <span>Added / Refined</span>
              </span>
            </div>
          </div>

          {!originalText || !revisedText ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              Provide original text and generate a revision to view word-level diff
              highlights.
            </p>
          ) : (
            <div className="text-sm leading-relaxed font-sans p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 whitespace-pre-wrap select-text">
              {diffSegments.map((segment, idx) => {
                if (segment.type === "added") {
                  return (
                    <mark
                      key={idx}
                      className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 px-1 py-0.5 rounded-xs underline decoration-emerald-500 font-medium"
                    >
                      {segment.value}
                    </mark>
                  );
                }
                if (segment.type === "removed") {
                  return (
                    <del
                      key={idx}
                      className="bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 px-1 py-0.5 rounded-xs line-through opacity-75 mr-0.5"
                    >
                      {segment.value}
                    </del>
                  );
                }
                return <span key={idx}>{segment.value}</span>;
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: PARAGRAPH-BY-PARAGRAPH REVIEW */}
      {viewMode === "paragraph" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Section & Paragraph Granular Review
            </span>
            <span className="text-slate-400">
              {paragraphPairs.length} paragraph block(s) detected
            </span>
          </div>

          <div className="space-y-4">
            {paragraphPairs.map((pair) => (
              <div
                key={pair.index}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono font-semibold">
                    Paragraph {pair.index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Accept this revised paragraph: replace original paragraph with revised
                        const origParas = originalText
                          .split(/\n\s*\n/)
                          .filter((p) => p.trim().length > 0);
                        origParas[pair.index] = pair.rev;
                        onOriginalChange(origParas.join("\n\n"));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept Revision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Reject this revised paragraph: keep original
                        const revParas = revisedText
                          .split(/\n\s*\n/)
                          .filter((p) => p.trim().length > 0);
                        revParas[pair.index] = pair.orig;
                        onRevisedChange(revParas.join("\n\n"));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Keep Original</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Original
                    </span>
                    <p className="text-slate-700 dark:text-slate-300">
                      {pair.orig || "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/50">
                    <span className="text-[10px] uppercase font-bold text-indigo-500 block mb-1">
                      Revised
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {pair.rev || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
