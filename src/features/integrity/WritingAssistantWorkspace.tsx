import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Check,
  Copy,
  ShieldCheck,
  Binary,
  Bookmark,
  Hash,
} from "lucide-react";

import {
  IntegrityDocument,
  WritingSession,
  WritingRevision,
  createWritingSession,
  generateWritingRevision,
  acceptWritingRevision,
  listWritingRevisions,
} from "../../lib/desktop-api";

interface WritingAssistantWorkspaceProps {
  document: IntegrityDocument;
  onBack: () => void;
}

const WRITING_MODES = [
  { id: "clarity", label: "Improve Clarity", desc: "Untangle convoluted syntax while keeping technical vocabulary" },
  { id: "academic_tone", label: "Academic Tone", desc: "Elevate informal expressions to formal scholarly prose" },
  { id: "concise", label: "Make Concise", desc: "Eliminate tautology and passive fillers" },
  { id: "grammar", label: "Grammar & Typos", desc: "Correct punctuation, spacing, and agreement" },
  { id: "transitions", label: "Improve Transitions", desc: "Strengthen logical flow between arguments" },
  { id: "structure", label: "Paragraph Structure", desc: "Reinforce topic and synthesis sentences" },
  { id: "abstract", label: "Abstract Polish", desc: "Harmonize context, methodology, and conclusions" },
  { id: "methodology", label: "Methodology Precision", desc: "Clarify experimental parameters and procedural steps" },
  { id: "results_discussion", label: "Results & Discussion", desc: "Sharpen empirical reporting without overclaiming" },
  { id: "conclusion", label: "Conclusion Framing", desc: "Synthesize contributions and future implications" },
  { id: "simplify", label: "Explain in Simpler Language", desc: "Clarify concepts for multidisciplinary readers" },
];

export const WritingAssistantWorkspace: React.FC<WritingAssistantWorkspaceProps> = ({
  document,
  onBack,
}) => {
  const [session, setSession] = useState<WritingSession | null>(null);
  const [revisions, setRevisions] = useState<WritingRevision[]>([]);
  const [currentRevision, setCurrentRevision] = useState<WritingRevision | null>(null);
  const [activeMode, setActiveMode] = useState<string>("academic_tone");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editableRevisionText, setEditableRevisionText] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Initialize or load writing session
  useEffect(() => {
    initSession();
  }, [document.id]);

  const initSession = async () => {
    try {
      const sess = await createWritingSession(document.id, `Session - ${document.file_name}`);
      setSession(sess);
      const revs = await listWritingRevisions(sess.id);
      setRevisions(revs);
      if (revs.length > 0) {
        const latest = revs[revs.length - 1];
        setCurrentRevision(latest);
        setEditableRevisionText(latest.revised_text);
      } else {
        setEditableRevisionText(document.normalized_content);
      }
    } catch (err: any) {
      alert("Failed to initialize writing assistant session: " + err.message);
    }
  };

  const handleGenerateRevision = async (modeId: string) => {
    if (!session) return;
    setIsGenerating(true);
    try {
      const rev = await generateWritingRevision(session.id, modeId, null);
      setRevisions((prev) => [...prev, rev]);
      setCurrentRevision(rev);
      setEditableRevisionText(rev.revised_text);
    } catch (err: any) {
      alert("Failed to generate revision: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptRevision = async () => {
    if (!currentRevision) return;
    try {
      await acceptWritingRevision(currentRevision.id);
      setCurrentRevision((prev) => (prev ? { ...prev, is_accepted: true } : null));
    } catch (err: any) {
      alert("Failed to accept revision: " + err.message);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(editableRevisionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDiffSummary = currentRevision?.diff_summary
    ? JSON.parse(currentRevision.diff_summary)
    : null;

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
            <Wand2 className="w-4 h-4 text-emerald-500" />
            Academic Writing Assistant &bull; {document.file_name}
          </h2>
        </div>

        {/* Local-Only Privacy & Provenance Indicator */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Local Processing Only &bull; Zero Cloud Leakage</span>
          </div>

          <button
            onClick={handleCopyToClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Draft"}
          </button>
        </div>
      </div>

      {/* Writing Modes Toolbar */}
      <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wider text-[10px]">
          Modes:
        </span>
        {WRITING_MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => {
                setActiveMode(mode.id);
                handleGenerateRevision(mode.id);
              }}
              disabled={isGenerating}
              title={mode.desc}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Protected Tokens Validation Strip */}
      {currentRevision && (
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Meaning Protection:
            </span>

            <div className="flex items-center gap-1 text-[11px]">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>Numbers & Units:</span>
              {currentRevision.preserved_numbers_ok ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Preserved
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Modified
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <Bookmark className="w-3 h-3 text-slate-400" />
              <span>Citations:</span>
              {currentRevision.preserved_citations_ok ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Preserved
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Dropped
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <Binary className="w-3 h-3 text-slate-400" />
              <span>Equations:</span>
              {currentRevision.preserved_equations_ok ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Preserved
                </span>
              ) : (
                <span className="text-amber-600 font-semibold">Modified</span>
              )}
            </div>
          </div>

          {currentDiffSummary && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Net Word Change:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentDiffSummary.net_word_change > 0 ? "+" : ""}
                {currentDiffSummary.net_word_change} words
              </span>
            </div>
          )}
        </div>
      )}

      {/* Epistemic Meaning Risk Alert */}
      {currentRevision?.meaning_risk_flags && (
        <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            <strong className="font-semibold">Meaning Review Warning: </strong>
            {currentRevision.meaning_risk_flags}
          </span>
        </div>
      )}

      {/* Side-by-Side Comparison Editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-slate-200 dark:divide-slate-800">
        {/* Left: Original Immutable Draft */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
          <div className="h-9 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Original Source Draft (Immutable)</span>
            <span className="text-[11px] lowercase text-slate-400">read-only</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 font-serif leading-relaxed text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap select-text">
            {document.normalized_content}
          </div>
        </div>

        {/* Right: Proposed Academic Revision (Editable & Reviewable) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          <div className="h-9 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <span>Proposed Revision</span>
              {currentRevision && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Revision #{currentRevision.revision_number} of {revisions.length} &bull; {currentRevision.action_type}
                </span>
              )}

            </span>

            {currentRevision && (
              <div className="flex items-center gap-2">
                {currentRevision.is_accepted ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accepted
                  </span>
                ) : (
                  <button
                    onClick={handleAcceptRevision}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Accept Revision
                  </button>
                )}
              </div>
            )}
          </div>

          <textarea
            value={editableRevisionText}
            onChange={(e) => setEditableRevisionText(e.target.value)}
            disabled={isGenerating}
            placeholder={isGenerating ? "Generating revision..." : "Proposed text will appear here..."}
            className="flex-1 p-6 font-serif leading-relaxed text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
