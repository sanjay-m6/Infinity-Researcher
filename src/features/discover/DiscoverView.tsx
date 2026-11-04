import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SourceBadge } from "../../components/ui/SourceBadge";
import {
  Skeleton,
  PaperCardSkeleton,
  TextSkeleton,
  CardSkeleton,
} from "../../components/ui/Skeleton";
import { EmbeddedPdfViewer } from "../../components/pdf-viewer/EmbeddedPdfViewer";
import {
  listCrawlProfiles,
  previewUrlExtraction,
  startCrawlJob,
  listCrawlJobs,
  pauseCrawlJob,
  resumeCrawlJob,
  cancelCrawlJob,
  listCrawledPapers,
  importSinglePage,
  enqueuePdfDownload,
  listPdfDownloadJobs,
  resolvePaperPdf,
  getNotesForPaper,
  saveNote,
  deleteNote,
  toggleSavePaper,
  addPaperToCollection,
  removePaperFromCollection,
  listWebsiteSearchSources,
  startWebsiteSearchStream,
  cancelWebsiteSearch,
  startPythonSearchStream,
  cancelPythonSearch,
  getPythonEngineStatus,
  PythonEngineStatus,
  importDiscoveredSearchResult,
  CrawlProfile,
  CrawlJob,
  CrawlJobPaper,
  ExtractionPreviewResult,
  DbNote,
  DownloadJob,
  getScrapingEngineDiagnostics,
  EngineDiagnostics,
  checkAcademicProviderHealth,
  getAcademicProviderCapabilities,
  enrichPaperMetadata,
  ProviderCapabilities,
  ProviderHealthCheck,
  WebsiteSourceDescriptor,
  DiscoveredSearchResult,
  SourceSearchStatus,
  SearchStreamEvent,
  addPaperToMatrix,
  getErrorMessage,
} from "../../lib/desktop-api";
import {
  Globe,
  Key,
  Play,
  Pause,
  Code2,
  BookOpen,
  FileText,
  BarChart2,
  Compass,
  Search,
  Info,
  Bookmark,
  Cloud,
  Unlock,
  ExternalLink,
  Copy,
  Check,
  Sidebar,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  History,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Award,
  RefreshCw,
  Activity,
  Clock,
  MessageSquare,
  Lightbulb,
  TableProperties,
  Plus,
  Upload,
  Edit3,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  WifiOff,
} from "lucide-react";
import { discoverSessionStore } from "./discoverSessionStore";
import { DiscoverPaperAssistant } from "./DiscoverPaperAssistant";
import { PaperImportModal } from "./PaperImportModal";
import {
  parseStructuredQuery,
  createSearchPlan,
  satisfiesClientPostFilters,
  compareRankedPapers,
  isDuplicatePaper,
  mergeDuplicateRecords,
} from "../../lib/search";

// Unified item representation for the three-pane workspace
export interface UnifiedDiscoverPaper {
  id: string;
  paper_id?: string | null;
  title: string;
  authors: string[];
  publication_date?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  pdf_url?: string | null;
  url: string;
  is_imported: boolean;
  is_downloaded: boolean;
  local_pdf_path?: string | null;
  is_open_access: boolean;
  source_name: string;
  source_id?: string;
  content_type?: string;
  license_name?: string | null;
  peer_reviewed?: boolean | null;
  subject_tags?: string[];
  language?: string | null;
  relevance_score?: number;
  metadata_confidence?: number | null;
  collection_ids?: string[];
  citation_count?: number | null;
  version_type?: string | null;
  identity_status?: string | null;
  identity_score?: number | null;
}

const DEFAULT_WEBSITE_SOURCES: WebsiteSourceDescriptor[] = [
  {
    id: "arxiv",
    name: "arXiv Preprints",
    domain: "arxiv.org",
    status: "enabled",
    policy_url: "https://arxiv.org/help/robots",
    policy_notes: "Permitted HTML search and metadata extraction with 3s crawl delay.",
    supports_native_years: false,
    request_delay_ms: 3000,
    content_types: ["preprint"],
  },
  {
    id: "biorxiv",
    name: "bioRxiv Preprints",
    domain: "biorxiv.org",
    status: "enabled",
    policy_url: "https://www.biorxiv.org/about/faq",
    policy_notes:
      "Cold Spring Harbor Laboratory preprint repository. Permitted HTML search.",
    supports_native_years: true,
    request_delay_ms: 2000,
    content_types: ["preprint"],
  },
  {
    id: "medrxiv",
    name: "medRxiv Preprints",
    domain: "medrxiv.org",
    status: "enabled",
    policy_url: "https://www.medrxiv.org/about/faq",
    policy_notes: "Medical preprint server. Permitted HTML search.",
    supports_native_years: true,
    request_delay_ms: 2000,
    content_types: ["preprint"],
  },
  {
    id: "plos",
    name: "PLOS Open Access Journals",
    domain: "journals.plos.org",
    status: "enabled",
    policy_url: "https://journals.plos.org/plosone/s/content-license",
    policy_notes: "100% open-access peer-reviewed journals under CC BY.",
    supports_native_years: true,
    request_delay_ms: 2000,
    content_types: ["journal_article"],
  },
  {
    id: "nature_srep",
    name: "Nature Scientific Reports",
    domain: "nature.com",
    status: "enabled",
    policy_url: "https://www.nature.com/srep/about",
    policy_notes: "Open-access peer-reviewed research from Nature Portfolio.",
    supports_native_years: false,
    request_delay_ms: 2500,
    content_types: ["journal_article"],
  },
  {
    id: "pmc",
    name: "PubMed Central (PMC)",
    domain: "pmc.ncbi.nlm.nih.gov",
    status: "enabled",
    policy_url: "https://pmc.ncbi.nlm.nih.gov/about/mou/",
    policy_notes: "Public web interface and Open Access subset.",
    supports_native_years: false,
    request_delay_ms: 3000,
    content_types: ["journal_article"],
  },
  {
    id: "ieee_xplore",
    name: "IEEE Xplore",
    domain: "ieeexplore.ieee.org",
    status: "enabled",
    policy_url: "https://ieeexplore.ieee.org/XploreHelp/legal-terms",
    policy_notes:
      "IEEE conference and journal research publications via official REST and Crossref prefix index.",
    supports_native_years: true,
    request_delay_ms: 1000,
    content_types: ["conference_paper", "journal_article"],
  },
  {
    id: "semantic_scholar",
    name: "Semantic Scholar",
    domain: "api.semanticscholar.org",
    status: "enabled",
    policy_url: "https://www.semanticscholar.org/product/api",
    policy_notes: "Semantic Scholar Graph API with official OpenAccessPdf discovery.",
    supports_native_years: true,
    request_delay_ms: 1000,
    content_types: ["journal_article", "preprint", "conference_paper"],
  },
  {
    id: "openalex",
    name: "OpenAlex",
    domain: "api.openalex.org",
    status: "enabled",
    policy_url: "https://openalex.org/",
    policy_notes:
      "Global open scholarly catalog with institutional repository location discovery.",
    supports_native_years: true,
    request_delay_ms: 500,
    content_types: ["journal_article", "preprint", "conference_paper"],
  },
  {
    id: "core_api",
    name: "CORE Repositories",
    domain: "api.core.ac.uk",
    status: "enabled",
    policy_url: "https://core.ac.uk/services/api",
    policy_notes:
      "Aggregator of institutional repositories and university preprints worldwide.",
    supports_native_years: true,
    request_delay_ms: 1000,
    content_types: ["journal_article", "preprint"],
  },
  {
    id: "acm_dl",
    name: "ACM Digital Library",
    domain: "dl.acm.org",
    status: "enabled",
    policy_url: "https://www.acm.org/about-acm/terms-of-use",
    policy_notes:
      "ACM Digital Library publications and conference proceedings via Crossref prefix 10.1145 and ACM DL indexing.",
    supports_native_years: true,
    request_delay_ms: 1000,
    content_types: ["conference_paper", "journal_article"],
  },
  {
    id: "google_scholar",
    name: "Google Scholar",
    domain: "scholar.google.com",
    status: "enabled",
    policy_url: "https://policies.google.com/terms",
    policy_notes:
      "Google Scholar query discovery with live parsing and automated open scholarly catalog fallback.",
    supports_native_years: true,
    request_delay_ms: 1500,
    content_types: ["all"],
  },
];

export const DiscoverView: React.FC = () => {
  const {
    papers,
    collections,
    refreshDatabase,
    showToast,
    globalSearchQuery,
    setActiveSection,
    setSelectedPaperId: setGlobalSelectedPaperId,
    setReadingPaper,
  } = useApp();

  // ---------------------------------------------------------------------------
  // Backed by discoverSessionStore to guarantee zero reset across navigation
  // ---------------------------------------------------------------------------
  const session = discoverSessionStore.getState();

  // Primary mode tabs
  const [activeTab, setActiveTab] = useState<"website" | "academic">("website");
  const [scrapingEngine, setScrapingEngine] = useState<"rust" | "python">(
    session.activeEngine
  );
  const [pythonEngineStatus, setPythonEngineStatus] = useState<PythonEngineStatus | null>(
    null
  );

  // Check Python engine health on mount
  useEffect(() => {
    getPythonEngineStatus()
      .then((status) => {
        setPythonEngineStatus(status);
      })
      .catch(() => {});
  }, []);

  // Engine diagnostics state (Phase L & Phase 17)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [engineDiagnostics, setEngineDiagnostics] = useState<EngineDiagnostics | null>(
    null
  );
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [academicCapabilities, setAcademicCapabilities] = useState<
    ProviderCapabilities[]
  >([]);
  const [academicHealthChecks, setAcademicHealthChecks] = useState<ProviderHealthCheck[]>(
    []
  );
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isEnrichingMetadata, setIsEnrichingMetadata] = useState(false);

  const handleOpenDiagnostics = async () => {
    setIsDiagnosticsOpen(true);
    setIsLoadingDiagnostics(true);
    try {
      const [diag, caps, health] = await Promise.all([
        getScrapingEngineDiagnostics().catch(() => null),
        getAcademicProviderCapabilities().catch(() => []),
        checkAcademicProviderHealth().catch(() => []),
      ]);
      setEngineDiagnostics(diag);
      setAcademicCapabilities(caps);
      setAcademicHealthChecks(health);
    } catch (err) {
      console.error("Failed to load engine diagnostics:", err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await checkAcademicProviderHealth();
      setAcademicHealthChecks(health);
    } catch (err) {
      console.error("Failed to run academic health check:", err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleEnrichSelectedPaper = async () => {
    if (!selectedPaper?.paper_id) return;
    setIsEnrichingMetadata(true);
    try {
      const updated = await enrichPaperMetadata(selectedPaper.paper_id);
      if (updated) {
        setDiscoveredResults((prev) =>
          prev.map((p) => {
            if (
              p.id === selectedPaper.id ||
              p.landing_url === selectedPaper.url ||
              (p.canonical_doi &&
                selectedPaper.canonical_doi &&
                p.canonical_doi.toLowerCase() ===
                  selectedPaper.canonical_doi.toLowerCase())
            ) {
              return {
                ...p,
                abstract_text: updated.abstract_text || p.abstract_text,
                venue: updated.venue || p.venue,
                citation_count: updated.citation_count ?? p.citation_count,
                pdf_url: updated.pdf_url || p.pdf_url,
                is_open_access: updated.is_open_access || p.is_open_access,
              };
            }
            return p;
          })
        );
        showToast("Paper metadata successfully enriched", "success");
      }
    } catch (err) {
      console.error("Failed to enrich paper metadata:", err);
      showToast("Metadata enrichment failed or already up to date", "warning");
    } finally {
      setIsEnrichingMetadata(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Part B: Query-First Search Experience State
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState<string>(
    globalSearchQuery || session.searchQuery || ""
  );
  const [submittedQuery, setSubmittedQuery] = useState<string>(
    session.submittedQuery || session.searchQuery || ""
  );
  const parsedQuery = useMemo(() => parseStructuredQuery(searchQuery), [searchQuery]);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    session.activeJobId || null
  );
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [discoveredResults, setDiscoveredResults] = useState<DiscoveredSearchResult[]>(
    session.discoveredResults
  );
  const [sourceStatuses, setSourceStatuses] = useState<SourceSearchStatus[]>(
    session.sourceStatuses
  );
  const [availableSources, setAvailableSources] = useState<WebsiteSourceDescriptor[]>(
    DEFAULT_WEBSITE_SOURCES
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    session.selectedSources.length > 0
      ? session.selectedSources
      : ["arxiv", "biorxiv", "medrxiv", "plos", "nature_srep", "pmc", "ieee_xplore"]
  );
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState<boolean>(false);
  const [sourceSearchText, setSourceSearchText] = useState<string>("");

  // Recent searches stored locally
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("research_recent_searches");
      return stored
        ? JSON.parse(stored)
        : [
            "machine learning for medical image segmentation",
            "renewable energy forecasting using neural networks",
            "large language models in software engineering",
          ];
    } catch {
      return [];
    }
  });

  // ---------------------------------------------------------------------------
  // Part C: Advanced Filters State
  // ---------------------------------------------------------------------------
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [filterYearStart, setFilterYearStart] = useState<number | null>(
    session.filterYearStart
  );
  const [filterYearEnd, setFilterYearEnd] = useState<number | null>(
    session.filterYearEnd
  );
  const [filterContentType, setFilterContentType] = useState<string>(
    session.filterContentType
  );
  const [filterAccessStatus, setFilterAccessStatus] = useState<string>(
    session.filterAccessStatus
  );
  const [filterAuthor, setFilterAuthor] = useState<string>(session.filterAuthor);
  const [filterVenue, setFilterVenue] = useState<string>(session.filterVenue);
  const [filterPeerReviewedOnly, setFilterPeerReviewedOnly] = useState<boolean>(
    session.filterPeerReviewedOnly
  );
  const [sortBy, setSortBy] = useState<
    "best_match" | "newest" | "oldest" | "title_az" | "author_az" | "citations"
  >(session.sortBy);
  const [limitPerSource, setLimitPerSource] = useState<number>(
    session.limitPerSource || 50
  );
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Network online / offline state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Relocated URL Inspection & Crawl Tools State
  // ---------------------------------------------------------------------------
  const [seedUrl, setSeedUrl] = useState<string>(
    "https://www.biorxiv.org/content/early/recent"
  );
  const [crawlProfiles, setCrawlProfiles] = useState<CrawlProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<ExtractionPreviewResult | null>(
    null
  );
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobPapers, setJobPapers] = useState<CrawlJobPaper[]>([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState<boolean>(false);

  // Active Download Jobs tracking
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);

  // Streaming search cancellation & session isolation refs
  const currentSearchSessionRef = React.useRef<string | null>(null);
  const cancelStreamFnRef = React.useRef<(() => void) | null>(null);

  // Source diagnostics dialog state
  const [selectedDiagnosticsSource, setSelectedDiagnosticsSource] =
    useState<SourceSearchStatus | null>(null);

  // Collapsible Advanced Website Inspection drawer
  const [isInspectOpen, setIsInspectOpen] = useState<boolean>(false);

  // Three-Pane Workspace Layout Persistence
  const WORKSPACE_LAYOUT_KEY = "infinity_discover_workspace_layout_v2";

  interface StoredWorkspaceLayout {
    isLeftPaneCollapsed?: boolean;
    isRightPaneCollapsed?: boolean;
    leftPaneWidth?: number;
    rightPaneWidth?: number;
    isDistractionFree?: boolean;
  }

  function getStoredDiscoverLayout(): StoredWorkspaceLayout {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_LAYOUT_KEY) : null;
      if (raw) return JSON.parse(raw) as StoredWorkspaceLayout;
    } catch {
      // ignore
    }
    return {};
  }

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(
    session.selectedPaperId
  );
  const [quickFilter, setQuickFilter] = useState<"all" | "oa" | "downloaded">(
    session.quickFilter
  );
  const [textFilter, setTextFilter] = useState<string>(session.textFilter);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState<boolean>(
    () =>
      getStoredDiscoverLayout().isLeftPaneCollapsed ??
      session.isLeftPaneCollapsed ??
      false
  );
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState<boolean>(
    () =>
      getStoredDiscoverLayout().isRightPaneCollapsed ??
      session.isRightPaneCollapsed ??
      false
  );
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(
    () => getStoredDiscoverLayout().leftPaneWidth || session.leftPaneWidth || 360
  );
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(
    () => getStoredDiscoverLayout().rightPaneWidth || session.rightPaneWidth || 380
  );
  const [isDistractionFree, setIsDistractionFree] = useState<boolean>(
    () => getStoredDiscoverLayout().isDistractionFree ?? false
  );
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isGlobalDraggingFile, setIsGlobalDraggingFile] = useState<boolean>(false);

  // Synchronize layout changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        WORKSPACE_LAYOUT_KEY,
        JSON.stringify({
          leftPaneWidth,
          rightPaneWidth,
          isLeftPaneCollapsed,
          isRightPaneCollapsed,
          isDistractionFree,
        })
      );
    } catch {
      // non-blocking
    }
  }, [
    leftPaneWidth,
    rightPaneWidth,
    isLeftPaneCollapsed,
    isRightPaneCollapsed,
    isDistractionFree,
  ]);

  const handleResetLayout = useCallback(() => {
    setLeftPaneWidth(360);
    setRightPaneWidth(380);
    setIsLeftPaneCollapsed(false);
    setIsRightPaneCollapsed(false);
    setIsDistractionFree(false);
  }, []);

  const effectiveLeftCollapsed = isDistractionFree || isLeftPaneCollapsed;
  const effectiveRightCollapsed = isDistractionFree || isRightPaneCollapsed;

  // Active Right Pane Tab: 'details' | 'chat' | 'insights' | 'notes'
  const [activeRightTab, setActiveRightTab] = useState<
    "details" | "chat" | "insights" | "notes"
  >(session.activeRightTab);
  // Target PDF page for instant grounded citation jumps
  const [targetPdfPage, setTargetPdfPage] = useState<number | undefined>(
    session.targetPdfPage
  );

  // Notes state for selected paper
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [copiedDoi, setCopiedDoi] = useState<boolean>(false);

  // Paper Import & Metadata Edit Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importModalMode, setImportModalMode] = useState<"ieee" | "local" | "edit">(
    "ieee"
  );
  const [importModalPaper, setImportModalPaper] = useState<UnifiedDiscoverPaper | null>(
    null
  );

  const handleOpenIeeeXplore = useCallback(
    (query?: string) => {
      const q = query || searchQuery || "";
      const url = q
        ? `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(q)}&openAccess=true`
        : "https://ieeexplore.ieee.org/search/searchresult.jsp?openAccess=true";
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [searchQuery]
  );

  const handleOpenImportModal = useCallback(
    (modalMode: "ieee" | "local" | "edit", paper?: UnifiedDiscoverPaper | null) => {
      setImportModalMode(modalMode);
      setImportModalPaper(paper || null);
      setIsImportModalOpen(true);
    },
    []
  );

  // Drag-to-resize handlers with full PointerEvent and MouseEvent support
  const handleLeftResizeStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingLeft(true);
      const startX = e.clientX;
      const startWidth = leftPaneWidth;

      const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + delta, 260), 550);
        setLeftPaneWidth(newWidth);
      };

      const onPointerUp = () => {
        setIsDraggingLeft(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    },
    [leftPaneWidth]
  );

  const handleRightResizeStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingRight(true);
      const startX = e.clientX;
      const startWidth = rightPaneWidth;

      const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, 300), 620);
        setRightPaneWidth(newWidth);
      };

      const onPointerUp = () => {
        setIsDraggingRight(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    },
    [rightPaneWidth]
  );

  // Drag & drop handlers for dragging PDF files into the Discover workspace
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.stopPropagation();
      setIsGlobalDraggingFile(true);
    }
  }, []);

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsGlobalDraggingFile(false);
  }, []);

  const handleContainerDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsGlobalDraggingFile(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
          const path = (file as unknown as { path?: string }).path || "";
          handleOpenImportModal("local", {
            id: `local-drop-${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ""),
            authors: ["Local Author"],
            url: "",
            is_imported: false,
            is_downloaded: true,
            local_pdf_path: path || undefined,
            is_open_access: true,
            source_name: "Local PDF Import",
          } as UnifiedDiscoverPaper);
        }
      }
    },
    [handleOpenImportModal]
  );

  // Synchronize state changes to discoverSessionStore for persistent retention
  useEffect(() => {
    discoverSessionStore.setState({
      searchQuery,
      submittedQuery,
      activeJobId,
      discoveredResults,
      sourceStatuses,
      selectedSources,
      activeEngine: scrapingEngine,
      selectedPaperId,
      activeRightTab,
      isLeftPaneCollapsed,
      isRightPaneCollapsed,
      leftPaneWidth,
      rightPaneWidth,
      targetPdfPage,
      filterYearStart,
      filterYearEnd,
      filterContentType,
      filterAccessStatus,
      filterAuthor,
      filterVenue,
      filterPeerReviewedOnly,
      sortBy,
      quickFilter,
      textFilter,
      limitPerSource,
    });
  }, [
    searchQuery,
    submittedQuery,
    activeJobId,
    discoveredResults,
    sourceStatuses,
    selectedSources,
    scrapingEngine,
    selectedPaperId,
    activeRightTab,
    isLeftPaneCollapsed,
    isRightPaneCollapsed,
    leftPaneWidth,
    rightPaneWidth,
    targetPdfPage,
    filterYearStart,
    filterYearEnd,
    filterContentType,
    filterAccessStatus,
    filterAuthor,
    filterVenue,
    filterPeerReviewedOnly,
    sortBy,
    quickFilter,
    textFilter,
    limitPerSource,
  ]);

  // Load available source descriptors on mount
  useEffect(() => {
    let isMounted = true;
    listWebsiteSearchSources()
      .then((sources) => {
        if (isMounted) setAvailableSources(sources);
      })
      .catch((e) => console.warn("Failed to load search sources:", e));
    return () => {
      isMounted = false;
    };
  }, []);

  // Clean up streaming event listener on unmount
  useEffect(() => {
    return () => {
      if (cancelStreamFnRef.current) {
        cancelStreamFnRef.current();
        cancelStreamFnRef.current = null;
      }
    };
  }, []);

  // Load website scraping profiles and jobs
  const loadCrawlData = useCallback(async () => {
    try {
      const [profiles, jobs] = await Promise.all([
        listCrawlProfiles(),
        listCrawlJobs(10),
      ]);
      setCrawlProfiles(profiles);
      setCrawlJobs(jobs);
      if (profiles.length > 0 && !selectedProfileId) {
        setSelectedProfileId(profiles[0].id);
      }
      if (jobs.length > 0 && !selectedJobId) {
        setSelectedJobId(jobs[0].id);
      }
    } catch (e) {
      console.warn("Failed to load crawl data:", e);
    }
  }, [selectedProfileId, selectedJobId]);

  // Load download jobs
  const loadDownloads = useCallback(async () => {
    try {
      const jobs = await listPdfDownloadJobs(20);
      setDownloadJobs(jobs);
    } catch {
      // Ignored in non-tauri or initial mount
    }
  }, []);

  useEffect(() => {
    void loadCrawlData();
    void loadDownloads();
    // Passive background sync every 15s (real-time updates are pushed via Tauri events)
    const interval = setInterval(loadDownloads, 15000);
    return () => clearInterval(interval);
  }, [loadCrawlData, loadDownloads]);

  // Real-time download events listener from Tauri backend
  useEffect(() => {
    let unlistenList: Array<() => void> = [];
    let isSubscribed = true;

    const setupDownloadListeners = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const updateJobInState = (job: DownloadJob) => {
          if (!isSubscribed) return;
          setDownloadJobs((prev) => {
            const index = prev.findIndex((j) => j.id === job.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = job;
              return next;
            }
            return [job, ...prev];
          });
        };

        const u1 = await listen<DownloadJob>("paper:download_started", (evt) => {
          updateJobInState(evt.payload);
        });
        const u2 = await listen<DownloadJob>("paper:download_progress", (evt) => {
          updateJobInState(evt.payload);
        });
        const u3 = await listen<DownloadJob>("paper:download_completed", (evt) => {
          updateJobInState(evt.payload);
          void refreshDatabase();
        });
        const u4 = await listen<DownloadJob>("paper:download_failed", (evt) => {
          updateJobInState(evt.payload);
        });
        const u5 = await listen<DownloadJob>("paper:download_cancelled", (evt) => {
          updateJobInState(evt.payload);
        });

        if (isSubscribed) {
          unlistenList = [u1, u2, u3, u4, u5];
        } else {
          u1();
          u2();
          u3();
          u4();
          u5();
        }
      } catch {
        // Ignored in non-Tauri browser environments
      }
    };

    void setupDownloadListeners();

    return () => {
      isSubscribed = false;
      unlistenList.forEach((u) => u());
    };
  }, [refreshDatabase]);

  // Load crawled papers when a job is selected
  useEffect(() => {
    if (!selectedJobId) return;
    let isMounted = true;
    listCrawledPapers(selectedJobId)
      .then((papersList) => {
        if (isMounted) setJobPapers(papersList);
      })
      .catch((e) => {
        console.warn("Failed to load crawled papers:", e);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedJobId]);

  // ---------------------------------------------------------------------------
  // Combine all sources into unified paper items for the Left Pane
  // ---------------------------------------------------------------------------
  const unifiedPapers: UnifiedDiscoverPaper[] = useMemo(() => {
    const map = new Map<string, UnifiedDiscoverPaper>();

    // 1. Discovered Query Search Results (Priority for research discovery)
    for (const r of discoveredResults) {
      const key = `websearch_${r.id}`;
      // Cross-reference with AppContext papers to reflect local import/download state
      const libMatch = papers.find(
        (p) =>
          (p.doi &&
            r.canonical_doi &&
            p.doi.toLowerCase() === r.canonical_doi.toLowerCase()) ||
          p.title.toLowerCase().trim() === r.title.toLowerCase().trim()
      );
      const parsedYear =
        r.publication_year ??
        (r.publication_date
          ? parseInt(r.publication_date.slice(0, 4), 10) || null
          : null);
      const citationCount =
        typeof (libMatch as unknown as Record<string, unknown>)?.citationCount ===
        "number"
          ? ((libMatch as unknown as Record<string, unknown>).citationCount as number)
          : null;
      map.set(key, {
        id: key,
        paper_id: libMatch ? libMatch.id : null,
        title: r.title,
        authors: r.authors || [],
        publication_date: r.publication_date,
        publication_year: parsedYear,
        venue: r.venue || r.source_name,
        canonical_doi: r.canonical_doi,
        abstract_text: r.abstract_text,
        pdf_url: r.pdf_url || (libMatch ? libMatch.pdfUrl : null),
        url: r.landing_url,
        is_imported: Boolean(libMatch),
        is_downloaded: Boolean(libMatch?.localPdfPath),
        local_pdf_path: libMatch?.localPdfPath || null,
        is_open_access: r.is_open_access,
        source_name: r.source_name,
        source_id: r.source_id,
        content_type: r.content_type,
        license_name: r.license_name,
        peer_reviewed: r.peer_reviewed,
        subject_tags: r.subject_tags,
        language: r.language,
        relevance_score: r.relevance_score,
        metadata_confidence: r.metadata_confidence,
        collection_ids: libMatch?.collectionIds,
        citation_count: citationCount,
        version_type:
          ((r as unknown as Record<string, unknown>).version_type as
            string | undefined) ||
          (r.source_name.toLowerCase().includes("arxiv") ||
          r.source_name.toLowerCase().includes("biorxiv") ||
          r.source_name.toLowerCase().includes("medrxiv")
            ? "preprint"
            : r.is_open_access
              ? "published_version"
              : "unknown_version"),
        identity_status: (r as unknown as Record<string, unknown>).identity_status as
          string | undefined,
        identity_score: (r as unknown as Record<string, unknown>).identity_score as
          number | undefined,
      });
    }

    // 2. Initial Library Papers (displayed only before any search query is submitted/active)
    const isSearchActive = Boolean(
      submittedQuery || isSearching || discoveredResults.length > 0
    );
    if (!isSearchActive) {
      for (const p of papers) {
        map.set(p.id, {
          id: p.id,
          paper_id: p.id,
          title: p.title,
          authors: p.authors || [],
          publication_date: p.publicationDate || (p.year ? String(p.year) : null),
          publication_year: p.year,
          venue: p.venue,
          canonical_doi: p.doi,
          abstract_text: p.abstract,
          pdf_url: p.pdfUrl,
          url: p.landingUrl || "",
          is_imported: true,
          is_downloaded: Boolean(p.localPdfPath),
          local_pdf_path: p.localPdfPath,
          is_open_access: p.accessStatus === "open_access",
          source_name: p.sourceName || "Local Library",
          collection_ids: p.collectionIds,
          citation_count:
            typeof (p as unknown as Record<string, unknown>)?.citationCount === "number"
              ? ((p as unknown as Record<string, unknown>).citationCount as number)
              : null,
        });
      }
    }

    // 3. Crawled papers from selected job (only when website inspector drawer is active)
    if (isInspectOpen) {
      for (const jp of jobPapers) {
        const key = jp.paper_id || jp.id;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            paper_id: jp.paper_id,
            title: jp.title,
            authors: jp.authors || [],
            publication_date: jp.publication_date,
            publication_year: jp.publication_date
              ? parseInt(jp.publication_date, 10) || null
              : null,
            venue: jp.venue,
            canonical_doi: jp.canonical_doi,
            abstract_text: jp.abstract_text,
            pdf_url: jp.pdf_url,
            url: jp.url,
            is_imported: Boolean(jp.is_imported),
            is_downloaded: false,
            is_open_access: true,
            source_name: "Website Crawl",
          });
        }
      }
    }

    // 4. Current inspected page preview (only when inspector drawer has preview)
    if (isInspectOpen && previewResult) {
      const key = `preview_${previewResult.url}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          paper_id: null,
          title: previewResult.title || "Inspected Article",
          authors: previewResult.authors || [],
          publication_date: previewResult.publication_date,
          venue: previewResult.venue,
          canonical_doi: previewResult.canonical_doi,
          abstract_text: previewResult.abstract_text,
          pdf_url: previewResult.pdf_url,
          url: previewResult.url,
          is_imported: false,
          is_downloaded: false,
          is_open_access: Boolean(previewResult.pdf_url),
          source_name: "Page Inspector",
        });
      }
    }

    return Array.from(map.values());
  }, [
    discoveredResults,
    papers,
    submittedQuery,
    isSearching,
    isInspectOpen,
    jobPapers,
    previewResult,
  ]);

  // ---------------------------------------------------------------------------
  // Filter & Sort Logic
  // ---------------------------------------------------------------------------
  const filteredPapers = useMemo(() => {
    const activeQuery = submittedQuery || searchQuery;
    const plan = createSearchPlan(activeQuery, selectedSources, {
      yearStart: filterYearStart,
      yearEnd: filterYearEnd,
      contentType: filterContentType,
      accessStatus: filterAccessStatus,
      author: filterAuthor,
      venue: filterVenue,
      peerReviewedOnly: filterPeerReviewedOnly,
    });

    const list = unifiedPapers.filter((p) => {
      // Quick filter tabs
      if (quickFilter === "oa" && !p.is_open_access) return false;
      if (quickFilter === "downloaded" && !p.is_downloaded) return false;

      // Advanced Access Status: PDF available
      if (filterAccessStatus === "pdf_available" && !p.pdf_url && !p.local_pdf_path)
        return false;

      // In-page text search (compact search bar)
      if (textFilter.trim()) {
        const query = textFilter.toLowerCase();
        const inTitle = p.title.toLowerCase().includes(query);
        const inAuthors = p.authors.some((a) => a.toLowerCase().includes(query));
        const inDoi = p.canonical_doi?.toLowerCase().includes(query) || false;
        const inVenue = p.venue?.toLowerCase().includes(query) || false;
        if (!inTitle && !inAuthors && !inDoi && !inVenue) return false;
      }

      // Advanced Search Engine Client Post-Filters
      return satisfiesClientPostFilters(p, plan.clientPostFilters);
    });

    // Sorting
    if (sortBy === "newest") {
      list.sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => (a.publication_year || 9999) - (b.publication_year || 9999));
    } else if (sortBy === "title_az") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "author_az") {
      list.sort((a, b) => {
        const a1 = a.authors[0] || "";
        const b1 = b.authors[0] || "";
        return a1.localeCompare(b1);
      });
    } else if (sortBy === "citations") {
      list.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
    } else if (sortBy === "best_match") {
      if (activeQuery.trim()) {
        list.sort((a, b) => compareRankedPapers(a, b, activeQuery));
      } else {
        list.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      }
    }

    return list;
  }, [
    unifiedPapers,
    quickFilter,
    filterYearStart,
    filterYearEnd,
    filterContentType,
    filterAccessStatus,
    filterAuthor,
    filterVenue,
    filterPeerReviewedOnly,
    textFilter,
    sortBy,
    submittedQuery,
    searchQuery,
    selectedSources,
  ]);

  // Sliced visible papers for progressive loading & "Load More" pagination
  const visiblePapers = useMemo(() => {
    return filteredPapers.slice(0, visibleCount);
  }, [filteredPapers, visibleCount]);

  // Active selected paper
  const selectedPaper: UnifiedDiscoverPaper | null = useMemo(() => {
    if (isSearching) {
      // While actively searching, do not display stale paper from previous search
      if (selectedPaperId) {
        return (
          filteredPapers.find(
            (p) =>
              p.id === selectedPaperId || (p.paper_id && p.paper_id === selectedPaperId)
          ) || null
        );
      }
      return null;
    }
    if (!selectedPaperId) {
      return filteredPapers.length > 0 ? filteredPapers[0] : null;
    }
    const match = filteredPapers.find(
      (p) => p.id === selectedPaperId || (p.paper_id && p.paper_id === selectedPaperId)
    );
    if (match) return match;
    return filteredPapers.length > 0 ? filteredPapers[0] : null;
  }, [selectedPaperId, filteredPapers, isSearching]);

  // Load notes for selected paper
  useEffect(() => {
    const targetId = selectedPaper?.paper_id || selectedPaper?.id;
    if (
      !targetId ||
      targetId.startsWith("preview_") ||
      targetId.startsWith("websearch_")
    ) {
      setNotes([]);
      return;
    }

    let isMounted = true;
    getNotesForPaper(targetId)
      .then((loaded) => {
        if (isMounted) setNotes(loaded);
      })
      .catch(() => {
        if (isMounted) setNotes([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPaper]);

  // ---------------------------------------------------------------------------
  // Search Actions
  // ---------------------------------------------------------------------------
  const handleExecuteSearch = async (
    queryToSearch?: string,
    retrySourcesOnly?: string[],
    isLoadMore = false,
    customLimit?: number,
    forceOpenAccess = false
  ) => {
    const q = (queryToSearch ?? searchQuery).trim();
    if (!q) {
      showToast("Please enter a research topic, keyword, or author name.", "warning");
      return;
    }

    // Persist recent search
    setRecentSearches((prev) => {
      const next = [
        q,
        ...prev.filter((item) => item.toLowerCase() !== q.toLowerCase()),
      ].slice(0, 8);
      try {
        localStorage.setItem("research_recent_searches", JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist recent searches:", e);
      }
      return next;
    });

    // Cancel prior active session and listeners if running
    if (cancelStreamFnRef.current) {
      cancelStreamFnRef.current();
      cancelStreamFnRef.current = null;
    }
    if (currentSearchSessionRef.current) {
      const prevSession = currentSearchSessionRef.current;
      if (scrapingEngine === "python") {
        cancelPythonSearch(prevSession).catch(() => {});
      } else {
        cancelWebsiteSearch(prevSession).catch(() => {});
      }
    }

    const sessionId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentSearchSessionRef.current = sessionId;
    setActiveJobId(sessionId);
    setSubmittedQuery(q);

    const initialSources =
      retrySourcesOnly && retrySourcesOnly.length > 0
        ? retrySourcesOnly
        : selectedSources.length > 0
          ? selectedSources
          : ["arxiv", "biorxiv", "medrxiv", "plos", "nature_srep", "pmc", "ieee_xplore"];

    const searchPlan = createSearchPlan(q, initialSources, {
      yearStart: filterYearStart,
      yearEnd: filterYearEnd,
      contentType: filterContentType,
      accessStatus: filterAccessStatus,
      author: filterAuthor,
      venue: filterVenue,
      peerReviewedOnly: filterPeerReviewedOnly,
    });

    const targetSources =
      searchPlan.targetSources.length > 0 ? searchPlan.targetSources : initialSources;

    setIsSearching(true);

    if (!retrySourcesOnly && !isLoadMore) {
      setDiscoveredResults([]);
      setSelectedPaperId(null);
      setPreviewResult(null);
      setVisibleCount(customLimit || limitPerSource);
      discoverSessionStore.setState({
        selectedPaperId: null,
        submittedQuery: q,
        activeJobId: sessionId,
        discoveredResults: [],
      });
    }

    // Initialize source statuses
    setSourceStatuses((prev) => {
      const nextMap = new Map<string, SourceSearchStatus>(
        retrySourcesOnly || isLoadMore ? prev.map((s) => [s.source_id, s]) : []
      );
      for (const srcId of targetSources) {
        const desc = availableSources.find((s) => s.id === srcId);
        nextMap.set(srcId, {
          source_id: srcId,
          source_name: desc?.name || srcId,
          status: "searching",
          message: isLoadMore ? "Fetching more papers..." : "Searching source...",
          results_count:
            retrySourcesOnly || isLoadMore ? nextMap.get(srcId)?.results_count || 0 : 0,
          elapsed_ms: 0,
        });
      }
      return Array.from(nextMap.values());
    });

    try {
      const effectiveLimit = customLimit || limitPerSource;
      const searchFn =
        scrapingEngine === "python" ? startPythonSearchStream : startWebsiteSearchStream;
      const unlisten = await searchFn(
        {
          query: searchPlan.sourceQuery || q,
          sources: targetSources,
          year_start: searchPlan.sourceFilters.year_start ?? filterYearStart,
          year_end: searchPlan.sourceFilters.year_end ?? filterYearEnd,
          content_type:
            searchPlan.sourceFilters.content_type ||
            (filterContentType !== "all" ? filterContentType : null),
          open_access_only:
            forceOpenAccess ||
            searchPlan.sourceFilters.open_access_only ||
            filterAccessStatus === "open_access" ||
            quickFilter === "oa",
          author: searchPlan.sourceFilters.author || filterAuthor.trim() || null,
          limit_per_source: effectiveLimit,
        },
        (event: SearchStreamEvent) => {
          // Session isolation: discard events from stale sessions
          if (event.session_id !== currentSearchSessionRef.current) {
            return;
          }

          switch (event.type) {
            case "source_started": {
              setSourceStatuses((prev) =>
                prev.map((s) =>
                  s.source_id === event.source_id
                    ? { ...s, status: "searching" as const }
                    : s
                )
              );
              break;
            }
            case "source_progress": {
              setSourceStatuses((prev) =>
                prev.map((s) =>
                  s.source_id === event.source_id
                    ? {
                        ...s,
                        results_count: event.papers_found,
                        message: `Crawled ${event.pages_crawled} pages...`,
                      }
                    : s
                )
              );
              break;
            }
            case "source_status": {
              setSourceStatuses((prev) => {
                const idx = prev.findIndex((s) => s.source_id === event.source_id);
                const updated: SourceSearchStatus = {
                  source_id: event.source_id,
                  source_name: event.source_name,
                  status: event.status,
                  message: event.message || null,
                  results_count: event.results_count,
                  elapsed_ms: event.elapsed_ms,
                };
                const nextList =
                  idx >= 0
                    ? prev.map((s, i) => (i === idx ? updated : s))
                    : [...prev, updated];
                const anyStillSearching = nextList.some(
                  (s) => s.status === "searching" || s.status === "queued"
                );
                if (!anyStillSearching && nextList.length > 0) {
                  setIsSearching(false);
                }
                return nextList;
              });
              break;
            }
            case "paper_found": {
              setDiscoveredResults((prev) => {
                const duplicateIndex = prev.findIndex((p) =>
                  isDuplicatePaper(p, event.paper)
                );

                if (duplicateIndex >= 0) {
                  const copy = [...prev];
                  copy[duplicateIndex] = mergeDuplicateRecords(
                    copy[duplicateIndex],
                    event.paper
                  );
                  return copy;
                }

                return [event.paper, ...prev];
              });

              // Select first paper if none currently selected
              setSelectedPaperId((curr) => curr || `websearch_${event.paper.id}`);
              break;
            }
            case "paper_updated": {
              setDiscoveredResults((prev) =>
                prev.map((p) => (p.id === event.paper.id ? { ...p, ...event.paper } : p))
              );
              break;
            }
            case "source_completed": {
              setSourceStatuses((prev) => {
                const nextList = prev.map((s) =>
                  s.source_id === event.source_id
                    ? {
                        ...s,
                        status:
                          event.count > 0
                            ? ("completed" as const)
                            : ("no_results" as const),
                        results_count: event.count,
                        elapsed_ms: event.elapsed_ms,
                      }
                    : s
                );
                const anyStillSearching = nextList.some(
                  (s) => s.status === "searching" || s.status === "queued"
                );
                if (!anyStillSearching && nextList.length > 0) {
                  setIsSearching(false);
                }
                return nextList;
              });
              break;
            }
            case "source_failed": {
              setSourceStatuses((prev) => {
                const nextList = prev.map((s) =>
                  s.source_id === event.source_id
                    ? {
                        ...s,
                        status: "failed" as const,
                        message: event.error || event.message || "Source failed",
                        elapsed_ms: event.elapsed_ms,
                      }
                    : s
                );
                const anyStillSearching = nextList.some(
                  (s) => s.status === "searching" || s.status === "queued"
                );
                if (!anyStillSearching && nextList.length > 0) {
                  setIsSearching(false);
                }
                return nextList;
              });
              break;
            }
            case "search_progress": {
              // Bounded incremental search progress
              break;
            }
            case "search_completed":
            case "search_completed_with_errors":
            case "search_no_results":
            case "search_cancelled":
            case "search_timed_out": {
              setIsSearching(false);
              break;
            }
            case "search_failed": {
              showToast(event.error, "error");
              setIsSearching(false);
              break;
            }
            case "search_error": {
              if (event.source_id) {
                setSourceStatuses((prev) =>
                  prev.map((s) =>
                    s.source_id === event.source_id
                      ? { ...s, status: "failed", message: event.message }
                      : s
                  )
                );
              } else {
                showToast(event.message, "error");
                setIsSearching(false);
              }
              break;
            }
          }
        },
        sessionId
      );

      cancelStreamFnRef.current = unlisten;
    } catch (e: unknown) {
      setIsSearching(false);
      const msg = getErrorMessage(e, "Search failed unexpectedly.");
      showToast(`Search failed: ${msg}`, "error");
    }
  };

  const handleCancelSearch = () => {
    if (cancelStreamFnRef.current) {
      cancelStreamFnRef.current();
      cancelStreamFnRef.current = null;
    }
    if (currentSearchSessionRef.current) {
      if (scrapingEngine === "python") {
        cancelPythonSearch(currentSearchSessionRef.current).catch(() => {});
      } else {
        cancelWebsiteSearch(currentSearchSessionRef.current).catch(() => {});
      }
      currentSearchSessionRef.current = null;
    }
    setIsSearching(false);
    setSourceStatuses((prev) =>
      prev.map((s) =>
        s.status === "searching" || s.status === "queued"
          ? { ...s, status: "cancelled", message: "Search cancelled by user" }
          : s
      )
    );
    showToast("Search cancelled.", "info");
  };

  const handleRetryFailedSources = () => {
    const failedSources = sourceStatuses
      .filter(
        (s) =>
          s.status === "failed" ||
          s.status === "rate_limited" ||
          s.status === "cancelled" ||
          s.status === "timeout"
      )
      .map((s) => s.source_id);
    if (failedSources.length === 0) {
      showToast("No failed sources to retry.", "info");
      return;
    }
    void handleExecuteSearch(searchQuery, failedSources);
  };

  const handleLoadMoreFromSources = () => {
    if (isSearching) return;
    const nextLimit = limitPerSource + 50;
    setLimitPerSource(nextLimit);
    discoverSessionStore.setState({ limitPerSource: nextLimit });
    setVisibleCount((prev) => prev + 50);
    void handleExecuteSearch(undefined, undefined, true, nextLimit);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSubmittedQuery("");
    setActiveJobId(null);
    setDiscoveredResults([]);
    setSourceStatuses([]);
    setSelectedPaperId(null);
    discoverSessionStore.setState({
      searchQuery: "",
      submittedQuery: "",
      activeJobId: null,
      discoveredResults: [],
      sourceStatuses: [],
      selectedPaperId: null,
    });
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("research_recent_searches");
    } catch (e) {
      console.warn("Failed to clear recent searches:", e);
    }
    showToast("Recent search history cleared.", "info");
  };

  // Synchronize incoming global search queries (from Command Palette, Dashboard, etc.)
  useEffect(() => {
    if (
      globalSearchQuery &&
      globalSearchQuery.trim() !== "" &&
      globalSearchQuery !== submittedQuery
    ) {
      setSearchQuery(globalSearchQuery);
      void handleExecuteSearch(globalSearchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearchQuery]);

  const handleClearAllFilters = () => {
    setFilterYearStart(null);
    setFilterYearEnd(null);
    setFilterContentType("all");
    setFilterAccessStatus("all");
    setFilterAuthor("");
    setFilterVenue("all");
    setFilterPeerReviewedOnly(false);
    setSortBy("best_match");
    setQuickFilter("all");
    setTextFilter("");
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterYearStart !== null || filterYearEnd !== null) count++;
    if (filterContentType !== "all") count++;
    if (filterAccessStatus !== "all") count++;
    if (filterAuthor.trim()) count++;
    if (filterVenue !== "all") count++;
    if (filterPeerReviewedOnly) count++;
    if (sortBy !== "best_match") count++;
    return count;
  }, [
    filterYearStart,
    filterYearEnd,
    filterContentType,
    filterAccessStatus,
    filterAuthor,
    filterVenue,
    filterPeerReviewedOnly,
    sortBy,
  ]);

  // ---------------------------------------------------------------------------
  // Paper & Note Actions
  // ---------------------------------------------------------------------------
  const handleInspectPage = async (urlToInspect?: string) => {
    const target = (urlToInspect || seedUrl).trim();
    if (!target) {
      showToast("Please enter a research paper or journal page URL.", "warning");
      return;
    }

    setIsInspecting(true);
    setPreviewResult(null);
    try {
      const res = await previewUrlExtraction(target, selectedProfileId || null);
      setPreviewResult(res);
      setSelectedPaperId(`preview_${res.url}`);
      showToast("Page inspected and metadata extracted!", "success");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Inspection failed.");
      showToast(`Inspection failed: ${msg}`, "error");
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartCrawl = async () => {
    if (!seedUrl.trim()) {
      showToast("Please enter a seed URL.", "warning");
      return;
    }

    setIsStartingCrawl(true);
    try {
      const job = await startCrawlJob(seedUrl.trim(), selectedProfileId || null);
      showToast(`Started website crawl (Job ${job.id.slice(0, 8)}...)`, "success");
      await loadCrawlData();
      setSelectedJobId(job.id);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to start crawl.");
      showToast(`Failed to start crawl: ${msg}`, "error");
    } finally {
      setIsStartingCrawl(false);
    }
  };

  const handleJobAction = async (
    jobId: string,
    action: "pause" | "resume" | "cancel"
  ) => {
    try {
      if (action === "pause") await pauseCrawlJob(jobId);
      if (action === "resume") await resumeCrawlJob(jobId);
      if (action === "cancel") await cancelCrawlJob(jobId);
      showToast(`Job ${action}d successfully.`, "info");
      await loadCrawlData();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Action failed.");
      showToast(`Action failed: ${msg}`, "error");
    }
  };

  const handleImportSingle = async (url: string) => {
    try {
      const paper = await importSinglePage(url, selectedProfileId || null, null);
      showToast(`Imported to library: "${paper.title}"`, "success");
      await refreshDatabase();
      setSelectedPaperId(paper.id);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Import failed.");
      showToast(`Import failed: ${msg}`, "error");
    }
  };

  const handleSaveDiscoveredPaper = async (paper: UnifiedDiscoverPaper) => {
    const raw = discoveredResults.find((r) => `websearch_${r.id}` === paper.id);
    if (raw) {
      try {
        const saved = await importDiscoveredSearchResult(raw);
        showToast(`Saved to library: "${saved.title}"`, "success");
        await refreshDatabase();
        setSelectedPaperId(paper.id);
        return;
      } catch (e: unknown) {
        const msg = getErrorMessage(e, "Save failed.");
        showToast(`Save failed: ${msg}`, "error");
        return;
      }
    }

    if (paper.url) {
      await handleImportSingle(paper.url);
    }
  };

  const handleDownloadPdf = async (paper: UnifiedDiscoverPaper) => {
    const targetId = paper.paper_id || paper.id;
    const pdfUrl = paper.pdf_url;

    if (!pdfUrl) {
      showToast(
        "No direct PDF URL detected upfront. Resolving Open Access candidates...",
        "info"
      );
      await handleResolvePdf(paper);
      return;
    }

    try {
      let validPaperId = targetId;
      if (
        targetId.startsWith("preview_") ||
        targetId.startsWith("websearch_") ||
        !paper.is_imported
      ) {
        const raw = discoveredResults.find((r) => `websearch_${r.id}` === paper.id);
        if (raw) {
          const imported = await importDiscoveredSearchResult(raw);
          validPaperId = imported.id;
        } else {
          const imported = await importSinglePage(
            paper.url,
            selectedProfileId || null,
            null
          );
          validPaperId = imported.id;
        }
        await refreshDatabase();
      }

      await enqueuePdfDownload({
        paper_id: validPaperId,
        paper_title: paper.title,
        url: pdfUrl,
        source_id: paper.source_id || "website_search",
      });
      showToast(`Enqueued PDF download for "${paper.title}"`, "success");
      await loadDownloads();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Download failed.");
      showToast(`Download failed: ${msg}`, "error");
    }
  };

  const handleResolvePdf = async (paper: UnifiedDiscoverPaper) => {
    try {
      let validPaperId = paper.paper_id || paper.id;
      if (
        validPaperId.startsWith("preview_") ||
        validPaperId.startsWith("websearch_") ||
        !paper.is_imported
      ) {
        const raw = discoveredResults.find((r) => `websearch_${r.id}` === paper.id);
        if (raw) {
          const imported = await importDiscoveredSearchResult(raw);
          validPaperId = imported.id;
        } else if (paper.url) {
          const imported = await importSinglePage(
            paper.url,
            selectedProfileId || null,
            null
          );
          validPaperId = imported.id;
        }
        await refreshDatabase();
      }

      showToast("Resolving alternative Open Access PDF locations...", "info");
      const res = await resolvePaperPdf(validPaperId);
      if (res.best_url) {
        showToast("Resolved Open Access PDF candidate!", "success");
        setDiscoveredResults((prev) =>
          prev.map((item) =>
            item.id === paper.id || `websearch_${item.id}` === paper.id
              ? { ...item, pdf_url: res.best_url || item.pdf_url }
              : item
          )
        );
        await handleDownloadPdf({
          ...paper,
          paper_id: validPaperId,
          is_imported: true,
          pdf_url: res.best_url,
        });
      } else {
        showToast(
          "No alternative Open Access PDF candidate resolved for this DOI/URL.",
          "info"
        );
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not resolve Open Access PDF.");
      showToast(`Resolution error: ${msg}`, "error");
    }
  };

  const handleToggleSave = async (paper: UnifiedDiscoverPaper) => {
    if (!paper.is_imported) {
      await handleSaveDiscoveredPaper(paper);
      return;
    }

    try {
      const targetId = paper.paper_id || paper.id;
      await toggleSavePaper(targetId, false);
      await refreshDatabase();
      showToast("Removed from Library", "info");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Toggle failed.");
      showToast(`Toggle failed: ${msg}`, "error");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedPaper || !newNoteText.trim()) return;
    const targetId = selectedPaper.paper_id || selectedPaper.id;

    if (
      targetId.startsWith("preview_") ||
      targetId.startsWith("websearch_") ||
      !selectedPaper.is_imported
    ) {
      showToast(
        "Please save this paper to library first before adding persistent notes.",
        "info"
      );
      return;
    }

    setIsSavingNote(true);
    try {
      const saved = await saveNote({
        paper_id: targetId,
        content_markdown: newNoteText.trim(),
      });
      setNotes((prev) => [saved, ...prev]);
      setNewNoteText("");
      showToast("Note saved successfully.", "success");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to save note.");
      showToast(`Failed to save note: ${msg}`, "error");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      showToast("Note deleted.", "info");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to delete note.");
      showToast(`Failed to delete note: ${msg}`, "error");
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (!selectedPaper || !collectionId) return;
    const targetId = selectedPaper.paper_id || selectedPaper.id;

    if (
      targetId.startsWith("preview_") ||
      targetId.startsWith("websearch_") ||
      !selectedPaper.is_imported
    ) {
      showToast("Saving paper to library first...", "info");
      let validId: string;
      const raw = discoveredResults.find((r) => `websearch_${r.id}` === targetId);
      if (raw) {
        const imported = await importDiscoveredSearchResult(raw, collectionId);
        validId = imported.id;
      } else {
        const imported = await importSinglePage(
          selectedPaper.url,
          selectedProfileId || null,
          collectionId
        );
        validId = imported.id;
      }
      await refreshDatabase();
      setSelectedPaperId(validId);
      showToast("Added to collection!", "success");
      return;
    }

    try {
      await addPaperToCollection(collectionId, targetId);
      await refreshDatabase();
      showToast("Added to collection!", "success");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to add collection.");
      showToast(`Failed to add collection: ${msg}`, "error");
    }
  };

  const handleRemoveFromCollection = async (collectionId: string) => {
    if (!selectedPaper) return;
    const targetId = selectedPaper.paper_id || selectedPaper.id;
    try {
      await removePaperFromCollection(collectionId, targetId);
      await refreshDatabase();
      showToast("Removed from collection.", "info");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Failed to remove collection.");
      showToast(`Failed to remove collection: ${msg}`, "error");
    }
  };

  const handleCopyDoi = (doi: string) => {
    navigator.clipboard.writeText(doi);
    setCopiedDoi(true);
    setTimeout(() => setCopiedDoi(false), 2000);
    showToast("DOI copied to clipboard.", "info");
  };

  const activePaperDownload = useMemo(() => {
    if (!selectedPaper) return null;
    const targetId = selectedPaper.paper_id || selectedPaper.id;
    return downloadJobs.find(
      (j) =>
        j.paper_id === targetId && (j.status === "downloading" || j.status === "queued")
    );
  }, [selectedPaper, downloadJobs]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none bg-slate-50 dark:bg-[#070b12]">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header Toolbar & Navigation Tabs */}
      {/* --------------------------------------------------------------------- */}
      <header className="px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0b101b] shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Discover Research Papers
            </h1>
            <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
              Three-Pane Workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("website")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "website"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website-Driven Discovery (No-API)</span>
              <Badge variant="success" size="sm">
                Active
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("academic")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "academic"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Academic API Connectors</span>
              <Badge variant="outline" size="sm">
                Disabled in No-API Mode
              </Badge>
            </button>

            {/* Desktop Pane Collapse Toggles & Layout Controls */}
            {activeTab === "website" && (
              <div className="hidden lg:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeftPaneCollapsed(!effectiveLeftCollapsed)}
                  title={
                    effectiveLeftCollapsed
                      ? "Expand search list pane"
                      : "Collapse search list pane"
                  }
                  className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                    effectiveLeftCollapsed
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Sidebar className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRightPaneCollapsed(!effectiveRightCollapsed)}
                  title={
                    effectiveRightCollapsed
                      ? "Expand details pane"
                      : "Collapse details pane"
                  }
                  className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                    effectiveRightCollapsed
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDistractionFree(!isDistractionFree)}
                  title={
                    isDistractionFree
                      ? "Exit Focus Reading Mode"
                      : "Distraction-Free Focus Reading Mode (Maximize Center PDF)"
                  }
                  className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                    isDistractionFree
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {isDistractionFree ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  title="Reset 3-pane layout to default (25% / 50% / 25%)"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* 2. TAB 1: THREE-PANE WEBSITE-DRIVEN DISCOVERY WORKSPACE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "website" && (
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
          {/* Offline Indicator Banner */}
          {!isOnline && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Offline Mode:</strong> External academic source queries require
                  an internet connection. You can still inspect locally saved papers and
                  read downloaded PDFs.
                </span>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* GLOBAL QUERY SEARCH & FILTER BAR */}
          {/* ================================================================= */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0b101b] shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              {/* Primary Search Input */}
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  id="discover-search-input"
                  aria-label="Search research papers"
                  placeholder="Search by topic, title, author, keyword, or phrase…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleExecuteSearch();
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Clear search query"
                    title="Clear query"
                    className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search / Cancel Button */}
              {isSearching ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelSearch}
                  className="h-9 px-3 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExecuteSearch()}
                  className="h-9 px-4 font-semibold shadow-xs"
                >
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                  Search
                </Button>
              )}

              {/* Sources Multi-Select Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="sources-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={isSourceSelectorOpen}
                  onClick={() => setIsSourceSelectorOpen((prev) => !prev)}
                  className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-1.5 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Sources ({selectedSources.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Sources Popover */}
                {isSourceSelectorOpen && (
                  <div className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-50 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Academic Sources
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSources(
                              availableSources
                                .filter((s) => s.status === "enabled")
                                .map((s) => s.id)
                            )
                          }
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSources([])}
                          className="text-[10px] text-slate-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Filter sources..."
                      value={sourceSearchText}
                      onChange={(e) => setSourceSearchText(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {availableSources
                        .filter(
                          (s) =>
                            s.name
                              .toLowerCase()
                              .includes(sourceSearchText.toLowerCase()) ||
                            s.domain
                              .toLowerCase()
                              .includes(sourceSearchText.toLowerCase())
                        )
                        .map((source) => {
                          const isEnabled = source.status === "enabled";
                          const isChecked = selectedSources.includes(source.id);
                          return (
                            <label
                              key={source.id}
                              className={`flex items-start gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                !isEnabled
                                  ? "opacity-60 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={!isEnabled}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSources((prev) => [...prev, source.id]);
                                  } else {
                                    setSelectedSources((prev) =>
                                      prev.filter((id) => id !== source.id)
                                    );
                                  }
                                }}
                                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {source.name}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                      source.status === "enabled"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : source.status === "manual_only"
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                    }`}
                                  >
                                    {source.status === "enabled"
                                      ? "Policy Checked"
                                      : source.status === "manual_only"
                                        ? "Manual Only"
                                        : "Disabled"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {source.domain}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Filters Button */}
              <button
                type="button"
                aria-expanded={isFiltersOpen}
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  isFiltersOpen || activeFiltersCount > 0
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
                {isFiltersOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Papers Per Source Limit Selector */}
              <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-400 text-[11px] whitespace-nowrap">
                  Fetch:
                </span>
                <select
                  value={limitPerSource}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLimitPerSource(val);
                    discoverSessionStore.setState({ limitPerSource: val });
                  }}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold text-xs border-none outline-none cursor-pointer pr-1"
                  title="Target papers to fetch per academic source (Default: 50)"
                >
                  <option value={15} className="dark:bg-slate-800">
                    15 / source
                  </option>
                  <option value={25} className="dark:bg-slate-800">
                    25 / source
                  </option>
                  <option value={50} className="dark:bg-slate-800">
                    50 / source (Default)
                  </option>
                  <option value={100} className="dark:bg-slate-800">
                    100 / source
                  </option>
                </select>
              </div>

              {/* Scraping Engine Switcher */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-0.5 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setScrapingEngine("python")}
                  className={`h-7 px-2.5 rounded-md font-medium text-[11px] transition-all flex items-center gap-1.5 ${
                    scrapingEngine === "python"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title={`Python Scraping Engine: ${pythonEngineStatus?.available ? "Online (v1.0.0)" : "Initializing"} with Anti-SSRF & JavaScript support`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${pythonEngineStatus?.available ? "bg-emerald-500" : "bg-amber-400"}`}
                  />
                  <span>Python Engine</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScrapingEngine("rust")}
                  className={`h-7 px-2.5 rounded-md font-medium text-[11px] transition-all flex items-center gap-1.5 ${
                    scrapingEngine === "rust"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Rust Native Engine: Fast static HTML parsing with Spider-hardened architecture"
                >
                  <span>Rust Native</span>
                </button>
              </div>

              {/* Engine Diagnostics Button */}
              <button
                type="button"
                onClick={handleOpenDiagnostics}
                className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-1.5 transition-colors shrink-0"
                title="View Scraping Engine Diagnostics & Metrics"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Diagnostics</span>
              </button>
            </div>

            {/* Structured Query Preview & Syntax Feedback */}
            {parsedQuery.hasSyntax && (
              <div
                data-testid="structured-query-preview"
                className="flex flex-wrap items-center gap-1.5 pt-1 text-xs"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Query Plan:
                </span>
                {parsedQuery.fields.title && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium text-[11px] border border-indigo-200 dark:border-indigo-800">
                    Title: "{parsedQuery.fields.title}"
                  </span>
                )}
                {parsedQuery.fields.author && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium text-[11px] border border-purple-200 dark:border-purple-800">
                    Author: "{parsedQuery.fields.author}"
                  </span>
                )}
                {(parsedQuery.fields.yearStart || parsedQuery.fields.yearEnd) && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium text-[11px] border border-amber-200 dark:border-amber-800">
                    Year:{" "}
                    {parsedQuery.fields.yearStart === parsedQuery.fields.yearEnd
                      ? parsedQuery.fields.yearStart
                      : `${parsedQuery.fields.yearStart || "Any"}..${parsedQuery.fields.yearEnd || "Now"}`}
                  </span>
                )}
                {parsedQuery.fields.doi && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] border border-emerald-200 dark:border-emerald-800">
                    DOI: {parsedQuery.fields.doi}
                  </span>
                )}
                {parsedQuery.fields.source && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium text-[11px] border border-blue-200 dark:border-blue-800">
                    Source: {parsedQuery.fields.source}
                  </span>
                )}
                {parsedQuery.fields.contentType && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-medium text-[11px] border border-cyan-200 dark:border-cyan-800">
                    Type: {parsedQuery.fields.contentType}
                  </span>
                )}
                {parsedQuery.fields.openAccess !== undefined && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] border border-emerald-200 dark:border-emerald-800">
                    OA: {String(parsedQuery.fields.openAccess)}
                  </span>
                )}
                {parsedQuery.fields.venue && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] border border-slate-200 dark:border-slate-700">
                    Venue: "{parsedQuery.fields.venue}"
                  </span>
                )}
                {parsedQuery.syntaxErrors.map((err, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium text-[11px] border border-rose-200 dark:border-rose-800"
                  >
                    {err}
                  </span>
                ))}
              </div>
            )}

            {/* Recent Searches Chips */}
            {recentSearches.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-500 pt-0.5">
                <span className="font-semibold text-slate-400 text-[10px] flex items-center gap-1 uppercase tracking-wider shrink-0">
                  <History className="w-3 h-3" /> Recent:
                </span>
                {recentSearches.slice(0, 4).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      void handleExecuteSearch(term);
                    }}
                    className="px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 text-[10px] truncate max-w-[200px] transition-colors shrink-0"
                  >
                    {term}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearRecentSearches}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline shrink-0 ml-1"
                >
                  Clear history
                </button>
              </div>
            )}

            {/* Collapsible Advanced Filters Drawer */}
            {isFiltersOpen && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Publication Year */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Publication Year
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="From"
                        value={filterYearStart || ""}
                        onChange={(e) =>
                          setFilterYearStart(
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="number"
                        placeholder="To"
                        value={filterYearEnd || ""}
                        onChange={(e) =>
                          setFilterYearEnd(
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    {/* Quick year buttons */}
                    <div className="flex items-center gap-1 pt-1">
                      {[
                        { label: "All", start: null },
                        { label: "1y", start: 2025 },
                        { label: "3y", start: 2023 },
                        { label: "5y", start: 2021 },
                        { label: "10y", start: 2016 },
                      ].map((yr) => (
                        <button
                          key={yr.label}
                          type="button"
                          onClick={() => {
                            setFilterYearStart(yr.start);
                            setFilterYearEnd(null);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] border ${
                            filterYearStart === yr.start
                              ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                              : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {yr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Type */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Content Type
                    </label>
                    <select
                      value={filterContentType}
                      onChange={(e) => setFilterContentType(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    >
                      <option value="all">All Types</option>
                      <option value="preprint">Preprint</option>
                      <option value="journal_article">Journal Article</option>
                      <option value="review">Review</option>
                      <option value="conference_paper">Conference Paper</option>
                    </select>
                  </div>

                  {/* Access Status */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Access Status
                    </label>
                    <select
                      value={filterAccessStatus}
                      onChange={(e) => setFilterAccessStatus(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    >
                      <option value="all">All Access</option>
                      <option value="open_access">Confirmed Open Access</option>
                      <option value="pdf_available">PDF Link Available</option>
                    </select>
                  </div>

                  {/* Author Name */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Author
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vaswani, LeCun..."
                      value={filterAuthor}
                      onChange={(e) => setFilterAuthor(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Filter footer: Sort & Clear all */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                        Sort By:
                      </span>
                      <select
                        value={sortBy}
                        aria-label="Sort search results"
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as
                              | "best_match"
                              | "newest"
                              | "oldest"
                              | "title_az"
                              | "author_az"
                              | "citations"
                          )
                        }
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value="best_match">Best Match (Relevance)</option>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title_az">Title A–Z</option>
                        <option value="author_az">Author A–Z</option>
                        <option value="citations">Most Cited</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                        Limit / Source:
                      </span>
                      <select
                        value={limitPerSource}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setLimitPerSource(val);
                          discoverSessionStore.setState({ limitPerSource: val });
                        }}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value={15}>15 papers</option>
                        <option value={25}>25 papers</option>
                        <option value={50}>50 papers (Default)</option>
                        <option value={100}>100 papers</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* THREE PANES CONTAINER */}
          {/* ================================================================= */}
          <div
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={handleContainerDrop}
            className="flex-1 flex min-h-0 w-full overflow-hidden relative"
          >
            {/* Global PDF File Drag-and-Drop Overlay */}
            {isGlobalDraggingFile && (
              <div className="absolute inset-0 z-50 bg-indigo-900/20 backdrop-blur-xs border-2 border-dashed border-indigo-500 m-3 rounded-2xl flex flex-col items-center justify-center pointer-events-none select-none">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-200 dark:border-indigo-800">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Upload className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      Drop PDF to Import & Read
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Release file here to inspect metadata and open in Reader
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* LEFT PANE: Results, Source Badges & Relocated URL Inspector */}
            {/* =============================================================== */}
            {effectiveLeftCollapsed && (
              <div className="w-9 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-3 select-none z-10 transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setIsLeftPaneCollapsed(false);
                    setIsDistractionFree(false);
                  }}
                  title="Expand results list"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Sidebar className="w-4 h-4" />
                </button>
                <div className="mt-8 [writing-mode:vertical-rl] rotate-180 text-[10px] font-bold text-slate-400 tracking-wider uppercase select-none">
                  Results ({filteredPapers.length})
                </div>
              </div>
            )}

            {!effectiveLeftCollapsed && (
              <aside
                style={{ width: `${leftPaneWidth}px` }}
                className="shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 h-full"
              >
                {/* Results Toolbar */}
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Results ({filteredPapers.length})
                    </span>
                    <div className="sr-only" aria-live="polite" role="status">
                      {submittedQuery
                        ? `Found ${filteredPapers.length} results for "${submittedQuery}"`
                        : `${filteredPapers.length} papers available`}
                    </div>

                    {/* Quick filter pills & IEEE / Import Actions & Collapse */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setQuickFilter("all")}
                          className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                            quickFilter === "all"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickFilter("oa")}
                          className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                            quickFilter === "oa"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                          }`}
                        >
                          OA
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickFilter("downloaded")}
                          className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                            quickFilter === "downloaded"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                          }`}
                        >
                          PDF
                        </button>
                      </div>

                      <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                      <button
                        type="button"
                        onClick={() => handleOpenIeeeXplore()}
                        title="Search official IEEE Xplore in browser (No API key required)"
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>IEEE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenImportModal("ieee")}
                        title="Import or link a local PDF (IEEE or Open Access)"
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        <span>Import</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLeftPaneCollapsed(true)}
                        title="Collapse results list"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Live Search Progress Banner */}
                  {isSearching && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                        <span className="truncate">
                          Searching{" "}
                          {
                            sourceStatuses.filter(
                              (s) => s.status === "searching" || s.status === "queued"
                            ).length
                          }{" "}
                          of {sourceStatuses.length || selectedSources.length} sources… (
                          {discoveredResults.length} found)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelSearch}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 text-[10px] font-semibold shrink-0 ml-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!isSearching && sourceStatuses.length > 0 && (
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="truncate">
                        {discoveredResults.length} paper
                        {discoveredResults.length === 1 ? "" : "s"} found across{" "}
                        {sourceStatuses.filter((s) => s.status === "completed").length}{" "}
                        source
                        {sourceStatuses.filter((s) => s.status === "completed").length ===
                        1
                          ? ""
                          : "s"}
                        .
                      </span>
                      {sourceStatuses.some(
                        (s) =>
                          s.status === "failed" ||
                          s.status === "rate_limited" ||
                          s.status === "cancelled" ||
                          s.status === "timeout"
                      ) && (
                        <button
                          type="button"
                          onClick={handleRetryFailedSources}
                          className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold hover:bg-indigo-100 shrink-0 ml-1 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Retry Failed
                        </button>
                      )}
                    </div>
                  )}

                  {/* Honest Source Status Chips with Diagnostics click */}
                  {sourceStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      {sourceStatuses.map((st) => {
                        const shortName = st.source_name.split(" ")[0];
                        let chipStyle =
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                        let statusLabel = `${st.results_count} found`;
                        let icon: React.ReactNode = null;

                        if (st.status === "searching" || st.status === "queued") {
                          chipStyle =
                            "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
                          statusLabel = "searching";
                          icon = (
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-600" />
                          );
                        } else if (st.status === "completed") {
                          chipStyle =
                            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
                          statusLabel = `${st.results_count} found`;
                          icon = <Check className="w-2.5 h-2.5 text-emerald-600" />;
                        } else if (st.status === "no_results") {
                          chipStyle =
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                          statusLabel = "0 found";
                        } else if (st.status === "blocked") {
                          chipStyle =
                            "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "blocked";
                          icon = <ShieldAlert className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "unsupported") {
                          chipStyle =
                            "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "unsupported";
                          icon = <AlertCircle className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "rate_limited") {
                          chipStyle =
                            "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800";
                          statusLabel = "rate limited";
                          icon = <AlertCircle className="w-2.5 h-2.5 text-orange-600" />;
                        } else if (st.status === "failed") {
                          chipStyle =
                            "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
                          statusLabel = "failed";
                          icon = <X className="w-2.5 h-2.5 text-rose-600" />;
                        } else if (st.status === "timeout") {
                          chipStyle =
                            "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "timed out";
                          icon = <Clock className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "cancelled") {
                          chipStyle =
                            "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                          statusLabel = "cancelled";
                        }

                        return (
                          <button
                            key={st.source_id}
                            type="button"
                            onClick={() => setSelectedDiagnosticsSource(st)}
                            title={`Click to view diagnostics for ${st.source_name}: ${st.message || statusLabel}`}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${chipStyle}`}
                          >
                            {icon}
                            <span className="font-semibold">{shortName}:</span>
                            <span>{statusLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Collapsible Advanced: Inspect / Configure Permitted Website */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsInspectOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 py-1 px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Advanced: Inspect Permitted Website</span>
                      </span>
                      {isInspectOpen ? (
                        <ChevronUp className="w-3 h-3 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      )}
                    </button>

                    {isInspectOpen && (
                      <div className="p-2 mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 space-y-2">
                        {/* URL input */}
                        <div className="relative">
                          <input
                            type="url"
                            placeholder="Enter seed URL: e.g. https://www.biorxiv.org/content/early/recent"
                            value={seedUrl}
                            onChange={(e) => setSeedUrl(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                          />
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="text-slate-400">Presets:</span>
                          {[
                            {
                              name: "bioRxiv Recent",
                              url: "https://www.biorxiv.org/content/early/recent",
                            },
                            {
                              name: "PLOS ONE",
                              url: "https://journals.plos.org/plosone/",
                            },
                            {
                              name: "Nature Scientific Reports",
                              url: "https://www.nature.com/srep/",
                            },
                            {
                              name: "arXiv CS List",
                              url: "https://arxiv.org/list/cs/recent",
                            },
                          ].map((q) => (
                            <button
                              key={q.name}
                              type="button"
                              onClick={() => setSeedUrl(q.url)}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                            >
                              {q.name}
                            </button>
                          ))}
                        </div>

                        {/* Profile selector */}
                        {crawlProfiles.length > 0 && (
                          <select
                            value={selectedProfileId}
                            onChange={(e) => setSelectedProfileId(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                          >
                            <option value="">Auto-Detect Scraping Profile</option>
                            {crawlProfiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.domain})
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isInspecting}
                            onClick={() => handleInspectPage()}
                            className="text-[11px] h-6 px-2 flex-1"
                          >
                            <Code2 className="w-3 h-3 mr-1" />
                            {isInspecting ? "Inspecting..." : "Inspect Page"}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isStartingCrawl}
                            onClick={handleStartCrawl}
                            className="text-[11px] h-6 px-2 flex-1"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {isStartingCrawl ? "Starting..." : "Start Crawl"}
                          </Button>
                        </div>

                        {/* Active Crawl Jobs inside Inspector */}
                        {crawlJobs.length === 0 ? (
                          <div className="p-2 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded">
                            No Crawl Jobs Executed Yet
                          </div>
                        ) : (
                          <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              Crawl Jobs ({crawlJobs.length})
                            </span>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {crawlJobs.map((j) => (
                                <div
                                  key={j.id}
                                  onClick={() => setSelectedJobId(j.id)}
                                  className={`p-1.5 rounded border text-xs cursor-pointer flex items-center justify-between ${
                                    selectedJobId === j.id
                                      ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800"
                                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                                    Job {j.id.slice(0, 8)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                      {j.status}
                                    </span>
                                    {j.status === "running" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleJobAction(j.id, "pause");
                                        }}
                                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        title="Pause Job"
                                      >
                                        <Pause className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable Discovered Paper Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {/* Empty state when no papers match */}
                  {filteredPapers.length === 0 && !isSearching && (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 text-center">
                      <EmptyState
                        icon={<Search className="w-7 h-7 text-slate-400" />}
                        title="No Papers Found"
                        description="Enter a research topic or phrase above to discover papers across academic sources."
                      />
                    </div>
                  )}

                  {/* Skeletons when searching and no papers discovered yet */}
                  {isSearching && visiblePapers.length === 0 && (
                    <PaperCardSkeleton count={5} />
                  )}

                  {/* Discovered Papers List */}
                  {visiblePapers.map((paper) => {
                    const isSelected = selectedPaper?.id === paper.id;
                    return (
                      <div
                        key={paper.id}
                        role="article"
                        tabIndex={0}
                        aria-selected={isSelected}
                        aria-label={`${paper.title} by ${paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown Author"}`}
                        onClick={() => setSelectedPaperId(paper.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPaperId(paper.id);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50/60 dark:bg-white/10 border-indigo-400 dark:border-white/20 shadow-xs"
                            : "bg-white dark:bg-[#0e1524] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                            {paper.title}
                          </h3>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1.5">
                          {paper.authors.length > 0
                            ? paper.authors.slice(0, 3).join(", ") +
                              (paper.authors.length > 3 ? " et al." : "")
                            : "Unknown Author"}{" "}
                          {paper.publication_year ? `(${paper.publication_year})` : ""}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {/* Color-Coded Academic Source Badge */}
                          <SourceBadge sourceName={paper.source_name} size="sm" />

                          {/* Storage & Verified Document Status Badges */}
                          {paper.is_downloaded ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold bg-emerald-600 text-white shadow-2xs">
                              <Check className="w-2.5 h-2.5" />
                              <span>Saved Offline</span>
                            </span>
                          ) : paper.is_imported ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                              <Bookmark className="w-2.5 h-2.5 text-indigo-500" />
                              <span>In Library</span>
                            </span>
                          ) : paper.pdf_url ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-2xs">
                              <Cloud className="w-2.5 h-2.5 text-sky-500" />
                              <span>Verified PDF</span>
                            </span>
                          ) : null}

                          {/* Academic Version Taxonomy Badge */}
                          {paper.version_type === "preprint" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs">
                              Preprint
                            </span>
                          ) : paper.version_type === "accepted_manuscript" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
                              Accepted Manuscript
                            </span>
                          ) : paper.version_type === "published_version" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                              Published Version
                            </span>
                          ) : paper.version_type === "repository_version" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shadow-2xs">
                              Repository Copy
                            </span>
                          ) : null}

                          {/* Open Access vs Access Restricted vs Verification State */}
                          {paper.is_downloaded ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                              <Unlock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Local PDF Ready</span>
                            </span>
                          ) : paper.is_open_access || paper.pdf_url ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                              <Unlock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              <span>
                                {paper.version_type === "accepted_manuscript"
                                  ? "Alternative Manuscript Available"
                                  : "Open Access Available"}
                              </span>
                            </span>
                          ) : paper.canonical_doi ? (
                            <span className="px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Publisher Access Required
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Metadata Only
                            </span>
                          )}

                          {/* Citation Count Badge */}
                          {typeof paper.citation_count === "number" &&
                            paper.citation_count > 0 && (
                              <span
                                className="px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                title={`${paper.citation_count} academic citations`}
                              >
                                {paper.citation_count} citations
                              </span>
                            )}

                          {/* Genuine Relevance Match (Only when strictly between 0 and 1) */}
                          {typeof paper.relevance_score === "number" &&
                            paper.relevance_score > 0 &&
                            paper.relevance_score < 0.999 && (
                              <span
                                className="px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                title="Calculated relevance score based on query term coverage and ranking"
                              >
                                Match: {Math.round(paper.relevance_score * 100)}%
                              </span>
                            )}

                          {/* Genuine Metadata Confidence */}
                          {typeof paper.metadata_confidence === "number" && (
                            <span
                              className="px-1.5 py-0.5 rounded font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              title="Metadata confidence across bibliographic fields, identifiers, and sources"
                            >
                              Conf: {Math.round(paper.metadata_confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Skeletons while additional papers are streaming in */}
                  {isSearching && visiblePapers.length > 0 && (
                    <PaperCardSkeleton count={2} className="opacity-70" />
                  )}

                  {/* Load More & Source Query Expansion */}
                  {filteredPapers.length > 0 && (
                    <div className="pt-2 pb-4 space-y-2">
                      {visibleCount < filteredPapers.length ? (
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 50)}
                          className="w-full py-2.5 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            Load More Papers (Showing {visiblePapers.length} of{" "}
                            {filteredPapers.length})
                          </span>
                        </button>
                      ) : (
                        <div className="text-center py-1.5 text-[11px] text-slate-400">
                          Showing all {filteredPapers.length} matching papers
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleLoadMoreFromSources}
                        disabled={isSearching}
                        className="w-full py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        title="Query academic sources for +50 additional papers without clearing existing results"
                      >
                        {isSearching ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                            <span>Fetching +50 from Sources...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Fetch +50 More from Academic Sources</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* Left Divider Handle (Drag-to-resize) */}
            {!effectiveLeftCollapsed && (
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                title="Drag to resize results list (Double-click to reset)"
                onPointerDown={handleLeftResizeStart}
                onMouseDown={handleLeftResizeStart}
                onDoubleClick={() => setLeftPaneWidth(360)}
                className={`relative group w-2 -ml-1 cursor-col-resize z-20 flex items-center justify-center select-none transition-colors shrink-0 ${
                  isDraggingLeft ? "bg-indigo-600/30" : "hover:bg-indigo-500/20"
                }`}
              >
                <div
                  className={`w-0.5 h-8 rounded-full transition-colors ${
                    isDraggingLeft
                      ? "bg-indigo-600 dark:bg-indigo-400 shadow-sm"
                      : "bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500"
                  }`}
                />
              </div>
            )}

            {/* =============================================================== */}
            {/* CENTER PANE: Embedded PDF Viewer or Truthful Retrieval State */}
            {/* =============================================================== */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-900/60 relative overflow-hidden">
              {selectedPaper ? (
                <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
                  {/* Viewer / Retrieval Body - Seamless Unified Header */}
                  <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                    {selectedPaper.is_downloaded && selectedPaper.local_pdf_path ? (
                      <EmbeddedPdfViewer
                        paperId={selectedPaper.paper_id || selectedPaper.id}
                        paperTitle={selectedPaper.title}
                        sourceUrl={selectedPaper.url}
                        localFilePath={selectedPaper.local_pdf_path}
                        targetPage={targetPdfPage}
                        sourceName={selectedPaper.source_name}
                        venue={selectedPaper.venue}
                        publicationYear={selectedPaper.publication_year}
                        canonicalDoi={selectedPaper.canonical_doi}
                        authors={selectedPaper.authors}
                        abstractText={selectedPaper.abstract_text}
                        isDownloaded={true}
                        hideRightPanel={true}
                        onImportLocal={() =>
                          handleOpenImportModal(
                            selectedPaper.source_name.toLowerCase().includes("ieee")
                              ? "ieee"
                              : "local",
                            selectedPaper
                          )
                        }
                      />
                    ) : selectedPaper.pdf_url ? (
                      <EmbeddedPdfViewer
                        paperId={selectedPaper.paper_id || selectedPaper.id}
                        remotePdfUrl={selectedPaper.pdf_url}
                        paperTitle={selectedPaper.title}
                        sourceUrl={selectedPaper.url}
                        targetPage={targetPdfPage}
                        sourceName={selectedPaper.source_name}
                        venue={selectedPaper.venue}
                        publicationYear={selectedPaper.publication_year}
                        canonicalDoi={selectedPaper.canonical_doi}
                        authors={selectedPaper.authors}
                        abstractText={selectedPaper.abstract_text}
                        isDownloaded={Boolean(selectedPaper.is_downloaded)}
                        hideRightPanel={true}
                        onSaveOffline={() => handleDownloadPdf(selectedPaper)}
                        isSavingOffline={Boolean(activePaperDownload)}
                        onResolveAgain={() => handleResolvePdf(selectedPaper)}
                        onImportLocal={() =>
                          handleOpenImportModal(
                            selectedPaper.source_name.toLowerCase().includes("ieee")
                              ? "ieee"
                              : "local",
                            selectedPaper
                          )
                        }
                        onRetry={() => {
                          const originalId = selectedPaper.id;
                          setSelectedPaperId(`${originalId}_retry`);
                          setTimeout(() => setSelectedPaperId(originalId), 20);
                        }}
                      />
                    ) : (
                      <div className="flex-1 flex flex-col w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950/40">
                        {/* Top Sticky Header */}
                        <div className="px-6 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-10">
                          <div className="min-w-0 pr-4">
                            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {selectedPaper.title}
                            </h2>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              {selectedPaper.source_name && (
                                <SourceBadge
                                  sourceName={selectedPaper.source_name}
                                  size="sm"
                                />
                              )}
                              <span>{selectedPaper.venue || "Academic Article"}</span>
                              {selectedPaper.publication_year && (
                                <span>• {selectedPaper.publication_year}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {selectedPaper.canonical_doi && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyDoi(selectedPaper.canonical_doi!)
                                }
                                title="Copy DOI"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                {copiedDoi ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                                <span>DOI</span>
                              </button>
                            )}

                            {selectedPaper.url && (
                              <a
                                href={selectedPaper.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Source Page</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Main Hero Container */}
                        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
                          {/* Hero Title & Authors Card */}
                          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <SourceBadge sourceName={selectedPaper.source_name} size="md" />
                              {selectedPaper.is_open_access ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <Unlock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>{selectedPaper.license_name || "Open Access"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  <span>Publisher Protected</span>
                                </span>
                              )}
                              {selectedPaper.peer_reviewed && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <Award className="w-3 h-3 text-blue-600" />
                                  <span>Peer Reviewed</span>
                                </span>
                              )}
                              {selectedPaper.publication_year && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {selectedPaper.publication_year}
                                </span>
                              )}
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                              {selectedPaper.title}
                            </h1>

                            {/* Authors Strip */}
                            {selectedPaper.authors && selectedPaper.authors.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-semibold text-slate-400">Authors:</span>
                                {selectedPaper.authors.map((author, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
                                  >
                                    {author}
                                  </span>
                                ))}
                              </div>
                            )}

                            {selectedPaper.venue && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                                Published in: {selectedPaper.venue}
                              </p>
                            )}

                            {/* Primary Action Buttons */}
                            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                              {selectedPaper.url ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => window.open(selectedPaper.url, "_blank")}
                                  className="text-xs font-semibold px-4 py-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                  Open Official Article Page
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenIeeeXplore(selectedPaper.title)}
                                  className="text-xs font-semibold px-4 py-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                  Search Publisher Archive
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResolvePdf(selectedPaper)}
                                className="text-xs font-semibold px-4 py-2 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                              >
                                <Globe className="w-3.5 h-3.5 mr-1.5" />
                                Resolve OA Mirrors
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleOpenImportModal(
                                    selectedPaper.source_name.toLowerCase().includes("ieee")
                                      ? "ieee"
                                      : "local",
                                    selectedPaper
                                  )
                                }
                                className="text-xs font-semibold px-4 py-2 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1.5" />
                                Import or Link Downloaded PDF
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleSave(selectedPaper)}
                                className="text-xs font-semibold px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Bookmark className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                                {selectedPaper.is_imported ? "In Library" : "Save to Library"}
                              </Button>
                            </div>
                          </div>

                          {/* Abstract Card */}
                          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                Abstract & Summary
                              </h3>
                              {selectedPaper.abstract_text && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedPaper.abstract_text || "");
                                    showToast("Abstract copied to clipboard!", "success");
                                  }}
                                  className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Abstract</span>
                                </button>
                              )}
                            </div>

                            {selectedPaper.abstract_text ? (
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                                {selectedPaper.abstract_text}
                              </p>
                            ) : (
                              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs italic space-y-2">
                                <p>No abstract text was provided in the publisher metadata feed for this record.</p>
                                <p className="text-[11px] text-slate-400">Click "Open Official Article Page" to view the complete article on the publisher website.</p>
                              </div>
                            )}
                          </div>

                          {/* Publisher Access Guidance */}
                          <div className="p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 flex items-start gap-3.5">
                            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                              <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div className="space-y-1 text-xs">
                              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedPaper.source_name.toLowerCase().includes("ieee")
                                  ? "IEEE Xplore Protected Document"
                                  : "No Direct PDF Stream Available"}
                              </h4>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                {selectedPaper.source_name.toLowerCase().includes("ieee")
                                  ? "IEEE Xplore protects full text documents with subscription paywalls and session tokens. In accordance with terms of service, search or download the Open Access paper through the official site, then link or import it."
                                  : `${selectedPaper.source_name} provides article metadata and abstract on its public page, but does not expose an unauthenticated direct PDF stream link.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : isSearching ? (
                <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Searching Academic Sources
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Querying{" "}
                          {sourceStatuses.filter(
                            (s) => s.status === "searching" || s.status === "queued"
                          ).length || selectedSources.length}{" "}
                          sources for &ldquo;{submittedQuery || searchQuery}&rdquo; using{" "}
                          {scrapingEngine === "python"
                            ? "Python Engine"
                            : "Rust Native Engine"}
                          &hellip;
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Skeletons representing incoming paper detail view */}
                  <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-[#0e1524]/70 space-y-5">
                    {/* Header Badges */}
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>

                    {/* Paper Title (2 lines) */}
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-11/12" />
                      <Skeleton className="h-6 w-3/4" />
                    </div>

                    {/* Authors & Year */}
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-20" />
                    </div>

                    {/* Action Buttons Toolbar Skeleton */}
                    <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                      <Skeleton className="h-8 w-28 rounded-lg" />
                      <Skeleton className="h-8 w-28 rounded-lg" />
                      <Skeleton className="h-8 w-32 rounded-lg" />
                    </div>

                    {/* Abstract Section */}
                    <div className="space-y-2.5 pt-3">
                      <Skeleton className="h-4 w-24" />
                      <TextSkeleton lines={5} lastLineWidth="65%" />
                    </div>

                    {/* Key Findings Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <CardSkeleton lines={2} />
                      <CardSkeleton lines={2} />
                    </div>
                  </div>
                </div>
              ) : submittedQuery && filteredPapers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                    <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      No Papers Found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      No papers were returned for &ldquo;{submittedQuery}&rdquo;.
                      {sourceStatuses.some(
                        (s) => s.status === "failed" || s.status === "blocked"
                      )
                        ? " Some sources encountered access restrictions (e.g., bot protection) or network errors."
                        : " Try broadening your search query or selecting additional sources."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenDiagnostics}
                      className="gap-1.5 text-xs"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>View Diagnostics</span>
                    </Button>
                    {sourceStatuses.some(
                      (s) =>
                        s.status === "failed" ||
                        s.status === "rate_limited" ||
                        s.status === "blocked"
                    ) && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleRetryFailedSources}
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Failed Sources</span>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={<BookOpen className="w-8 h-8 text-slate-400" />}
                    title="No Paper Selected"
                    description="Select a research paper from the left pane or perform a query search above."
                  />
                </div>
              )}
            </main>

            {/* Right Divider Handle (Drag-to-resize) */}
            {!effectiveRightCollapsed && selectedPaper && (
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                title="Drag to resize assistant panel (Double-click to reset)"
                onPointerDown={handleRightResizeStart}
                onMouseDown={handleRightResizeStart}
                onDoubleClick={() => setRightPaneWidth(380)}
                className={`relative group w-2 -mr-1 cursor-col-resize z-20 flex items-center justify-center select-none transition-colors shrink-0 ${
                  isDraggingRight ? "bg-indigo-600/30" : "hover:bg-indigo-500/20"
                }`}
              >
                <div
                  className={`w-0.5 h-8 rounded-full transition-colors ${
                    isDraggingRight
                      ? "bg-indigo-600 dark:bg-indigo-400 shadow-sm"
                      : "bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500"
                  }`}
                />
              </div>
            )}

            {/* Collapsed Right Strip */}
            {effectiveRightCollapsed && selectedPaper && (
              <div className="w-9 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-3 select-none z-10 transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setIsRightPaneCollapsed(false);
                    setIsDistractionFree(false);
                  }}
                  title="Expand assistant strip"
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <div className="mt-8 [writing-mode:vertical-rl] text-[10px] font-medium text-slate-400 select-none">
                  Assistant & Details
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* RIGHT PANE: Details, Context-Aware Paper Chat, 8 AI Insights, Notes */}
            {/* =============================================================== */}
            {!effectiveRightCollapsed &&
              (selectedPaper ? (
                <aside
                  style={{ width: `${rightPaneWidth}px` }}
                  className="shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 h-full overflow-hidden"
                >
                  {/* 4 Tabs Navigation Bar */}
                  <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 p-1.5 shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveRightTab("details")}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        activeRightTab === "details"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRightTab("chat")}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        activeRightTab === "chat"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRightTab("insights")}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        activeRightTab === "insights"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Insights</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRightTab("notes")}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        activeRightTab === "notes"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Notes</span>
                      {notes.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] flex items-center justify-center font-bold">
                          {notes.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRightPaneCollapsed(true)}
                      title="Minimize details"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-0.5"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Right Pane Body */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {/* TAB 1: DETAILS */}
                    {activeRightTab === "details" && (
                      <div className="p-4 space-y-4">
                        {/* Article Details Header */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Article Details
                          </span>
                          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {selectedPaper.title}
                          </h2>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {selectedPaper.authors.join(", ") || "Unknown Author"}
                          </p>
                        </div>

                        {/* Actions: Save to Library, Edit, Import PDF & Matrix */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <Button
                            variant={selectedPaper.is_imported ? "outline" : "primary"}
                            size="sm"
                            onClick={() => handleToggleSave(selectedPaper)}
                            className="text-xs"
                          >
                            <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                            {selectedPaper.is_imported ? "Saved" : "Save to Library"}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (setReadingPaper) {
                                setReadingPaper({
                                  id: selectedPaper.paper_id || selectedPaper.id,
                                  title: selectedPaper.title,
                                  sourceUrl:
                                    selectedPaper.local_pdf_path ||
                                    selectedPaper.pdf_url ||
                                    selectedPaper.url,
                                });
                              }
                              setActiveSection("literature_workspace");
                            }}
                            className="text-xs text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            title="Open paper in full Literature Workspace reader"
                          >
                            <BookOpen className="w-3.5 h-3.5 mr-1" />
                            Read in Workspace
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleOpenImportModal(
                                selectedPaper.is_imported ? "edit" : "local",
                                selectedPaper
                              )
                            }
                            className="text-xs text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            title="Edit or enrich paper metadata"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>

                          {!selectedPaper.is_downloaded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleOpenImportModal(
                                  selectedPaper.source_name.toLowerCase().includes("ieee")
                                    ? "ieee"
                                    : "local",
                                  selectedPaper
                                )
                              }
                              className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title="Link or import downloaded PDF"
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" />
                              Import PDF
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const pid = selectedPaper.paper_id || selectedPaper.id;
                                await addPaperToMatrix("default_matrix", pid);
                                showToast(
                                  "Added to Review Matrix & extracted dimensions!",
                                  "success"
                                );
                              } catch (err) {
                                showToast(
                                  "Could not add to matrix: " + String(err),
                                  "error"
                                );
                              }
                            }}
                            className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                            title="Add to Literature Review Matrix"
                          >
                            <TableProperties className="w-3.5 h-3.5 mr-1" />
                            Review Matrix
                          </Button>

                          {collections.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  void handleAddToCollection(e.target.value);
                                  e.target.value = "";
                                }
                              }}
                              defaultValue=""
                              aria-label="Add to Collection"
                              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                            >
                              <option value="" disabled>
                                + Add to Collection...
                              </option>
                              {collections.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Paper Assistant Quick Launcher Card */}
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span>Paper Assistant</span>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Grounded
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                            Ask questions with page-level citations, or trigger instant
                            structured insights.
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveRightTab("chat")}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Paper Chat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveRightTab("insights")}
                              className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
                            >
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                              <span>8 AI Insights</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setGlobalSelectedPaperId(
                                selectedPaper.paper_id || selectedPaper.id
                              );
                              setActiveSection("ai_hub");
                            }}
                            className="w-full flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open in Dedicated AI Workspace</span>
                          </button>
                        </div>

                        {/* Verified Information Section */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Verified Information
                          </span>

                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                              <span className="text-slate-400">Source</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {selectedPaper.source_name}
                              </span>
                            </div>

                            {selectedPaper.publication_year && (
                              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                                <span className="text-slate-400">Year</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {selectedPaper.publication_year}
                                </span>
                              </div>
                            )}

                            {selectedPaper.canonical_doi && (
                              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                                <span className="text-slate-400">DOI</span>
                                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                                  {selectedPaper.canonical_doi}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                              <span className="text-slate-400">Access Status</span>
                              <span
                                className={`font-semibold ${
                                  selectedPaper.is_open_access
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-slate-500"
                                }`}
                              >
                                {selectedPaper.is_open_access
                                  ? "Open Access Verified"
                                  : "Access not verified"}
                              </span>
                            </div>

                            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                              <span className="text-slate-400">PDF Document</span>
                              <span
                                className={`font-semibold ${
                                  selectedPaper.is_downloaded
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-500"
                                }`}
                              >
                                {selectedPaper.is_downloaded
                                  ? "Locally Available"
                                  : "Not Downloaded"}
                              </span>
                            </div>

                            {selectedPaper.license_name && (
                              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                                <span className="text-slate-400">License</span>
                                <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">
                                  {selectedPaper.license_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Abstract Section */}
                        {selectedPaper.paper_id &&
                          (!selectedPaper.abstract_text || !selectedPaper.pdf_url) && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={handleEnrichSelectedPaper}
                                disabled={isEnrichingMetadata}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isEnrichingMetadata ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Compass className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isEnrichingMetadata
                                    ? "Enriching Metadata..."
                                    : "Enrich Metadata via Scholarly APIs"}
                                </span>
                              </button>
                            </div>
                          )}

                        {selectedPaper.abstract_text && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-medium text-slate-500 block">
                              Abstract
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto pr-1">
                              {selectedPaper.abstract_text}
                            </p>
                          </div>
                        )}

                        {/* Collections List */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Collections
                          </span>
                          {selectedPaper.collection_ids &&
                          selectedPaper.collection_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedPaper.collection_ids.map((cid) => {
                                const col = collections.find((c) => c.id === cid);
                                return (
                                  <span
                                    key={cid}
                                    className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                                  >
                                    <span>{col ? col.name : cid}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFromCollection(cid)}
                                      className="text-slate-400 hover:text-rose-500"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">
                              Not assigned to any collections.
                            </p>
                          )}
                        </div>

                        {/* Research Notes (SQLite Persistent) */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Research Notes
                          </span>

                          {/* New Note Input */}
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              placeholder="Add a private note about this paper..."
                              value={newNoteText}
                              onChange={(e) => setNewNoteText(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!newNoteText.trim() || isSavingNote}
                              onClick={handleSaveNote}
                              className="text-xs h-7 w-full justify-center"
                            >
                              {isSavingNote ? "Saving..." : "Save Note"}
                            </Button>
                          </div>

                          {/* Notes List */}
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {notes.map((n) => (
                              <div
                                key={n.id}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(n.created_at).toLocaleDateString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(n.id)}
                                    className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-snug whitespace-pre-wrap">
                                  {n.content_markdown}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2 & 3: PAPER CHAT & AI INSIGHTS */}
                    {(activeRightTab === "chat" || activeRightTab === "insights") && (
                      <DiscoverPaperAssistant
                        paper={selectedPaper}
                        discoveredRawList={discoveredResults}
                        onNavigatePdfPage={(page) => setTargetPdfPage(page)}
                        onRefreshPaperNotes={() => {
                          const targetId = selectedPaper.paper_id || selectedPaper.id;
                          if (targetId) {
                            getNotesForPaper(targetId)
                              .then(setNotes)
                              .catch(() => {});
                          }
                        }}
                        onPaperSaved={(_newId) => {
                          // Keep selectedPaperId as is so paper selection and reader do not reset!
                          void refreshDatabase();
                        }}
                        showToast={showToast}
                      />
                    )}

                    {/* TAB 4: RESEARCH NOTES */}
                    {activeRightTab === "notes" && (
                      <div className="p-4 space-y-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Research Notes
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Notes are saved to your local SQLite database and tied to this
                            paper.
                          </p>
                        </div>

                        {/* New Note Input */}
                        <div className="space-y-1.5">
                          <textarea
                            rows={3}
                            placeholder="Add a private note about this paper..."
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!newNoteText.trim() || isSavingNote}
                            onClick={handleSaveNote}
                            className="text-xs h-7 w-full justify-center"
                          >
                            {isSavingNote ? "Saving..." : "Save Note"}
                          </Button>
                        </div>

                        {/* Notes List */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {notes.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">
                              No notes added for this paper yet.
                            </p>
                          ) : (
                            notes.map((n) => (
                              <div
                                key={n.id}
                                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(n.created_at).toLocaleDateString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(n.id)}
                                    className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-snug whitespace-pre-wrap">
                                  {n.content_markdown}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              ) : (
                <aside className="w-full sm:w-80 md:w-96 lg:w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 h-full overflow-hidden items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                    <Info className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isSearching ? "Searching Sources..." : "No Paper Selected"}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                    {isSearching
                      ? `Querying sources for "${submittedQuery || searchQuery}". Discovered paper details, abstract, and AI insights will appear here.`
                      : "Select a paper from the results list to view its full metadata, abstract, PDF stream, and AI research insights."}
                  </p>
                </aside>
              ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. TAB 2: ACADEMIC CONNECTORS POLICY NOTICE (NO-API SPECIFICATION) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "academic" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Academic Provider APIs Inactive
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Under the strict No-API Website-Driven scraper specification, external
              provider APIs (such as Crossref, OpenAlex, Semantic Scholar, and arXiv APIs)
              are disabled.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please use the <strong>Website-Driven Discovery</strong> tab above to search
              public academic websites without API keys.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveTab("website")}
              className="mt-2"
            >
              Go to Website-Driven Discovery
            </Button>
          </div>
        </div>
      )}

      {/* Source Diagnostics Modal */}
      {selectedDiagnosticsSource &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedDiagnosticsSource(null);
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto select-text"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Source Diagnostics: {selectedDiagnosticsSource.source_name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiagnosticsSource(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">
                    Operational Status
                  </span>
                  <span className="font-mono font-semibold uppercase">
                    {selectedDiagnosticsSource.status}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">
                    Results Returned
                  </span>
                  <span className="font-mono font-semibold">
                    {selectedDiagnosticsSource.results_count} paper(s)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">
                    Response Latency
                  </span>
                  <span className="font-mono">
                    {selectedDiagnosticsSource.elapsed_ms} ms
                  </span>
                </div>
                {selectedDiagnosticsSource.message && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                    <span className="font-semibold text-amber-800 dark:text-amber-200 block">
                      Diagnostic Note
                    </span>
                    <p className="text-amber-700 dark:text-amber-300 leading-relaxed font-mono text-[11px]">
                      {selectedDiagnosticsSource.message}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDiagnosticsSource(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Full Engine Diagnostics & Observability Modal (Phase L) */}
      {isDiagnosticsOpen &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDiagnosticsOpen(false);
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto my-auto select-text"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Scraping Engine Diagnostics & Observability
                    </h3>
                    <p className="text-xs text-slate-500">
                      Real-time crawler telemetry, adapter health, and session lifecycle
                      stats
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiagnosticsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isLoadingDiagnostics ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2 text-slate-500 pb-1">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-xs">Fetching engine telemetry...</span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              ) : engineDiagnostics ? (
                <div className="space-y-4 text-xs">
                  {/* Active Session & Engine Details */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Active Job ID: </span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {activeJobId || "Idle"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Engine: </span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {scrapingEngine === "python"
                            ? "Python Engine"
                            : "Rust Native Engine"}
                        </span>
                        {pythonEngineStatus && (
                          <span className="text-slate-400 ml-1">
                            ({pythonEngineStatus.available ? "Ready" : "Unavailable"})
                          </span>
                        )}
                      </div>
                    </div>
                    {submittedQuery && (
                      <div className="text-[11px] truncate">
                        <span className="text-slate-400">Submitted Query: </span>
                        <span className="italic text-slate-700 dark:text-slate-300">
                          &ldquo;{submittedQuery}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status overview cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Engine Version
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {engineDiagnostics.engine_version}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Total Searches
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {engineDiagnostics.total_searches}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Success / Failed
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {engineDiagnostics.successful_searches}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="font-mono font-bold text-rose-500">
                        {engineDiagnostics.failed_searches}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Uptime
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {engineDiagnostics.uptime_seconds}s
                      </span>
                    </div>
                  </div>

                  {/* Adapter Telemetry Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Configured Source Adapters ({engineDiagnostics.sources.length})
                      </span>
                      {sourceStatuses.some(
                        (s) => s.status === "failed" || s.status === "blocked"
                      ) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsDiagnosticsOpen(false);
                            handleRetryFailedSources();
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry Failed Sources</span>
                        </button>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Source</th>
                            <th className="py-2 px-2 font-semibold">Status</th>
                            <th className="py-2 px-2 font-semibold">Requests</th>
                            <th className="py-2 px-2 font-semibold">Papers</th>
                            <th className="py-2 px-2 font-semibold">Latency</th>
                            <th className="py-2 px-3 font-semibold">Last Status/Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {engineDiagnostics.sources.map((src) => {
                            const isFailed =
                              src.last_error &&
                              src.last_error !== "Nominal" &&
                              !src.last_error.startsWith("Success");
                            return (
                              <tr
                                key={src.source_id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                              >
                                <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                                  <div>{src.source_name}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    {src.source_id}
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <Badge
                                    variant={
                                      src.status === "enabled"
                                        ? "success"
                                        : src.status === "manual_only"
                                          ? "warning"
                                          : "default"
                                    }
                                  >
                                    {src.status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">
                                  {src.total_requests} ({src.successful_requests} ok)
                                </td>
                                <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">
                                  {src.total_papers_found}
                                </td>
                                <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">
                                  {src.last_elapsed_ms}ms
                                </td>
                                <td className="py-2 px-3 text-[10px] text-slate-500 max-w-[200px]">
                                  <div
                                    className={
                                      isFailed
                                        ? "text-rose-600 dark:text-rose-400 font-medium truncate"
                                        : "truncate"
                                    }
                                  >
                                    {src.last_error || "Nominal"}
                                  </div>
                                  {isFailed && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsDiagnosticsOpen(false);
                                        void handleExecuteSearch(searchQuery, [
                                          src.source_id,
                                        ]);
                                      }}
                                      className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
                                    >
                                      Retry Source
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Academic Scholarly Source Connectors (Rust Core Phase 17) */}
                  <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Scholarly API Source Connectors (
                        {academicCapabilities.length || 5})
                      </span>
                      <button
                        type="button"
                        onClick={handleRunHealthCheck}
                        disabled={isCheckingHealth}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer disabled:opacity-50"
                      >
                        {isCheckingHealth ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span>
                          {isCheckingHealth ? "Testing Health..." : "Probe Source Health"}
                        </span>
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2 px-3 font-semibold">
                              Scholarly Provider
                            </th>
                            <th className="py-2 px-2 font-semibold">Category</th>
                            <th className="py-2 px-2 font-semibold">Capabilities</th>
                            <th className="py-2 px-2 font-semibold">Health Status</th>
                            <th className="py-2 px-2 font-semibold">Latency</th>
                            <th className="py-2 px-3 font-semibold">Rate Limit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {academicCapabilities.map((cap) => {
                            const health = academicHealthChecks.find(
                              (h) =>
                                h.provider_id.toLowerCase() ===
                                cap.provider_id.toLowerCase()
                            );
                            const status = health ? health.status : "healthy";
                            return (
                              <tr
                                key={cap.provider_id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                              >
                                <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                                  <div>{cap.display_name}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    {cap.provider_id}
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                    {cap.category || "General Scholarly"}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex flex-wrap gap-1">
                                    {cap.supports_doi_lookup && (
                                      <span className="px-1 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        DOI
                                      </span>
                                    )}
                                    {cap.supports_year_filter && (
                                      <span className="px-1 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        Year
                                      </span>
                                    )}
                                    {cap.supports_open_access_filter && (
                                      <span className="px-1 py-0.5 rounded text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                        OA
                                      </span>
                                    )}
                                    {cap.supports_pdf_discovery && (
                                      <span className="px-1 py-0.5 rounded text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                                        PDF
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <Badge
                                    variant={
                                      status === "healthy"
                                        ? "success"
                                        : status === "degraded" ||
                                            status === "rate_limited"
                                          ? "warning"
                                          : "destructive"
                                    }
                                  >
                                    {status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">
                                  {health ? `${health.latency_ms}ms` : "—"}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                                  {cap.rate_limit_rps
                                    ? `${cap.rate_limit_rps} RPS`
                                    : "Standard"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <span>No diagnostics telemetry available yet.</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (engineDiagnostics) {
                      const report = {
                        job_id: activeJobId || "none",
                        query: submittedQuery || searchQuery || "none",
                        engine: scrapingEngine,
                        python_status: pythonEngineStatus?.available
                          ? pythonEngineStatus.version || "Ready"
                          : pythonEngineStatus?.error || "Unavailable",
                        diagnostics: engineDiagnostics,
                        sources: sourceStatuses,
                        generated_at: new Date().toISOString(),
                      };
                      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
                      showToast(
                        "Redacted diagnostics report copied to clipboard",
                        "success"
                      );
                    }
                  }}
                  disabled={!engineDiagnostics}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Diagnostics Report</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsDiagnosticsOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Paper Import and Metadata Edit Modal */}
      <PaperImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialMode={importModalMode}
        initialPaper={importModalPaper}
        initialQuery={searchQuery}
        onSuccess={(paperId) => {
          setSelectedPaperId(paperId);
          void refreshDatabase();
        }}
      />
    </div>
  );
};
