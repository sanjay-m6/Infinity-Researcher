import React from "react";
import { Paper } from "../../../types/domain";
import { SourceBadge } from "../../../components/ui/SourceBadge";
import {
  BookOpen,
  CheckSquare,
  Square,
  ExternalLink,
  Edit2,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { getSemanticTagColor, READING_STATUS_CONFIG, ReadingStatus } from "../types";

interface PaperGridViewProps {
  papers: Paper[];
  selectedPaperIds: string[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onOpenPdf: (paper: Paper) => void;
  onEditPaper: (paper: Paper) => void;
  onDeletePaper: (id: string) => void;
  onAddToCollection: (paper: Paper) => void;
  onUpdateReadingStatus: (id: string, status: ReadingStatus) => void;
}

export const PaperGridView: React.FC<PaperGridViewProps> = ({
  papers,
  selectedPaperIds,
  onToggleSelect,
  onOpenPdf,
  onEditPaper,
  onDeletePaper,
  onAddToCollection,
  onUpdateReadingStatus,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {papers.map((paper) => {
        const isSelected = selectedPaperIds.includes(paper.id);
        const status = (paper.readingStatus || "unread") as ReadingStatus;
        const statusConfig = READING_STATUS_CONFIG[status] || READING_STATUS_CONFIG.unread;
        const readingProgress = paper.readingProgress ?? 0;

        return (
          <div
            key={paper.id}
            className={`group relative flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-200 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md ${
              isSelected
                ? "border-indigo-500/70 ring-1 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20"
                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {/* Header: Select Checkbox, Status & Source */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => onToggleSelect(paper.id, e)}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-hidden"
                    aria-label={`Select paper ${paper.title}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>

                  <select
                    value={status}
                    onChange={(e) =>
                      onUpdateReadingStatus(paper.id, e.target.value as ReadingStatus)
                    }
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 ${statusConfig.badgeClass}`}
                    title="Change reading status"
                  >
                    <option value="unread">Unread</option>
                    <option value="in_progress">In Progress</option>
                    <option value="read">Read</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <SourceBadge sourceName={paper.sourceName || "Library"} size="sm" />
                </div>
              </div>

              {/* Title */}
              <h3
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug cursor-pointer group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1.5"
                onClick={() => onOpenPdf(paper)}
                title={paper.title}
              >
                {paper.title}
              </h3>

              {/* Authors & Metadata */}
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-normal">
                {paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown Author"}
              </p>

              <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {paper.year || "Year unknown"}
                </span>
                {paper.venue && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[160px]" title={paper.venue}>
                      {paper.venue}
                    </span>
                  </>
                )}
                {paper.citationCount > 0 && (
                  <>
                    <span>•</span>
                    <span>{paper.citationCount} cit.</span>
                  </>
                )}
              </div>

              {/* Abstract snippet */}
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-3 leading-relaxed">
                {paper.abstract}
              </p>

              {/* Tags */}
              {paper.tags && paper.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {paper.tags.slice(0, 4).map((tag) => {
                    const color = getSemanticTagColor(tag);
                    return (
                      <span
                        key={tag}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 ${color.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${color.dotClass}`} />
                        {tag}
                      </span>
                    );
                  })}
                  {paper.tags.length > 4 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center">
                      +{paper.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Reading progress & Footer Actions */}
            <div>
              {readingProgress > 0 && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, readingProgress)}%` }}
                  />
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenPdf(paper)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-medium transition-colors text-xs"
                    title="Open in PDF Reader"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read</span>
                  </button>

                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title={`Open DOI: ${paper.doi}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onAddToCollection(paper)}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Add to collection"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditPaper(paper)}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit metadata"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeletePaper(paper.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Remove from library"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
