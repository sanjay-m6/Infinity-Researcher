import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  BookOpen,
  Send,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bot,
  User,
} from "lucide-react";
import {
  EvidenceCopilotMessage,
  EvidenceSource,
  MatrixRow,
} from "../../lib/desktop-api/types";
import * as desktopApi from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { AITypingIndicator } from "../../components/loading";
import { MarkdownMessage } from "../../components/ui/MarkdownMessage";

interface EvidenceCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  rows: MatrixRow[];
  onNavigateToPdf?: (paperId: string, pageNumber: number) => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const EvidenceCopilotModal: React.FC<EvidenceCopilotModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  rows,
  onNavigateToPdf,
}) => {
  const [messages, setMessages] = useState<EvidenceCopilotMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_matrix_${workspaceId}`);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const history = await desktopApi.getEvidenceCopilotMessages(sessionId);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        // Welcome message
        setMessages([
          {
            id: "msg_welcome",
            session_id: sessionId,
            role: "assistant",
            content: `I am your Evidence-Linked Copilot for this Literature Review Matrix (${rows.length} papers loaded). Ask me to compare findings, explain methodologies, or synthesize limitations across studies. Every response includes verifiable page-level evidence chips.`,
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
    if (isOpen) {
      void loadMessages();
    }
  }, [isOpen, loadMessages]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSend = async (queryToSend?: string) => {
    const q = queryToSend || inputQuery;
    if (!q.trim() || isLoading) return;

    setInputQuery("");
    setIsLoading(true);

    // Optimistic user message
    const tempUserMsg: EvidenceCopilotMessage = {
      id: generateId("usr"),
      session_id: sessionId,
      role: "user",
      content: q,
      evidence_sources_json: "[]",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const assistantMsg = await desktopApi.askEvidenceCopilot(
        sessionId,
        q,
        workspaceId,
        rows.length > 0 ? rows[0].paper_id : null
      );
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Copilot request failed:", err);
      const msg = desktopApi.getErrorMessage(err, "Failed to communicate with local AI assistant.");
      const errorMsg: EvidenceCopilotMessage = {
        id: generateId("err"),
        session_id: sessionId,
        role: "assistant",
        content: `Error generating response: ${msg}. Please check local index.`,
        evidence_sources_json: "[]",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvidence = (msgId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  if (!isOpen) return null;

  const quickPrompts = [
    "Compare the experimental results and metrics across papers",
    "What datasets and sample sizes were evaluated?",
    "What common limitations are reported across studies?",
    "Synthesize the research questions and objectives",
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[85vh] max-h-[760px] bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-auto select-text"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <BookOpen className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Evidence-Linked Copilot</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  Grounded QA
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scope: Matrix Workspace ({rows.length} papers) • Verifiable citations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap">Suggested:</span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 whitespace-nowrap transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                className={`flex gap-3 ${isAssistant ? "items-start" : "items-start justify-end"}`}
              >
                {isAssistant && (
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isAssistant
                      ? "bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60"
                      : "bg-cyan-600 text-white rounded-br-xs"
                  }`}
                >
                  {isAssistant ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}

                  {/* Evidence Drawer in Assistant Messages */}
                  {isAssistant && evidenceList.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                      <button
                        onClick={() => toggleEvidence(msg.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Show Supporting Evidence ({evidenceList.length} passages)</span>
                        {isEvidenceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isEvidenceOpen && (
                        <div className="mt-2.5 space-y-2">
                          {evidenceList.map((ev, evIdx) => (
                            <div
                              key={evIdx}
                              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                                  {ev.paper_title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {ev.page_number && (
                                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                                      p. {ev.page_number}
                                    </span>
                                  )}
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {Math.round(ev.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                              <p className="font-serif italic text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                "{ev.passage}"
                              </p>
                              {onNavigateToPdf && ev.page_number && (
                                <button
                                  onClick={() => onNavigateToPdf(ev.paper_id, ev.page_number!)}
                                  className="inline-flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline pt-0.5 font-medium"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open Page {ev.page_number} in PDF Reader
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isAssistant && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          <AITypingIndicator
            visible={isLoading}
            activityState="generating"
            context="matrix_copilot"
            statusMessage="Searching local library passages and synthesizing verifiable evidence..."
            variant="chat"
          />

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a question about these papers (e.g. 'Compare the sample sizes and metrics')..."
              disabled={isLoading}
              className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!inputQuery.trim() || isLoading}
              className="px-5 py-3 rounded-xl flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Ask</span>
            </Button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
