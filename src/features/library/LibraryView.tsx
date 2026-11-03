import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchInput } from "../../components/ui/SearchInput";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { SourceBadge } from "../../components/ui/SourceBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  BookOpen,
  Trash2,
  FolderPlus,
  Share2,
  CheckSquare,
  Square,
  Filter,
  GitMerge,
  ShieldCheck,
  FileText,
  CheckCircle2,
  RefreshCw,
  Bookmark,
  Tag as TagIcon,
  Edit2,
} from "lucide-react";
import {
  DuplicateComparisonView,
  PaperFile,
  ProcessingOverview,
  ProcessingJob,
  MergeRequest,
  getProcessingOverview,
  listDuplicateCandidates,
  resolveDuplicateCandidate,
  mergePapers,
  listPaperFiles,
  startMetadataNormalization,
  startDuplicateScan,
  startPdfVerification,
  getErrorMessage,
} from "../../lib/desktop-api";
import { Paper } from "../../types/domain";
import {
  LibraryViewMode,
  ReadingStatus,
  READING_STATUS_CONFIG,
  getSemanticTagColor,
} from "./types";
import { ViewModeSelector } from "./components/ViewModeSelector";
import { PaperGridView } from "./components/PaperGridView";
import { PaperCompactView } from "./components/PaperCompactView";
import { SavedSearchesDrawer } from "./components/SavedSearchesDrawer";
import { TagManagerModal } from "./components/TagManagerModal";
import { PaperEditModal } from "./components/PaperEditModal";
import { NotesSearchModal } from "./components/NotesSearchModal";
import { LibraryImportExportModal } from "./components/LibraryImportExportModal";

export const LibraryView: React.FC = () => {
  const {
    papers,
    collections,
    sources,
    setReadingPaper,
    removePaperFromLibrary,
    addPaperToCollection,
    setActiveSection,
    showToast,
    updatePaperReadingStatus,
    recordPaperOpened,
    assignTagToPaper,
    removeTagFromPaper,
    updatePaperMetadata,
    savedSearches,
    createSavedSearch,
    deleteSavedSearch,
    createCollection,
  } = useApp();

  // Active Tab: "papers" | "duplicates" | "integrity"
  const [activeTab, setActiveTab] = useState<"papers" | "duplicates" | "integrity">(
    "papers"
  );

  // Persistent Display Mode
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(
        "infinity_library_view_mode"
      ) as LibraryViewMode;
      if (stored === "table" || stored === "grid" || stored === "compact") {
        return stored;
      }
    }
    return "table";
  });

  const handleViewModeChange = (mode: LibraryViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("infinity_library_view_mode", mode);
    }
  };

  // Main Papers Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [selectedOaFilter, setSelectedOaFilter] = useState<
    "all" | "oa_only" | "ieee_only"
  >("all");
  const [selectedReadingStatusFilter, setSelectedReadingStatusFilter] =
    useState<string>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "added_desc" | "year_desc" | "citations_desc" | "title" | "recently_opened"
  >("added_desc");

  // Selection
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  // Dialog & Modal States
  const [paperToDeleteId, setPaperToDeleteId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkCollectionModalOpen, setIsBulkCollectionModalOpen] = useState(false);
  const [paperToEdit, setPaperToEdit] = useState<Paper | null>(null);
  const [isSavedSearchesOpen, setIsSavedSearchesOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isNotesSearchOpen, setIsNotesSearchOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Phase 7 States: Duplicates & Document Integrity
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateComparisonView[]
  >([]);
  const [paperFiles, setPaperFiles] = useState<PaperFile[]>([]);
  const [processingOverview, setProcessingOverview] = useState<ProcessingOverview | null>(
    null
  );
  const [isLoadingProcessing, setIsLoadingProcessing] = useState(false);
  const [isProcessingActionRunning, setIsProcessingActionRunning] = useState(false);

  // Merge Confirmation Modal State
  const [selectedCandidateForMerge, setSelectedCandidateForMerge] =
    useState<DuplicateComparisonView | null>(null);
  const [mergePreserveNotes, setMergePreserveNotes] = useState(true);
  const [mergePreserveTags, setMergePreserveTags] = useState(true);
  const [mergePreserveCollections, setMergePreserveCollections] = useState(true);
  const [mergeNotes, setMergeNotes] = useState("");

  // Load Processing Overview & Data
  const loadProcessingData = useCallback(async () => {
    setIsLoadingProcessing(true);
    try {
      const overview = await getProcessingOverview();
      setProcessingOverview(overview);

      const candidates = await listDuplicateCandidates("pending");
      setDuplicateCandidates(candidates);

      const files = await listPaperFiles();
      setPaperFiles(files);
    } catch {
      // In web preview fallback mode, handle gracefully
    } finally {
      setIsLoadingProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "duplicates" || activeTab === "integrity") {
      loadProcessingData();
    }
  }, [activeTab, loadProcessingData]);

  // Main Papers Filtered List
  const savedPapers = useMemo(() => papers.filter((p) => p.isSaved), [papers]);

  // Aggregate all unique tags for the filter dropdown
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    savedPapers.forEach((p) => {
      (p.tags || []).forEach((t) => {
        const clean = t.trim();
        if (clean) set.add(clean);
      });
    });
    return Array.from(set).sort();
  }, [savedPapers]);

  const filteredPapers = useMemo(() => {
    let result = [...savedPapers];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.venue.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (selectedCollectionFilter !== "all") {
      result = result.filter((p) => p.collectionIds.includes(selectedCollectionFilter));
    }

    if (selectedSourceFilter !== "all") {
      result = result.filter((p) => p.sourceId === selectedSourceFilter);
    }

    if (selectedReadingStatusFilter !== "all") {
      result = result.filter(
        (p) => (p.readingStatus || "unread") === selectedReadingStatusFilter
      );
    }

    if (selectedTagFilter !== "all") {
      result = result.filter((p) => (p.tags || []).includes(selectedTagFilter));
    }

    if (selectedOaFilter === "oa_only") {
      result = result.filter(
        (p) =>
          p.accessStatus === "open_access" ||
          p.openAccessStatus === "user_confirmed_open_access" ||
          p.openAccessStatus === "verified_open_access"
      );
    } else if (selectedOaFilter === "ieee_only") {
      result = result.filter(
        (p) =>
          p.retrievalMethod === "ieee_manual_download_import" ||
          p.sourceName?.toLowerCase().includes("ieee")
      );
    }

    result.sort((a, b) => {
      if (sortBy === "recently_opened") {
        const aOpen = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
        const bOpen = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
        if (bOpen !== aOpen) return bOpen - aOpen;
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      }
      if (sortBy === "year_desc") return b.year - a.year;
      if (sortBy === "citations_desc") return b.citationCount - a.citationCount;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return result;
  }, [
    savedPapers,
    searchQuery,
    selectedCollectionFilter,
    selectedSourceFilter,
    selectedReadingStatusFilter,
    selectedTagFilter,
    selectedOaFilter,
    sortBy,
  ]);

  const allVisibleSelected =
    filteredPapers.length > 0 &&
    filteredPapers.every((p) => selectedPaperIds.includes(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedPaperIds([]);
    } else {
      setSelectedPaperIds(filteredPapers.map((p) => p.id));
    }
  };

  const toggleSelectPaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPaperIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleBulkAddToCollection = (colId: string) => {
    selectedPaperIds.forEach((pId) => {
      addPaperToCollection(pId, colId);
    });
    setIsBulkCollectionModalOpen(false);
    setSelectedPaperIds([]);
    showToast(`Added ${selectedPaperIds.length} papers to collection.`, "success");
  };

  const handleBulkMarkStatus = async (status: ReadingStatus) => {
    for (const id of selectedPaperIds) {
      await updatePaperReadingStatus(id, status);
    }
    setSelectedPaperIds([]);
    showToast(`Updated reading status for ${selectedPaperIds.length} papers.`, "success");
  };

  const handleBulkDelete = () => {
    selectedPaperIds.forEach((id) => {
      removePaperFromLibrary(id);
    });
    setSelectedPaperIds([]);
    setIsBulkDeleteOpen(false);
    showToast(`Removed ${selectedPaperIds.length} papers from library.`, "info");
  };

  // Launch in PDF Reader
  const handleOpenPdfReader = async (paper: Paper) => {
    await recordPaperOpened(paper.id);
    setReadingPaper({
      id: paper.id,
      title: paper.title,
      sourceUrl: paper.pdfUrl || paper.landingUrl,
    });
    setActiveSection("literature_workspace");
  };

  // Tag Manager callbacks
  const handleRenameTag = async (oldName: string, newName: string) => {
    const affected = papers.filter((p) => (p.tags || []).includes(oldName));
    for (const p of affected) {
      await removeTagFromPaper(p.id, oldName);
      await assignTagToPaper(p.id, newName);
    }
    showToast(
      `Renamed tag "${oldName}" to "${newName}" across ${affected.length} papers.`,
      "success"
    );
  };

  const handleDeleteTag = async (tagName: string) => {
    const affected = papers.filter((p) => (p.tags || []).includes(tagName));
    for (const p of affected) {
      await removeTagFromPaper(p.id, tagName);
    }
    showToast(`Removed tag "${tagName}" from ${affected.length} papers.`, "info");
  };

  const handleCreateTag = async (tagName: string) => {
    showToast(`Tag "${tagName}" registered. Assign it to any paper via Edit.`, "success");
  };

  // Saved Search callbacks
  const handleApplySavedSearch = (search: any) => {
    if (search.query_text) {
      setSearchQuery(search.query_text);
    }
    if (search.sort_by) {
      setSortBy(search.sort_by as any);
    }
    showToast(`Loaded saved search configuration "${search.name}".`, "info");
  };

  const handleCreateSavedSearch = async (name: string, description: string) => {
    await createSavedSearch({
      name,
      description: description || undefined,
      query_text: searchQuery || undefined,
      sort_by: sortBy,
    });
  };

  // Import JSON backup callback
  const handleImportLibrary = async (importedData: {
    papers: Partial<Paper>[];
    collections?: any[];
  }) => {
    if (importedData.collections && Array.isArray(importedData.collections)) {
      for (const col of importedData.collections) {
        if (col.name) {
          createCollection(col.name, col.description || "", col.colorHex);
        }
      }
    }
    for (const p of importedData.papers) {
      if (p.id) {
        await updatePaperMetadata(p.id, p);
      }
    }
  };

  // Phase 7 Actions
  const handleNormalizeMetadata = async () => {
    setIsProcessingActionRunning(true);
    try {
      const job: ProcessingJob = await startMetadataNormalization();
      showToast(
        `Metadata normalization complete: ${job.completed_items} papers processed.`,
        "success"
      );
      loadProcessingData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to run metadata normalization");
      showToast(msg, "error");
    } finally {
      setIsProcessingActionRunning(false);
    }
  };

  const handleScanDuplicates = async () => {
    setIsProcessingActionRunning(true);
    try {
      const job: ProcessingJob = await startDuplicateScan();
      showToast(
        `Duplicate scan complete: found ${job.warnings_count} candidate pairs.`,
        "info"
      );
      loadProcessingData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to run duplicate scan");
      showToast(msg, "error");
    } finally {
      setIsProcessingActionRunning(false);
    }
  };

  const handleVerifyPdfFiles = async () => {
    setIsProcessingActionRunning(true);
    try {
      const job: ProcessingJob = await startPdfVerification();
      showToast(
        `PDF verification complete: ${job.completed_items} files verified.`,
        "success"
      );
      loadProcessingData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to run PDF verification");
      showToast(msg, "error");
    } finally {
      setIsProcessingActionRunning(false);
    }
  };

  const handleResolveCandidate = async (
    candidateId: string,
    decision: "kept_separate" | "deferred"
  ) => {
    try {
      await resolveDuplicateCandidate(candidateId, decision);
      setDuplicateCandidates((prev) =>
        prev.filter((c) => c.candidate_id !== candidateId)
      );
      showToast(
        decision === "kept_separate"
          ? "Papers marked as distinct records."
          : "Candidate deferred for later review.",
        "info"
      );
      loadProcessingData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to resolve duplicate candidate");
      showToast(msg, "error");
    }
  };

  const handleExecuteMerge = async () => {
    if (!selectedCandidateForMerge) return;

    try {
      const req: MergeRequest = {
        candidate_id: selectedCandidateForMerge.candidate_id,
        canonical_paper_id: selectedCandidateForMerge.paper_a.id,
        merged_paper_id: selectedCandidateForMerge.paper_b.id,
        preserve_notes: mergePreserveNotes,
        preserve_tags: mergePreserveTags,
        preserve_collections: mergePreserveCollections,
        merge_notes: mergeNotes.trim() ? mergeNotes.trim() : null,
      };

      const res = await mergePapers(req);
      showToast(res.message, "success");
      setSelectedCandidateForMerge(null);
      loadProcessingData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to execute paper merge");
      showToast(msg, "error");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Saved Paper Library"
        description="Your local scholarly repository and knowledge hub. Organize papers, collections, tags, reading workflows, and bibliographic notes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSavedSearchesOpen(true)}
              title="Manage saved queries"
            >
              <Bookmark className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              <span>Saved Searches ({savedSearches.length})</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTagModalOpen(true)}
              title="Manage and normalize tags"
            >
              <TagIcon className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              <span>Tags</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNotesSearchOpen(true)}
              title="Search across all paper notes"
            >
              <FileText className="w-3.5 h-3.5 mr-1 text-amber-500" />
              <span>Notes Search</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportExportOpen(true)}
              title="Import or export library data"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              <span>Backup & Export</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveSection("discover")}
            >
              <BookOpen className="w-4 h-4 mr-1" />
              <span>Discover Papers</span>
            </Button>
          </div>
        }
      />

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("papers")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "papers"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Library Papers ({savedPapers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("duplicates")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "duplicates"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <GitMerge className="w-4 h-4" />
          <span>Duplicate Review</span>
          {duplicateCandidates.length > 0 && (
            <Badge variant="warning" size="sm">
              {duplicateCandidates.length}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("integrity")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "integrity"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Document Integrity & Pipeline</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Library Papers View                                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "papers" && (
        <div className="space-y-4">
          {/* Search, Layout Switcher & Filters Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery("")}
                  placeholder="Search saved titles, authors, venues, tags..."
                />
              </div>

              {/* View Mode Selector */}
              <div className="flex items-center gap-3">
                <ViewModeSelector
                  currentMode={viewMode}
                  onChange={handleViewModeChange}
                />
              </div>
            </div>

            {/* Structured Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              {/* Collection Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <select
                  value={selectedCollectionFilter}
                  onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Collections ({collections.length})</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.paperIds.length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reading Status Filter */}
              <select
                value={selectedReadingStatusFilter}
                onChange={(e) => setSelectedReadingStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="unread">Unread</option>
                <option value="in_progress">In Progress</option>
                <option value="read">Read</option>
                <option value="archived">Archived</option>
              </select>

              {/* Tag Filter */}
              {allAvailableTags.length > 0 && (
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Tags ({allAvailableTags.length})</option>
                  {allAvailableTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              )}

              {/* Source Filter */}
              <select
                value={selectedSourceFilter}
                onChange={(e) => setSelectedSourceFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="all">All Sources</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Open Access Filter */}
              <select
                value={selectedOaFilter}
                onChange={(e) =>
                  setSelectedOaFilter(e.target.value as "all" | "oa_only" | "ieee_only")
                }
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="all">All Access</option>
                <option value="oa_only">Open Access Only</option>
                <option value="ieee_only">IEEE OA Imports</option>
              </select>

              {/* Sort Filter */}
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "added_desc"
                      | "year_desc"
                      | "citations_desc"
                      | "title"
                      | "recently_opened"
                  )
                }
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden ml-auto"
              >
                <option value="added_desc">Recently Added</option>
                <option value="recently_opened">Recently Opened</option>
                <option value="year_desc">Year: Newest</option>
                <option value="citations_desc">Most Cited</option>
                <option value="title">Title: A-Z</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {selectedPaperIds.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
                <span>{selectedPaperIds.length} papers selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkCollectionModalOpen(true)}
                  className="text-xs"
                >
                  <FolderPlus className="w-3.5 h-3.5 mr-1" />
                  Add to Collection
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkMarkStatus("read")}
                  className="text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Mark Read
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove Selected
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPaperIds([])}
                  className="text-xs"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Main Content Area based on ViewMode */}
          {filteredPapers.length > 0 ? (
            <div>
              {viewMode === "grid" && (
                <PaperGridView
                  papers={filteredPapers}
                  selectedPaperIds={selectedPaperIds}
                  onToggleSelect={toggleSelectPaper}
                  onOpenPdf={handleOpenPdfReader}
                  onEditPaper={(p) => setPaperToEdit(p)}
                  onDeletePaper={(id) => setPaperToDeleteId(id)}
                  onAddToCollection={(p) => {
                    setSelectedPaperIds([p.id]);
                    setIsBulkCollectionModalOpen(true);
                  }}
                  onUpdateReadingStatus={(id, status) =>
                    updatePaperReadingStatus(id, status)
                  }
                />
              )}

              {viewMode === "compact" && (
                <PaperCompactView
                  papers={filteredPapers}
                  selectedPaperIds={selectedPaperIds}
                  onToggleSelect={toggleSelectPaper}
                  onOpenPdf={handleOpenPdfReader}
                  onEditPaper={(p) => setPaperToEdit(p)}
                  onDeletePaper={(id) => setPaperToDeleteId(id)}
                  onUpdateReadingStatus={(id, status) =>
                    updatePaperReadingStatus(id, status)
                  }
                />
              )}

              {viewMode === "table" && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  <div className="flex items-center px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        aria-label={
                          allVisibleSelected
                            ? "Deselect all visible papers"
                            : "Select all visible papers"
                        }
                        className="text-slate-400 hover:text-indigo-600 focus:outline-hidden"
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 pr-4">Title & Authors</div>
                    <div className="w-28 text-center hidden md:block">Status</div>
                    <div className="w-20 text-center hidden md:block">Year</div>
                    <div className="w-36 text-center hidden sm:block">
                      Source & Access
                    </div>
                    <div className="w-24 text-right hidden lg:block">Citations</div>
                    <div className="w-24 text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredPapers.map((paper) => {
                      const isSelected = selectedPaperIds.includes(paper.id);
                      const status = (paper.readingStatus || "unread") as ReadingStatus;
                      const statusConfig =
                        READING_STATUS_CONFIG[status] || READING_STATUS_CONFIG.unread;

                      return (
                        <div
                          key={paper.id}
                          className={`flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-sm ${
                            isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
                          }`}
                        >
                          <div
                            className="w-8 shrink-0 flex items-center justify-center"
                            onClick={(e) => toggleSelectPaper(paper.id, e)}
                          >
                            <button
                              type="button"
                              aria-label={
                                isSelected
                                  ? `Deselect ${paper.title}`
                                  : `Select ${paper.title}`
                              }
                              className="text-slate-400 hover:text-indigo-600 focus:outline-hidden"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <div className="flex-1 min-w-0 pr-4">
                            <div
                              onClick={() => handleOpenPdfReader(paper)}
                              className="font-medium text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                              title={paper.title}
                            >
                              {paper.title}
                            </div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {paper.authors.length > 0
                                ? paper.authors.join(", ")
                                : "Unknown Author"}
                              {paper.venue ? ` • ${paper.venue}` : ""}
                            </div>
                            {/* Inline tags */}
                            {paper.tags && paper.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {paper.tags.slice(0, 3).map((tag) => {
                                  const color = getSemanticTagColor(tag);
                                  return (
                                    <span
                                      key={tag}
                                      className={`text-[10px] px-1.5 py-0.2 rounded border ${color.badgeClass}`}
                                    >
                                      {tag}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Reading status dropdown */}
                          <div className="w-28 text-center hidden md:block">
                            <select
                              value={status}
                              onChange={(e) =>
                                updatePaperReadingStatus(
                                  paper.id,
                                  e.target.value as ReadingStatus
                                )
                              }
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-hidden ${statusConfig.badgeClass}`}
                            >
                              <option value="unread">Unread</option>
                              <option value="in_progress">In Progress</option>
                              <option value="read">Read</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>

                          <div className="w-20 text-center hidden md:block text-xs font-mono text-slate-600 dark:text-slate-300">
                            {paper.year || "—"}
                          </div>

                          <div className="w-36 text-center hidden sm:flex items-center justify-center gap-1.5">
                            <SourceBadge sourceName={paper.sourceName} size="sm" />
                            {paper.retrievalMethod === "ieee_manual_download_import" ? (
                              <Badge variant="info" size="sm">
                                IEEE OA
                              </Badge>
                            ) : paper.accessStatus === "open_access" ? (
                              <Badge variant="success" size="sm">
                                OA
                              </Badge>
                            ) : null}
                          </div>

                          <div className="w-24 text-right hidden lg:block text-xs text-slate-500 tabular-nums">
                            {paper.citationCount.toLocaleString()}
                          </div>

                          <div className="w-24 text-right flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenPdfReader(paper)}
                              title="Read in PDF Reader"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setPaperToEdit(paper)}
                              title="Edit metadata"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setPaperToDeleteId(paper.id)}
                              title="Remove from Library"
                              aria-label="Remove from Library"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title={
                savedPapers.length === 0
                  ? "Your library is empty"
                  : "No matching papers found"
              }
              description={
                savedPapers.length === 0
                  ? "Discover papers across academic providers and save them to build your local research library."
                  : "Try adjusting your query, tag, or collection filters."
              }
              actionLabel={savedPapers.length === 0 ? "Discover Papers" : "Reset Filter"}
              onAction={() => {
                if (savedPapers.length === 0) {
                  setActiveSection("discover");
                } else {
                  setSearchQuery("");
                  setSelectedCollectionFilter("all");
                  setSelectedReadingStatusFilter("all");
                  setSelectedTagFilter("all");
                  setSelectedSourceFilter("all");
                  setSelectedOaFilter("all");
                }
              }}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: Duplicate Review View (Phase 7 preservation)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "duplicates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Explainable Duplicate Detection
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-stage candidate matching protects your library from premature or
                destructive merges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanDuplicates}
                disabled={isProcessingActionRunning}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1 ${
                    isProcessingActionRunning ? "animate-spin" : ""
                  }`}
                />
                <span>Scan for Duplicates</span>
              </Button>
            </div>
          </div>

          {isLoadingProcessing ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-lg" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : duplicateCandidates.length > 0 ? (
            <div className="space-y-4">
              {duplicateCandidates.map((candidate) => (
                <div
                  key={candidate.candidate_id}
                  className="p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          candidate.score >= 0.95
                            ? "success"
                            : candidate.score >= 0.8
                              ? "warning"
                              : "default"
                        }
                      >
                        {Math.round(candidate.score * 100)}% Match
                      </Badge>
                      <span className="text-xs font-mono text-slate-500">
                        Tier: {candidate.match_tier}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleResolveCandidate(candidate.candidate_id, "kept_separate")
                        }
                      >
                        Keep Separate
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedCandidateForMerge(candidate)}
                      >
                        <GitMerge className="w-3.5 h-3.5 mr-1" />
                        Merge Papers
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Record A (Canonical Candidate)
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {candidate.paper_a.title}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {candidate.paper_a.authors.join(", ")}
                      </p>
                      <div className="flex gap-2 text-[11px] font-mono text-slate-400 pt-1">
                        <span>{candidate.paper_a.publication_year || "Year N/A"}</span>
                        <span>•</span>
                        <span>{candidate.paper_a.source_name || "Unknown Source"}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Record B (Merged Candidate)
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {candidate.paper_b.title}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {candidate.paper_b.authors.join(", ")}
                      </p>
                      <div className="flex gap-2 text-[11px] font-mono text-slate-400 pt-1">
                        <span>{candidate.paper_b.publication_year || "Year N/A"}</span>
                        <span>•</span>
                        <span>{candidate.paper_b.source_name || "Unknown Source"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<GitMerge className="w-6 h-6" />}
              title="No duplicate candidates detected"
              description="Your scholarly library is clean. Run a duplicate scan whenever you import large batches of papers."
              actionLabel="Run Duplicate Scan"
              onAction={handleScanDuplicates}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Document Integrity View (Phase 7 preservation)         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "integrity" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Persistent Processing Pipeline
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify PDF integrity hashes and normalize academic metadata across
                repositories.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNormalizeMetadata}
                disabled={isProcessingActionRunning}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" />
                <span>Normalize All Metadata</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyPdfFiles}
                disabled={isProcessingActionRunning}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                <span>Verify PDFs</span>
              </Button>
            </div>
          </div>

          {processingOverview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400">Total Files</span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {processingOverview.total_files}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400">Verified Files</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {processingOverview.verified_files}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400">Normalized Papers</span>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {processingOverview.normalized_papers}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-[11px] text-slate-400">Pending Duplicates</span>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {processingOverview.pending_duplicates_count}
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Local Document Storage &amp; Verified Integrity Files
            </h3>
          </div>

          {paperFiles.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="flex items-center px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                <div className="flex-1 min-w-0 pr-4">Paper & File Path</div>
                <div className="w-24 text-center hidden sm:block">Pages</div>
                <div className="w-28 text-center hidden md:block">Integrity</div>
                <div className="w-28 text-right">Size</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paperFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {f.file_name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {f.file_path}
                      </p>
                    </div>

                    <div className="w-24 text-center hidden sm:block font-mono text-slate-600 dark:text-slate-400">
                      {f.page_count ?? "—"}
                    </div>

                    <div className="w-28 text-center hidden md:block">
                      <Badge
                        variant={
                          f.verification_status === "verified"
                            ? "success"
                            : f.verification_status === "corrupt"
                              ? "destructive"
                              : "default"
                        }
                        size="sm"
                      >
                        {f.verification_status}
                      </Badge>
                    </div>

                    <div className="w-28 text-right font-mono text-slate-500">
                      {f.byte_size
                        ? `${(f.byte_size / (1024 * 1024)).toFixed(1)} MB`
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="No indexed PDF files"
              description="Downloaded and attached PDF files will appear here with integrity verification hashes."
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS & DIALOGS                                              */}
      {/* ------------------------------------------------------------- */}

      {/* Remove Single Paper Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(paperToDeleteId)}
        title="Remove Paper from Library"
        message="This will remove the paper record from your active saved research library. Note: Downloaded PDFs are kept in your local repository."
        confirmLabel="Remove Paper"
        isDestructive={true}
        onConfirm={() => {
          if (paperToDeleteId) {
            removePaperFromLibrary(paperToDeleteId);
            setPaperToDeleteId(null);
          }
        }}
        onClose={() => setPaperToDeleteId(null)}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        title="Remove Selected Papers"
        message={`Are you sure you want to remove ${selectedPaperIds.length} papers from your library?`}
        confirmLabel="Remove All Selected"
        isDestructive={true}
        onConfirm={handleBulkDelete}
        onClose={() => setIsBulkDeleteOpen(false)}
      />

      {/* Bulk Add to Collection Modal */}
      <Modal
        isOpen={isBulkCollectionModalOpen}
        onClose={() => setIsBulkCollectionModalOpen(false)}
        title="Add to Collection"
        maxWidth="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Select target collection for {selectedPaperIds.length} papers:
          </p>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleBulkAddToCollection(c.id)}
                className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.colorHex || "#6366f1" }}
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {c.name}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {c.paperIds.length} papers
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsBulkCollectionModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Paper Metadata Modal */}
      <PaperEditModal
        paper={paperToEdit}
        isOpen={Boolean(paperToEdit)}
        onClose={() => setPaperToEdit(null)}
        onSave={async (id, fields) => {
          await updatePaperMetadata(id, fields);
        }}
      />

      {/* Saved Searches Drawer */}
      <SavedSearchesDrawer
        isOpen={isSavedSearchesOpen}
        onClose={() => setIsSavedSearchesOpen(false)}
        savedSearches={savedSearches}
        onApplySearch={handleApplySavedSearch}
        onDeleteSearch={deleteSavedSearch}
        onCreateSearch={handleCreateSavedSearch}
        currentSearchQuery={searchQuery}
      />

      {/* Tag Manager Modal */}
      <TagManagerModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        papers={papers}
        onFilterByTag={(tag) => setSelectedTagFilter(tag)}
        onRenameTag={handleRenameTag}
        onDeleteTag={handleDeleteTag}
        onCreateTag={handleCreateTag}
      />

      {/* Notes Global Search Modal */}
      <NotesSearchModal
        isOpen={isNotesSearchOpen}
        onClose={() => setIsNotesSearchOpen(false)}
        papers={papers}
        onOpenPaper={handleOpenPdfReader}
      />

      {/* Library Backup & Export Modal */}
      <LibraryImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        papers={papers}
        collections={collections}
        onImportLibrary={handleImportLibrary}
        showToast={showToast}
      />

      {/* Transactional Merge Confirmation Modal (Phase 7) */}
      <Modal
        isOpen={Boolean(selectedCandidateForMerge)}
        onClose={() => setSelectedCandidateForMerge(null)}
        title="Execute Transactional Paper Merge"
        maxWidth="md"
      >
        {selectedCandidateForMerge && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Merging consolidates citations, files, and provenance under the canonical
              record without data loss.
            </p>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Preservation Configuration:
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergePreserveNotes}
                  onChange={(e) => setMergePreserveNotes(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Preserve researcher notes & annotations
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergePreserveCollections}
                  onChange={(e) => setMergePreserveCollections(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Preserve collection memberships
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergePreserveTags}
                  onChange={(e) => setMergePreserveTags(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Preserve tags and subject labels
                </span>
              </label>
            </div>

            <div className="space-y-1 pt-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Audit Trail Notes (Optional):
              </label>
              <input
                type="text"
                value={mergeNotes}
                onChange={(e) => setMergeNotes(e.target.value)}
                placeholder="e.g. Merged preprint observation with published edition"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCandidateForMerge(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleExecuteMerge}>
                <GitMerge className="w-3.5 h-3.5 mr-1" />
                Confirm & Execute Merge
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
