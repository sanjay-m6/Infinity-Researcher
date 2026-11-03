import React, { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { SavedSearch } from "../../../types/domain";
import { Search, Clock, Trash2, ArrowRight, Bookmark, Plus } from "lucide-react";

interface SavedSearchesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedSearches: SavedSearch[];
  onApplySearch: (search: SavedSearch) => void;
  onDeleteSearch: (id: string) => void;
  onCreateSearch?: (name: string, description: string) => Promise<void>;
  currentSearchQuery?: string;
}

export const SavedSearchesDrawer: React.FC<SavedSearchesDrawerProps> = ({
  isOpen,
  onClose,
  savedSearches,
  onApplySearch,
  onDeleteSearch,
  onCreateSearch,
  currentSearchQuery,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !onCreateSearch) return;
    setIsSubmitting(true);
    try {
      await onCreateSearch(newName.trim(), newDescription.trim());
      setNewName("");
      setNewDescription("");
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Search Configurations"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Saved searches preserve query terms, source filters, and sorting criteria for
          repeatable academic research.
        </p>

        {/* Create new search bar */}
        {onCreateSearch && !isCreating && (
          <div className="flex justify-between items-center p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {currentSearchQuery
                  ? `Save current query: "${currentSearchQuery}"`
                  : "Save a new search configuration"}
              </p>
              <p className="text-[11px] text-slate-400">
                Quickly re-execute this search whenever new papers are indexed.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewName(currentSearchQuery ? `Search: ${currentSearchQuery}` : "");
                setIsCreating(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Save Query
            </Button>
          </div>
        )}

        {/* Inline Create Form */}
        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Search Configuration Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Graph Neural Networks 2024"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Tracks latest preprints on GNN architectures"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !newName.trim()}>
                {isSubmitting ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </form>
        )}

        {/* Saved Searches List */}
        {savedSearches.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No saved searches yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Save reusable query configurations to quickly monitor topics over time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {search.name}
                    </h4>
                  </div>
                  {search.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {search.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                    {search.query_text && (
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        q: {search.query_text}
                      </span>
                    )}
                    {search.last_executed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Ran {new Date(search.last_executed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onApplySearch(search);
                      onClose();
                    }}
                  >
                    <span>Apply</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => onDeleteSearch(search.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="Delete saved search"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
