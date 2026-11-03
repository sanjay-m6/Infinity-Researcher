export type WritingToolType = "ai_humanizer" | "academic_writing_assistant" | "paraphrasing_tool";

// ---------------------------------------------------------------------------
// Tool Modes
// ---------------------------------------------------------------------------

export type HumanizerModeId =
  | "natural_flow"
  | "clarity_concision"
  | "formal_tone"
  | "sentence_variety"
  | "remove_redundancy"
  | "improve_transitions"
  | "simplify_complex"
  | "paragraph_cohesion"
  | "grammar_language"
  | "improve_readability"
  | "technical_refinement"
  | "abstract_refinement";

export type AcademicWritingModeId =
  | "abstract_drafting"
  | "intro_improvement"
  | "lit_review_org"
  | "methodology_clarity"
  | "results_editing"
  | "discussion_refinement"
  | "conclusion_improvement"
  | "grammar_correction"
  | "academic_tone";

export type ParaphrasingModeId =
  | "sentence_level"
  | "paragraph_level"
  | "technical_paraphrase"
  | "simplification"
  | "concision"
  | "academic_restatement";

export type AnyWritingModeId = HumanizerModeId | AcademicWritingModeId | ParaphrasingModeId;

export interface ToolModeOption {
  id: AnyWritingModeId;
  label: string;
  description: string;
  badge?: string;
  iconName?: string;
}

// ---------------------------------------------------------------------------
// Token Preservation Guard Types
// ---------------------------------------------------------------------------

export type TokenType =
  | "citation"
  | "equation"
  | "doi"
  | "url"
  | "number"
  | "unit"
  | "date"
  | "technical_term"
  | "named_entity"
  | "negation"
  | "uncertainty"
  | "statistical_result";

export interface PreservedToken {
  type: TokenType;
  value: string;
  raw: string;
  index: number;
}

export type ValidationSeverity = "critical" | "warning" | "info";

export type ValidationCategory =
  | "token_preservation"
  | "semantic_drift"
  | "hedging_alteration"
  | "scientific_certainty"
  | "missing_content";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  title: string;
  description: string;
  originalSnippet?: string;
  revisedSnippet?: string;
  token?: PreservedToken;
  suggestedFix?: string;
}

export interface SemanticValidationResult {
  passed: boolean;
  score: number; // 0 - 100
  issues: ValidationIssue[];
  preservedTokensCount: number;
  missingTokensCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Revision History & Snapshots
// ---------------------------------------------------------------------------

export interface RevisionSnapshot {
  id: string;
  timestamp: number;
  modeId: string;
  modeName: string;
  toolType: WritingToolType;
  originalText: string;
  revisedText: string;
  wordCountDiff: number;
  charCountDiff: number;
  validationSummary: {
    passed: boolean;
    criticalCount: number;
    warningCount: number;
    score: number;
  };
  providerName: string;
}

// ---------------------------------------------------------------------------
// Diff Inspection Types
// ---------------------------------------------------------------------------

export type DiffChangeType = "unchanged" | "added" | "removed";

export interface DiffSegment {
  type: DiffChangeType;
  value: string;
}

export interface ParagraphPair {
  id: string;
  original: string;
  revised: string;
  accepted: boolean;
}

// ---------------------------------------------------------------------------
// AI Provider Options
// ---------------------------------------------------------------------------

export type WritingProviderId = "local_heuristics" | "ollama_local" | "remote_cloud";

export interface WritingProviderConfig {
  id: WritingProviderId;
  name: string;
  description: string;
  isLocal: boolean;
  requiresDataWarning: boolean;
  model: string;
}
