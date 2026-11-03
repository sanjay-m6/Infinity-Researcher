import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  BookOpen,
  StickyNote,
  Copy,
  Check,
  Plus,
  Trash2,
  Send,
  Loader2,
  ChevronRight,
  Quote,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AITypingIndicator } from "../loading";
import {
  generateAiResponse,
  getNotesForPaper,
  saveNote,
  deleteNote,
  DbNote,
  getErrorMessage,
  listAiChatMessages,
  saveAiChatMessage,
  clearAiChatSession,
} from "../../lib/desktop-api";
import type { AiChatMessage } from "../../lib/desktop-api/types";

export interface PdfRightPanelProps {
  paperId?: string | null;
  paperTitle: string;
  authors?: string[];
  venue?: string | null;
  publicationYear?: number | string | null;
  canonicalDoi?: string | null;
  abstractText?: string | null;
  currentPage: number;
  numPages: number;
  selectedText?: string;
  onNavigatePdfPage: (page: number) => void;
  initialTab?: "ai" | "metadata" | "notes";
  onClose?: () => void;
  onNoteAdded?: () => void;
}

export type ChatMsg = AiChatMessage;

let chatCounter = 0;
function nextChatId(prefix: string): string {
  chatCounter += 1;
  return `${prefix}_${chatCounter}`;
}

export const PdfRightPanel: React.FC<PdfRightPanelProps> = ({
  paperId,
  paperTitle,
  authors = [],
  venue,
  publicationYear,
  canonicalDoi,
  abstractText,
  currentPage,
  numPages,
  selectedText,
  onNavigatePdfPage,
  initialTab = "ai",
  onClose,
  onNoteAdded,
}) => {
  const [activeTab, setActiveTab] = useState<"ai" | "metadata" | "notes">(initialTab);

  // -------------------------------------------------------------------------
  // 1. AI Assistant State
  // -------------------------------------------------------------------------
  const [groundingScope, setGroundingScope] = useState<"selection" | "page" | "paper">("page");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Switch scope to selection if text was just selected
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      setGroundingScope("selection");
    }
  }, [selectedText]);

  // Load existing chat history from SQLite for session `pdf_chat_${paperId}`
  useEffect(() => {
    let isCancelled = false;
    const currentSessionId = `pdf_chat_${paperId || "general"}`;

    listAiChatMessages(currentSessionId)
      .then((msgs) => {
        if (!isCancelled && msgs) {
          setChatMessages(msgs);
        }
      })
      .catch((err) => {
        console.warn("Failed to load PDF chat history from SQLite:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [paperId]);

  const handleClearHistory = useCallback(async () => {
    const currentSessionId = `pdf_chat_${paperId || "general"}`;
    setChatMessages([]);
    try {
      await clearAiChatSession(currentSessionId);
    } catch (err) {
      console.warn("Failed to clear PDF chat session in SQLite:", err);
    }
  }, [paperId]);

  const handleSendAi = useCallback(
    async (promptOverride?: string) => {
      const textToSend = promptOverride || chatInput.trim();
      if (!textToSend || isGenerating) return;

      const currentSessionId = `pdf_chat_${paperId || "general"}`;

      const userMsg: AiChatMessage = {
        id: nextChatId("usr"),
        session_id: currentSessionId,
        paper_id: paperId || null,
        role: "user",
        content: textToSend,
        citations: currentPage
          ? [
              {
                chunk_id: `page_${currentPage}`,
                paper_id: paperId || "",
                paper_title: paperTitle || "",
                page_number: currentPage,
                section_heading: `Page ${currentPage}`,
                snippet: selectedText || "",
                score: 1.0,
              },
            ]
          : [],
        retrieval_mode: groundingScope,
        created_at: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      saveAiChatMessage(userMsg).catch((err) =>
        console.warn("Failed to persist PDF user message to SQLite:", err)
      );
      if (!promptOverride) setChatInput("");
      setIsGenerating(true);

      // Build grounding system context
      let groundingContext = `Paper Title: "${paperTitle}". Current Page: ${currentPage} of ${numPages}.`;
      if (groundingScope === "selection" && selectedText) {
        groundingContext += `\nUser highlighted text excerpt:\n"${selectedText}"`;
      } else if (groundingScope === "page") {
        groundingContext += `\nGround your answer strictly within the context of Page ${currentPage}.`;
      } else {
        groundingContext += `\nGround your answer within the full academic document.`;
      }

      try {
        const preferredProvider = localStorage.getItem("ai_hub_chat_provider_id") || undefined;
        const preferredModel = localStorage.getItem("ai_hub_chat_model_id") || undefined;

        const res = await generateAiResponse({
          prompt: textToSend,
          system_instruction: `You are an expert academic research copilot embedded in the PDF reader of Infinity Researcher. Ground your insights in the provided paper context.\nContext: ${groundingContext}`,
          paper_id: paperId || null,
          provider_override: preferredProvider,
          model_override: preferredModel,
        });

        const assistantMsg: AiChatMessage = {
          id: nextChatId("ast"),
          session_id: currentSessionId,
          paper_id: paperId || null,
          role: "assistant",
          content: res.text,
          citations: res.citations || [],
          provider_id: res.provider_id || preferredProvider,
          model_id: res.model_id || preferredModel,
          retrieval_mode: groundingScope,
          created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        saveAiChatMessage(assistantMsg).catch((err) =>
          console.warn("Failed to persist PDF assistant message to SQLite:", err)
        );
      } catch (err) {
        const msg = getErrorMessage(err);
        // Fallback response if offline/no API key configured
        const fallbackMsg: AiChatMessage = {
          id: nextChatId("ast_fallback"),
          session_id: currentSessionId,
          paper_id: paperId || null,
          role: "assistant",
          content: `I've analyzed the query regarding Page ${currentPage} of "${paperTitle}". ${
            selectedText ? `Based on selected text ("${selectedText.slice(0, 80)}..."): ` : ""
          }Please configure your LLM provider in Settings for live model generation. (Offline fallback: ${msg})`,
          citations: [],
          retrieval_mode: groundingScope,
          created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, fallbackMsg]);
        saveAiChatMessage(fallbackMsg).catch((err) =>
          console.warn("Failed to persist PDF fallback message to SQLite:", err)
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [chatInput, isGenerating, currentPage, numPages, paperTitle, groundingScope, selectedText, paperId]
  );

  // Quick preset chips
  const quickChips = [
    { label: "ELI5", prompt: `Explain the core concepts on Page ${currentPage} in simple, jargon-free language.` },
    { label: "Summarize Page", prompt: `Summarize the primary claims and findings on Page ${currentPage}.` },
    { label: "Methodology", prompt: `Analyze the technical methodology and equations presented on Page ${currentPage}.` },
    { label: "Limitations", prompt: `What are the critical limitations or potential weaknesses on Page ${currentPage}?` },
  ];

  // -------------------------------------------------------------------------
  // 2. Metadata & Citation Generator State
  // -------------------------------------------------------------------------
  const [copiedApa, setCopiedApa] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);

  const authorString = authors.length > 0 ? authors.join(", ") : "Unknown Author";
  const yearString = publicationYear ? String(publicationYear) : "n.d.";

  // Formatted APA Citation
  const apaCitation = `${authorString} (${yearString}). ${paperTitle}. ${venue ? `${venue}.` : ""}${
    canonicalDoi ? ` https://doi.org/${canonicalDoi}` : ""
  }`;

  // Formatted BibTeX Citation
  const firstAuthorLast = authors.length > 0 ? authors[0].split(" ").pop()?.toLowerCase() || "author" : "author";
  const bibtexKey = `${firstAuthorLast}${yearString !== "n.d." ? yearString : "undated"}`;
  const bibtexCitation = `@article{${bibtexKey},
  title = {${paperTitle}},
  author = {${authors.join(" and ") || "Unknown"}},
  year = {${yearString !== "n.d." ? yearString : ""}},
  journal = {${venue || ""}},
  doi = {${canonicalDoi || ""}}
}`;

  const handleCopyApa = () => {
    void navigator.clipboard.writeText(apaCitation);
    setCopiedApa(true);
    setTimeout(() => setCopiedApa(false), 2000);
  };

  const handleCopyBibtex = () => {
    void navigator.clipboard.writeText(bibtexCitation);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  // -------------------------------------------------------------------------
  // 3. SQLite Persistent Notes State
  // -------------------------------------------------------------------------
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [attachToPage, setAttachToPage] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!paperId) {
      setNotes([]);
      return;
    }
    setIsLoadingNotes(true);
    try {
      const fetched = await getNotesForPaper(paperId);
      setNotes(fetched || []);
    } catch {
      setNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [paperId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId || !newNoteText.trim() || isSavingNote) return;

    setIsSavingNote(true);
    try {
      const titleTag = attachToPage ? `Page ${currentPage}` : "General Note";
      const created = await saveNote({
        paper_id: paperId,
        title: titleTag,
        content_markdown: newNoteText.trim(),
      });
      setNotes((prev) => [created, ...prev]);
      setNewNoteText("");
      onNoteAdded?.();
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  return (
    <div
      data-testid="pdf-right-panel"
      className="w-72 sm:w-80 md:w-96 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 select-none overflow-hidden"
    >
      {/* Panel Tab Strip */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-1 text-xs gap-1">
        <div className="flex items-center gap-1 flex-1">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "ai"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="AI Research Assistant"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "metadata"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Metadata & Citation Generators"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Metadata</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "notes"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Persistent SQLite Notes"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Notes {notes.length > 0 && `(${notes.length})`}</span>
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded cursor-pointer"
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Tab 1: AI Copilot */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "ai" && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Grounding Context Selector */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <span>Grounding Context:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {groundingScope === "selection"
                    ? "Selected Text"
                    : groundingScope === "page"
                    ? `Page ${currentPage}`
                    : "Entire Document"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleClearHistory}
                disabled={chatMessages.length === 0}
                className={`flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                  chatMessages.length > 0
                    ? "text-slate-500 hover:text-red-500"
                    : "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                }`}
                title="Clear History"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setGroundingScope("selection")}
                disabled={!selectedText}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                  groundingScope === "selection"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : !selectedText
                    ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
                title={selectedText ? "Ground strictly on highlighted text snippet" : "Highlight text on page to enable"}
              >
                Selection
              </button>

              <button
                type="button"
                onClick={() => setGroundingScope("page")}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                  groundingScope === "page"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                Page {currentPage}
              </button>

              <button
                type="button"
                onClick={() => setGroundingScope("paper")}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                  groundingScope === "paper"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                Full Paper
              </button>
            </div>

            {groundingScope === "selection" && selectedText && (
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded text-[10px] text-amber-800 dark:text-amber-300 truncate italic">
                &ldquo;{selectedText}&rdquo;
              </div>
            )}
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 select-text">
            {chatMessages.length === 0 ? (
              <div className="p-4 text-center text-slate-400 space-y-3">
                <Sparkles className="w-8 h-8 mx-auto text-indigo-400 opacity-60" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-600 dark:text-slate-300 text-xs">
                    Grounded Research Copilot
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Ask questions grounded in Page {currentPage} or highlight any formula, quote, or claim.
                  </p>
                </div>

                {/* Preset Prompt Chips */}
                <div className="pt-2 flex flex-col gap-1.5 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Prompts
                  </span>
                  {quickChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => void handleSendAi(chip.prompt)}
                      className="text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-300 text-xs transition-colors flex items-center justify-between cursor-pointer group shadow-2xs"
                    >
                      <span className="font-medium">{chip.label}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-1 text-xs ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                    <span>{msg.role === "user" ? "You" : "Copilot"}</span>
                    <span>•</span>
                    <span>
                      {(() => {
                        if (msg.created_at) {
                          try {
                            const d = new Date(msg.created_at);
                            if (!isNaN(d.getTime())) {
                              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            }
                          } catch {}
                        }
                        return (msg as any).timestamp || "";
                      })()}
                    </span>
                    {(() => {
                      const pageNum =
                        (msg as any).page ||
                        (msg.citations && msg.citations.length > 0 ? msg.citations[0].page_number : undefined);
                      return pageNum ? (
                        <button
                          type="button"
                          onClick={() => onNavigatePdfPage(pageNum)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono cursor-pointer"
                          title={`Jump to Page ${pageNum}`}
                        >
                          [p. {pageNum}]
                        </button>
                      ) : null;
                    })()}
                  </div>

                  <div
                    className={`p-2.5 rounded-xl max-w-[92%] leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            <AITypingIndicator
              visible={isGenerating}
              activityState="analyzing"
              context="pdf_assistant"
              statusMessage="Copilot is analyzing context and passage..."
              variant="chat"
            />
          </div>

          {/* Quick chip bar when conversation is active */}
          {chatMessages.length > 0 && (
            <div className="px-2.5 py-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex gap-1 overflow-x-auto whitespace-nowrap bg-white/50 dark:bg-slate-900/50">
              {quickChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => void handleSendAi(chip.prompt)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Question Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendAi();
            }}
            className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask about Page ${currentPage}...`}
              disabled={isGenerating}
              className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isGenerating}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Tab 2: Paper Metadata & Citation Generator */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "metadata" && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs select-text">
          {/* Paper Title & Authors */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
              {paperTitle}
            </h3>
            {authors.length > 0 && (
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                {authors.join(", ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {venue && (
                <Badge variant="default" size="sm">
                  {venue}
                </Badge>
              )}
              {publicationYear && (
                <Badge variant="outline" size="sm">
                  {publicationYear}
                </Badge>
              )}
              {canonicalDoi && (
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  DOI: {canonicalDoi}
                </span>
              )}
            </div>
          </div>

          {/* Abstract */}
          {abstractText && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Abstract
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] bg-white dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {abstractText}
              </p>
            </div>
          )}

          {/* Citation Generator */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Citations & References
              </span>
              <Quote className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* APA */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  APA 7th Edition
                </span>
                <button
                  type="button"
                  onClick={handleCopyApa}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedApa ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy APA</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] font-serif leading-relaxed italic select-all">
                {apaCitation}
              </p>
            </div>

            {/* BibTeX */}
            <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  BibTeX Entry
                </span>
                <button
                  type="button"
                  onClick={handleCopyBibtex}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedBibtex ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy BibTeX</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-slate-700 dark:text-slate-300 text-[10px] font-mono leading-tight bg-slate-50 dark:bg-slate-900/80 p-2 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto select-all">
                {bibtexCitation}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Tab 3: SQLite Persistent Notes */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "notes" && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Note Input Form */}
          <form onSubmit={handleCreateNote} className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder={`Write a research note for Page ${currentPage}...`}
              rows={3}
              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachToPage}
                  onChange={(e) => setAttachToPage(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Attach to Page {currentPage}</span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newNoteText.trim() || isSavingNote || !paperId}
                className="text-xs h-7 px-2.5"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Save Note</span>
              </Button>
            </div>

            {!paperId && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Note: Save this paper to your library to persist SQLite notes.
              </p>
            )}
          </form>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 select-text">
            {isLoadingNotes ? (
              <div className="p-4 text-center text-slate-400 space-y-2">
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-indigo-500" />
                <span className="text-xs">Loading research notes...</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <StickyNote className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No Notes for This Paper Yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Take reading notes, log hypothesis thoughts, or save text selections directly into your local database.
                </p>
              </div>
            ) : (
              notes.map((note) => {
                // Parse page number if title matches "Page X"
                const pageMatch = note.title?.match(/Page\s+(\d+)/i);
                const notePage = pageMatch ? parseInt(pageMatch[1], 10) : null;

                return (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {notePage ? (
                          <button
                            type="button"
                            onClick={() => onNavigatePdfPage(notePage)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                            title={`Jump to Page ${notePage}`}
                          >
                            <span>P. {notePage}</span>
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                            {note.title || "Note"}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {new Date(note.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {note.content_markdown}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
