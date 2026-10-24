import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Copy,
  FolderPlus,
  BookOpen,
  Calendar,
  Layers,
  Check,
} from "lucide-react";

export const PaperDetailDrawer: React.FC = () => {
  const {
    selectedPaperId,
    setSelectedPaperId,
    papers,
    collections,
    toggleSavePaper,
    addPaperToCollection,
    removePaperFromCollection,
    showToast,
  } = useApp();

  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const paper = papers.find((p) => p.id === selectedPaperId);

  if (!paper) {
    return null;
  }

  const handleCopyDoi = () => {
    if (!paper.doi) return;
    navigator.clipboard.writeText(paper.doi);
    setCopiedFormat("doi");
    showToast("DOI copied to clipboard.", "info");
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleCopyBibtex = () => {
    const bibtex = `@article{${paper.authors[0]?.split(" ").pop()?.toLowerCase() || "paper"}${paper.year},
  title = {${paper.title}},
  author = {${paper.authors.join(" and ")}},
  year = {${paper.year}},
  journal = {${paper.venue}},
  doi = {${paper.doi || ""}}
}`;
    navigator.clipboard.writeText(bibtex);
    setCopiedFormat("bibtex");
    showToast("BibTeX citation copied.", "info");
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const isLongAbstract = paper.abstract.length > 280;

  return (
    <Drawer
      isOpen={Boolean(selectedPaperId)}
      onClose={() => setSelectedPaperId(null)}
      title="Research Paper Details"
      subtitle={`${paper.sourceName} • ${paper.year}`}
      width="lg"
    >
      <div className="space-y-6">
        {/* Title & Save Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {paper.title}
            </h1>
            <Button
              variant={paper.isSaved ? "primary" : "outline"}
              size="sm"
              onClick={() => toggleSavePaper(paper.id)}
              className="shrink-0"
              title={paper.isSaved ? "Saved to Library" : "Save to Library"}
            >
              {paper.isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-emerald-300" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </Button>
          </div>

          {/* Authors */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Authors:
            </span>
            <span>{paper.authors.join(", ")}</span>
          </div>

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="primary" size="sm">
              <Layers className="w-3 h-3" />
              {paper.sourceName}
            </Badge>

            <Badge
              variant={
                paper.accessStatus === "open_access"
                  ? "success"
                  : paper.accessStatus === "preprint"
                    ? "info"
                    : "warning"
              }
              size="sm"
            >
              {paper.accessStatus === "open_access"
                ? "Open Access"
                : paper.accessStatus === "preprint"
                  ? "Preprint"
                  : "Restricted Access"}
            </Badge>

            <Badge variant="outline" size="sm">
              <Calendar className="w-3 h-3" />
              {paper.year}
            </Badge>

            <Badge variant="default" size="sm">
              <BookOpen className="w-3 h-3" />
              {paper.citationCount.toLocaleString()} Citations
            </Badge>

            <Badge
              variant={paper.documentStatus === "available" ? "success" : "default"}
              size="sm"
            >
              Document: {paper.documentStatus === "available" ? "Demo PDF" : "Not Cached"}
            </Badge>
          </div>
        </div>

        {/* Abstract */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Abstract
          </h2>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {paper.abstract ? (
              <>
                <p>
                  {isLongAbstract && !isAbstractExpanded
                    ? `${paper.abstract.slice(0, 280)}...`
                    : paper.abstract}
                </p>
                {isLongAbstract && (
                  <button
                    type="button"
                    onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
                    className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isAbstractExpanded ? "Show less" : "Read full abstract"}
                  </button>
                )}
              </>
            ) : (
              <p className="italic text-slate-400">
                No abstract provided in source record.
              </p>
            )}
          </div>
        </div>

        {/* Publication & Identifiers */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Publication Metadata
          </h2>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Venue / Journal</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate max-w-xs">
                {paper.venue}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">DOI</span>
              {paper.doi ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {paper.doi}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDoi}
                    aria-label="Copy DOI"
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                  >
                    {copiedFormat === "doi" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-slate-400">N/A</span>
              )}
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Publication Date</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">
                {paper.publicationDate}
              </span>
            </div>
          </div>
        </div>

        {/* Collections Assignment */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5" />
              Collections Membership
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {collections.map((col) => {
              const inCollection = paper.collectionIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    if (inCollection) {
                      removePaperFromCollection(paper.id, col.id);
                    } else {
                      addPaperToCollection(paper.id, col.id);
                    }
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                    inCollection
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: col.colorHex }}
                  />
                  <span>{col.name}</span>
                  {inCollection && <Check className="w-3 h-3 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2.5">
          <a
            href={paper.landingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Source Page
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyBibtex}
            className="text-xs"
          >
            {copiedFormat === "bibtex" ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy BibTeX
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Full PDF text extraction engine is scheduled for Phase 8"
            className="text-xs"
          >
            Read Document (Phase 8)
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
