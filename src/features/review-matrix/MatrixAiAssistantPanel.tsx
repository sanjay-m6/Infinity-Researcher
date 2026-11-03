import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  Copy,
  Check,
  FileText,
  BookmarkPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  X,
  Layers,
  FileCheck,
} from "lucide-react";
import {
  EvidenceCopilotMessage,
  EvidenceSource,
  MatrixRow,
  MatrixColumnConfig,
  MatrixExtraction,
} from "../../lib/desktop-api/types";
import * as desktopApi from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { AITypingIndicator } from "../../components/loading";
import { LiveOrb } from "../../components/ui/live-orb";
import { MarkdownMessage } from "../../components/ui/MarkdownMessage";

export type ContextScope = "entire_matrix" | "selected_paper" | "selected_cell" | "filtered";

interface MatrixAiAssistantPanelProps {
  workspaceId: string;
  rows: MatrixRow[];
  columns: MatrixColumnConfig[];
  selectedPaper?: MatrixRow | null;
  selectedCell?: {
    row: MatrixRow;
    col: MatrixColumnConfig;
    extraction: MatrixExtraction | null;
  } | null;
  hasFilterActive?: boolean;
  filteredRowCount?: number;
  onNavigateToPdf?: (paperId: string, pageNumber: number) => void;
  onClose: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const MatrixAiAssistantPanel: React.FC<MatrixAiAssistantPanelProps> = ({
  workspaceId,
  rows,
  columns: _columns,
  selectedPaper,
  selectedCell,
  hasFilterActive = false,
  filteredRowCount,
  onNavigateToPdf,
  onClose,
}) => {
  const [messages, setMessages] = useState<EvidenceCopilotMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeScope, setActiveScope] = useState<ContextScope>("entire_matrix");
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedCitationsId, setCopiedCitationsId] = useState<string | null>(null);
  const [savedNoteMsgId, setSavedNoteMsgId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sessionId = `session_matrix_${workspaceId || "default_matrix"}`;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-suggest switching scope when user selects a cell
  useEffect(() => {
    if (selectedCell) {
      setActiveScope("selected_cell");
    }
  }, [selectedCell]);

  const loadMessages = useCallback(async () => {
    try {
      const history = await desktopApi.getEvidenceCopilotMessages(sessionId);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        setMessages([
          {
            id: "msg_welcome",
            session_id: sessionId,
            role: "assistant",
            content: `I am your AI Research Assistant grounded in this Literature Review Matrix (${rows.length} papers loaded). I can analyze findings, compare methodologies, detect research gaps, and audit extraction completeness with traceable citations directly linked to paper pages.`,
            evidence_sources_json: "[]",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.warn("Could not load copilot messages:", err);
    }
  }, [sessionId, rows.length]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    setInputQuery("");
    setIsLoading(true);

    const tempUserMsg: EvidenceCopilotMessage = {
      id: generateId("usr"),
      session_id: sessionId,
      role: "user",
      content: q,
      evidence_sources_json: "[]",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const targetPaperId =
        activeScope === "selected_paper" && selectedPaper
          ? selectedPaper.paper_id
          : activeScope === "selected_cell" && selectedCell
          ? selectedCell.row.paper_id
          : rows.length > 0
          ? rows[0].paper_id
          : null;

      const selectedPaperIds =
        activeScope === "selected_paper" && selectedPaper
          ? [selectedPaper.paper_id]
          : activeScope === "filtered"
          ? rows.map((r) => r.paper_id)
          : null;

      const selectedCellJson =
        activeScope === "selected_cell" && selectedCell
          ? JSON.stringify({
              paper_id: selectedCell.row.paper_id,
              paper_title: selectedCell.row.paper_title,
              dimension_key: selectedCell.col.key,
              dimension_label: selectedCell.col.label,
              extracted_value: selectedCell.extraction?.extracted_value || "",
              page_number: selectedCell.extraction?.page_number || null,
              confidence: selectedCell.extraction?.confidence || null,
              source_passage: selectedCell.extraction?.source_passage || null,
              status: selectedCell.extraction?.status || "extracted",
            })
          : null;

      const assistantMsg = await desktopApi.askEvidenceCopilot(
        sessionId,
        q,
        workspaceId,
        targetPaperId,
        activeScope,
        selectedPaperIds,
        selectedCellJson
      );

      if (!controller.signal.aborted) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        const abortedMsg: EvidenceCopilotMessage = {
          id: generateId("abort"),
          session_id: sessionId,
          role: "assistant",
          content: "Response generation was stopped.",
          evidence_sources_json: "[]",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, abortedMsg]);
      } else {
        const msg = desktopApi.getErrorMessage(err, "Failed to communicate with AI assistant.");
        const errorMsg: EvidenceCopilotMessage = {
          id: generateId("err"),
          session_id: sessionId,
          role: "assistant",
          content: `Error: ${msg}. Please ensure your matrix has extracted fields or try narrowing the scope.`,
          evidence_sources_json: "[]",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleClearHistory = async () => {
    try {
      await desktopApi.clearEvidenceCopilotMessages(sessionId);
      setMessages([
        {
          id: "msg_welcome",
          session_id: sessionId,
          role: "assistant",
          content: `Conversation cleared. How can I assist with your literature review analysis today?`,
          evidence_sources_json: "[]",
          created_at: new Date().toISOString(),
        },
      ]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Failed to clear messages:", err);
    }
  };

  const handleCopyResponse = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (err) {
      console.warn("Failed to copy response text:", err);
    }
  };

  const handleCopyCitations = async (msgId: string, evidenceList: EvidenceSource[]) => {
    if (!evidenceList || evidenceList.length === 0) return;
    const citationText = evidenceList
      .map(
        (ev, i) =>
          `[${i + 1}] ${ev.paper_title}${ev.page_number ? `, Page ${ev.page_number}` : ""}${
            ev.passage ? `: "${ev.passage}"` : ""
          }`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(citationText);
      setCopiedCitationsId(msgId);
      setTimeout(() => setCopiedCitationsId(null), 2000);
    } catch (err) {
      console.warn("Failed to copy citations:", err);
    }
  };

  const handleSaveAsNote = async (msgId: string, content: string) => {
    try {
      const targetPaperId =
        selectedPaper?.paper_id || (rows.length > 0 ? rows[0].paper_id : "matrix_workspace");

      await desktopApi.saveNote({
        paper_id: targetPaperId,
        title: `Matrix Review Synthesis (${new Date().toLocaleDateString()})`,
        content_markdown: content,
      });

      setSavedNoteMsgId(msgId);
      setTimeout(() => setSavedNoteMsgId(null), 2500);
    } catch (err) {
      console.error("Failed to save note:", err);
    }
  };

  const toggleEvidence = (msgId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Dynamic quick prompts based on matrix state and active scope
  const quickPrompts = (() => {
    if (activeScope === "selected_cell" && selectedCell) {
      return [
        `Evaluate the validity of this ${selectedCell.col.label.toLowerCase()} claim`,
        `How does this claim compare with other papers in the matrix?`,
        `What supporting methodology led to this result?`,
      ];
    }
    if (activeScope === "selected_paper" && selectedPaper) {
      return [
        `Summarize the key contributions and findings of this paper`,
        `What are the stated limitations and datasets in this study?`,
        `Compare this study's methodology against the rest of the matrix`,
      ];
    }
    return [
      "Compare the experimental results and key metrics across papers",
      "What datasets and sample sizes were evaluated?",
      "Identify common limitations and open research gaps",
      "Draft a structured literature review synthesis",
      "Audit matrix completeness and unverified claims",
    ];
  })();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <span>AI Research Assistant</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-medium">
                  Grounded
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authoritative synthesis from {rows.length} matrix papers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Clear conversation"
              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close assistant"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clear Confirmation Pill */}
        {showClearConfirm && (
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
            <span>Clear all messages in this session?</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="px-2 py-0.5 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 text-[11px]"
              >
                Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Context Scope Selector */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-500" />
              <span>Context Scope:</span>
            </span>
            <span className="text-slate-400">
              {activeScope === "entire_matrix"
                ? `${rows.length} papers`
                : activeScope === "selected_paper"
                ? selectedPaper?.paper_title.slice(0, 20) + "..."
                : activeScope === "selected_cell"
                ? selectedCell?.col.label
                : `${filteredRowCount ?? rows.length} filtered`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/60 rounded-lg text-[10px]">
            <button
              onClick={() => setActiveScope("entire_matrix")}
              className={`py-1 px-1.5 rounded-md font-medium text-center truncate transition-colors ${
                activeScope === "entire_matrix"
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Papers
            </button>
            <button
              onClick={() => setActiveScope("selected_paper")}
              disabled={!selectedPaper}
              title={!selectedPaper ? "Select a row in the matrix first" : selectedPaper.paper_title}
              className={`py-1 px-1.5 rounded-md font-medium text-center truncate transition-colors ${
                activeScope === "selected_paper"
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs"
                  : selectedPaper
                  ? "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              Paper
            </button>
            <button
              onClick={() => setActiveScope("selected_cell")}
              disabled={!selectedCell}
              title={!selectedCell ? "Click a cell in the matrix first" : selectedCell.col.label}
              className={`py-1 px-1.5 rounded-md font-medium text-center truncate transition-colors ${
                activeScope === "selected_cell"
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs"
                  : selectedCell
                  ? "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              Cell
            </button>
            <button
              onClick={() => setActiveScope("filtered")}
              disabled={!hasFilterActive}
              title={!hasFilterActive ? "Filter rows via the search bar first" : "Active filter"}
              className={`py-1 px-1.5 rounded-md font-medium text-center truncate transition-colors ${
                activeScope === "filtered"
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs"
                  : hasFilterActive
                  ? "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              Filtered
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 overflow-x-auto flex items-center gap-1.5 text-xs">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold shrink-0">
          Suggested:
        </span>
        {quickPrompts.map((promptText, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(promptText)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 whitespace-nowrap text-[11px] transition-colors shrink-0"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const evidenceList: EvidenceSource[] = (() => {
            try {
              return JSON.parse(msg.evidence_sources_json || "[]");
            } catch {
              return [];
            }
          })();
          const isAssistant = msg.role === "assistant";
          const isEvidenceOpen = expandedEvidence[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isAssistant ? "items-start" : "items-start justify-end"}`}
            >
              {isAssistant && (
                <div
                  data-testid="assistant-avatar"
                  className="w-7 h-7 rounded-full bg-linear-to-tr from-cyan-500/10 to-blue-500/10 dark:from-cyan-950/60 dark:to-blue-950/60 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center shrink-0 mt-0.5 shadow-xs overflow-hidden ring-1 ring-cyan-500/10"
                >
                  <LiveOrb size={22} interactive={false} blink variant="webgl" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl p-3.5 text-xs leading-relaxed space-y-2.5 ${
                  isAssistant
                    ? "bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 shadow-xs"
                    : "bg-cyan-600 text-white rounded-br-none shadow-xs"
                }`}
              >
                {isAssistant ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}

                {/* Evidence Citations Chips */}
                {isAssistant && evidenceList.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Citations:
                      </span>
                      {evidenceList.map((ev, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (onNavigateToPdf && ev.page_number) {
                              onNavigateToPdf(ev.paper_id, ev.page_number);
                            }
                          }}
                          title={`Click to open page ${ev.page_number || 1} in PDF Reader`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[150px]">{ev.paper_title}</span>
                          {ev.page_number && <span className="font-mono">· p.{ev.page_number}</span>}
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                        </button>
                      ))}
                    </div>

                    {/* Toggle Full Passages */}
                    <div>
                      <button
                        onClick={() => toggleEvidence(msg.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <span>Inspect {evidenceList.length} supporting passages</span>
                        {isEvidenceOpen ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isEvidenceOpen && (
                        <div className="mt-2 space-y-2 pl-1">
                          {evidenceList.map((ev, evIdx) => (
                            <div
                              key={evIdx}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-slate-500">
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                  {ev.paper_title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {ev.page_number && (
                                    <span className="font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                                      Page {ev.page_number}
                                    </span>
                                  )}
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {Math.round(ev.confidence * 100)}% match
                                  </span>
                                </div>
                              </div>
                              <p className="font-serif italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800/80">
                                "{ev.passage}"
                              </p>
                              {onNavigateToPdf && ev.page_number && (
                                <button
                                  onClick={() => onNavigateToPdf(ev.paper_id, ev.page_number!)}
                                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-medium inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>Open Page {ev.page_number} in PDF Reader</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assistant Message Actions */}
                {isAssistant && msg.id !== "msg_welcome" && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-end gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <button
                      onClick={() => handleCopyResponse(msg.id, msg.content)}
                      className="hover:text-cyan-600 flex items-center gap-1 transition-colors"
                      title="Copy response text"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {evidenceList.length > 0 && (
                      <button
                        onClick={() => handleCopyCitations(msg.id, evidenceList)}
                        className="hover:text-cyan-600 flex items-center gap-1 transition-colors"
                        title="Copy citations to clipboard"
                      >
                        {copiedCitationsId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 font-medium">Citations Copied!</span>
                          </>
                        ) : (
                          <>
                            <FileCheck className="w-3 h-3" />
                            <span>Copy Citations</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleSaveAsNote(msg.id, msg.content)}
                      className="hover:text-cyan-600 flex items-center gap-1 transition-colors"
                      title="Save response as research note"
                    >
                      {savedNoteMsgId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 font-medium">Saved to Notes!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Save Note</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {!isAssistant && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="space-y-2">
            <AITypingIndicator
              visible={isLoading}
              activityState="analyzing"
              context="matrix_copilot"
              statusMessage="Synthesizing matrix claims and checking page-level evidence..."
              variant="chat"
            />
            <div className="pl-14">
              <button
                type="button"
                onClick={handleStopGeneration}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md font-medium transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop Generation</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-2"
        >
          <div className="relative">
            <textarea
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                activeScope === "selected_cell"
                  ? `Ask about this claim or compare with other papers...`
                  : activeScope === "selected_paper"
                  ? `Ask about ${selectedPaper?.paper_title.slice(0, 30)}...`
                  : `Ask about research questions, methods, datasets, or gaps...`
              }
              rows={2}
              disabled={isLoading}
              className="w-full p-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Shift + Enter for new line • Enter to send
            </span>

            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1 text-xs text-rose-600"
                >
                  <Square className="w-3 h-3 fill-rose-600" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!inputQuery.trim() || isLoading}
                  className="flex items-center gap-1.5 text-xs shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>Ask AI</span>
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
