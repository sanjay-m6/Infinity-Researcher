import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  X,
  ShieldAlert,
  FileWarning,
  Ban,
  Upload,
  Globe,
} from "lucide-react";
import { Button } from "../ui/Button";
import { PdfDocumentSkeleton } from "../ui/Skeleton";
import {
  readPaperPdf,
  getReaderState,
  saveReaderState,
  fetchRemotePdfPreview,
  getErrorMessage,
  indexPaperPageTexts,
  PageTextItem,
} from "../../lib/desktop-api";
import { extractedPagesStore } from "../../features/discover/extractedPagesStore";
import {
  PdfViewerState,
  PdfBookmark,
  PdfOutlineItem,
  SearchMatch,
  FitMode,
  EmbeddedPdfViewerProps,
} from "./types";
import { PdfToolbar } from "./PdfToolbar";
import { PdfLeftPanel } from "./PdfLeftPanel";
import { PdfRightPanel } from "./PdfRightPanel";
import { TextSelectionMenu } from "./TextSelectionMenu";

// Configure local Vite-bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type { PdfViewerState, EmbeddedPdfViewerProps };

export const EmbeddedPdfViewer: React.FC<EmbeddedPdfViewerProps> = ({
  paperId,
  paperTitle,
  sourceUrl,
  remotePdfUrl,
  localFilePath,
  targetPage,
  onSaveOffline,
  isSavingOffline,
  onClose,
  onOpenExternal,
  onResolveAgain,
  onRetry,
  onImportLocal,
  sourceName,
  venue,
  publicationYear,
  canonicalDoi,
  isDownloaded,
  authors = [],
  abstractText,
  initialLeftOpen = false,
  initialRightOpen = false,
  initialLeftTab = "outline",
  initialRightTab = "ai",
  hideRightPanel = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  // 12-state finite state machine
  const [viewerState, setViewerState] = useState<PdfViewerState>("IDLE");
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoadingState =
    viewerState === "IDLE" ||
    viewerState === "RESOLVING_SOURCE" ||
    viewerState === "CHECKING_ACCESS" ||
    viewerState === "FETCHING_DOCUMENT" ||
    viewerState === "VALIDATING_DOCUMENT" ||
    viewerState === "PARSING_DOCUMENT" ||
    viewerState === "RENDERING_FIRST_PAGE";

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [fitMode, setFitMode] = useState<FitMode>("width");

  // Panel States
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialLeftOpen);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(initialRightOpen);
  const [activeRightTab, setActiveRightTab] = useState<"ai" | "metadata" | "notes">(
    initialRightTab
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Document Outline (TOC) & Bookmarks
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  const bookmarkStorageKey = `pdf_bookmarks_${paperId || paperTitle}`;
  const [bookmarks, setBookmarks] = useState<PdfBookmark[]>(() => {
    try {
      const saved = localStorage.getItem(bookmarkStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Search in PDF
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);

  // Scanned document detection
  const [isScanned, setIsScanned] = useState(false);

  // Text selection state & floating toolbar
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Cancellation controller for active fetch / render
  const abortControllerRef = useRef<AbortController | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const saveReaderStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Jump to cited page when targetPage changes (e.g. from citation click)
  useEffect(() => {
    if (targetPage && targetPage >= 1 && (!numPages || targetPage <= numPages)) {
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    }
  }, [targetPage, numPages]);

  // -------------------------------------------------------------------------
  // 1. Debounced Reader State Persistence
  // -------------------------------------------------------------------------
  const persistReaderPosition = useCallback(
    (page: number, scale: number, rot: number) => {
      if (!paperId || remotePdfUrl) return;
      if (saveReaderStateTimeoutRef.current) {
        clearTimeout(saveReaderStateTimeoutRef.current);
      }
      saveReaderStateTimeoutRef.current = setTimeout(async () => {
        try {
          await saveReaderState({
            paper_id: paperId,
            file_id: null,
            last_page: page,
            zoom_level: scale,
            rotation: rot,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // non-blocking
        }
      }, 500);
    },
    [paperId, remotePdfUrl]
  );

  // -------------------------------------------------------------------------
  // 2. Document Outline Extraction
  // -------------------------------------------------------------------------
  const loadOutline = useCallback(async (doc: pdfjsLib.PDFDocumentProxy) => {
    try {
      const rawOutline = await doc.getOutline();
      if (!rawOutline || rawOutline.length === 0) {
        setOutline([]);
        return;
      }

      const processItem = async (item: {
        title: string;
        dest?: unknown;
        items?: unknown[];
      }): Promise<PdfOutlineItem> => {
        let pageNum: number | undefined = undefined;
        try {
          let dest = item.dest;
          if (typeof dest === "string") {
            dest = await doc.getDestination(dest);
          }
          if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            const pageIndex = await doc.getPageIndex(pageRef);
            pageNum = pageIndex + 1;
          }
        } catch {
          // Destination resolution failed or invalid ref
        }

        const childItems: PdfOutlineItem[] = [];
        if (item.items && Array.isArray(item.items) && item.items.length > 0) {
          for (const rawChild of item.items) {
            const child = rawChild as {
              title: string;
              dest?: unknown;
              items?: unknown[];
            };
            childItems.push(await processItem(child));
          }
        }

        return {
          title: item.title || "Untitled Section",
          pageNumber: pageNum,
          dest: item.dest,
          items: childItems.length > 0 ? childItems : undefined,
        };
      };

      const parsed: PdfOutlineItem[] = [];
      for (const item of rawOutline) {
        parsed.push(await processItem(item));
      }
      setOutline(parsed);
    } catch (err) {
      console.warn("Failed to load PDF outline:", err);
      setOutline([]);
    }
  }, []);

  // -------------------------------------------------------------------------
  // 2b. Full Document Text Extraction & Background RAG Indexing for All Pages
  // -------------------------------------------------------------------------
  const extractAndIndexFullText = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, targetPaperId?: string | null) => {
      const effectiveId = targetPaperId || paperId;
      if (!effectiveId) return;

      // Check if we already extracted pages for this paper ID
      if (extractedPagesStore.has(effectiveId)) {
        return;
      }

      // If we have extracted pages under DOI, re-use and index directly
      if (canonicalDoi && extractedPagesStore.has(canonicalDoi)) {
        const cached = extractedPagesStore.get(canonicalDoi);
        if (cached && cached.length > 0) {
          extractedPagesStore.set(effectiveId, cached);
          try {
            const count = await indexPaperPageTexts(
              effectiveId,
              cached,
              paperTitle,
              canonicalDoi || undefined
            );
            window.dispatchEvent(
              new CustomEvent("paper-indexed", {
                detail: {
                  paperId: effectiveId,
                  canonicalDoi,
                  chunkCount: count,
                  pageCount: cached.length,
                },
              })
            );
          } catch (e) {
            console.warn("Failed to index cached pages:", e);
          }
          return;
        }
      }

      try {
        const pages: PageTextItem[] = [];
        const total = doc.numPages;

        for (let p = 1; p <= total; p++) {
          const page = await doc.getPage(p);
          const textContent = await page.getTextContent();

          let pageText = "";
          let lastY: number | null = null;

          for (const rawItem of textContent.items) {
            const item = rawItem as {
              str?: string;
              transform?: number[];
              hasEOL?: boolean;
            };
            if (!item.str) continue;

            if (
              lastY !== null &&
              item.transform &&
              Math.abs(item.transform[5] - lastY) > 5
            ) {
              pageText += "\n";
            } else if (
              pageText.length > 0 &&
              !pageText.endsWith(" ") &&
              !pageText.endsWith("\n")
            ) {
              pageText += " ";
            }
            pageText += item.str;
            if (item.hasEOL) {
              pageText += "\n";
            }
            if (item.transform) {
              lastY = item.transform[5];
            }
          }

          const trimmed = pageText.trim();
          if (trimmed.length > 0) {
            let heading: string | undefined = undefined;
            const outlineMatch = outline.find((o) => o.pageNumber === p);
            if (outlineMatch) {
              heading = outlineMatch.title;
            } else {
              const firstLine = trimmed.split("\n")[0]?.trim();
              if (firstLine && firstLine.length > 3 && firstLine.length < 80) {
                heading = firstLine;
              }
            }

            pages.push({
              page_number: p,
              text: trimmed,
              section_heading: heading || null,
            });
          }
        }

        if (pages.length > 0) {
          extractedPagesStore.set(effectiveId, pages);
          if (canonicalDoi) {
            extractedPagesStore.set(canonicalDoi, pages);
          }

          const count = await indexPaperPageTexts(
            effectiveId,
            pages,
            paperTitle,
            canonicalDoi || undefined
          );

          window.dispatchEvent(
            new CustomEvent("paper-indexed", {
              detail: {
                paperId: effectiveId,
                canonicalDoi,
                chunkCount: count,
                pageCount: total,
              },
            })
          );
        }
      } catch (err) {
        console.warn("Background PDF text extraction/indexing error:", err);
      }
    },
    [paperId, paperTitle, canonicalDoi, outline]
  );

  // -------------------------------------------------------------------------
  // 3. Lifecycle: Load Document with Explicit 12-State Finite State Machine & 10s Timeout
  // -------------------------------------------------------------------------
  const loadPdf = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setErrorMessage(null);
    setPdfDoc(null);
    setSearchMatches([]);
    setActiveMatchIndex(-1);

    try {
      // Stage 1: RESOLVING_SOURCE
      setViewerState("RESOLVING_SOURCE");
      setStatusMessage("Resolving document source and access permissions...");

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
          // non-blocking
        }
      }

      if (abortController.signal.aborted) return;

      // Stage 2: CHECKING_ACCESS
      setViewerState("CHECKING_ACCESS");
      setStatusMessage("Verifying access permissions and publisher endpoints...");

      // Stage 3: FETCHING_DOCUMENT (with 10-second timeout race)
      setViewerState("FETCHING_DOCUMENT");
      setStatusMessage(
        remotePdfUrl
          ? "Streaming PDF document from scholarly repository..."
          : "Loading document from local storage..."
      );

      const STREAM_TIMEOUT_MS = 25000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              "STREAM_TIMEOUT: Request took longer than 25 seconds. The academic publisher may require interactive authentication, bot verification, or an institutional network."
            )
          );
        }, STREAM_TIMEOUT_MS);
      });

      const fetchPromise = (async (): Promise<ArrayBuffer> => {
        if (remotePdfUrl) {
          return await fetchRemotePdfPreview(remotePdfUrl, canonicalDoi, paperTitle);
        } else if (paperId) {
          return await readPaperPdf(paperId);
        } else if (localFilePath) {
          return await readPaperPdf(localFilePath);
        } else {
          throw new Error("No PDF source or document identifier provided.");
        }
      })();

      let rawBuffer: ArrayBuffer;
      try {
        rawBuffer = await Promise.race([fetchPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (abortController.signal.aborted) {
        setViewerState("CANCELLED");
        return;
      }

      // Stage 4: VALIDATING_DOCUMENT
      setViewerState("VALIDATING_DOCUMENT");
      setStatusMessage("Verifying document signature and integrity...");

      const uint8Bytes = new Uint8Array(rawBuffer);
      if (uint8Bytes.length < 5) {
        throw new Error("INVALID_PAYLOAD: The received document is empty or corrupted.");
      }

      // Check %PDF- signature
      const headerStr = String.fromCharCode(...uint8Bytes.slice(0, 5));
      if (!headerStr.startsWith("%PDF-")) {
        // Inspect if it looks like an HTML error page
        const sampleStr = new TextDecoder()
          .decode(uint8Bytes.slice(0, 300))
          .toLowerCase();
        if (
          sampleStr.includes("<!doctype html") ||
          sampleStr.includes("<html") ||
          sampleStr.includes("<body")
        ) {
          throw new Error(
            "HTML_REDIRECT: The remote server returned an interactive HTML web page or login barrier instead of raw PDF bytes."
          );
        }
        throw new Error(
          "INVALID_SIGNATURE: Document does not contain a valid %PDF- binary header."
        );
      }

      // Stage 5: PARSING_DOCUMENT
      setViewerState("PARSING_DOCUMENT");
      setStatusMessage("Parsing document structure and page catalog...");

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Bytes,
      });

      const doc = await loadingTask.promise;
      if (abortController.signal.aborted) {
        doc.cleanup();
        loadingTask.destroy();
        setViewerState("CANCELLED");
        return;
      }

      // Load Document Outline (TOC) asynchronously
      void loadOutline(doc);

      // Stage 6: RENDERING_FIRST_PAGE
      setViewerState("RENDERING_FIRST_PAGE");
      setStatusMessage("Rendering page canvas...");

      const validPage = Math.min(initialPage, doc.numPages);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(validPage);
      setPageInput(String(validPage));
      setZoom(initialZoom);
      setRotation(initialRotation);

      // Stage 7: READY
      setViewerState("READY");
      setStatusMessage("Document ready.");

      // Background extract and index all pages for grounded AI assistant
      void extractAndIndexFullText(doc, paperId);
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        setViewerState("CANCELLED");
        return;
      }

      const rawMsg = getErrorMessage(
        err,
        remotePdfUrl
          ? "Could not stream remote PDF."
          : "Could not open local PDF document."
      );

      const lower = rawMsg.toLowerCase();
      if (
        lower.includes("ieee_access_restricted") ||
        lower.includes("403") ||
        lower.includes("forbidden") ||
        lower.includes("security challenge") ||
        lower.includes("paywall") ||
        lower.includes("subscription") ||
        lower.includes("bot protection")
      ) {
        setViewerState("ACCESS_RESTRICTED");
        setErrorMessage(
          "Access Restricted: This academic publisher protects full text documents with subscription paywalls, security challenges, or session tokens. Automated in-app streaming is restricted."
        );
      } else if (
        lower.includes("html_redirect") ||
        lower.includes("invalid_signature") ||
        lower.includes("invalid_payload") ||
        lower.includes("not_a_pdf")
      ) {
        setViewerState("INVALID_DOCUMENT");
        setErrorMessage(
          "Invalid Document: The remote server returned an interactive web page or non-PDF binary rather than raw PDF document bytes."
        );
      } else if (
        lower.includes("stream_timeout") ||
        lower.includes("timeout") ||
        lower.includes("network_error")
      ) {
        setViewerState("RETRYABLE_ERROR");
        setErrorMessage(
          "Retrieval Timed Out: Remote streaming exceeded the 10-second limit. The publisher network may be throttling or experiencing high latency."
        );
      } else {
        setViewerState("RETRYABLE_ERROR");
        setErrorMessage(rawMsg);
      }
    }
  }, [paperId, remotePdfUrl, localFilePath, canonicalDoi, paperTitle, loadOutline]);

  useEffect(() => {
    void loadPdf();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      if (saveReaderStateTimeoutRef.current) {
        clearTimeout(saveReaderStateTimeoutRef.current);
      }
    };
  }, [loadPdf]);

  useEffect(() => {
    if (pdfDoc && paperId) {
      void extractAndIndexFullText(pdfDoc, paperId);
    }
  }, [pdfDoc, paperId, extractAndIndexFullText]);

  const handleCancelLoading = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setViewerState("CANCELLED");
  }, []);

  // Allow pressing Escape to cancel loading
  useEffect(() => {
    if (!isLoadingState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelLoading();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoadingState, handleCancelLoading]);

  // -------------------------------------------------------------------------
  // 4. Render Page Canvas & Text Layer
  // -------------------------------------------------------------------------
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      if (!containerRef.current || !canvasRef.current) return;
      const container = containerRef.current;
      const containerWidth = Math.max((container.clientWidth || 800) - 48, 100);
      const containerHeight = Math.max((container.clientHeight || 1000) - 48, 100);
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });

      let effectiveScale = zoom;
      if (fitMode === "width") {
        effectiveScale = containerWidth / unscaledViewport.width;
      } else if (fitMode === "page") {
        effectiveScale = Math.min(
          containerWidth / unscaledViewport.width,
          containerHeight / unscaledViewport.height
        );
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
          const tx = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform || [1, 0, 0, 1, 0, 0]
          );
          textSpan.style.left = `${tx[4]}px`;
          textSpan.style.top = `${tx[5] - (item.height || 10) * effectiveScale}px`;
          textSpan.style.fontSize = `${(item.height || 12) * effectiveScale}px`;
          textLayerRef.current.appendChild(textSpan);
        }
      }

      // Debounced reader state persistence
      persistReaderPosition(currentPage, effectiveScale, rotation);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "RenderingCancelledException") {
        console.error("PDF page render error:", err);
      }
    }
  }, [pdfDoc, currentPage, zoom, rotation, fitMode, persistReaderPosition]);

  useEffect(() => {
    if (viewerState === "READY") {
      void renderCurrentPage();
    }
  }, [viewerState, renderCurrentPage]);

  // Responsive ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfDoc) return;

    let rAFId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (fitMode === "width" || fitMode === "page") {
        if (rAFId) cancelAnimationFrame(rAFId);
        rAFId = requestAnimationFrame(() => {
          void renderCurrentPage();
        });
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rAFId) cancelAnimationFrame(rAFId);
    };
  }, [pdfDoc, fitMode, renderCurrentPage]);

  // -------------------------------------------------------------------------
  // 5. Page Navigation & Controls
  // -------------------------------------------------------------------------
  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > numPages) return;
      setCurrentPage(page);
      setPageInput(String(page));
    },
    [numPages]
  );

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
  // 6. Bookmarks Management
  // -------------------------------------------------------------------------
  const handleAddBookmark = (page: number, label?: string) => {
    const newBm: PdfBookmark = {
      id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      paperId: paperId || "transient",
      pageNumber: page,
      label: label || `Page ${page}`,
      createdAt: new Date().toISOString(),
    };
    setBookmarks((prev) => {
      const next = [newBm, ...prev];
      try {
        localStorage.setItem(bookmarkStorageKey, JSON.stringify(next));
      } catch {
        // non-blocking
      }
      return next;
    });
  };

  const handleRemoveBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      try {
        localStorage.setItem(bookmarkStorageKey, JSON.stringify(next));
      } catch {
        // non-blocking
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // 7. In-Document Text Search
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
    const prevIdx = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prevIdx);
    goToPage(searchMatches[prevIdx].pageNumber);
  };

  // -------------------------------------------------------------------------
  // 8. Text Selection & Floating Research Actions
  // -------------------------------------------------------------------------
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || text.length === 0 || !containerRef.current) {
      setSelectionPosition(null);
      return;
    }

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      if (
        rect.bottom >= containerRect.top &&
        rect.top <= containerRect.bottom &&
        rect.right >= containerRect.left &&
        rect.left <= containerRect.right
      ) {
        setSelectedText(text);
        setSelectionPosition({
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top - containerRect.top,
        });
        return;
      }
    }
    setSelectionPosition(null);
  };

  const handleMenuAskAi = (text: string) => {
    setSelectedText(text);
    setIsRightPanelOpen(true);
    setActiveRightTab("ai");
    setSelectionPosition(null);
  };

  const handleMenuSaveNote = (text: string) => {
    setSelectedText(text);
    setIsRightPanelOpen(true);
    setActiveRightTab("notes");
    setSelectionPosition(null);
  };

  const handleMenuSearchInDoc = (text: string) => {
    setSearchQuery(text);
    setShowSearch(true);
    void performSearch(text);
    setSelectionPosition(null);
  };

  const handleMenuCopyText = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const handleMenuCopyCitation = (text: string) => {
    const leadAuthor = authors.length > 0 ? authors[0].split(" ").pop() : "Author";
    const citation = `"${text}" (${leadAuthor}, ${publicationYear || "n.d."}, p. ${currentPage})`;
    void navigator.clipboard.writeText(citation);
  };

  // -------------------------------------------------------------------------
  // 9. Keyboard Shortcuts
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (selectionPosition) {
          setSelectionPosition(null);
        } else if (showSearch) {
          setShowSearch(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, numPages, showSearch, isFullscreen, selectionPosition, goToPage]);

  return (
    <div
      data-testid="pdf-reader-workspace"
      className={`flex flex-col bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 w-full ${
        isFullscreen
          ? "fixed inset-0 z-[120] rounded-none border-none"
          : "relative h-full min-h-[580px]"
      }`}
    >
      {/* --------------------------------------------------------------------- */}
      {/* 1. Modern Unified PDF Workspace Toolbar */}
      {/* --------------------------------------------------------------------- */}
      <PdfToolbar
        paperTitle={paperTitle}
        sourceName={sourceName}
        venue={venue}
        publicationYear={publicationYear}
        canonicalDoi={canonicalDoi}
        sourceUrl={sourceUrl}
        remotePdfUrl={remotePdfUrl}
        isDownloaded={isDownloaded}
        isScanned={isScanned}
        onSaveOffline={onSaveOffline}
        isSavingOffline={isSavingOffline}
        onOpenExternal={onOpenExternal}
        onClose={onClose}
        currentPage={currentPage}
        numPages={numPages}
        pageInput={pageInput}
        setPageInput={setPageInput}
        onPageInputSubmit={handlePageInputSubmit}
        goToPage={goToPage}
        zoom={zoom}
        setZoom={setZoom}
        fitMode={fitMode}
        setFitMode={setFitMode}
        setRotation={setRotation}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isRightPanelOpen={isRightPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        showRightPanelToggle={!hideRightPanel}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
      />

      {/* --------------------------------------------------------------------- */}
      {/* 2. In-Document Text Search Sub-Panel */}
      {/* --------------------------------------------------------------------- */}
      {showSearch && viewerState === "READY" && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-indigo-50/90 dark:bg-indigo-950/60 border-b border-indigo-200 dark:border-indigo-900 gap-2 text-xs shrink-0 select-none">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="Find text in document..."
              value={searchQuery}
              autoFocus
              onChange={(e) => {
                setSearchQuery(e.target.value);
                void performSearch(e.target.value);
              }}
              className="flex-1 h-7 px-2.5 text-xs rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {isSearching ? (
              <span className="text-xs text-slate-500">Searching...</span>
            ) : searchMatches.length > 0 ? (
              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 shrink-0">
                {activeMatchIndex + 1} of {searchMatches.length}
              </span>
            ) : searchQuery.trim() ? (
              <span className="text-xs text-slate-500 shrink-0">No matches</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={prevMatch}
              title="Previous match"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={nextMatch}
              title="Next match"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              title="Close search"
              className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. BODY: Explicit FSM Lifecycle vs Three-Panel Reading Workspace */}
      {/* --------------------------------------------------------------------- */}
      {isLoadingState ? (
        /* Clean Academic Paper Skeleton Loader */
        <div
          className="flex-1 w-full h-full flex flex-col relative"
          title={statusMessage}
          aria-busy="true"
        >
          <PdfDocumentSkeleton />
        </div>
      ) : viewerState === "ACCESS_RESTRICTED" ? (
        /* ACCESS RESTRICTED (Publisher Paywall / Anti-Bot) */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span>Publisher Access Restricted</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Document Requires Browser Access
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left p-3 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20">
              {errorMessage ||
                "This document is protected by publisher access controls (e.g. IEEE Xplore subscription, Cloudflare bot challenges, or institutional login). In compliance with academic access policies, open the paper directly on the publisher site, then import or link your downloaded copy."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
            {(sourceUrl || remotePdfUrl) && (
              <a
                href={sourceUrl || remotePdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Official Article Page</span>
              </a>
            )}

            {onImportLocal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportLocal}
                className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>Import Downloaded PDF</span>
              </Button>
            )}

            {onResolveAgain && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResolveAgain}
                className="text-xs"
              >
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                <span>Resolve OA Mirrors</span>
              </Button>
            )}

            {canonicalDoi && (
              <a
                href={`https://doi.org/${canonicalDoi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors font-mono"
              >
                <ExternalLink className="w-3 h-3 text-slate-400" />
                <span>Open via DOI</span>
              </a>
            )}

            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadPdf()}
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                <span>Retry</span>
              </Button>
            )}
          </div>
        </div>
      ) : viewerState === "INVALID_DOCUMENT" ? (
        /* INVALID DOCUMENT (Non-PDF or HTML Error Page) */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-800 shadow-sm">
            <FileWarning className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <span>Non-PDF Response</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Web Landing Page Received Instead of PDF
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left p-3 rounded-xl bg-rose-500/10 dark:bg-rose-400/10 border border-rose-500/20">
              {errorMessage ||
                "The server returned an HTML error page or an interactive download landing page rather than raw PDF binary bytes."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
            {(sourceUrl || remotePdfUrl) && (
              <a
                href={sourceUrl || remotePdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Source Webpage</span>
              </a>
            )}

            {onImportLocal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportLocal}
                className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>Import Downloaded PDF</span>
              </Button>
            )}

            {onResolveAgain && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResolveAgain}
                className="text-xs"
              >
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                <span>Re-resolve Candidates</span>
              </Button>
            )}
          </div>
        </div>
      ) : viewerState === "CANCELLED" ? (
        /* CANCELLED */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Ban className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Retrieval Cancelled
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You cancelled the streaming download. Click below to restart retrieval.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void loadPdf()}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Restart Retrieval</span>
          </Button>
        </div>
      ) : viewerState === "RETRYABLE_ERROR" ? (
        /* RETRYABLE ERROR (Network / Timeout) */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span>Network Stream Interrupted</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Could Not Complete PDF Stream
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left p-3 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20">
              {errorMessage ||
                "The connection timed out or was interrupted by the remote server."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void loadPdf()}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry Streaming</span>
            </Button>

            {(sourceUrl || remotePdfUrl) && (
              <a
                href={sourceUrl || remotePdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Browser</span>
              </a>
            )}

            {onImportLocal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportLocal}
                className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>Import Local File</span>
              </Button>
            )}

            {onResolveAgain && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResolveAgain}
                className="text-xs"
              >
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                <span>Re-resolve Sources</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------------- */
        /* READY STATE: Multi-Panel Research Workspace                         */
        /* ------------------------------------------------------------------- */
        <div className="flex flex-1 overflow-hidden relative min-h-0">
          {/* Left Panel: Outline (TOC), Thumbnails & Bookmarks */}
          {isSidebarOpen && (
            <PdfLeftPanel
              outline={outline}
              numPages={numPages}
              currentPage={currentPage}
              goToPage={goToPage}
              bookmarks={bookmarks}
              onAddBookmark={handleAddBookmark}
              onRemoveBookmark={handleRemoveBookmark}
              initialTab={initialLeftTab}
            />
          )}

          {/* Center: Canvas Viewport & Text Selection Layer */}
          <div
            ref={containerRef}
            onMouseUp={handleMouseUp}
            className="flex-1 overflow-auto p-6 flex justify-center items-start bg-slate-200/60 dark:bg-slate-950 min-w-0 relative select-none"
          >
            <div className="relative shadow-xl rounded bg-white dark:bg-slate-900 overflow-hidden">
              <canvas ref={canvasRef} className="block select-none" />
              {/* Selectable transparent text layer */}
              <div
                ref={textLayerRef}
                className="absolute inset-0 pointer-events-none select-text overflow-hidden"
                style={{ userSelect: "text" }}
              />
            </div>

            {/* Floating Text Selection Research Actions */}
            <TextSelectionMenu
              selectedText={selectedText}
              position={selectionPosition}
              currentPage={currentPage}
              onAskAi={handleMenuAskAi}
              onSaveNote={handleMenuSaveNote}
              onSearchInDoc={handleMenuSearchInDoc}
              onCopyText={handleMenuCopyText}
              onCopyCitation={handleMenuCopyCitation}
              onClose={() => setSelectionPosition(null)}
            />
          </div>

          {/* Right Panel: AI Copilot, Metadata/Citations & SQLite Notes */}
          {!hideRightPanel && isRightPanelOpen && (
            <PdfRightPanel
              paperId={paperId}
              paperTitle={paperTitle}
              authors={authors}
              venue={venue}
              publicationYear={publicationYear}
              canonicalDoi={canonicalDoi}
              abstractText={abstractText}
              currentPage={currentPage}
              numPages={numPages}
              selectedText={selectedText}
              onNavigatePdfPage={goToPage}
              initialTab={activeRightTab}
              onClose={() => setIsRightPanelOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
