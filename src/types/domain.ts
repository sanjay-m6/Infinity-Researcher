export type NavSection =
  | "dashboard"
  | "discover"
  | "library"
  | "downloads"
  | "collections"
  | "sources"
  | "activity"
  | "settings";

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
  isDemo: true;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
  isDemo: true;
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
  isDemo: true;
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
  isDemo: true;
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
  isDemo: true;
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
