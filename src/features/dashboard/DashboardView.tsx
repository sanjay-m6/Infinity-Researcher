import React from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  BookOpen,
  Bookmark,
  DownloadCloud,
  Layers,
  Search,
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";

export const DashboardView: React.FC = () => {
  const {
    papers,
    collections,
    jobs,
    sources,
    activity,
    setActiveSection,
    setSelectedPaperId,
    executeGlobalSearch,
  } = useApp();

  const savedPapers = papers.filter((p) => p.isSaved);
  const activeDownloads = jobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  );
  const supportedSources = sources.filter((s) => s.status === "Supported");

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Scholarly Workspace"
        description="Local-first academic research workbench. Discover, curate, and review literature offline."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection("discover")}
            >
              <Search className="w-4 h-4" />
              <span>Search Online</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveSection("library")}
            >
              <BookOpen className="w-4 h-4" />
              <span>Open Library</span>
            </Button>
          </div>
        }
      />

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Papers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSection("library")}
          onKeyDown={(e) => e.key === "Enter" && setActiveSection("library")}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Indexed Papers
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {papers.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Demo dataset</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:translate-x-0.5 transition-transform">
            <span>Browse library</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>

        {/* Metric 2: Saved Records */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSection("library")}
          onKeyDown={(e) => e.key === "Enter" && setActiveSection("library")}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Saved in Library
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {savedPapers.length}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              across {collections.length} collections
            </span>
          </div>
          <div className="mt-3 flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
            <span>View saved papers</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>

        {/* Metric 3: Active Downloads */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSection("downloads")}
          onKeyDown={(e) => e.key === "Enter" && setActiveSection("downloads")}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Active Job Queue
            </span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
              <DownloadCloud className="w-4 h-4" />
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
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>

        {/* Metric 4: Academic Sources */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSection("sources")}
          onKeyDown={(e) => e.key === "Enter" && setActiveSection("sources")}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Configured Providers
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Layers className="w-4 h-4" />
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
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Recommended Queries */}
      <div className="p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/60 via-slate-50 to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Explore Research Literature
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Query millions of preprint and open-access articles across arXiv, OpenAlex,
              Semantic Scholar, and PubMed.
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
              variant="primary"
              size="sm"
              onClick={() => setActiveSection("discover")}
            >
              Open Discover
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Papers & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Papers */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Recent Scholarly Papers
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("library")}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all {papers.length} papers
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {papers.slice(0, 5).map((paper) => (
              <div
                key={paper.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPaperId(paper.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedPaperId(paper.id)}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {paper.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {paper.authors.join(", ")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>{paper.venue}</span>
                      <span>•</span>
                      <span className="font-mono">{paper.year}</span>
                      <span>•</span>
                      <Badge variant="primary" size="sm">
                        {paper.sourceName}
                      </Badge>
                      {paper.accessStatus === "open_access" && (
                        <Badge variant="success" size="sm">
                          Open Access
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs text-slate-400 tabular-nums">
                      {paper.citationCount.toLocaleString()} cit.
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 dark:text-slate-600 dark:group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Source Status & Recent Activity */}
        <div className="space-y-6">
          {/* Source Status Mini Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
            <div className="space-y-2">
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
          </div>

          {/* Activity Feed Mini Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
            <div className="space-y-2.5">
              {activity.slice(0, 4).map((act) => (
                <div key={act.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {act.title}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(act.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                    {act.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
