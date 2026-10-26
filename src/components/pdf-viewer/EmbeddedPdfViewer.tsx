import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Search,
  X,
  Sidebar,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Download,
  Cloud,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  readPaperPdf,
  getReaderState,
  saveReaderState,
  fetchRemotePdfPreview,
} from "../../lib/desktop-api";

// Configure local Vite-bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface EmbeddedPdfViewerProps {
  paperId?: string | null;
  paperTitle: string;
  sourceUrl?: string | null;
  remotePdfUrl?: string | null;
  targetPage?: number;
  onSaveOffline?: () => void;
  isSavingOffline?: boolean;
  onClose?: () => void;
  onOpenExternal?: () => void;
  onResolveAgain?: () => void;
  onRetry?: () => void;
}

interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
}

export const EmbeddedPdfViewer: React.FC<EmbeddedPdfViewerProps> = ({
  paperId,
  paperTitle,
  sourceUrl,
  remotePdfUrl,
  targetPage,
  onSaveOffline,
  isSavingOffline,
  onClose,
  onOpenExternal,
  onResolveAgain,
  onRetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [fitMode, setFitMode] = useState<"custom" | "width" | "page">("width");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Search in PDF
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);

  // Scanned detection
  const [isScanned, setIsScanned] = useState(false);

  // Active rendering task cancellation handle
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Jump to cited page when targetPage changes (e.g. from citation click)
  useEffect(() => {
    if (targetPage && targetPage >= 1 && (!numPages || targetPage <= numPages)) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  // -------------------------------------------------------------------------
  // 1. Load Document Bytes & Restore State
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setErrorMessage(null);
      setPdfDoc(null);
      setSearchMatches([]);
      setActiveMatchIndex(-1);

      try {
        // Read persisted reader state if local paper
        let initialPage = 1;
        let initialZoom = 1.0;
        let initialRotation = 0;
        if (paperId && !remotePdfUrl) {
          try {
            const state = await getReaderState(paperId);
            if (state) {
              initialPage = Math.max(1, state.last_page);
              initialZoom = state.zoom_level > 0 ? state.zoom_level : 1.0;
              initialRotation = state.rotation;
            }
          } catch {
            // ignore error reading reader state
          }
        }

        // Fetch binary ArrayBuffer from Rust IPC (remote preview or local file)
        let buffer: ArrayBuffer;
        if (remotePdfUrl) {
          buffer = await fetchRemotePdfPreview(remotePdfUrl);
        } else if (paperId) {
          buffer = await readPaperPdf(paperId);
        } else {
          throw new Error("No PDF source or document identifier provided.");
        }

        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
        });

        const doc = await loadingTask.promise;
        if (isCancelled) {
          doc.cleanup();
          loadingTask.destroy();
          return;
        }

        const validPage = Math.min(initialPage, doc.numPages);
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(validPage);
        setPageInput(String(validPage));
        setZoom(initialZoom);
        setRotation(initialRotation);
        setLoading(false);
      } catch (err: unknown) {
        if (!isCancelled) {
          setLoading(false);
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(
            msg ||
              (remotePdfUrl
                ? "Could not stream remote PDF. The server may have rejected the request or requires browser authentication."
                : "Could not open local PDF. File may be missing or failed structural verification.")
          );
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [paperId, remotePdfUrl]);

  // -------------------------------------------------------------------------
  // 2. Render Page Canvas & Text Layer
  // -------------------------------------------------------------------------
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 48; // padding
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });

      let effectiveScale = zoom;
      if (fitMode === "width" && containerWidth > 100) {
        effectiveScale = containerWidth / unscaledViewport.width;
      } else if (fitMode === "page") {
        const containerHeight = container.clientHeight - 48;
        if (containerHeight > 100) {
          effectiveScale = Math.min(
            containerWidth / unscaledViewport.width,
            containerHeight / unscaledViewport.height
          );
        }
      }

      const viewport = page.getViewport({ scale: effectiveScale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        canvas,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;

      // Extract text content for selectable text layer & scanned detection
      const textContent = await page.getTextContent();
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = "";
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;

        if (textContent.items.length === 0 && currentPage === 1) {
          setIsScanned(true);
        } else {
          setIsScanned(false);
        }

        // Render text items for native text selection
        for (const rawItem of textContent.items) {
          const item = rawItem as { str?: string; transform?: number[]; height?: number };
          if (!item.str || item.str.trim() === "") continue;
          const textSpan = document.createElement("span");
          textSpan.textContent = item.str + " ";
          textSpan.className =
            "absolute text-transparent cursor-text select-text pointer-events-auto leading-none";
          // Calculate approx position
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform || [1, 0, 0, 1, 0, 0]);
          textSpan.style.left = `${tx[4]}px`;
          textSpan.style.top = `${tx[5] - (item.height || 10) * effectiveScale}px`;
          textSpan.style.fontSize = `${(item.height || 12) * effectiveScale}px`;
          textLayerRef.current.appendChild(textSpan);
        }
      }

      // Persist reading position for local saved papers
      if (paperId && !remotePdfUrl) {
        try {
          saveReaderState({
            paper_id: paperId,
            file_id: null,
            last_page: currentPage,
            zoom_level: effectiveScale,
            rotation,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // non-blocking
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "RenderingCancelledException") {
        console.error("PDF page render error:", err);
      }
    }
  }, [pdfDoc, currentPage, zoom, rotation, fitMode, paperId, remotePdfUrl]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // -------------------------------------------------------------------------
  // 3. Page Navigation Controls
  // -------------------------------------------------------------------------
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    setPageInput(String(page));
  }, [numPages]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p)) {
      goToPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // -------------------------------------------------------------------------
  // 4. In-PDF Text Search
  // -------------------------------------------------------------------------
  const performSearch = useCallback(
    async (query: string) => {
      if (!pdfDoc || !query.trim()) {
        setSearchMatches([]);
        setActiveMatchIndex(-1);
        return;
      }

      setIsSearching(true);
      const matches: SearchMatch[] = [];
      const lower = query.toLowerCase();

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        let matchCountOnPage = 0;

        for (const rawItem of textContent.items) {
          const item = rawItem as { str?: string };
          if (item.str && item.str.toLowerCase().includes(lower)) {
            matchCountOnPage++;
          }
        }

        for (let m = 0; m < matchCountOnPage; m++) {
          matches.push({ pageNumber: i, matchIndex: m });
        }
      }

      setSearchMatches(matches);
      setIsSearching(false);

      if (matches.length > 0) {
        setActiveMatchIndex(0);
        goToPage(matches[0].pageNumber);
      } else {
        setActiveMatchIndex(-1);
      }
    },
    [pdfDoc, goToPage]
  );

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    goToPage(searchMatches[nextIdx].pageNumber);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx =
      (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prevIdx);
    goToPage(searchMatches[prevIdx].pageNumber);
  };

  // -------------------------------------------------------------------------
  // 5. Keyboard Navigation
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in search or page input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setFitMode("custom");
        setZoom((z) => Math.min(3.0, z + 0.15));
      } else if (e.key === "-") {
        e.preventDefault();
        setFitMode("custom");
        setZoom((z) => Math.max(0.4, z - 0.15));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === "Escape") {
        if (showSearch) {
          setShowSearch(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, numPages, showSearch, isFullscreen, goToPage]);

  // -------------------------------------------------------------------------
  // Render: Loading State
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Opening PDF Document...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Loading pages and initializing embedded viewer
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Error State
  // -------------------------------------------------------------------------
  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            PDF Document Unavailable
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {errorMessage}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {onRetry && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry Streaming PDF
            </Button>
          )}
          {onResolveAgain && (
            <Button variant="primary" size="sm" onClick={onResolveAgain}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Re-resolve PDF Candidates
            </Button>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Source Article Page
            </a>
          )}
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Viewer
            </Button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Embedded Reader Workspace
  // -------------------------------------------------------------------------
  return (
    <div
      className={`flex flex-col bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none"
          : "relative h-full min-h-[580px]"
      }`}
    >
      {/* 1. Header & Document Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 gap-2 select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
          <h2
            className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate"
            title={paperTitle}
          >
            {paperTitle}
          </h2>
          {remotePdfUrl && (
            <Badge variant="info" size="sm" className="hidden sm:inline-flex items-center gap-1">
              <Cloud className="w-3 h-3 text-sky-500" />
              Remote Stream
            </Badge>
          )}
          {isScanned && (
            <Badge variant="warning" size="sm">
              Scanned (No OCR text)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onSaveOffline && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveOffline}
              disabled={isSavingOffline}
              title="Save document offline to local database and library"
              className="h-7 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>{isSavingOffline ? "Saving..." : "Save Offline"}</span>
            </Button>
          )}
          {onOpenExternal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenExternal}
              title="Open with system default PDF viewer"
              className="h-7 px-2 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">System App</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit focus reading" : "Focus reading mode"}
            className="h-7 w-7 p-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close reader"
              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 gap-2 text-xs select-none shrink-0">
        {/* Left: Sidebar toggle & Page Navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={isSidebarOpen ? "primary" : "ghost"}
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle thumbnail sidebar"
            className="h-7 px-2"
          >
            <Sidebar className="w-3.5 h-3.5 mr-1" />
            <span className="hidden md:inline">Pages</span>
          </Button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            title="Previous page (ArrowLeft)"
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-10 h-6 text-center text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              / {numPages}
            </span>
          </form>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= numPages}
            onClick={() => goToPage(currentPage + 1)}
            title="Next page (ArrowRight)"
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Center: Zoom & Rotate Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFitMode("custom");
              setZoom((z) => Math.max(0.4, z - 0.15));
            }}
            title="Zoom out (-)"
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>

          <select
            value={fitMode === "custom" ? String(Math.round(zoom * 100)) : fitMode}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "width") {
                setFitMode("width");
              } else if (val === "page") {
                setFitMode("page");
              } else {
                setFitMode("custom");
                setZoom(parseInt(val, 10) / 100);
              }
            }}
            className="h-6 px-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="width">Fit Width</option>
            <option value="page">Fit Page</option>
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFitMode("custom");
              setZoom((z) => Math.min(3.0, z + 0.15));
            }}
            title="Zoom in (+)"
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate clockwise (R)"
            className="h-7 w-7 p-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Right: Search Toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant={showSearch ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            title="Search in PDF (Ctrl+F)"
            className="h-7 px-2"
          >
            <Search className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Find</span>
          </Button>
        </div>
      </div>

      {/* 3. Search Bar Sub-Panel */}
      {showSearch && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-900 gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="Find text in document..."
              value={searchQuery}
              autoFocus
              onChange={(e) => {
                setSearchQuery(e.target.value);
                performSearch(e.target.value);
              }}
              className="flex-1 h-7 px-2.5 text-xs rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {isSearching ? (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse">
                Searching...
              </span>
            ) : searchMatches.length > 0 ? (
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                {activeMatchIndex + 1} of {searchMatches.length}
              </span>
            ) : searchQuery.trim() ? (
              <span className="text-xs text-slate-500 shrink-0">No matches</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={searchMatches.length === 0}
              onClick={prevMatch}
              title="Previous match"
              className="h-6 w-6 p-0"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={searchMatches.length === 0}
              onClick={nextMatch}
              title="Next match"
              className="h-6 w-6 p-0"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(false)}
              className="h-6 w-6 p-0"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 4. Main Body: Thumbnails & Page Canvas Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Thumbnails Sidebar */}
        {isSidebarOpen && (
          <div className="w-36 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-2 space-y-2 select-none shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Pages ({numPages})
            </div>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
              const isSelected = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className={`w-full flex flex-col items-center p-1.5 rounded-lg border transition-all text-center cursor-pointer ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                  }`}
                >
                  <div className="w-16 h-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs flex items-center justify-center text-[10px] text-slate-400 font-mono">
                    P. {p}
                  </div>
                  <span
                    className={`mt-1 text-[11px] font-medium ${
                      isSelected
                        ? "text-indigo-600 dark:text-indigo-400 font-bold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Page {p}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Canvas Viewport */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-6 flex justify-center items-start bg-slate-200/60 dark:bg-slate-950"
        >
          <div className="relative shadow-xl rounded bg-white dark:bg-slate-900 overflow-hidden">
            <canvas ref={canvasRef} className="block select-none" />
            {/* Transparent selectable text layer overlaid on top of canvas */}
            <div
              ref={textLayerRef}
              className="absolute inset-0 pointer-events-none select-text overflow-hidden"
              style={{ userSelect: "text" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
