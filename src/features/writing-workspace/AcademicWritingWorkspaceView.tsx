import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import {
  Sparkles,
  PenTool,
  RefreshCw,
  Undo2,
  Redo2,
  Download,
  Check,
  History,
  Shield,
  FileDown,
  Trash2,
} from "lucide-react";
import {
  WritingToolType,
  AnyWritingModeId,
  ToolModeOption,
  WritingProviderConfig,
  RevisionSnapshot,
  ValidationIssue,
} from "./types";
import {
  HUMANIZER_MODES,
  ACADEMIC_WRITING_MODES,
  PARAPHRASING_MODES,
  WRITING_PROVIDERS,
  WRITING_WORKSPACE_SAMPLES,
  executeRewritingTask,
  computeTextStatistics,
} from "./writingEngine";
import { validatePreservationAndSemantics } from "./tokenPreservationGuard";
import { SideBySideDiffViewer } from "./components/SideBySideDiffViewer";
import { TokenGuardBanner } from "./components/TokenGuardBanner";
import { RevisionHistoryDrawer } from "./components/RevisionHistoryDrawer";
import { PrivacyConfirmationModal } from "./components/PrivacyConfirmationModal";
import { AttributionNoticeBanner } from "./components/AttributionNoticeBanner";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import {
  saveWritingRevisionDb,
  listWritingRevisionsDb,
} from "../../lib/desktop-api";

interface AcademicWritingWorkspaceViewProps {
  toolId: WritingToolType;
}

export const AcademicWritingWorkspaceView: React.FC<AcademicWritingWorkspaceViewProps> = ({
  toolId,
}) => {
  const { papers, showToast } = useApp();

  // Mode List based on toolId
  const modeOptions: ToolModeOption[] = useMemo(() => {
    switch (toolId) {
      case "ai_humanizer":
        return HUMANIZER_MODES;
      case "academic_writing_assistant":
        return ACADEMIC_WRITING_MODES;
      case "paraphrasing_tool":
        return PARAPHRASING_MODES;
    }
  }, [toolId]);

  // Selected Mode
  const [selectedModeId, setSelectedModeId] = useState<AnyWritingModeId>(
    modeOptions[0].id
  );

  // Selected Provider
  const [selectedProvider, setSelectedProvider] = useState<WritingProviderConfig>(
    WRITING_PROVIDERS[0]
  );
  const [pendingRemoteProvider, setPendingRemoteProvider] = useState<WritingProviderConfig | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Working Text State
  const [originalText, setOriginalText] = useState<string>(
    WRITING_WORKSPACE_SAMPLES[toolId] || ""
  );
  const [revisedText, setRevisedText] = useState<string>("");

  // History Stack for Undo/Redo
  const [historyStack, setHistoryStack] = useState<{ orig: string; rev: string }[]>([
    { orig: WRITING_WORKSPACE_SAMPLES[toolId] || "", rev: "" },
  ]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);

  // Revision Snapshots
  const [snapshots, setSnapshots] = useState<RevisionSnapshot[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const sessionId = useMemo(() => `session_${toolId}`, [toolId]);

  // Load prior revisions from SQLite
  useEffect(() => {
    listWritingRevisionsDb(sessionId)
      .then((revs) => {
        if (revs && revs.length > 0) {
          const loaded: RevisionSnapshot[] = revs.map((r) => ({
            id: r.id,
            timestamp: new Date(r.created_at).getTime(),
            modeId: r.action_type as AnyWritingModeId,
            modeName: r.action_type.replace(/_/g, " "),
            toolType: toolId,
            originalText: r.original_text,
            revisedText: r.revised_text,
            wordCountDiff: 0,
            charCountDiff: 0,
            validationSummary: {
              passed: r.preserved_numbers_ok && r.preserved_citations_ok,
              criticalCount: 0,
              warningCount: 0,
              score: 100,
            },
            providerName: "Persisted History",
          }));
          setSnapshots(loaded);
        }
      })
      .catch((err) => console.warn("Failed to list writing revisions:", err));
  }, [sessionId, toolId]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("");

  // Confirmation Dialogs
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Update sample when toolId changes
  useEffect(() => {
    const sample = WRITING_WORKSPACE_SAMPLES[toolId] || "";
    setOriginalText(sample);
    setRevisedText("");
    setSelectedModeId(modeOptions[0].id);
    setHistoryStack([{ orig: sample, rev: "" }]);
    setHistoryPointer(0);
  }, [toolId, modeOptions]);

  // Push state to undo/redo stack
  const pushHistory = useCallback((orig: string, rev: string) => {
    setHistoryStack((prev) => {
      const upToCurrent = prev.slice(0, historyPointer + 1);
      return [...upToCurrent, { orig, rev }];
    });
    setHistoryPointer((prev) => prev + 1);
  }, [historyPointer]);

  // Handle Undo
  const handleUndo = () => {
    if (historyPointer > 0) {
      const nextPtr = historyPointer - 1;
      setHistoryPointer(nextPtr);
      setOriginalText(historyStack[nextPtr].orig);
      setRevisedText(historyStack[nextPtr].rev);
    }
  };

  // Handle Redo
  const handleRedo = () => {
    if (historyPointer < historyStack.length - 1) {
      const nextPtr = historyPointer + 1;
      setHistoryPointer(nextPtr);
      setOriginalText(historyStack[nextPtr].orig);
      setRevisedText(historyStack[nextPtr].rev);
    }
  };

  // Handle Original text edits
  const handleOriginalChange = (val: string) => {
    setOriginalText(val);
  };

  // Handle Revised text edits
  const handleRevisedChange = (val: string) => {
    setRevisedText(val);
  };

  // Run Semantic & Token Preservation Guard
  const validationResult = useMemo(() => {
    if (!originalText.trim() || !revisedText.trim()) return null;
    return validatePreservationAndSemantics(originalText, revisedText);
  }, [originalText, revisedText]);

  // Handle Provider Change with Privacy Check
  const handleProviderSelect = (prov: WritingProviderConfig) => {
    if (prov.requiresDataWarning) {
      setPendingRemoteProvider(prov);
      setIsPrivacyModalOpen(true);
    } else {
      setSelectedProvider(prov);
    }
  };

  // Execute Rewriter
  const handleRunRewriter = async () => {
    if (!originalText.trim()) {
      showToast("Please enter or load draft text before rewriting.", "warning");
      return;
    }

    setIsProcessing(true);
    setProcessingStage("Initializing Workspace Engine...");

    try {
      const output = await executeRewritingTask({
        text: originalText,
        toolType: toolId,
        modeId: selectedModeId,
        provider: selectedProvider,
        onProgress: (stage) => setProcessingStage(stage),
      });

      setRevisedText(output);
      pushHistory(originalText, output);

      // Validate and create revision snapshot
      const val = validatePreservationAndSemantics(originalText, output);
      const modeObj = modeOptions.find((m) => m.id === selectedModeId) || modeOptions[0];
      const origStats = computeTextStatistics(originalText);
      const revStats = computeTextStatistics(output);

      const snapshot: RevisionSnapshot = {
        id: `snap_${Date.now()}`,
        timestamp: Date.now(),
        modeId: selectedModeId,
        modeName: modeObj.label,
        toolType: toolId,
        originalText,
        revisedText: output,
        wordCountDiff: revStats.wordCount - origStats.wordCount,
        charCountDiff: revStats.charCount - origStats.charCount,
        validationSummary: {
          passed: val.passed,
          criticalCount: val.criticalIssuesCount,
          warningCount: val.warningIssuesCount,
          score: val.score,
        },
        providerName: selectedProvider.name,
      };

      setSnapshots((prev) => [snapshot, ...prev]);
      showToast(`Revision generated using "${modeObj.label}"`, "success");

      // Persist revision to SQLite
      saveWritingRevisionDb({
        id: snapshot.id,
        session_id: sessionId,
        revision_number: snapshots.length + 1,
        action_type: modeObj.id,
        original_text: originalText,
        revised_text: output,
        diff_summary: `Delta words: ${snapshot.wordCountDiff}, score: ${val.score}`,
        preserved_numbers_ok: !val.issues.some((i) => i.token?.type === "number"),
        preserved_citations_ok: !val.issues.some((i) => i.token?.type === "citation"),
        preserved_equations_ok: !val.issues.some((i) => i.token?.type === "equation"),
        preserved_dois_ok: !val.issues.some((i) => i.token?.type === "doi"),
        is_accepted: false,
        created_at: new Date(snapshot.timestamp).toISOString(),
      }).catch((e) => console.warn("Failed to persist revision to SQLite:", e));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Rewriting error: ${msg}`, "error");
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
    }
  };

  // Copy revised to clipboard
  const handleCopyRevised = () => {
    if (!revisedText) return;
    navigator.clipboard.writeText(revisedText);
    setHasCopied(true);
    showToast("Revised text copied to clipboard", "success");
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Replace Original with Revised (Guarded by ConfirmDialog)
  const handleConfirmReplace = () => {
    if (!revisedText) return;
    const newOrig = revisedText;
    setOriginalText(newOrig);
    setRevisedText("");
    pushHistory(newOrig, "");
    showToast("Original text updated with accepted revision.", "info");

    saveWritingRevisionDb({
      id: `accept_${Date.now()}`,
      session_id: sessionId,
      revision_number: snapshots.length + 1,
      action_type: "accept_revision",
      original_text: originalText,
      revised_text: newOrig,
      diff_summary: "Accepted revision into draft",
      preserved_numbers_ok: true,
      preserved_citations_ok: true,
      preserved_equations_ok: true,
      preserved_dois_ok: true,
      is_accepted: true,
      created_at: new Date().toISOString(),
    }).catch((e) => console.warn("Failed to persist revision acceptance:", e));
  };

  // Discard Revised
  const handleDiscardRevision = () => {
    setRevisedText("");
    pushHistory(originalText, "");
    showToast("Revision discarded.", "info");
  };

  // Restore previous snapshot
  const handleRestoreSnapshot = (snap: RevisionSnapshot) => {
    setOriginalText(snap.originalText);
    setRevisedText(snap.revisedText);
    pushHistory(snap.originalText, snap.revisedText);
    showToast(`Restored snapshot from ${snap.modeName}`, "info");
  };

  // Export functions
  const handleExportText = (format: "md" | "txt" | "report") => {
    let content = "";
    let mimeType = "text/plain";
    let extension: string = format;

    if (format === "txt") {
      content = revisedText || originalText;
    } else if (format === "md") {
      content = `# Academic Manuscript (${toolId})\n\n${revisedText || originalText}`;
    } else if (format === "report") {
      extension = "json";
      mimeType = "application/json";
      content = JSON.stringify(
        {
          tool: toolId,
          timestamp: new Date().toISOString(),
          mode: selectedModeId,
          provider: selectedProvider.name,
          validation: validationResult,
          original: originalText,
          revised: revisedText,
        },
        null,
        2
      );
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manuscript-${toolId}-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported document as .${extension}`, "success");
  };

  // Apply quick fix suggested by TokenGuard
  const handleApplyFix = (issue: ValidationIssue) => {
    if (issue.token && !revisedText.includes(issue.token.raw)) {
      setRevisedText((prev) => `${prev.trim()} ${issue.token!.raw}`);
      showToast(`Restored ${issue.token.type} "${issue.token.value}"`, "info");
    } else if (issue.id === "drift_correlation_causation") {
      setRevisedText((prev) =>
        prev
          .replace(/\bcauses\b/gi, "is associated with")
          .replace(/\bcaused by\b/gi, "correlated with")
          .replace(/\bcausation\b/gi, "correlation")
      );
      showToast("Replaced causative phrasing with correlational phrasing.", "info");
    } else if (issue.id === "drift_significance_inverted") {
      setRevisedText((prev) =>
        prev.replace(/\bstatistically significant\b/gi, "not statistically significant")
      );
      showToast("Restored negative qualifier to statistical significance.", "info");
    }
  };

  // Tool Header Content
  const toolHeader = useMemo(() => {
    switch (toolId) {
      case "ai_humanizer":
        return {
          title: "AI Humanizer & Scholarly Flow",
          subtitle:
            "Restructure monotonous machine cadence and repetitive sentence structures into authentic peer-reviewed scholarly syntax.",
          icon: Sparkles,
          iconColor: "text-purple-600 dark:text-purple-400",
          iconBg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
          disclaimer:
            "Ethical Guardrail: This workspace improves natural rhythm, clarity, and scholarly syntax. It is NOT designed, guaranteed, or intended to bypass AI detectors or plagiarism detection systems.",
        };
      case "academic_writing_assistant":
        return {
          title: "Academic Writing Assistant",
          subtitle:
            "Section-by-section scholarly manuscript polishing, argument structuring, and peer-review preparation.",
          icon: PenTool,
          iconColor: "text-sky-600 dark:text-sky-400",
          iconBg: "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800",
          disclaimer:
            "Manuscript Integrity: Users must provide source material and verify disciplinary accuracy of all generated statements.",
        };
      case "paraphrasing_tool":
        return {
          title: "Academic Paraphrasing & Restatement",
          subtitle:
            "Synthesize and rephrase literature concepts with strict preservation of citations, mathematical formulas, and scientific certainty.",
          icon: RefreshCw,
          iconColor: "text-emerald-600 dark:text-emerald-400",
          iconBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
          disclaimer:
            "Attribution Standard: Paraphrasing alters syntax and structure but requires formal attribution of the original author's intellectual ideas under academic integrity rules.",
        };
    }
  }, [toolId]);

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Tool Master Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl border shrink-0 ${toolHeader.iconBg} ${toolHeader.iconColor}`}
            >
              <toolHeader.icon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {toolHeader.title}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {modeOptions.length} Modes
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                {toolHeader.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            {/* Undo / Redo */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyPointer === 0}
                title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyPointer >= historyStack.length - 1}
                title="Redo (Ctrl+Y)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Revision History Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="text-xs h-9 gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {snapshots.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                  {snapshots.length}
                </span>
              )}
            </Button>

            {/* Export Dropdown */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportText("md")}
                title="Export as Markdown"
                className="text-xs h-9 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Ethical Warning Banner */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Shield className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
          <p className="leading-snug">{toolHeader.disclaimer}</p>
        </div>

        {/* Paraphrasing Specific Attribution Notice */}
        {toolId === "paraphrasing_tool" && (
          <AttributionNoticeBanner originalText={originalText} />
        )}
      </div>

      {/* 2. Controls & Mode Selection Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode Selector */}
          <div className="flex-1 space-y-1.5">
            <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
              Rewriting Mode ({modeOptions.length} available)
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {modeOptions.map((mode) => {
                const isSelected = selectedModeId === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedModeId(mode.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60"
                    }`}
                  >
                    <span>{mode.label}</span>
                    {mode.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                        }`}
                      >
                        {mode.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Provider & Execution Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Provider Selector */}
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                Execution Engine
              </span>
              <select
                value={selectedProvider.id}
                onChange={(e) => {
                  const prov = WRITING_PROVIDERS.find((p) => p.id === e.target.value);
                  if (prov) handleProviderSelect(prov);
                }}
                className="text-xs font-medium px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-hidden cursor-pointer"
              >
                {WRITING_PROVIDERS.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name} ({prov.isLocal ? "Local" : "Remote"})
                  </option>
                ))}
              </select>
            </div>

            {/* Run Button */}
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-transparent select-none block">
                Action
              </span>
              <Button
                variant="primary"
                size="md"
                onClick={handleRunRewriter}
                isLoading={isProcessing}
                disabled={isProcessing || !originalText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 h-9 shadow-sm"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                <span>Run Rewriter</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Selected Mode Description Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            <strong>Active Strategy:</strong>{" "}
            {modeOptions.find((m) => m.id === selectedModeId)?.description}
          </p>

          <div className="flex items-center gap-2">
            {/* Load from Library dropdown */}
            {papers.length > 0 && (
              <select
                onChange={(e) => {
                  const p = papers.find((paper) => paper.id === e.target.value);
                  if (p) {
                    const text = `${p.title}\n\nAbstract:\n${p.abstract}`;
                    setOriginalText(text);
                    pushHistory(text, revisedText);
                    showToast(`Loaded "${p.title.slice(0, 40)}..."`, "info");
                  }
                }}
                defaultValue=""
                className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                <option value="" disabled>
                  Load Paper from Library...
                </option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.slice(0, 45)}...
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                const sample = WRITING_WORKSPACE_SAMPLES[toolId];
                setOriginalText(sample);
                pushHistory(sample, revisedText);
                showToast("Sample text loaded", "info");
              }}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Reload Sample
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={() => {
                setOriginalText("");
                setRevisedText("");
                pushHistory("", "");
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 cursor-pointer"
            >
              Clear Workspace
            </button>
          </div>
        </div>

        {/* Progress Stage Status */}
        {isProcessing && (
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
            <span className="font-semibold">{processingStage || "Transforming manuscript..."}</span>
          </div>
        )}
      </div>

      {/* 3. Token Preservation Guard & Semantic Fidelity Banner */}
      {validationResult && (
        <TokenGuardBanner
          validation={validationResult}
          onApplyFix={handleApplyFix}
        />
      )}

      {/* 4. Side-By-Side Comparison, Diff & Granular Paragraph Inspection */}
      <SideBySideDiffViewer
        originalText={originalText}
        revisedText={revisedText}
        onOriginalChange={handleOriginalChange}
        onRevisedChange={handleRevisedChange}
        isProcessing={isProcessing}
        onCopyRevised={handleCopyRevised}
        hasCopied={hasCopied}
      />

      {/* 5. Revision Actions Bottom Bar */}
      {revisedText && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Revision Ready
            </span>
            <span>·</span>
            <span>Original text remains safe and unmodified until you explicitly confirm replacement.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardRevision}
              className="text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Discard Revision</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportText("report")}
              className="text-xs"
            >
              <FileDown className="w-3.5 h-3.5 mr-1" />
              <span>Validation Report (.json)</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsReplaceConfirmOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              <span>Accept & Replace Original</span>
            </Button>
          </div>
        </div>
      )}

      {/* 6. Revision History Drawer */}
      <RevisionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        snapshots={snapshots}
        onRestore={handleRestoreSnapshot}
        onClear={() => {
          setSnapshots([]);
          showToast("Revision history cleared", "info");
        }}
      />

      {/* 7. Privacy Confirmation Modal for Remote Cloud Providers */}
      <PrivacyConfirmationModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        onConfirm={() => {
          if (pendingRemoteProvider) {
            setSelectedProvider(pendingRemoteProvider);
            showToast(`Connected to ${pendingRemoteProvider.name}`, "info");
          }
        }}
        provider={pendingRemoteProvider}
      />

      {/* 8. Confirmation Dialog: Replace Original Text */}
      <ConfirmDialog
        isOpen={isReplaceConfirmOpen}
        onClose={() => setIsReplaceConfirmOpen(false)}
        onConfirm={handleConfirmReplace}
        title="Confirm Overwriting Original Text"
        message="Are you sure you want to replace your original draft with the revised text? This action can be undone via the Undo button or restored from Revision History."
        confirmLabel="Replace Original"
        cancelLabel="Keep Both"
        isDestructive={false}
      />
    </div>
  );
};
