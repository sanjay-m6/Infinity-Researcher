import React, { useState, useMemo, useRef } from "react";
import {
  Compass,
  Library,
  Upload,
  Search,
  FileText,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { useProjectWorkspace } from "../ProjectWorkspaceContext";
import { LiteraturePaper, ExtractionStatus } from "../types";
import { Button } from "../../../components/ui/Button";

export const Panel1Collection: React.FC = () => {
  const {
    papers,
    selectedPaperId,
    selectPaper,
    searchFilter,
    setSearchFilter,
    selectedTag,
    setSelectedTag,
    addPaper,
    removePaper,
    updatePaperStatus,
    setPanel3Tab,
    surveyRows,
    reviewingPaperId,
    reviewPaperWithAi,
    importLibraryPapers,
    appPapersCount,
  } = useProjectWorkspace();

  const [activeMode, setActiveMode] = useState<"collection" | "discovery">("collection");
  const [onlineQuery, setOnlineQuery] = useState("");
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<LiteraturePaper[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [papers]);

  // Filtered papers
  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      const matchesSearch =
        !searchFilter.trim() ||
        p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.authors.some((a) => a.toLowerCase().includes(searchFilter.toLowerCase())) ||
        p.abstract.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesTag = !selectedTag || p.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [papers, searchFilter, selectedTag]);

  // Simulated online discovery search
  const handleRunOnlineDiscovery = () => {
    if (!onlineQuery.trim()) return;
    setIsSearchingOnline(true);
    setTimeout(() => {
      const mockDiscovered: LiteraturePaper[] = [
        {
          id: `disc_${Date.now()}_1`,
          title: `Adaptive eBPF Telemetry for Threat Hunting in Multi-Tenant Kubernetes: ${onlineQuery}`,
          authors: ["E. Larsson", "G. Kowalski", "Y. Zhao"],
          publicationYear: 2024,
          abstract:
            "Explores dynamic syscall probe throttling to eliminate line-rate performance overheads while retaining container isolation boundary signals.",
          venue: "ACM EuroSys 2024",
          doi: "10.1145/3627703.3629580",
          sourceUrl: "https://dl.acm.org/doi/10.1145/3627703.3629580",
          hasFullText: true,
          isOpenAccess: true,
          extractionStatus: "imported",
          tags: ["eBPF", "Kubernetes", "Telemetry"],
          documentHash: `hash_disc_${Date.now()}`,
        },
        {
          id: `disc_${Date.now()}_2`,
          title: `Robust Attention Probes for Adversarial Evasion Resistance in 100 Gbps Cloud Gateways`,
          authors: ["M. Al-Hassan", "K. Berg"],
          publicationYear: 2024,
          abstract:
            "Quantized sparse self-attention models tailored for line-rate enterprise packet inspection under projected gradient descent payload attacks.",
          venue: "IEEE S&P (Oakland)",
          doi: "10.1109/SP.2024.1019283",
          sourceUrl: "https://ieeexplore.ieee.org/document/1019283",
          hasFullText: false,
          isOpenAccess: false,
          extractionStatus: "imported",
          tags: ["Adversarial Robustness", "Hardware Acceleration"],
          documentHash: `hash_disc2_${Date.now()}`,
        },
      ];
      setOnlineResults(mockDiscovered);
      setIsSearchingOnline(false);
    }, 600);
  };

  // Upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const newPaper: LiteraturePaper = {
        id: `paper_upload_${Date.now()}_${idx}`,
        title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        authors: ["Uploaded Researcher Document"],
        publicationYear: new Date().getFullYear(),
        abstract:
          "Document uploaded to workspace. Text and structural metadata extracted.",
        hasFullText: true,
        isOpenAccess: true,
        extractionStatus: "extracting",
        tags: ["Uploaded"],
        documentHash: `hash_${file.name}_${file.size}_${Date.now()}`,
      };

      addPaper(newPaper);

      // Simulate extraction pipeline
      setTimeout(() => {
        updatePaperStatus(newPaper.id, "extracted");
      }, 900);
    });

    e.target.value = "";
  };

  const getStatusBadge = (status: ExtractionStatus, warning?: string | null) => {
    switch (status) {
      case "extracted":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Extracted
          </span>
        );
      case "extracting":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-500" />
            Extracting
          </span>
        );
      case "ocr_required":
        return (
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md"
            title="Scanned PDF requires OCR"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            OCR required
          </span>
        );
      case "partially_extracted":
        return (
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md"
            title={warning || "Metadata only"}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Metadata only
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-rose-700 dark:text-rose-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
            Queued
          </span>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Panel 1 Collection"
      className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none"
    >
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveMode("collection")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeMode === "collection"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>Project ({papers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("discovery")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeMode === "discovery"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Discover</span>
            </button>
          </div>

          {/* Import / Upload Controls */}
          <div className="flex items-center gap-1.5">
            {appPapersCount > papers.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={importLibraryPapers}
                title={`Import ${appPapersCount - papers.length} papers from your local library`}
                className="h-7 text-xs px-2 text-slate-700 dark:text-slate-300 font-medium"
              >
                + Library ({appPapersCount})
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.tex,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import PDF, DOCX, LaTeX, TXT"
              className="h-7 text-xs px-2"
            >
              <Upload className="w-3 h-3 mr-1 text-slate-500" />
              Import
            </Button>
          </div>
        </div>

        {/* Search Input */}
        {activeMode === "collection" ? (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search collected papers, authors, methods..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-400"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Compass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunOnlineDiscovery()}
                placeholder="Query arXiv, IEEE, PubMed, bioRxiv..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-400"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={isSearchingOnline || !onlineQuery.trim()}
              onClick={handleRunOnlineDiscovery}
              className="h-7 text-xs px-2.5"
            >
              {isSearchingOnline ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        )}

        {/* Tag Filters (Collection Mode) */}
        {activeMode === "collection" && allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                selectedTag === null
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              All ({papers.length})
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                  selectedTag === t
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Paper List View */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
        {activeMode === "collection" ? (
          filteredPapers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <FileText className="w-6 h-6 mx-auto opacity-30 text-slate-400" />
              <p>No papers match the current search or filters.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchFilter("");
                  setSelectedTag(null);
                }}
                className="text-xs text-slate-600 dark:text-slate-400"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const isSelected = paper.id === selectedPaperId;
              return (
                <div
                  key={paper.id}
                  onClick={() => selectPaper(paper.id)}
                  className={`p-3 rounded-lg transition-colors cursor-pointer space-y-1.5 border ${
                    isSelected
                      ? "bg-slate-100/90 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-xs"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-transparent text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                      {paper.title}
                    </h4>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                      {paper.publicationYear}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {paper.authors.join(", ")}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getStatusBadge(paper.extractionStatus, paper.extractionWarning)}
                      {surveyRows.some((r) => r.paperId === paper.id) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> In
                          matrix
                        </span>
                      )}
                      {paper.isOpenAccess && (
                        <span className="text-[10px] font-mono text-slate-500 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded">
                          OA
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          reviewPaperWithAi(paper.id);
                        }}
                        disabled={reviewingPaperId === paper.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                          reviewingPaperId === paper.id
                            ? "bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed"
                            : surveyRows.some((r) => r.paperId === paper.id)
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 shadow-2xs"
                        }`}
                        title={
                          surveyRows.some((r) => r.paperId === paper.id)
                            ? "Re-run AI literature review for this paper"
                            : "AI review: extract objective, methodology, results & evidence"
                        }
                      >
                        {reviewingPaperId === paper.id ? (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <FileText className="w-2.5 h-2.5" />
                        )}
                        {reviewingPaperId === paper.id
                          ? "Reviewing..."
                          : surveyRows.some((r) => r.paperId === paper.id)
                            ? "Re-Review"
                            : "AI Review"}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPaper(paper.id);
                          setPanel3Tab("details");
                        }}
                        title="View Paper Details & Metadata"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePaper(paper.id);
                        }}
                        title="Remove paper from project"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Online Discovery Mode Results */
          <div className="space-y-2 p-1">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Discovered papers ({onlineResults.length})</span>
              <span>Open access</span>
            </div>
            {onlineResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <Compass className="w-6 h-6 mx-auto opacity-30 text-slate-400" />
                <p>Enter research keywords to discover relevant literature online.</p>
              </div>
            ) : (
              onlineResults.map((result) => {
                const alreadyCollected = papers.some(
                  (p) => p.doi && p.doi === result.doi
                );
                return (
                  <div
                    key={result.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {result.title}
                      </h4>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                        {result.publicationYear}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {result.abstract}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        {result.venue || "Academic source"}
                      </span>
                      <Button
                        variant={alreadyCollected ? "secondary" : "primary"}
                        size="sm"
                        disabled={alreadyCollected}
                        onClick={() => addPaper(result)}
                        className="h-6 text-[10px] px-2"
                      >
                        {alreadyCollected ? "In project" : "+ Add to project"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 3. Footer Summary */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
        <span className="tabular-nums font-mono">{papers.length} papers in project</span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          Local storage
        </span>
      </div>
    </div>
  );
};
