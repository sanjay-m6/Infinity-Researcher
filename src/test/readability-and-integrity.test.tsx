import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import {
  analyzeReadability,
  countWordSyllables,
  detectTextLanguage,
  READABILITY_DEMO_SAMPLE,
} from "../features/readability/readabilityEngine";
import { ReadabilityAnalyzerView } from "../features/readability/ReadabilityAnalyzerView";
import {
  generateIntegrityReport,
  RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
} from "../features/integrity/integrityEngine";
import {
  saveReportToStorage,
  loadSavedReportsFromStorage,
  getReportById,
  deleteReportFromStorage,
  updateFindingReviewStatus,
} from "../features/integrity/reportStore";
import { ResearchIntegrityView } from "../features/integrity/ResearchIntegrityView";

describe("Phase 7 — Readability Analyzer Engine", () => {
  it("accurately calculates word syllables and distinguishes simple from complex words", () => {
    expect(countWordSyllables("cat")).toBe(1);
    expect(countWordSyllables("paper")).toBe(2);
    expect(countWordSyllables("algorithm")).toBe(3);
    expect(countWordSyllables("communication")).toBeGreaterThanOrEqual(4);
    expect(countWordSyllables("unprecedented")).toBeGreaterThanOrEqual(4);
  });

  it("detects English vs Non-English language and emits formula applicability caveats", () => {
    const englishText = "The researcher conducted a comprehensive analysis of the empirical data.";
    const engLang = detectTextLanguage(englishText);
    expect(engLang.detectedCode).toBe("en");
    expect(engLang.isEnglish).toBe(true);

    const spanishText = "El investigador realizó un análisis exhaustivo de los datos empíricos para el estudio.";
    const spLang = detectTextLanguage(spanishText);
    expect(spLang.detectedCode).toBe("es");
    expect(spLang.isEnglish).toBe(false);

    const report = analyzeReadability(spanishText, "Spanish Paper");
    expect(report.language.isEnglish).toBe(false);
    expect(report.language.limitationNotice).toBeTruthy();
    expect(report.language.limitationNotice).toMatch(/not calibrated for Spanish/i);
  });

  it("computes classical readability indices (Flesch, Kincaid, Fog, Coleman-Liau, SMOG, ARI)", () => {
    const report = analyzeReadability(READABILITY_DEMO_SAMPLE, "Demo Document");

    expect(report.vocabulary.totalWords).toBeGreaterThan(50);
    expect(report.totalSentences).toBeGreaterThan(3);
    expect(report.metrics.fleschReadingEase).toBeTypeOf("number");
    expect(report.metrics.fleschKincaidGrade).toBeTypeOf("number");
    expect(report.metrics.gunningFogIndex).toBeTypeOf("number");
    expect(report.metrics.colemanLiauIndex).toBeTypeOf("number");
    expect(report.metrics.automatedReadabilityIndex).toBeTypeOf("number");
  });

  it("identifies passive-voice sentences and long sentences exceeding 35 words", () => {
    const textWithPassiveAndLong = `
      The experimental evaluation was conducted by the research committee using standard benchmark datasets.
      In this comprehensive investigation into modern distributed machine learning paradigms, the engineering team systematically evaluated thirty-two distinct hyperparameter configurations across seven heterogeneous computing clusters, resulting in significant empirical performance improvements across all tested operational scenarios and architectural pipelines.
    `;
    const report = analyzeReadability(textWithPassiveAndLong, "Passive Test");

    const passiveSentence = report.sentences.find((s) => s.isPassive);
    expect(passiveSentence).toBeDefined();

    const longSentence = report.sentences.find((s) => s.isOverlyLong);
    expect(longSentence).toBeDefined();
    expect(longSentence?.wordCount).toBeGreaterThan(35);
  });

  it("extracts repeated phrases and suggests clarity improvements for nominalizations", () => {
    const textWithNominalizations = `
      We must conduct an investigation of the parameters. In order to achieve optimization, we made a determination that the model converged. Due to the fact that memory was limited, we made a decision to reduce batch size.
    `;
    const report = analyzeReadability(textWithNominalizations, "Nominalization Test");

    expect(report.actionableClarityRecommendations.length).toBeGreaterThan(0);
    const recs = report.actionableClarityRecommendations.join(" ");
    expect(recs).toMatch(/investigate|because/i);
  });
});

describe("Phase 7 — Readability Analyzer View Component", () => {
  it("renders the Readability Analyzer with KPI cards and switchable tabs", async () => {
    render(
      <AppProvider>
        <ReadabilityAnalyzerView />
      </AppProvider>
    );

    expect(screen.getByText(/Readability & Clarity Analyzer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyze/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Flesch Reading Ease/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Grade Level/i)).toBeInTheDocument();
      expect(screen.getByText(/Kincaid Scale/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Gunning Fog/i).length).toBeGreaterThan(0);
    });

    // Tab buttons
    expect(screen.getByRole("button", { name: /Sentences & Clarity/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paragraph-Level Breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vocabulary & Repetition/i })).toBeInTheDocument();

    // Switch to Paragraphs tab
    fireEvent.click(screen.getByRole("button", { name: /Paragraph-Level Breakdown/i }));
    await waitFor(() => {
      expect(screen.getByText(/Paragraph 1/i)).toBeInTheDocument();
    });
  });
});

describe("Phase 7 — Research Integrity Engine (7 Dimensions & Ethical Guardrails)", () => {
  it("evaluates all 7 independent dimensions and strictly avoids an unexplained single score", () => {
    const report = generateIntegrityReport(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "Neural Retrieval Study",
      "test-manuscript.txt"
    );

    // Verify all 7 dimensions exist
    const dimKeys = Object.keys(report.dimensions);
    expect(dimKeys).toHaveLength(7);
    expect(dimKeys).toContain("similarity");
    expect(dimKeys).toContain("ai_signals");
    expect(dimKeys).toContain("citations");
    expect(dimKeys).toContain("references");
    expect(dimKeys).toContain("readability");
    expect(dimKeys).toContain("structure");
    expect(dimKeys).toContain("extraction");

    // CRITICAL REQUIREMENT: No unexplained overall percentage or integrity score field!
    // @ts-expect-error verifying property does not exist
    expect(report.integrityScore).toBeUndefined();
    // @ts-expect-error verifying property does not exist
    expect(report.overallScore).toBeUndefined();

    // Verify each dimension has an independent status and findings count
    for (const key of dimKeys) {
      const dim = report.dimensions[key as keyof typeof report.dimensions];
      expect(dim.status).toMatch(/pass|attention_needed|concerns_found|technical_issue/);
      expect(typeof dim.summaryText).toBe("string");
      expect(typeof dim.findingsCount).toBe("number");
    }

    // Verify Ethical Disclaimer
    expect(report.ethicalDisclaimer).toMatch(/automated advisory checks and do NOT constitute proof of misconduct/i);
  });

  it("detects verbatim benchmark overlap in text similarity dimension", () => {
    const manuscriptWithOverlap = `
Abstract
This study investigates attention mechanisms and bidirectional encoders.

Introduction
In deep learning, the attention mechanism computes a weighted sum of values based on compatibility between query vectors and key representations.

Methodology
Our evaluation follows standardized benchmark procedures.

Results
The experiments achieved high accuracy.

References
[1] Vaswani et al.
    `;

    const report = generateIntegrityReport(manuscriptWithOverlap, "Overlap Test");
    const similarityFindings = report.findings.filter((f) => f.dimension === "similarity");

    expect(similarityFindings.length).toBeGreaterThan(0);
    const overlapFinding = similarityFindings.find((f) => f.status === "concern");
    expect(overlapFinding).toBeDefined();
    expect(overlapFinding?.evidence).toContain("attention mechanism computes a weighted sum");
  });

  it("detects citation inconsistencies (unmatched citations and uncited references)", () => {
    const report = generateIntegrityReport(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "Citation Check",
      "manuscript.txt"
    );

    const citationFindings = report.findings.filter((f) => f.dimension === "citations");
    // [99] was cited in text but not in bibliography
    const missingRef = citationFindings.find(
      (f) => f.title.includes("Missing Bibliography Reference") || f.evidence.includes("[99]")
    );
    expect(missingRef).toBeDefined();
    expect(missingRef?.status).toBe("concern");

    // [3] and [4] were in bibliography but never cited in text
    const uncited = citationFindings.find((f) => f.title.includes("Uncited Bibliography Reference"));
    expect(uncited).toBeDefined();
  });

  it("validates reference DOI metadata and flags malformed DOIs", () => {
    const report = generateIntegrityReport(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "DOI Check",
      "manuscript.txt"
    );

    const refFindings = report.findings.filter((f) => f.dimension === "references");
    // Reference [4] has malformed DOI: 1109/MALFORMED.DOI
    const malformed = refFindings.find(
      (f) => f.status === "technical_error" && f.title.includes("Malformed DOI")
    );
    expect(malformed).toBeDefined();
    expect(malformed?.evidence).toContain("1109/MALFORMED.DOI");
  });

  it("detects missing standard IMRaD sections in document structure dimension", () => {
    const incompletePaper = `
      Brief Observations
      Deep neural representations accelerate query parsing through weight caching.
    `;
    const report = generateIntegrityReport(incompletePaper, "Short Note");
    const structFindings = report.findings.filter((f) => f.dimension === "structure");

    expect(structFindings.length).toBeGreaterThan(0);
    const missingStructure = structFindings.find((f) => f.evidence.includes("Abstract"));
    expect(missingStructure).toBeDefined();
    expect(missingStructure?.severity).toBe("warning");
  });

  it("maintains fault isolation when one dimension encounters errors", () => {
    // Even with empty or pathological input, all dimensions return without crashing
    const emptyReport = generateIntegrityReport("", "Empty Document");
    expect(emptyReport.dimensions.extraction.status).toBe("technical_issue");
    expect(emptyReport.dimensions.structure.status).toBe("concerns_found");
    expect(emptyReport.wordCount).toBe(0);
  });
});

describe("Phase 7 — Report Storage and Finding Review Tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, retrieves, and deletes integrity reports in local storage", () => {
    const report = generateIntegrityReport(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "Storage Manuscript",
      "storage-test.txt"
    );

    saveReportToStorage(report);

    const saved = loadSavedReportsFromStorage();
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(report.id);

    const retrieved = getReportById(report.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Storage Manuscript");

    deleteReportFromStorage(report.id);
    const afterDelete = loadSavedReportsFromStorage();
    expect(afterDelete.length).toBe(0);
  });

  it("allows marking findings as reviewed with reviewer notes and updates unreviewed count", () => {
    const report = generateIntegrityReport(
      RESEARCH_INTEGRITY_DEMO_MANUSCRIPT,
      "Review Tracking",
      "review-test.txt"
    );

    saveReportToStorage(report);

    const firstFinding = report.findings[0];
    const initialDimUnreviewed = report.dimensions[firstFinding.dimension].unreviewedCount;

    const updated = updateFindingReviewStatus(
      report.id,
      firstFinding.id,
      true,
      "Verified with primary author; text attribution verified in preprint."
    );

    expect(updated).not.toBeNull();
    const updatedFinding = updated?.findings.find((f) => f.id === firstFinding.id);
    expect(updatedFinding?.isReviewed).toBe(true);
    expect(updatedFinding?.status).toBe("reviewed");
    expect(updatedFinding?.reviewerNotes).toContain("Verified with primary author");
    expect(updatedFinding?.reviewedAt).toBeTruthy();

    // Verify dimension unreviewedCount decreased by 1
    expect(updated?.dimensions[firstFinding.dimension].unreviewedCount).toBe(
      Math.max(0, initialDimUnreviewed - 1)
    );
  });
});

describe("Phase 7 — Research Integrity View Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the Research Integrity Auditor with 7 dimension cards and ethical banner", async () => {
    render(
      <AppProvider>
        <ResearchIntegrityView />
      </AppProvider>
    );

    expect(screen.getByText(/Research Integrity Auditor/i)).toBeInTheDocument();
    expect(screen.getByText(/Transparent Multi-Dimensional Integrity Protocol/i)).toBeInTheDocument();

    await waitFor(() => {
      // 7 dimension cards
      expect(screen.getAllByText(/Text Similarity & Overlap/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/AI Statistical Signals/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Citation Consistency/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Reference Metadata & DOIs/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Readability & Clarity/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Document Structure/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Extraction & OCR Diagnostics/i).length).toBeGreaterThan(0);
    });

    // Check findings table search input exists
    expect(screen.getByPlaceholderText(/Search findings, evidence, location/i)).toBeInTheDocument();

    // Check action buttons exist
    expect(screen.getByRole("button", { name: /Upload File/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo Sample/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Audit/i })).toBeInTheDocument();
  });

  it("filters findings when clicking a dimension card", async () => {
    render(
      <AppProvider>
        <ResearchIntegrityView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Audited Dimensions/i)).toBeInTheDocument();
    });

    // Click on "Citation Consistency" card
    const citationCard = screen.getByRole("button", { name: /Citation Consistency/i });
    fireEvent.click(citationCard);

    // Filter indicator should show
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Show All Dimensions/i })).toBeInTheDocument();
    });
  });

  it("allows marking a finding as reviewed interactively", async () => {
    render(
      <AppProvider>
        <ResearchIntegrityView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Mark as Reviewed/i }).length).toBeGreaterThan(0);
    });

    const firstMarkBtn = screen.getAllByRole("button", { name: /Mark as Reviewed/i })[0];
    fireEvent.click(firstMarkBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Mark Unreviewed/i })).toBeInTheDocument();
    });
  });

  it("opens the Export Modal and displays HTML and JSON tabs", async () => {
    render(
      <AppProvider>
        <ResearchIntegrityView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Export Audit/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Export Audit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Export Research Integrity Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Standalone HTML Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Machine-Readable JSON Artifact/i)).toBeInTheDocument();
    });
  });
});
