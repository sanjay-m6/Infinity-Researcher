/**
 * PDF Reader Workspace Domain Types & State Models
 * Phase 13: Infinity Researcher
 */

export type PdfViewerState =
  | "IDLE"
  | "RESOLVING_SOURCE"
  | "CHECKING_ACCESS"
  | "FETCHING_DOCUMENT"
  | "VALIDATING_DOCUMENT"
  | "PARSING_DOCUMENT"
  | "RENDERING_FIRST_PAGE"
  | "READY"
  | "RETRYABLE_ERROR"
  | "ACCESS_RESTRICTED"
  | "INVALID_DOCUMENT"
  | "CANCELLED";

export interface PdfBookmark {
  id: string;
  paperId: string;
  pageNumber: number;
  label: string;
  createdAt: string;
}

export interface PdfAnnotation {
  id: string;
  paperId: string;
  pageNumber: number;
  text: string;
  color?: string;
  comment?: string;
  createdAt: string;
}

export interface PdfOutlineItem {
  title: string;
  pageNumber?: number;
  dest?: unknown;
  items?: PdfOutlineItem[];
}

export interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
  text?: string;
}

export type FitMode = "custom" | "width" | "page";

export interface EmbeddedPdfViewerProps {
  paperId?: string | null;
  paperTitle: string;
  sourceUrl?: string | null;
  remotePdfUrl?: string | null;
  localFilePath?: string | null;
  targetPage?: number;
  onSaveOffline?: () => void;
  isSavingOffline?: boolean;
  onClose?: () => void;
  onOpenExternal?: () => void;
  onResolveAgain?: () => void;
  onRetry?: () => void;
  onImportLocal?: () => void;
  // Metadata for unified header & panels
  sourceName?: string | null;
  venue?: string | null;
  publicationYear?: number | string | null;
  canonicalDoi?: string | null;
  isDownloaded?: boolean;
  authors?: string[];
  abstractText?: string | null;
  // Multi-panel configuration
  initialLeftOpen?: boolean;
  initialRightOpen?: boolean;
  initialLeftTab?: "outline" | "thumbnails" | "bookmarks";
  initialRightTab?: "ai" | "metadata" | "notes";
  hideRightPanel?: boolean; // When rendered in views with existing side-by-side right panes (e.g. DiscoverView)
}

