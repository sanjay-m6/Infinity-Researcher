import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { useApp } from "../../context/AppContext";
import {
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
} from "lucide-react";


export const DownloadsView: React.FC = () => {
  const { showToast } = useApp();
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [profiles, setProfiles] = useState<CrawlProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // New Crawl Modal State
  const [isNewCrawlOpen, setIsNewCrawlOpen] = useState(false);
  const [startUrl, setStartUrl] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  // Discovered Papers Drawer/Modal State
  const [selectedJobForPapers, setSelectedJobForPapers] = useState<CrawlJob | null>(null);
  const [crawledPapers, setCrawledPapers] = useState<CrawlJobPaper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await listCrawlJobs(50);
      setJobs(data);
    } catch (e) {
      console.error("Failed to load crawl jobs", e);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await listCrawlProfiles();
      setProfiles(data);
      if (data.length > 0 && !selectedProfileId) {
        setSelectedProfileId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load crawl profiles", e);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadJobs(), loadProfiles()]).finally(() => setIsLoading(false));

    // Polling interval for live progress when running jobs exist
    const interval = setInterval(() => {
      loadJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadJobs, loadProfiles]);

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startUrl.trim()) {
      showToast("Please enter a valid start URL.", "error");
      return;
    }

    setIsStarting(true);
    try {
      const newJob = await startCrawlJob(startUrl.trim(), selectedProfileId || null);
      showToast(`Crawl job started for ${newJob.start_url}`, "success");
      setIsNewCrawlOpen(false);
      setStartUrl("");
      await loadJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to start crawl: ${msg}`, "error");
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await pauseCrawlJob(jobId);
      showToast("Crawl job paused", "info");
      await loadJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to pause: ${msg}`, "error");
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await resumeCrawlJob(jobId);
      showToast("Crawl job resumed", "success");
      await loadJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to resume: ${msg}`, "error");
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelCrawlJob(jobId);
      showToast("Crawl job cancelled", "info");
      await loadJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to cancel: ${msg}`, "error");
    }
  };

  const handleOpenPapers = async (job: CrawlJob) => {
    setSelectedJobForPapers(job);
    setIsLoadingPapers(true);
    setSelectedPaperIds([]);
    setLastImportSummary(null);
    try {
      const papers = await listCrawledPapers(job.id);
      setCrawledPapers(papers);
      setSelectedPaperIds(papers.filter((p) => !p.is_imported).map((p) => p.id));
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
      // Refresh list to update imported status
      const updated = await listCrawledPapers(selectedJobForPapers.id);
      setCrawledPapers(updated);
      setSelectedPaperIds([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Import failed: ${msg}`, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (activeFilter === "all") return true;
    return job.status === activeFilter;
  });

  const getStatusBadge = (status: CrawlJob["status"]) => {
    switch (status) {
      case "running":
        return <Badge variant="info">Running</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "cancelled":
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Downloads & Retrieval Jobs"
          description="Autonomous scholarly crawler with Anti-SSRF protection, RFC 9309 robots.txt compliance, and structured metadata extraction."
        />
        <div className="flex items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={loadJobs}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
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
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total Crawl Jobs</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {jobs.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">Active / Running</div>
          <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {jobs.filter((j) => j.status === "running").length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Completed Jobs</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {jobs.filter((j) => j.status === "completed").length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Papers Discovered</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {jobs.reduce((acc, j) => acc + Number(j.papers_found), 0)}
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {(["all", "running", "paused", "completed", "failed", "cancelled"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 shrink-0 ${
              activeFilter === tab
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>{tab}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                activeFilter === tab
                  ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {tab === "all" ? jobs.length : jobs.filter((j) => j.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Crawl Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const profile = profiles.find((p) => p.id === job.profile_id);
            const totalQueue = Math.max(job.pages_queued, job.pages_visited);
            const progressPercent =
              totalQueue > 0 ? Math.round((job.pages_visited / totalQueue) * 100) : 0;

            return (
              <div
                key={job.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {job.start_url}
                      </h3>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Profile: {profile ? profile.name : job.profile_id}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">
                        Depth: {job.current_depth}
                      </span>
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
                        onClick={() => handlePause(job.id)}
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
                        onClick={() => handleResume(job.id)}
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
                        onClick={() => handleCancel(job.id)}
                        className="text-xs text-rose-600 hover:text-rose-700"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenPapers(job)}
                      className="text-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" />
                      View Papers ({job.papers_found})
                    </Button>
                  </div>
                </div>

                {/* Live Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Visited {job.pages_visited} of {totalQueue} queued pages ({job.pages_failed} failed)
                    </span>
                    <span className="font-mono font-medium">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        job.status === "completed"
                          ? "bg-emerald-500"
                          : job.status === "failed"
                          ? "bg-rose-500"
                          : "bg-indigo-600"
                      }`}
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Error Banner if failed */}
                {job.error_message && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{job.error_message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Globe className="w-8 h-8 text-slate-400" />}
          title={`No ${activeFilter === "all" ? "" : activeFilter} crawl jobs`}
          description="Start a safe website crawling job to index scholarly papers, extract Highwire Press and Dublin Core metadata, and import directly to your local library."
          actionLabel="Start First Crawl"
          onAction={() => setIsNewCrawlOpen(true)}
        />

      )}

      {/* Start New Crawl Modal */}
      <Modal
        isOpen={isNewCrawlOpen}
        onClose={() => setIsNewCrawlOpen(false)}
        title="Start Website Crawl"
        description="Enter the seed URL of a scholarly repository or journal page to safely crawl."
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
              {profiles.map((p) => (
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
            <Button type="submit" variant="primary" size="sm" disabled={isStarting}>
              {isStarting ? "Validating & Starting..." : "Launch Crawl"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Discovered Papers Modal */}
      <Modal
        isOpen={Boolean(selectedJobForPapers)}
        onClose={() => setSelectedJobForPapers(null)}
        title={`Crawled Papers (${crawledPapers.length})`}
        description={`Discovered papers from ${selectedJobForPapers?.start_url}`}
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
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
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
