import React from "react";
import { Paper } from "../../../types/domain";
import { CheckSquare, Square, BookOpen, Edit2, Trash2, ExternalLink } from "lucide-react";
import { getSemanticTagColor, READING_STATUS_CONFIG, ReadingStatus } from "../types";

interface PaperCompactViewProps {
  papers: Paper[];
  selectedPaperIds: string[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onOpenPdf: (paper: Paper) => void;
  onEditPaper: (paper: Paper) => void;
  onDeletePaper: (id: string) => void;
  onUpdateReadingStatus: (id: string, status: ReadingStatus) => void;
}

export const PaperCompactView: React.FC<PaperCompactViewProps> = ({
  papers,
  selectedPaperIds,
  onToggleSelect,
  onOpenPdf,
  onEditPaper,
  onDeletePaper,
  onUpdateReadingStatus,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs overflow-hidden">
      {papers.map((paper) => {
        const isSelected = selectedPaperIds.includes(paper.id);
        const status = (paper.readingStatus || "unread") as ReadingStatus;
        const statusConfig =
          READING_STATUS_CONFIG[status] || READING_STATUS_CONFIG.unread;

        return (
          <div
            key={paper.id}
            className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
              isSelected
                ? "bg-indigo-50/40 dark:bg-indigo-950/30"
                : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
            }`}
          >
            {/* Left: Checkbox + Status dot + Title & Primary details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => onToggleSelect(paper.id, e)}
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-hidden shrink-0"
                aria-label={`Select ${paper.title}`}
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>

              <select
                value={status}
                onChange={(e) =>
                  onUpdateReadingStatus(paper.id, e.target.value as ReadingStatus)
                }
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer shrink-0 focus:outline-hidden ${statusConfig.badgeClass}`}
                title="Change status"
              >
                <option value="unread">Unread</option>
                <option value="in_progress">In Progress</option>
                <option value="read">Read</option>
                <option value="archived">Archived</option>
              </select>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4
                    onClick={() => onOpenPdf(paper)}
                    className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                    title={paper.title}
                  >
                    {paper.title}
                  </h4>
                  {paper.year && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                      ({paper.year})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown Author"}
                  {paper.venue ? ` • ${paper.venue}` : ""}
                </p>
              </div>
            </div>

            {/* Middle: Tags preview (compact) */}
            <div className="hidden lg:flex items-center gap-1 shrink-0 max-w-[200px] overflow-hidden">
              {paper.tags &&
                paper.tags.slice(0, 2).map((t) => {
                  const color = getSemanticTagColor(t);
                  return (
                    <span
                      key={t}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md border truncate ${color.badgeClass}`}
                    >
                      {t}
                    </span>
                  );
                })}
              {paper.tags && paper.tags.length > 2 && (
                <span className="text-[10px] text-slate-400">
                  +{paper.tags.length - 2}
                </span>
              )}
            </div>

            {/* Right: Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenPdf(paper)}
                className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="Read in PDF Reader"
              >
                <BookOpen className="w-3 h-3" />
                <span className="hidden sm:inline">Open</span>
              </button>

              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title={`Open DOI: ${paper.doi}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={() => onEditPaper(paper)}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Edit metadata"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDeletePaper(paper.id)}
                className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                title="Remove paper"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
