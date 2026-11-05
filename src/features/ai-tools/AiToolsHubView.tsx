import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { NavSection } from "../../types/domain";
import {
  Cpu,
  ScanEye,
  FileSearch,
  PenTool,
  RefreshCw,
  CheckCircle2,
  BarChart2,
  ShieldCheck,
  Search,
  ArrowRight,
  Check,
  Zap,
  Settings,
  HardDrive,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { InAppModelManagerModal } from "./components/InAppModelManagerModal";
import {
  getAiEngineStatus,
  getHardwareProfile,
  type LocalAiStatus,
  type HardwareProfile,
} from "../../lib/desktop-api";

export type AiToolCategory = "all" | "detection" | "writing" | "quality" | "citation";

export interface AiToolMetadata {
  id: NavSection;
  name: string;
  category: "detection" | "writing" | "quality" | "citation";
  categoryLabel: string;
  shortDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  mainUseCase: string;
  statusLabel: string;
  statusType: "success" | "primary" | "warning" | "info";
  features: string[];
}

export const AI_TOOLS_REGISTRY: AiToolMetadata[] = [
  {
    id: "ai_writing_detector",
    name: "AI Writing Detector",
    category: "detection",
    categoryLabel: "Detection and Verification",
    shortDescription:
      "Empirical stylometric analysis evaluating perplexity variance, sentence length uniformity, and lexical burstiness.",
    icon: ScanEye,
    iconColor: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800",
    mainUseCase:
      "Screen draft manuscripts or student submissions for automated machine generation signatures without external data leakage.",
    statusLabel: "Local Heuristics · Ready",
    statusType: "success",
    features: [
      "Perplexity Variance",
      "Burstiness Metric",
      "Sentence Uniformity",
      "Zero Cloud Transmission",
    ],
  },
  {
    id: "plagiarism_checker",
    name: "Plagiarism Checker",
    category: "detection",
    categoryLabel: "Detection and Verification",
    shortDescription:
      "Winnowing n-gram fingerprint comparison against your saved library papers and open academic reference corpus.",
    icon: FileSearch,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg:
      "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    mainUseCase:
      "Detect unquoted verbatim text, missing citation anchors, and accidental duplication against your private paper library.",
    statusLabel: "Library Corpus · Active",
    statusType: "success",
    features: [
      "Winnowing Fingerprints",
      "Exact Phrase Matching",
      "Local Paper Library Index",
      "Quote Exclusion",
    ],
  },
  {
    id: "ai_humanizer",
    name: "AI Humanizer",
    category: "writing",
    categoryLabel: "Writing and Editing",
    shortDescription:
      "Restructures repetitive machine cadence and monotonous sentence structures into authentic scholarly syntax with strict invariant token guarding.",
    icon: Zap,
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
    mainUseCase:
      "Elevate synthesized drafts into natural academic discourse with varied syntax while retaining 100% conceptual accuracy. Not intended to bypass AI detectors.",
    statusLabel: "Connected LLM · Ready",
    statusType: "primary",
    features: [
      "Sentence Length Variation",
      "Natural Transition Smoothing",
      "Anti-Cliché Filtering",
      "Peer Review Voice",
    ],
  },
  {
    id: "academic_writing_assistant",
    name: "Academic Writing Assistant",
    category: "writing",
    categoryLabel: "Writing and Editing",
    shortDescription:
      "Context-aware academic rewriting, active/passive voice balancing, and scientific terminology calibration.",
    icon: PenTool,
    iconColor: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800",
    mainUseCase:
      "Polish manuscript sections (Abstract, Methodology, Discussion) to meet high-impact journal standards.",
    statusLabel: "Local / Ollama · Ready",
    statusType: "primary",
    features: [
      "Clarity & Precision",
      "Journal Tone Calibration",
      "Passive Voice Balancer",
      "Formula & Citation Guard",
    ],
  },
  {
    id: "paraphrasing_tool",
    name: "Paraphrasing Tool",
    category: "writing",
    categoryLabel: "Writing and Editing",
    shortDescription:
      "Scholarly rephrasing with strict verbatim preservation of equations, numbers, author citations, and canonical DOIs.",
    icon: RefreshCw,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
    mainUseCase:
      "Express complex related work and technical background concepts with fresh scholarly phrasing without altering scientific meaning.",
    statusLabel: "Precision Engine · Ready",
    statusType: "success",
    features: [
      "Citation Locking",
      "Mathematical Symbol Guard",
      "Multi-Variation Output",
      "Dense Synthesis Mode",
    ],
  },
  {
    id: "citation_checker",
    name: "Citation Checker",
    category: "citation",
    categoryLabel: "Citation and References",
    shortDescription:
      "Validates canonical DOIs, cross-checks BibTeX keys, detects broken references, and standardizes IEEE/APA formats.",
    icon: CheckCircle2,
    iconColor: "text-cyan-600 dark:text-cyan-400",
    iconBg: "bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800",
    mainUseCase:
      "Ensure reference integrity and eliminate broken links, missing publication years, or unreferenced citations before submission.",
    statusLabel: "Crossref Validator · Active",
    statusType: "info",
    features: [
      "DOI Resolution Check",
      "BibTeX Syntax Validation",
      "IEEE / APA Auto-Format",
      "Missing Citation Detection",
    ],
  },
  {
    id: "readability_analyzer",
    name: "Readability Analyzer",
    category: "quality",
    categoryLabel: "Academic Quality",
    shortDescription:
      "Empirical metrics computing Flesch-Kincaid Grade Level, Gunning Fog Index, SMOG index, and lexical diversity.",
    icon: BarChart2,
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
    mainUseCase:
      "Evaluate manuscript accessibility and sentence complexity against target journal reading level distributions.",
    statusLabel: "Algorithmic Engine · Ready",
    statusType: "success",
    features: [
      "Flesch Reading Ease",
      "Gunning Fog Index",
      "Coleman-Liau Metric",
      "Syllable & Polysyllabic Counts",
    ],
  },
  {
    id: "research_integrity",
    name: "Research Integrity",
    category: "quality",
    categoryLabel: "Academic Quality",
    shortDescription:
      "Peer-review readiness audit, methodology transparency checklist, and data availability statement generator.",
    icon: ShieldCheck,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg:
      "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    mainUseCase:
      "Verify publishing ethics compliance, conflict-of-interest declarations, and open science transparency statements.",
    statusLabel: "Ethics Auditor · Ready",
    statusType: "info",
    features: [
      "Preprint & OA Check",
      "Data Availability Builder",
      "COI Disclosures",
      "Submission Readiness Score",
    ],
  },
];

export const AiToolsHubView: React.FC = () => {
  const { setActiveSection } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<AiToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState<LocalAiStatus>({
    is_running: false,
    port: 11435,
    active_model: null,
    endpoint: "http://127.0.0.1:11435",
  });
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [status, hw] = await Promise.all([
          getAiEngineStatus(),
          getHardwareProfile(),
        ]);
        setEngineStatus(status);
        setHardware(hw);
      } catch (err) {
        console.error("Failed to query local AI status:", err);
      }
    })();
  }, []);

  const filteredTools = useMemo(() => {
    return AI_TOOLS_REGISTRY.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" || tool.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.mainUseCase.toLowerCase().includes(q) ||
        tool.features.some((f) => f.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const categories: { id: AiToolCategory; label: string; count: number }[] = [
    { id: "all", label: "All Tools", count: AI_TOOLS_REGISTRY.length },
    {
      id: "detection",
      label: "Detection and Verification",
      count: AI_TOOLS_REGISTRY.filter((t) => t.category === "detection").length,
    },
    {
      id: "writing",
      label: "Writing and Editing",
      count: AI_TOOLS_REGISTRY.filter((t) => t.category === "writing").length,
    },
    {
      id: "quality",
      label: "Academic Quality",
      count: AI_TOOLS_REGISTRY.filter((t) => t.category === "quality").length,
    },
    {
      id: "citation",
      label: "Citation and References",
      count: AI_TOOLS_REGISTRY.filter((t) => t.category === "citation").length,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="rounded-xl bg-slate-900 p-6 sm:p-8 text-white border border-slate-800 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Research & Writing Suite</span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 leading-none">
              Beta
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Professional AI Academic Tools
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            A comprehensive suite of local-first research writing, detection, readability,
            and verification tools. Designed specifically for peer-reviewed publishing
            standards with zero privacy compromise.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>8 Specialized Academic Tools</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>100% Local Heuristics Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Preserves DOIs & Equations</span>
            </div>
          </div>
        </div>
      </div>

      {/* In-App AI Engine & Model Panel Banner */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              engineStatus.is_running
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60"
            }`}
          >
            <HardDrive className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                In-App AI Engine & Model Panel
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  engineStatus.is_running
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }`}
              >
                {engineStatus.is_running
                  ? `Active: ${engineStatus.active_model || "DeepSeek-R1"}`
                  : "Offline (0 MB RAM used)"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {engineStatus.is_running
                ? `Running on port ${engineStatus.port} with low-RAM 4-bit KV cache & mmap.`
                : hardware
                  ? `System RAM: ${(hardware.total_ram_mb / 1024).toFixed(1)} GB. Recommended: DeepSeek-R1 (8B Reasoning SOTA) & Qwen 2.5 (7B).`
                  : "Run top-tier open-source models (DeepSeek-R1, Qwen 2.5, Llama 3.1) locally with zero external setup."}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModelModalOpen(true)}
          className="shrink-0 text-xs gap-1.5 shadow-xs"
        >
          <Settings className="w-3.5 h-3.5 mr-1" />
          <span>Open AI Model Panel</span>
        </Button>
      </div>

      {/* Controls: Search & Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AI tools by name, capability, or use case..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs font-semibold"
                    : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700/80"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-indigo-700 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Grid */}
      {filteredTools.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No AI tools match &ldquo;{searchQuery}&rdquo;
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try adjusting your search query or selecting a different category filter.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Icon, Category Badge & Availability Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-2xs shrink-0 transition-transform group-hover:scale-105 ${tool.iconBg}`}
                      >
                        <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tool.name}
                        </h2>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {tool.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <Badge variant={tool.statusType} size="sm">
                      {tool.statusLabel}
                    </Badge>
                  </div>

                  {/* Short Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tool.shortDescription}
                  </p>

                  {/* Main Use Case Box */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                      Main Use Case:
                    </span>
                    {tool.mainUseCase}
                  </div>

                  {/* Key Capabilities Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tool.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Ready for manuscript analysis
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveSection(tool.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Open Tool</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Model Downloader & Sidecar Manager Modal */}
      <InAppModelManagerModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onStatusChange={(status) => setEngineStatus(status)}
      />
    </div>
  );
};
