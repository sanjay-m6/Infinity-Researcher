import React, { useState, useEffect, useCallback } from "react";
import {
  TableProperties,
  Plus,
  Download,
  Columns3,
  FileText,
  Search,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  X,
} from "lucide-react";
import {
  MatrixWorkspace,
  MatrixWorkspaceDetail,
  MatrixRow,
  MatrixColumnConfig,
  MatrixExtraction,
} from "../../lib/desktop-api/types";
import * as desktopApi from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { AITypingIndicator } from "../../components/loading";
import { MatrixAiAssistantPanel } from "./MatrixAiAssistantPanel";
import { EvidenceDetailsPanel } from "./EvidenceDetailsPanel";
import { ColumnConfigModal } from "./ColumnConfigModal";
import { AddPapersModal } from "./AddPapersModal";

interface ReviewMatrixViewProps {
  onNavigateToDiscoverPdf?: (paperId: string, pageNumber: number) => void;
}

export const ReviewMatrixView: React.FC<ReviewMatrixViewProps> = ({
  onNavigateToDiscoverPdf,
}) => {
  const [workspaces, setWorkspaces] = useState<MatrixWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [detail, setDetail] = useState<MatrixWorkspaceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Side-by-side Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"ai_assistant" | "evidence_details">("ai_assistant");
  const [panelWidth, setPanelWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);

  // Selection state
  const [selectedPaper, setSelectedPaper] = useState<MatrixRow | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    row: MatrixRow;
    col: MatrixColumnConfig;
    extraction: MatrixExtraction | null;
  } | null>(null);

  // Modals state
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isAddPapersOpen, setIsAddPapersOpen] = useState(false);

  // Mouse drag handle resizing
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= 760) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const list = await desktopApi.listMatrixWorkspaces();
      setWorkspaces(list);
      if (list.length > 0) {
        setActiveWorkspaceId((prev) => prev || list[0].id);
      }
    } catch (err) {
      console.warn("Failed to load matrix workspaces:", err);
    }
  }, []);

  const loadWorkspaceDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await desktopApi.getMatrixWorkspaceDetail(id);
      setDetail(res);
      if (res.rows.length > 0 && !selectedPaper) {
        setSelectedPaper(res.rows[0]);
      }
    } catch (err) {
      console.error("Failed to load workspace detail:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPaper]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (activeWorkspaceId) {
      void loadWorkspaceDetail(activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadWorkspaceDetail]);

  const handleAddPaper = async (paperId: string) => {
    if (!activeWorkspaceId) return;
    await desktopApi.addPaperToMatrix(activeWorkspaceId, paperId);
    await loadWorkspaceDetail(activeWorkspaceId);
  };

  const handleRemovePaper = async (paperId: string) => {
    if (!activeWorkspaceId) return;
    await desktopApi.removePaperFromMatrix(activeWorkspaceId, paperId);
    if (selectedPaper?.paper_id === paperId) {
      setSelectedPaper(null);
    }
    if (selectedCell?.row.paper_id === paperId) {
      setSelectedCell(null);
    }
    await loadWorkspaceDetail(activeWorkspaceId);
  };

  const handleReExtract = async (paperId: string) => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      await desktopApi.extractMatrixFields(activeWorkspaceId, paperId);
      await loadWorkspaceDetail(activeWorkspaceId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExtraction = async (updated: MatrixExtraction) => {
    const saved = await desktopApi.upsertMatrixExtraction(updated);
    if (detail) {
      setDetail((prev) => {
        if (!prev) return prev;
        const newRows = prev.rows.map((r) => {
          if (r.paper_id === saved.paper_id) {
            return {
              ...r,
              extractions: {
                ...r.extractions,
                [saved.field_key]: saved,
              },
            };
          }
          return r;
        });
        return { ...prev, rows: newRows };
      });
      setSelectedCell((prev) => (prev ? { ...prev, extraction: saved } : null));
    }
  };

  const handleSaveColumns = async (updatedCols: MatrixColumnConfig[]) => {
    if (!activeWorkspaceId) return;
    const jsonStr = JSON.stringify(updatedCols);
    await desktopApi.updateMatrixColumns(activeWorkspaceId, jsonStr);
    await loadWorkspaceDetail(activeWorkspaceId);
  };

  const handleExportCsv = async () => {
    if (!activeWorkspaceId) return;
    try {
      const csvStr = await desktopApi.exportMatrixCsv(activeWorkspaceId);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `literature_review_matrix_${activeWorkspaceId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
    }
  };

  const handleCellClick = (
    row: MatrixRow,
    col: MatrixColumnConfig,
    ext: MatrixExtraction | null
  ) => {
    setSelectedCell({ row, col, extraction: ext });
    setSelectedPaper(row);
    setPanelTab("evidence_details");
    setIsPanelOpen(true);
  };

  const handleToggleAiAssistant = () => {
    if (isPanelOpen && panelTab === "ai_assistant") {
      setIsPanelOpen(false);
    } else {
      setPanelTab("ai_assistant");
      setIsPanelOpen(true);
    }
  };

  const handleAskAiAboutClaim = (_claimText: string, _paperTitle: string) => {
    setPanelTab("ai_assistant");
    setIsPanelOpen(true);
  };

  const existingPaperIds = new Set(detail?.rows.map((r) => r.paper_id) || []);

  const filteredRows = (detail?.rows || []).filter((row) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const inMeta =
      row.paper_title.toLowerCase().includes(q) ||
      row.authors.some((a) => a.toLowerCase().includes(q)) ||
      (row.venue && row.venue.toLowerCase().includes(q));
    const inExtractions = Object.values(row.extractions).some((ext) =>
      ext.extracted_value.toLowerCase().includes(q)
    );
    return inMeta || inExtractions;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <TableProperties className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Literature Review Matrix
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Local-First Verification
                </span>
                <AITypingIndicator
                  visible={isLoading}
                  activityState="retrieving_context"
                  context="matrix_copilot"
                  statusMessage="Updating matrix..."
                  variant="inline"
                />
                {workspaces.length > 1 && (
                  <select
                    value={activeWorkspaceId}
                    onChange={(e) => setActiveWorkspaceId(e.target.value)}
                    className="text-xs px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare papers side-by-side with page-linked evidence
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsColumnModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Columns3 className="w-4 h-4" />
              <span>Columns</span>
            </Button>
            <Button
              variant={isPanelOpen && panelTab === "ai_assistant" ? "primary" : "secondary"}
              size="sm"
              data-testid="toolbar-ai-assistant"
              onClick={handleToggleAiAssistant}
              className={`flex items-center gap-1.5 transition-colors ${
                isPanelOpen && panelTab === "ai_assistant"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>AI Assistant</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddPapersOpen(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add papers</span>
            </Button>
          </div>
        </div>

        {/* Stats & Search Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
              {detail?.total_papers || 0} papers
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
              {detail?.total_extractions || 0} dimensions
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
              {detail?.columns.length || 0} columns
            </span>
          </div>

          <div className="relative w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search claims, methods, metrics..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Side-by-Side Table & Resizable Right Panel */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Side: Horizontally scrollable Matrix Table */}
        <div className="flex-1 min-w-0 overflow-auto p-4 sm:p-6">
          {filteredRows.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/40">
              <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 mb-3">
                <TableProperties className="w-10 h-10" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Your Review Matrix is Empty
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
                Add papers from your Research Library or Discover searches. The engine will automatically extract research questions, methodologies, datasets, sample sizes, and main findings with claim-to-page evidence.
              </p>
              <Button
                variant="primary"
                onClick={() => setIsAddPapersOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Paper</span>
              </Button>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs min-w-max">
                  {/* Table Header */}
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold select-none">
                      {/* Sticky Paper Header */}
                      <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 p-3.5 w-72 min-w-[280px] shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]">
                        Paper & Authors
                      </th>
                      {/* Dynamic Dimension Headers */}
                      {(detail?.columns || []).map((col) => (
                        <th
                          key={col.key}
                          style={{ minWidth: col.width || 200, maxWidth: (col.width || 200) + 60 }}
                          className="p-3.5 border-l border-slate-200/60 dark:border-slate-800"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{col.label}</span>
                            {col.required && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"
                                title="Core Dimension"
                              />
                            )}
                          </div>
                        </th>
                      ))}
                      {/* Actions Header */}
                      <th className="p-3.5 w-20 text-center border-l border-slate-200/60 dark:border-slate-800">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((row) => {
                      const isRowSelected = selectedPaper?.paper_id === row.paper_id;

                      return (
                        <tr
                          key={row.paper_id}
                          className={`transition-colors group ${
                            isRowSelected
                              ? "bg-cyan-50/30 dark:bg-cyan-950/20"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                          }`}
                        >
                          {/* Sticky Paper Info Column */}
                          <td
                            onClick={() => {
                              setSelectedPaper(row);
                            }}
                            className={`sticky left-0 z-10 p-3.5 align-top shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] cursor-pointer ${
                              isRowSelected
                                ? "bg-cyan-50/60 dark:bg-slate-850"
                                : "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                {row.paper_title}
                              </h4>
                              {row.authors.length > 0 && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {row.authors.join(", ")}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {row.year && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                    {row.year}
                                  </span>
                                )}
                                {row.venue && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 line-clamp-1 max-w-[140px]">
                                    {row.venue}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Dynamic Dimension Cells */}
                          {(detail?.columns || []).map((col) => {
                            const ext = row.extractions[col.key] || null;
                            const isCellActive =
                              selectedCell?.row.paper_id === row.paper_id &&
                              selectedCell?.col.key === col.key;

                            return (
                              <td
                                key={col.key}
                                onClick={() => handleCellClick(row, col, ext)}
                                className={`p-3 align-top border-l border-slate-100 dark:border-slate-800/60 cursor-pointer transition-all ${
                                  isCellActive
                                    ? "bg-cyan-100/40 dark:bg-cyan-950/50 ring-2 ring-cyan-500 ring-inset"
                                    : "hover:bg-cyan-50/40 dark:hover:bg-cyan-950/30"
                                }`}
                              >
                                {ext ? (
                                  <div className="space-y-1.5">
                                    <p className="text-slate-800 dark:text-slate-200 line-clamp-3 leading-relaxed">
                                      {ext.extracted_value}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      {ext.page_number && (
                                        <span className="px-1.5 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          p. {ext.page_number}
                                        </span>
                                      )}
                                      {ext.status === "user_verified" ? (
                                        <span className="px-1.5 py-0.5 rounded font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                          Verified
                                        </span>
                                      ) : ext.status === "flagged" ? (
                                        <span className="px-1.5 py-0.5 rounded font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          Flagged
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded font-medium bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                                          {Math.round(ext.confidence * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-full min-h-[48px] flex items-center text-slate-300 dark:text-slate-700 hover:text-slate-400 italic text-[11px]">
                                    Click to add claim...
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Row Actions */}
                          <td className="p-3 text-center align-top border-l border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleReExtract(row.paper_id)}
                                title="Re-run Pattern Extraction"
                                className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemovePaper(row.paper_id)}
                                title="Remove from Matrix"
                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Resizable Side Panel (AI Assistant + Evidence Details) */}
        {isPanelOpen && (
          <div
            style={{ width: `${panelWidth}px` }}
            className="shrink-0 flex flex-row border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-20 overflow-hidden"
          >
            {/* Drag-to-Resize Handle */}
            <div
              onMouseDown={startResizing}
              className="w-1.5 hover:w-2 bg-slate-100 hover:bg-cyan-500 dark:bg-slate-800 dark:hover:bg-cyan-500 cursor-col-resize transition-all shrink-0 flex items-center justify-center group"
              title="Drag to resize panel"
            >
              <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600 group-hover:bg-white rounded-full" />
            </div>

            {/* Panel Inner Container */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
              {/* Tab Navigation Header */}
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    data-testid="tab-ai-assistant"
                    onClick={() => setPanelTab("ai_assistant")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      panelTab === "ai_assistant"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>AI Assistant</span>
                  </button>

                  <button
                    data-testid="tab-evidence-details"
                    onClick={() => setPanelTab("evidence_details")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      panelTab === "evidence_details"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Evidence Details</span>
                    {selectedCell && (
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Close side panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Content (Tab Views) */}
              <div className="flex-1 overflow-hidden">
                {panelTab === "ai_assistant" ? (
                  <MatrixAiAssistantPanel
                    workspaceId={activeWorkspaceId}
                    rows={detail?.rows || []}
                    columns={detail?.columns || []}
                    selectedPaper={selectedPaper}
                    selectedCell={selectedCell}
                    hasFilterActive={!!searchFilter.trim()}
                    filteredRowCount={filteredRows.length}
                    onNavigateToPdf={onNavigateToDiscoverPdf}
                    onClose={() => setIsPanelOpen(false)}
                  />
                ) : (
                  <EvidenceDetailsPanel
                    row={selectedCell?.row || selectedPaper || null}
                    column={selectedCell?.col || (detail?.columns[0] || null)}
                    extraction={selectedCell?.extraction || null}
                    onSaveExtraction={handleSaveExtraction}
                    onNavigateToPdf={onNavigateToDiscoverPdf}
                    onAskAiAboutClaim={handleAskAiAboutClaim}
                    onClose={() => setIsPanelOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Columns Customization Modal */}
      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={detail?.columns || []}
        onSaveColumns={handleSaveColumns}
      />

      {/* Add Papers from Library Modal */}
      <AddPapersModal
        isOpen={isAddPapersOpen}
        onClose={() => setIsAddPapersOpen(false)}
        existingPaperIds={existingPaperIds}
        onAddPaper={handleAddPaper}
      />
    </div>
  );
};
