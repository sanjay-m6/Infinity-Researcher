import {
  UnifiedIntegrityReport,
  IntegrityDimension,
  DimensionSummary,
  IntegrityFinding,
} from "./types";
import { performCitationAudit } from "../citation-checker/consistencyEngine";
import { analyzeReadability } from "../readability/readabilityEngine";

// ---------------------------------------------------------------------------
// REFERENCE CORPUS FOR TEXT SIMILARITY CHECKS (SAMPLE BENCHMARKS)
// ---------------------------------------------------------------------------

const BENCHMARK_VERBATIM_STRINGS: { source: string; text: string }[] = [
  {
    source: "Vaswani et al. (2017) [NeurIPS]",
    text: "the attention mechanism computes a weighted sum of values based on compatibility between query vectors and key representations",
  },
  {
    source: "Devlin et al. (2018) [NAACL]",
    text: "masked language models can capture rich semantic representations from massive unannotated corpora by leveraging bidirectional transformer encoders",
  },
  {
    source: "He et al. (2016) [CVPR]",
    text: "deeper neural networks are more difficult to train we present a residual learning framework to ease the training of networks",
  },
];

// ---------------------------------------------------------------------------
// MULTI-DIMENSIONAL INTEGRITY AUDIT ENGINE
// ---------------------------------------------------------------------------

export function generateIntegrityReport(
  rawDocument: string,
  title = "Academic Manuscript",
  fileName = "document.txt"
): UnifiedIntegrityReport {
  const trimmed = rawDocument.trim();
  const words = trimmed.match(/\b[A-Za-z0-9'-]+\b/g) || [];
  const wordCount = words.length;

  const findings: IntegrityFinding[] = [];
  let findingCounter = 0;

  // Helper to register findings safely
  const addFinding = (f: Omit<IntegrityFinding, "id" | "isReviewed">) => {
    findingCounter++;
    findings.push({
      ...f,
      id: `int_find_${findingCounter}`,
      isReviewed: false,
    });
  };

  // -------------------------------------------------------------------------
  // DIMENSION 1: TEXT SIMILARITY
  // -------------------------------------------------------------------------
  let similaritySummary: DimensionSummary;
  try {
    const lowerDoc = trimmed.toLowerCase();
    let overlapCount = 0;
    const matchedSources: string[] = [];

    for (const benchmark of BENCHMARK_VERBATIM_STRINGS) {
      if (lowerDoc.includes(benchmark.text.toLowerCase())) {
        overlapCount++;
        matchedSources.push(benchmark.source);
        addFinding({
          dimension: "similarity",
          title: `Verbatim Passage Overlap Detected`,
          description: `A sequence of 15+ consecutive identical words matches published literature from ${benchmark.source}. Check whether this passage requires quotation marks or citation anchoring.`,
          status: "concern",
          severity: "warning",
          confidence: "High (Exact Match)",
          evidence: `"${benchmark.text}"`,
          location: "Body Text",
          suggestedAction:
            "Enclose verbatim phrases in quotation marks with formal attribution or paraphrase into original prose.",
        });
      }
    }

    similaritySummary = {
      dimension: "similarity",
      label: "Text Similarity & Overlap",
      status: overlapCount > 0 ? "attention_needed" : "pass",
      statusLabel:
        overlapCount > 0
          ? `${overlapCount} Verbatim Match(es)`
          : "Clean (No Uncited Overlap)",
      findingsCount: overlapCount,
      unreviewedCount: overlapCount,
      metrics: {
        "Verbatim Matches": overlapCount,
        "Benchmark Checked": BENCHMARK_VERBATIM_STRINGS.length,
      },
      summaryText:
        overlapCount > 0
          ? `${overlapCount} verbatim phrase(s) match external publications. Ensure quotes and citations are anchored.`
          : "No unquoted verbatim overlap found against checked academic corpus.",
    };
  } catch (err: unknown) {
    similaritySummary = {
      dimension: "similarity",
      label: "Text Similarity & Overlap",
      status: "technical_issue",
      statusLabel: "Analysis Error",
      findingsCount: 1,
      unreviewedCount: 1,
      metrics: {},
      summaryText: "Similarity scanner encountered a non-fatal parsing exception.",
    };
    addFinding({
      dimension: "similarity",
      title: "Similarity Scanner Error",
      description: String(err),
      status: "technical_error",
      severity: "info",
      confidence: "System Signal",
      evidence: "N/A",
      location: "System",
      suggestedAction: "Re-run analysis.",
    });
  }

  // -------------------------------------------------------------------------
  // DIMENSION 2: AI-WRITING STATISTICAL SIGNALS
  // -------------------------------------------------------------------------
  let aiSignalsSummary: DimensionSummary;
  try {
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const sentenceLengths = sentences.map((s) => (s.match(/\b\S+\b/g) || []).length);
    const avgLen =
      sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(1, sentences.length);
    const variance =
      sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgLen, 2), 0) /
      Math.max(1, sentences.length);
    const stdDev = Math.sqrt(variance);
    const coeffVariation = avgLen > 0 ? Math.round((stdDev / avgLen) * 100) / 100 : 0;

    // AI cadence signals: abnormally low variation in sentence length (< 0.25)
    const isUniform = sentenceLengths.length >= 5 && coeffVariation < 0.28;

    if (isUniform) {
      addFinding({
        dimension: "ai_signals",
        title: "Uniform Sentence Length Cadence",
        description: `Sentence length variance is unusually low (CV = ${coeffVariation}). Uniform sentence cadences are frequently observed in template-based generation or early LLM drafts.`,
        status: "inconclusive",
        severity: "info",
        confidence: "Statistical Signal (Uncertain)",
        evidence: `Standard Deviation: ${Math.round(stdDev * 10) / 10} words | Mean: ${Math.round(avgLen * 10) / 10} words`,
        location: "Document-wide",
        suggestedAction:
          "Vary sentence complexity by combining short declarative statements with compound analytical clauses.",
      });
    }

    aiSignalsSummary = {
      dimension: "ai_signals",
      label: "AI Statistical Signals",
      status: isUniform ? "attention_needed" : "pass",
      statusLabel: isUniform ? "Low Cadence Variance" : "Natural Cadence Variation",
      findingsCount: isUniform ? 1 : 0,
      unreviewedCount: isUniform ? 1 : 0,
      metrics: {
        "Sentence Length CV": coeffVariation,
        "Std Deviation": Math.round(stdDev * 10) / 10,
        "Avg Length": Math.round(avgLen * 10) / 10,
      },
      summaryText: isUniform
        ? "Statistical stylometry indicates monotonous sentence length; vary sentence rhythm."
        : "Cadence and syntactic variety align with natural scholarly drafting.",
    };
  } catch {
    aiSignalsSummary = {
      dimension: "ai_signals",
      label: "AI Statistical Signals",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error calculating stylometric variance.",
    };
  }

  // -------------------------------------------------------------------------
  // DIMENSION 3: CITATION CONSISTENCY
  // -------------------------------------------------------------------------
  let citationSummary: DimensionSummary;
  let citationAuditReport = null;
  try {
    citationAuditReport = performCitationAudit(trimmed, title);
    const orphans = citationAuditReport.summary.orphanCitationsCount;
    const uncited = citationAuditReport.summary.uncitedReferencesCount;
    const totalCiteIssues = orphans + uncited;

    if (orphans > 0) {
      addFinding({
        dimension: "citations",
        title: `${orphans} Unmatched In-Text Citation(s)`,
        description: `In-text citations exist in the document text that have no corresponding reference in the bibliography.`,
        status: "concern",
        severity: "critical",
        confidence: "High (Deterministic Match)",
        evidence: `Missing reference keys: ${citationAuditReport.issues
          .filter((i) => i.category === "missing_reference")
          .map((i) => i.title)
          .slice(0, 3)
          .join(", ")}`,
        location: "In-Text Citations",
        suggestedAction:
          "Add missing references to the bibliography or correct in-text citation keys.",
      });
    }

    if (uncited > 0) {
      addFinding({
        dimension: "citations",
        title: `${uncited} Uncited Bibliography Reference(s)`,
        description: `References listed in the bibliography are never cited in the body of the manuscript.`,
        status: "concern",
        severity: "warning",
        confidence: "High",
        evidence: `${uncited} entry/entries unreferenced`,
        location: "References Section",
        suggestedAction:
          "Cite references in the manuscript or remove extraneous entries.",
      });
    }

    citationSummary = {
      dimension: "citations",
      label: "Citation Consistency",
      status: orphans > 0 ? "concerns_found" : uncited > 0 ? "attention_needed" : "pass",
      statusLabel:
        orphans > 0
          ? `${orphans} Missing Ref(s)`
          : uncited > 0
            ? `${uncited} Uncited Ref(s)`
            : "100% Matched",
      findingsCount: totalCiteIssues,
      unreviewedCount: totalCiteIssues,
      metrics: {
        "In-Text Citations": citationAuditReport.summary.totalInTextCitations,
        "Orphans (Missing)": orphans,
        "Uncited Entries": uncited,
      },
      summaryText:
        orphans > 0
          ? `Critical: ${orphans} in-text citation(s) lack bibliography entries.`
          : uncited > 0
            ? `${uncited} bibliography entry/entries are never cited in the text.`
            : "All in-text citations match bibliography entries perfectly.",
    };
  } catch {
    citationSummary = {
      dimension: "citations",
      label: "Citation Consistency",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error during citation cross-referencing.",
    };
  }

  // -------------------------------------------------------------------------
  // DIMENSION 4: REFERENCE METADATA & DOI VERIFICATION
  // -------------------------------------------------------------------------
  let referenceSummary: DimensionSummary;
  try {
    const malformedDois = citationAuditReport
      ? citationAuditReport.summary.malformedDoiCount
      : 0;
    const verifiedDois = citationAuditReport
      ? citationAuditReport.summary.verifiedDoiCount
      : 0;
    const discrepancies = citationAuditReport
      ? citationAuditReport.summary.metadataDiscrepancyCount
      : 0;

    if (citationAuditReport) {
      citationAuditReport.references.forEach((ref) => {
        if (ref.doi && ref.doiStatus && !ref.doiStatus.syntaxValid) {
          addFinding({
            dimension: "references",
            title: `Malformed DOI Syntax: Ref [${ref.key}]`,
            description:
              ref.doiStatus.syntaxErrorNote ||
              "DOI string violates standard IDF/Crossref syntax specifications.",
            status: "technical_error",
            severity: "critical",
            confidence: "Syntax Validation",
            evidence: ref.doi,
            location: `Reference [${ref.key}] in Bibliography`,
            suggestedAction: "Correct DOI format to standard '10.<registrant>/<suffix>'.",
          });
        }
      });
    } else if (malformedDois > 0) {
      addFinding({
        dimension: "references",
        title: `${malformedDois} Malformed DOI Syntax Finding(s)`,
        description: "DOI strings violate standard IDF/Crossref syntax specifications.",
        status: "technical_error",
        severity: "critical",
        confidence: "Syntactic Check",
        evidence: "Malformed prefix or illegal characters in DOI string",
        location: "References Section",
        suggestedAction: "Correct DOI format to standard '10.<registrant>/<suffix>'.",
      });
    }

    if (discrepancies > 0) {
      addFinding({
        dimension: "references",
        title: `${discrepancies} Metadata Discrepancy Finding(s)`,
        description:
          "Reference fields (e.g. publication year or title) differ from verified canonical registry records.",
        status: "concern",
        severity: "warning",
        confidence: "Verified Registry",
        evidence: "Discrepancy between reference text and canonical index record",
        location: "References Section",
        suggestedAction:
          "Update reference publication year or title to match the official registry record.",
      });
    }

    referenceSummary = {
      dimension: "references",
      label: "Reference Metadata & DOIs",
      status:
        malformedDois > 0
          ? "technical_issue"
          : discrepancies > 0
            ? "attention_needed"
            : "pass",
      statusLabel:
        malformedDois > 0
          ? `${malformedDois} Malformed DOI(s)`
          : `${verifiedDois} Verified DOIs`,
      findingsCount: malformedDois + discrepancies,
      unreviewedCount: malformedDois + discrepancies,
      metrics: {
        "Verified DOIs": verifiedDois,
        "Malformed DOIs": malformedDois,
        "Metadata Discrepancies": discrepancies,
      },
      summaryText:
        malformedDois > 0
          ? `${malformedDois} DOI(s) have syntax errors.`
          : discrepancies > 0
            ? `${discrepancies} reference(s) contain metadata discrepancies against canonical records.`
            : "All validated DOIs are syntactically sound and match registry data.",
    };
  } catch {
    referenceSummary = {
      dimension: "references",
      label: "Reference Metadata & DOIs",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error validating reference metadata.",
    };
  }

  // -------------------------------------------------------------------------
  // DIMENSION 5: READABILITY & CLARITY
  // -------------------------------------------------------------------------
  let readabilitySummary: DimensionSummary;
  try {
    const readabilityReport = analyzeReadability(trimmed, title);
    const ease = readabilityReport.metrics.fleschReadingEase;
    const longCount = readabilityReport.longSentencesCount;

    if (longCount > 0) {
      addFinding({
        dimension: "readability",
        title: `${longCount} Overly Long Sentence(s)`,
        description: `Sentences exceeding 35 words create high working memory load for peer reviewers.`,
        status: "inconclusive",
        severity: "info",
        confidence: "Direct Measure",
        evidence: `${longCount} sentence(s) with > 35 words`,
        location: "Body Text",
        suggestedAction: "Disentangle into shorter independent clauses.",
      });
    }

    readabilitySummary = {
      dimension: "readability",
      label: "Readability & Clarity",
      status: ease < 25 ? "attention_needed" : "pass",
      statusLabel: `Flesch ${ease}/100 · ${readabilityReport.metrics.scoreBand.replace("_", " ")}`,
      findingsCount: longCount > 0 ? 1 : 0,
      unreviewedCount: longCount > 0 ? 1 : 0,
      metrics: {
        "Flesch Reading Ease": ease,
        "Gunning Fog": readabilityReport.metrics.gunningFogIndex,
        "Long Sentences (>35w)": longCount,
      },
      summaryText: `Prose scored at Flesch ${ease}/100 (${readabilityReport.metrics.academicSuitabilityLabel}).`,
    };
  } catch {
    readabilitySummary = {
      dimension: "readability",
      label: "Readability & Clarity",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error computing readability metrics.",
    };
  }

  // -------------------------------------------------------------------------
  // DIMENSION 6: DOCUMENT STRUCTURE
  // -------------------------------------------------------------------------
  let structureSummary: DimensionSummary;
  try {
    const lower = trimmed.toLowerCase();
    const expectedSections = [
      { name: "Abstract", regex: /\b(abstract)\b/i },
      { name: "Introduction", regex: /\b(introduction)\b/i },
      {
        name: "Methodology",
        regex: /\b(method|methodology|proposed framework|system architecture)\b/i,
      },
      {
        name: "Results",
        regex: /\b(results|empirical evaluation|experimental setup|experiments)\b/i,
      },
      { name: "Discussion", regex: /\b(discussion|limitations|future work)\b/i },
      { name: "References", regex: /\b(references|bibliography|works cited)\b/i },
    ];

    const detectedSections = expectedSections.filter((s) => s.regex.test(lower));
    const missingSections = expectedSections.filter((s) => !s.regex.test(lower));

    if (missingSections.length > 0) {
      addFinding({
        dimension: "structure",
        title: `Missing Standard Section(s): ${missingSections.map((s) => s.name).join(", ")}`,
        description: `Standard academic manuscripts generally include: ${expectedSections.map((s) => s.name).join(", ")}.`,
        status: "concern",
        severity: "warning",
        confidence: "Section Keyword Match",
        evidence: `Missing: ${missingSections.map((s) => s.name).join(", ")}`,
        location: "Document Structure",
        suggestedAction: "Ensure standard IMRaD section headings are clearly demarcated.",
      });
    }

    structureSummary = {
      dimension: "structure",
      label: "Document Structure",
      status:
        missingSections.length === 0
          ? "pass"
          : missingSections.length <= 2
            ? "attention_needed"
            : "concerns_found",
      statusLabel: `${detectedSections.length}/${expectedSections.length} Sections Found`,
      findingsCount: missingSections.length > 0 ? 1 : 0,
      unreviewedCount: missingSections.length > 0 ? 1 : 0,
      metrics: {
        "Sections Detected": detectedSections.length,
        "Missing Sections": missingSections.length,
      },
      summaryText:
        missingSections.length === 0
          ? "All standard IMRaD sections detected."
          : `Missing section headers: ${missingSections.map((s) => s.name).join(", ")}.`,
    };
  } catch {
    structureSummary = {
      dimension: "structure",
      label: "Document Structure",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error inspecting document structure.",
    };
  }

  // -------------------------------------------------------------------------
  // DIMENSION 7: EXTRACTION & OCR DIAGNOSTICS
  // -------------------------------------------------------------------------
  let extractionSummary: DimensionSummary;
  try {
    const replacementChars = (trimmed.match(/\uFFFD/g) || []).length;
    // eslint-disable-next-line no-control-regex
    const nonAsciiCount = (trimmed.match(/[^\x00-\x7F]/g) || []).length;
    const nonAsciiRatio = Math.round((nonAsciiCount / Math.max(1, trimmed.length)) * 100);

    const isTextShort = wordCount < 50;
    const isCorruptEncoding = replacementChars > 5 || nonAsciiRatio > 25;

    if (isTextShort) {
      addFinding({
        dimension: "extraction",
        title: "Short Text Extraction Warning",
        description: `Extracted text contains only ${wordCount} words. Extremely short text limits the statistical reliability of integrity checks.`,
        status: "technical_error",
        severity: "warning",
        confidence: "Deterministic",
        evidence: `${wordCount} words extracted`,
        location: "Document Extraction",
        suggestedAction: "Ensure the full PDF or manuscript text was imported.",
      });
    }

    if (isCorruptEncoding) {
      addFinding({
        dimension: "extraction",
        title: "Potential OCR or Font Encoding Artifacts",
        description:
          "Extracted document contains unusual replacement characters or high non-standard character density.",
        status: "technical_error",
        severity: "warning",
        confidence: "Encoding Check",
        evidence: `${replacementChars} replacement chars, ${nonAsciiRatio}% non-standard symbols`,
        location: "Text Ingestion",
        suggestedAction:
          "Check if the source PDF requires optical character recognition (OCR) or font embedding repair.",
      });
    }

    extractionSummary = {
      dimension: "extraction",
      label: "Extraction & OCR Diagnostics",
      status: isCorruptEncoding || isTextShort ? "technical_issue" : "pass",
      statusLabel: isCorruptEncoding
        ? "Encoding Artifacts"
        : isTextShort
          ? "Short Text"
          : "Clean Text Stream",
      findingsCount: (isTextShort ? 1 : 0) + (isCorruptEncoding ? 1 : 0),
      unreviewedCount: (isTextShort ? 1 : 0) + (isCorruptEncoding ? 1 : 0),
      metrics: {
        "Word Count": wordCount,
        "Encoding Errors": replacementChars,
      },
      summaryText: isCorruptEncoding
        ? "Encoding artifacts detected in text stream."
        : isTextShort
          ? "Text is short (<50 words); statistical tests are less sensitive."
          : "Clean text stream with zero font encoding artifacts.",
    };
  } catch {
    extractionSummary = {
      dimension: "extraction",
      label: "Extraction & OCR Diagnostics",
      status: "technical_issue",
      statusLabel: "Error",
      findingsCount: 0,
      unreviewedCount: 0,
      metrics: {},
      summaryText: "Error checking text encoding.",
    };
  }

  const dimensions: Record<IntegrityDimension, DimensionSummary> = {
    similarity: similaritySummary,
    ai_signals: aiSignalsSummary,
    citations: citationSummary,
    references: referenceSummary,
    readability: readabilitySummary,
    structure: structureSummary,
    extraction: extractionSummary,
  };

  return {
    id: `integ_${Date.now()}`,
    title,
    fileName,
    analyzedAt: new Date().toISOString(),
    wordCount,
    dimensions,
    findings,
    ethicalDisclaimer:
      "This Research Integrity Report provides traceable diagnostic findings across independent statistical, structural, and bibliographic dimensions. These findings represent automated advisory checks and do NOT constitute proof of misconduct, fabrication, or dishonesty. Authors and peer reviewers must inspect primary evidence before making determinations.",
  };
}

export const RESEARCH_INTEGRITY_DEMO_MANUSCRIPT = `Abstract
Neural document retrieval models have demonstrated dramatic empirical progress across scholarly benchmarks [1]. This study evaluates attention mechanisms and dense passage representations.

Introduction
In recent years, the rapid advancement of artificial intelligence and deep neural networks has revolutionized various domains including computer vision, natural language processing, and automated decision-making. Recent breakthroughs have demonstrated that masked language models can capture rich semantic representations from massive unannotated corpora by leveraging bidirectional transformer encoders.

Methodology
The experimental configuration evaluated the multi-stage retrieval architecture on standard academic benchmarks. The attention mechanism computes a weighted sum of values based on compatibility between query vectors and key representations. All models were trained using AdamW optimization on 4 NVIDIA A100 GPUs with deterministic seeds.

Results & Discussion
The experimental results showed a 14.2% increase in precision over baseline models. Comparative evaluations confirmed that lexical normalizers significantly improved disambiguation thresholds. Furthermore, we cite [2] and [99] in this section.

REFERENCES
[1] A. Vaswani, N. Shazeer, N. Parmar, et al., "Attention Is All You Need," in Advances in Neural Information Processing Systems (NeurIPS), 2018. doi: 10.48550/arXiv.1706.03762.
[2] J. Devlin, M. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding," NAACL, 2018. doi: 10.48550/arxiv.1810.04805.
[3] Y. LeCun, Y. Bengio, and G. Hinton, "Deep Learning," Nature, 2015. doi: 10.1038/nature14539.
[4] S. Sanjay, "Algorithmic Precision in Repositories," in IEEE Access, 2023. doi: 1109/MALFORMED.DOI.`;
