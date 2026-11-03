import React, { useCallback, useState } from "react";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "./ProjectWorkspaceContext";
import { Panel1Collection } from "./components/Panel1Collection";
import { Panel2Workspace } from "./components/Panel2Workspace";
import { Panel3Evidence } from "./components/Panel3Evidence";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Layers,
  FileSpreadsheet,
  Check,
} from "lucide-react";

const WorkspaceInner: React.FC = () => {
  const {
    projectTitle,
    setProjectTitle,
    papers,
    panel1Width,
    setPanel1Width,
    panel3Width,
    setPanel3Width,
    isPanel1Collapsed,
    setIsPanel1Collapsed,
    isPanel3Collapsed,
    setIsPanel3Collapsed,
    surveyRows,
  } = useProjectWorkspace();

  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(projectTitle);
  const [showExportToast, setShowExportToast] = useState<boolean>(false);

  // Left resize handler
  const handleLeftResizeStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingLeft(true);
      const startX = e.clientX;
      const startWidth = panel1Width;

      const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + delta, 250), 520);
        setPanel1Width(newWidth);
      };

      const onPointerUp = () => {
        setIsDraggingLeft(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    },
    [panel1Width, setPanel1Width]
  );

  // Right resize handler
  const handleRightResizeStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingRight(true);
      const startX = e.clientX;
      const startWidth = panel3Width;

      const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, 280), 580);
        setPanel3Width(newWidth);
      };

      const onPointerUp = () => {
        setIsDraggingRight(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    },
    [panel3Width, setPanel3Width]
  );

  const handleResetLayout = () => {
    setPanel1Width(320);
    setPanel3Width(380);
    setIsPanel1Collapsed(false);
    setIsPanel3Collapsed(false);
  };

  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      setProjectTitle(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleExportMatrixCsv = () => {
    const headers = [
      "Paper Title",
      "Authors",
      "Year",
      "Research Objective",
      "Methodology",
      "Dataset",
      "Results & Findings",
      "Limitations",
      "Future Work",
    ];

    const rows = surveyRows.map((r) => [
      `"${r.paperTitle.replace(/"/g, '""')}"`,
      `"${r.authors.replace(/"/g, '""')}"`,
      r.year,
      `"${r.objective.replace(/"/g, '""')}"`,
      `"${r.methodology.replace(/"/g, '""')}"`,
      `"${r.dataset.replace(/"/g, '""')}"`,
      `"${r.results.replace(/"/g, '""')}"`,
      `"${r.limitations.replace(/"/g, '""')}"`,
      `"${r.futureWork.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `literature_survey_matrix_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 2500);
  };

  return (
    <div
      className="h-full flex flex-col bg-background text-text overflow-hidden"
      data-testid="literature-workspace"
    >
      {/* Top Workspace Bar */}
      <header className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between shrink-0 select-none">
        {/* Left: Project title & metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-surface-subtle text-text-muted border border-border">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-xs font-medium text-text-muted hidden sm:inline">
              Workspace
            </span>
            <span className="text-text-muted hidden sm:inline">/</span>
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="text-xs font-semibold px-2 py-1 rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-slate-400"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
                title="Save title"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTitleInput(projectTitle);
                setIsEditingTitle(true);
              }}
              className="group flex items-center gap-2 text-xs font-semibold text-text hover:text-primary transition-colors truncate max-w-md"
              title="Click to rename project"
            >
              <span className="truncate">{projectTitle}</span>
              <span className="text-[11px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                edit
              </span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-2 ml-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-md font-medium bg-surface-subtle text-text-muted border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="tabular-nums font-mono">{papers.length}</span> papers
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-md font-medium bg-surface-subtle text-text-muted border border-border">
              3-Panel Literature Hub
            </span>
          </div>
        </div>

        {/* Right: Actions & Panel toggles */}
        <div className="flex items-center gap-2">
          {/* Quick export CSV */}
          <button
            onClick={handleExportMatrixCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-hover text-text transition-colors"
            title="Export Survey Matrix to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-text-muted" />
            <span className="hidden md:inline">Export Matrix</span>
          </button>

          {/* Reset Layout */}
          <button
            onClick={handleResetLayout}
            className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title="Reset 3-panel split layout"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Panel 1 Toggle */}
          <button
            onClick={() => setIsPanel1Collapsed((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isPanel1Collapsed
                ? "border-border bg-surface-subtle text-text"
                : "border-border text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
            title={
              isPanel1Collapsed ? "Expand Collection Panel" : "Collapse Collection Panel"
            }
            aria-label="Toggle Left Panel"
          >
            {isPanel1Collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Panel 3 Toggle */}
          <button
            onClick={() => setIsPanel3Collapsed((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isPanel3Collapsed
                ? "border-border bg-surface-subtle text-text"
                : "border-border text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
            title={
              isPanel3Collapsed ? "Expand Evidence Panel" : "Collapse Evidence Panel"
            }
            aria-label="Toggle Right Panel"
          >
            {isPanel3Collapsed ? (
              <PanelRightOpen className="w-4 h-4" />
            ) : (
              <PanelRightClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main 3-Panel Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PANEL 1: Collection & Discovery */}
        {!isPanel1Collapsed ? (
          <div
            style={{ width: `${panel1Width}px` }}
            className="h-full shrink-0 overflow-hidden flex flex-col"
          >
            <Panel1Collection />
          </div>
        ) : (
          <div className="h-full w-9 shrink-0 border-r border-border bg-surface-subtle flex flex-col items-center py-3 select-none">
            <button
              onClick={() => setIsPanel1Collapsed(false)}
              className="p-1.5 rounded-md hover:bg-surface text-text-muted hover:text-text"
              title="Expand Left Panel"
            >
              <PanelLeftOpen className="w-4 h-4 text-primary" />
            </button>
            <div
              className="mt-8 text-[11px] font-medium text-text-muted flex items-center justify-center origin-center"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Collection ({papers.length})
            </div>
          </div>
        )}

        {/* Left Splitter */}
        {!isPanel1Collapsed && (
          <div
            onPointerDown={handleLeftResizeStart}
            onMouseDown={handleLeftResizeStart}
            className={`w-1.5 hover:w-2 -ml-0.5 relative z-20 cursor-col-resize select-none transition-all group ${
              isDraggingLeft
                ? "bg-slate-400 dark:bg-slate-600 w-2"
                : "bg-border/60 hover:bg-slate-400/50"
            }`}
            title="Drag to resize collection panel"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* PANEL 2: Center Workspace (Survey Matrix, Compare, Gaps, Writer, Notes, Figures) */}
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-background">
          <Panel2Workspace />
        </main>

        {/* Right Splitter */}
        {!isPanel3Collapsed && (
          <div
            onPointerDown={handleRightResizeStart}
            onMouseDown={handleRightResizeStart}
            className={`w-1.5 hover:w-2 -mr-0.5 relative z-20 cursor-col-resize select-none transition-all group ${
              isDraggingRight
                ? "bg-slate-400 dark:bg-slate-600 w-2"
                : "bg-border/60 hover:bg-slate-400/50"
            }`}
            title="Drag to resize evidence panel"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* PANEL 3: Details, Evidence & Plagiarism Review */}
        {!isPanel3Collapsed ? (
          <div
            style={{ width: `${panel3Width}px` }}
            className="h-full shrink-0 overflow-hidden flex flex-col"
          >
            <Panel3Evidence />
          </div>
        ) : (
          <div className="h-full w-9 shrink-0 border-l border-border bg-surface-subtle flex flex-col items-center py-3 select-none">
            <button
              onClick={() => setIsPanel3Collapsed(false)}
              className="p-1.5 rounded-md hover:bg-surface text-text-muted hover:text-text"
              title="Expand Right Evidence Panel"
            >
              <PanelRightOpen className="w-4 h-4 text-text-muted" />
            </button>
            <div
              className="mt-8 text-[11px] font-medium text-text-muted flex items-center justify-center origin-center"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Evidence & review
            </div>
          </div>
        )}
      </div>

      {/* Export Toast Notification */}
      {showExportToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3.5 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700 dark:border-slate-300">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          Literature survey matrix exported
        </div>
      )}
    </div>
  );
};

export const LiteratureWorkspaceView: React.FC = () => {
  return (
    <ProjectWorkspaceProvider>
      <WorkspaceInner />
    </ProjectWorkspaceProvider>
  );
};

export default LiteratureWorkspaceView;
