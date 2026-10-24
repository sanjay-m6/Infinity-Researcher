import React, { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchInput } from "../../components/ui/SearchInput";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  Filter,
  X,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

export const DiscoverView: React.FC = () => {
  const {
    papers,
    sources,
    setSelectedPaperId,
    toggleSavePaper,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useApp();

  // Local filter states
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [openAccessOnly, setOpenAccessOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    "relevance" | "year_desc" | "year_asc" | "citations"
  >("relevance");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  // Filter computation
  const filteredPapers = useMemo(() => {
    let result = [...papers];

    // Query filter (search in title, abstract, authors, venue, doi)
    const q = globalSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.venue.toLowerCase().includes(q) ||
          (p.doi && p.doi.toLowerCase().includes(q))
      );
    }

    // Source filter
    if (selectedSources.length > 0) {
      result = result.filter((p) => selectedSources.includes(p.sourceId));
    }

    // Year range
    if (yearStart) {
      const yStart = parseInt(yearStart, 10);
      if (!isNaN(yStart)) {
        result = result.filter((p) => p.year >= yStart);
      }
    }
    if (yearEnd) {
      const yEnd = parseInt(yearEnd, 10);
      if (!isNaN(yEnd)) {
        result = result.filter((p) => p.year <= yEnd);
      }
    }

    // Open access
    if (openAccessOnly) {
      result = result.filter((p) => p.accessStatus === "open_access");
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "year_desc") return b.year - a.year;
      if (sortBy === "year_asc") return a.year - b.year;
      if (sortBy === "citations") return b.citationCount - a.citationCount;
      return 0; // relevance preserves original rank
    });

    return result;
  }, [
    papers,
    globalSearchQuery,
    selectedSources,
    yearStart,
    yearEnd,
    openAccessOnly,
    sortBy,
  ]);

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  };

  const clearAllFilters = () => {
    setGlobalSearchQuery("");
    setSelectedSources([]);
    setYearStart("");
    setYearEnd("");
    setOpenAccessOnly(false);
    setSortBy("relevance");
  };

  const hasActiveFilters =
    Boolean(globalSearchQuery) ||
    selectedSources.length > 0 ||
    Boolean(yearStart) ||
    Boolean(yearEnd) ||
    openAccessOnly;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Discover Scholarly Literature"
        description="Search peer-reviewed articles, preprints, and conference proceedings across academic repositories."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={isFilterDrawerOpen ? "primary" : "outline"}
              size="sm"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
            >
              <Filter className="w-4 h-4" />
              <span>
                Filters {selectedSources.length > 0 && `(${selectedSources.length})`}
              </span>
            </Button>
          </div>
        }
      />

      {/* Demo Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Demo search mode:</span> You are searching a
          curated local fixture of groundbreaking academic papers (Transformers,
          AlphaFold, BERT, Graph Neural Networks, etc.). Live remote connectors to arXiv,
          OpenAlex, and Crossref will be wired in Phase 5.
        </div>
      </div>

      {/* Main Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            onClear={() => setGlobalSearchQuery("")}
            placeholder="Search by keywords, author name, title, or DOI (e.g. 'Vaswani', 'attention', 'folding')..."
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort-by" className="text-xs text-slate-500 font-medium">
            Sort:
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "relevance" | "year_desc" | "year_asc" | "citations"
              )
            }
            className="text-xs px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="relevance">Relevance</option>
            <option value="year_desc">Year: Newest first</option>
            <option value="year_asc">Year: Oldest first</option>
            <option value="citations">Most Cited</option>
          </select>
        </div>
      </div>

      {/* Filter Drawer / Expandable Panel */}
      {isFilterDrawerOpen && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Filter Options
            </h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sources Filter */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Academic Sources
              </span>
              <div className="flex flex-wrap gap-1.5">
                {sources.slice(0, 6).map((src) => {
                  const isChecked = selectedSources.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleSource(src.id)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300 font-semibold"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {src.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Year Range */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Publication Year
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="From (e.g. 2017)"
                  value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <span className="text-xs text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="To (e.g. 2024)"
                  value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Access & Characteristics */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Access Status
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={openAccessOnly}
                  onChange={(e) => setOpenAccessOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Open Access Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Applied Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400">Active filters:</span>
          {globalSearchQuery && (
            <Badge variant="primary" size="sm">
              Query: &quot;{globalSearchQuery}&quot;
              <button
                type="button"
                onClick={() => setGlobalSearchQuery("")}
                className="ml-1 hover:text-indigo-900"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedSources.map((sId) => {
            const sName = sources.find((s) => s.id === sId)?.name || sId;
            return (
              <Badge key={sId} variant="default" size="sm">
                Source: {sName}
                <button
                  type="button"
                  onClick={() => toggleSource(sId)}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
          {openAccessOnly && (
            <Badge variant="success" size="sm">
              Open Access
              <button
                type="button"
                onClick={() => setOpenAccessOnly(false)}
                className="ml-1 hover:text-emerald-900"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          Showing{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {filteredPapers.length}
          </span>{" "}
          scholarly records
        </span>
      </div>

      {/* Results List */}
      {filteredPapers.length > 0 ? (
        <div className="space-y-3">
          {filteredPapers.map((paper) => (
            <div
              key={paper.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs group"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPaperId(paper.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedPaperId(paper.id)}
                  className="space-y-2 cursor-pointer flex-1"
                >
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                    {paper.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                    {paper.authors.join(", ")}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {paper.abstract}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                    <Badge variant="primary" size="sm">
                      <Layers className="w-3 h-3" />
                      {paper.sourceName}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      <Calendar className="w-3 h-3" />
                      {paper.year}
                    </Badge>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {paper.venue}
                    </span>
                    {paper.accessStatus === "open_access" && (
                      <Badge variant="success" size="sm">
                        Open Access
                      </Badge>
                    )}
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {paper.citationCount.toLocaleString()} citations
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Button
                    variant={paper.isSaved ? "primary" : "outline"}
                    size="sm"
                    onClick={() => toggleSavePaper(paper.id)}
                    title={paper.isSaved ? "Saved to Library" : "Save to Library"}
                  >
                    {paper.isSaved ? (
                      <BookmarkCheck className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {paper.isSaved ? "Saved" : "Save"}
                    </span>
                  </Button>

                  <a
                    href={paper.landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open official article page"
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          title="No research papers matched your search"
          description="Try clearing your search query or loosening your filter criteria to inspect the demo papers."
          actionLabel="Clear all filters"
          onAction={clearAllFilters}
        />
      )}
    </div>
  );
};
