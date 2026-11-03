// ---------------------------------------------------------------------------
// CITATION CHECKER CORE DOMAIN TYPES
// ---------------------------------------------------------------------------

export type CitationStyleType = "ieee" | "apa" | "mla" | "chicago" | "harvard" | "bibtex";

export type InTextCitationStyle = "numeric" | "author_year" | "latex_cite";

export type CitationIssueSeverity = "critical" | "warning" | "info";

export type CitationIssueCategory =
  | "missing_reference"        // In-text citation without corresponding bibliography entry
  | "uncited_reference"         // Bibliography reference never cited in document text
  | "duplicate_reference"       // Duplicate reference entry
  | "malformed_doi"            // DOI fails syntactic validation
  | "doi_resolution_failed"    // DOI valid syntax but could not be resolved
  | "metadata_discrepancy"     // Discrepancy between reference and canonical registry
  | "incomplete_metadata"      // Missing year, venue, authors, or pagination
  | "mixed_citation_styles";   // Document mixes conflicting citation styles

export interface InTextCitation {
  id: string;
  raw: string;                  // e.g. "[1]", "[1, 2]", "(Vaswani et al., 2017)", "\cite{bert2018}"
  normalizedKey: string;        // e.g. "1", "vaswani et al., 2017", "bert2018"
  keys: string[];               // e.g. ["1", "2"] for multi-citations
  style: InTextCitationStyle;
  contextSentence: string;
  startIndex: number;
  endIndex: number;
  matchedReferenceIds: string[];
}

export interface VerifiedDoiMetadata {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  publisher?: string;
  citationCount?: number;
  sourceUrl?: string;
}

export interface DoiStatus {
  syntaxValid: boolean;
  rawInput: string;
  canonicalDoi?: string | null;
  syntaxErrorNote?: string | null;
  resolved: boolean | null;     // true = resolved, false = failed/404, null = unverified/offline
  resolutionSource?: string | null;
  verifiedMetadata?: VerifiedDoiMetadata | null;
  resolutionStatusLabel: string;
}

export interface ParsedReference {
  id: string;                   // "ref_1"
  key: string;                  // "1", "Vaswani 2017", "bert2018"
  rawText: string;
  authors: string[];
  title?: string | null;
  year?: number | null;
  venue?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
  detectedStyle: CitationStyleType;
  doiStatus: DoiStatus;
  inTextCitationCount: number;
  isDuplicateOfId?: string;
}

export interface MetadataComparison {
  field: "title" | "year" | "authors" | "venue";
  label: string;
  referenceValue: string;
  registryValue: string;
}

export interface CitationIssue {
  id: string;
  severity: CitationIssueSeverity;
  category: CitationIssueCategory;
  title: string;
  description: string;
  sourceSnippet?: string;
  referenceId?: string;
  citationId?: string;
  suggestedFix?: string;
  comparison?: MetadataComparison;
}

export interface CitationAuditSummary {
  totalInTextCitations: number;
  totalUniqueReferences: number;
  matchedCitationsCount: number;
  orphanCitationsCount: number;       // cited in text but missing reference
  uncitedReferencesCount: number;      // reference exists but never cited
  duplicateReferencesCount: number;
  malformedDoiCount: number;
  verifiedDoiCount: number;
  metadataDiscrepancyCount: number;
  incompleteMetadataCount: number;
  overallHealthScore: number;          // 0 - 100
  dominantStyle: CitationStyleType;
  hasMixedStyles: boolean;
  claimSupportDisclaimer: string;
}

export interface CitationAuditReport {
  id: string;
  analyzedAt: string;
  documentTitle: string;
  summary: CitationAuditSummary;
  inTextCitations: InTextCitation[];
  references: ParsedReference[];
  issues: CitationIssue[];
}

