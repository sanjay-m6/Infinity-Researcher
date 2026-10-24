import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { JobStatus } from "../../types/domain";
import {
  DownloadCloud,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileDown,
  Info,
} from "lucide-react";

export const DownloadsView: React.FC = () => {
  const { jobs, retryJob, cancelJob } = useApp();
  const [activeTab, setActiveTab] = useState<JobStatus | "all">("all");

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === "all") return true;
    return job.status === activeTab;
  });

  const counts = {
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    queued: jobs.filter((j) => j.status === "queued").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  const statusIcons = {
    running: <DownloadCloud className="w-4 h-4 text-sky-500 animate-pulse" />,
    queued: <Clock className="w-4 h-4 text-amber-500" />,
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    failed: <AlertCircle className="w-4 h-4 text-rose-500" />,
  };

  const statusBadges = {
    running: <Badge variant="info">Running</Badge>,
    queued: <Badge variant="warning">Queued</Badge>,
    completed: <Badge variant="success">Completed</Badge>,
    failed: <Badge variant="destructive">Failed</Badge>,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Downloads & Retrieval Jobs"
        description="Monitor metadata scraping, PDF retrieval, and text extraction jobs."
      />

      {/* Demo Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/30 text-xs text-sky-900 dark:text-sky-200">
        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Demo queue state:</span> The asynchronous
          scraping and PDF download pipeline is scheduled for Phase 7. The jobs listed
          below demonstrate UI queue monitoring, retry handling, and error states.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {(["all", "running", "queued", "completed", "failed"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === tab
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>{tab}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                activeTab === tab
                  ? "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Job Cards */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusIcons[job.status]}
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {job.paperTitle}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Source: {job.sourceName}</span>
                    <span>•</span>
                    <Badge variant="outline" size="sm">
                      {job.jobType.replace("_", " ")}
                    </Badge>
                    <span>•</span>
                    <span className="font-mono text-[11px]">
                      Started: {new Date(job.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {statusBadges[job.status]}
                  {job.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryJob(job.id)}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry
                    </Button>
                  )}
                  {job.status === "running" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelJob(job.id)}
                      className="text-xs text-rose-600 hover:text-rose-700"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar for running / queued */}
              {(job.status === "running" || job.status === "queued") && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="truncate pr-2">{job.stageMessage}</span>
                    <span className="font-mono font-medium">{job.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${job.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message if failed */}
              {job.status === "failed" && job.errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  <span className="font-semibold">Error: </span>
                  {job.errorMessage}
                </div>
              )}

              {/* Completed stage message */}
              {job.status === "completed" && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ {job.stageMessage}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileDown className="w-6 h-6" />}
          title={`No ${activeTab === "all" ? "" : activeTab} download jobs`}
          description="Download jobs will appear here when you retrieve full-text PDF documents or index academic records."
        />
      )}
    </div>
  );
};
