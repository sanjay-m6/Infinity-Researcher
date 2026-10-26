import React, { useState, useEffect } from "react";
import { X, Search, Plus, BookOpen, Check, Loader2 } from "lucide-react";
import { DbPaper } from "../../lib/desktop-api/types";
import * as desktopApi from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";

interface AddPapersModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPaperIds: Set<string>;
  onAddPaper: (paperId: string) => Promise<void>;
}

export const AddPapersModal: React.FC<AddPapersModalProps> = ({
  isOpen,
  onClose,
  existingPaperIds,
  onAddPaper,
}) => {
  const [libraryPapers, setLibraryPapers] = useState<DbPaper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const page = await desktopApi.listPapers({ page: 1, page_size: 100 });
      setLibraryPapers(page.items);
    } catch (err) {
      console.warn("Could not load library papers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredPapers = libraryPapers.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.abstract_text && p.abstract_text.toLowerCase().includes(q)) ||
      (p.venue && p.venue.toLowerCase().includes(q))
    );
  });

  const handleAdd = async (paperId: string) => {
    setAddingId(paperId);
    try {
      await onAddPaper(paperId);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Add Papers to Literature Review Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick papers from your saved Research Library to extract and compare
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library by paper title, abstract, or venue..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Paper List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              <span>Loading research library...</span>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 space-y-1">
              <p className="font-medium text-slate-700 dark:text-slate-300">No matching papers found</p>
              <p className="text-xs text-slate-400">
                Discover and save papers from Search, IEEE Open Access, or import PDFs into your Library.
              </p>
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const isAlreadyAdded = existingPaperIds.has(paper.id);
              const isProcessing = addingId === paper.id;

              return (
                <div
                  key={paper.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {paper.title}
                      </h4>
                      {paper.publication_year && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                          {paper.publication_year}
                        </span>
                      )}
                    </div>
                    {paper.abstract_text && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {paper.abstract_text}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isAlreadyAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3.5 h-3.5" />
                        <span>In Matrix</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAdd(paper.id)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{isProcessing ? "Extracting..." : "Add & Extract"}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
