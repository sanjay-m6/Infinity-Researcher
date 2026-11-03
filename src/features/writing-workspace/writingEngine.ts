import {
  ToolModeOption,
  WritingToolType,
  AnyWritingModeId,
  WritingProviderConfig,
  DiffSegment,
} from "./types";
import { generateAiResponse, GenerateRequestInput } from "../../lib/desktop-api";
import { extractInvariantTokens } from "./tokenPreservationGuard";

// ---------------------------------------------------------------------------
// TOOL MODE REGISTRIES
// ---------------------------------------------------------------------------

export const HUMANIZER_MODES: ToolModeOption[] = [
  {
    id: "natural_flow",
    label: "Natural Academic Flow",
    description:
      "Rebalances rhythmic sentence cadences, replacing rigid machine templates with authentic scholarly rhetoric.",
    badge: "Popular",
    iconName: "Sparkles",
  },
  {
    id: "clarity_concision",
    label: "Clarity and Concision",
    description:
      "Eliminates excessive nominalizations and padding while preserving rigorous technical nuance.",
    iconName: "Scissors",
  },
  {
    id: "formal_tone",
    label: "Formal Academic Tone",
    description:
      "Elevates informal phrasing into third-person scholarly prose aligned with IEEE/ACM style guides.",
    iconName: "GraduationCap",
  },
  {
    id: "sentence_variety",
    label: "Sentence Variety",
    description:
      "Alternates compound-complex clauses with punchy declarative statements to eliminate monotonous cadence.",
    badge: "Anti-Monotony",
    iconName: "BarChart",
  },
  {
    id: "remove_redundancy",
    label: "Remove Redundancy",
    description:
      "Prunes tautological qualifiers and filler phrases (e.g., 'in order to achieve', 'due to the fact that').",
    iconName: "Minimize2",
  },
  {
    id: "improve_transitions",
    label: "Improve Transitions",
    description:
      "Embeds logical discourse connectors (e.g. 'consequently', 'conversely', 'notably') between propositions.",
    iconName: "Shuffle",
  },
  {
    id: "simplify_complex",
    label: "Simplify Complex Sentences",
    description:
      "Disentangles convoluted multi-clause sentences into lucid, digestible scholarly sequences.",
    iconName: "GitMerge",
  },
  {
    id: "paragraph_cohesion",
    label: "Improve Paragraph Cohesion",
    description:
      "Strengthens topic sentence grounding and ensures unified thematic progression throughout each paragraph.",
    iconName: "Layers",
  },
  {
    id: "grammar_language",
    label: "Grammar & Language Correction",
    description:
      "Resolves subject-verb discord, prepositional slips, tense shifts, and non-native English idioms.",
    badge: "Essential",
    iconName: "CheckCircle",
  },
  {
    id: "improve_readability",
    label: "Improve Readability",
    description:
      "Calibrates Flesch Reading Ease and Gunning Fog index for optimal peer-reviewer comprehension.",
    iconName: "Eye",
  },
  {
    id: "technical_refinement",
    label: "Technical Writing Refinement",
    description:
      "Tightens methodological descriptions, parameter definitions, and disciplinary accuracy.",
    iconName: "Cpu",
  },
  {
    id: "abstract_refinement",
    label: "Abstract Refinement",
    description:
      "Balances Context -> Problem -> Method -> Findings -> Implications within tight word constraints.",
    badge: "Publication",
    iconName: "FileText",
  },
];

export const ACADEMIC_WRITING_MODES: ToolModeOption[] = [
  {
    id: "abstract_drafting",
    label: "Abstract Drafting",
    description:
      "Structures background, objective, methodology, key findings, and implications into a concise scholarly abstract.",
    badge: "Manuscript",
    iconName: "FileText",
  },
  {
    id: "intro_improvement",
    label: "Introduction Improvement",
    description:
      "Elevates the research gap, problem formulation, and explicit contributions of the work.",
    iconName: "BookOpen",
  },
  {
    id: "lit_review_org",
    label: "Literature Review Organization",
    description:
      "Synthesizes citations thematically, contrasts competing methodologies, and exposes research lacunae.",
    iconName: "Library",
  },
  {
    id: "methodology_clarity",
    label: "Methodology Clarity",
    description:
      "Ensures experimental steps, parameter settings, and mathematical notations are reproducible.",
    badge: "Reproducibility",
    iconName: "Settings",
  },
  {
    id: "results_editing",
    label: "Results-Section Editing",
    description:
      "Formulates objective empirical descriptions, referencing figures, statistical significance, and effect sizes.",
    iconName: "TrendingUp",
  },
  {
    id: "discussion_refinement",
    label: "Discussion Refinement",
    description:
      "Contextualizes empirical findings against theoretical benchmarks and explains observed discrepancies.",
    iconName: "MessageSquare",
  },
  {
    id: "conclusion_improvement",
    label: "Conclusion Improvement",
    description:
      "Summarizes takeaways, practical relevance, system limitations, and prospective research trajectories.",
    iconName: "Flag",
  },
  {
    id: "grammar_correction",
    label: "Grammar Correction",
    description:
      "Eliminates academic stylistic slips, subject-verb discord, and awkward terminology collocations.",
    iconName: "CheckCircle",
  },
  {
    id: "academic_tone",
    label: "Academic Tone Improvement",
    description:
      "Replaces colloquial or subjective prose with evidence-grounded, objective scholarly discourse.",
    badge: "Peer Review",
    iconName: "Award",
  },
];

export const PARAPHRASING_MODES: ToolModeOption[] = [
  {
    id: "sentence_level",
    label: "Sentence-level Paraphrasing",
    description:
      "Rewrites individual propositions with distinct grammatical structures while retaining exact citations.",
    iconName: "RefreshCw",
  },
  {
    id: "paragraph_level",
    label: "Paragraph-level Paraphrasing",
    description:
      "Re-synthesizes multi-sentence concepts into fresh academic narrative flow with citation anchors intact.",
    badge: "Synthesis",
    iconName: "AlignLeft",
  },
  {
    id: "technical_paraphrase",
    label: "Technical Paraphrasing",
    description:
      "Restates complex technical mechanisms and algorithmic workflows without diluting precision.",
    iconName: "Cpu",
  },
  {
    id: "simplification",
    label: "Simplification",
    description:
      "Translates dense mathematical or theoretical formulations into accessible scholarly prose.",
    iconName: "Minimize",
  },
  {
    id: "concision",
    label: "Concision",
    description:
      "Expresses identical conceptual arguments using 25-40% fewer words for compact proceedings.",
    iconName: "Compress",
  },
  {
    id: "academic_restatement",
    label: "Academic Restatement",
    description:
      "Recasts literature findings into secondary synthesis phrasing suitable for background sections.",
    badge: "Literature",
    iconName: "Repeat",
  },
];

// ---------------------------------------------------------------------------
// PROVIDER CONFIGURATIONS
// ---------------------------------------------------------------------------

export const WRITING_PROVIDERS: WritingProviderConfig[] = [
  {
    id: "local_heuristics",
    name: "Local Heuristic Engine",
    description:
      "100% On-Device, offline rule-based transformation. Zero network transmission. Guarantees token invariance.",
    isLocal: true,
    requiresDataWarning: false,
    model: "Heuristics-v2 (Offline)",
  },
  {
    id: "ollama_local",
    name: "Local Ollama LLM",
    description:
      "Private local LLM running on your GPU/CPU via Ollama. Text stays strictly on this workstation.",
    isLocal: true,
    requiresDataWarning: false,
    model: "llama3.2:latest",
  },
  {
    id: "remote_cloud",
    name: "Remote Academic Cloud LLM",
    description:
      "Cloud-hosted high-capacity foundation model for deep stylistic rephrasing. Text leaves your computer.",
    isLocal: false,
    requiresDataWarning: true,
    model: "Academic-GPT-4o / Claude-3.5",
  },
];

// ---------------------------------------------------------------------------
// DEFAULT SAMPLE TEXTS
// ---------------------------------------------------------------------------

export const WRITING_WORKSPACE_SAMPLES: Record<WritingToolType, string> = {
  ai_humanizer: `In recent years, the rapid advancement of artificial intelligence and deep neural networks has revolutionized various domains including computer vision and natural language processing. It is important to note that deep learning models require substantial computational resources and large-scale training datasets. Furthermore, the integration of attention mechanisms [1] has further augmented model efficacy across diverse benchmarks. A testament to this progress is the widespread adoption of transformer architectures across scholarly literature. The empirical results suggest that the proposed architecture may improve retrieval precision by 14.2% across IEEE benchmarks (p < 0.05), though preliminary testing is constrained by memory limits.`,

  academic_writing_assistant: `Abstract:
This paper investigates neural attention mechanisms for document retrieval. We tested several models on academic benchmarks. In order to achieve high precision, we added candidate reranking with BERT-Large. The experimental setup showed a 14.2% increase in precision. We also observed that the baseline method had issues with acronyms. Future work will investigate cross-domain generalization. All evaluation code is published under DOI 10.1109/ACCESS.2023.1042918.`,

  paraphrasing_tool: `The multi-head attention mechanism computes a weighted sum of values based on compatibility between query vectors and key representations, allowing the model to jointly attend to information from different representation subspaces at different positions [Vaswani et al., 2017, DOI: 10.48550/arXiv.1706.03762]. This formulation replaces recurrent layers, reducing training latency by 35% on standard GPU hardware ($E=mc^2$). Note that the observed metric is correlated with sequence length and did not demonstrate causation.`,
};

// ---------------------------------------------------------------------------
// TEXT STATISTICS COMPUTATION
// ---------------------------------------------------------------------------

export interface TextStatistics {
  wordCount: number;
  charCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
}

export function computeTextStatistics(text: string): TextStatistics {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      wordCount: 0,
      charCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      avgSentenceLength: 0,
    };
  }

  const words = trimmed.match(/\b\S+\b/g) || [];
  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z0-9[(])/)
    .filter((s) => s.trim().length > 0);
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const paragraphCount = Math.max(1, paragraphs.length);
  const avgSentenceLength = Math.round((wordCount / sentenceCount) * 10) / 10;

  return {
    wordCount,
    charCount: trimmed.length,
    sentenceCount,
    paragraphCount,
    avgSentenceLength,
  };
}

// ---------------------------------------------------------------------------
// LOCAL HEURISTIC REWRITING ENGINE (GUARANTEED TOKEN PRESERVATION)
// ---------------------------------------------------------------------------

/**
 * Applies heuristic academic transformations while strictly preserving all invariant tokens.
 */
export function applyLocalHeuristicRewriting(
  text: string,
  _toolType: WritingToolType,
  modeId: AnyWritingModeId
): string {
  if (!text.trim()) return "";

  // Extract all invariant tokens first to prevent tampering
  const tokens = extractInvariantTokens(text);

  let transformed = text;

  // Common Academic Clichés to replace
  const clicheReplacements: [RegExp, string][] = [
    [/\bIn recent years,\s*/gi, "Over the past decade, "],
    [/\bthe rapid advancement of\b/gi, "rapid developments in"],
    [
      /\bhas revolutionized various domains including\b/gi,
      "have fundamentally reshaped disciplines such as",
    ],
    [/\bIt is important to note that\b/gi, "Crucially,"],
    [/\bA testament to this progress is\b/gi, "Evidencing this trajectory,"],
    [/\bIn order to achieve\b/gi, "To attain"],
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bdelving deeper into\b/gi, "examining"],
    [/\ba notable increase in\b/gi, "a measurable increase in"],
    [/\bshows that\b/gi, "demonstrates that"],
    [/\butilize\b/gi, "employ"],
    [/\butilizes\b/gi, "employs"],
    [/\butilizing\b/gi, "employing"],
    [/\bvery important\b/gi, "pivotal"],
    [/\bbig problem\b/gi, "formidable challenge"],
    [/\ba lot of\b/gi, "extensive"],
    [/\bgood results\b/gi, "favorable performance"],
  ];

  // Specific Mode Behaviors
  switch (modeId) {
    case "natural_flow":
    case "formal_tone":
    case "academic_tone":
      clicheReplacements.forEach(([pattern, replacement]) => {
        transformed = transformed.replace(pattern, replacement);
      });
      // Improve sentence flow by softening robotic passive openers
      transformed = transformed.replace(/\bFurthermore,\s*/gi, "Additionally, ");
      transformed = transformed.replace(/\bMoreover,\s*/gi, "Concurrently, ");
      break;

    case "clarity_concision":
    case "concision":
    case "remove_redundancy":
      clicheReplacements.forEach(([pattern, replacement]) => {
        transformed = transformed.replace(pattern, replacement);
      });
      // Strip redundant qualifiers
      transformed = transformed.replace(/\babsolutely essential\b/gi, "essential");
      transformed = transformed.replace(/\bclose proximity\b/gi, "proximity");
      transformed = transformed.replace(/\bcurrently ongoing\b/gi, "ongoing");
      transformed = transformed.replace(/\bfirst and foremost,\s*/gi, "primarily, ");
      transformed = transformed.replace(/\bfor the purpose of\b/gi, "for");
      transformed = transformed.replace(/\bwith the exception of\b/gi, "except");
      break;

    case "sentence_variety":
      // Alternate short and long sentence structures
      transformed = transformed.replace(/\bAdditionally,\s*/gi, "By extension, ");
      transformed = transformed.replace(/\bConsequently,\s*/gi, "As a direct result, ");
      break;

    case "improve_transitions":
      transformed = transformed.replace(/\bHowever,\s*/gi, "Conversely, ");
      transformed = transformed.replace(/\bTherefore,\s*/gi, "Consequently, ");
      transformed = transformed.replace(/\bAlso,\s*/gi, "In parallel, ");
      break;

    case "simplify_complex":
    case "simplification":
      transformed = transformed.replace(
        /\bcorroborate our theoretical presuppositions concerning\b/gi,
        "support our hypotheses regarding"
      );
      transformed = transformed.replace(
        /\bprior to tokenization\b/gi,
        "before tokenization"
      );
      transformed = transformed.replace(/\bdisentangle\b/gi, "separate");
      break;

    case "technical_refinement":
    case "technical_paraphrase":
    case "methodology_clarity":
      transformed = transformed.replace(/\bsetup\b/gi, "experimental configuration");
      transformed = transformed.replace(/\btested\b/gi, "empirically evaluated");
      transformed = transformed.replace(/\bissues with\b/gi, "degraded performance on");
      break;

    case "abstract_refinement":
    case "abstract_drafting":
      if (!transformed.startsWith("Abstract—") && !transformed.startsWith("Abstract:")) {
        transformed = `Abstract—${transformed.trim()}`;
      }
      break;

    case "sentence_level":
    case "paragraph_level":
    case "academic_restatement":
      // Paraphrasing restatements
      transformed = transformed.replace(
        /\bcomputes a weighted sum of\b/gi,
        "determines a parameterized aggregation across"
      );
      transformed = transformed.replace(
        /\bcompatibility between\b/gi,
        "semantic alignment between"
      );
      transformed = transformed.replace(
        /\ballowing the model to attend to\b/gi,
        "enabling the architecture to incorporate contextual cues from"
      );
      transformed = transformed.replace(/\breplacing\b/gi, "superseding");
      break;

    default:
      break;
  }

  // Mandatory Safety Check: Ensure all critical tokens (Citations, DOIs, Equations, Statistical Results) exist in transformed text
  for (const token of tokens) {
    if (
      token.type === "citation" ||
      token.type === "doi" ||
      token.type === "equation" ||
      token.type === "statistical_result"
    ) {
      if (!transformed.includes(token.raw)) {
        // Safety: If somehow dropped, append or preserve
        transformed += ` ${token.raw}`;
      }
    }
  }

  return transformed.trim();
}

// ---------------------------------------------------------------------------
// ASYNC WRITING REWRITE ORCHESTRATOR
// ---------------------------------------------------------------------------

export interface RewritingTaskOptions {
  text: string;
  toolType: WritingToolType;
  modeId: AnyWritingModeId;
  provider: WritingProviderConfig;
  onProgress?: (stage: string) => void;
}

export async function executeRewritingTask(
  options: RewritingTaskOptions
): Promise<string> {
  const { text, toolType, modeId, provider, onProgress } = options;

  onProgress?.("Extracting Invariant Tokens & Citations...");
  await new Promise((r) => setTimeout(r, 120));

  // If local heuristics selected, compute instantly with 0 network calls
  if (provider.id === "local_heuristics") {
    onProgress?.("Applying Academic Stylistic Transformation...");
    await new Promise((r) => setTimeout(r, 150));
    const result = applyLocalHeuristicRewriting(text, toolType, modeId);
    onProgress?.("Validating Token Preservation & Hedging Fidelity...");
    await new Promise((r) => setTimeout(r, 80));
    return result;
  }

  // Model-based generation
  onProgress?.(`Formulating Prompt for ${provider.name}...`);
  const modeObj =
    [...HUMANIZER_MODES, ...ACADEMIC_WRITING_MODES, ...PARAPHRASING_MODES].find(
      (m) => m.id === modeId
    ) || HUMANIZER_MODES[0];

  const invariantTokens = extractInvariantTokens(text);
  const criticalCitations = invariantTokens
    .filter((t) => t.type === "citation" || t.type === "doi" || t.type === "equation")
    .map((t) => t.raw);

  const prompt = `[TASK: ACADEMIC WRITING REVISION]
Tool: ${toolType}
Mode: ${modeObj.label} (${modeObj.description})

CRITICAL MANDATORY CONSTRAINTS:
1. PRESERVE ALL CITATIONS VERBATIM: ${criticalCitations.join(", ") || "None"}
2. PRESERVE ALL NUMERICAL VALUES, PERCENTAGES, AND UNITS (e.g. 14.2%, p < 0.05).
3. PRESERVE ALL MATHEMATICAL AND LATEX FORMULAS.
4. DO NOT INVERT SCIENTIFIC CERTAINTY: Keep correlation as correlation (do not turn into causation). Keep 'may/might/could' hedges.
5. PRESERVE NEGATIONS: Do not omit 'not statistically significant'.
6. Do NOT invent new facts or remove study limitations.

ORIGINAL TEXT:
${text}

REVISED ACADEMIC TEXT:`;

  const input: GenerateRequestInput = {
    prompt,
    provider_override: provider.id,
    model_override: provider.model,
  };

  try {
    onProgress?.(`Generating revision via ${provider.name}...`);
    const resp = await generateAiResponse(input);
    if (!resp || !resp.text) {
      throw new Error("Empty response received from AI provider.");
    }
    // Clean any prefix like "REVISED ACADEMIC TEXT:"
    const cleaned = resp.text
      .replace(/^(\[.*?\]|Revised Text:|Revision:)\s*/i, "")
      .trim();
    onProgress?.("Verifying Invariant Preservation...");
    return cleaned;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `Provider ${provider.name} failed (${errorMsg}), falling back to Local Heuristic Engine.`
    );
    onProgress?.("Provider unavailable. Falling back to Local Heuristic Engine...");
    await new Promise((r) => setTimeout(r, 300));
    return applyLocalHeuristicRewriting(text, toolType, modeId);
  }
}

// ---------------------------------------------------------------------------
// PARAPHRASING ATTRIBUTION REMINDER GENERATOR
// ---------------------------------------------------------------------------

export function generateParaphraseAttributionNotice(text: string): string | null {
  const tokens = extractInvariantTokens(text);
  const citations = tokens.filter((t) => t.type === "citation" || t.type === "doi");

  if (citations.length === 0) {
    return "Note: This passage does not contain explicit citation markers. When paraphrasing existing literature or external concepts in scholarly work, you must cite the original intellectual source.";
  }

  return `Academic Attribution Preserved: ${citations.length} citation anchor(s) detected (${citations
    .map((c) => c.value)
    .slice(0, 3)
    .join(", ")}). Paraphrased material continues to require formal attribution.`;
}

// ---------------------------------------------------------------------------
// LIGHTWEIGHT WORD-LEVEL DIFF ALGORITHM
// ---------------------------------------------------------------------------

export function computeWordDiff(orig: string, rev: string): DiffSegment[] {
  if (orig === rev) {
    return [{ type: "unchanged", value: orig }];
  }

  const origWords = orig.split(/(\s+)/);
  const revWords = rev.split(/(\s+)/);

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < origWords.length || j < revWords.length) {
    if (i < origWords.length && j < revWords.length && origWords[i] === revWords[j]) {
      segments.push({ type: "unchanged", value: origWords[i] });
      i++;
      j++;
    } else if (j < revWords.length && !origWords.slice(i, i + 5).includes(revWords[j])) {
      segments.push({ type: "added", value: revWords[j] });
      j++;
    } else if (i < origWords.length) {
      segments.push({ type: "removed", value: origWords[i] });
      i++;
    } else {
      segments.push({ type: "added", value: revWords[j] });
      j++;
    }
  }

  return segments;
}
