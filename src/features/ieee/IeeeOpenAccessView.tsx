import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  importIeeePaper,
  importLocalOaPdf,
  getOpenAccessStats,
  listOpenAccessPapers,
  extractPdfMetadata,
  getErrorMessage,
} from "../../lib/desktop-api";
import {
  IeeeManualImportInput,
  LocalOaPdfImportInput,
  OpenAccessStats,
  ImportPdfResult,
} from "../../lib/desktop-api/types";
import { dbPaperToPaper } from "../../lib/desktop-api/adapters";
import { Paper } from "../../types/domain";
import {
  ShieldCheck,
  BookOpen,
  Download,
  ExternalLink,
  Plus,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Clock,
  Eye,
  Loader2,
  Link2,
  HardDrive,
} from "lucide-react";

export const IeeeOpenAccessView: React.FC = () => {
  const { collections, setReadingPaper, setSelectedPaperId, showToast, refreshDatabase } = useApp();

  // Statistics state
  const [stats, setStats] = useState<OpenAccessStats>({
    total_oa_papers: 0,
    ieee_imported_papers: 0,
    permitted_downloads: 0,
    pending_verification_count: 0,
    missing_or_corrupt_count: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Papers state
  const [oaPapers, setOaPapers] = useState<Paper[]>([]);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "ieee" | "permitted">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"ieee" | "local">("ieee");
  const [filePath, setFilePath] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [venue, setVenue] = useState("");
  const [canonicalDoi, setCanonicalDoi] = useState("");
  const [abstractText, setAbstractText] = useState("");
  const [sourcePageUrl, setSourcePageUrl] = useState("");
  const [licenseName, setLicenseName] = useState("CC-BY 4.0");
  const [licenseUrl, setLicenseUrl] = useState("https://creativecommons.org/licenses/by/4.0/");
  const [sourceName, setSourceName] = useState("Local File");
  const [userConfirmedOa, setUserConfirmedOa] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [targetCollectionId, setTargetCollectionId] = useState("");
  const [copyToLibrary, setCopyToLibrary] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<ImportPdfResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Load stats and papers
  const loadData = useCallback(async () => {
    setIsLoadingStats(true);
    setIsLoadingPapers(true);
    try {
      const liveStats = await getOpenAccessStats();
      setStats(liveStats);

      const rawPapers = await listOpenAccessPapers();
      const mapped = rawPapers.map((p) => dbPaperToPaper(p));
      setOaPapers(mapped);
    } catch (err: unknown) {
      console.warn("Could not load live Open Access data, using fallback:", err);
    } finally {
      setIsLoadingStats(false);
      setIsLoadingPapers(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenIeeeXplore = () => {
    const url = "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=&openAccess=true";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenModal = (mode: "ieee" | "local") => {
    setImportMode(mode);
    setFilePath("");
    setTitle("");
    setAuthors("");
    setPublicationYear(new Date().getFullYear().toString());
    setVenue(mode === "ieee" ? "IEEE Access" : "Open Access Repository");
    setCanonicalDoi("");
    setAbstractText("");
    setSourcePageUrl(mode === "ieee" ? "https://ieeexplore.ieee.org/document/" : "");
    setLicenseName("CC-BY 4.0");
    setLicenseUrl("https://creativecommons.org/licenses/by/4.0/");
    setSourceName(mode === "ieee" ? "IEEE Xplore (Manual OA Import)" : "Local PDF Import");
    setUserConfirmedOa(false);
    setUserNotes("");
    setTargetCollectionId("");
    setCopyToLibrary(false);
    setImportResult(null);
    setImportError(null);
    setIsImportModalOpen(true);
  };

  const handleAutoExtract = async () => {
    if (!filePath.trim()) {
      setImportError("Please specify a local PDF file path before extracting.");
      return;
    }
    setIsExtracting(true);
    setImportError(null);
    try {
      const meta = await extractPdfMetadata(filePath.trim());
      if (meta.title && !title) setTitle(meta.title);
      if (meta.authors && meta.authors.length > 0 && !authors) setAuthors(meta.authors.join(", "));
      if (meta.publication_year && !publicationYear) setPublicationYear(String(meta.publication_year));
      if (meta.venue && !venue) setVenue(meta.venue);
      if (meta.doi && !canonicalDoi) setCanonicalDoi(meta.doi);
      if (meta.abstract_text && !abstractText) setAbstractText(meta.abstract_text);
      if (meta.license) setLicenseName(meta.license);
      showToast(`Analyzed ${meta.page_count} pages (${meta.word_count} words)`, "info");
    } catch (err: unknown) {
      setImportError(getErrorMessage(err, "Failed to extract metadata from PDF."));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);

    if (!filePath.trim()) {
      setImportError("Please enter or specify the local path to the downloaded PDF file.");
      return;
    }
    if (!title.trim()) {
      setImportError("Please enter the title of the research paper.");
      return;
    }
    if (!userConfirmedOa) {
      setImportError("You must confirm that this paper is marked as Open Access before importing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const authorList = authors
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      const parsedYear = publicationYear.trim() ? parseInt(publicationYear.trim(), 10) : undefined;

      if (importMode === "ieee") {
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
        const result = await importIeeePaper(payload);
        setImportResult(result);
        showToast(
          result.is_duplicate
            ? "Duplicate PDF detected via SHA-256 match. Reusing existing library record."
            : copyToLibrary
            ? "Successfully imported IEEE Open Access paper and copied to library storage!"
            : "Successfully linked IEEE Open Access paper in place (zero copy)!",
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
        const result = await importLocalOaPdf(payload);
        setImportResult(result);
        showToast(
          result.is_duplicate
            ? "Duplicate PDF detected via SHA-256 match."
            : copyToLibrary
            ? "Successfully imported Open Access PDF and copied to library storage!"
            : "Successfully linked Open Access paper in place (zero copy)!",
          result.is_duplicate ? "info" : "success"
        );
      }

      await refreshDatabase();
      await loadData();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to import paper.");
      setImportError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReadPdf = (paper: Paper) => {
    setReadingPaper({
      id: paper.id,
      title: paper.title,
      sourceUrl: paper.landingUrl,
    });
  };

  // Filter papers
  const filteredPapers = useMemo(() => {
    return oaPapers.filter((p) => {
      // Tab filter
      if (selectedFilter === "ieee" && p.retrievalMethod !== "ieee_manual_download_import") {
        return false;
      }
      if (selectedFilter === "permitted" && p.retrievalMethod !== "permitted_html_connector") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesAuthor = p.authors.some((a) => a.toLowerCase().includes(q));
        const matchesDoi = p.doi ? p.doi.toLowerCase().includes(q) : false;
        const matchesVenue = p.venue.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAuthor && !matchesDoi && !matchesVenue) {
          return false;
        }
      }

      return true;
    });
  }, [oaPapers, selectedFilter, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="IEEE Open Access Hub"
        description="Official terms-compliant discovery and manual import workflow for IEEE Open Access research papers."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="success" size="sm">
              Mode A • Terms Compliant
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenIeeeXplore}
              className="border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <ExternalLink className="w-4 h-4 mr-2 text-sky-600 dark:text-sky-400" />
              Open IEEE Xplore
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenModal("local")}
            >
              <FileCheck2 className="w-4 h-4 mr-2" />
              Import Local PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenModal("ieee")}
              className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Import IEEE PDF
            </Button>
          </div>
        }
      />

      {/* Real Open Access Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total OA */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/40 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Total Open Access
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {isLoadingStats ? "..." : stats.total_oa_papers}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Confirmed Open Access records
          </p>
        </div>

        {/* IEEE Imports */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900 border border-sky-200/80 dark:border-sky-800/40 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              IEEE Imported Papers
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {isLoadingStats ? "..." : stats.ieee_imported_papers}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            User-confirmed IEEE Xplore imports
          </p>
        </div>

        {/* Permitted Downloads */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Permitted downloads
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Download className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {isLoadingStats ? "..." : stats.permitted_downloads}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Permitted source connector files
          </p>
        </div>

        {/* Pending Verification */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Pending verification
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {isLoadingStats ? "..." : stats.pending_verification_count}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Awaiting license confirmation
          </p>
        </div>
      </div>

      {/* 4-Step Workflow Walkthrough Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              How the IEEE Open Access Workflow Works
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              IEEE Xplore terms prohibit automated robots or AI scraping. Our Mode A workflow ensures 100% legal compliance and reliable reading.
            </p>
          </div>
          <Badge variant="default" size="sm">
            4-Step Controlled Pipeline
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 relative flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-sm mb-3">
                1
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                Find IEEE Paper
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Open IEEE Xplore in your browser and search manually. Tick the <strong>Open Access</strong> checkbox in search filters.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenIeeeXplore}
              className="w-full text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open Xplore
            </Button>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 relative flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm mb-3">
                2
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                Confirm Open Access
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Ensure the article displays an explicit <strong>Open Access</strong> banner and note its Creative Commons license terms.
              </p>
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified License
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 relative flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm mb-3">
                3
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                Download Official PDF
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Click the official <strong>PDF</strong> button in your browser to save the file to your Downloads or Documents folder.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 pt-2">
              <Download className="w-3.5 h-3.5" />
              Manual Download
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 relative flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm mb-3">
                4
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                Import & Read in App
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Import the local PDF into your workspace. The system validates the header, verifies SHA-256 hash, and launches the embedded viewer.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenModal("ieee")}
              className="w-full text-xs bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Import Now
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={selectedFilter === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("all")}
          >
            All OA Papers ({oaPapers.length})
          </Button>
          <Button
            variant={selectedFilter === "ieee" ? "primary" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("ieee")}
          >
            IEEE Imports ({stats.ieee_imported_papers})
          </Button>
          <Button
            variant={selectedFilter === "permitted" ? "primary" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("permitted")}
          >
            Permitted Downloads ({stats.permitted_downloads})
          </Button>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search Open Access papers..."
          />
        </div>
      </div>

      {/* Open Access Papers Grid */}
      {isLoadingPapers ? (
        <div className="p-12 text-center text-slate-500">
          Loading Open Access papers...
        </div>
      ) : filteredPapers.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-12 h-12 text-sky-500" />}
          title="No Open Access Papers Found"
          description={
            searchQuery
              ? "No papers match your search query."
              : "Import your first IEEE Open Access research paper using the Mode A manual discovery workflow."
          }
          actionLabel="Import Downloaded IEEE PDF"
          onAction={() => handleOpenModal("ieee")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPapers.map((paper) => (
            <div
              key={paper.id}
              className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Badge
                    variant={
                      paper.retrievalMethod === "ieee_manual_download_import"
                        ? "info"
                        : "success"
                    }
                    size="sm"
                  >
                    {paper.retrievalMethod === "ieee_manual_download_import"
                      ? "IEEE Xplore OA"
                      : "Verified OA"}
                  </Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {paper.year}
                  </span>
                </div>

                {/* Title */}
                <h3
                  onClick={() => setSelectedPaperId(paper.id)}
                  className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer text-sm mb-1.5"
                  title={paper.title}
                >
                  {paper.title}
                </h3>

                {/* Authors */}
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mb-2">
                  {paper.authors.join(", ")}
                </p>

                {/* Venue & DOI */}
                <div className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1 mb-3">
                  <span>{paper.venue}</span>
                  {paper.doi && (
                    <span className="ml-2 text-sky-600 dark:text-sky-400 font-mono">
                      doi:{paper.doi}
                    </span>
                  )}
                </div>

                {/* Provenance badge */}
                {paper.accessEvidenceType && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Evidence: {paper.accessEvidenceType.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleReadPdf(paper)}
                  className="bg-sky-600 hover:bg-sky-700 text-white flex-1"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  Read PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPaperId(paper.id)}
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {paper.landingUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(paper.landingUrl, "_blank", "noopener,noreferrer")}
                    title="Open Source Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={
          importMode === "ieee"
            ? "Import Downloaded IEEE Open Access PDF"
            : "Import Local Open Access PDF"
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitImport} className="space-y-4">
          {importError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {importResult.is_duplicate ? "Duplicate PDF Matched" : "PDF Successfully Imported"}
              </div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                SHA-256: {importResult.content_hash}
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    handleReadPdf(dbPaperToPaper(importResult.paper));
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  Read PDF in Embedded Viewer
                </Button>
              </div>
            </div>
          )}

          {/* Local File Path & Auto Extract */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Local PDF File Path <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="C:\Users\username\Downloads\ieee_paper.pdf"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!filePath.trim() || isExtracting}
                onClick={handleAutoExtract}
                className="shrink-0 text-xs"
              >
                {isExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <FileSearch className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                )}
                {isExtracting ? "Extracting..." : "Auto-Extract"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Path to the official PDF downloaded from IEEE Xplore or Open Access repository.
            </p>
          </div>

          {/* Storage Mode: Link in Place vs Copy into Library */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Storage Strategy
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                  !copyToLibrary
                    ? "bg-white dark:bg-slate-700 border-sky-500 shadow-xs"
                    : "bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="ieee_storage_mode"
                  checked={!copyToLibrary}
                  onChange={() => setCopyToLibrary(false)}
                  className="mt-0.5 text-sky-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>Link in Place</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Zero duplicate copies. Reader accesses existing download file.
                  </p>
                </div>
              </label>

              <label
                className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                  copyToLibrary
                    ? "bg-white dark:bg-slate-700 border-sky-500 shadow-xs"
                    : "bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="ieee_storage_mode"
                  checked={copyToLibrary}
                  onChange={() => setCopyToLibrary(true)}
                  className="mt-0.5 text-sky-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-sky-500" />
                    <span>Copy to Library</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Copies into managed app storage for standalone offline library.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Paper Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advances in Quantum Computing Architectures"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Authors & Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Authors (comma-separated)
              </label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Jane Doe, John Smith"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Publication Year
              </label>
              <input
                type="number"
                value={publicationYear}
                onChange={(e) => setPublicationYear(e.target.value)}
                placeholder="2026"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Venue & DOI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Venue / Journal / Conference
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. IEEE Access or IEEE Trans. on Computers"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Canonical DOI
              </label>
              <input
                type="text"
                value={canonicalDoi}
                onChange={(e) => setCanonicalDoi(e.target.value)}
                placeholder="10.1109/ACCESS.2026.123456"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Abstract */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Abstract
            </label>
            <textarea
              rows={3}
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              placeholder="Abstract text extracted from PDF or copied from official paper page..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
            />
          </div>

          {/* Source Page URL & License */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source Article Page URL
              </label>
              <input
                type="url"
                value={sourcePageUrl}
                onChange={(e) => setSourcePageUrl(e.target.value)}
                placeholder="https://ieeexplore.ieee.org/document/9999999"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                License Name
              </label>
              <input
                type="text"
                value={licenseName}
                onChange={(e) => setLicenseName(e.target.value)}
                placeholder="CC-BY 4.0"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Collection & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Collection (Optional)
              </label>
              <select
                value={targetCollectionId}
                onChange={(e) => setTargetCollectionId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">None (Library only)</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Import Notes (Optional)
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Key takeaways or research context..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Mandatory Open Access Confirmation Checkbox */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={userConfirmedOa}
                onChange={(e) => setUserConfirmedOa(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold block mb-0.5">
                  Open Access User Confirmation (Required by Policy)
                </span>
                I confirm that this specific paper is marked as Open Access on IEEE Xplore, that I have inspected its displayed license, and that this import adheres to permitted usage.
              </div>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !userConfirmedOa || !filePath.trim() || !title.trim()}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isSubmitting ? "Importing & Verifying..." : "Confirm & Import PDF"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
