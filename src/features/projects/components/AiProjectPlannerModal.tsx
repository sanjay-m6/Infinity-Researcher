import React, { useState } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  AiProjectPlanProposal,
  generateAiProjectPlan,
  applyAiProjectPlan,
  ApplyPlanInput,
  ProposedMilestone,
} from "../../../lib/desktop-api";
import { Button } from "../../../components/ui/Button";

interface AiProjectPlannerModalProps {
  projectId: string;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onPlanApplied: () => void;
}

export const AiProjectPlannerModal: React.FC<AiProjectPlannerModalProps> = ({
  projectId,
  projectTitle,
  isOpen,
  onClose,
  onPlanApplied,
}) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<AiProjectPlanProposal | null>(null);
  const [selectedMilestones, setSelectedMilestones] = useState<ProposedMilestone[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await generateAiProjectPlan(projectId);
      setProposal(res);
      setSelectedMilestones(res.milestones);
    } catch (err: any) {
      console.error("Failed to generate AI plan:", err);
      setError(err?.message || "Failed to generate research plan. Please ensure AI providers are configured.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!proposal || selectedMilestones.length === 0) return;

    try {
      setApplying(true);
      setError(null);

      const input: ApplyPlanInput = {
        project_id: projectId,
        milestones: selectedMilestones,
      };

      await applyAiProjectPlan(input);
      onPlanApplied();
      onClose();
    } catch (err: any) {
      console.error("Failed to apply plan:", err);
      setError(err?.message || "Failed to apply plan to project.");
    } finally {
      setApplying(false);
    }
  };

  const handleToggleTask = (mIndex: number, tIndex: number) => {
    const updated = [...selectedMilestones];
    const targetTask = updated[mIndex].tasks[tIndex];
    if (targetTask) {
      // Toggle or remove
      updated[mIndex].tasks.splice(tIndex, 1);
      setSelectedMilestones(updated);
    }
  };

  const handleRemoveMilestone = (mIndex: number) => {
    const updated = [...selectedMilestones];
    updated.splice(mIndex, 1);
    setSelectedMilestones(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                AI Project Planner & Roadmap Generator
              </h2>
              <p className="text-xs text-muted-foreground">
                Targeting Project: <span className="font-semibold text-foreground">{projectTitle}</span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!proposal && !loading && (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-semibold text-foreground">
                  Generate Structured Research Roadmap
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  The AI planner analyzes your project objective, hypotheses, domain, and literature
                  to structure an actionable work breakdown with chronological milestones, tasks, and
                  estimated effort.
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Plan Now
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Synthesizing research questions into milestones & tasks...
              </p>
              <p className="text-xs text-muted-foreground">
                Grounding with domain best practices and research workflows
              </p>
            </div>
          )}

          {proposal && !loading && (
            <div className="space-y-6">
              {/* Proposal Overview Banner */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Proposed Research Strategy
                  </h4>
                  {proposal.estimated_total_weeks && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      Est. {proposal.estimated_total_weeks} weeks
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {proposal.methodology_strategy}
                </p>
                {proposal.recommended_paper_search_queries &&
                  proposal.recommended_paper_search_queries.length > 0 && (
                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Recommended Queries:
                      </span>
                      {proposal.recommended_paper_search_queries.map((q, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-foreground font-mono"
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Milestones and Tasks Review */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Proposed Milestones & Tasks ({selectedMilestones.length} milestones,{" "}
                    {selectedMilestones.reduce((acc, m) => acc + m.tasks.length, 0)} tasks)
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Review and adjust tasks before approving
                  </span>
                </div>

                <div className="space-y-4">
                  {selectedMilestones.map((milestone, mIdx) => (
                    <div
                      key={mIdx}
                      className="border border-border rounded-xl bg-card overflow-hidden"
                    >
                      {/* Milestone Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            {mIdx + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {milestone.title}
                            </div>
                            {milestone.description && (
                              <div className="text-xs text-muted-foreground">
                                {milestone.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {milestone.suggested_days_from_start !== undefined && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Day {milestone.suggested_days_from_start}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(mIdx)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove milestone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Milestone Tasks */}
                      <div className="divide-y divide-border/40 p-2">
                        {milestone.tasks.map((task, tIdx) => (
                          <div
                            key={tIdx}
                            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <div className="text-xs font-medium text-foreground">
                                  {task.title}
                                </div>
                                {task.description && (
                                  <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                    {task.description}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground uppercase font-semibold">
                                    {task.phase}
                                  </span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase ${task.priority === "critical"
                                        ? "bg-red-500/10 text-red-600"
                                        : task.priority === "high"
                                          ? "bg-amber-500/10 text-amber-600"
                                          : "bg-blue-500/10 text-blue-600"
                                      }`}
                                  >
                                    {task.priority}
                                  </span>
                                  {task.estimated_hours && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {task.estimated_hours}h
                                    </span>
                                  )}
                                  {task.prerequisite_indexes &&
                                    task.prerequisite_indexes.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Depends on #{task.prerequisite_indexes.map((i) => i + 1).join(", #")}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleTask(mIdx, tIdx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              title="Remove task"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <div>
            {proposal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={loading || applying}
                className="text-xs"
              >
                Regenerate Proposal
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            {proposal && (
              <Button
                type="button"
                onClick={handleApplyPlan}
                disabled={applying || selectedMilestones.length === 0}
                className="flex items-center gap-2"
              >
                {applying ? "Applying..." : "Approve & Apply Plan to Project"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
