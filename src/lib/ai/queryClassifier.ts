/**
 * Deterministic Rule-Based Research Query Classifier
 * Phase 14: Fast zero-overhead intent classification without LLM calls.
 */

import type { ClassificationResult, ResearchQueryIntent } from "./types";

interface IntentRule {
  intent: ResearchQueryIntent;
  patterns: RegExp[];
  weight: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "compare_papers",
    patterns: [
      /\b(compare|comparison|versus|vs\.?|difference between|how does .+ differ|benchmark against)\b/i,
      /\b(contrast|head to head|which is better|relative performance)\b/i,
    ],
    weight: 1.0,
  },
  {
    intent: "explain_methodology",
    patterns: [
      /\b(method|methodology|how does (it|the model|the algorithm|this) work|pipeline|architecture|framework|training procedure|loss function|algorithmic design)\b/i,
      /\b(how did they implement|implementation details|mathematical formulation|system design)\b/i,
    ],
    weight: 0.9,
  },
  {
    intent: "extract_limitations",
    patterns: [
      /\b(limitation|limitations|weakness|weaknesses|drawback|drawbacks|caveat|caveats|failure cases?|what are the flaws|threats? to validity)\b/i,
      /\b(where does it fail|bottlenecks?|constraints?|unaddressed issues?)\b/i,
    ],
    weight: 0.95,
  },
  {
    intent: "extract_findings",
    patterns: [
      /\b(results?|findings?|performance|accuracy|f1|bleu|rouge|benchmark scores?|empirical gains?|metrics?|evaluation results?|sota)\b/i,
      /\b(how well did it perform|experimental outcomes?|quantitative results?|ablation study)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: "identify_gaps",
    patterns: [
      /\b(research gap|gaps?|future work|open questions?|unsolved problems?|what remains|future directions?|next steps?|unexplored)\b/i,
      /\b(missing pieces?|opportunities for improvement|where to go next)\b/i,
    ],
    weight: 0.95,
  },
  {
    intent: "define_terminology",
    patterns: [
      /\b(what is|what does .+ mean|define|definition of|explain the concept of|what is meant by|terminology|glossary)\b/i,
      /\b(clarify the term|concept explanation)\b/i,
    ],
    weight: 0.9,
  },
  {
    intent: "extract_contributions",
    patterns: [
      /\b(contributions?|main contribution|what is novel|novelty|key innovations?|key takeaways?|what did they contribute)\b/i,
      /\b(what's new|scientific advance)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: "extract_dataset",
    patterns: [
      /\b(dataset|datasets?|corpus|data collection|data preprocessing|benchmark dataset|training data|what data did they use)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: "extract_future_work",
    patterns: [
      /\b(future work|future directions?|subsequent research|planned extensions?)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: "summarize_paper",
    patterns: [
      /\b(summarize|summary|overview|tldr|tl;dr|abstract summary|executive summary|give me a rundown|high-level overview)\b/i,
      /\b(brief overview|explain this paper|what is this paper about)\b/i,
    ],
    weight: 0.8,
  },
];

export interface ClassifierOptions {
  activePaperCount?: number;
  selectedPaperIds?: string[];
}

export function classifyResearchQuery(
  query: string,
  options?: ClassifierOptions
): ClassificationResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      intent: "general_qa",
      confidence: 0.5,
      detectedEntities: [],
      isMultiPaper: false,
      reasoning: "Empty query defaulted to general QA",
    };
  }

  const paperCount = options?.activePaperCount ?? options?.selectedPaperIds?.length ?? 1;
  const isMultiExplicit = paperCount > 1;

  // Extract quoted entities or technical terms
  const quotedMatches = Array.from(trimmed.matchAll(/"([^"]+)"|'([^']+)'/g))
    .map((m) => m[1] || m[2])
    .filter(Boolean);

  let bestIntent: ResearchQueryIntent = "general_qa";
  let highestScore = 0;
  let matchingRuleReason = "No specific keyword rules matched; defaulted to general QA";

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        if (rule.weight > highestScore) {
          highestScore = rule.weight;
          bestIntent = rule.intent;
          matchingRuleReason = `Matched pattern "${pattern.source}" for intent ${rule.intent}`;
        }
      }
    }
  }

  // Multi-paper heuristic boost
  let isMultiPaper = isMultiExplicit;
  if (
    bestIntent === "compare_papers" ||
    /\b(across (both|the|all) papers|in each paper)\b/i.test(trimmed)
  ) {
    isMultiPaper = true;
  }

  // If multi-paper is active and query says "compare" or "contrast" but score was lower
  if (
    isMultiPaper &&
    bestIntent === "general_qa" &&
    /\b(both|between|either)\b/i.test(trimmed)
  ) {
    bestIntent = "compare_papers";
    highestScore = 0.8;
    matchingRuleReason = "Multi-paper context with comparison pronouns";
  }

  const confidence = highestScore > 0 ? highestScore : 0.65;

  return {
    intent: bestIntent,
    confidence,
    detectedEntities: quotedMatches,
    isMultiPaper,
    reasoning: matchingRuleReason,
  };
}
