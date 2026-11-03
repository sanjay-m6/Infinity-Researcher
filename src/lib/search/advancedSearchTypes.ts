/**
 * Advanced Search and Filter Engine — Strongly-Typed Domain Models & Interfaces
 * Phase 12: Infinity Researcher
 */

export interface StructuredQueryFields {
  title?: string;
  author?: string;
  authors?: string[];
  year?: number;
  yearStart?: number;
  yearEnd?: number;
  doi?: string;
  source?: string;
  sources?: string[];
  contentType?: string;
  openAccess?: boolean;
  venue?: string;
  peerReviewed?: boolean;
}

export interface StructuredQuery {
  rawQuery: string;
  textTerms: string[];
  fields: StructuredQueryFields;
  hasSyntax: boolean;
  syntaxErrors: string[];
  warnings: string[];
}

export type PaginationType = "offset" | "cursor" | "page" | "none";

export interface AcademicSourceCapability {
  id: string;
  displayName: string;
  supportsFreeText: boolean;
  supportsTitle: boolean;
  supportsAuthor: boolean;
  supportsDoi: boolean;
  supportsYearFilter: boolean;
  supportsContentType: boolean;
  supportsOpenAccessFilter: boolean;
  supportsVenueFilter: boolean;
  supportsPagination: boolean;
  nativePaginationType: PaginationType;
  maxPageSize: number;
  defaultRateLimitMs: number;
  knownLimitations: string[];
}

export interface SearchPlan {
  rawQuery: string;
  structuredQuery: StructuredQuery;
  targetSources: string[];
  excludedSources: Array<{
    sourceId: string;
    reason: string;
  }>;
  sourceQuery: string;
  sourceFilters: {
    author?: string;
    year_start?: number;
    year_end?: number;
    content_type?: string;
    open_access_only?: boolean;
  };
  clientPostFilters: {
    title?: string;
    author?: string;
    yearStart?: number;
    yearEnd?: number;
    contentType?: string;
    openAccessOnly?: boolean;
    venue?: string;
    doi?: string;
    peerReviewedOnly?: boolean;
    textTerms?: string[];
  };
}

export interface RankingSignals {
  exactDoiMatch?: boolean;
  exactTitleMatch?: boolean;
  titlePrefixMatch?: boolean;
  titleTokenOverlap?: number;
  authorMatch?: boolean;
  abstractTokenOverlap?: number;
  venueMatch?: boolean;
  recencyBonus?: number;
  citationBonus?: number;
  openAccessBonus?: number;
  pdfAvailableBonus?: number;
}

export interface RankedPaperScore {
  totalScore: number;
  signals: RankingSignals;
  explanation: string;
}

export interface PaperCandidateForRanking {
  id: string;
  title: string;
  authors?: string[];
  canonical_doi?: string | null;
  abstract_text?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  is_open_access?: boolean;
  pdf_url?: string | null;
  local_pdf_path?: string | null;
  citation_count?: number | null;
  source_id?: string;
  source_name?: string;
  peer_reviewed?: boolean | null;
}
