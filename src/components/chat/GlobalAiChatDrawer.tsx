import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Minus,
  RotateCcw,
  Send,
  Copy,
  Check,
  Loader2,
  FileText,
  ChevronDown,
  Cpu,
} from "lucide-react";
import { LiveOrb } from "../ui/live-orb";
import { MarkdownMessage } from "../ui/MarkdownMessage";
import { AITypingIndicator } from "../loading/AITypingIndicator";
import {
  generateAiResponse,
  listAiProviders,
  type AiProvider,
  type AiChatMessage,
} from "../../lib/desktop-api";
import { useApp } from "../../context/AppContext";

export const GlobalAiChatDrawer: React.FC = () => {
  const { papers, setReadingPaper, showToast } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<"general" | "library">(() => {
    return (localStorage.getItem("global_chat_mode") as "general" | "library") || "general";
  });

  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("global_ai_chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messagesEndRef] = [useRef<HTMLDivElement>(null)];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Model & Provider Switcher State
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    return localStorage.getItem("global_chat_selected_provider") || "nvidia_nim";
  });

  useEffect(() => {
    async function fetchProviders() {
      try {
        const list = await listAiProviders();
        if (list && list.length > 0) {
          setProviders(list);
          if (!list.some((p) => p.id === selectedProviderId && p.is_enabled)) {
            const firstEnabled = list.find((p) => p.is_enabled) || list[0];
            if (firstEnabled) setSelectedProviderId(firstEnabled.id);
          }
        }
      } catch (err) {
        console.error("Failed to load providers in GlobalAiChatDrawer:", err);
      }
    }
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
      try {
        localStorage.setItem("global_chat_selected_provider", selectedProviderId);
      } catch {}
    }
  }, [selectedProviderId]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem("global_ai_chat_messages", JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to save global_ai_chat_messages:", e);
    }
  }, [messages]);

  // Persist mode
  useEffect(() => {
    localStorage.setItem("global_chat_mode", mode);
  }, [mode]);

  // Scroll to bottom when messages update or opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, isGenerating]);

  // Global Keyboard shortcut: Ctrl + J / Cmd + J
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setIsMinimized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || prompt).trim();
    if (!query || isGenerating) return;

    const userMessage: AiChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      session_id: "global_chat",
      paper_id: null,
      role: "user",
      content: query,
      citations: [],
      retrieval_mode: mode === "library" ? "library" : "none",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setPrompt("");
    setIsGenerating(true);

    try {
      const activeProv = providers.find((p) => p.id === selectedProviderId);
      const resp = await generateAiResponse({
        prompt: query,
        paper_id: null,
        task_type: mode === "library" ? "qa_citations" : "general_academic",
        audience_level: "researcher",
        reading_mode: "deep_read",
        rag_scope: mode === "library" ? "library" : "none",
        provider_override: selectedProviderId,
        model_override: activeProv?.default_model || undefined,
      });

      const assistantMessage: AiChatMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        session_id: "global_chat",
        paper_id: null,
        role: "assistant",
        content: resp.text,
        citations: resp.citations || [],
        provider_id: resp.provider_id || selectedProviderId,
        model_id: resp.model_id || activeProv?.default_model,
        retrieval_mode: mode === "library" ? "library" : "none",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallbackError: AiChatMessage = {
        id: `err_${Date.now()}`,
        session_id: "global_chat",
        paper_id: null,
        role: "assistant",
        content: `⚠️ Failed to generate response: ${errMsg}\n\nPlease verify that your In-App AI Engine is running in Tools Hub or check network settings.`,
        citations: [],
        retrieval_mode: mode === "library" ? "library" : "none",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackError]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem("global_ai_chat_messages");
    showToast("Chat history cleared.", "info");
  };

  const quickPrompts = [
    { label: "💡 What can you do?", query: "What can you do?" },
    { label: "📖 Structure a literature review", query: "How do I systematically structure an academic literature review?" },
    { label: "🔬 Explain p-value vs effect size", query: "Explain the difference between p-value and effect size in empirical research." },
    { label: "📑 Summarize library papers", query: "Summarize the primary topics and papers available in my research library." },
  ];

  return (
    <>
      {/* Floating Trigger Button with Animated LiveOrb */}
      <div className="fixed bottom-6 right-6 z-40 select-none">
        <button
          onClick={() => {
            setIsOpen((prev) => !prev);
            setIsMinimized(false);
          }}
          aria-label="Toggle Global AI Assistant"
          className="group relative flex items-center justify-center w-11 h-11 rounded-full bg-transparent hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/20"
        >
          {/* Animated Interactive LiveOrb embedded directly with no black circle ring */}
          <div className="pointer-events-none w-11 h-11 flex items-center justify-center overflow-hidden rounded-full">
            <LiveOrb
              size={44}
              variant="webgl"
              colors={["#6366f1", "#8b5cf6", "#ec4899"]}
              interactive={true}
              blink={true}
            />
          </div>

          {/* Glowing aura badge on hover */}
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />

          {/* Tooltip on hover */}
          <div className="absolute right-14 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-slate-900/95 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg border border-slate-800">
            Ask AI Assistant <span className="opacity-60 text-[10px] ml-1">(Ctrl+J)</span>
          </div>
        </button>
      </div>

      {/* Pop-up Chat Modal / Drawer */}
      {isOpen && (
        <div
          className={`fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 backdrop-blur-xl ${
            isMinimized ? "h-14" : "h-[620px] max-h-[calc(100vh-8rem)]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-md select-none shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500/30 shrink-0">
                <LiveOrb
                  size={32}
                  variant="webgl"
                  colors={["#6366f1", "#8b5cf6", "#ec4899"]}
                  interactive={true}
                  blink={true}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Infinity Research AI
                  </h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {mode === "general" ? "General Scientific Intelligence" : "Library Grounded RAG"}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1">
              {/* Mode Toggle Pill */}
              <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 rounded-lg p-0.5 text-[10px] font-medium mr-1">
                <button
                  onClick={() => setMode("general")}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    mode === "general"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  title="General scientific and academic questions"
                >
                  General
                </button>
                <button
                  onClick={() => setMode("library")}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    mode === "library"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  title="Grounded in your indexed research library"
                >
                  Library
                </button>
              </div>

              {/* Clear History */}
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear conversation history"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Assistant"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Engine & Model Switcher Subheader */}
          {!isMinimized && (
            <div className="px-3.5 py-1.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-100/70 dark:bg-slate-800/40 flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-semibold text-[11px]">Model:</span>
              </div>
              <div className="relative max-w-[270px]">
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full text-[11px] font-medium pl-2.5 pr-7 py-1 rounded-lg border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer shadow-xs truncate"
                  title="Select AI Engine"
                >
                  {providers.length === 0 ? (
                    <option value={selectedProviderId}>{selectedProviderId}</option>
                  ) : (
                    providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.is_local ? "🔒 " : "⚡ "} {p.display_name} ({p.is_local ? "Local LLM" : "Cloud API"})
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </div>
          )}

          {/* Chat Canvas (Hidden when minimized) */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 dark:bg-slate-950/20">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                    <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-indigo-50/50 dark:bg-indigo-950/30 mb-3">
                      <LiveOrb
                        size={64}
                        variant="webgl"
                        colors={["#6366f1", "#8b5cf6", "#ec4899"]}
                        interactive={true}
                        blink={true}
                      />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      How can I help your research today?
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                      {mode === "general"
                        ? "Ask general academic questions, clarify methodology, or request writing suggestions."
                        : "Ask deep questions anchored directly in verified passages from your research library."}
                    </p>

                    {/* Quick suggestion prompt pills */}
                    <div className="w-full mt-5 space-y-1.5">
                      {quickPrompts.map((qp, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(qp.query)}
                          className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] transition-all shadow-sm"
                        >
                          {qp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        ) : (
                          <div>
                            <MarkdownMessage content={msg.content} />

                            {/* Citations badges if present */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                                  Verified Sources:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {msg.citations.map((c, cIdx) => (
                                    <button
                                      key={cIdx}
                                      onClick={() => {
                                        const found = papers.find((p) => p.id === c.paper_id);
                                        if (found) setReadingPaper(found);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline border border-slate-200 dark:border-slate-700"
                                    >
                                      <FileText className="w-2.5 h-2.5" />
                                      <span className="truncate max-w-[140px]">{c.paper_title}</span>
                                      <span className="opacity-60">p.{c.page_number}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Copy button & Engine Attribution */}
                            <div className="mt-2 pt-1.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                              <span className="truncate max-w-[220px]">
                                {msg.provider_id
                                  ? `Generated by ${msg.provider_id}${msg.model_id ? ` (${msg.model_id})` : ""}`
                                  : "AI Intelligence"}
                              </span>
                              <button
                                onClick={() => handleCopyText(msg.id, msg.content)}
                                className="inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Typing Indicator */}
                {isGenerating && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500/20 shrink-0">
                      <LiveOrb
                        size={24}
                        variant="webgl"
                        colors={["#6366f1", "#8b5cf6", "#ec4899"]}
                        interactive={false}
                        blink={true}
                      />
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-none px-3.5 py-2">
                      <AITypingIndicator visible={true} variant="chat" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder={
                      mode === "general"
                        ? "Ask about concepts, writing, or equations... (Enter to send)"
                        : "Ask a grounded question about your library papers..."
                    }
                    className="flex-1 resize-none max-h-24 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    disabled={isGenerating || !prompt.trim()}
                    onClick={() => void handleSendMessage()}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-sm shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5 px-1 select-none">
                  <span>Enter to send · Shift+Enter for newline</span>
                  <span className="font-mono text-[9px]">
                    {mode === "general" ? "General Mode" : "Library Grounded"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default GlobalAiChatDrawer;
