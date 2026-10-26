import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  MessageSquare,
  Lightbulb,
  FileText,
  Copy,
  Check,
  Send,
  RotateCcw,
  BookOpen,
  Code2,
  Activity,
  ShieldAlert,
  FileSearch,
  FileCheck,
  HelpCircle,
  BookmarkPlus,
  Loader2,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  generateAiResponse,
  indexPaperForRag,
  getPaperRagChunks,
  saveNote,
  importDiscoveredSearchResult,
  importSinglePage,
  AiChatMessage,
  AiPaperChunk,
  DiscoveredSearchResult,
} from "../../lib/desktop-api";
import { UnifiedDiscoverPaper } from "./DiscoverView";
import { discoverSessionStore, PaperAiInsight } from "./discoverSessionStore";

export interface DiscoverPaperAssistantProps {
  paper: UnifiedDiscoverPaper;
  discoveredRawList?: DiscoveredSearchResult[];
  onNavigatePdfPage: (page: number) => void;
  onRefreshPaperNotes: () => void;
  onPaperSaved?: (newPaperId: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface InsightConfig {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  badge: string;
}

const INSIGHT_TOOLS: InsightConfig[] = [
  {
    id: "beginner_eli5",
    label: "Beginner Explanation (ELI5)",
    shortDesc: "Plain-language walkthrough of the core mechanism and real-world impact without jargon.",
    icon: HelpCircle,
    badge: "Intuitive",
    prompt:
      "Provide an intuitive, beginner-friendly explanation (ELI5) of this paper. Explain what problem it solves, how the proposed approach works using an intuitive analogy, and why this matters for the real world. Avoid dense mathematical jargon.",
  },
  {
    id: "structured_summary",
    label: "Structured Summary",
    shortDesc: "Background, Objective, Methodology, Key Findings, Significance & Limitations.",
    icon: BookOpen,
    badge: "Comprehensive",
    prompt:
      "Provide a rigorous structured summary of this paper organized into: 1. Core Problem & Objective, 2. Background Context, 3. Proposed Methodology / Approach, 4. Quantitative Results & Key Findings, 5. Scientific Significance, and 6. Limitations.",
  },
  {
    id: "methodology_analysis",
    label: "Methodology Analysis",
    shortDesc: "Mathematical formulations, algorithms, experimental controls, and variables.",
    icon: Code2,
    badge: "Technical",
    prompt:
      "Analyze the methodology of this paper in depth. Detail the theoretical formulation, architectural and algorithmic choices, data collection and sampling strategies, baseline comparisons, experimental controls, and validation techniques.",
  },
  {
    id: "results_interpretation",
    label: "Results Interpretation",
    shortDesc: "Statistical significance, benchmarks, effect sizes, trade-offs, and ablations.",
    icon: Activity,
    badge: "Empirical",
    prompt:
      "Interpret the empirical results and evaluation in this paper. Detail the performance gains over baselines, key benchmark figures, statistical significance, ablation study findings, and any notable performance trade-offs.",
  },
  {
    id: "strengths_weaknesses",
    label: "Strengths & Weaknesses",
    shortDesc: "Critical peer-review critique of rigor, baseline fairness, and confounders.",
    icon: ShieldAlert,
    badge: "Peer Review",
    prompt:
      "Conduct a balanced peer-review critique of this paper. Detail: 1. Top 3 Strengths (originality, theoretical or empirical rigor, benchmark superiority), 2. Top 3 Weaknesses or Potential Flaws (untested assumptions, missing baseline comparisons, generalizability limits, or potential confounders).",
  },
  {
    id: "research_gaps",
    label: "Research Gaps",
    shortDesc: "Unresolved boundary conditions, edge cases, and unexplored questions.",
    icon: FileSearch,
    badge: "Critique",
    prompt:
      "Identify the critical research gaps left open by this paper. What questions does this work leave unanswered? What boundary conditions, edge cases, failure modes, or domain shifts were not explored?",
  },
  {
    id: "future_work",
    label: "Future Work Roadmap",
    shortDesc: "Authors' declared next steps plus novel high-impact follow-up hypotheses.",
    icon: Sparkles,
    badge: "Roadmap",
    prompt:
      "Synthesize the proposed future directions explicitly mentioned by the authors, and formulate 3 novel, high-impact follow-up research hypotheses that build directly on this paper's findings.",
  },
  {
    id: "replication_checklist",
    label: "Replication Checklist",
    shortDesc: "Hardware specs, datasets, dependencies, hyperparameters, and protocols.",
    icon: FileCheck,
    badge: "Practical",
    prompt:
      "Generate a concrete, step-by-step Replication Checklist for this paper: 1. Required Datasets & Preprocessing, 2. Hardware / Compute Specifications, 3. Software Dependencies & Libraries, 4. Key Hyperparameters & Loss Functions, 5. Exact Evaluation Protocol & Metrics.",
  },
];

const SUGGESTED_QUESTIONS = [
  "What is the main hypothesis and contribution?",
  "What datasets and baseline models were tested against?",
  "Explain the core equation or algorithmic step.",
  "What are the primary limitations acknowledged by authors?",
  "How could this approach be deployed in real-world production?",
];

let messageCounter = 0;
function createMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${Date.now()}_${messageCounter}`;
}

export const DiscoverPaperAssistant: React.FC<DiscoverPaperAssistantProps> = ({
  paper,
  discoveredRawList,
  onNavigatePdfPage,
  onRefreshPaperNotes,
  onPaperSaved,
  showToast,
}) => {
  // Tabs: 'chat' | 'insights'
  const [subTab, setSubTab] = useState<"chat" | "insights">("chat");

  // Indexing & Chunks Status
  const [chunks, setChunks] = useState<AiPaperChunk[]>([]);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);

  // Chat State
  const [chatInput, setChatInput] = useState<string>("");
  const [isGeneratingChat, setIsGeneratingChat] = useState<boolean>(false);
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);

  // AI Insights State
  const [selectedInsightId, setSelectedInsightId] = useState<string>("beginner_eli5");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState<boolean>(false);
  const [copiedInsight, setCopiedInsight] = useState<boolean>(false);
  const [isSavingInsightAsNote, setIsSavingInsightAsNote] = useState<boolean>(false);

  // Get active session state from store
  const paperIdKey = paper.paper_id || paper.id;
  const session = discoverSessionStore.getState();
  const currentChatMessages = session.chatHistoryByPaper[paperIdKey] || [];
  const currentPaperInsights = session.insightsByPaper[paperIdKey] || {};

  // Check RAG index status whenever paper changes
  const checkPaperIndexStatus = useCallback(async () => {
    const targetId = paper.paper_id || paper.id;
    if (!targetId || targetId.startsWith("preview_") || targetId.startsWith("websearch_")) {
      setChunks([]);
      return;
    }

    try {
      const existingChunks = await getPaperRagChunks(targetId);
      setChunks(existingChunks || []);
    } catch (e) {
      console.warn("Failed to check paper RAG chunks:", e);
      setChunks([]);
    }
  }, [paper.id, paper.paper_id]);

  useEffect(() => {
    void checkPaperIndexStatus();
  }, [checkPaperIndexStatus]);

  // Ensure paper is saved to SQLite so RAG indexing & chat persist
  const ensurePaperIsImported = async (): Promise<string> => {
    if (paper.is_imported && paper.paper_id) {
      return paper.paper_id;
    }

    const raw = discoveredRawList?.find((r) => `websearch_${r.id}` === paper.id);
    if (raw) {
      const saved = await importDiscoveredSearchResult(raw);
      onPaperSaved?.(saved.id);
      return saved.id;
    }

    if (paper.url) {
      const saved = await importSinglePage(paper.url, null, null);
      onPaperSaved?.(saved.id);
      return saved.id;
    }

    throw new Error("Cannot index this paper without a valid source URL or metadata.");
  };

  // One-click full text indexing
  const handleIndexPaper = async () => {
    setIsIndexing(true);
    try {
      const realId = await ensurePaperIsImported();
      const count = await indexPaperForRag(realId);
      await checkPaperIndexStatus();
      showToast(`Indexed ${count} sections for grounded AI answers!`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Indexing failed: ${msg}`, "error");
    } finally {
      setIsIndexing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Chat Execution
  // ---------------------------------------------------------------------------
  const handleSendChat = async (promptText?: string) => {
    const text = (promptText || chatInput).trim();
    if (!text || isGeneratingChat) return;

    setChatInput("");
    setIsGeneratingChat(true);

    const userMsg: AiChatMessage = {
      id: createMessageId("usr"),
      session_id: `discover_${paperIdKey}`,
      paper_id: paper.paper_id || paper.id,
      role: "user",
      content: text,
      citations: [],
      retrieval_mode: "paper",
      created_at: new Date().toISOString(),
    };

    discoverSessionStore.addChatMessage(paperIdKey, userMsg);

    try {
      let activePaperId: string | null = paper.paper_id || null;
      // If unimported, auto-import to give RAG an anchor
      if (!activePaperId && !paper.is_imported) {
        try {
          activePaperId = await ensurePaperIsImported();
          await indexPaperForRag(activePaperId).catch(() => {});
          await checkPaperIndexStatus();
        } catch (e) {
          // If auto-import fails, proceed with abstract-only context
          console.warn("Auto-import before chat failed:", e);
        }
      }

      const response = await generateAiResponse({
        prompt: text,
        paper_id: activePaperId,
        task_type: "qa_citations",
        audience_level: "researcher",
        reading_mode: "deep_read",
        rag_scope: "paper",
        system_instruction: `You are an expert scientific researcher analyzing the paper titled "${paper.title}". Base your answer strictly on the paper's extracted text and abstract. If citations with page numbers are available, quote and cite them as [Page X, Section Y]. If the question cannot be answered from the paper, state that transparently.`,
      });

      const assistantMsg: AiChatMessage = {
        id: createMessageId("ast"),
        session_id: `discover_${paperIdKey}`,
        paper_id: activePaperId,
        role: "assistant",
        content: response.text,
        citations: response.citations || [],
        provider_id: response.provider_id,
        model_id: response.model_id,
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      };

      discoverSessionStore.addChatMessage(paperIdKey, assistantMsg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorMsg: AiChatMessage = {
        id: createMessageId("err"),
        session_id: `discover_${paperIdKey}`,
        paper_id: paper.paper_id || paper.id,
        role: "assistant",
        content: `⚠️ Failed to generate grounded response: ${msg}. Please ensure your local or cloud AI provider is running in the AI Hub.`,
        citations: [],
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      };
      discoverSessionStore.addChatMessage(paperIdKey, errorMsg);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const handleClearChat = () => {
    discoverSessionStore.clearChat(paperIdKey);
    showToast("Chat history cleared for this paper.", "info");
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChatId(id);
    setTimeout(() => setCopiedChatId(null), 2000);
    showToast("Copied to clipboard!", "info");
  };

  // ---------------------------------------------------------------------------
  // AI Insights Execution
  // ---------------------------------------------------------------------------
  const handleGenerateInsight = async (tool: InsightConfig) => {
    setSelectedInsightId(tool.id);
    setIsGeneratingInsight(true);

    try {
      let activePaperId: string | null = paper.paper_id || null;
      if (!activePaperId && !paper.is_imported) {
        try {
          activePaperId = await ensurePaperIsImported();
          await indexPaperForRag(activePaperId).catch(() => {});
          await checkPaperIndexStatus();
        } catch (e) {
          console.warn("Auto-import before generating insight failed:", e);
        }
      }

      const response = await generateAiResponse({
        prompt: `${tool.prompt}\n\nPaper Title: "${paper.title}"\nAbstract: "${paper.abstract_text || ""}"`,
        paper_id: activePaperId,
        task_type: tool.id,
        audience_level: "researcher",
        reading_mode: "deep_read",
        rag_scope: "paper",
        system_instruction: `You are an elite scientific referee and domain analyst. Provide a deeply structured, comprehensive response for ${tool.label}. Include exact page references [Page X] when citing extracted text.`,
      });

      const insightData: PaperAiInsight = {
        type: tool.id,
        title: tool.label,
        content: response.text,
        citations: response.citations || [],
        createdAt: new Date().toISOString(),
      };

      discoverSessionStore.setInsight(paperIdKey, tool.id, insightData);
      showToast(`Generated ${tool.label}!`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to generate insight: ${msg}`, "error");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleSaveInsightAsNote = async (insight: PaperAiInsight) => {
    setIsSavingInsightAsNote(true);
    try {
      const realId = await ensurePaperIsImported();
      const markdown = `### AI Insight: ${insight.title}\n*Generated on ${new Date(insight.createdAt).toLocaleDateString()}*\n\n${insight.content}`;
      await saveNote({
        paper_id: realId,
        content_markdown: markdown,
      });
      onRefreshPaperNotes();
      showToast("Saved insight to research notes!", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to save note: ${msg}`, "error");
    } finally {
      setIsSavingInsightAsNote(false);
    }
  };

  // Calculate Text Availability Status
  const textStatus = (() => {
    if (chunks.length > 1) {
      const pageSet = new Set(chunks.map((c) => c.page_number).filter(Boolean));
      return {
        label: `Full Text Indexed (${chunks.length} chunks, ${pageSet.size} pages)`,
        color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
        type: "full",
      };
    }
    if (chunks.length === 1) {
      return {
        label: "Abstract Grounded (1 chunk)",
        color: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        type: "abstract",
      };
    }
    if (paper.local_pdf_path || paper.is_downloaded) {
      return {
        label: "PDF Downloaded (Ready to Index)",
        color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
        type: "ready",
      };
    }
    if (paper.abstract_text) {
      return {
        label: "Abstract Available",
        color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
        type: "abstract_unindexed",
      };
    }
    return {
      label: "Metadata Only (No Text)",
      color: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800",
      type: "none",
    };
  })();

  const activeInsight = currentPaperInsights[selectedInsightId];
  const activeToolConfig = INSIGHT_TOOLS.find((t) => t.id === selectedInsightId) || INSIGHT_TOOLS[0];

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Top Header & Grounding Status Bar */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Evidence-Grounded AI
            </h3>
          </div>

          {/* Sub-tabs: Chat vs Insights */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSubTab("chat")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                subTab === "chat"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Paper Chat</span>
              {currentChatMessages.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[9px] flex items-center justify-center font-bold">
                  {currentChatMessages.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab("insights")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                subTab === "insights"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Lightbulb className="w-3 h-3" />
              <span>AI Insights (8)</span>
              {Object.keys(currentPaperInsights).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[9px] flex items-center justify-center font-bold">
                  {Object.keys(currentPaperInsights).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Text Availability Status Pill & Index Button */}
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border truncate ${textStatus.color}`}
            >
              {textStatus.label}
            </span>
          </div>

          {textStatus.type !== "full" && (
            <button
              type="button"
              onClick={handleIndexPaper}
              disabled={isIndexing}
              className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isIndexing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Indexing...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  <span>Index Full Text</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: CONTEXT-AWARE PAPER CHAT */}
      {/* ===================================================================== */}
      {subTab === "chat" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {currentChatMessages.length === 0 ? (
              <div className="h-full flex flex-col justify-center text-center p-2 space-y-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Ask About This Paper
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Questions are answered strictly from this paper's extracted content with interactive page-level citations.
                  </p>
                </div>

                {/* Starter Questions Chips */}
                <div className="space-y-1.5 pt-1 text-left">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Suggested Questions:
                  </span>
                  <div className="flex flex-col gap-1">
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendChat(q)}
                        disabled={isGeneratingChat}
                        className="text-left px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <span className="line-clamp-1">{q}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              currentChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs"
                        : "bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200 dark:border-slate-700 shadow-xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Grounded Interactive Page Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Grounded Citations (Click to jump PDF):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {msg.citations.map((c, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (c.page_number) {
                                  onNavigatePdfPage(c.page_number);
                                  showToast(
                                    `Jumping PDF to Page ${c.page_number} (${c.section_heading || "Context"})`,
                                    "info"
                                  );
                                }
                              }}
                              title={c.snippet}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors shadow-2xs cursor-pointer"
                            >
                              <FileText className="w-2.5 h-2.5 text-indigo-500" />
                              <span>Page {c.page_number}</span>
                              {c.section_heading && (
                                <span className="opacity-75 max-w-[90px] truncate">
                                  • {c.section_heading}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Footer Actions */}
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                    <span>
                      {msg.role === "assistant"
                        ? `${msg.model_id || msg.provider_id || "AI"} • ${new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "You"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5"
                    >
                      {copiedChatId === msg.id ? (
                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              ))
            )}

            {isGeneratingChat && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 p-2 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading paper context and generating grounded answer...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 shrink-0 space-y-1.5">
            <div className="relative flex items-center">
              <textarea
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendChat();
                  }
                }}
                placeholder="Ask about equations, datasets, findings, or limitations... (Enter to send)"
                className="w-full pl-3 pr-10 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim() || isGeneratingChat}
                className="absolute right-2 p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors cursor-pointer"
                title="Send message"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>

            {currentChatMessages.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Clear Conversation</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: 8 ACTIONABLE AI INSIGHTS */}
      {/* ===================================================================== */}
      {subTab === "insights" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tool Selector Carousel / Grid */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              {INSIGHT_TOOLS.map((tool) => {
                const isSelected = selectedInsightId === tool.id;
                const isCached = Boolean(currentPaperInsights[tool.id]);
                const Icon = tool.icon;

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setSelectedInsightId(tool.id);
                      if (!currentPaperInsights[tool.id]) {
                        void handleGenerateInsight(tool);
                      }
                    }}
                    className={`p-1.5 rounded-lg text-left transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`p-1 rounded ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold truncate block">
                          {tool.label}
                        </span>
                        {isCached && (
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block truncate">
                        {tool.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Insight Canvas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {activeInsight ? (
              <div className="space-y-3">
                {/* Insight Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <activeToolConfig.icon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{activeInsight.title}</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Generated {new Date(activeInsight.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeInsight.content);
                        setCopiedInsight(true);
                        setTimeout(() => setCopiedInsight(false), 2000);
                        showToast("Copied insight to clipboard!", "info");
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                    >
                      {copiedInsight ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveInsightAsNote(activeInsight)}
                      disabled={isSavingInsightAsNote}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>{isSavingInsightAsNote ? "Saving..." : "Save to Notes"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenerateInsight(activeToolConfig)}
                      disabled={isGeneratingInsight}
                      title="Regenerate analysis"
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Insight Markdown Body */}
                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {activeInsight.content}
                </div>

                {/* Grounded Citations */}
                {activeInsight.citations && activeInsight.citations.length > 0 && (
                  <div className="mt-4 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Evidence Passages (Click to jump PDF):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeInsight.citations.map((c, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (c.page_number) {
                              onNavigatePdfPage(c.page_number);
                              showToast(`Jumping PDF to Page ${c.page_number}`, "info");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span>Page {c.page_number}</span>
                          {c.section_heading && <span>({c.section_heading})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isGeneratingInsight ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Generating {activeToolConfig.label}...
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Extracting methodology, evaluating evidence, and generating grounded critique with citations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <activeToolConfig.icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeToolConfig.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    {activeToolConfig.shortDesc}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleGenerateInsight(activeToolConfig)}
                  className="text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  <span>Generate Analysis</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
