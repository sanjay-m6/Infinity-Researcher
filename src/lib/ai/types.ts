/**
 * Phase 14: AI Research Assistant and Paper Understanding Engine
 * Type definitions for structured paper understanding, query classification,
 * evidence verification, multi-paper comparison, and research-gap analysis.
 */

export type ResearchQueryIntent =
  | "summarize_paper"
  | "explain_methodology"
  | "extract_findings"
  | "extract_limitations"
  | "define_terminology"
  | "compare_papers"
  | "identify_gaps"
  | "extract_contributions"
  | "extract_dataset"
  | "extract_future_work"
  | "general_qa";

export interface ClassificationResult {
  intent: ResearchQueryIntent;
  confidence: number;
  detectedEntities: string[];
  isMultiPaper: boolean;
  reasoning: string;
}

export interface VerifiedEvidence {
  chunk_id: string;
  paper_id: string;
  page_number: number;
  section_heading?: string | null;
  snippet: string;
  is_verified: boolean;
  verification_method: "exact_match" | "token_overlap" | "backend_fts" | "unverified";
  confidence: number;
}

export interface StructuredPaperSummary {
  paper_id: string;
  title: string;
  core_problem: string;
  primary_objectives: string[];
  key_contributions: string[];
  proposed_method: string;
  empirical_findings: string[];
  limitations_author: string[];
  limitations_inferred: string[];
  future_directions: string[];
  evidence: VerifiedEvidence[];
}

export interface MethodologyAnalysis {
  paper_id: string;
  title: string;
  research_design: string;
  theoretical_framework?: string;
  datasets_or_materials: string[];
  baseline_comparisons: string[];
  experimental_protocol: string;
  evaluation_metrics: string[];
  reproducibility_assessment: string;
  evidence: VerifiedEvidence[];
}

export interface MetricFinding {
  name: string;
  value: string;
  baseline_value?: string;
  context?: string;
}

export interface ResultsAnalysis {
  paper_id: string;
  title: string;
  key_metrics: MetricFinding[];
  quantitative_claims: string[];
  statistical_significance?: string;
  ablation_insights: string[];
  unexpected_outcomes: string[];
  evidence: VerifiedEvidence[];
}

export interface LimitationsAnalysis {
  paper_id: string;
  title: string;
  author_acknowledged: string[];
  inferred_methodological: string[];
  inferred_scope_boundaries: string[];
  computational_or_data_constraints: string[];
  threats_to_validity: string[];
  evidence: VerifiedEvidence[];
}

export interface TerminologyExplanation {
  term: string;
  paper_definition: string;
  context_in_paper: string;
  simplified_explanation: string;
  related_concepts: string[];
  evidence: VerifiedEvidence[];
}

export interface DimensionCell {
  summary: string;
  evidence_snippets: string[];
  page_numbers: number[];
}

export interface ComparisonDimension {
  dimension: string;
  paper_values: Record<string, DimensionCell>;
  consensus_or_divergence: string;
}

export interface MultiPaperComparison {
  paper_ids: string[];
  paper_titles: Record<string, string>;
  dimensions: ComparisonDimension[];
  synthesized_takeaway: string;
  isolated_evidence: Record<string, VerifiedEvidence[]>;
}

export interface ResearchGap {
  title: string;
  description: string;
  gap_type:
    | "unaddressed_methodology"
    | "dataset_scarcity"
    | "conflicting_findings"
    | "scalability_gap"
    | "untested_assumption";
  scope_caveat: string;
  potential_investigation: string;
  grounded_papers: string[];
}

export interface ResearchGapAnalysis {
  collection_id?: string;
  paper_ids: string[];
  identified_gaps: ResearchGap[];
  field_wide_novelty_disclaimer: string;
  evidence: VerifiedEvidence[];
}

export interface PaperUnderstandingCacheEntry {
  cacheKey: string;
  data: unknown;
  timestamp: number;
}
