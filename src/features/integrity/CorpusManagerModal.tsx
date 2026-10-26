import React, { useState, useEffect } from "react";
import {
  X,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Shield,
  Search,
} from "lucide-react";
import {
  listCorpusSources,
  indexSavedLibraryPapers,
  deleteCorpusSource,
  indexCorpusSource,
  CorpusSource,
} from "../../lib/desktop-api";

interface CorpusManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIndexUpdated?: () => void;
}

export const CorpusManagerModal: React.FC<CorpusManagerModalProps> = ({
  isOpen,
  onClose,
  onIndexUpdated,
}) => {
  const [sources, setSources] = useState<CorpusSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexingLibrary, setIsIndexingLibrary] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Add source manual dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAuthors, setNewAuthors] = useState("");
  const [newDoi, setNewDoi] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadSources();
    }
  }, [isOpen]);

  const loadSources = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listCorpusSources();
      setSources(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load corpus sources");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndexLibrary = async () => {
    setIsIndexingLibrary(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const count = await indexSavedLibraryPapers();
      setStatusMessage(`Successfully indexed ${count} new research papers into the similarity corpus.`);
      await loadSources();
      if (onIndexUpdated) onIndexUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to index library papers");
    } finally {
      setIsIndexingLibrary(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from the similarity corpus? (The original paper remains untouched).`)) {
      return;
    }
    try {
      await deleteCorpusSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      if (onIndexUpdated) onIndexUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove corpus source");
    }
  };

  const handleAddManualSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert("Title and content are required.");
      return;
    }
    setIsLoading(true);
    try {
      await indexCorpusSource(
        "imported_file",
        newTitle.trim(),
        newContent.trim(),
        newAuthors.trim() || null,
        newDoi.trim() || null
      );
      setShowAddModal(false);
      setNewTitle("");
      setNewContent("");
      setNewAuthors("");
      setNewDoi("");
      setStatusMessage(`Added "${newTitle}" to the indexed corpus.`);
      await loadSources();
      if (onIndexUpdated) onIndexUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add reference source");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredSources = sources.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.authors && s.authors.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.doi && s.doi.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalFingerprints = sources.reduce((acc, s) => acc + s.fingerprint_count, 0);
  const totalWords = sources.reduce((acc, s) => acc + s.word_count, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Local Corpus Manager
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                User-controlled reference papers and sources used for similarity comparisons
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpus Coverage & Transparency Notice */}
        <div className="px-6 py-3 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200">
            <span className="font-semibold">Corpus Coverage Guarantee: </span>
            The similarity engine only matches text against documents you index locally. A 0% match indicates no matching passages were found within this specific indexed corpus, not that the text is universal internet-wide original.
          </div>
        </div>

        {/* Stats Row & Actions */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {sources.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Indexed Sources</div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalFingerprints.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Winnowing Fingerprints</div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalWords.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Indexed Words</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Reference Text
            </button>
            <button
              onClick={handleIndexLibrary}
              disabled={isIndexingLibrary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIndexingLibrary ? "animate-spin" : ""}`} />
              {isIndexingLibrary ? "Indexing Saved Papers..." : "Index Research Library"}
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {statusMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            {errorMessage}
          </div>
        )}

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search indexed sources by title, author, or DOI..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading corpus sources...</div>
          ) : filteredSources.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {sources.length === 0
                  ? "No sources currently indexed in your local corpus."
                  : "No matching sources found."}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Click "Index Research Library" above to immediately index all papers saved in your library, or add custom reference texts.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSources.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {s.source_type.replace("_", " ")}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {s.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {s.authors && <span>{s.authors}</span>}
                      {s.doi && <span className="font-mono text-[11px]">DOI: {s.doi}</span>}
                      <span>{s.word_count.toLocaleString()} words</span>
                      <span>{s.fingerprint_count.toLocaleString()} fingerprints</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(s.id, s.title)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                    title="Remove from similarity corpus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Corpus updates are saved locally in SQLite without cloud transmission.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Manual Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddManualSource}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add Reference Document to Corpus
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Document Title *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Fowler et al., Surface Codes for Quantum Computation"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Authors
                </label>
                <input
                  type="text"
                  value={newAuthors}
                  onChange={(e) => setNewAuthors(e.target.value)}
                  placeholder="Author names"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  DOI
                </label>
                <input
                  type="text"
                  value={newDoi}
                  onChange={(e) => setNewDoi(e.target.value)}
                  placeholder="10.xxxx/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Text Content *
              </label>
              <textarea
                required
                rows={8}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste the source reference text to index..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Index Source
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
