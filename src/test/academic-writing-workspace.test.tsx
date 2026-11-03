import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { AcademicWritingWorkspaceView } from "../features/writing-workspace/AcademicWritingWorkspaceView";
import {
  extractInvariantTokens,
  validatePreservationAndSemantics,
} from "../features/writing-workspace/tokenPreservationGuard";
import {
  applyLocalHeuristicRewriting,
  computeWordDiff,
  generateParaphraseAttributionNotice,
  HUMANIZER_MODES,
  ACADEMIC_WRITING_MODES,
  PARAPHRASING_MODES,
} from "../features/writing-workspace/writingEngine";

// Mock Tauri bridge so we run purely in test environment
vi.mock("../lib/tauri-bridge", () => ({
  isTauriEnvironment: () => false,
  normalizeCommandError: (err: unknown) => err,
  getErrorMessage: (err: unknown) => String(err),
}));

describe("Phase 5 — Token Preservation Guard & Semantic Validation", () => {
  it("extracts citations, DOIs, URLs, and mathematical notations verbatim", () => {
    const sample = `Recent progress in transformers [1] and multi-head attention (Vaswani et al., 2017) has established state of the art benchmarks under DOI 10.1109/ACCESS.2023.1042918. Formally, energy is governed by $E=mc^2$ with significance p < 0.05. Access repo at https://github.com/example/paper.`;

    const tokens = extractInvariantTokens(sample);
    const types = tokens.map((t) => t.type);

    expect(types).toContain("citation");
    expect(types).toContain("doi");
    expect(types).toContain("equation");
    expect(types).toContain("url");
    expect(types).toContain("statistical_result");

    const citationVals = tokens.filter((t) => t.type === "citation").map((t) => t.value);
    expect(citationVals).toContain("[1]");
    expect(citationVals).toContain("(Vaswani et al., 2017)");

    const doiVals = tokens.filter((t) => t.type === "doi").map((t) => t.value);
    expect(doiVals).toContain("10.1109/ACCESS.2023.1042918");
  });

  it("extracts quantities, units, technical identifiers, and negations", () => {
    const sample = `The ResNet-50 network executed at 3.5 GHz using 250 mg of substrate. Crucially, the model did not yield a 14.2% error rate and was not statistically significant.`;

    const tokens = extractInvariantTokens(sample);
    const rawTokens = tokens.map((t) => t.value);

    expect(rawTokens).toContain("ResNet-50");
    expect(rawTokens).toContain("3.5 GHz");
    expect(rawTokens).toContain("250 mg");
    expect(rawTokens).toContain("14.2%");
    expect(tokens.some((t) => t.type === "negation")).toBe(true);
  });

  it("flags critical semantic drift when correlation is converted to causation", () => {
    const original = `Our empirical data indicates that caffeine intake is correlated with increased cognitive processing speed.`;
    const corruptedRevision = `Our empirical data proves that caffeine intake causes increased cognitive processing speed.`;

    const result = validatePreservationAndSemantics(original, corruptedRevision);

    expect(result.passed).toBe(false);
    expect(result.criticalIssuesCount).toBeGreaterThan(0);
    const driftIssue = result.issues.find((i) => i.id === "drift_correlation_causation");
    expect(driftIssue).toBeDefined();
    expect(driftIssue?.severity).toBe("critical");
    expect(driftIssue?.title).toMatch(/Correlation transformed into Causation/i);
  });

  it("flags critical inversion when statistical non-significance is altered to significant", () => {
    const original = `The observed difference between the control group and the intervention was not statistically significant (p = 0.14).`;
    const corruptedRevision = `The observed difference between the control group and the intervention was statistically significant (p = 0.14).`;

    const result = validatePreservationAndSemantics(original, corruptedRevision);

    expect(result.passed).toBe(false);
    expect(result.criticalIssuesCount).toBeGreaterThan(0);
    const sigIssue = result.issues.find((i) => i.id === "drift_significance_inverted");
    expect(sigIssue).toBeDefined();
    expect(sigIssue?.severity).toBe("critical");
  });

  it("flags warning when study limitations and hedging language are stripped", () => {
    const original = `The algorithm may improve memory access latency, though this preliminary finding is constrained by small sample size and further research is warranted.`;
    const strippedRevision = `The algorithm will improve memory access latency across all enterprise architectures.`;

    const result = validatePreservationAndSemantics(original, strippedRevision);

    expect(result.warningIssuesCount).toBeGreaterThan(0);
    const limitationIssue = result.issues.find(
      (i) => i.id === "drift_limitation_removed"
    );
    expect(limitationIssue).toBeDefined();
  });

  it("passes high-fidelity revision where citations and invariants are strictly preserved", () => {
    const original = `In recent years, deep learning models [1] have revolutionized document retrieval, achieving a 14.2% precision gain under DOI 10.1109/ACCESS.2023.1042918 ($E=mc^2$).`;
    const validRevision = `Over the past decade, deep learning models [1] have fundamentally reshaped document retrieval, achieving a 14.2% precision gain under DOI 10.1109/ACCESS.2023.1042918 ($E=mc^2$).`;

    const result = validatePreservationAndSemantics(original, validRevision);

    expect(result.passed).toBe(true);
    expect(result.criticalIssuesCount).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});

describe("Phase 5 — Writing Engine & Local Heuristics", () => {
  it("contains all 12 Humanizer modes", () => {
    expect(HUMANIZER_MODES).toHaveLength(12);
    const modeIds = HUMANIZER_MODES.map((m) => m.id);
    expect(modeIds).toContain("natural_flow");
    expect(modeIds).toContain("clarity_concision");
    expect(modeIds).toContain("formal_tone");
    expect(modeIds).toContain("sentence_variety");
    expect(modeIds).toContain("remove_redundancy");
    expect(modeIds).toContain("improve_transitions");
    expect(modeIds).toContain("simplify_complex");
    expect(modeIds).toContain("paragraph_cohesion");
    expect(modeIds).toContain("grammar_language");
    expect(modeIds).toContain("improve_readability");
    expect(modeIds).toContain("technical_refinement");
    expect(modeIds).toContain("abstract_refinement");
  });

  it("contains all 9 Academic Writing Assistant modes", () => {
    expect(ACADEMIC_WRITING_MODES).toHaveLength(9);
    const modeIds = ACADEMIC_WRITING_MODES.map((m) => m.id);
    expect(modeIds).toContain("abstract_drafting");
    expect(modeIds).toContain("intro_improvement");
    expect(modeIds).toContain("lit_review_org");
    expect(modeIds).toContain("methodology_clarity");
    expect(modeIds).toContain("results_editing");
    expect(modeIds).toContain("discussion_refinement");
    expect(modeIds).toContain("conclusion_improvement");
    expect(modeIds).toContain("grammar_correction");
    expect(modeIds).toContain("academic_tone");
  });

  it("contains all 6 Paraphrasing modes", () => {
    expect(PARAPHRASING_MODES).toHaveLength(6);
    const modeIds = PARAPHRASING_MODES.map((m) => m.id);
    expect(modeIds).toContain("sentence_level");
    expect(modeIds).toContain("paragraph_level");
    expect(modeIds).toContain("technical_paraphrase");
    expect(modeIds).toContain("simplification");
    expect(modeIds).toContain("concision");
    expect(modeIds).toContain("academic_restatement");
  });

  it("strictly preserves critical tokens in local heuristic rewriting", () => {
    const text = `In recent years, the integration of attention mechanisms [1] under DOI 10.1109/ACCESS.2023.1042918 showed a 14.2% increase in precision ($E=mc^2$).`;
    const rewritten = applyLocalHeuristicRewriting(text, "ai_humanizer", "natural_flow");

    expect(rewritten).toContain("[1]");
    expect(rewritten).toContain("10.1109/ACCESS.2023.1042918");
    expect(rewritten).toContain("14.2%");
    expect(rewritten).toContain("$E=mc^2$");
    // Verify cliché was replaced
    expect(rewritten).not.toContain("In recent years,");
    expect(rewritten).toContain("Over the past decade,");
  });

  it("computes word-level diff segments accurately", () => {
    const orig = "The quick brown fox";
    const rev = "The rapid brown fox";
    const diff = computeWordDiff(orig, rev);

    expect(diff.some((d) => d.type === "removed" && d.value === "quick")).toBe(true);
    expect(diff.some((d) => d.type === "added" && d.value === "rapid")).toBe(true);
    expect(diff.some((d) => d.type === "unchanged" && d.value === "The")).toBe(true);
  });

  it("generates mandatory attribution notice for paraphrasing", () => {
    const withCitation = "Attention is a weighted mechanism [Vaswani et al., 2017].";
    const noticeWith = generateParaphraseAttributionNotice(withCitation);
    expect(noticeWith).toMatch(/Academic Attribution Preserved/i);

    const withoutCitation = "Attention is a weighted mechanism for sequence modeling.";
    const noticeWithout = generateParaphraseAttributionNotice(withoutCitation);
    expect(noticeWithout).toMatch(/does not contain explicit citation markers/i);
  });
});

describe("Phase 5 — Academic Writing Workspace UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AI Humanizer workspace with ethical guardrail disclaimer and 12 modes", () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="ai_humanizer" />
      </AppProvider>
    );

    expect(screen.getByText(/AI Humanizer & Scholarly Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/12 Modes/i)).toBeInTheDocument();
    expect(
      screen.getByText(/NOT designed, guaranteed, or intended to bypass AI detectors/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Natural Academic Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/Clarity and Concision/i)).toBeInTheDocument();
  });

  it("renders Academic Writing Assistant with manuscript integrity notice and 9 modes", () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="academic_writing_assistant" />
      </AppProvider>
    );

    expect(screen.getByText(/Academic Writing Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/9 Modes/i)).toBeInTheDocument();
    expect(screen.getByText(/Manuscript Integrity/i)).toBeInTheDocument();
    expect(screen.getByText(/Abstract Drafting/i)).toBeInTheDocument();
    expect(screen.getByText(/Methodology Clarity/i)).toBeInTheDocument();
  });

  it("renders Paraphrasing Tool with mandatory attribution banner and 6 modes", () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="paraphrasing_tool" />
      </AppProvider>
    );

    expect(screen.getByText(/Academic Paraphrasing & Restatement/i)).toBeInTheDocument();
    expect(screen.getByText(/6 Modes/i)).toBeInTheDocument();
    expect(screen.getByText(/Attribution Standard/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentence-level Paraphrasing/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Paraphrasing/i)).toBeInTheDocument();
  });

  it("executes rewriter and displays token preservation status and side-by-side diff", async () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="ai_humanizer" />
      </AppProvider>
    );

    const runBtn = screen.getByRole("button", { name: /Run Rewriter/i });
    expect(runBtn).toBeInTheDocument();

    fireEvent.click(runBtn);

    // Wait for rewriting and validation
    await waitFor(
      () => {
        expect(screen.getByText(/Revision Ready/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    // Invariant verification badge or banner
    expect(
      screen.getByText(/Token Preservation|Semantic Warnings|Critical Semantic Drift/i)
    ).toBeInTheDocument();

    // Confirm that original text is NOT overwritten automatically
    const originalTextarea = screen.getByPlaceholderText(
      /Paste or type your draft manuscript/i
    ) as HTMLTextAreaElement;
    expect(originalTextarea.value.length).toBeGreaterThan(0);

    // Verify revision ready footer with Replace Original button
    expect(screen.getByText(/Revision Ready/i)).toBeInTheDocument();
    const replaceBtn = screen.getByRole("button", { name: /Accept & Replace Original/i });
    expect(replaceBtn).toBeInTheDocument();
  });

  it("supports undo, redo, and revision history snapshot restoration", async () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="ai_humanizer" />
      </AppProvider>
    );

    const runBtn = screen.getByRole("button", { name: /Run Rewriter/i });
    fireEvent.click(runBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/Revision Ready/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    // Open history drawer
    const historyBtn = screen.getByRole("button", { name: /History/i });
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Revision History/i)).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /Restore This Version/i }).length
      ).toBeGreaterThan(0);
    });
  });

  it("opens privacy confirmation modal when selecting remote cloud provider", async () => {
    render(
      <AppProvider>
        <AcademicWritingWorkspaceView toolId="ai_humanizer" />
      </AppProvider>
    );

    const providerSelect = screen.getByRole("combobox");
    fireEvent.change(providerSelect, { target: { value: "remote_cloud" } });

    await waitFor(() => {
      expect(screen.getByText(/Text Will Leave This Device/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Data Transmission & Remote AI Privacy Notice/i)
      ).toBeInTheDocument();
    });
  });
});
