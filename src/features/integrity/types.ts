// ---------------------------------------------------------------------------
// RESEARCH INTEGRITY UNIFIED AUDIT TYPES
// ---------------------------------------------------------------------------

export type IntegrityDimension =
  | "similarity"
  | "ai_signals"
  | "citations"
  | "references"
  | "readability"
  | "structure"
  | "extraction";

export type FindingStatus =
  | "verified"          // Verified compliant / grounded
  | "concern"           // Potential integrity or empirical concern
  | "technical_error"   // Tool failure, extraction artifact, or broken syntax
  | "inconclusive"      // Ambiguous signal or insufficient data
  | "reviewed";         // Author/Reviewer has verified and acknowledged

export type FindingSeverity = "critical" | "warning" | "info";

export type DimensionStatus =
  | "pass"
  | "attention_needed"
  | "concerns_found"
  | "technical_issue";

export interface IntegrityFinding {
  id: string;
  dimension: IntegrityDimension;
  title: string;
  description: string;
  status: FindingStatus;
  severity: FindingSeverity;
  confidence: string;            // e.g. "High (94%)", "Moderate Heuristic"
  evidence: string;              // Exact text snippet, metric, or DOI
  location: string;              // e.g. "Section: Methodology, Paragraph 2"
  suggestedAction: string;
  isReviewed: boolean;
  reviewedAt?: string | null;
  reviewerNotes?: string | null;
}

export interface DimensionSummary {
  dimension: IntegrityDimension;
  label: string;
  status: DimensionStatus;
  statusLabel: string;
  findingsCount: number;
  unreviewedCount: number;
  metrics: Record<string, string | number>;
  summaryText: string;
}

export interface UnifiedIntegrityReport {
  id: string;
  title: string;
  fileName: string;
  analyzedAt: string;
  wordCount: number;
  dimensions: Record<IntegrityDimension, DimensionSummary>;
  findings: IntegrityFinding[];
  ethicalDisclaimer: string;
}

export interface SavedIntegrityReportSummary {
  id: string;
  title: string;
  fileName: string;
  analyzedAt: string;
  findingsCount: number;
  concernsCount: number;
  reviewedCount: number;
}

