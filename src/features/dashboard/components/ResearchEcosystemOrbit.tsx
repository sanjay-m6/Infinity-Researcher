import React, { useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Atom,
  Database,
  Brain,
  ShieldCheck,
  Table,
  CheckCircle2,
  FileText,
  Layers,
  FileCode,
  Lock,
  Search,
  ExternalLink,
} from "lucide-react";
import { AppIcon } from "../../../components/icons/AppIcon";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useApp } from "../../../context/AppContext";
import { cn } from "../../../lib/utils";

interface ResearchOrbitNode {
  id: string;
  name: string;
  category: "Repository" | "AI Engine" | "Architecture";
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  actionSection?: string;
  badge?: string;
  colorClass: string;
}

const REPOSITORY_NODES: ResearchOrbitNode[] = [
  {
    id: "arxiv",
    name: "arXiv Preprints",
    category: "Repository",
    icon: BookOpen,
    description: "2.4M+ open access physics, math & CS preprints",
    actionSection: "discover",
    badge: "Open Access",
    colorClass: "text-rose-500 border-rose-500/40 bg-rose-500/10",
  },
  {
    id: "openalex",
    name: "OpenAlex Graph",
    category: "Repository",
    icon: Database,
    description: "250M+ global cross-linked scholarly entities",
    actionSection: "discover",
    badge: "Global Graph",
    colorClass: "text-indigo-500 border-indigo-500/40 bg-indigo-500/10",
  },
  {
    id: "pubmed",
    name: "PubMed & BioRxiv",
    category: "Repository",
    icon: Atom,
    description: "36M+ biomedical and life science citations",
    actionSection: "discover",
    badge: "Biomedical",
    colorClass: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
  },
  {
    id: "crossref",
    name: "Crossref Metadata",
    category: "Repository",
    icon: Search,
    description: "Authoritative DOI resolution and publisher metadata",
    actionSection: "discover",
    badge: "DOI Engine",
    colorClass: "text-amber-500 border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "ieee",
    name: "IEEE Xplore",
    category: "Repository",
    icon: ShieldCheck,
    description: "Direct engineering & electrical science papers",
    actionSection: "ieee",
    badge: "Direct",
    colorClass: "text-sky-500 border-sky-500/40 bg-sky-500/10",
  },
];

const AI_INTELLIGENCE_NODES: ResearchOrbitNode[] = [
  {
    id: "matrix",
    name: "Review Matrix",
    category: "AI Engine",
    icon: Table,
    description: "9-dimensional cross-paper comparative extraction",
    actionSection: "review_matrix",
    badge: "Synthesis",
    colorClass: "text-amber-500 border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "copilot",
    name: "Evidence Copilot",
    category: "AI Engine",
    icon: Brain,
    description: "Grounded multi-turn RAG with clickable PDF citations",
    actionSection: "research_assistant",
    badge: "Grounded RAG",
    colorClass: "text-purple-500 border-purple-500/40 bg-purple-500/10",
  },
  {
    id: "citations",
    name: "Citation Audit",
    category: "AI Engine",
    icon: CheckCircle2,
    description: "Contextual reference validation and claim audit",
    actionSection: "citation_checker",
    badge: "Integrity",
    colorClass: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
  },
  {
    id: "workspace",
    name: "Literature 3-Pane",
    category: "AI Engine",
    icon: Layers,
    description: "Multi-panel reading, notes and real-time extraction",
    actionSection: "literature_workspace",
    badge: "Interactive",
    colorClass: "text-indigo-500 border-indigo-500/40 bg-indigo-500/10",
  },
];

const SOVEREIGN_NODES: ResearchOrbitNode[] = [
  {
    id: "sqlite",
    name: "SQLite Local WAL",
    category: "Architecture",
    icon: Database,
    description: "100% offline-ready embedded transactional store",
    badge: "Zero Latency",
    colorClass: "text-sky-500 border-sky-500/40 bg-sky-500/10",
  },
  {
    id: "privacy",
    name: "Zero Telemetry",
    category: "Architecture",
    icon: Lock,
    description: "Strict privacy guarantee: no analytics or remote logging",
    actionSection: "privacy_security",
    badge: "Sovereign",
    colorClass: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
  },
  {
    id: "export",
    name: "BibTeX & LaTeX",
    category: "Architecture",
    icon: FileCode,
    description: "Instant export to standard academic formats",
    badge: "Standard",
    colorClass: "text-amber-500 border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "pdf",
    name: "Full-Text Engine",
    category: "Architecture",
    icon: FileText,
    description: "Native Rust and Python high-fidelity document parsing",
    badge: "Native Rust",
    colorClass: "text-rose-500 border-rose-500/40 bg-rose-500/10",
  },
];

export const ResearchEcosystemOrbit: React.FC = () => {
  const { setActiveSection } = useApp();
  const [selectedNode, setSelectedNode] = useState<ResearchOrbitNode>(REPOSITORY_NODES[0]);
  const [isPaused, setIsPaused] = useState(false);

  const handleNodeClick = (node: ResearchOrbitNode) => {
    setSelectedNode(node);
    if (node.actionSection) {
      // Allow user to click to navigate
    }
  };

  return (
    <div
      className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs relative overflow-hidden"
      data-testid="research-ecosystem-orbit"
    >
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left / Info Side */}
        <div className="w-full lg:w-5/12 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <AppIcon icon={Atom} size="sm" />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Scholarly Research Orbit
                <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                  13 Active Cores
                </Badge>
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Concentric intelligence architecture linking repositories, neural extraction models, and sovereign local storage
            </p>
          </div>

          {/* Active Node Detail Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg border", selectedNode.colorClass)}>
                  <AppIcon icon={selectedNode.icon} size="xs" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {selectedNode.name}
                  </h3>
                  <span className="text-[10px] text-slate-400">{selectedNode.category}</span>
                </div>
              </div>
              {selectedNode.badge && (
                <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                  {selectedNode.badge}
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {selectedNode.description}
            </p>

            {selectedNode.actionSection && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSection(selectedNode.actionSection as any)}
                  className="h-7 text-xs gap-1.5 w-full justify-center text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                >
                  <span>Launch {selectedNode.name}</span>
                  <AppIcon icon={ExternalLink} size="xs" />
                </Button>
              </div>
            )}
          </div>

          {/* Orbit Tier Legend */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 text-center">
              <span className="block font-semibold text-slate-800 dark:text-slate-200">Orbit 1</span>
              <span className="text-[10px] text-rose-500">Repositories</span>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 text-center">
              <span className="block font-semibold text-slate-800 dark:text-slate-200">Orbit 2</span>
              <span className="text-[10px] text-purple-500">AI Engines</span>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 text-center">
              <span className="block font-semibold text-slate-800 dark:text-slate-200">Orbit 3</span>
              <span className="text-[10px] text-sky-500">Sovereignty</span>
            </div>
          </div>
        </div>

        {/* Right / Concentric Orbit Visualization */}
        <div
          className="w-full lg:w-7/12 flex items-center justify-center min-h-[340px] relative select-none"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="relative w-[320px] h-[320px] sm:w-[350px] sm:h-[350px] flex items-center justify-center">
            {/* Center: Academic Knowledge Core */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-600 dark:to-indigo-900 text-white flex flex-col items-center justify-center shadow-xl border-2 border-indigo-300 dark:border-indigo-400/40 z-20 cursor-default">
              <GraduationCap className="w-8 h-8 drop-shadow-xs" />
              <span className="text-[9px] font-mono font-bold tracking-wider uppercase mt-0.5">
                Core
              </span>
            </div>

            {/* Orbit 1: Academic Repositories (Radius: 130px) */}
            <div
              className="absolute rounded-full border border-rose-500/20 dark:border-rose-500/30 border-dashed pointer-events-none"
              style={{
                width: "140px",
                height: "140px",
                animation: `orbit-spin 24s linear infinite`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {REPOSITORY_NODES.map((node, idx) => {
                const angle = (idx * 2 * Math.PI) / REPOSITORY_NODES.length;
                const x = 50 + 50 * Math.cos(angle);
                const y = 50 + 50 * Math.sin(angle);
                const isSelected = selectedNode.id === node.id;
                const NodeIcon = node.icon;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    title={`${node.name} (${node.category})`}
                    className={cn(
                      "absolute rounded-full p-2 border shadow-sm backdrop-blur-xs transition-all pointer-events-auto cursor-pointer",
                      isSelected
                        ? "ring-2 ring-rose-500 scale-125 bg-rose-50 dark:bg-rose-950 border-rose-500 text-rose-600 dark:text-rose-300 z-30"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:scale-115 hover:border-rose-400"
                    )}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <NodeIcon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>

            {/* Orbit 2: AI Intelligence & Review Matrix (Radius: 210px) */}
            <div
              className="absolute rounded-full border border-purple-500/20 dark:border-purple-500/30 border-dashed pointer-events-none"
              style={{
                width: "220px",
                height: "220px",
                animation: `orbit-spin 36s linear infinite reverse`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {AI_INTELLIGENCE_NODES.map((node, idx) => {
                const angle = (idx * 2 * Math.PI) / AI_INTELLIGENCE_NODES.length;
                const x = 50 + 50 * Math.cos(angle);
                const y = 50 + 50 * Math.sin(angle);
                const isSelected = selectedNode.id === node.id;
                const NodeIcon = node.icon;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    title={`${node.name} (${node.category})`}
                    className={cn(
                      "absolute rounded-full p-2 border shadow-sm backdrop-blur-xs transition-all pointer-events-auto cursor-pointer",
                      isSelected
                        ? "ring-2 ring-purple-500 scale-125 bg-purple-50 dark:bg-purple-950 border-purple-500 text-purple-600 dark:text-purple-300 z-30"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:scale-115 hover:border-purple-400"
                    )}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <NodeIcon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>

            {/* Orbit 3: Sovereign Storage & Architecture (Radius: 290px) */}
            <div
              className="absolute rounded-full border border-sky-500/20 dark:border-sky-500/30 border-dashed pointer-events-none"
              style={{
                width: "300px",
                height: "300px",
                animation: `orbit-spin 48s linear infinite`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {SOVEREIGN_NODES.map((node, idx) => {
                const angle = (idx * 2 * Math.PI) / SOVEREIGN_NODES.length;
                const x = 50 + 50 * Math.cos(angle);
                const y = 50 + 50 * Math.sin(angle);
                const isSelected = selectedNode.id === node.id;
                const NodeIcon = node.icon;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    title={`${node.name} (${node.category})`}
                    className={cn(
                      "absolute rounded-full p-2 border shadow-sm backdrop-blur-xs transition-all pointer-events-auto cursor-pointer",
                      isSelected
                        ? "ring-2 ring-sky-500 scale-125 bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-600 dark:text-sky-300 z-30"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:scale-115 hover:border-sky-400"
                    )}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <NodeIcon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ResearchEcosystemOrbit;
