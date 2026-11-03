export type NavCategory = "research" | "ai_tools" | "workspace" | "system";

export type NavSection =
  // Research
  | "dashboard"
  | "discover"
  | "literature_workspace"
  | "library"
  | "research_assistant"
  | "paper_comparison"
  | "review_matrix"
  | "ieee"
  // AI Tools
  | "ai_tools"
  | "ai_writing_detector"
  | "plagiarism_checker"
  | "ai_humanizer"
  | "academic_writing_assistant"
  | "paraphrasing_tool"
  | "citation_checker"
  | "readability_analyzer"
  | "research_integrity"
  // Workspace
  | "projects"
  | "tasks"
  | "collections"
  | "saved_reports"
  | "history"
  | "downloads"
  | "activity"
  // System
  | "ai_models"
  | "ai_hub"
  | "ai_diagnostics"
  | "sources"
  | "settings"
  | "privacy_security";

export type AccessStatus = "open_access" | "restricted" | "preprint";
export type DocumentStatus =
  "available" | "downloading" | "unavailable" | "not_downloaded";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  publicationDate: string;
  year: number;
  venue: string;
  doi: string | null;
  sourceId: string;
  sourceName: string;
  landingUrl: string;
  pdfUrl: string | null;
  accessStatus: AccessStatus;
  documentStatus: DocumentStatus;
  tags: string[];
  collectionIds: string[];
  citationCount: number;
  addedAt: string;
  isSaved: boolean;
  isDemo?: boolean;
  openAccessStatus?: string;
  accessEvidenceType?: string;
  accessEvidenceNote?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  retrievalMethod?: string;
  accessConfirmedAt?: string | null;
  contentHash?: string | null;
  localPdfPath?: string | null;
  readingStatus?: string;
  readingProgress?: number;
  lastOpenedAt?: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobType = "pdf_download" | "metadata_fetch" | "text_extraction";

export interface DownloadJob {
  id: string;
  paperId: string;
  paperTitle: string;
  sourceName: string;
  jobType: JobType;
  status: JobStatus;
  progressPercent: number;
  stageMessage: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  isDemo?: boolean;
}

export type SourceCategory =
  "API" | "Repository" | "Structured Feed" | "Commercial (Link-Out)";
export type SourceStatus =
  "Supported" | "Not configured" | "Needs credentials" | "Restricted";

export interface SourceProvider {
  id: string;
  name: string;
  category: SourceCategory;
  tier: "Tier A" | "Tier B" | "Tier C";
  description: string;
  capabilities: string[];
  status: SourceStatus;
  rateLimit: string;
  docUrl: string;
  isDemo?: boolean;
}

export type ActivityType = "search" | "download" | "import" | "collection" | "system";
export type ActivityStatus = "success" | "warning" | "error" | "info";

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  details: string;
  relatedId?: string;
  isDemo?: boolean;
}

export interface SearchFilters {
  query: string;
  sources: string[];
  yearStart?: number;
  yearEnd?: number;
  accessOnly: boolean;
  hasAbstract: boolean;
  sortBy: "relevance" | "year_desc" | "year_asc" | "citations";
}

export type { SavedSearch } from "../lib/desktop-api/types";
