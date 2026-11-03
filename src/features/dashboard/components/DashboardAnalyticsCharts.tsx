import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart3, TrendingUp, PieChart, Sparkles, Info, Layers } from "lucide-react";
import { AppIcon } from "../../../components/icons/AppIcon";
import { Badge } from "../../../components/ui/Badge";
import { Paper } from "../../../types/domain";

interface DashboardAnalyticsChartsProps {
  papers: Paper[];
  onSelectPaper?: (paperId: string) => void;
}

type ChartTab = "all" | "topics" | "timeline" | "reading";

export const DashboardAnalyticsCharts: React.FC<DashboardAnalyticsChartsProps> = ({
  papers,
  onSelectPaper,
}) => {
  // Default to "all" so all three analytics sections render side-by-side in one view
  const [activeTab, setActiveTab] = useState<ChartTab>("all");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // 1. Topic & Domain Distribution Analysis
  const topicData = useMemo(() => {
    if (!papers || papers.length === 0) {
      return [
        { label: "Deep Learning & Transformer Models", count: 4, pct: 40, papers: [] },
        { label: "Climate & Environmental Forecasting", count: 3, pct: 30, papers: [] },
        { label: "Renewable Energy & Benchmarking", count: 2, pct: 20, papers: [] },
        { label: "Other Scholarly Domains", count: 1, pct: 10, papers: [] },
      ];
    }

    const domainMap: Record<string, { count: number; papers: Paper[] }> = {};

    papers.forEach((p) => {
      let domain = "General Research";
      const titleLower = (p.title + " " + (p.venue || "")).toLowerCase();

      if (
        titleLower.includes("neural") ||
        titleLower.includes("learning") ||
        titleLower.includes("transformer") ||
        titleLower.includes("llm")
      ) {
        domain = "Neural Networks & Machine Learning";
      } else if (
        titleLower.includes("climatic") ||
        titleLower.includes("climate") ||
        titleLower.includes("weather") ||
        titleLower.includes("chad")
      ) {
        domain = "Climatic & Environmental Sciences";
      } else if (
        titleLower.includes("renewable") ||
        titleLower.includes("energy") ||
        titleLower.includes("forecasting")
      ) {
        domain = "Renewable Energy & Systems";
      } else if (p.venue && p.venue.trim().length > 0) {
        domain = `Domain • ${p.venue.trim()}`;
      } else if (p.tags && p.tags.length > 0) {
        domain = `Topic • ${p.tags[0]}`;
      }

      if (!domainMap[domain]) {
        domainMap[domain] = { count: 0, papers: [] };
      }
      domainMap[domain].count += 1;
      domainMap[domain].papers.push(p);
    });

    const total = papers.length;
    const sorted = Object.entries(domainMap)
      .map(([label, data]) => ({
        label,
        count: data.count,
        pct: Math.round((data.count / total) * 100),
        papers: data.papers,
      }))
      .sort((a, b) => b.count - a.count);

    return sorted;
  }, [papers]);

  // 2. Publication Timeline & Citation Velocity Analysis
  const timelineData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [
      currentYear - 4,
      currentYear - 3,
      currentYear - 2,
      currentYear - 1,
      currentYear,
    ];
    const yearStats: Record<number, { count: number; citations: number }> = {};

    years.forEach((yr) => {
      yearStats[yr] = { count: 0, citations: 0 };
    });

    if (papers && papers.length > 0) {
      papers.forEach((p) => {
        const yr =
          p.year ||
          (p.publicationDate ? new Date(p.publicationDate).getFullYear() : null);
        if (yr && yearStats[yr]) {
          yearStats[yr].count += 1;
          yearStats[yr].citations += p.citationCount || 0;
        } else if (yr && yr >= currentYear - 4) {
          if (!yearStats[yr]) yearStats[yr] = { count: 0, citations: 0 };
          yearStats[yr].count += 1;
          yearStats[yr].citations += p.citationCount || 0;
        }
      });
    }

    const items = Object.entries(yearStats)
      .map(([yearStr, stats]) => ({
        year: Number(yearStr),
        count: stats.count,
        citations: stats.citations,
      }))
      .sort((a, b) => a.year - b.year);

    const maxCount = Math.max(...items.map((i) => i.count), 1);
    const totalCitations = items.reduce((acc, i) => acc + i.citations, 0);

    return { items, maxCount, totalCitations };
  }, [papers]);

  // 3. Reading Progress & Corpus Synthesis
  const readingData = useMemo(() => {
    const total = papers.length;
    if (total === 0) {
      return {
        completed: 0,
        reading: 0,
        unread: 0,
        openAccess: 0,
        completionRate: 0,
      };
    }

    let completed = 0;
    let reading = 0;
    let unread = 0;
    let openAccess = 0;

    papers.forEach((p) => {
      const status = (p.readingStatus || "").toLowerCase();
      if (status === "completed" || status === "read" || status === "synthesized") {
        completed += 1;
      } else if (
        status === "reading" ||
        status === "in_review" ||
        status === "in_progress"
      ) {
        reading += 1;
      } else {
        unread += 1;
      }

      if (p.accessStatus === "open_access") {
        openAccess += 1;
      }
    });

    const completionRate = Math.round((completed / total) * 100);

    return { completed, reading, unread, openAccess, completionRate };
  }, [papers]);

  // Render Component for Topic Bars
  const renderTopicBars = (compact = false) => (
    <div className="space-y-2.5">
      {topicData.slice(0, compact ? 4 : 6).map((topic, idx) => (
        <div
          key={topic.label}
          onMouseEnter={() => setHoveredItem(topic.label)}
          onMouseLeave={() => setHoveredItem(null)}
          className="group relative"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span
              className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2 max-w-[70%]"
              title={topic.label}
            >
              {topic.label}
            </span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <span>
                {topic.count} {topic.count === 1 ? "item" : "items"}
              </span>
              <span className="text-slate-400 font-semibold">{topic.pct}%</span>
            </div>
          </div>
          {/* Bar Track */}
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(topic.pct, 4)}%` }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className={`h-full rounded-full transition-all ${
                idx === 0
                  ? "bg-indigo-600 dark:bg-indigo-500"
                  : idx === 1
                    ? "bg-sky-500 dark:bg-sky-400"
                    : idx === 2
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : "bg-slate-400 dark:bg-slate-500"
              }`}
            />
          </div>

          {/* Hover details if matching papers exist */}
          {hoveredItem === topic.label && topic.papers && topic.papers.length > 0 && (
            <div className="absolute left-0 bottom-full mb-2 z-20 w-72 p-2.5 rounded-lg bg-slate-900 text-white text-xs shadow-xl border border-slate-700 pointer-events-auto animate-in fade-in duration-100">
              <div className="font-semibold text-indigo-300 text-[11px] mb-1">
                Matching Literature ({topic.papers.length}):
              </div>
              <ul className="space-y-1 text-[11px] text-slate-300">
                {topic.papers.slice(0, 3).map((p) => (
                  <li
                    key={p.id}
                    onClick={() => onSelectPaper?.(p.id)}
                    className="truncate list-disc list-inside cursor-pointer hover:text-white hover:underline transition-colors"
                  >
                    {p.title}
                  </li>
                ))}
                {topic.papers.length > 3 && (
                  <li className="text-[10px] text-slate-400 italic">
                    + {topic.papers.length - 3} more in library
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      ))}

      {papers.length < 2 && (
        <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-400 italic">
          <AppIcon icon={Info} size="xs" />
          <span>Automatic topic clustering expands as library grows.</span>
        </div>
      )}
    </div>
  );

  // Render Component for Timeline
  const renderTimeline = (compact = false) => (
    <div className="space-y-3">
      <div
        className={`flex items-end justify-between gap-2 px-1 ${compact ? "h-24 pt-2" : "h-32 pt-4 px-2"}`}
      >
        {timelineData.items.map((item, idx) => {
          const heightPercent =
            timelineData.maxCount > 0
              ? Math.max(
                  Math.round((item.count / timelineData.maxCount) * 100),
                  item.count > 0 ? 15 : 4
                )
              : 4;

          return (
            <div
              key={item.year}
              onMouseEnter={() => setHoveredItem(`year-${item.year}`)}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative cursor-default"
            >
              {hoveredItem === `year-${item.year}` && (
                <div className="absolute bottom-full mb-2 z-20 p-2 rounded-lg bg-slate-900 text-white text-[11px] shadow-lg border border-slate-700 whitespace-nowrap pointer-events-none">
                  <div className="font-semibold text-indigo-300">{item.year} Cohort</div>
                  <div>{item.count} items indexed</div>
                  <div>{item.citations} citations</div>
                </div>
              )}

              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                {item.count > 0 ? `${item.count}v` : "-"}
              </span>

              <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-800 rounded-t-md h-full max-h-[75px] flex items-end overflow-hidden">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercent}%` }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className={`w-full rounded-t-md ${
                    item.count > 0
                      ? "bg-indigo-600 dark:bg-indigo-500 group-hover:bg-indigo-500 transition-colors"
                      : "bg-transparent"
                  }`}
                />
              </div>

              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {item.year}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <AppIcon icon={Sparkles} size="xs" className="text-amber-500" />
          <span>
            Citations:{" "}
            <strong className="text-slate-800 dark:text-slate-200 font-mono">
              {timelineData.totalCitations}
            </strong>
          </span>
        </span>
        <span className="font-mono text-[10px]">
          {new Date().getFullYear()}:{" "}
          {timelineData.items[timelineData.items.length - 1]?.count || 0} items
        </span>
      </div>
    </div>
  );

  // Render Component for Reading Progress
  const renderReadingProgress = (compact = false) => (
    <div
      className={`items-center ${compact ? "space-y-3" : "grid grid-cols-1 md:grid-cols-3 gap-4"}`}
    >
      {/* Radial Gauge */}
      <div className="flex items-center justify-center p-1">
        <div
          className={`relative flex items-center justify-center ${compact ? "w-20 h-20" : "w-28 h-28"}`}
        >
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-emerald-500 dark:stroke-emerald-400"
              strokeWidth="8"
              strokeDasharray="251.2"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{
                strokeDashoffset:
                  251.2 - (251.2 * (readingData.completionRate || 5)) / 100,
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`${compact ? "text-base" : "text-xl"} font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums`}
            >
              {readingData.completionRate}%
            </span>
            <span className="text-[9px] text-slate-400 font-medium">Synthesized</span>
          </div>
        </div>
      </div>

      {/* Status Breakdown List */}
      <div className={`space-y-1.5 ${compact ? "" : "md:col-span-2"}`}>
        <div className="p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
              Completed / Read
            </span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-[11px] tabular-nums">
            {readingData.completed} doc(s)
          </span>
        </div>

        <div className="p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
              In Review / Reading
            </span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-[11px] tabular-nums">
            {readingData.reading} doc(s)
          </span>
        </div>

        <div className="p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
              Unread in Library
            </span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-[11px] tabular-nums">
            {readingData.unread} doc(s)
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
          <span>Open Access:</span>
          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            {readingData.openAccess} / {papers.length} (
            {papers.length > 0
              ? Math.round((readingData.openAccess / papers.length) * 100)
              : 0}
            %)
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
      data-testid="dashboard-analytics-charts"
    >
      {/* Header and Switcher Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <AppIcon icon={BarChart3} size="sm" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Research Visual Analytics
              <Badge
                variant="outline"
                size="sm"
                className="font-mono text-[10px] py-0 px-1.5"
              >
                {papers.length} indexed
              </Badge>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live corpus topology, publication distributions, and reading velocity
            </p>
          </div>
        </div>

        {/* View Switcher Tabs: All in One | Topics | Timeline | Progress */}
        <div
          role="tablist"
          aria-label="Analytics Views"
          className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <AppIcon icon={Layers} size="xs" />
            <span>All in One</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "topics"}
            onClick={() => setActiveTab("topics")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "topics"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <AppIcon icon={BarChart3} size="xs" />
            <span>Topics</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "timeline"}
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "timeline"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <AppIcon icon={TrendingUp} size="xs" />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reading"}
            onClick={() => setActiveTab("reading")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "reading"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <AppIcon icon={PieChart} size="xs" />
            <span>Progress</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Content */}
      <div className="pt-4">
        <AnimatePresence mode="wait">
          {/* VIEW 0: ALL IN ONE (SIDE-BY-SIDE IN ONE VIEW) */}
          {activeTab === "all" && (
            <motion.div
              key="all-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800"
            >
              {/* Section 1: Topics */}
              <div className="space-y-3 md:pr-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="flex items-center gap-1.5">
                    <AppIcon icon={BarChart3} size="xs" className="text-indigo-500" />
                    <span>Topics & Domains</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {topicData.length} clusters
                  </span>
                </div>
                {renderTopicBars(true)}
              </div>

              {/* Section 2: Timeline */}
              <div className="space-y-3 pt-4 md:pt-0 md:px-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="flex items-center gap-1.5">
                    <AppIcon icon={TrendingUp} size="xs" className="text-sky-500" />
                    <span>Publication Timeline</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {timelineData.totalCitations} citations
                  </span>
                </div>
                {renderTimeline(true)}
              </div>

              {/* Section 3: Reading Progress */}
              <div className="space-y-3 pt-4 md:pt-0 md:pl-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="flex items-center gap-1.5">
                    <AppIcon icon={PieChart} size="xs" className="text-emerald-500" />
                    <span>Reading & Synthesis</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    {readingData.completionRate}% done
                  </span>
                </div>
                {renderReadingProgress(true)}
              </div>
            </motion.div>
          )}

          {/* VIEW 1: TOPICS & DOMAINS (FOCUSED) */}
          {activeTab === "topics" && (
            <motion.div
              key="topics-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {renderTopicBars(false)}
            </motion.div>
          )}

          {/* VIEW 2: PUBLICATION TIMELINE (FOCUSED) */}
          {activeTab === "timeline" && (
            <motion.div
              key="timeline-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {renderTimeline(false)}
            </motion.div>
          )}

          {/* VIEW 3: READING PROGRESS & SYNTHESIS (FOCUSED) */}
          {activeTab === "reading" && (
            <motion.div
              key="reading-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {renderReadingProgress(false)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
