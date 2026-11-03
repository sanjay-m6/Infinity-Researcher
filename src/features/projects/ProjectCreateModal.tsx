import React, { useState } from "react";
import {
  X,
  Sparkles,
  Calendar,
  Layers,
  HelpCircle,
  Lightbulb,
  Target,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  CreateProjectInput,
  createResearchProject,
  ResearchProject,
} from "../../lib/desktop-api";
import { DomainSelector } from "./components/DomainSelector";
import { Button } from "../../components/ui/Button";

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: ResearchProject) => void;
}

const TEMPLATE_PRESETS = [
  {
    type: "literature_review",
    title: "Literature Review & Synthesis",
    desc: "Systematic literature survey, matrix synthesis, and gap analysis.",
    defaultObjective:
      "Conduct a comprehensive systematic review of literature, synthesize methodologies, and identify key research gaps.",
    defaultQuestions:
      "What are the primary methodologies used in recent studies?\nWhat are the common limitations identified in literature?",
  },
  {
    type: "empirical_ml",
    title: "Empirical ML / Benchmark",
    desc: "Dataset curation, baseline models, experimental evaluation, and ablation studies.",
    defaultObjective:
      "Design and evaluate a novel machine learning pipeline against standard benchmark datasets.",
    defaultQuestions:
      "How does our proposed architecture compare to SOTA baselines?\nWhat are the computational trade-offs?",
  },
  {
    type: "thesis_dissertation",
    title: "Thesis / Dissertation",
    desc: "Structured multi-chapter dissertation planning from proposal to defense.",
    defaultObjective:
      "Complete a graduate-level thesis addressing fundamental open questions in the domain.",
    defaultQuestions:
      "What novel theoretical or practical contribution does this research offer?",
  },
  {
    type: "comparative_study",
    title: "Comparative Analysis",
    desc: "Side-by-side empirical or theoretical comparison across models and algorithms.",
    defaultObjective:
      "Perform a rigorous empirical comparison across competing algorithms under identical constraints.",
    defaultQuestions: "Under what conditions does algorithm A outperform algorithm B?",
  },
  {
    type: "custom",
    title: "Blank Project",
    desc: "Start from scratch with custom objectives and phases.",
    defaultObjective: "",
    defaultQuestions: "",
  },
];

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [researchQuestions, setResearchQuestions] = useState("");
  const [hypotheses, setHypotheses] = useState("");
  const [expectedOutcomes, setExpectedOutcomes] = useState("");
  const [targetDeadline, setTargetDeadline] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">(
    "medium"
  );
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedSubdomainId, setSelectedSubdomainId] = useState<string | null>(null);
  const [customDomainText, setCustomDomainText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("literature_review");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTemplateSelect = (type: string) => {
    setSelectedTemplate(type);
    const preset = TEMPLATE_PRESETS.find((p) => p.type === type);
    if (preset) {
      if (preset.defaultObjective && !objective) {
        setObjective(preset.defaultObjective);
      }
      if (preset.defaultQuestions && !researchQuestions) {
        setResearchQuestions(preset.defaultQuestions);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a project title.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const input: CreateProjectInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        objective: objective.trim() || undefined,
        research_questions: researchQuestions.trim() || undefined,
        hypotheses: hypotheses.trim() || undefined,
        expected_outcomes: expectedOutcomes.trim() || undefined,
        primary_domain_id: selectedDomainId || undefined,
        subdomain_id: selectedSubdomainId || undefined,
        custom_domain_text: customDomainText.trim() || undefined,
        priority,
        target_deadline: targetDeadline
          ? new Date(targetDeadline).toISOString()
          : undefined,
        template_type: selectedTemplate,
        tags,
      };

      const project = await createResearchProject(input);
      onProjectCreated(project);
      onClose();
    } catch (err: any) {
      console.error("Failed to create research project:", err);
      setError(err?.message || "Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">New Research Project</h2>
              <p className="text-xs text-muted-foreground">
                Define your research scope, domain, objectives, and planning framework
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Templates */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Project Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {TEMPLATE_PRESETS.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleTemplateSelect(t.type)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTemplate === t.type
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="text-xs font-semibold text-foreground">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Project Title & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Project Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Decentralized Zero-Knowledge Proofs for Smart Grid Privacy"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical / Urgent</option>
              </select>
            </div>
          </div>

          {/* Research Domain Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Research Domain & Subdiscipline
            </label>
            <DomainSelector
              selectedDomainId={selectedDomainId}
              selectedSubdomainId={selectedSubdomainId}
              customDomainText={customDomainText}
              onChange={(domId, subId, custom) => {
                setSelectedDomainId(domId);
                setSelectedSubdomainId(subId);
                if (custom !== undefined) setCustomDomainText(custom);
              }}
            />
          </div>

          {/* Description & Objective */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Brief Overview / Summary
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of this research project..."
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" />
                Research Objective
              </label>
              <textarea
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Core primary goal or mission of this investigation..."
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  Research Questions
                </label>
                <textarea
                  rows={3}
                  value={researchQuestions}
                  onChange={(e) => setResearchQuestions(e.target.value)}
                  placeholder="RQ1: ...&#10;RQ2: ..."
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                  Hypotheses & Expected Outcomes
                </label>
                <textarea
                  rows={3}
                  value={hypotheses}
                  onChange={(e) => {
                    setHypotheses(e.target.value);
                    setExpectedOutcomes(e.target.value);
                  }}
                  placeholder="H1: Applying zero-knowledge proofs reduces transaction verification overhead by 30%..."
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-xs"
                />
              </div>
            </div>
          </div>

          {/* Target Deadline & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Target Completion Deadline
              </label>
              <input
                type="date"
                value={targetDeadline}
                onChange={(e) => setTargetDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="zk-SNARKs, Smart Grids, Privacy, IEEE-Paper"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI Project Planner can generate milestones and tasks once created
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-2"
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
