/**
 * AITypingIndicator — Consistent animated typing indicator
 * for all AI-powered features in Infinity Researcher.
 *
 * Provides a lightweight particle-themed animation that matches
 * the global loading aesthetic without requiring a full 3D scene.
 *
 * Variants:
 * - "chat": Compact dots for inline chat panels
 * - "workspace": Larger indicator with status text for AI workspaces
 * - "inline": Minimal single-line indicator
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";
import { ThinkingOrb, OrbState } from "thinking-orbs";

export type AIActivityState =
  | "idle"
  | "preparing"
  | "retrieving_context"
  | "reading_paper"
  | "analyzing"
  | "generating"
  | "streaming"
  | "validating_citations"
  | "completed"
  | "cancelled"
  | "failed";

export interface AITypingIndicatorProps {
  /** Whether the indicator is visible */
  visible: boolean;
  /** Current AI activity state */
  activityState?: AIActivityState;
  /** Custom status message (overrides default for activity state) */
  statusMessage?: string;
  /** Feature context for contextual messages */
  context?:
    | "research_assistant"
    | "matrix_copilot"
    | "pdf_assistant"
    | "paper_understanding"
    | "comparison"
    | "literature_review"
    | "general";
  /** Visual variant */
  variant?: "chat" | "workspace" | "inline";
  /** Additional CSS class */
  className?: string;
}

// Default messages per activity state and context
const DEFAULT_MESSAGES: Record<AIActivityState, Record<string, string>> = {
  idle: { general: "" },
  preparing: {
    general: "Preparing your question",
    research_assistant: "Preparing your question",
    matrix_copilot: "Reviewing matrix entries",
    pdf_assistant: "Extracting document context",
    paper_understanding: "Analyzing paper structure",
    comparison: "Organizing research findings",
    literature_review: "Organizing research findings",
  },
  retrieving_context: {
    general: "Retrieving relevant research",
    research_assistant: "Retrieving relevant research",
    matrix_copilot: "Gathering matrix evidence",
    pdf_assistant: "Locating relevant passages",
    paper_understanding: "Identifying key sections",
    comparison: "Collecting paper data",
    literature_review: "Gathering source material",
  },
  reading_paper: {
    general: "Reading paper content",
    pdf_assistant: "Analyzing the selected passage",
    paper_understanding: "Reading paper sections",
  },
  analyzing: {
    general: "Analyzing research data",
    research_assistant: "Analyzing research data",
    matrix_copilot: "Comparing selected papers",
    pdf_assistant: "Analyzing document evidence",
    paper_understanding: "Analyzing methodology and findings",
    comparison: "Comparing the available evidence",
    literature_review: "Comparing the available evidence",
  },
  generating: {
    general: "Generating an answer",
    research_assistant: "Generating an answer",
    matrix_copilot: "Preparing the research synthesis",
    pdf_assistant: "Preparing an evidence-based answer",
    paper_understanding: "Generating analysis",
    comparison: "Synthesizing comparison",
    literature_review: "Drafting the requested section",
  },
  streaming: {
    general: "Writing response",
  },
  validating_citations: {
    general: "Verifying citations",
  },
  completed: { general: "" },
  cancelled: { general: "Generation stopped" },
  failed: { general: "An error occurred" },
};

function getStatusMessage(
  state: AIActivityState,
  context: string,
  customMessage?: string
): string {
  if (customMessage) return customMessage;
  const stateMessages = DEFAULT_MESSAGES[state] || {};
  return stateMessages[context] || stateMessages.general || "";
}

/** Animated particle dots — lightweight version of the particle aesthetic */
const ParticleDots: React.FC<{ reducedMotion: boolean; size?: "sm" | "md" }> = ({
  reducedMotion,
  size = "sm",
}) => {
  const dotSize = size === "md" ? "w-2 h-2" : "w-1.5 h-1.5";
  const gapSize = size === "md" ? "gap-2" : "gap-1.5";

  return (
    <div className={`flex items-center ${gapSize}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className={`${dotSize} rounded-full`}
          style={{
            background: i % 2 === 0
              ? "rgba(226, 232, 240, 0.8)"
              : "rgba(129, 140, 248, 0.7)",
          }}
          animate={
            reducedMotion
              ? { opacity: [0.4, 0.8, 0.4] }
              : {
                  opacity: [0.3, 1, 0.3],
                  scale: [0.6, 1.2, 0.6],
                  y: [0, -3, 0],
                }
          }
          transition={{
            duration: reducedMotion ? 2 : 1.2,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export const AITypingIndicator: React.FC<AITypingIndicatorProps> = ({
  visible,
  activityState = "generating",
  statusMessage: customMessage,
  context = "general",
  variant = "chat",
  className = "",
}) => {
  const reducedMotion = useReducedMotionPreference();
  const message = getStatusMessage(activityState, context, customMessage);

  const orbState: OrbState = React.useMemo(() => {
    switch (activityState) {
      case "retrieving_context":
      case "reading_paper":
        return "searching";
      case "analyzing":
        return "solving";
      case "generating":
      case "streaming":
        return "composing";
      case "validating_citations":
        return "connecting";
      case "preparing":
        return "weaving";
      default:
        return "working";
    }
  }, [activityState]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
          className={`${className}`}
        >
          {variant === "inline" && (
            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
              <ThinkingOrb state={orbState} size={20} className="shrink-0" />
              <ParticleDots reducedMotion={reducedMotion} size="sm" />
              {message && <span className="text-slate-500 dark:text-slate-400">{message}</span>}
            </div>
          )}

          {variant === "chat" && (
            <div className="flex items-start gap-3 px-4 py-3">
              {/* AI Thinking Orb Avatar */}
              <div className="shrink-0 pt-0.5">
                <ThinkingOrb state={orbState} size={20} className="shrink-0" />
              </div>
              <div className="space-y-2 pt-1">
                <ParticleDots reducedMotion={reducedMotion} size="md" />
                {message && (
                  <motion.p
                    key={message}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-slate-400 dark:text-slate-500"
                  >
                    {message}
                  </motion.p>
                )}
              </div>
            </div>
          )}

          {variant === "workspace" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative flex items-center justify-center">
                <ThinkingOrb state={orbState} size={64} className="shadow-xl" />
              </div>
              {message && (
                <motion.p
                  key={message}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-slate-400 dark:text-slate-500 font-medium"
                >
                  {message}
                </motion.p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AITypingIndicator;

