import React, { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Search, FileText, BookOpen, Clock } from "lucide-react";
import { DbNote, searchNotes } from "../../../lib/desktop-api";
import { Paper } from "../../../types/domain";

interface NotesSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: Paper[];
  onOpenPaper: (paper: Paper) => void;
}

export const NotesSearchModal: React.FC<NotesSearchModalProps> = ({
  isOpen,
  onClose,
  papers,
  onOpenPaper,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DbNote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const paperMap = new Map<string, Paper>(papers.map((p) => [p.id, p]));

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await searchNotes(query.trim());
      setResults(res);
    } catch {
      // In web preview fallback, handle gracefully
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Global Research Notes Search"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Query across all annotations, thoughts, and extracted quotes anchored to your research papers.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search note contents, keywords, quotes..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              autoFocus
            />
          </div>
          <Button size="sm" type="submit" disabled={isSearching || !query.trim()}>
            {isSearching ? "Searching..." : "Search Notes"}
          </Button>
        </form>

        {/* Results */}
        {hasSearched && results.length === 0 && (
          <div className="py-8 text-center text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No research notes matched &quot;{query}&quot;.</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
            {results.map((note) => {
              const matchedPaper = paperMap.get(note.paper_id);

              return (
                <div
                  key={note.id}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {note.title || "Untitled Research Note"}
                    </h4>
                    {note.page_number && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        Page {note.page_number}
                      </span>
                    )}
                  </div>

                  {matchedPaper && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                      Paper: <span className="font-medium text-slate-700 dark:text-slate-300">{matchedPaper.title}</span>
                    </p>
                  )}

                  {note.highlighted_text && (
                    <blockquote className="text-[11px] text-slate-600 dark:text-slate-400 italic pl-2.5 border-l-2 border-indigo-400 my-2 line-clamp-2">
                      &ldquo;{note.highlighted_text}&rdquo;
                    </blockquote>
                  )}

                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-4 leading-relaxed mb-2.5">
                    {note.content_markdown}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {new Date(note.updated_at).toLocaleDateString()}
                    </span>

                    {matchedPaper && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPaper(matchedPaper);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Open Paper</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
