import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  importIeeePaper,
  importLocalOaPdf,
  updatePaper,
  extractPdfMetadata,
  getErrorMessage,
} from "../../lib/desktop-api";
import {
  IeeeManualImportInput,
  LocalOaPdfImportInput,
  ImportPdfResult,
  ExtractedPdfMetadata,
} from "../../lib/desktop-api/types";
import { useApp } from "../../context/AppContext";
import {
  ExternalLink,
  Upload,
  FileText,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Link2,
  HardDrive,
  CheckCircle2,
  Loader2,
  Edit3,
} from "lucide-react";

export interface PaperImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "ieee" | "local" | "edit";
  initialPaper?: {
    id?: string;
    paper_id?: string | null;
    title?: string;
    authors?: string[];
    publication_year?: number | null;
    venue?: string | null;
    canonical_doi?: string | null;
    abstract_text?: string | null;
    url?: string;
    local_pdf_path?: string | null;
    license_name?: string | null;
  } | null;
  initialQuery?: string;
  onSuccess?: (paperId: string) => void;
}

export const PaperImportModal: React.FC<PaperImportModalProps> = ({
  isOpen,
  onClose,
  initialMode = "ieee",
  initialPaper,
  initialQuery = "",
  onSuccess,
}) => {
  const { collections, showToast, refreshDatabase } = useApp();

  const [mode, setMode] = useState<"ieee" | "local" | "edit">(initialMode);
  const [filePath, setFilePath] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [venue, setVenue] = useState("");
  const [canonicalDoi, setCanonicalDoi] = useState("");
  const [abstractText, setAbstractText] = useState("");
  const [sourcePageUrl, setSourcePageUrl] = useState("");
  const [licenseName, setLicenseName] = useState("CC-BY 4.0");
  const [licenseUrl, setLicenseUrl] = useState(
    "https://creativecommons.org/licenses/by/4.0/"
  );
  const [sourceName, setSourceName] = useState("IEEE Xplore");
  const [userConfirmedOa, setUserConfirmedOa] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [targetCollectionId, setTargetCollectionId] = useState("");
  const [copyToLibrary, setCopyToLibrary] = useState(false); // Default to Link in Place (Preview Only, No Copy)

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractedPdfMetadata | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when opened or mode / paper changes
  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setErrorMsg(null);
    setExtractionResult(null);

    if (initialPaper) {
      setTitle(initialPaper.title || "");
      setAuthors((initialPaper.authors || []).join(", "));
      setPublicationYear(
        initialPaper.publication_year ? String(initialPaper.publication_year) : ""
      );
      setVenue(
        initialPaper.venue ||
          (initialMode === "ieee" ? "IEEE Xplore" : "Academic Journal")
      );
      setCanonicalDoi(initialPaper.canonical_doi || "");
      setAbstractText(initialPaper.abstract_text || "");
      setSourcePageUrl(
        initialPaper.url ||
          (initialPaper.canonical_doi
            ? `https://doi.org/${initialPaper.canonical_doi}`
            : "")
      );
      setFilePath(initialPaper.local_pdf_path || "");
      setLicenseName(initialPaper.license_name || "CC-BY 4.0");
      setUserConfirmedOa(true);
    } else {
      setTitle("");
      setAuthors("");
      setPublicationYear(new Date().getFullYear().toString());
      setVenue(initialMode === "ieee" ? "IEEE Access" : "Open Access Repository");
      setCanonicalDoi("");
      setAbstractText("");
      setSourcePageUrl(
        initialMode === "ieee"
          ? initialQuery
            ? `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(initialQuery)}`
            : "https://ieeexplore.ieee.org/search/searchresult.jsp?openAccess=true"
          : ""
      );
      setFilePath("");
      setLicenseName("CC-BY 4.0");
      setLicenseUrl("https://creativecommons.org/licenses/by/4.0/");
      setSourceName(
        initialMode === "ieee" ? "IEEE Xplore (Manual OA Import)" : "Local PDF Import"
      );
      setUserConfirmedOa(false);
      setUserNotes("");
      setTargetCollectionId("");
      setCopyToLibrary(false);
    }
  }, [isOpen, initialMode, initialPaper, initialQuery]);

  // Handle opening IEEE in browser
  const handleOpenIeeeBrowser = () => {
    const query = title || initialQuery || "";
    const url = query
      ? `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(query)}&openAccess=true`
      : "https://ieeexplore.ieee.org/search/searchresult.jsp?openAccess=true";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Perform metadata extraction using the Rust/PDF pipeline
  const runExtraction = useCallback(
    async (path: string) => {
      if (!path.trim()) return;
      setIsExtracting(true);
      setErrorMsg(null);
      try {
        const meta = await extractPdfMetadata(path.trim());
        setExtractionResult(meta);

        // Autofill non-empty extracted values
        if (meta.title && (!title || title.trim().length === 0)) {
          setTitle(meta.title);
        }
        if (
          meta.authors &&
          meta.authors.length > 0 &&
          (!authors || authors.trim().length === 0)
        ) {
          setAuthors(meta.authors.join(", "));
        }
        if (meta.publication_year && !publicationYear) {
          setPublicationYear(String(meta.publication_year));
        }
        if (meta.venue && (!venue || venue.trim().length === 0)) {
          setVenue(meta.venue);
        }
        if (meta.doi && (!canonicalDoi || canonicalDoi.trim().length === 0)) {
          setCanonicalDoi(meta.doi);
        }
        if (meta.abstract_text && (!abstractText || abstractText.trim().length === 0)) {
          setAbstractText(meta.abstract_text);
        }
        if (meta.license) {
          setLicenseName(meta.license);
        }

        showToast(
          `Extracted structural metadata: ${meta.page_count} pages, ${meta.word_count} words analyzed.`,
          "info"
        );
      } catch (err: unknown) {
        console.warn("PDF extraction warning:", err);
        setErrorMsg(getErrorMessage(err, "Could not extract metadata from PDF file."));
      } finally {
        setIsExtracting(false);
      }
    },
    [title, authors, publicationYear, venue, canonicalDoi, abstractText, showToast]
  );

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In desktop environments, File object often exposes path property
    const path = (file as unknown as { path?: string }).path || file.name;
    setFilePath(path);
    void runExtraction(path);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const path = (file as unknown as { path?: string }).path || file.name;
      setFilePath(path);
      void runExtraction(path);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode !== "edit" && !filePath.trim()) {
      setErrorMsg("Please specify or select a local PDF file path.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("Please provide a title for the research paper.");
      return;
    }
    if (mode !== "edit" && !userConfirmedOa) {
      setErrorMsg("Please confirm Open Access or permitted academic authorization.");
      return;
    }

    setIsSubmitting(true);
    try {
      const authorList = authors
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      const parsedYear = publicationYear.trim()
        ? parseInt(publicationYear.trim(), 10)
        : undefined;

      let resultPaperId: string | null = null;

      if (mode === "edit" && initialPaper?.paper_id) {
        // Edit existing paper
        const updated = await updatePaper({
          id: initialPaper.paper_id,
          title: title.trim(),
          authors: authorList,
          publication_year: isNaN(Number(parsedYear)) ? undefined : parsedYear,
          venue: venue.trim() || undefined,
          canonical_doi: canonicalDoi.trim() || undefined,
          abstract_text: abstractText.trim() || undefined,
          primary_landing_url: sourcePageUrl.trim() || undefined,
          license_name: licenseName.trim() || undefined,
          license_url: licenseUrl.trim() || undefined,
        });
        resultPaperId = updated.id;
        showToast("Paper metadata successfully updated!", "success");
      } else if (mode === "ieee") {
        const payload: IeeeManualImportInput = {
          file_path: filePath.trim(),
          title: title.trim(),
          authors: authorList,
          publication_year: isNaN(Number(parsedYear)) ? undefined : parsedYear,
          venue: venue.trim() || undefined,
          canonical_doi: canonicalDoi.trim() || undefined,
          abstract_text: abstractText.trim() || undefined,
          source_page_url: sourcePageUrl.trim() || undefined,
          license_name: licenseName.trim() || undefined,
          license_url: licenseUrl.trim() || undefined,
          user_confirmed_oa: userConfirmedOa,
          user_notes: userNotes.trim() || undefined,
          target_collection_id: targetCollectionId || undefined,
          copy_to_library: copyToLibrary,
        };
        const result: ImportPdfResult = await importIeeePaper(payload);
        resultPaperId = result.paper.id;
        showToast(
          result.is_duplicate
            ? "Duplicate PDF recognized via SHA-256. Reusing existing library record."
            : copyToLibrary
              ? "Saved paper and copied PDF to offline library!"
              : "Successfully linked IEEE paper in place (zero copy)!",
          result.is_duplicate ? "info" : "success"
        );
      } else {
        const payload: LocalOaPdfImportInput = {
          file_path: filePath.trim(),
          title: title.trim(),
          authors: authorList,
          publication_year: isNaN(Number(parsedYear)) ? undefined : parsedYear,
          venue: venue.trim() || undefined,
          canonical_doi: canonicalDoi.trim() || undefined,
          abstract_text: abstractText.trim() || undefined,
          source_name: sourceName.trim() || undefined,
          source_page_url: sourcePageUrl.trim() || undefined,
          license_name: licenseName.trim() || undefined,
          license_url: licenseUrl.trim() || undefined,
          user_confirmed_oa: userConfirmedOa,
          user_notes: userNotes.trim() || undefined,
          target_collection_id: targetCollectionId || undefined,
          copy_to_library: copyToLibrary,
        };
        const result: ImportPdfResult = await importLocalOaPdf(payload);
        resultPaperId = result.paper.id;
        showToast(
          result.is_duplicate
            ? "Duplicate PDF recognized via SHA-256."
            : copyToLibrary
              ? "Saved paper and copied PDF to offline library!"
              : "Successfully linked Open Access paper in place (zero copy)!",
          result.is_duplicate ? "info" : "success"
        );
      }

      await refreshDatabase();
      if (resultPaperId && onSuccess) {
        onSuccess(resultPaperId);
      }
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to save paper.");
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "edit"
          ? "Edit Paper Metadata"
          : mode === "ieee"
            ? "Import IEEE Xplore Paper"
            : "Import Open Access PDF"
      }
      description={
        mode === "edit"
          ? "Correct or enrich metadata fields, DOI, venue, and abstract."
          : "Permitted Open-Access workflow: link your downloaded PDF in-place without duplicate copies, or copy to offline library."
      }
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Switcher (if not editing an existing paper) */}
        {initialMode !== "edit" && (
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("ieee")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "ieee"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>IEEE Xplore Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("local")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "local"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Local Open-Access PDF</span>
            </button>
          </div>
        )}

        {/* IEEE Guidance Notice & Browser Handoff */}
        {mode === "ieee" && (
          <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Compliant IEEE Workflow (No API Key Required)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  IEEE Xplore protects search pages with web security challenges. To
                  respect IEEE terms of service and guarantee reliable access, search in
                  your browser, download the Open Access PDF, and link or import it below.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenIeeeBrowser}
                className="shrink-0 text-xs shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open IEEE Xplore
              </Button>
            </div>
          </div>
        )}

        {/* Drag and Drop / File Path Section (not needed in edit mode unless replacing file) */}
        {mode !== "edit" && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Select or Drop Downloaded PDF File *
            </label>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center space-y-2 ${
                isDragOver
                  ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40"
                  : filePath
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-indigo-300">
                {filePath ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {filePath
                    ? filePath.split(/[/\\]/).pop()
                    : "Click to choose PDF or drag & drop file here"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Accepts valid PDF documents (%PDF- header verified)
                </p>
              </div>
            </div>

            {/* Manual Path Input + Auto Extract Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Or enter absolute path: e.g. C:\Downloads\paper.pdf"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!filePath.trim() || isExtracting}
                onClick={() => runExtraction(filePath)}
                className="shrink-0 text-xs"
              >
                {isExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                )}
                {isExtracting ? "Extracting..." : "Auto-Extract Metadata"}
              </Button>
            </div>

            {/* Extraction Diagnostics Strip */}
            {extractionResult && (
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    PDF Extraction Diagnostics:
                  </span>
                  <Badge
                    variant={
                      extractionResult.status === "extracted"
                        ? "success"
                        : extractionResult.is_scanned
                          ? "warning"
                          : "destructive"
                    }
                    size="sm"
                  >
                    {extractionResult.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>
                    Pages: <strong>{extractionResult.page_count}</strong>
                  </span>
                  <span>
                    Words: <strong>{extractionResult.word_count}</strong>
                  </span>
                  {extractionResult.is_scanned && (
                    <span className="text-amber-600 font-semibold">
                      Scanned / Image-Only PDF detected
                    </span>
                  )}
                  {extractionResult.is_encrypted && (
                    <span className="text-rose-600 font-semibold">
                      Encrypted / Password-protected
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Storage Strategy: Link in Place vs Copy into Library */}
        {mode !== "edit" && (
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Storage Mode
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                  !copyToLibrary
                    ? "bg-white dark:bg-slate-700 border-indigo-500 shadow-xs"
                    : "bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="storage_mode"
                  checked={!copyToLibrary}
                  onChange={() => setCopyToLibrary(false)}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Link in Place (Zero Copy)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Reads directly from your existing download path. No extra disk storage
                    used.
                  </p>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                  copyToLibrary
                    ? "bg-white dark:bg-slate-700 border-indigo-500 shadow-xs"
                    : "bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="storage_mode"
                  checked={copyToLibrary}
                  onChange={() => setCopyToLibrary(true)}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Copy to Library (Save Offline)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Copies file to application data storage for permanent offline reading.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Editable Metadata Fields Grid */}
        <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            Paper Metadata (Review & Correct)
          </span>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Paper Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Deep Residual Learning for Image Recognition"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Authors (comma-separated)
              </label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="e.g. Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={publicationYear}
                  onChange={(e) => setPublicationYear(e.target.value)}
                  placeholder="2024"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Venue / Conference
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. IEEE Access / CVPR"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Canonical DOI
                </label>
                <input
                  type="text"
                  value={canonicalDoi}
                  onChange={(e) => setCanonicalDoi(e.target.value)}
                  placeholder="10.1109/ACCESS.2024.1234567"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Abstract
              </label>
              <textarea
                rows={3}
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                placeholder="Abstract text extracted from PDF or copied from official paper page..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Source Article URL
                </label>
                <input
                  type="url"
                  value={sourcePageUrl}
                  onChange={(e) => setSourcePageUrl(e.target.value)}
                  placeholder="https://ieeexplore.ieee.org/document/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  License
                </label>
                <input
                  type="text"
                  value={licenseName}
                  onChange={(e) => setLicenseName(e.target.value)}
                  placeholder="CC-BY 4.0 or Open Access"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Optional Collection assignment & user notes */}
            {collections.length > 0 && mode !== "edit" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Assign to Collection
                </label>
                <select
                  value={targetCollectionId}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  <option value="">None (Library Root)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode !== "edit" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Personal Research Notes
                </label>
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Initial remarks, methodology notes, or relevance..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>
        </div>

        {/* Open Access Confirmation Checkbox */}
        {mode !== "edit" && (
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={userConfirmedOa}
              onChange={(e) => setUserConfirmedOa(e.target.checked)}
              className="mt-0.5 text-emerald-600 rounded"
            />
            <div className="text-xs">
              <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                I confirm this paper is Open Access or authorized for personal academic
                research *
              </span>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                This verification establishes lawful access evidence in your local SQLite
                library records.
              </p>
            </div>
          </label>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="text-xs"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : mode === "edit" ? (
              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
            ) : copyToLibrary ? (
              <HardDrive className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Link2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isSubmitting
              ? "Saving..."
              : mode === "edit"
                ? "Update Metadata"
                : copyToLibrary
                  ? "Save & Copy to Library"
                  : "Link & Preview in Reader"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
