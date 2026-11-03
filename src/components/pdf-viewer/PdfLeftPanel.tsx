import React, { useState } from "react";
import {
  ListTree,
  LayoutGrid,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import { PdfBookmark, PdfOutlineItem } from "./types";

export interface PdfLeftPanelProps {
  outline: PdfOutlineItem[];
  numPages: number;
  currentPage: number;
  goToPage: (page: number) => void;
  bookmarks: PdfBookmark[];
  onAddBookmark: (page: number, label?: string) => void;
  onRemoveBookmark: (id: string) => void;
  initialTab?: "outline" | "thumbnails" | "bookmarks";
}

export const PdfLeftPanel: React.FC<PdfLeftPanelProps> = ({
  outline,
  numPages,
  currentPage,
  goToPage,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  initialTab = "outline",
}) => {
  const [activeTab, setActiveTab] = useState<"outline" | "thumbnails" | "bookmarks">(initialTab);
  const [newBookmarkLabel, setNewBookmarkLabel] = useState("");
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBookmark(currentPage, newBookmarkLabel.trim() || `Page ${currentPage}`);
    setNewBookmarkLabel("");
    setIsAddingBookmark(false);
  };

  return (
    <div
      data-testid="pdf-left-panel"
      className="w-64 sm:w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 select-none overflow-hidden"
    >
      {/* Panel Tab Strip */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-1 text-xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("outline")}
          className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "outline"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Document Outline / Table of Contents"
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>Outline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("thumbnails")}
          className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "thumbnails"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Page Thumbnails"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Pages ({numPages})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bookmarks")}
          className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "bookmarks"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="Saved Page Bookmarks"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Bookmarks {bookmarks.length > 0 && `(${bookmarks.length})`}</span>
        </button>
      </div>

      {/* Tab 1: Document Outline */}
      {activeTab === "outline" && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 text-xs">
          {outline.length === 0 ? (
            <div className="p-4 text-center text-slate-400 space-y-2">
              <ListTree className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                No Document Outline Found
              </p>
              <p className="text-[11px] text-slate-400">
                This academic document does not contain an embedded structural table of contents.
              </p>
            </div>
          ) : (
            outline.map((item, index) => (
              <OutlineNode key={index} item={item} goToPage={goToPage} />
            ))
          )}
        </div>
      )}

      {/* Tab 2: Page Thumbnails */}
      {activeTab === "thumbnails" && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
            const isSelected = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all text-left cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 shadow-xs ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                }`}
              >
                <div className="w-10 h-13 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded flex flex-col items-center justify-center text-[10px] text-slate-500 shrink-0 font-mono shadow-2xs">
                  <FileText className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                  <span>p.{p}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs block font-medium truncate ${
                      isSelected
                        ? "text-indigo-700 dark:text-indigo-300 font-bold"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Page {p}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isSelected ? "Currently viewing" : "Click to view page"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab 3: Saved Page Bookmarks */}
      {activeTab === "bookmarks" && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 flex flex-col">
          {/* Add Bookmark Action */}
          {!isAddingBookmark ? (
            <button
              type="button"
              onClick={() => setIsAddingBookmark(true)}
              className="w-full py-1.5 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bookmark Page {currentPage}</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateBookmark}
              className="p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 space-y-2 text-xs"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-200 block text-[11px]">
                Bookmark Page {currentPage}
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Label (e.g. Methodology, Theorem 1)..."
                value={newBookmarkLabel}
                onChange={(e) => setNewBookmarkLabel(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingBookmark(false)}
                  className="px-2 py-1 text-[11px] rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Bookmarks List */}
          <div className="space-y-1.5 flex-1">
            {bookmarks.length === 0 ? (
              <div className="p-4 text-center text-slate-400 space-y-1.5">
                <Bookmark className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  No Bookmarks Saved
                </p>
                <p className="text-[11px] text-slate-400">
                  Bookmark key pages, theorems, or tables to quickly return to them.
                </p>
              </div>
            ) : (
              bookmarks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => goToPage(b.pageNumber)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        P. {b.pageNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {b.label}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(b.id)}
                    title="Delete bookmark"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface OutlineNodeProps {
  item: PdfOutlineItem;
  goToPage: (page: number) => void;
  level?: number;
}

const OutlineNode: React.FC<OutlineNodeProps> = ({ item, goToPage, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = item.items && item.items.length > 0;

  const handleClick = () => {
    if (item.pageNumber && item.pageNumber >= 1) {
      goToPage(item.pageNumber);
    }
  };

  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center gap-1 py-1 px-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors ${
          level > 0 ? "ml-3 border-l border-slate-200 dark:border-slate-800 pl-2" : ""
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        <button
          type="button"
          onClick={handleClick}
          className="flex-1 text-left text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 truncate cursor-pointer font-medium"
          title={item.title}
        >
          {item.title}
        </button>

        {item.pageNumber && (
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
            {item.pageNumber}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-0.5">
          {item.items!.map((child, idx) => (
            <OutlineNode key={idx} item={child} goToPage={goToPage} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

