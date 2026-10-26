import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchInput } from "../../components/ui/SearchInput";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import {
  BookOpen,
  Trash2,
  FolderPlus,
  Share2,
  CheckSquare,
  Square,
  Filter,
  Copy,
  GitMerge,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Sparkles,
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
} from "../../lib/desktop-api";

export const LibraryView: React.FC = () => {
  const {
    papers,
    collections,
    sources,
    setSelectedPaperId,
    removePaperFromLibrary,
    addPaperToCollection,
    setActiveSection,
    showToast,
  } = useApp();

  // Active Tab: "papers" | "duplicates" | "integrity"
  const [activeTab, setActiveTab] = useState<"papers" | "duplicates" | "integrity">("papers");

  // Main Papers Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [selectedOaFilter, setSelectedOaFilter] = useState<"all" | "oa_only" | "ieee_only">("all");
  const [sortBy, setSortBy] = useState<
    "added_desc" | "year_desc" | "citations_desc" | "title"
  >("added_desc");
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  // Dialog states for Papers
  const [paperToDeleteId, setPaperToDeleteId] = useState<string | null>(null);
  const [isBulkCollectionModalOpen, setIsBulkCollectionModalOpen] = useState(false);

  // Phase 7 States: Duplicates & Document Integrity
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateComparisonView[]>([]);
  const [paperFiles, setPaperFiles] = useState<PaperFile[]>([]);
  const [processingOverview, setProcessingOverview] = useState<ProcessingOverview | null>(null);
  const [isLoadingProcessing, setIsLoadingProcessing] = useState(false);
  const [isProcessingActionRunning, setIsProcessingActionRunning] = useState(false);

  // Merge Confirmation Modal State
  const [selectedCandidateForMerge, setSelectedCandidateForMerge] = useState<DuplicateComparisonView | null>(null);
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

  const filteredPapers = useMemo(() => {
    let result = [...savedPapers];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.venue.toLowerCase().includes(q)
      );
    }

    if (selectedCollectionFilter !== "all") {
      result = result.filter((p) => p.collectionIds.includes(selectedCollectionFilter));
    }

    if (selectedSourceFilter !== "all") {
      result = result.filter((p) => p.sourceId === selectedSourceFilter);
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
      if (sortBy === "year_desc") return b.year - a.year;
      if (sortBy === "citations_desc") return b.citationCount - a.citationCount;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return result;
  }, [savedPapers, searchQuery, selectedCollectionFilter, selectedSourceFilter, selectedOaFilter, sortBy]);

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
      const msg = err instanceof Error ? err.message : "Failed to run metadata normalization";
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
      const msg = err instanceof Error ? err.message : "Failed to run duplicate scan";
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
      const msg = err instanceof Error ? err.message : "Failed to run PDF verification";
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
      setDuplicateCandidates((prev) => prev.filter((c) => c.candidate_id !== candidateId));
      showToast(
        decision === "kept_separate"
          ? "Papers marked as distinct records."
          : "Candidate deferred for later review.",
        "info"
      );
      loadProcessingData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resolve duplicate candidate";
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
      const msg = err instanceof Error ? err.message : "Failed to execute paper merge";
      showToast(msg, "error");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Saved Paper Library"
        description="Your local scholarly repository. Search, organize into collections, and inspect saved metadata."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection("discover")}
            >
              <BookOpen className="w-4 h-4" />
              <span>Find More Papers</span>
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
          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                placeholder="Search saved titles, authors, venues..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Collection Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <select
                  value={selectedCollectionFilter}
                  onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Collections ({collections.length})</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <select
                value={selectedSourceFilter}
                onChange={(e) => setSelectedSourceFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
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
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
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
                    e.target.value as "added_desc" | "year_desc" | "citations_desc" | "title"
                  )
                }
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="added_desc">Recently Added</option>
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
                  <FolderPlus className="w-3.5 h-3.5" />
                  Add to Collection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Citation export in BibTeX/CSL is planned for Phase 9"
                  className="text-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Export (Phase 9)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPaperIds([])}
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Papers Table */}
          {filteredPapers.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="flex items-center px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                <div className="w-8 shrink-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={allVisibleSelected ? "Deselect all visible papers" : "Select all visible papers"}
                    className="text-slate-400 hover:text-indigo-600 focus:outline-none"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex-1 min-w-0 pr-4">Title & Authors</div>
                <div className="w-24 text-center hidden md:block">Year</div>
                <div className="w-36 text-center hidden sm:block">Source & Access</div>
                <div className="w-24 text-right hidden lg:block">Citations</div>
                <div className="w-16 text-right">Action</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredPapers.map((paper) => {
                  const isSelected = selectedPaperIds.includes(paper.id);

                  return (
                    <div
                      key={paper.id}
                      onClick={() => setSelectedPaperId(paper.id)}
                      className={`flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors text-sm ${
                        isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <div
                        className="w-8 shrink-0 flex items-center justify-center"
                        onClick={(e) => toggleSelectPaper(paper.id, e)}
                      >
                        <button
                          type="button"
                          aria-label={isSelected ? `Deselect ${paper.title}` : `Select ${paper.title}`}
                          className="text-slate-400 hover:text-indigo-600 focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {paper.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {paper.authors.join(", ")}
                        </div>
                        {paper.doi && (
                          <div className="text-[11px] font-mono text-indigo-500 dark:text-indigo-400 truncate mt-0.5">
                            doi:{paper.doi}
                          </div>
                        )}
                      </div>

                      <div className="w-24 text-center hidden md:block text-xs font-mono text-slate-600 dark:text-slate-300">
                        {paper.year}
                      </div>

                      <div className="w-36 text-center hidden sm:flex items-center justify-center gap-1.5">
                        <Badge variant="primary" size="sm">
                          {paper.sourceName}
                        </Badge>
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

                      <div className="w-16 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaperToDeleteId(paper.id);
                          }}
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
                  : "Try adjusting your query or collection filter."
              }
              actionLabel={savedPapers.length === 0 ? "Discover Papers" : "Reset Filter"}
              onAction={() => {
                if (savedPapers.length === 0) {
                  setActiveSection("discover");
                } else {
                  setSearchQuery("");
                  setSelectedCollectionFilter("all");
                }
              }}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: Duplicate Review View                                  */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "duplicates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Explainable Duplicate Detection
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-stage candidate matching protects your library from premature or destructive merges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanDuplicates}
                disabled={isProcessingActionRunning}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessingActionRunning ? "animate-spin" : ""}`} />
                <span>Scan for Duplicates</span>
              </Button>
            </div>
          </div>

          {isLoadingProcessing ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Loading duplicate candidates...
            </div>
          ) : duplicateCandidates.length > 0 ? (
            <div className="space-y-4">
              {duplicateCandidates.map((candidate) => (
                <div
                  key={candidate.candidate_id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                >
                  {/* Candidate Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          candidate.match_tier === "exact_match"
                            ? "success"
                            : candidate.match_tier === "high_confidence"
                            ? "primary"
                            : candidate.match_tier === "review_required"
                            ? "warning"
                            : "outline"
                        }
                        size="sm"
                      >
                        {candidate.match_tier.replace("_", " ").toUpperCase()} ({(candidate.score * 100).toFixed(0)}%)
                      </Badge>

                      {candidate.conflicting_fields.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-rose-500 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{candidate.conflicting_fields.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedCandidateForMerge(candidate)}
                        className="text-xs"
                      >
                        <GitMerge className="w-3.5 h-3.5 mr-1" />
                        Merge Records
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveCandidate(candidate.candidate_id, "kept_separate")}
                        className="text-xs"
                      >
                        Keep Separate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolveCandidate(candidate.candidate_id, "deferred")}
                        className="text-xs text-slate-400"
                      >
                        Defer
                      </Button>
                    </div>
                  </div>

                  {/* Evidence Signals */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Evidence:</span>
                    {candidate.evidence.map((ev, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Record A (Canonical) */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Target Record (A)</span>
                        <Badge variant="outline" size="sm">{candidate.paper_a.source_names[0] || "Library"}</Badge>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {candidate.paper_a.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {candidate.paper_a.authors.map((a: { full_name: string }) => a.full_name).join(", ")}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Year: {candidate.paper_a.publication_year || "Unknown"}</span>
                        {candidate.paper_a.canonical_doi && (
                          <span className="font-mono text-indigo-500">doi:{candidate.paper_a.canonical_doi}</span>
                        )}
                      </div>
                    </div>

                    {/* Record B (Incoming) */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Incoming Candidate (B)</span>
                        <Badge variant="outline" size="sm">{candidate.paper_b.source_names[0] || "Library"}</Badge>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {candidate.paper_b.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {candidate.paper_b.authors.map((a: { full_name: string }) => a.full_name).join(", ")}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Year: {candidate.paper_b.publication_year || "Unknown"}</span>
                        {candidate.paper_b.canonical_doi && (
                          <span className="font-mono text-indigo-500">doi:{candidate.paper_b.canonical_doi}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              title="No Pending Duplicate Candidates"
              description="Your scholarly library is clean. All active papers have distinct verified identifiers and normalized titles."
              actionLabel="Scan Again"
              onAction={handleScanDuplicates}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Document Integrity & Pipeline Overview                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "integrity" && (
        <div className="space-y-6">
          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 font-medium">Canonical Papers</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {processingOverview?.total_papers ?? savedPapers.length}
              </div>
              <span className="text-[11px] text-slate-400">In local SQLite library</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 font-medium">Normalized Identifiers</span>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {processingOverview?.normalized_papers ?? 0}
              </div>
              <span className="text-[11px] text-slate-400">DOIs, arXiv, PMIDs indexed</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 font-medium">Verified PDF Files</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {processingOverview?.verified_files ?? 0}
              </div>
              <span className="text-[11px] text-slate-400">Out of {processingOverview?.total_files ?? 0} total</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 font-medium">Pending Duplicates</span>
              <div className="text-2xl font-bold text-amber-500 mt-1">
                {processingOverview?.pending_duplicates_count ?? duplicateCandidates.length}
              </div>
              <span className="text-[11px] text-slate-400">Awaiting human review</span>
            </div>
          </div>

          {/* Pipeline Actions Controls */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Persistent Processing Pipeline
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trigger background normalization, multi-stage deduplication, and document integrity scans across your local library.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNormalizeMetadata}
                disabled={isProcessingActionRunning}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Normalize All Metadata
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleScanDuplicates}
                disabled={isProcessingActionRunning}
              >
                <GitMerge className="w-3.5 h-3.5 mr-1" />
                Scan Duplicates
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyPdfFiles}
                disabled={isProcessingActionRunning}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Verify Document Hashes & Text
              </Button>
            </div>
          </div>

          {/* Local Paper Files Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 space-y-0">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Local Document Storage & Verified Integrity Files
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {paperFiles.length} registered files
              </span>
            </div>

            {paperFiles.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paperFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {file.file_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {file.file_path}
                      </div>
                      {file.sha256_hash && (
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <span>SHA-256: {file.sha256_hash.slice(0, 16)}...</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(file.sha256_hash || "");
                              showToast("Full SHA-256 hash copied to clipboard.", "info");
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                            title="Copy full hash"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {file.page_count && (
                        <span className="text-slate-500 text-xs">
                          {file.page_count} {file.page_count === 1 ? "page" : "pages"}
                        </span>
                      )}

                      <span className="text-slate-400 text-xs font-mono">
                        {(file.byte_size / 1024 / 1024).toFixed(2)} MB
                      </span>

                      <Badge
                        variant={
                          file.verification_status === "verified"
                            ? "success"
                            : file.verification_status === "no_text"
                            ? "warning"
                            : file.verification_status === "corrupt" || file.verification_status === "encrypted"
                            ? "destructive"
                            : "outline"
                        }
                        size="sm"
                      >
                        {file.verification_status === "verified" && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                        {file.verification_status === "no_text" && <FileText className="w-3 h-3 mr-1 inline" />}
                        {file.verification_status === "encrypted" && <Lock className="w-3 h-3 mr-1 inline" />}
                        {file.verification_status === "corrupt" && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                        {file.verification_status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No local documents attached to library papers yet. When you download open-access PDFs, their integrity, cryptographic digests, and page text will be verified here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Confirmation Dialog for Paper Removal                          */}
      {/* ------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={Boolean(paperToDeleteId)}
        onClose={() => setPaperToDeleteId(null)}
        onConfirm={() => {
          if (paperToDeleteId) {
            removePaperFromLibrary(paperToDeleteId);
          }
        }}
        title="Remove Paper from Library"
        message="Are you sure you want to remove this paper from your saved library? It will remain available in the Discover index."
        confirmLabel="Remove"
        isDestructive={true}
      />

      {/* ------------------------------------------------------------- */}
      {/* Bulk Add to Collection Modal                                   */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isBulkCollectionModalOpen}
        onClose={() => setIsBulkCollectionModalOpen(false)}
        title="Add to Collection"
        description={`Assign ${selectedPaperIds.length} selected papers to a collection`}
      >
        <div className="space-y-2 py-2">
          {collections.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => handleBulkAddToCollection(col.id)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: col.colorHex }}
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {col.name}
                </span>
              </div>
              <span className="text-xs text-slate-400">{col.paperIds.length} papers</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Phase 7: Merge Confirmation Modal                             */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(selectedCandidateForMerge)}
        onClose={() => setSelectedCandidateForMerge(null)}
        title="Confirm Transactional Paper Merge"
        description="Safely merge the duplicate paper into the canonical record with atomic database guarantees."
      >
        {selectedCandidateForMerge && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200 block mb-1">
                Canonical Target Record:
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium block">
                {selectedCandidateForMerge.paper_a.title}
              </span>
              <span className="text-slate-500 text-[11px] block mt-0.5">
                ID: {selectedCandidateForMerge.paper_a.id}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Incoming Record to Merge & Soft-Delete:
              </span>
              <span className="text-slate-600 dark:text-slate-400 block">
                {selectedCandidateForMerge.paper_b.title}
              </span>
              <span className="text-slate-400 text-[11px] block mt-0.5">
                ID: {selectedCandidateForMerge.paper_b.id}
              </span>
            </div>

            {/* Merge options */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Preserve User Data:
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
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
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
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteMerge}
              >
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
