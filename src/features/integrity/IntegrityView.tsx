import React, { useState, useEffect } from "react";
import {
  FileCheck,
  Shield,
  Sparkles,
  Wand2,
  UploadCloud,
  FileText,
  Database,
  ArrowRight,
  Clock,
  Library,
} from "lucide-react";

import {
  IntegrityDocument,
  IntegrityDashboardSummary,
  SimilarityReport,
  AiSignalRun,
  DocumentSegment,
  ingestIntegrityDocument,
  listIntegrityDocuments,
  getIntegrityDashboardSummary,
  runSimilarityCheck,
} from "../../lib/desktop-api";
import { SimilarityWorkspace } from "./SimilarityWorkspace";
import { AiSignalWorkspace } from "./AiSignalWorkspace";
import { WritingAssistantWorkspace } from "./WritingAssistantWorkspace";
import { CorpusManagerModal } from "./CorpusManagerModal";
import { useApp } from "../../context/AppContext";

export const IntegrityView: React.FC = () => {
  const { papers } = useApp();

  const [summary, setSummary] = useState<IntegrityDashboardSummary | null>(null);
  const [documents, setDocuments] = useState<IntegrityDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCorpusModalOpen, setIsCorpusModalOpen] = useState(false);

  // Active Workspace Mode: "dashboard" | "similarity" | "ai_signal" | "writing"
  const [activeWorkspace, setActiveWorkspace] = useState<
    "dashboard" | "similarity" | "ai_signal" | "writing"
  >("dashboard");

  // Selected document and active report states
  const [selectedDoc, setSelectedDoc] = useState<IntegrityDocument | null>(null);
  const [activeSimilarityReport, setActiveSimilarityReport] = useState<SimilarityReport | null>(null);
  const [activeAiRun, setActiveAiRun] = useState<AiSignalRun | null>(null);
  const [activeSegments, setActiveSegments] = useState<DocumentSegment[]>([]);

  // Ingestion form state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  // Library paper picker state
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sum, docs] = await Promise.all([
        getIntegrityDashboardSummary(),
        listIntegrityDocuments(),
      ]);
      setSummary(sum);
      setDocuments(docs);
    } catch (err: any) {
      console.error("Failed to load integrity dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) {
      alert("Please provide draft text content.");
      return;
    }
    setIsIngesting(true);
    setIngestionError(null);
    try {
      const fileName = (pasteTitle.trim() || "draft_text") + ".txt";
      const doc = await ingestIntegrityDocument(
        "pasted_text",
        fileName,
        "txt",
        pasteContent.trim()
      );
      setIsPasteModalOpen(false);
      setPasteTitle("");
      setPasteContent("");
      await loadDashboardData();
      // Directly run similarity check and open similarity workspace
      handleOpenSimilarity(doc);
    } catch (err: any) {
      setIngestionError(err.message || "Failed to ingest text");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleLibraryPaperPick = async (paperId: string) => {
    const paper = papers.find((p) => p.id === paperId);
    if (!paper) return;

    setIsIngesting(true);
    try {
      let content = `${paper.title}\n\n`;
      if (paper.abstract) {
        content += `Abstract\n\n${paper.abstract}\n\n`;
      }
      const doc = await ingestIntegrityDocument(
        "library_paper",
        `${paper.title.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "_")}.txt`,
        "txt",
        content
      );
      setIsLibraryPickerOpen(false);
      await loadDashboardData();
      handleOpenSimilarity(doc);
    } catch (err: any) {
      alert("Failed to ingest library paper: " + err.message);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleOpenSimilarity = async (doc: IntegrityDocument) => {
    setSelectedDoc(doc);
    setIsLoading(true);
    try {
      const report = await runSimilarityCheck(doc.id);
      setActiveSimilarityReport(report);
      setActiveWorkspace("similarity");
    } catch (err: any) {
      alert("Failed to run similarity check: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAiSignals = async (doc: IntegrityDocument) => {
    setSelectedDoc(doc);
    // Prepare segments (from latest similarity report or empty)
    setActiveSegments([]);
    setActiveAiRun(null);
    setActiveWorkspace("ai_signal");
  };

  const handleOpenWritingAssistant = (doc: IntegrityDocument) => {
    setSelectedDoc(doc);
    setActiveWorkspace("writing");
  };

  // Render Sub-Workspaces
  if (activeWorkspace === "similarity" && activeSimilarityReport) {
    return (
      <SimilarityWorkspace
        report={activeSimilarityReport}
        onBack={() => {
          setActiveWorkspace("dashboard");
          loadDashboardData();
        }}
        onRefreshReport={() => {
          if (selectedDoc) handleOpenSimilarity(selectedDoc);
        }}
      />
    );
  }

  if (activeWorkspace === "ai_signal" && selectedDoc) {
    return (
      <AiSignalWorkspace
        document={selectedDoc}
        segments={activeSegments}
        existingRun={activeAiRun}
        onBack={() => {
          setActiveWorkspace("dashboard");
          loadDashboardData();
        }}
        onRunCompleted={(run) => setActiveAiRun(run)}
      />
    );
  }

  if (activeWorkspace === "writing" && selectedDoc) {
    return (
      <WritingAssistantWorkspace
        document={selectedDoc}
        onBack={() => {
          setActiveWorkspace("dashboard");
          loadDashboardData();
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Top Header & Local Privacy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Research Integrity & Writing Suite
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditable text similarity, experimental AI signals, and meaning-preserving writing assistance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Local Only &bull; Documents Never Uploaded</span>
          </div>

          <button
            onClick={() => setIsCorpusModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors shadow-sm"
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Corpus Manager</span>
            {summary && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
                {summary.total_corpus_sources} sources
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pillar 1: Similarity Checker */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Check Similarity
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Find exact and near-exact matching passages against your indexed reference corpus using Winnowing fingerprints and seed-and-extend character alignment.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>De-duplicated overlap scoring</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">First-Party</span>
          </div>
        </div>

        {/* Pillar 2: AI-Writing Signals */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              AI-Writing Signals
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Evaluate stylometric variance and burstiness across paragraphs with transparent uncertainty reporting. Never treats model predictions as proof of misconduct.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Minimum 80 words threshold</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Experimental</span>
          </div>
        </div>

        {/* Pillar 3: Academic Writing Assistant */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <Wand2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Improve Writing
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Enhance clarity, academic tone, and transitions while preserving numbers, units, equations, and citations. Detects meaning risks and epistemic drift.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Immutable original draft</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Side-by-Side</span>
          </div>
        </div>
      </div>

      {/* Document Ingestion Banner & Drop Zone */}
      <div className="p-8 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto shadow-sm">
          <UploadCloud className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="max-w-md mx-auto">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Submit Document for Integrity Analysis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paste research text, choose a saved paper from your library, or inspect supported drafts.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Paste Draft Text</span>
          </button>

          <button
            onClick={() => setIsLibraryPickerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors shadow-sm"
          >
            <Library className="w-4 h-4 text-indigo-500" />
            <span>Choose from Research Library</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400">
          Supported: PDF, DOCX, LaTeX (.tex), TXT, Markdown &bull; Max size: 20 MB &bull; Fully Local Processing
        </div>
      </div>

      {/* Analyzed Documents List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recently Ingested Documents
            </h3>
          </div>
          <span className="text-xs text-slate-400">{documents.length} documents</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No documents submitted yet. Use the buttons above to paste draft text or pick a paper.
          </div>
        ) : (

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {doc.file_format}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {doc.file_name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>{doc.word_count.toLocaleString()} words</span>
                    <span>~{doc.page_count} pages</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenSimilarity(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 transition-colors"
                  >
                    <span>Check Similarity</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenAiSignals(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-100 transition-colors"
                  >
                    <span>AI Signals</span>
                  </button>

                  <button
                    onClick={() => handleOpenWritingAssistant(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    <span>Writing Assistant</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paste Text Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handlePasteIngest}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Paste Research Draft for Analysis
            </h3>

            {ingestionError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                {ingestionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Document Label / Title (optional)
              </label>
              <input
                type="text"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="e.g., Quantum Computing Chapter 3"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Draft Text *
              </label>
              <textarea
                required
                rows={10}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste the draft text here..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isIngesting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {isIngesting ? "Ingesting..." : "Ingest & Analyze"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Library Paper Picker Modal */}
      {isLibraryPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Select Paper from Research Library
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Choose any paper in your library to inspect for similarity or run writing improvements on.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {papers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No papers in library yet. Discover and save papers first!
                </div>
              ) : (
                papers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleLibraryPaperPick(p.id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-900/40 transition-colors text-xs"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {p.title}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-1">
                      {p.authors.slice(0, 3).join(", ")} &bull; {p.year}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              <button
                onClick={() => setIsLibraryPickerOpen(false)}
                className="px-4 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corpus Manager Modal */}
      <CorpusManagerModal
        isOpen={isCorpusModalOpen}
        onClose={() => setIsCorpusModalOpen(false)}
        onIndexUpdated={loadDashboardData}
      />
    </div>
  );
};
