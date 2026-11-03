import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Card } from "../../components/ui/Card";
import { Progress } from "../../components/ui/Progress";
import { StatusBadge, ResearchStatus } from "../../components/data-display/StatusBadge";
import { useApp } from "../../context/AppContext";
import {
  listPdfDownloadJobs,
  cancelPdfDownload,
  retryPdfDownload,
  clearCompletedPdfDownloads,
  deletePdfDownloadJob,
  getDownloadStorageMetrics,
  cleanOrphanedDownloads,
  listCrawlJobs,
  startCrawlJob,
  pauseCrawlJob,
  resumeCrawlJob,
  cancelCrawlJob,
  listCrawledPapers,
  importCrawledPapers,
  listCrawlProfiles,
} from "../../lib/desktop-api";
import {
  DownloadJob,
  DownloadStorageMetrics,
  CrawlJob,
  CrawlJobPaper,
  CrawlProfile,
  ImportSummary,
} from "../../lib/desktop-api/types";
import {
  Globe,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  BookOpen,
  AlertCircle,
  Download,
  HardDrive,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileDown,
  Search,
  Zap,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bps?: number | null): string {
  if (!bps || bps <= 0) return "";
  return `${formatBytes(bps)}/s`;
}

export const DownloadsView: React.FC = () => {
  const { showToast, setActiveSection, setReadingPaper, setSelectedPaperId } = useApp();

  // Top-level workspace tab
  const [workspaceTab, setWorkspaceTab] = useState<"pdf_downloads" | "web_crawls">("web_crawls");

  // --- PDF Downloads State ---
  const [pdfJobs, setPdfJobs] = useState<DownloadJob[]>([]);
  const [storageMetrics, setStorageMetrics] = useState<DownloadStorageMetrics | null>(null);
  const [pdfFilter, setPdfFilter] = useState<string>("all");
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [isCleanConfirmOpen, setIsCleanConfirmOpen] = useState(false);
  const [isClearCompletedConfirmOpen, setIsClearCompletedConfirmOpen] = useState(false);

  // --- Web Crawl Jobs State (Preserved) ---
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [crawlProfiles, setCrawlProfiles] = useState<CrawlProfile[]>([]);
  const [isCrawlLoading, setIsCrawlLoading] = useState(false);
  const [crawlFilter, setCrawlFilter] = useState<string>("all");

  // New Crawl Modal State
  const [isNewCrawlOpen, setIsNewCrawlOpen] = useState(false);
  const [startUrl, setStartUrl] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);

  // Discovered Papers Drawer/Modal State
  const [selectedJobForPapers, setSelectedJobForPapers] = useState<CrawlJob | null>(null);
  const [crawledPapers, setCrawledPapers] = useState<CrawlJobPaper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);

  // -------------------------------------------------------------------------
  // Data Fetching: PDF Downloads
  // -------------------------------------------------------------------------
  const loadPdfData = useCallback(async () => {
    try {
      const [jobsData, metricsData] = await Promise.all([
        listPdfDownloadJobs(100),
        getDownloadStorageMetrics().catch(() => null),
      ]);
      setPdfJobs(jobsData || []);
      if (metricsData) setStorageMetrics(metricsData);
      if (jobsData && jobsData.length > 0) {
        setWorkspaceTab("pdf_downloads");
      }
      return jobsData || [];
    } catch (e) {
      console.error("Failed to load PDF download jobs", e);
      return [];
    }
  }, []);

  // -------------------------------------------------------------------------
  // Data Fetching: Web Crawl Jobs
  // -------------------------------------------------------------------------
  const loadCrawlJobs = useCallback(async () => {
    try {
      const data = await listCrawlJobs(50);
      setCrawlJobs(data || []);
      return data || [];
    } catch (e) {
      console.error("Failed to load crawl jobs", e);
      return [];
    }
  }, []);

  const loadCrawlProfiles = useCallback(async () => {
    try {
      const data = await listCrawlProfiles();
      setCrawlProfiles(data || []);
      if (data && data.length > 0 && !selectedProfileId) {
        setSelectedProfileId(data[0].id);
      }
      return data || [];
    } catch (e) {
      console.error("Failed to load crawl profiles", e);
      return [];
    }
  }, [selectedProfileId]);

  // Initial load & polling
  useEffect(() => {
    setIsPdfLoading(true);
    setIsCrawlLoading(true);

    Promise.all([loadPdfData(), loadCrawlJobs(), loadCrawlProfiles()]).then(([pdfResult, crawlResult]) => {
      if ((!pdfResult || pdfResult.length === 0) && crawlResult && crawlResult.length > 0) {
        setWorkspaceTab("web_crawls");
      }
    }).finally(() => {
      setIsPdfLoading(false);
      setIsCrawlLoading(false);
    });

    // Periodic poll every 3s to refresh live progress and metrics
    const interval = setInterval(() => {
      loadPdfData();
      loadCrawlJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadPdfData, loadCrawlJobs, loadCrawlProfiles]);

  // Real-time Tauri IPC event listener
  useEffect(() => {
    let unlistenStarted: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenCompleted: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;
    let unlistenCancelled: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        unlistenStarted = await listen<DownloadJob>("paper:download_started", (event) => {
          setPdfJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === event.payload.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = event.payload;
              return copy;
            }
            return [event.payload, ...prev];
          });
        });

        unlistenProgress = await listen<DownloadJob>("paper:download_progress", (event) => {
          setPdfJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === event.payload.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = event.payload;
              return copy;
            }
            return [event.payload, ...prev];
          });
        });

        unlistenCompleted = await listen<DownloadJob>("paper:download_completed", (event) => {
          setPdfJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === event.payload.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = event.payload;
              return copy;
            }
            return [event.payload, ...prev];
          });
          getDownloadStorageMetrics().then((m) => setStorageMetrics(m)).catch(() => {});
        });

        unlistenFailed = await listen<DownloadJob>("paper:download_failed", (event) => {
          setPdfJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === event.payload.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = event.payload;
              return copy;
            }
            return [event.payload, ...prev];
          });
        });

        unlistenCancelled = await listen<DownloadJob>("paper:download_cancelled", (event) => {
          setPdfJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === event.payload.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = event.payload;
              return copy;
            }
            return [event.payload, ...prev];
          });
        });
      } catch {
        // Fallback gracefully in web/test environment
      }
    };

    setupListeners();

    return () => {
      unlistenStarted?.();
      unlistenProgress?.();
      unlistenCompleted?.();
      unlistenFailed?.();
      unlistenCancelled?.();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Handlers: PDF Downloads
  // -------------------------------------------------------------------------
  const handleCancelPdf = async (jobId: string) => {
    try {
      await cancelPdfDownload(jobId);
      showToast("Download cancelled", "info");
      await loadPdfData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to cancel download: ${msg}`, "error");
    }
  };

  const handleRetryPdf = async (jobId: string) => {
    try {
      await retryPdfDownload(jobId);
      showToast("Retrying PDF download...", "info");
      await loadPdfData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to retry download: ${msg}`, "error");
    }
  };

  const handleClearCompletedPdf = async () => {
    try {
      const count = await clearCompletedPdfDownloads();
      showToast(`Cleared ${count} completed jobs from history (PDF files preserved)`, "success");
      await loadPdfData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to clear completed downloads: ${msg}`, "error");
    }
  };

  const handleDeletePdfJob = async (jobId: string) => {
    try {
      await deletePdfDownloadJob(jobId);
      showToast("Download task record removed from history", "info");
      await loadPdfData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to remove job: ${msg}`, "error");
    }
  };

  const handleCleanOrphaned = async () => {
    setIsCleaningOrphaned(true);
    try {
      const res = await cleanOrphanedDownloads();
      showToast(
        `Cleaned ${res.files_deleted} temporary files, freed ${formatBytes(res.bytes_freed)}`,
        "success"
      );
      await loadPdfData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to clean temporary files: ${msg}`, "error");
    } finally {
      setIsCleaningOrphaned(false);
    }
  };

  const handleOpenInReader = (job: DownloadJob) => {
    setSelectedPaperId(job.paper_id);
    setReadingPaper({
      id: job.paper_id,
      title: job.paper_title,
      sourceUrl: job.url,
    });
    setActiveSection("literature_workspace");
  };

  // -------------------------------------------------------------------------
  // Handlers: Web Crawl Jobs (Preserved)
  // -------------------------------------------------------------------------
  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startUrl.trim()) {
      showToast("Please enter a valid start URL.", "error");
      return;
    }

    setIsStartingCrawl(true);
    try {
      const newJob = await startCrawlJob(startUrl.trim(), selectedProfileId || null);
      showToast(`Crawl job started for ${newJob.start_url}`, "success");
      setIsNewCrawlOpen(false);
      setStartUrl("");
      await loadCrawlJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to start crawl: ${msg}`, "error");
    } finally {
      setIsStartingCrawl(false);
    }
  };

  const handlePauseCrawl = async (jobId: string) => {
    try {
      await pauseCrawlJob(jobId);
      showToast("Crawl job paused", "info");
      await loadCrawlJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to pause: ${msg}`, "error");
    }
  };

  const handleResumeCrawl = async (jobId: string) => {
    try {
      await resumeCrawlJob(jobId);
      showToast("Crawl job resumed", "success");
      await loadCrawlJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to resume: ${msg}`, "error");
    }
  };

  const handleCancelCrawl = async (jobId: string) => {
    try {
      await cancelCrawlJob(jobId);
      showToast("Crawl job cancelled", "info");
      await loadCrawlJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to cancel: ${msg}`, "error");
    }
  };

  const handleOpenCrawledPapers = async (job: CrawlJob) => {
    setSelectedJobForPapers(job);
    setIsLoadingPapers(true);
    setSelectedPaperIds([]);
    setLastImportSummary(null);
    try {
      const papers = await listCrawledPapers(job.id);
      setCrawledPapers(papers || []);
      setSelectedPaperIds((papers || []).filter((p) => !p.is_imported).map((p) => p.id));
    } catch (e) {
      console.error("Failed to load crawled papers", e);
      showToast("Failed to load crawled papers", "error");
    } finally {
      setIsLoadingPapers(false);
    }
  };

  const handleImportSelected = async () => {
    if (!selectedJobForPapers) return;
    setIsImporting(true);
    try {
      const summary = await importCrawledPapers(
        selectedJobForPapers.id,
        selectedPaperIds.length > 0 ? selectedPaperIds : undefined
      );
      setLastImportSummary(summary);
      showToast(
        `Imported ${summary.added} papers (${summary.already_present} already in library)`,
        "success"
      );
      const updated = await listCrawledPapers(selectedJobForPapers.id);
      setCrawledPapers(updated || []);
      setSelectedPaperIds([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Import failed: ${msg}`, "error");
    } finally {
      setIsImporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Filtering & Computed Metrics
  // -------------------------------------------------------------------------
  const activePdfJobsCount = pdfJobs.filter((j) =>
    ["resolving", "downloading", "validating"].includes(j.status)
  ).length;
  const queuedPdfJobsCount = pdfJobs.filter((j) => j.status === "queued").length;
  const completedPdfJobsCount = pdfJobs.filter((j) => j.status === "completed").length;
  const failedPdfJobsCount = pdfJobs.filter((j) => j.status === "failed").length;
  const cancelledPdfJobsCount = pdfJobs.filter((j) => j.status === "cancelled").length;

  const filteredPdfJobs = pdfJobs.filter((job) => {
    if (pdfFilter === "active") {
      if (!["resolving", "downloading", "validating"].includes(job.status)) return false;
    } else if (pdfFilter !== "all" && job.status !== pdfFilter) {
      return false;
    }

    if (pdfSearchQuery.trim()) {
      const q = pdfSearchQuery.toLowerCase();
      const titleMatch = job.paper_title.toLowerCase().includes(q);
      const sourceMatch = job.source_id.toLowerCase().includes(q);
      const urlMatch = job.url.toLowerCase().includes(q);
      return titleMatch || sourceMatch || urlMatch;
    }

    return true;
  });

  const filteredCrawlJobs = crawlJobs.filter((job) => {
    if (crawlFilter === "all") return true;
    return job.status === crawlFilter;
  });

  const getJobStatusBadge = (status: DownloadJob["status"]) => {
    switch (status) {
      case "queued":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-slate-500 border-slate-300 dark:border-slate-700">
            <Clock className="w-3 h-3" />
            Queued
          </Badge>
        );
      case "resolving":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <RotateCcw className="w-3 h-3 animate-spin" />
            Resolving Link
          </Badge>
        );
      case "downloading":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            Downloading
          </Badge>
        );
      case "validating":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Validating PDF
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
        );
      case "cancelling":
      case "cancelled":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-slate-400">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Downloads & Retrieval Jobs"
          description="Bounded-concurrency acquisition engine with Anti-SSRF protection, PDF magic-bytes validation, and atomic storage verification."
        />
        <span className="sr-only">Download Manager & Retrieval</span>

        <div className="flex items-center gap-2">
          {workspaceTab === "pdf_downloads" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPdfData}
                disabled={isPdfLoading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPdfLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {completedPdfJobsCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsClearCompletedConfirmOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Completed ({completedPdfJobsCount})
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCrawlJobs}
                disabled={isCrawlLoading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCrawlLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewCrawlOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                New Website Crawl
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setWorkspaceTab("pdf_downloads")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            workspaceTab === "pdf_downloads"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>PDF Acquisition Queue</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 tabular-nums">
            {pdfJobs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setWorkspaceTab("web_crawls")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            workspaceTab === "web_crawls"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Website Crawlers & Scrapers</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
            {crawlJobs.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: PDF ACQUISITION QUEUE (Modernized Download Manager)           */}
      {/* ==================================================================== */}
      {workspaceTab === "pdf_downloads" && (
        <div className="space-y-6">
          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-info font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Active Transfers
              </div>
              <div className="text-2xl font-bold text-info mt-1">
                {activePdfJobsCount}
              </div>
            </Card>

            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Queued
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {queuedPdfJobsCount}
              </div>
            </Card>

            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-success font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </div>
              <div className="text-2xl font-bold text-success mt-1">
                {completedPdfJobsCount}
              </div>
            </Card>

            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-rose-500 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Failed / Issues
              </div>
              <div className="text-2xl font-bold text-rose-500 mt-1">
                {failedPdfJobsCount}
              </div>
            </Card>

            <Card className="p-4 shadow-2xs col-span-2 sm:col-span-1">
              <div className="text-xs text-primary font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                Library Storage
              </div>
              <div className="text-xl font-bold text-primary mt-1 truncate">
                {storageMetrics ? formatBytes(storageMetrics.total_bytes) : "0 B"}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {storageMetrics?.pdf_count || 0} PDFs stored
              </div>
            </Card>
          </div>

          {/* Storage Maintenance & Hygiene Section */}
          {storageMetrics && storageMetrics.temp_files_count > 0 && (
            <Card className="p-3.5 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 min-w-0">
                <HardDrive className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="truncate">
                  Found <strong>{storageMetrics.temp_files_count} orphaned temporary files</strong> (
                  {formatBytes(storageMetrics.temp_files_bytes)}) left from aborted transfers.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCleanConfirmOpen(true)}
                disabled={isCleaningOrphaned}
                className="shrink-0 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {isCleaningOrphaned ? "Cleaning..." : "Purge Temporary Files"}
              </Button>
            </Card>
          )}

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: "all", label: "All", count: pdfJobs.length },
                  { id: "active", label: "Active", count: activePdfJobsCount },
                  { id: "queued", label: "Queued", count: queuedPdfJobsCount },
                  { id: "completed", label: "Completed", count: completedPdfJobsCount },
                  { id: "failed", label: "Failed", count: failedPdfJobsCount },
                  { id: "cancelled", label: "Cancelled", count: cancelledPdfJobsCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPdfFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 shrink-0 ${
                    pdfFilter === tab.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                      pdfFilter === tab.id
                        ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Substring Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search download tasks..."
                value={pdfSearchQuery}
                onChange={(e) => setPdfSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* PDF Download Jobs List */}
          {filteredPdfJobs.length > 0 ? (
            <div className="space-y-3">
              {filteredPdfJobs.map((job) => {
                const isActive = ["resolving", "downloading", "validating"].includes(job.status);
                const percent = Math.min(100, Math.max(0, Math.round(job.progress_percent)));
                const speedText = formatSpeed(job.speed_bps);

                return (
                  <Card key={job.id} className="p-4 shadow-2xs space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                            {job.paper_title}
                          </h3>
                          {getJobStatusBadge(job.status as DownloadJob["status"])}
                          {job.source_id && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {job.source_id}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          <span className="truncate max-w-xs">{job.url}</span>
                          <span>•</span>
                          <span>
                            {job.total_bytes > 0
                              ? `${formatBytes(job.bytes_downloaded)} of ${formatBytes(job.total_bytes)}`
                              : `${formatBytes(job.bytes_downloaded)} downloaded`}
                          </span>
                          {isActive && speedText && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                {speedText}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(job.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Job Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {job.status === "completed" && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenInReader(job)}
                            className="text-xs flex items-center gap-1.5"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Read PDF
                          </Button>
                        )}

                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelPdf(job.id)}
                            className="text-xs text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Cancel
                          </Button>
                        )}

                        {(job.status === "failed" || job.status === "cancelled") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryPdf(job.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 border-indigo-200 dark:border-indigo-900"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Retry
                          </Button>
                        )}

                        {!isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePdfJob(job.id)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Remove task from history list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Stage Indicator */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 truncate">
                          {isActive && <RotateCcw className="w-3 h-3 animate-spin text-indigo-500" />}
                          <span>{job.stage_message}</span>
                        </span>
                        <span className="font-mono font-medium shrink-0">
                          {job.status === "completed" ? "100%" : job.total_bytes > 0 ? `${percent}%` : "Streaming..."}
                        </span>
                      </div>
                      <Progress
                        value={job.status === "completed" ? 100 : percent}
                        max={100}
                        className={job.status === "failed" ? "bg-rose-100 dark:bg-rose-950" : ""}
                      />
                    </div>

                    {/* Error Banner if Failed */}
                    {job.error_message && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-semibold">
                            {job.error_category ? `Error (${job.error_category}): ` : "Download Error: "}
                            {job.error_message}
                          </div>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400">
                            Remote resource may be restricted, requiring login, or experiencing server errors. Click &apos;Retry&apos; to re-attempt.
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Download className="w-8 h-8 text-slate-400" />}
              title={
                pdfFilter === "all"
                  ? "No active or recorded PDF downloads"
                  : `No ${pdfFilter} PDF download tasks`
              }
              description="Download research papers directly from Discover Papers, search results, or the Research Library. Downloaded PDFs are permanently indexed for offline reading and AI paper understanding."
              actionLabel="Discover Papers"
              onAction={() => setActiveSection("discover")}
            />
          )}

          {/* Informational Safe Dissociation Note */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Safe Storage Commitment:</strong> Downloaded PDF documents are linked to your library and saved securely in your application storage folder. Clearing download tasks from this queue view will never delete your verified local research papers.
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: WEBSITE CRAWLERS & SCRAPERS (Preserved from Phase 2)          */}
      {/* ==================================================================== */}
      {workspaceTab === "web_crawls" && (
        <div className="space-y-6">
          {/* Overview Metric Cards for Crawls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-muted-foreground font-medium">Total Crawl Jobs</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {crawlJobs.length}
              </div>
            </Card>
            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-info font-medium">Active / Running</div>
              <div className="text-2xl font-bold text-info mt-1">
                {crawlJobs.filter((j) => j.status === "running").length}
              </div>
            </Card>
            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-success font-medium">Completed Jobs</div>
              <div className="text-2xl font-bold text-success mt-1">
                {crawlJobs.filter((j) => j.status === "completed").length}
              </div>
            </Card>
            <Card className="p-4 shadow-2xs">
              <div className="text-xs text-primary font-medium">Papers Discovered</div>
              <div className="text-2xl font-bold text-primary mt-1">
                {crawlJobs.reduce((acc, j) => acc + Number(j.papers_found), 0)}
              </div>
            </Card>
          </div>

          {/* Status Filter Tabs for Crawls */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            {(["all", "running", "paused", "completed", "failed", "cancelled"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCrawlFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 shrink-0 ${
                  crawlFilter === tab
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                    crawlFilter === tab
                      ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab === "all" ? crawlJobs.length : crawlJobs.filter((j) => j.status === tab).length}
                </span>
              </button>
            ))}
          </div>

          {/* Crawl Jobs List */}
          {filteredCrawlJobs.length > 0 ? (
            <div className="space-y-3">
              {filteredCrawlJobs.map((job) => {
                const profile = crawlProfiles.find((p) => p.id === job.profile_id);
                const totalQueue = Math.max(job.pages_queued, job.pages_visited);
                const progressPercent =
                  totalQueue > 0 ? Math.round((job.pages_visited / totalQueue) * 100) : 0;

                return (
                  <Card key={job.id} className="p-5 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {job.start_url}
                          </h3>
                          <StatusBadge status={job.status as ResearchStatus} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>Profile: {profile ? profile.name : job.profile_id}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">Depth: {job.current_depth}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">
                            Started: {new Date(job.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {job.status === "running" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePauseCrawl(job.id)}
                            className="text-xs"
                          >
                            <Pause className="w-3.5 h-3.5 mr-1" />
                            Pause
                          </Button>
                        )}
                        {job.status === "paused" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResumeCrawl(job.id)}
                            className="text-xs text-emerald-600"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Resume
                          </Button>
                        )}
                        {(job.status === "running" || job.status === "paused") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelCrawl(job.id)}
                            className="text-xs text-rose-600 hover:text-rose-700"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenCrawledPapers(job)}
                          className="text-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                          View Papers ({job.papers_found})
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Visited {job.pages_visited} of {totalQueue} queued pages ({job.pages_failed} failed)
                        </span>
                        <span className="font-mono font-medium">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} max={100} />
                    </div>

                    {/* Error Banner */}
                    {job.error_message && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{job.error_message}</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Globe className="w-8 h-8 text-slate-400" />}
              title={`No ${crawlFilter === "all" ? "" : crawlFilter} crawl jobs`}
              description="Start a safe website crawling job to index scholarly papers, extract Highwire Press and Dublin Core metadata, and import directly to your local library."
              actionLabel="Start First Crawl"
              onAction={() => setIsNewCrawlOpen(true)}
            />
          )}
        </div>
      )}

      {/* Confirmation: Clean Orphaned Part Files */}
      <ConfirmDialog
        isOpen={isCleanConfirmOpen}
        onClose={() => setIsCleanConfirmOpen(false)}
        onConfirm={handleCleanOrphaned}
        title="Purge Temporary Download Files?"
        message="This operation will safely delete orphaned incomplete download files (.part) left from interrupted transfers. Your completed research library PDFs will NOT be affected."
        confirmLabel="Purge Temporary Files"
        cancelLabel="Cancel"
        isDestructive={true}
      />

      {/* Confirmation: Clear Completed PDF Jobs */}
      <ConfirmDialog
        isOpen={isClearCompletedConfirmOpen}
        onClose={() => setIsClearCompletedConfirmOpen(false)}
        onConfirm={handleClearCompletedPdf}
        title="Clear Completed Downloads History?"
        message="This will remove completed and cancelled tasks from your download queue history list. Downloaded PDF documents will remain safely stored and accessible in your Research Library."
        confirmLabel="Clear History"
        cancelLabel="Keep History"
        isDestructive={false}
      />

      {/* Modal: Start New Crawl */}
      <Modal
        isOpen={isNewCrawlOpen}
        onClose={() => setIsNewCrawlOpen(false)}
        title="Start Website Crawl"
        maxWidth="md"
      >
        <form onSubmit={handleStartCrawl} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Start URL:
            </label>
            <input
              type="url"
              required
              placeholder="https://www.biorxiv.org/content/early/recent"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Only http and https protocols are supported. Private IPs and localhost are blocked by Anti-SSRF guard.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Crawl Profile:
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {crawlProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Defines domain boundary, allowed link patterns, robots.txt policy, and metadata CSS selectors.
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewCrawlOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isStartingCrawl}>
              {isStartingCrawl ? "Validating & Starting..." : "Launch Crawl"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Discovered Crawled Papers */}
      <Modal
        isOpen={Boolean(selectedJobForPapers)}
        onClose={() => setSelectedJobForPapers(null)}
        title={`Crawled Papers (${crawledPapers.length})`}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          {lastImportSummary && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
              <div>
                <span className="font-semibold">Import Complete: </span>
                {lastImportSummary.added} added, {lastImportSummary.already_present} already present,{" "}
                {lastImportSummary.failed} failed.
              </div>
            </div>
          )}

          {isLoadingPapers ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading extracted papers...
            </div>
          ) : crawledPapers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No scholarly papers extracted yet for this job.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={
                      selectedPaperIds.length ===
                        crawledPapers.filter((p) => !p.is_imported).length &&
                      crawledPapers.filter((p) => !p.is_imported).length > 0
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPaperIds(
                          crawledPapers.filter((p) => !p.is_imported).map((p) => p.id)
                        );
                      } else {
                        setSelectedPaperIds([]);
                      }
                    }}
                    className="rounded text-indigo-600"
                  />
                  <span>Select All Unimported ({crawledPapers.filter((p) => !p.is_imported).length})</span>
                </label>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImportSelected}
                  disabled={selectedPaperIds.length === 0 || isImporting}
                  className="text-xs"
                >
                  {isImporting
                    ? "Importing..."
                    : `Save Selected (${selectedPaperIds.length}) to Library`}
                </Button>
              </div>

              {crawledPapers.map((paper) => {
                const isSelected = selectedPaperIds.includes(paper.id);
                return (
                  <div
                    key={paper.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-2"
                  >
                    <div className="flex items-start gap-2.5">
                      {!paper.is_imported && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPaperIds((prev) => [...prev, paper.id]);
                            } else {
                              setSelectedPaperIds((prev) =>
                                prev.filter((id) => id !== paper.id)
                              );
                            }
                          }}
                          className="mt-1 rounded text-indigo-600"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {paper.title}
                          </h4>
                          {paper.is_imported && (
                            <Badge variant="success" size="sm">
                              Saved to Library
                            </Badge>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {paper.authors.length > 0
                            ? paper.authors.join(", ")
                            : "Unknown Author"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {paper.canonical_doi && <span>DOI: {paper.canonical_doi}</span>}
                          {paper.venue && <span>• {paper.venue}</span>}
                          {paper.publication_date && <span>• {paper.publication_date}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
