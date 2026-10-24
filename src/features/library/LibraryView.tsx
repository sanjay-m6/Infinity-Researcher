import React, { useState, useMemo } from "react";
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
} from "lucide-react";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "added_desc" | "year_desc" | "citations_desc" | "title"
  >("added_desc");
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  // Dialog states
  const [paperToDeleteId, setPaperToDeleteId] = useState<string | null>(null);
  const [isBulkCollectionModalOpen, setIsBulkCollectionModalOpen] = useState(false);

  // Filter only saved papers in Library
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

    result.sort((a, b) => {
      if (sortBy === "year_desc") return b.year - a.year;
      if (sortBy === "citations_desc") return b.citationCount - a.citationCount;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return result;
  }, [savedPapers, searchQuery, selectedCollectionFilter, selectedSourceFilter, sortBy]);

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

      {/* Table / List View */}
      {filteredPapers.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          {/* Table Header */}
          <div className="flex items-center px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <button
              type="button"
              onClick={toggleSelectAll}
              aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
              className="p-1 mr-3 text-slate-400 hover:text-slate-600 rounded"
            >
              {allVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span className="flex-1">Paper Details</span>
            <span className="w-24 text-center hidden md:block">Year</span>
            <span className="w-32 text-center hidden sm:block">Source</span>
            <span className="w-24 text-right hidden lg:block">Citations</span>
            <span className="w-16 text-right">Actions</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPapers.map((paper) => {
              const isSelected = selectedPaperIds.includes(paper.id);
              return (
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaperId(paper.id)}
                  className={`flex items-center px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                    isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleSelectPaper(paper.id, e)}
                    aria-label={`Select ${paper.title}`}
                    className="p-1 mr-3 text-slate-400 hover:text-indigo-600 rounded"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {paper.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {paper.authors.join(", ")} • {paper.venue}
                    </p>
                    {paper.collectionIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {paper.collectionIds.map((cid) => {
                          const col = collections.find((c) => c.id === cid);
                          if (!col) return null;
                          return (
                            <span
                              key={cid}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: col.colorHex }}
                              />
                              {col.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="w-24 text-center hidden md:block text-xs font-mono text-slate-600 dark:text-slate-300">
                    {paper.year}
                  </div>

                  <div className="w-32 text-center hidden sm:block">
                    <Badge variant="primary" size="sm">
                      {paper.sourceName}
                    </Badge>
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

      {/* Confirmation Dialog for Removal */}
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

      {/* Bulk Add to Collection Modal */}
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
    </div>
  );
};
