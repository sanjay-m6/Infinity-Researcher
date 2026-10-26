import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
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
  WebsiteSourceDescriptor,
  DiscoveredSearchResult,
  SourceSearchStatus,
  SearchStreamEvent,
  addPaperToMatrix,
} from "../../lib/desktop-api";
import {
  Globe,
  Key,
  Play,
  Pause,
  Code2,
  BookOpen,
  Download,
  Search,
  Info,
  Bookmark,
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
  RefreshCw,
  Activity,
  Sparkles,
  Clock,
  MessageSquare,
  Lightbulb,
  TableProperties,
  Plus,
} from "lucide-react";
import { discoverSessionStore } from "./discoverSessionStore";
import { DiscoverPaperAssistant } from "./DiscoverPaperAssistant";

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
    policy_notes: "Cold Spring Harbor Laboratory preprint repository. Permitted HTML search.",
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
    status: "manual_only",
    policy_url: "https://ieeexplore.ieee.org/XploreHelp/legal-terms",
    policy_notes: "Automated crawling restricted by terms of service. Manual bibtex/OA import workflow available.",
    supports_native_years: true,
    request_delay_ms: 0,
    content_types: ["conference_paper", "journal_article"],
  },
  {
    id: "google_scholar",
    name: "Google Scholar",
    domain: "scholar.google.com",
    status: "disabled",
    policy_url: "https://policies.google.com/terms",
    policy_notes: "Automated search is strictly prohibited by Google Terms of Service and protected by CAPTCHAs.",
    supports_native_years: false,
    request_delay_ms: 0,
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
  } = useApp();

  // ---------------------------------------------------------------------------
  // Backed by discoverSessionStore to guarantee zero reset across navigation
  // ---------------------------------------------------------------------------
  const session = discoverSessionStore.getState();

  // Primary mode tabs
  const [activeTab, setActiveTab] = useState<"website" | "academic">("website");
  const [scrapingEngine, setScrapingEngine] = useState<"rust" | "python">(session.activeEngine);
  const [pythonEngineStatus, setPythonEngineStatus] = useState<PythonEngineStatus | null>(null);

  // Check Python engine health on mount
  useEffect(() => {
    getPythonEngineStatus()
      .then((status) => {
        setPythonEngineStatus(status);
      })
      .catch(() => {});
  }, []);

  // Engine diagnostics state (Phase L)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [engineDiagnostics, setEngineDiagnostics] = useState<EngineDiagnostics | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  const handleOpenDiagnostics = async () => {
    setIsDiagnosticsOpen(true);
    setIsLoadingDiagnostics(true);
    try {
      const diag = await getScrapingEngineDiagnostics();
      setEngineDiagnostics(diag);
    } catch (err) {
      console.error("Failed to load engine diagnostics:", err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Part B: Query-First Search Experience State
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState<string>(globalSearchQuery || session.searchQuery || "");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [discoveredResults, setDiscoveredResults] = useState<DiscoveredSearchResult[]>(session.discoveredResults);
  const [sourceStatuses, setSourceStatuses] = useState<SourceSearchStatus[]>(session.sourceStatuses);
  const [availableSources, setAvailableSources] = useState<WebsiteSourceDescriptor[]>(DEFAULT_WEBSITE_SOURCES);
  const [selectedSources, setSelectedSources] = useState<string[]>(
    session.selectedSources.length > 0
      ? session.selectedSources
      : ["arxiv", "biorxiv", "medrxiv", "plos", "nature_srep", "pmc"]
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
  const [filterYearStart, setFilterYearStart] = useState<number | null>(session.filterYearStart);
  const [filterYearEnd, setFilterYearEnd] = useState<number | null>(session.filterYearEnd);
  const [filterContentType, setFilterContentType] = useState<string>(session.filterContentType);
  const [filterAccessStatus, setFilterAccessStatus] = useState<string>(session.filterAccessStatus);
  const [filterAuthor, setFilterAuthor] = useState<string>(session.filterAuthor);
  const [filterVenue, setFilterVenue] = useState<string>(session.filterVenue);
  const [filterPeerReviewedOnly, setFilterPeerReviewedOnly] = useState<boolean>(session.filterPeerReviewedOnly);
  const [sortBy, setSortBy] = useState<"best_match" | "newest" | "oldest" | "title_az" | "author_az">(session.sortBy);
  const [limitPerSource, setLimitPerSource] = useState<number>(session.limitPerSource || 50);
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // ---------------------------------------------------------------------------
  // Relocated URL Inspection & Crawl Tools State
  // ---------------------------------------------------------------------------
  const [seedUrl, setSeedUrl] = useState<string>(
    "https://www.biorxiv.org/content/early/recent"
  );
  const [crawlProfiles, setCrawlProfiles] = useState<CrawlProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<ExtractionPreviewResult | null>(null);
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
  const [selectedDiagnosticsSource, setSelectedDiagnosticsSource] = useState<SourceSearchStatus | null>(null);

  // Collapsible Advanced Website Inspection drawer
  const [isInspectOpen, setIsInspectOpen] = useState<boolean>(false);

  // Three-Pane Workspace State
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(session.selectedPaperId);
  const [quickFilter, setQuickFilter] = useState<"all" | "oa" | "downloaded">(session.quickFilter);
  const [textFilter, setTextFilter] = useState<string>(session.textFilter);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState<boolean>(session.isLeftPaneCollapsed);
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState<boolean>(session.isRightPaneCollapsed);

  // Active Right Pane Tab: 'details' | 'chat' | 'insights' | 'notes'
  const [activeRightTab, setActiveRightTab] = useState<"details" | "chat" | "insights" | "notes">(session.activeRightTab);
  // Target PDF page for instant grounded citation jumps
  const [targetPdfPage, setTargetPdfPage] = useState<number | undefined>(session.targetPdfPage);

  // Notes state for selected paper
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [copiedDoi, setCopiedDoi] = useState<boolean>(false);

  // Synchronize state changes to discoverSessionStore for persistent retention
  useEffect(() => {
    discoverSessionStore.setState({
      searchQuery,
      discoveredResults,
      sourceStatuses,
      selectedSources,
      activeEngine: scrapingEngine,
      selectedPaperId,
      activeRightTab,
      isLeftPaneCollapsed,
      isRightPaneCollapsed,
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
    discoveredResults,
    sourceStatuses,
    selectedSources,
    scrapingEngine,
    selectedPaperId,
    activeRightTab,
    isLeftPaneCollapsed,
    isRightPaneCollapsed,
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
    const interval = setInterval(loadDownloads, 3000);
    return () => clearInterval(interval);
  }, [loadCrawlData, loadDownloads]);

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
      map.set(key, {
        id: key,
        paper_id: null,
        title: r.title,
        authors: r.authors || [],
        publication_date: r.publication_date,
        publication_year: r.publication_year,
        venue: r.venue || r.source_name,
        canonical_doi: r.canonical_doi,
        abstract_text: r.abstract_text,
        pdf_url: r.pdf_url,
        url: r.landing_url,
        is_imported: false,
        is_downloaded: false,
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
      });
    }

    // 2. Library papers from AppContext
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
      });
    }

    // 3. Crawled papers from selected job
    for (const jp of jobPapers) {
      const existing = jp.paper_id ? map.get(jp.paper_id) : null;
      if (existing) {
        if (jp.pdf_url && !existing.pdf_url) existing.pdf_url = jp.pdf_url;
      } else {
        const key = jp.paper_id || jp.id;
        map.set(key, {
          id: key,
          paper_id: jp.paper_id,
          title: jp.title,
          authors: jp.authors || [],
          publication_date: jp.publication_date,
          publication_year: jp.publication_date ? parseInt(jp.publication_date, 10) || null : null,
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

    // 4. Current inspected page preview
    if (previewResult) {
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
  }, [discoveredResults, papers, jobPapers, previewResult]);

  // ---------------------------------------------------------------------------
  // Filter & Sort Logic
  // ---------------------------------------------------------------------------
  const filteredPapers = useMemo(() => {
    const list = unifiedPapers.filter((p) => {
      // Quick filter tabs
      if (quickFilter === "oa" && !p.is_open_access) return false;
      if (quickFilter === "downloaded" && !p.is_downloaded) return false;

      // Advanced Year filter
      if (filterYearStart && p.publication_year && p.publication_year < filterYearStart) return false;
      if (filterYearEnd && p.publication_year && p.publication_year > filterYearEnd) return false;

      // Advanced Content Type filter
      if (filterContentType !== "all" && p.content_type && p.content_type !== filterContentType) return false;

      // Advanced Access Status filter
      if (filterAccessStatus === "open_access" && !p.is_open_access) return false;
      if (filterAccessStatus === "pdf_available" && !p.pdf_url && !p.local_pdf_path) return false;

      // Advanced Author search
      if (filterAuthor.trim()) {
        const needle = filterAuthor.toLowerCase();
        const matchesAuthor = p.authors.some((a) => a.toLowerCase().includes(needle));
        if (!matchesAuthor) return false;
      }

      // Advanced Venue search
      if (filterVenue !== "all" && p.venue && !p.venue.toLowerCase().includes(filterVenue.toLowerCase())) return false;

      // Peer-review filter
      if (filterPeerReviewedOnly && !p.peer_reviewed) return false;

      // In-page text search (compact search bar)
      if (textFilter.trim()) {
        const query = textFilter.toLowerCase();
        const inTitle = p.title.toLowerCase().includes(query);
        const inAuthors = p.authors.some((a) => a.toLowerCase().includes(query));
        const inDoi = p.canonical_doi?.toLowerCase().includes(query) || false;
        const inVenue = p.venue?.toLowerCase().includes(query) || false;
        if (!inTitle && !inAuthors && !inDoi && !inVenue) return false;
      }

      return true;
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
    } else if (sortBy === "best_match") {
      list.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
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
  ]);

  // Sliced visible papers for progressive loading & "Load More" pagination
  const visiblePapers = useMemo(() => {
    return filteredPapers.slice(0, visibleCount);
  }, [filteredPapers, visibleCount]);

  // Active selected paper
  const selectedPaper: UnifiedDiscoverPaper | null = useMemo(() => {
    if (!selectedPaperId) {
      return filteredPapers.length > 0 ? filteredPapers[0] : null;
    }
    return (
      unifiedPapers.find((p) => p.id === selectedPaperId) ||
      (filteredPapers.length > 0 ? filteredPapers[0] : null)
    );
  }, [selectedPaperId, filteredPapers, unifiedPapers]);

  // Load notes for selected paper
  useEffect(() => {
    const targetId = selectedPaper?.paper_id || selectedPaper?.id;
    if (!targetId || targetId.startsWith("preview_") || targetId.startsWith("websearch_")) {
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
    customLimit?: number
  ) => {
    const q = (queryToSearch ?? searchQuery).trim();
    if (!q) {
      showToast("Please enter a research topic, keyword, or author name.", "warning");
      return;
    }

    // Persist recent search
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 8);
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

    const targetSources =
      retrySourcesOnly && retrySourcesOnly.length > 0
        ? retrySourcesOnly
        : selectedSources.length > 0
        ? selectedSources
        : ["arxiv", "biorxiv", "medrxiv", "plos", "nature_srep", "pmc"];

    setIsSearching(true);

    if (!retrySourcesOnly && !isLoadMore) {
      setDiscoveredResults([]);
      setVisibleCount(customLimit || limitPerSource);
    }

    // Initialize source statuses
    setSourceStatuses((prev) => {
      const nextMap = new Map<string, SourceSearchStatus>(
        (retrySourcesOnly || isLoadMore) ? prev.map((s) => [s.source_id, s]) : []
      );
      for (const srcId of targetSources) {
        const desc = availableSources.find((s) => s.id === srcId);
        nextMap.set(srcId, {
          source_id: srcId,
          source_name: desc?.name || srcId,
          status: "searching",
          message: isLoadMore ? "Fetching more papers..." : "Searching source...",
          results_count: (retrySourcesOnly || isLoadMore) ? nextMap.get(srcId)?.results_count || 0 : 0,
          elapsed_ms: 0,
        });
      }
      return Array.from(nextMap.values());
    });

    try {
      const effectiveLimit = customLimit || limitPerSource;
      const searchFn = scrapingEngine === "python" ? startPythonSearchStream : startWebsiteSearchStream;
      const unlisten = await searchFn(
        {
          query: q,
          sources: targetSources,
          year_start: filterYearStart,
          year_end: filterYearEnd,
          content_type: filterContentType !== "all" ? filterContentType : null,
          open_access_only: filterAccessStatus === "open_access",
          author: filterAuthor.trim() || null,
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
                const nextList = idx >= 0 ? prev.map((s, i) => (i === idx ? updated : s)) : [...prev, updated];
                const anyStillSearching = nextList.some((s) => s.status === "searching" || s.status === "queued");
                if (!anyStillSearching && nextList.length > 0) {
                  setIsSearching(false);
                }
                return nextList;
              });
              break;
            }
            case "paper_found": {
              setDiscoveredResults((prev) => {
                const duplicateIndex = prev.findIndex(
                  (p) =>
                    (p.canonical_doi &&
                      event.paper.canonical_doi &&
                      p.canonical_doi.toLowerCase() === event.paper.canonical_doi.toLowerCase()) ||
                    p.id === event.paper.id ||
                    p.title.toLowerCase().trim() === event.paper.title.toLowerCase().trim()
                );

                if (duplicateIndex >= 0) {
                  const copy = [...prev];
                  const existing = copy[duplicateIndex];
                  copy[duplicateIndex] = {
                    ...existing,
                    pdf_url: existing.pdf_url || event.paper.pdf_url,
                    abstract_text: existing.abstract_text || event.paper.abstract_text,
                    canonical_doi: existing.canonical_doi || event.paper.canonical_doi,
                  };
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
                        status: event.count > 0 ? ("completed" as const) : ("no_results" as const),
                        results_count: event.count,
                        elapsed_ms: event.elapsed_ms,
                      }
                    : s
                );
                const anyStillSearching = nextList.some((s) => s.status === "searching" || s.status === "queued");
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
                const anyStillSearching = nextList.some((s) => s.status === "searching" || s.status === "queued");
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
      const msg = e instanceof Error ? e.message : String(e);
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
        s.status === "searching"
          ? { ...s, status: "cancelled", message: "Search cancelled by user" }
          : s
      )
    );
    showToast("Search cancelled.", "info");
  };

  const handleRetryFailedSources = () => {
    const failedSources = sourceStatuses
      .filter((s) => s.status === "failed" || s.status === "rate_limited" || s.status === "cancelled" || s.status === "timeout")
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
    setDiscoveredResults([]);
    setSourceStatuses([]);
    discoverSessionStore.setState({
      searchQuery: "",
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
      const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to start crawl: ${msg}`, "error");
    } finally {
      setIsStartingCrawl(false);
    }
  };

  const handleJobAction = async (jobId: string, action: "pause" | "resume" | "cancel") => {
    try {
      if (action === "pause") await pauseCrawlJob(jobId);
      if (action === "resume") await resumeCrawlJob(jobId);
      if (action === "cancel") await cancelCrawlJob(jobId);
      showToast(`Job ${action}d successfully.`, "info");
      await loadCrawlData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
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
        setSelectedPaperId(saved.id);
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
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
      showToast("No direct PDF URL detected for this record.", "warning");
      return;
    }

    try {
      let validPaperId = targetId;
      if (targetId.startsWith("preview_") || targetId.startsWith("websearch_") || !paper.is_imported) {
        const raw = discoveredResults.find((r) => `websearch_${r.id}` === paper.id);
        if (raw) {
          const imported = await importDiscoveredSearchResult(raw);
          validPaperId = imported.id;
        } else {
          const imported = await importSinglePage(paper.url, selectedProfileId || null, null);
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
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Download failed: ${msg}`, "error");
    }
  };

  const handleResolvePdf = async (paper: UnifiedDiscoverPaper) => {
    const targetId = paper.paper_id || paper.id;
    if (targetId.startsWith("preview_") || targetId.startsWith("websearch_") || !paper.is_imported) {
      showToast("Please save this paper to library first before resolving Open Access.", "info");
      return;
    }

    try {
      const res = await resolvePaperPdf(targetId);
      if (res.best_url) {
        showToast(`Resolved Open Access PDF: ${res.best_url}`, "success");
        await handleDownloadPdf({
          ...paper,
          pdf_url: res.best_url,
        });
      } else {
        showToast("No automated open access PDF resolved for this DOI/URL.", "info");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Toggle failed: ${msg}`, "error");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedPaper || !newNoteText.trim()) return;
    const targetId = selectedPaper.paper_id || selectedPaper.id;

    if (targetId.startsWith("preview_") || targetId.startsWith("websearch_") || !selectedPaper.is_imported) {
      showToast("Please save this paper to library first before adding persistent notes.", "info");
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
      const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to delete note: ${msg}`, "error");
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (!selectedPaper || !collectionId) return;
    const targetId = selectedPaper.paper_id || selectedPaper.id;

    if (targetId.startsWith("preview_") || targetId.startsWith("websearch_") || !selectedPaper.is_imported) {
      showToast("Saving paper to library first...", "info");
      let validId: string;
      const raw = discoveredResults.find((r) => `websearch_${r.id}` === targetId);
      if (raw) {
        const imported = await importDiscoveredSearchResult(raw, collectionId);
        validId = imported.id;
      } else {
        const imported = await importSinglePage(selectedPaper.url, selectedProfileId || null, collectionId);
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
      const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
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
      (j) => j.paper_id === targetId && (j.status === "downloading" || j.status === "queued")
    );
  }, [selectedPaper, downloadJobs]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none bg-slate-50 dark:bg-slate-950">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header Toolbar & Navigation Tabs */}
      {/* --------------------------------------------------------------------- */}
      <header className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
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
              <Badge variant="success" size="sm">Active</Badge>
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
              <Badge variant="outline" size="sm">Disabled in No-API Mode</Badge>
            </button>

            {/* Desktop Pane Collapse Toggles */}
            {activeTab === "website" && (
              <div className="hidden lg:flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeftPaneCollapsed(!isLeftPaneCollapsed)}
                  title={isLeftPaneCollapsed ? "Expand search list pane" : "Collapse search list pane"}
                  className={`p-1.5 rounded-md border text-xs transition-colors ${
                    isLeftPaneCollapsed
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Sidebar className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRightPaneCollapsed(!isRightPaneCollapsed)}
                  title={isRightPaneCollapsed ? "Expand details pane" : "Collapse details pane"}
                  className={`p-1.5 rounded-md border text-xs transition-colors ${
                    isRightPaneCollapsed
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Info className="w-4 h-4" />
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
          {/* ================================================================= */}
          {/* GLOBAL QUERY SEARCH & FILTER BAR */}
          {/* ================================================================= */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              {/* Primary Search Input */}
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
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
                              availableSources.filter((s) => s.status === "enabled").map((s) => s.id)
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
                            s.name.toLowerCase().includes(sourceSearchText.toLowerCase()) ||
                            s.domain.toLowerCase().includes(sourceSearchText.toLowerCase())
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
                                    setSelectedSources((prev) => prev.filter((id) => id !== source.id));
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
                <span className="text-slate-400 text-[11px] whitespace-nowrap">Fetch:</span>
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
                  <option value={15} className="dark:bg-slate-800">15 / source</option>
                  <option value={25} className="dark:bg-slate-800">25 / source</option>
                  <option value={50} className="dark:bg-slate-800">50 / source (Default)</option>
                  <option value={100} className="dark:bg-slate-800">100 / source</option>
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
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pythonEngineStatus?.available ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
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
                          setFilterYearStart(e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="number"
                        placeholder="To"
                        value={filterYearEnd || ""}
                        onChange={(e) =>
                          setFilterYearEnd(e.target.value ? parseInt(e.target.value, 10) : null)
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
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as "best_match" | "newest" | "oldest" | "title_az" | "author_az"
                          )
                        }
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value="best_match">Best Match (Relevance)</option>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title_az">Title A–Z</option>
                        <option value="author_az">Author A–Z</option>
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
          <div className="flex-1 flex min-h-0 w-full overflow-hidden">
            {/* =============================================================== */}
            {/* LEFT PANE: Results, Source Badges & Relocated URL Inspector */}
            {/* =============================================================== */}
            {!isLeftPaneCollapsed && (
              <aside className="w-full sm:w-80 md:w-96 lg:w-[380px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 h-full">
                {/* Results Toolbar */}
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Results ({filteredPapers.length})
                    </span>

                    {/* Quick filter pills */}
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
                  </div>

                  {/* Live Search Progress Banner */}
                  {isSearching && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                        <span className="truncate">
                          Searching {sourceStatuses.filter(s => s.status === "searching" || s.status === "queued").length} of {sourceStatuses.length || selectedSources.length} sources… ({discoveredResults.length} found)
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
                        {discoveredResults.length} paper{discoveredResults.length === 1 ? "" : "s"} found across {sourceStatuses.filter(s => s.status === "completed").length} source{sourceStatuses.filter(s => s.status === "completed").length === 1 ? "" : "s"}.
                      </span>
                      {sourceStatuses.some(s => s.status === "failed" || s.status === "rate_limited" || s.status === "cancelled" || s.status === "timeout") && (
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
                        let chipStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                        let statusLabel = `${st.results_count} found`;
                        let icon: React.ReactNode = null;

                        if (st.status === "searching" || st.status === "queued") {
                          chipStyle = "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
                          statusLabel = "searching";
                          icon = <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-600" />;
                        } else if (st.status === "completed") {
                          chipStyle = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
                          statusLabel = `${st.results_count} found`;
                          icon = <Check className="w-2.5 h-2.5 text-emerald-600" />;
                        } else if (st.status === "no_results") {
                          chipStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                          statusLabel = "0 found";
                        } else if (st.status === "blocked") {
                          chipStyle = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "blocked";
                          icon = <ShieldAlert className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "unsupported") {
                          chipStyle = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "unsupported";
                          icon = <AlertCircle className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "rate_limited") {
                          chipStyle = "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800";
                          statusLabel = "rate limited";
                          icon = <AlertCircle className="w-2.5 h-2.5 text-orange-600" />;
                        } else if (st.status === "failed") {
                          chipStyle = "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
                          statusLabel = "failed";
                          icon = <X className="w-2.5 h-2.5 text-rose-600" />;
                        } else if (st.status === "timeout") {
                          chipStyle = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
                          statusLabel = "timed out";
                          icon = <Clock className="w-2.5 h-2.5 text-amber-600" />;
                        } else if (st.status === "cancelled") {
                          chipStyle = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
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
                      {isInspectOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
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
                            { name: "bioRxiv Recent", url: "https://www.biorxiv.org/content/early/recent" },
                            { name: "PLOS ONE", url: "https://journals.plos.org/plosone/" },
                            { name: "Nature Scientific Reports", url: "https://www.nature.com/srep/" },
                            { name: "arXiv CS List", url: "https://arxiv.org/list/cs/recent" },
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

                  {/* Discovered Papers List */}
                  {visiblePapers.map((paper) => {
                    const isSelected = selectedPaper?.id === paper.id;
                    return (
                      <div
                        key={paper.id}
                        onClick={() => setSelectedPaperId(paper.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs"
                            : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
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

                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {/* Source badge */}
                          <span className="px-1.5 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {paper.source_name}
                          </span>

                          {/* OA badge */}
                          {paper.is_open_access ? (
                            <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              OA
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Access not verified
                            </span>
                          )}

                          {/* PDF state */}
                          {paper.is_downloaded ? (
                            <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-500 text-white">
                              Downloaded
                            </span>
                          ) : paper.pdf_url ? (
                            <span className="px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              PDF Found
                            </span>
                          ) : null}

                          {/* Relevance match */}
                          {typeof paper.relevance_score === "number" && paper.relevance_score > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              title="Explainable relevance score based on query term coverage and matching"
                            >
                              Match: {Math.round(paper.relevance_score * 100)}%
                            </span>
                          )}

                          {/* Metadata confidence */}
                          {typeof paper.metadata_confidence === "number" && (
                            <span
                              className="px-1.5 py-0.5 rounded font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              title="Confidence across title, authors, DOI, abstract, and PDF links"
                            >
                              Conf: {Math.round(paper.metadata_confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Load More & Source Query Expansion */}
                  {filteredPapers.length > 0 && (
                    <div className="pt-2 pb-4 space-y-2">
                      {visibleCount < filteredPapers.length && (
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 50)}
                          className="w-full py-2.5 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            Load More Papers (Showing {visiblePapers.length} of {filteredPapers.length})
                          </span>
                        </button>
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

            {/* =============================================================== */}
            {/* CENTER PANE: Embedded PDF Viewer or Truthful Retrieval State */}
            {/* =============================================================== */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-900/60 relative overflow-hidden">
              {selectedPaper ? (
                <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
                  {/* Top metadata strip */}
                  <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="min-w-0 pr-3">
                      <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {selectedPaper.title}
                      </h2>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>{selectedPaper.venue || "Academic Article"}</span>
                        {selectedPaper.publication_year && (
                          <span>• {selectedPaper.publication_year}</span>
                        )}
                        <span>• Source: {selectedPaper.source_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {selectedPaper.pdf_url && !selectedPaper.is_downloaded && (
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(selectedPaper)}
                          disabled={Boolean(activePaperDownload)}
                          title="Save offline to library"
                          className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>{activePaperDownload ? "Saving..." : "Save Offline"}</span>
                        </button>
                      )}
                      {selectedPaper.canonical_doi && (
                        <button
                          type="button"
                          onClick={() => handleCopyDoi(selectedPaper.canonical_doi!)}
                          title="Copy DOI"
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1"
                        >
                          {copiedDoi ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                          <span className="font-mono text-[10px]">DOI</span>
                        </button>
                      )}

                      {selectedPaper.url && (
                        <a
                          href={selectedPaper.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                          <span>Source Page</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Viewer / Retrieval Body */}
                  <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                    {selectedPaper.is_downloaded && selectedPaper.local_pdf_path ? (
                      <EmbeddedPdfViewer
                        paperId={selectedPaper.paper_id || selectedPaper.id}
                        paperTitle={selectedPaper.title}
                        sourceUrl={selectedPaper.url}
                        targetPage={targetPdfPage}
                      />
                    ) : selectedPaper.pdf_url ? (
                      <EmbeddedPdfViewer
                        remotePdfUrl={selectedPaper.pdf_url}
                        paperTitle={selectedPaper.title}
                        sourceUrl={selectedPaper.url}
                        targetPage={targetPdfPage}
                        onSaveOffline={() => handleDownloadPdf(selectedPaper)}
                        isSavingOffline={Boolean(activePaperDownload)}
                        onRetry={() => {
                          const originalId = selectedPaper.id;
                          setSelectedPaperId(`${originalId}_retry`);
                          setTimeout(() => setSelectedPaperId(originalId), 20);
                        }}
                      />
                    ) : (
                      <div className="max-w-md w-full mx-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
                          <BookOpen className="w-6 h-6" />
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            No Direct PDF Stream Available
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {selectedPaper.source_name} provides article metadata and abstract on its public page, but does not expose an unauthenticated direct PDF stream link.
                          </p>
                        </div>

                        <div className="space-y-2 pt-2">
                          {selectedPaper.url && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => window.open(selectedPaper.url, "_blank")}
                              className="w-full justify-center"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              Open Source Article Page
                            </Button>
                          )}

                          {selectedPaper.canonical_doi && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolvePdf(selectedPaper)}
                              className="w-full justify-center text-xs"
                            >
                              <Globe className="w-3.5 h-3.5 mr-1.5" />
                              Resolve OA Alternative
                            </Button>
                          )}
                        </div>
                      </div>
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

            {/* =============================================================== */}
            {/* RIGHT PANE: Details, Context-Aware Paper Chat, 8 AI Insights, Notes */}
            {/* =============================================================== */}
            {!isRightPaneCollapsed && selectedPaper && (
              <aside className="w-full sm:w-80 md:w-96 lg:w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 h-full overflow-hidden">
                {/* 4 Tabs Navigation Bar */}
                <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 p-1.5 shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("details")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeRightTab === "details"
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightTab("chat")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeRightTab === "chat"
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightTab("insights")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeRightTab === "insights"
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Insights</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightTab("notes")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeRightTab === "notes"
                        ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200 dark:border-slate-700"
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

                      {/* Actions: Save to Library */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          variant={selectedPaper.is_imported ? "outline" : "primary"}
                          size="sm"
                          onClick={() => handleToggleSave(selectedPaper)}
                          className="flex-1 justify-center text-xs"
                        >
                          <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                          {selectedPaper.is_imported ? "Saved in Library" : "Save to Library"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const pid = selectedPaper.paper_id || selectedPaper.id;
                              await addPaperToMatrix("default_matrix", pid);
                              showToast("Added to Review Matrix & extracted dimensions!", "success");
                            } catch (err) {
                              showToast("Could not add to matrix: " + String(err), "error");
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

                      {/* AI Assistant Quick Launcher Card */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>AI Paper Assistant</span>
                          </div>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                            RAG Grounded
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                          Ask questions with page-level citations, or trigger 8 instant actionable insights.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveRightTab("chat")}
                            className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
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
                            setGlobalSelectedPaperId(selectedPaper.paper_id || selectedPaper.id);
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
                              {selectedPaper.is_open_access ? "Open Access" : "Access not verified"}
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
                      {selectedPaper.abstract_text && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
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
                        {selectedPaper.collection_ids && selectedPaper.collection_ids.length > 0 ? (
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
                          <p className="text-xs text-slate-400">Not assigned to any collections.</p>
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
                          getNotesForPaper(targetId).then(setNotes).catch(() => {});
                        }
                      }}
                      onPaperSaved={(newId) => {
                        setSelectedPaperId(newId);
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
                          Notes are saved to your local SQLite database and tied to this paper.
                        </p>
                      </div>

                      {/* New Note Input */}
                      <div className="space-y-1.5">
                        <textarea
                          rows={3}
                          placeholder="Add a private note or synthesis about this paper..."
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
            )}
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
              Under the strict No-API Website-Driven scraper specification, external provider APIs (such as Crossref, OpenAlex, Semantic Scholar, and arXiv APIs) are disabled.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please use the <strong>Website-Driven Discovery</strong> tab above to search public academic websites without API keys.
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
      {selectedDiagnosticsSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
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
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Operational Status</span>
                <span className="font-mono font-semibold uppercase">{selectedDiagnosticsSource.status}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Results Returned</span>
                <span className="font-mono font-semibold">{selectedDiagnosticsSource.results_count} paper(s)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Response Latency</span>
                <span className="font-mono">{selectedDiagnosticsSource.elapsed_ms} ms</span>
              </div>
              {selectedDiagnosticsSource.message && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
                  <span className="font-semibold text-amber-800 dark:text-amber-200 block">Diagnostic Note</span>
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
        </div>
      )}

      {/* Full Engine Diagnostics & Observability Modal (Phase L) */}
      {isDiagnosticsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
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
                    Real-time crawler telemetry, adapter health, and session lifecycle stats
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
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                <span className="text-xs">Fetching engine telemetry...</span>
              </div>
            ) : engineDiagnostics ? (
              <div className="space-y-4 text-xs">
                {/* Status overview cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Engine Version</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{engineDiagnostics.engine_version}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Searches</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{engineDiagnostics.total_searches}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Success / Failed</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {engineDiagnostics.successful_searches}
                    </span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="font-mono font-bold text-rose-500">
                      {engineDiagnostics.failed_searches}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Uptime</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{engineDiagnostics.uptime_seconds}s</span>
                  </div>
                </div>

                {/* Adapter Telemetry Table */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    Configured Source Adapters ({engineDiagnostics.sources.length})
                  </span>
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
                        {engineDiagnostics.sources.map((src) => (
                          <tr key={src.source_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                              {src.source_name}
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
                            <td className="py-2 px-3 text-[10px] text-slate-500 truncate max-w-[180px]">
                              {src.last_error || "Nominal"}
                            </td>
                          </tr>
                        ))}
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
                    navigator.clipboard.writeText(JSON.stringify(engineDiagnostics, null, 2));
                    showToast("Diagnostics report copied to clipboard (secrets redacted)", "success");
                  }
                }}
                disabled={!engineDiagnostics}
                className="gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Diagnostics</span>
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
        </div>
      )}
    </div>
  );
};
