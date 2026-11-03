import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  classifyResearchQuery,
} from "../lib/ai/queryClassifier";
import {
  normalizeEvidenceText,
  calculateTokenOverlap,
  verifySingleCitation,
  validateCitationsList,
  type CandidateChunk,
} from "../lib/ai/evidenceValidator";
import {
  generateStructuredSummary,
  generateMethodologyAnalysis,
  generateResultsAnalysis,
  generateLimitationsAnalysis,
  explainTerminology,
  compareMultiplePapers,
  analyzeResearchGaps,
  clearAnalysisCache,
  NOVELTY_DISCLAIMER,
} from "../lib/ai/paperUnderstandingEngine";
import { PaperUnderstandingPanel } from "../features/ai-hub/PaperUnderstandingPanel";
import { MultiPaperComparisonPanel } from "../features/ai-hub/MultiPaperComparisonPanel";
import { AppProvider } from "../context/AppContext";
import type { Paper } from "../types/domain";

// Mock Tauri bridge commands
vi.mock("../lib/desktop-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/desktop-api")>();
  return {
    ...actual,
    generateAiResponse: vi.fn().mockImplementation(async (input) => {
      const prompt = input.prompt || "";
      if (prompt.includes("core_problem")) {
        return {
          text: JSON.stringify({
            core_problem: "High computational latency in dense attention layers.",
            primary_objectives: ["Reduce memory footprint", "Maintain perplexity"],
            key_contributions: ["Block-sparse linear kernel formulation"],
            proposed_method: "Hierarchical tiled block projection.",
            empirical_findings: ["2.4x speedup with negligible accuracy degradation."],
            limitations_author: ["Evaluated on sequence lengths up to 8k tokens."],
            limitations_inferred: ["Memory fragmentation on non-tensor core architectures."],
            future_directions: ["Adaptive block sizing for dynamic batching."],
            citations: [
              {
                chunk_id: "chunk_1",
                page_number: 3,
                snippet: "Hierarchical tiled block projection reduces memory overhead by 40 percent.",
              },
            ],
          }),
          citations: [
            {
              chunk_id: "chunk_1",
              paper_id: input.paper_id || "p1",
              paper_title: "Mock Paper",
              page_number: 3,
              snippet: "Hierarchical tiled block projection reduces memory overhead by 40 percent.",
              score: 0.95,
            },
          ],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 15,
          is_grounded: true,
        };
      }
      if (prompt.includes("research_design")) {
        return {
          text: JSON.stringify({
            research_design: "Empirical benchmarking under controlled GPU environments.",
            theoretical_framework: "Tiled matrix multiplication complexity bounds.",
            datasets_or_materials: ["WikiText-103", "C4 English corpus"],
            baseline_comparisons: ["Standard Multi-Head Attention", "FlashAttention v1"],
            experimental_protocol: "Training for 50k steps on 8x H100 SXM5 GPUs.",
            evaluation_metrics: ["Perplexity", "TFLOPs throughput", "Latency ms"],
            reproducibility_assessment: "Code and environment configurations publicly reproducible.",
            citations: [],
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 20,
          is_grounded: true,
        };
      }
      if (prompt.includes("key_metrics")) {
        return {
          text: JSON.stringify({
            key_metrics: [
              { name: "Inference Speedup", value: "2.4x", baseline_value: "1.0x", context: "Sequence length 4096" },
              { name: "Perplexity", value: "18.4", baseline_value: "18.3", context: "WikiText-103 test" },
            ],
            quantitative_claims: ["Exceeds prior throughput records across all tested sequence lengths."],
            statistical_significance: "Standard deviation < 0.05 across 5 seeded trials.",
            ablation_insights: ["Tiling alone accounts for 65% of the latency reduction."],
            unexpected_outcomes: ["Slight cache misses during warmup iterations."],
            citations: [],
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 18,
          is_grounded: true,
        };
      }
      if (prompt.includes("author_acknowledged")) {
        return {
          text: JSON.stringify({
            author_acknowledged: ["Testing limited to single-node 8-GPU configurations."],
            inferred_methodological: ["Sparse kernels may exhibit branch divergence on older architectures."],
            inferred_scope_boundaries: ["Performance on non-autoregressive tasks not evaluated."],
            computational_or_data_constraints: ["Requires minimum SRAM capacity of 160KB per SM."],
            threats_to_validity: ["Synthetic batch sizes may not mirror production streaming traffic."],
            citations: [],
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 15,
          is_grounded: true,
        };
      }
      if (prompt.includes("paper_definition")) {
        return {
          text: JSON.stringify({
            term: "FlashAttention",
            paper_definition: "An IO-aware exact attention algorithm leveraging fast SRAM memory tiles.",
            context_in_paper: "Used as the primary baseline and foundational architectural comparison.",
            simplified_explanation: "A way to compute attention without writing intermediate matrices to slow RAM.",
            related_concepts: ["IO Complexity", "GPU SRAM", "Fused Kernel"],
            citations: [],
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 12,
          is_grounded: true,
        };
      }
      if (prompt.includes("synthesized_takeaway")) {
        return {
          text: JSON.stringify({
            dimensions: [
              {
                dimension: "Attention Architecture",
                paper_values: {
                  p1: { summary: "Tiled linear projection", evidence_snippets: ["Excerpt 1"], page_numbers: [2] },
                  p2: { summary: "Sparse KV cache paging", evidence_snippets: ["Excerpt 2"], page_numbers: [4] },
                },
                consensus_or_divergence: "Both focus on memory bandwidth bottlenecks but target different pipeline stages.",
              },
            ],
            synthesized_takeaway: "Paper 1 optimizes compute kernel tiling while Paper 2 optimizes long-context key-value cache paging.",
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 25,
          is_grounded: true,
        };
      }
      if (prompt.includes("identified_gaps")) {
        return {
          text: JSON.stringify({
            identified_gaps: [
              {
                title: "Dynamic Sequence Length Generalization",
                description: "Both systems benchmark fixed-length sequences, leaving highly variable prompt lengths unstudied.",
                gap_type: "unaddressed_methodology",
                scope_caveat: "Observed within the 2 examined papers.",
                potential_investigation: "Evaluate latency distributions under Poisson-arrival variable context loads.",
                grounded_papers: ["p1", "p2"],
              },
            ],
          }),
          citations: [],
          provider_id: "ollama_local",
          model_id: "llama3.2:latest",
          latency_ms: 20,
          is_grounded: true,
        };
      }
      return {
        text: "General grounded response with page references.",
        citations: [],
        provider_id: "ollama_local",
        model_id: "llama3.2:latest",
        latency_ms: 10,
        is_grounded: true,
      };
    }),
    getPaperRagChunks: vi.fn().mockResolvedValue([
      {
        id: "chunk_1",
        paper_id: "p1",
        chunk_index: 0,
        page_number: 3,
        section_heading: "Methodology",
        content_text: "Hierarchical tiled block projection reduces memory overhead by 40 percent on benchmark corpora.",
        token_count: 20,
        created_at: new Date().toISOString(),
      },
    ]),
  };
});

describe("Phase 14: AI Research Assistant & Paper Understanding Engine", () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  // -------------------------------------------------------------------------
  // 1. Query Classification Tests
  // -------------------------------------------------------------------------
  describe("Deterministic Rule-Based Query Classifier", () => {
    it("classifies summarization intents correctly", () => {
      const r1 = classifyResearchQuery("Can you summarize this paper for me?");
      expect(r1.intent).toBe("summarize_paper");
      expect(r1.confidence).toBeGreaterThanOrEqual(0.8);

      const r2 = classifyResearchQuery("Give me a TL;DR and high-level overview");
      expect(r2.intent).toBe("summarize_paper");
    });

    it("classifies methodology and architecture intents", () => {
      const res = classifyResearchQuery("How does the proposed neural pipeline and architecture work?");
      expect(res.intent).toBe("explain_methodology");
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("classifies empirical findings and benchmark results", () => {
      const res = classifyResearchQuery("What are the benchmark accuracy results and F1 scores?");
      expect(res.intent).toBe("extract_findings");
    });

    it("classifies paper limitations and threats to validity", () => {
      const res = classifyResearchQuery("What are the critical limitations and failure cases admitted by the authors?");
      expect(res.intent).toBe("extract_limitations");
    });

    it("classifies terminology and concept definition requests", () => {
      const res = classifyResearchQuery("What is the definition of FlashAttention in this paper?");
      expect(res.intent).toBe("define_terminology");
    });

    it("classifies multi-paper comparison requests", () => {
      const res = classifyResearchQuery("Compare this paper versus the baseline across both models");
      expect(res.intent).toBe("compare_papers");
      expect(res.isMultiPaper).toBe(true);
    });

    it("classifies research gap requests", () => {
      const res = classifyResearchQuery("What are the open research gaps and future directions?");
      expect(res.intent).toBe("identify_gaps");
    });

    it("defaults empty or generic queries gracefully to general_qa", () => {
      const empty = classifyResearchQuery("   ");
      expect(empty.intent).toBe("general_qa");

      const general = classifyResearchQuery("Tell me about this topic");
      expect(general.intent).toBe("general_qa");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Evidence Validation Tests
  // -------------------------------------------------------------------------
  describe("Evidence Validator & Citation Verification", () => {
    const candidateChunks: CandidateChunk[] = [
      {
        id: "chunk_1",
        paper_id: "p1",
        content_text:
          "Hierarchical tiled block projection reduces memory overhead by 40 percent on benchmark corpora.",
        page_number: 3,
        section_heading: "Methodology",
      },
      {
        id: "chunk_2",
        paper_id: "p1",
        content_text:
          "We evaluate our system on WikiText-103 and C4 datasets using standard cross-entropy evaluation.",
        page_number: 5,
        section_heading: "Experiments",
      },
    ];

    it("normalizes text by stripping punctuation and lowercasing", () => {
      const norm = normalizeEvidenceText("Hello, WORLD! This is: 100% Valid.");
      expect(norm).toBe("hello world this is 100 valid");
    });

    it("calculates token overlap correctly", () => {
      const overlap = calculateTokenOverlap(
        "Hierarchical tiled block projection reduces memory overhead",
        "tiled block projection reduces overhead"
      );
      expect(overlap.overlapRatio).toBe(1.0);
      expect(overlap.matchedCount).toBe(5);
    });

    it("verifies exact match citations with confidence 1.0", () => {
      const verified = verifySingleCitation(
        {
          chunk_id: "chunk_1",
          paper_id: "p1",
          snippet: "reduces memory overhead by 40 percent",
          page_number: 3,
        },
        candidateChunks
      );
      expect(verified.is_verified).toBe(true);
      expect(verified.verification_method).toBe("exact_match");
      expect(verified.confidence).toBe(1.0);
    });

    it("verifies partial token overlap citations above threshold", () => {
      const verified = verifySingleCitation(
        {
          chunk_id: "chunk_1",
          paper_id: "p1",
          snippet: "Hierarchical block projection noticeably lowers overhead on corpora",
          page_number: 3,
        },
        candidateChunks
      );
      expect(verified.is_verified).toBe(true);
      expect(verified.verification_method).toBe("token_overlap");
      expect(verified.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it("rejects hallucinated or non-matching citations", () => {
      const verified = verifySingleCitation(
        {
          chunk_id: "chunk_1",
          paper_id: "p1",
          snippet: "Completely fabricated text about quantum computing entanglement",
          page_number: 3,
        },
        candidateChunks
      );
      expect(verified.is_verified).toBe(false);
      expect(verified.verification_method).toBe("unverified");
    });

    it("batch-validates lists of citations", () => {
      const list = validateCitationsList(candidateChunks, [
        { chunk_id: "chunk_1", snippet: "reduces memory overhead", page_number: 3 },
        { chunk_id: "chunk_2", snippet: "evaluate our system on WikiText-103", page_number: 5 },
      ]);
      expect(list).toHaveLength(2);
      expect(list[0].is_verified).toBe(true);
      expect(list[1].is_verified).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Paper Understanding Engine Tests
  // -------------------------------------------------------------------------
  describe("Structured Paper Understanding Operations", () => {
    const chunks: CandidateChunk[] = [
      {
        id: "chunk_1",
        paper_id: "p1",
        content_text: "Hierarchical tiled block projection reduces memory overhead by 40 percent on benchmark corpora.",
        page_number: 3,
        section_heading: "Methodology",
      },
    ];

    it("generates structured paper summary with author vs inferred limitations", async () => {
      const summary = await generateStructuredSummary("p1", "Mock Paper Title", chunks);
      expect(summary.paper_id).toBe("p1");
      expect(summary.core_problem).toContain("computational latency");
      expect(summary.primary_objectives).toHaveLength(2);
      expect(summary.key_contributions[0]).toContain("Block-sparse");
      expect(summary.limitations_author).toHaveLength(1);
      expect(summary.limitations_inferred).toHaveLength(1);
      expect(summary.evidence[0].is_verified).toBe(true);
    });

    it("generates methodology analysis with reproducibility assessment", async () => {
      const method = await generateMethodologyAnalysis("p1", "Mock Paper Title", chunks);
      expect(method.research_design).toContain("Empirical benchmarking");
      expect(method.datasets_or_materials).toContain("WikiText-103");
      expect(method.reproducibility_assessment).toContain("reproducible");
    });

    it("extracts quantitative results and ablation insights", async () => {
      const results = await generateResultsAnalysis("p1", "Mock Paper Title", chunks);
      expect(results.key_metrics).toHaveLength(2);
      expect(results.key_metrics[0].name).toBe("Inference Speedup");
      expect(results.ablation_insights).toHaveLength(1);
    });

    it("analyzes limitations with strict distinction of author admission", async () => {
      const limits = await generateLimitationsAnalysis("p1", "Mock Paper Title", chunks);
      expect(limits.author_acknowledged).toContain("Testing limited to single-node 8-GPU configurations.");
      expect(limits.inferred_methodological).toHaveLength(1);
      expect(limits.computational_or_data_constraints).toHaveLength(1);
    });

    it("explains technical terminology grounded in paper", async () => {
      const term = await explainTerminology("FlashAttention", "p1", chunks);
      expect(term.term).toBe("FlashAttention");
      expect(term.paper_definition).toContain("IO-aware exact attention");
      expect(term.related_concepts).toContain("GPU SRAM");
    });

    it("caches analysis results to avoid redundant LLM calls", async () => {
      const first = await generateStructuredSummary("p1", "Mock Paper Title", chunks);
      const second = await generateStructuredSummary("p1", "Mock Paper Title", chunks);
      expect(first).toBe(second); // Exact reference from memory cache
    });
  });

  // -------------------------------------------------------------------------
  // 4. Multi-Paper Comparison & Gap Analysis Tests
  // -------------------------------------------------------------------------
  describe("Multi-Paper Synthesis and Research Gap Analysis", () => {
    const multiPapers = [
      {
        id: "p1",
        title: "Tiled Attention Kernels",
        chunks: [
          {
            id: "p1_c1",
            paper_id: "p1",
            content_text: "Hierarchical tiled block projection reduces memory overhead by 40 percent.",
            page_number: 2,
          },
        ],
      },
      {
        id: "p2",
        title: "Paged KV Caching",
        chunks: [
          {
            id: "p2_c1",
            paper_id: "p2",
            content_text: "Paged key-value caching prevents external memory fragmentation during decoding.",
            page_number: 4,
          },
        ],
      },
    ];

    it("compares multiple papers across dimensions while isolating evidence per paper", async () => {
      const comparison = await compareMultiplePapers(multiPapers);
      expect(comparison.paper_ids).toEqual(["p1", "p2"]);
      expect(comparison.dimensions).toHaveLength(1);
      expect(comparison.synthesized_takeaway).toContain("Paper 1 optimizes compute kernel tiling");
      expect(comparison.isolated_evidence.p1).toBeDefined();
      expect(comparison.isolated_evidence.p2).toBeDefined();
    });

    it("analyzes research gaps with collection-scope caveats and mandatory novelty disclaimer", async () => {
      const gapAnalysis = await analyzeResearchGaps(multiPapers);
      expect(gapAnalysis.identified_gaps).toHaveLength(1);
      expect(gapAnalysis.field_wide_novelty_disclaimer).toBe(NOVELTY_DISCLAIMER);
      expect(gapAnalysis.field_wide_novelty_disclaimer).toContain("strictly relative to the selected collection");
      expect(gapAnalysis.identified_gaps[0].scope_caveat).toContain("Observed within");
    });
  });

  // -------------------------------------------------------------------------
  // 5. React Component Rendering Tests
  // -------------------------------------------------------------------------
  describe("Paper Understanding and Comparison UI Panels", () => {
    const mockPaper: Paper = {
      id: "p1",
      title: "Efficient Kernel Scheduling for LLMs",
      authors: ["Alice Smith", "Bob Jones"],
      abstract: "We introduce efficient tiled kernel scheduling algorithms for deep learning workloads.",
      publicationDate: "2024-05-10",
      year: 2024,
      venue: "NeurIPS",
      doi: "10.1234/5678",
      sourceId: "arxiv",
      sourceName: "arXiv",
      landingUrl: "https://arxiv.org/abs/2405.0001",
      pdfUrl: null,
      accessStatus: "open_access",
      documentStatus: "available",
      tags: ["GPU", "Attention"],
      collectionIds: [],
      citationCount: 42,
      addedAt: "2024-05-10T00:00:00Z",
      isSaved: true,
    };

    const mockPaper2: Paper = {
      ...mockPaper,
      id: "p2",
      title: "Paged Memory Management for Transformer Decoders",
      year: 2023,
    };

    it("renders PaperUnderstandingPanel and executes summary analysis", async () => {
      render(
        <AppProvider>
          <PaperUnderstandingPanel
            activePaper={mockPaper}
            paperChunks={[
              {
                id: "c1",
                paper_id: "p1",
                content_text: "Hierarchical tiled block projection reduces memory overhead by 40 percent.",
                page_number: 3,
              },
            ]}
          />
        </AppProvider>
      );

      expect(screen.getByText("Efficient Kernel Scheduling for LLMs")).toBeInTheDocument();
      expect(screen.getByText("Paper Understanding Engine")).toBeInTheDocument();
      expect(screen.getByText("Structured Summary")).toBeInTheDocument();
      expect(screen.getByText("Methodology Deep-Dive")).toBeInTheDocument();

      const genButton = screen.getByText("Generate Grounded Summary");
      fireEvent.click(genButton);

      await waitFor(() => {
        expect(screen.getByText("Core Problem Addressed")).toBeInTheDocument();
        expect(screen.getByText(/High computational latency in dense attention layers/)).toBeInTheDocument();
      });
    });

    it("renders MultiPaperComparisonPanel and displays Novelty Alert Banner", async () => {
      render(
        <AppProvider>
          <MultiPaperComparisonPanel papers={[mockPaper, mockPaper2]} />
        </AppProvider>
      );

      expect(screen.getByText(/Select Papers to Compare/i)).toBeInTheDocument();
      expect(screen.getByText("Comparison Matrix")).toBeInTheDocument();
      expect(screen.getByText("Research Gap Analysis")).toBeInTheDocument();

      // Switch to gap analysis
      const gapTabButton = screen.getByText("Research Gap Analysis");
      fireEvent.click(gapTabButton);

      // Verify the mandatory novelty alert banner is immediately visible
      expect(screen.getByText("Collection Scope & Absolute Novelty Notice")).toBeInTheDocument();
      expect(screen.getByText(new RegExp(NOVELTY_DISCLAIMER.slice(0, 30)))).toBeInTheDocument();
    });
  });
});
