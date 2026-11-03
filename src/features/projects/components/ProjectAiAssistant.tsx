import React, { useState } from "react";
import { Sparkles, Send, User, Copy, Check, FileText, Clock } from "lucide-react";
import { askProjectAiAssistant, saveNote } from "../../../lib/desktop-api";
import { Button } from "../../../components/ui/Button";
import { LiveOrb } from "../../../components/ui/live-orb";

interface ProjectAiAssistantProps {
  projectId: string;
  projectTitle: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  "What tasks should I prioritize next based on our milestones?",
  "Analyze our current progress and highlight any potential bottlenecks.",
  "Draft a literature review synthesis outline using our linked papers.",
  "Are any tasks blocked by unmet prerequisites?",
  "Suggest empirical evaluation metrics for our research questions.",
];

export const ProjectAiAssistant: React.FC<ProjectAiAssistantProps> = ({
  projectId,
  projectTitle,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello! I am your Project AI Copilot for **${projectTitle}**. I am grounded directly in this project's objectives, milestones, task dependencies, and linked literature. How can I assist your workflow today?`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const answer = await askProjectAiAssistant(projectId, textToSend);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: answer,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("AI Project Assistant error:", err);
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Error consulting AI assistant: ${err?.message || "Failed to contact provider."}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsNote = async (id: string, text: string) => {
    try {
      await saveNote({
        paper_id: projectId,
        title: `AI Analysis: ${projectTitle}`,
        content_markdown: text,
      });
      setSavedNoteId(id);
      setTimeout(() => setSavedNoteId(null), 2500);
    } catch {
      navigator.clipboard.writeText(text);
      setSavedNoteId(id);
      setTimeout(() => setSavedNoteId(null), 2500);
    }
  };

  return (
    <div className="flex flex-col h-[650px] border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Project AI Copilot</h3>
            <p className="text-[11px] text-muted-foreground">
              Grounded in current milestones, active tasks & linked papers
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setMessages([
              {
                id: "welcome_reset",
                role: "assistant",
                content: `History reset. Ready to analyze **${projectTitle}**.`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ])
          }
          className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {msg.role === "user" ? (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground">
                <User className="w-4 h-4" />
              </div>
            ) : (
              <LiveOrb
                size={26}
                interactive={false}
                blink
                variant="webgl"
                className="shrink-0"
              />
            )}

            <div
              className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-muted/40 border border-border text-foreground rounded-tl-none"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === "assistant" && msg.id !== "welcome" && (
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {msg.timestamp}
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAsNote(msg.id, msg.content)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {savedNoteId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    <span>{savedNoteId === msg.id ? "Saved to Notes" : "Save Note"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <LiveOrb size={26} interactive blink variant="webgl" className="shrink-0" />
            <div className="bg-muted/40 border border-border rounded-2xl rounded-tl-none p-3.5 text-xs text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Analyzing project structure & crafting response...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Pills */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/10 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase shrink-0">
          Suggestions:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-background border border-border hover:border-primary/40 text-foreground transition-colors hover:bg-muted/40 shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <div className="p-3.5 border-t border-border bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask anything about ${projectTitle}...`}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-xs"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};
