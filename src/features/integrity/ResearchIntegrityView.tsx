import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import {
  ShieldCheck,
  Upload,
  Download,
  History,
  Play,
  RotateCcw,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";
import {
  UnifiedIntegrityReport,
  IntegrityDimension,
} from "./types";
import {
  generateIntegrityReport,
  RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
} from "./integrityEngine";
import {
  saveReportToStorage,
  updateFindingReviewStatus,
  loadSavedReportsFromStorage,
} from "./reportStore";
import {
  ingestDocumentContent,
  saveIntegrityReportDb,
  updateIntegrityFindingReviewDb,
  listSavedIntegrityReportsDb,
  extractDocumentText,
  isTauriEnvironment,
} from "../../lib/desktop-api";
import { DimensionCards } from "./components/DimensionCards";
import { FindingsTable } from "./components/FindingsTable";
import { ExportReportModal } from "./components/ExportReportModal";
import { PreviousReportsDrawer } from "./components/PreviousReportsDrawer";
import { Button } from "../../components/ui/Button";

export const ResearchIntegrityView: React.FC = () => {
  const { showToast } = useApp();

  const [rawText, setRawText] = useState<string>(
    RESEARCH_INTEGRITY_DEMO_MANUSCRIPT
  );
  const [docTitle, setDocTitle] = useState<string>("Neural Document Retrieval Benchmarks");
  const [fileName, setFileName] = useState<string>("manuscript-sample.txt");
  const [report, setReport] = useState<UnifiedIntegrityReport | null>(() => {
    try {
      return generateIntegrityReport(
        RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
        "Neural Document Retrieval Benchmarks",
        "manuscript-sample.txt"
      );
    } catch (err) {
      console.error("INIT ERROR:", err);
      return null;
    }
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedDimension, setSelectedDimension] = useState<
    IntegrityDimension | "all"
  >("all");
  const [isEditorExpanded, setIsEditorExpanded] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSavedCount = useCallback(async () => {
    try {
      if (isTauriEnvironment()) {
        const dbReports = await listSavedIntegrityReportsDb();
        setSavedCount(dbReports.length);
      } else {
        const saved = loadSavedReportsFromStorage();
        setSavedCount(saved.length);
      }
    } catch {
      setSavedCount(0);
    }
  }, []);

  // Initialize with saved counts on mount
  useEffect(() => {
    refreshSavedCount();
  }, [refreshSavedCount]);

  const runAudit = (
    textToAnalyze: string,
    title = docTitle,
    file = fileName,
    saveToDb = true
  ) => {
    if (!textToAnalyze.trim()) {
      showToast("Please provide manuscript text to run an integrity audit.", "warning");
      return;
    }

    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const newReport = generateIntegrityReport(textToAnalyze, title, file);
        setReport(newReport);

        // Ingest and compute cryptographic document hash
        const meta = await ingestDocumentContent(file, "txt", textToAnalyze);

        if (saveToDb) {
          saveReportToStorage(newReport);

          // Save to SQLite backend database
          if (isTauriEnvironment()) {
            await saveIntegrityReportDb({
              id: newReport.id,
              document_hash: meta.document_hash,
              file_name: newReport.fileName,
              title: newReport.title,
              word_count: newReport.wordCount,
              dimensions_json: JSON.stringify(newReport.dimensions),
              ethical_disclaimer: newReport.ethicalDisclaimer,
              findings_count: newReport.findings.length,
              unreviewed_count: newReport.findings.filter((f) => !f.isReviewed).length,
              created_at: newReport.analyzedAt,
              updated_at: newReport.analyzedAt,
              findings: newReport.findings.map((f) => ({
                id: f.id,
                report_id: newReport.id,
                dimension: f.dimension,
                title: f.title,
                description: f.description,
                status: f.status,
                severity: f.severity,
                confidence: f.confidence,
                evidence: f.evidence,
                location: f.location,
                suggested_action: f.suggestedAction,
                is_reviewed: f.isReviewed,
                reviewed_at: f.reviewedAt,
                reviewer_notes: f.reviewerNotes,
                created_at: newReport.analyzedAt,
              })),
            });
          }

          refreshSavedCount();
          showToast("Integrity audit completed and saved to database.", "success");
        }
      } catch (err) {
        console.error("Audit error:", err);
        showToast("Error generating integrity report.", "error");
      } finally {
        setIsProcessing(false);
      }
    }, 150);
  };

  const handleManualRun = () => {
    runAudit(rawText, docTitle, fileName, true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const derivedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    setDocTitle(derivedTitle);
    const isBinary = /\.(pdf|docx)$/i.test(file.name);

    if (isBinary) {
      try {
        setIsProcessing(true);
        const filePath = (file as unknown as { path?: string }).path || file.name;
        const res = await extractDocumentText(filePath);
        if (res && res.text && res.text.trim()) {
          setRawText(res.text);
          runAudit(res.text, derivedTitle, file.name, true);
          setIsEditorExpanded(false);
          showToast(`Extracted and analyzed "${file.name}"`, "info");
        } else {
          showToast(`No readable text extracted from "${file.name}".`, "warning");
        }
      } catch (err) {
        console.warn("Backend document extraction failed:", err);
        showToast(`Failed to extract text from binary document "${file.name}".`, "error");
      } finally {
        setIsProcessing(false);
        e.target.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        runAudit(content, derivedTitle, file.name, true);
        setIsEditorExpanded(false);
      }
    };
    reader.onerror = () => {
      showToast("Failed to read file.", "error");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleToggleReviewed = async (
    findingId: string,
    isReviewed: boolean,
    notes?: string
  ) => {
    if (!report) return;

    // Update in backend SQLite database if in desktop environment
    if (isTauriEnvironment()) {
      try {
        await updateIntegrityFindingReviewDb(findingId, isReviewed, notes);
      } catch (e) {
        console.warn("Failed to persist finding review to DB:", e);
      }
    }

    // Update in local store
    const updatedReport = updateFindingReviewStatus(
      report.id,
      findingId,
      isReviewed,
      notes
    );

    if (updatedReport) {
      setReport(updatedReport);
      refreshSavedCount();
      showToast(
        isReviewed ? "Finding marked as reviewed." : "Finding marked as unreviewed.",
        "info"
      );
    } else {
      // In-memory update if not saved
      setReport((prev) => {
        if (!prev) return null;
        const newFindings = prev.findings.map((f) => {
          if (f.id === findingId) {
            return {
              ...f,
              isReviewed,
              status: isReviewed ? ("reviewed" as const) : f.status === "reviewed" ? ("concern" as const) : f.status,
              reviewedAt: isReviewed ? new Date().toISOString() : null,
              reviewerNotes: notes !== undefined ? notes : f.reviewerNotes,
            };
          }
          return f;
        });
        return {
          ...prev,
          findings: newFindings,
        };
      });
    }
  };

  const handleSaveCurrentReport = () => {
    if (!report) return;
    saveReportToStorage(report);
    refreshSavedCount();
    showToast("Audit report saved to local storage.", "success");
  };

  const handleLoadDemo = () => {
    setRawText(RESEARCH_INTEGRITY_DEMO_MANUSCRIPT);
    setDocTitle("Neural Document Retrieval Benchmarks");
    setFileName("manuscript-sample.txt");
    runAudit(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "Neural Document Retrieval Benchmarks",
      "manuscript-sample.txt",
      true
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-xl text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Research Integrity Auditor
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-dimensional academic manuscript audit: similarity, AI signals, citations, metadata, and structural rigor.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.tex,.docx,.rtf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import text or manuscript"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </Button>

          {/* Load Sample */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLoadDemo}
            title="Load sample benchmark manuscript"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Demo Sample
          </Button>

          {/* Saved Audits Drawer */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryDrawerOpen(true)}
            title="View previous integrity audits"
          >
            <History className="w-3.5 h-3.5" />
            History ({savedCount})
          </Button>

          {/* Export Report */}
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              title="Export HTML or JSON report"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit
            </Button>
          )}

          {/* Save Report */}
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveCurrentReport}
              title="Save report to local storage"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
          )}

          {/* Run Audit */}
          <Button
            variant="primary"
            size="sm"
            isLoading={isProcessing}
            onClick={handleManualRun}
            title="Re-run comprehensive integrity analysis"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Audit
          </Button>
        </div>
      </div>

      {/* Ethical Guardrails & Advisory Disclaimer Banner */}
      <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-950 dark:text-blue-200">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900 dark:text-blue-100">
            Transparent Multi-Dimensional Integrity Protocol
          </p>
          <p className="text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
            {report?.ethicalDisclaimer ||
              "Automated checks provide traceable diagnostics across independent statistical, structural, and bibliographic dimensions. The system never generates an unexplained aggregate score and never claims to prove dishonesty or misconduct. Primary evidence must be inspected by authors and peer reviewers."}
          </p>
        </div>
      </div>

      {/* Manuscript Input & Metadata Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-indigo-500" />
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mr-2">
                Document:
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {fileName} ({report ? `${report.wordCount.toLocaleString()} words` : "Unprocessed"})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditorExpanded(!isEditorExpanded)}
              className="text-xs"
            >
              {isEditorExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Collapse Source Text
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Edit Source Text
                </>
              )}
            </Button>
          </div>
        </div>

        {isEditorExpanded && (
          <div className="p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Manuscript Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Study on Distributed Deep Learning"
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="document.txt"
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Manuscript Full Text & References
              </label>
              <textarea
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste complete manuscript text including abstract, sections, and bibliography..."
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditorExpanded(false)}
              >
                Close Editor
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isProcessing}
                onClick={handleManualRun}
              >
                Apply & Audit
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Audit Content */}
      {report && (
        <div className="space-y-6">
          {/* Dimension Summary Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Audited Dimensions (7 Independent Dimensions)
              </h3>
              {selectedDimension !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedDimension("all")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  Show All Dimensions
                </button>
              )}
            </div>
            <DimensionCards
              dimensions={report.dimensions}
              selectedDimension={selectedDimension}
              onSelectDimension={setSelectedDimension}
            />
          </div>

          {/* Traceable Findings Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Traceable Findings & Evidence ({report.findings.length} total)
              </h3>
            </div>
            <FindingsTable
              findings={report.findings}
              selectedDimension={selectedDimension}
              onSelectDimension={setSelectedDimension}
              onToggleReviewed={handleToggleReviewed}
            />
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      {report && (
        <ExportReportModal
          report={report}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Previous Reports History Drawer */}
      <PreviousReportsDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        onSelectReport={(r) => {
          setReport(r);
          setRawText(
            r.findings.length > 0 ? RESEARCH_INTEGRITY_DEMO_MANUSCRIPT : ""
          );
          setDocTitle(r.title);
          setFileName(r.fileName);
        }}
        onToast={showToast}
      />
    </div>
  );
};
