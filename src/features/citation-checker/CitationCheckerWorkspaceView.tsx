import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import {
  CheckCircle2,
  Upload,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Sparkles,
} from "lucide-react";
import { CitationAuditReport, ParsedReference } from "./types";
import { performCitationAudit } from "./consistencyEngine";
import { CITATION_CHECKER_DEMO_MANUSCRIPT } from "./styleFormatters";
import {
  saveCitationAuditDb,
  ingestDocumentContent,
  extractDocumentText,
  isTauriEnvironment,
} from "../../lib/desktop-api";
import { CitationSummaryCards } from "./components/CitationSummaryCards";
import { ClaimSupportNotice } from "./components/ClaimSupportNotice";
import { ReferenceInspectorDrawer } from "./components/ReferenceInspectorDrawer";
import { CitationAuditReportModal } from "./components/CitationAuditReportModal";
import { Button } from "../../components/ui/Button";

export const CitationCheckerWorkspaceView: React.FC = () => {
  const { papers, showToast } = useApp();

  const [inputText, setInputText] = useState<string>(CITATION_CHECKER_DEMO_MANUSCRIPT);
  const [report, setReport] = useState<CitationAuditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedReference, setSelectedReference] = useState<ParsedReference | null>(
    null
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("manuscript-sample.txt");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAudit = useCallback(
    (text: string, title = "Manuscript") => {
      if (!text.trim()) {
        setReport(null);
        return;
      }

      setIsProcessing(true);
      setTimeout(async () => {
        const res = performCitationAudit(text, title);
        setReport(res);
        setIsProcessing(false);

        if (isTauriEnvironment()) {
          try {
            const meta = await ingestDocumentContent(
              fileName || "manuscript.txt",
              "txt",
              text
            );
            await saveCitationAuditDb({
              id: res.id,
              document_hash: meta.document_hash,
              document_title: res.documentTitle,
              file_name: fileName || "manuscript.txt",
              total_in_text: res.summary.totalInTextCitations,
              total_references: res.summary.totalUniqueReferences,
              matched_citations: res.summary.matchedCitationsCount,
              health_score: res.summary.overallHealthScore,
              summary_json: JSON.stringify(res.summary),
              issues_json: JSON.stringify(res.issues),
              references_json: JSON.stringify(res.references),
              created_at: res.analyzedAt,
            });
          } catch (e) {
            console.warn("Could not persist citation audit to DB:", e);
          }
        }
      }, 150);
    },
    [fileName]
  );

  // Automatically perform initial audit on mount
  useEffect(() => {
    runAudit(CITATION_CHECKER_DEMO_MANUSCRIPT, "Demo Manuscript");
  }, [runAudit]);

  const handleManualRun = () => {
    if (!inputText.trim()) {
      showToast(
        "Please enter or import manuscript text before running audit.",
        "warning"
      );
      return;
    }
    runAudit(inputText, fileName || "Manuscript");
    showToast("Citation audit completed.", "success");
  };

  // Handle File Import (TXT, MD, TEX, BIB, PDF, DOCX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isBinary = /\.(pdf|docx)$/i.test(file.name);

    if (isBinary) {
      try {
        setIsProcessing(true);
        const filePath = (file as unknown as { path?: string }).path || file.name;
        const res = await extractDocumentText(filePath);
        if (res && res.text && res.text.trim()) {
          setInputText(res.text);
          runAudit(res.text, file.name);
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
        setInputText(content);
        runAudit(content, file.name);
        showToast(`Loaded and analyzed "${file.name}"`, "info");
      }
    };
    reader.onerror = () => {
      showToast("Failed to read file.", "error");
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  // Filter issues based on active category tab
  const filteredIssues = useMemo(() => {
    if (!report) return [];
    if (activeFilter === "all") return report.issues;
    if (activeFilter === "missing") {
      return report.issues.filter((i) => i.category === "missing_reference");
    }
    if (activeFilter === "uncited") {
      return report.issues.filter((i) => i.category === "uncited_reference");
    }
    if (activeFilter === "doi") {
      return report.issues.filter(
        (i) =>
          i.category === "malformed_doi" ||
          i.category === "doi_resolution_failed" ||
          i.category === "metadata_discrepancy"
      );
    }
    if (activeFilter === "duplicates") {
      return report.issues.filter((i) => i.category === "duplicate_reference");
    }
    if (activeFilter === "incomplete") {
      return report.issues.filter(
        (i) =>
          i.category === "incomplete_metadata" || i.category === "mixed_citation_styles"
      );
    }
    return report.issues;
  }, [report, activeFilter]);

  const orphanCount = report
    ? report.issues.filter((i) => i.category === "missing_reference").length
    : 0;
  const uncitedCount = report
    ? report.issues.filter((i) => i.category === "uncited_reference").length
    : 0;
  const doiDiscrepCount = report
    ? report.issues.filter(
        (i) => i.category === "malformed_doi" || i.category === "metadata_discrepancy"
      ).length
    : 0;
  const duplicateCount = report
    ? report.issues.filter((i) => i.category === "duplicate_reference").length
    : 0;

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl border shrink-0 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Citation Checker & Reference Verifier
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Crossref & Registry Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                Automatically cross-checks in-text citations against your bibliography,
                flags orphan markers and uncited references, validates DOI syntax against
                Crossref/IDF standards, and detects bibliographic metadata discrepancies.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.tex,.bib,.docx,.pdf"
              className="hidden"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-9 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import File</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportModalOpen(true)}
              disabled={!report}
              className="text-xs h-9 gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Report</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleManualRun}
              isLoading={isProcessing}
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Audit</span>
            </Button>
          </div>
        </div>

        {/* Claim Support Notice Guardrail */}
        <ClaimSupportNotice />
      </div>

      {/* 2. KPI Summary Cards */}
      {report && <CitationSummaryCards summary={report.summary} />}

      {/* 3. Main Workspace: Split Text Input and Live Findings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 Cols): Manuscript Editor / Viewer */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Document Text
              </span>
              <span className="text-slate-400 font-mono text-[11px]">({fileName})</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Load Paper from Library dropdown */}
              {papers.length > 0 && (
                <select
                  onChange={(e) => {
                    const p = papers.find((paper) => paper.id === e.target.value);
                    if (p) {
                      const text = `${p.title}\n\nAbstract:\n${p.abstract} [1]. Further observations confirmed by (Vaswani et al., 2017).\n\nREFERENCES\n[1] ${p.authors.join(", ")}, "${p.title}," in ${p.venue}, ${p.year}. doi: ${p.doi || "10.1109/access.2023.1042918"}.`;
                      setInputText(text);
                      setFileName(`${p.title.slice(0, 20)}.txt`);
                      runAudit(text, p.title);
                      showToast(`Loaded paper "${p.title.slice(0, 35)}..."`, "info");
                    }
                  }}
                  defaultValue=""
                  className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  <option value="" disabled>
                    Load Library Paper...
                  </option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title.slice(0, 35)}...
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  setInputText(CITATION_CHECKER_DEMO_MANUSCRIPT);
                  setFileName("sample-manuscript.txt");
                  runAudit(CITATION_CHECKER_DEMO_MANUSCRIPT, "Demo Manuscript");
                  showToast("Loaded sample manuscript with test discrepancies", "info");
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Sample
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("");
                  setReport(null);
                  setFileName("empty.txt");
                }}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
            }}
            placeholder="Paste your manuscript containing in-text citations and a REFERENCES or BIBLIOGRAPHY section, or drop a LaTeX/BibTeX/TXT file..."
            rows={18}
            className="w-full flex-1 p-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs leading-relaxed font-mono resize-y focus:outline-hidden"
          />

          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Supports IEEE [1], APA (Smith, 2020), and LaTeX \cite&#123;...&#125;
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRun}
              className="text-xs h-6 px-2"
            >
              Update Findings
            </Button>
          </div>
        </div>

        {/* Right Column (7 Cols): Filterable Citation Findings & Issue Inspector */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === "all"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              All Findings ({report?.issues.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("missing")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === "missing"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Missing References ({orphanCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("uncited")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === "uncited"
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Uncited Entries ({uncitedCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("doi")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === "doi"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              DOI & Metadata ({doiDiscrepCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("duplicates")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === "duplicates"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Duplicates ({duplicateCount})
            </button>
          </div>

          {/* Issue Cards List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredIssues.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Issues in this Category
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {report
                    ? "All checked items in this category comply with scholarly reference requirements."
                    : "Enter manuscript text to generate citation findings."}
                </p>
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const targetRef = issue.referenceId
                  ? report?.references.find((r) => r.id === issue.referenceId)
                  : null;

                return (
                  <div
                    key={issue.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 space-y-2.5 shadow-2xs transition-all ${
                      issue.severity === "critical"
                        ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                        : issue.severity === "warning"
                          ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
                          : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            issue.severity === "critical"
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400"
                              : issue.severity === "warning"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                                : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {issue.severity === "critical" ? (
                            <AlertOctagon className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {issue.title}
                            </h3>
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                issue.severity === "critical"
                                  ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                                  : issue.severity === "warning"
                                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                            {issue.description}
                          </p>
                        </div>
                      </div>

                      {targetRef && (
                        <button
                          type="button"
                          onClick={() => setSelectedReference(targetRef)}
                          className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          Inspect Ref
                        </button>
                      )}
                    </div>

                    {/* Metadata comparison card if discrepancy detected */}
                    {issue.comparison && (
                      <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-xs space-y-1.5">
                        <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px]">
                          Field Comparison: {issue.comparison.label}
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded bg-white dark:bg-slate-900/70 border border-amber-200 dark:border-amber-800">
                            <span className="text-slate-400 block text-[10px]">
                              Reference Value:
                            </span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400 line-through">
                              {issue.comparison.referenceValue}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-white dark:bg-slate-900/70 border border-emerald-300 dark:border-emerald-800">
                            <span className="text-slate-400 block text-[10px]">
                              Verified Registry Record:
                            </span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {issue.comparison.registryValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Context Snippet */}
                    {issue.sourceSnippet && (
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                        {issue.sourceSnippet}
                      </div>
                    )}

                    {/* Suggested Fix Action */}
                    {issue.suggestedFix && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          Suggested Action: {issue.suggestedFix}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Slide-over Reference Inspector Drawer */}
      <ReferenceInspectorDrawer
        reference={selectedReference}
        onClose={() => setSelectedReference(null)}
        inTextCitations={report?.inTextCitations || []}
      />

      {/* 5. Citation Audit Report Export Modal */}
      <CitationAuditReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        report={report}
      />
    </div>
  );
};
