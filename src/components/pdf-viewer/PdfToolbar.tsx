import React, { useState } from "react";
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
  RefreshCw,
  ExternalLink,
  Download,
  Cloud,
  CheckCircle2,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SourceBadge } from "../ui/SourceBadge";
import { FitMode } from "./types";

export interface PdfToolbarProps {
  paperTitle: string;
  sourceName?: string | null;
  venue?: string | null;
  publicationYear?: number | string | null;
  canonicalDoi?: string | null;
  sourceUrl?: string | null;
  remotePdfUrl?: string | null;
  isDownloaded?: boolean;
  isScanned?: boolean;
  onSaveOffline?: () => void;
  isSavingOffline?: boolean;
  onOpenExternal?: () => void;
  onClose?: () => void;
  // Navigation & Zoom
  currentPage: number;
  numPages: number;
  pageInput: string;
  setPageInput: (val: string) => void;
  onPageInputSubmit: (e: React.FormEvent) => void;
  goToPage: (page: number) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  fitMode: FitMode;
  setFitMode: (mode: FitMode) => void;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  // Panels & Search
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showRightPanelToggle?: boolean;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PdfToolbar: React.FC<PdfToolbarProps> = ({
  paperTitle,
  sourceName,
  venue,
  publicationYear,
  canonicalDoi,
  sourceUrl,
  remotePdfUrl,
  isDownloaded,
  isScanned,
  onSaveOffline,
  isSavingOffline,
  onOpenExternal,
  onClose,
  currentPage,
  numPages,
  pageInput,
  setPageInput,
  onPageInputSubmit,
  goToPage,
  zoom,
  setZoom,
  fitMode,
  setFitMode,
  setRotation,
  isSidebarOpen,
  setIsSidebarOpen,
  isRightPanelOpen,
  setIsRightPanelOpen,
  showRightPanelToggle = true,
  showSearch,
  setShowSearch,
  isFullscreen,
  setIsFullscreen,
}) => {
  const [copiedDoi, setCopiedDoi] = useState(false);

  const handleCopyDoi = () => {
    if (canonicalDoi) {
      void navigator.clipboard.writeText(canonicalDoi);
      setCopiedDoi(true);
      setTimeout(() => setCopiedDoi(false), 2000);
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 select-none">
      {/* ------------------------------------------------------------------- */}
      {/* Top Header: Title, Metadata, Badges, Primary Actions */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 gap-2.5">
        {/* Left: Document Identity */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
            <FileText className="w-3.5 h-3.5" />
          </div>

          <h2
            className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-xl"
            title={paperTitle}
          >
            {paperTitle}
          </h2>

          {sourceName && <SourceBadge sourceName={sourceName} size="sm" />}

          {(venue || publicationYear) && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden xl:inline-flex items-center gap-1 font-medium">
              <span>•</span>
              {venue && <span>{venue}</span>}
              {publicationYear && <span>({publicationYear})</span>}
            </span>
          )}

          {/* Storage & Stream Badges */}
          {isDownloaded ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
              title="Saved permanently in local SQLite library"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Saved Offline</span>
            </span>
          ) : remotePdfUrl ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-2xs"
              title="Streaming live from academic repository"
            >
              <Cloud className="w-3 h-3 text-sky-500" />
              <span>Remote Stream</span>
            </span>
          ) : null}

          {isScanned && (
            <Badge variant="warning" size="sm">
              Scanned (No OCR)
            </Badge>
          )}
        </div>

        {/* Right: Quick Document Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isDownloaded && onSaveOffline && (
            <button
              type="button"
              onClick={onSaveOffline}
              disabled={isSavingOffline}
              title="Save document offline to local database and library"
              className="h-7 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavingOffline ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>Save Offline</span>
                </>
              )}
            </button>
          )}

          {canonicalDoi && (
            <button
              type="button"
              onClick={handleCopyDoi}
              title={`Copy DOI: ${canonicalDoi}`}
              className="h-7 px-2.5 rounded-lg text-[11px] font-mono font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedDoi ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-sans">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-indigo-500" />
                  <span>DOI</span>
                </>
              )}
            </button>
          )}

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              title="Open publisher article page"
              className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Source Page</span>
            </a>
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
            title={isFullscreen ? "Exit focus reading mode" : "Focus reading mode (Fullscreen)"}
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

      {/* ------------------------------------------------------------------- */}
      {/* Secondary Controls Bar: Page Navigation, Zoom, Search & Panels */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/95 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800/80 gap-2 text-xs overflow-x-auto whitespace-nowrap">
        {/* Left: Sidebar Toggle & Page Navigation */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle Document Outline, Thumbnails & Bookmarks"
            className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-semibold border shadow-2xs transition-colors cursor-pointer ${
              isSidebarOpen
                ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500"
                : "bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Sidebar className="w-3.5 h-3.5" />
            <span className="text-[11px]">Outline & Pages</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Page Navigation Controls */}
          <div className="flex items-center bg-white dark:bg-slate-800/90 rounded-md border border-slate-200/90 dark:border-slate-700/80 p-0.5 shadow-2xs">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              title="Previous page (ArrowLeft or PageUp)"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <form onSubmit={onPageInputSubmit} className="flex items-center px-1 gap-1">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => setPageInput(String(currentPage))}
                aria-label="Current page number"
                className="w-9 h-5 text-center text-xs font-bold rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium select-none">
                / {numPages || 1}
              </span>
            </form>

            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={() => goToPage(currentPage + 1)}
              title="Next page (ArrowRight or PageDown)"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Zoom Presets & Rotation */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-white dark:bg-slate-800/90 rounded-md border border-slate-200/90 dark:border-slate-700/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setFitMode("custom");
                setZoom((z) => Math.max(0.4, z - 0.15));
              }}
              title="Zoom out (-)"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Selector Dropdown */}
            <div className="relative flex items-center border-x border-slate-200/80 dark:border-slate-700/80 mx-0.5">
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
                aria-label="Zoom level"
                className="h-6 pl-2 pr-5 text-[11px] font-semibold rounded bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:outline-hidden appearance-none cursor-pointer transition-colors"
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
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => {
                setFitMode("custom");
                setZoom((z) => Math.min(3.0, z + 0.15));
              }}
              title="Zoom in (+)"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate Clockwise */}
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate clockwise (R)"
            className="h-7 w-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Search Toggle & Right Panel Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            title="Find in document (Ctrl+F)"
            className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-semibold border shadow-2xs transition-colors cursor-pointer ${
              showSearch
                ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500"
                : "bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px]">Find</span>
          </button>

          {showRightPanelToggle && (
            <button
              type="button"
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              title="Toggle Research Assistant, Metadata & Notes Panel"
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold border shadow-2xs transition-colors cursor-pointer ${
                isRightPanelOpen
                  ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500"
                  : "bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {isRightPanelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline text-[11px]">Research Panel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

