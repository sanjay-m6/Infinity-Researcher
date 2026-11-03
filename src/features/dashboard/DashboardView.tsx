import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { SourceBadge } from "../../components/ui/SourceBadge";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton, PaperCardSkeleton } from "../../components/ui/Skeleton";
import { AppIcon } from "../../components/icons/AppIcon";
import {
  BookOpen,
  Bookmark,
  DownloadCloud,
  Layers,
  Search,
  ArrowRight,
  Clock,
  Folder,
  Database,
  Bot,
  GitCompare,
  Table,
  CheckSquare,
  Compass,
  FileText,
  CheckCircle2,
  Check,
  Copy,
  X,
  Heart,
  Coffee,
} from "lucide-react";
import { ActivityType } from "../../types/domain";
import {
  ProjectWithDetails,
  listResearchProjects,
} from "../../lib/desktop-api";
import { DashboardTasksModule } from "./components/DashboardTasksModule";
import { DashboardAnalyticsCharts } from "./components/DashboardAnalyticsCharts";
import { DashboardQuickActions } from "./components/DashboardQuickActions";
import { ResearchEcosystemOrbit } from "./components/ResearchEcosystemOrbit";

/**
 * Helper to resolve appropriate icon for activity event type
 */
function getActivityIcon(type: ActivityType) {
  switch (type) {
    case "search":
      return Search;
    case "download":
      return DownloadCloud;
    case "collection":
      return Folder;
    case "import":
      return FileText;
    case "system":
    default:
      return Database;
  }
}

/**
 * Format timestamp into concise relative or localized string
 */
function formatActivityTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return timestamp;
  }
}

export const DashboardView: React.FC = () => {
  const {
    papers,
    collections,
    jobs,
    sources,
    activity,
    setActiveSection,
    setSelectedPaperId,
    setReadingPaper,
    setSelectedCollectionId,
    executeGlobalSearch,
    setIsCommandPaletteOpen,
    cancelJob,
    databaseInfo,
    isDbLoading,
    updatePaperReadingStatus,
    setIsDonationModalOpen,
  } = useApp();

  const focusNewTaskFnRef = useRef<(() => void) | null>(null);
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null);

  // Authoritative calculations from real state (Zero mock data)
  const savedPapers = papers.filter((p) => p.isSaved);
  const openAccessPapers = papers.filter((p) => p.accessStatus === "open_access");
  const activeDownloads = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const supportedSources = sources.filter((s) => s.status === "Supported");

  // Recent papers directly from application state
  const recentPapers = papers.slice(0, 5);

  const recentCollections = collections.slice(0, 4);
  const recentActivity = activity.slice(0, 4);

  const [activeProjects, setActiveProjects] = useState<ProjectWithDetails[]>([]);

  useEffect(() => {
    let isMounted = true;
    listResearchProjects("active")
      .then((projs) => {
        if (isMounted) {
          setActiveProjects(projs.slice(0, 3));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCitation = (paper: (typeof papers)[0]) => {
    const authorsStr = paper.authors && paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors";
    const citation = `${authorsStr} (${paper.year || "n.d."}). ${paper.title}. ${paper.venue || ""}${paper.doi ? ` https://doi.org/${paper.doi}` : ""}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citation).then(() => {
        setCopiedCitationId(paper.id);
        setTimeout(() => setCopiedCitationId(null), 2000);
      }).catch(() => {});
    }
  };

  const handleToggleReadingStatus = async (paperId: string, currentStatus?: string) => {
    const isCompleted = (currentStatus || "").toLowerCase() === "completed" || (currentStatus || "").toLowerCase() === "read";
    const newStatus = isCompleted ? "unread" : "completed";
    try {
      if (updatePaperReadingStatus) {
        await updatePaperReadingStatus(paperId, newStatus);
      }
    } catch {
      // ignore
    }
  };

  // Loading skeleton state during initial database synchronization
  if (isDbLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-150" data-testid="dashboard-loading">
        <PageHeader
          title="Scholarly Workspace"
          description="Synchronizing local database and research assets..."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-96" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-4 w-40" />
            <PaperCardSkeleton count={3} />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="dashboard-view">
      {/* 3.1. Dashboard Header */}
      <PageHeader
        title="Scholarly Workspace"
        description="Local-first academic research workbench. Discover, curate, and review literature offline."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Quick Find"
              className="hidden sm:inline-flex"
            >
              <AppIcon icon={Search} size="xs" />
              <span>Quick Find</span>
              <kbd className="ml-1.5 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection("discover")}
              aria-label="Search academic literature online"
            >
              <AppIcon icon={Compass} size="xs" />
              <span>Search Online</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveSection("library")}
              aria-label="Open personal paper library"
            >
              <AppIcon icon={BookOpen} size="xs" />
              <span>Open Library</span>
            </Button>
          </div>
        }
      />

      {/* Quick Action Workflow Bar */}
      <DashboardQuickActions
        onNewTaskClick={() => focusNewTaskFnRef.current?.()}
        onQuickIngestClick={() => setActiveSection("discover")}
      />

      {/* 3.2. Research Overview (Metric Cards) */}
      <section aria-label="Research Overview Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Total Indexed Papers */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveSection("library")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveSection("library");
              }
            }}
            aria-label={`Total indexed papers: ${papers.length}. Click to browse library.`}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Indexed Papers
              </span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <AppIcon icon={BookOpen} size="sm" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {papers.length}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {openAccessPapers.length} open access
              </span>
            </div>
            <div className="mt-3 flex items-center text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Browse library</span>
              <AppIcon icon={ArrowRight} size="xs" className="ml-1" />
            </div>
          </div>

          {/* Metric 2: Saved Records */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveSection("library")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveSection("library");
              }
            }}
            aria-label={`Saved papers: ${savedPapers.length}. Click to view saved papers.`}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Saved in Library
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <AppIcon icon={Bookmark} size="sm" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {savedPapers.length}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                across {collections.length} {collections.length === 1 ? "collection" : "collections"}
              </span>
            </div>
            <div className="mt-3 flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
              <span>View saved papers</span>
              <AppIcon icon={ArrowRight} size="xs" className="ml-1" />
            </div>
          </div>

          {/* Metric 3: Active Downloads & Tasks */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveSection("downloads")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveSection("downloads");
              }
            }}
            aria-label={`Active job queue: ${activeDownloads.length} active of ${jobs.length} total tasks. Click to inspect download queue.`}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-sky-400 dark:hover:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Active Job Queue
              </span>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                <AppIcon icon={DownloadCloud} size="sm" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {activeDownloads.length}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {jobs.length} total tasks
              </span>
            </div>
            <div className="mt-3 flex items-center text-xs text-sky-600 dark:text-sky-400 font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Inspect download queue</span>
              <AppIcon icon={ArrowRight} size="xs" className="ml-1" />
            </div>
          </div>

          {/* Metric 4: Academic Sources */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveSection("sources")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveSection("sources");
              }
            }}
            aria-label={`Configured providers: ${supportedSources.length} of ${sources.length} active. Click to manage sources.`}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-hidden transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Configured Providers
              </span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <AppIcon icon={Layers} size="sm" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {supportedSources.length} / {sources.length}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Verified feeds</span>
            </div>
            <div className="mt-3 flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Manage sources</span>
              <AppIcon icon={ArrowRight} size="xs" className="ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* Visual Analytics & Bespoke Animated Charts Suite */}
      <DashboardAnalyticsCharts
        papers={papers}
        onSelectPaper={(paperId) => setSelectedPaperId(paperId)}
      />

      {/* Research Intelligence & Repository Ecosystem Orbit */}
      <ResearchEcosystemOrbit />

      {/* 3.8. Quick Launchpad & Curated Discovery Queries */}
      <section aria-label="Literature Exploration Launchpad">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AppIcon icon={Compass} size="sm" className="text-slate-500 dark:text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Explore Research Literature
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Query millions of preprint and open-access articles across arXiv, OpenAlex,
                Semantic Scholar, and PubMed with structured metadata.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeGlobalSearch("deep learning transformer")}
              >
                &quot;deep learning transformer&quot;
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeGlobalSearch("protein folding alphafold")}
              >
                &quot;protein folding alphafold&quot;
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeGlobalSearch("large language models reasoning")}
                className="hidden sm:inline-flex"
              >
                &quot;large language models reasoning&quot;
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveSection("discover")}
              >
                Open Discover
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Multi-Region Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Span 2): Tasks, Recent Papers, & Active Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Research Tasks & To-Do Management Module */}
          <DashboardTasksModule
            onFocusInputRef={(focusFn) => {
              focusNewTaskFnRef.current = focusFn;
            }}
          />

          {/* 3.3. Continue Researching (Recent Papers) */}
          <section aria-labelledby="recent-papers-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppIcon icon={BookOpen} size="sm" className="text-indigo-600 dark:text-indigo-400" />
                <h2
                  id="recent-papers-heading"
                  className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100"
                >
                  Recent Scholarly Papers
                </h2>
                <Badge variant="secondary" size="sm">
                  {papers.length} in library
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("library")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all papers
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-2xs">
              {recentPapers.length === 0 ? (
                <EmptyState
                  icon={<AppIcon icon={BookOpen} size="lg" className="text-slate-400" />}
                  title="No papers in your library yet"
                  description="Search academic sources or query repositories to discover and save research papers."
                  actionLabel="Search Academic Sources"
                  onAction={() => setActiveSection("discover")}
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                recentPapers.map((paper) => {
                  const isCompleted = (paper.readingStatus || "").toLowerCase() === "completed" || (paper.readingStatus || "").toLowerCase() === "read";

                  return (
                    <div
                      key={paper.id}
                      className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPaperId(paper.id)}
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-left line-clamp-1 cursor-pointer focus-visible:underline focus-visible:outline-hidden"
                          >
                            {paper.title}
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {paper.authors && paper.authors.length > 0
                              ? paper.authors.join(", ")
                              : "Unknown authors"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                            {paper.venue && <span>{paper.venue}</span>}
                            {paper.venue && paper.year && <span>•</span>}
                            {paper.year && <span className="font-mono">{paper.year}</span>}
                            <span>•</span>
                            <SourceBadge sourceName={paper.sourceName} size="sm" />
                            {paper.accessStatus === "open_access" && (
                              <Badge variant="success" size="sm">
                                Open Access
                              </Badge>
                            )}
                            {paper.readingStatus && (
                              <Badge
                                variant={isCompleted ? "success" : "primary"}
                                size="sm"
                              >
                                {paper.readingStatus}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Paper Direct Action Controls */}
                        <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                          <span className="text-xs text-slate-400 tabular-nums hidden sm:inline-block mr-1">
                            {paper.citationCount.toLocaleString()} cit.
                          </span>

                          {/* Quick Toggle Reading Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleReadingStatus(paper.id, paper.readingStatus)}
                            title={isCompleted ? "Mark Unread" : "Mark as Completed"}
                            aria-label={`Toggle read status for ${paper.title}`}
                            className={`p-1.5 rounded-md border transition-all ${
                              isCompleted
                                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                          >
                            <AppIcon icon={isCompleted ? Check : CheckCircle2} size="xs" />
                          </button>

                          {/* Quick Copy Citation */}
                          <button
                            type="button"
                            onClick={() => handleCopyCitation(paper)}
                            title="Copy Academic Citation"
                            aria-label={`Copy citation for ${paper.title}`}
                            className={`p-1.5 rounded-md border transition-all ${
                              copiedCitationId === paper.id
                                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                          >
                            <AppIcon icon={copiedCitationId === paper.id ? Check : Copy} size="xs" />
                          </button>

                          {(paper.pdfUrl || paper.landingUrl) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setReadingPaper({
                                  id: paper.id,
                                  title: paper.title,
                                  sourceUrl: paper.pdfUrl || paper.landingUrl,
                                })
                              }
                              aria-label={`Read PDF for ${paper.title}`}
                              className="h-7 text-xs px-2.5 gap-1"
                            >
                              <AppIcon icon={BookOpen} size="xs" />
                              <span>Read</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPaperId(paper.id)}
                            aria-label={`View details for ${paper.title}`}
                            className="h-7 text-xs px-2 gap-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            <span>Details</span>
                            <AppIcon icon={ArrowRight} size="xs" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 3.4. Active Downloads and Background Tasks */}
          <section aria-labelledby="active-tasks-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppIcon icon={DownloadCloud} size="sm" className="text-sky-600 dark:text-sky-400" />
                <h2
                  id="active-tasks-heading"
                  className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100"
                >
                  Active Tasks & Retrieval Queue
                </h2>
                {activeDownloads.length > 0 && (
                  <Badge variant="info" size="sm">
                    {activeDownloads.length} active
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("downloads")}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Task Manager
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
              {activeDownloads.length > 0 ? (
                <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {activeDownloads.map((job) => (
                    <div key={job.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {job.paperTitle}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {job.stageMessage || "Processing retrieval job..."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={job.status === "running" ? "info" : "secondary"}
                            size="sm"
                          >
                            {job.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelJob(job.id)}
                            aria-label={`Cancel job ${job.paperTitle}`}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                          >
                            <AppIcon icon={X} size="xs" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Progress</span>
                          <span>{job.progressPercent}%</span>
                        </div>
                        <Progress value={job.progressPercent} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : jobs.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <AppIcon icon={CheckCircle2} size="xs" className="text-emerald-500" />
                    <span>
                      Queue is currently idle. All {jobs.length} background tasks have finished.
                    </span>
                  </div>
                  {completedJobs.slice(0, 2).map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                    >
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-xs">
                        {job.paperTitle}
                      </span>
                      <Badge variant="success" size="sm">
                        Completed
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<AppIcon icon={DownloadCloud} size="sm" className="text-slate-400" />}
                  title="Task queue is idle"
                  description="No background downloads or text extractions are currently running."
                  actionLabel="Search Papers"
                  onAction={() => setActiveSection("discover")}
                  className="border-0 bg-transparent py-4"
                />
              )}
            </div>
          </section>
        </div>

        {/* Right Column (Span 1): Collections, Tools, Activity & Diagnostics */}
        <div className="space-y-6">
          {/* 3.5. Research Collections */}
          <section aria-labelledby="collections-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppIcon icon={Folder} size="sm" className="text-emerald-600 dark:text-emerald-400" />
                <h2
                  id="collections-heading"
                  className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100"
                >
                  Research Collections
                </h2>
                <Badge variant="secondary" size="sm">
                  {collections.length} binders
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("collections")}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                All Collections
              </button>
            </div>

            {recentCollections.length === 0 ? (
              <EmptyState
                compact
                icon={<AppIcon icon={Folder} size="sm" className="text-slate-400" />}
                title="No collections created yet"
                description="Organize your literature into topical binders and reading lists."
                actionLabel="Create Collection"
                onAction={() => setActiveSection("collections")}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentCollections.map((col) => (
                  <div
                    key={col.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedCollectionId(col.id);
                      setActiveSection("collections");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCollectionId(col.id);
                        setActiveSection("collections");
                      }
                    }}
                    aria-label={`Collection: ${col.name}, contains ${col.paperIds?.length || 0} papers. Click to open.`}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: col.colorHex || "#10b981" }}
                        />
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {col.name}
                        </h3>
                      </div>
                      <Badge variant="outline" size="sm" className="shrink-0 text-[10px]">
                        {col.paperIds?.length || 0} papers
                      </Badge>
                    </div>
                    {col.description && (
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {col.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3.6. Research Projects & Roadmap Tasks */}
          {activeProjects.length > 0 && (
            <section aria-labelledby="active-projects-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AppIcon icon={Folder} size="sm" className="text-primary" />
                  <h2
                    id="active-projects-heading"
                    className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100"
                  >
                    Active Research Projects
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("projects")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  All Projects
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeProjects.map((item) => (
                  <div
                    key={item.project.id}
                    onClick={() => setActiveSection("projects")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.project.title}
                      </span>
                      <span className="font-semibold text-primary">{item.project.progress_percent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${item.project.progress_percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{item.total_tasks} tasks</span>
                      <span>{item.linked_papers_count} papers</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3.7. Quick Tools & AI Shortcuts */}
          <section aria-labelledby="quick-tools-heading" className="space-y-3">
            <h2
              id="quick-tools-heading"
              className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Quick Research Tools
            </h2>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5 shadow-2xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection("literature_workspace")}
                className="w-full justify-start text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <AppIcon icon={BookOpen} size="xs" className="mr-2 text-indigo-500" />
                <span>Open Literature Workspace</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection("research_assistant")}
                className="w-full justify-start text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <AppIcon icon={Bot} size="xs" className="mr-2 text-purple-500" />
                <span>AI Copilot Assistant</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection("citation_checker")}
                className="w-full justify-start text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <AppIcon icon={CheckSquare} size="xs" className="mr-2 text-emerald-500" />
                <span>Audit Citations</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection("review_matrix")}
                className="w-full justify-start text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <AppIcon icon={Table} size="xs" className="mr-2 text-amber-500" />
                <span>Systematic Review Matrix</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection("paper_comparison")}
                className="w-full justify-start text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <AppIcon icon={GitCompare} size="xs" className="mr-2 text-sky-500" />
                <span>Compare Papers Side-by-Side</span>
              </Button>
            </div>
          </section>

          {/* Source Status Mini Card */}
          <section aria-labelledby="source-connectors-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="source-connectors-heading"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Source Connectors
              </h2>
              <button
                type="button"
                onClick={() => setActiveSection("sources")}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Directory
              </button>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-2xs">
              {sources.slice(0, 4).map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {source.name}
                    </span>
                  </div>
                  <Badge
                    variant={
                      source.status === "Supported"
                        ? "success"
                        : source.status === "Not configured"
                          ? "default"
                          : "warning"
                    }
                    size="sm"
                  >
                    {source.status}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          {/* 3.6. Recent Research Activity */}
          <section aria-labelledby="activity-feed-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AppIcon icon={Clock} size="xs" className="text-slate-400" />
                <h2
                  id="activity-feed-heading"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Recent Activity
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("activity")}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                All Logs
              </button>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              {recentActivity.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No recent activity recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((act) => {
                    const ActIcon = getActivityIcon(act.type);
                    return (
                      <div key={act.id} className="text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AppIcon
                              icon={ActIcon}
                              size="xs"
                              className="text-slate-400 shrink-0"
                            />
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                              {act.title}
                            </span>
                          </div>
                          <span className="text-slate-400 font-mono text-[10px] shrink-0 ml-2">
                            {formatActivityTime(act.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate pl-4">
                          {act.details}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Database Diagnostics & Offline Status */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AppIcon icon={Database} size="xs" className="text-indigo-500" />
                <span>Local SQLite DB</span>
              </span>
              <Badge variant="success" size="sm">
                Offline Active
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
              {databaseInfo?.path ? databaseInfo.path.split(/[/\\]/).pop() : "rps_academic.db"}
            </p>
            <div className="text-[10px] text-slate-400 pt-0.5">
              <span>{papers.length} cached papers</span> • <span>{collections.length} collections</span>
            </div>
          </div>

          {/* Support & Open-Source Sponsorship */}
          <div className="p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/70 via-purple-50/40 to-indigo-50/70 dark:from-rose-950/30 dark:via-purple-950/20 dark:to-indigo-950/30 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                <AppIcon icon={Heart} size="xs" className="text-rose-500 fill-current animate-pulse" />
                <span>Support Sovereign Research</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                100% Free
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Back <strong>Sanjay</strong> to keep Infinity Researcher free, private, and local-first for scholars worldwide.
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setIsDonationModalOpen(true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AppIcon icon={Heart} size="xs" className="fill-current" />
                <span>Sponsor & Donate</span>
              </button>
              <button
                type="button"
                onClick={() => window.open("https://ko-fi.com/infinity86", "_blank", "noopener,noreferrer")}
                className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="Ko-fi Support"
              >
                <AppIcon icon={Coffee} size="xs" className="text-[#ff5f5f]" />
                <span>Ko-fi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
