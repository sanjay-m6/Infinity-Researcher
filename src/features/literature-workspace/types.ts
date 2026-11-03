// ---------------------------------------------------------------------------
// THREE-PANEL LITERATURE WORKSPACE DOMAIN TYPES
// ---------------------------------------------------------------------------

export type ExtractionStatus =
  | "imported"
  | "queued"
  | "extracting"
  | "ocr_required"
  | "extracted"
  | "partially_extracted"
  | "failed";

export interface LiteraturePaper {
  id: string;
  projectId?: string;
  title: string;
  authors: string[];
  publicationYear: number;
  abstract: string;
  venue?: string;
  doi?: string | null;
  sourceUrl?: string;
  localPdfPath?: string;
  hasFullText: boolean;
  isOpenAccess: boolean;
  extractionStatus: ExtractionStatus;
  extractionWarning?: string | null;
  tags: string[];
  notes?: string;
  documentHash: string;
  isDuplicate?: boolean;
}

export type WorkspaceTabId =
  | "survey"
  | "compare"
  | "gaps"
  | "writer"
  | "notes"
  | "figures";

export type EvidenceSupportRating =
  | "direct"
  | "related"
  | "contradictory"
  | "unverified";

export interface SourceEvidenceItem {
  id: string;
  paperId: string;
  paperTitle: string;
  pageNumber: number;
  verbatimExcerpt: string;
  contextSection?: string;
  confidenceScore: number;
  supportRating: EvidenceSupportRating;
  extractionMethod: "pdf_text" | "ocr" | "ai_inference" | "manual_entry";
  verifiedByResearcher: boolean;
  researcherNotes?: string;
}

export interface LiteratureSurveyRow {
  paperId: string;
  paperTitle: string;
  authors: string;
  year: number;
  objective: string;
  methodology: string;
  dataset: string;
  results: string;
  limitations: string;
  futureWork: string;
  evidence: Record<string, SourceEvidenceItem>;
}

export interface ResearchGapItem {
  id: string;
  title: string;
  description: string;
  category:
    | "repeated_limitations"
    | "underexplored_datasets"
    | "missing_evaluations"
    | "conflicting_findings"
    | "deployment_barriers";
  supportingPaperIds: string[];
  evidencePassages: {
    paperTitle: string;
    page: number;
    passage: string;
  }[];
  suggestedResearchQuestion: string;
  potentialConfidence: "strong_candidate" | "moderate_signal" | "exploratory";
  caveatNotice: string;
}

export interface WritingClaim {
  id: string;
  text: string;
  linkedPaperId?: string;
  linkedPaperTitle?: string;
  linkedPage?: number;
  evidenceSnippet?: string;
  supportRating?: EvidenceSupportRating;
  isAiGenerated?: boolean;
}

export interface WritingSection {
  id: string;
  title: string;
  content: string;
  claims: WritingClaim[];
}

export interface ResearchNote {
  id: string;
  paperId?: string;
  paperTitle?: string;
  pageNumber?: number;
  category: "quotation" | "methodology" | "empirical_finding" | "research_question" | "general";
  title: string;
  content: string;
  createdAt: string;
}

export interface ExtractedAssetItem {
  id: string;
  paperId: string;
  paperTitle: string;
  assetType: "figure" | "table" | "equation";
  title: string;
  caption: string;
  pageNumber: number;
  contentSnippet?: string;
  tableData?: string[][];
  sourceUrl?: string;
  attributionNotice: string;
}

export type SimilarityReviewCategory =
  | "exact_match"
  | "near_match"
  | "paraphrase_candidate"
  | "common_phrase"
  | "quoted_with_citation"
  | "bibliography_match";

export type SimilarityReviewStatus =
  | "unreviewed"
  | "acknowledged"
  | "properly_quoted"
  | "citation_attached"
  | "false_positive";

export interface SimilarityMatchFinding {
  id: string;
  draftSpanStart: number;
  draftSpanEnd: number;
  draftExcerpt: string;
  sourcePaperId: string;
  sourcePaperTitle: string;
  sourceExcerpt: string;
  sourcePageNumber: number;
  category: SimilarityReviewCategory;
  reviewStatus: SimilarityReviewStatus;
  similarityScore: number;
  reviewerNotes?: string;
}

