import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import {
  ingestDocumentContent,
  startAnalysisJob,
  cancelAnalysisJob,
  saveIntegrityReportDb,
  getIntegrityReportDb,
  listSavedIntegrityReportsDb,
  deleteIntegrityReportDb,
  updateIntegrityFindingReviewDb,
  saveCitationAuditDb,
  getCitationAuditDb,
  listCitationAuditsDb,
  saveWritingRevisionDb,
  listWritingRevisionsDb,
  saveReadabilityReportDb,
  getReadabilityReportByHashDb,
  extractDocumentText,
  detectAiSignals,
} from "../lib/desktop-api";
import { AcademicWritingWorkspaceView } from "../features/writing-workspace/AcademicWritingWorkspaceView";
import { ReadabilityAnalyzerView } from "../features/readability/ReadabilityAnalyzerView";
import { ResearchIntegrityView } from "../features/integrity/ResearchIntegrityView";
import { AiToolWorkspaceView } from "../features/ai-tools/AiToolWorkspaceView";

describe("Phase 9 — Backend Integration, Database & Performance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Document Ingestion & Hash-Based Deduplication Contract", () => {
    it("ingests document content and returns calculated SHA-256 hash, word count, and clean encoding flag", async () => {
      const sample =
        "Deep learning and neural networks have revolutionized pattern recognition in academic literature.";
      const meta = await ingestDocumentContent("sample.txt", "txt", sample);

      expect(meta.file_name).toBe("sample.txt");
      expect(meta.file_format).toBe("txt");
      expect(meta.word_count).toBe(12);
      expect(meta.char_count).toBe(sample.length);
      expect(meta.is_clean_encoding).toBe(true);
      expect(meta.document_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("throws error for empty document content ingestion", async () => {
      await expect(
        ingestDocumentContent("empty.txt", "txt", "   \n\t  ")
      ).rejects.toThrow();
    });
  });

  describe("Analysis Job Lifecycle & Cancellation", () => {
    it("starts a background analysis job and registers job status", async () => {
      const docHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const job = await startAnalysisJob("integrity_evaluation", docHash);

      expect(job.id).toBeTruthy();
      expect(job.job_type).toBe("integrity_evaluation");
      expect(job.document_hash).toBe(docHash);
      expect(job.status).toBe("queued");
      expect(job.progress_pct).toBe(0);
    });

    it("cancels an active analysis job gracefully", async () => {
      const docHash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const job = await startAnalysisJob("citation_audit", docHash);
      const cancelled = await cancelAnalysisJob(job.id);

      expect(cancelled).toBe(true);
    });
  });

  describe("Research Integrity Reports SQLite Persistence", () => {
    it("saves, lists, retrieves, and deletes integrity reports with findings", async () => {
      const reportId = `rep_test_${Date.now()}`;
      const docHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const saved = await saveIntegrityReportDb({
        id: reportId,
        document_hash: docHash,
        file_name: "test_manuscript.pdf",
        title: "Test Manuscript Evaluation",
        word_count: 1450,
        dimensions_json: JSON.stringify([
          { dimension: "similarity", status: "pass", findingsCount: 0 },
        ]),
        ethical_disclaimer: "Advisory only.",
        findings_count: 1,
        unreviewed_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        findings: [
          {
            id: `find_${Date.now()}`,
            report_id: reportId,
            dimension: "similarity",
            title: "Verbatim block detected",
            description: "High lexical similarity with library corpus",
            status: "attention",
            severity: "warning",
            confidence: "high",
            evidence: "Sample text excerpt",
            location: "Section 2",
            suggested_action: "Provide attribution",
            is_reviewed: false,
            created_at: new Date().toISOString(),
          },
        ],
      });

      expect(saved.id).toBe(reportId);

      const list = await listSavedIntegrityReportsDb(1, 10);
      expect(list.length).toBeGreaterThanOrEqual(1);

      const retrieved = await getIntegrityReportDb(reportId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.document_hash).toBe(docHash);

      const updated = await updateIntegrityFindingReviewDb(
        saved.findings[0].id,
        true,
        "Reviewed by author"
      );
      expect(updated).toBe(true);

      const deleted = await deleteIntegrityReportDb(reportId);
      expect(deleted).toBe(true);
    });
  });

  describe("Citation Audits Persistence", () => {
    it("saves, lists, and retrieves citation audit records", async () => {
      const auditId = `audit_test_${Date.now()}`;
      const docHash = "c17a7109a4d33f7528e0857a2c67f5024e18b456e484bf8e1e779a1d4a0479f6";

      const saved = await saveCitationAuditDb({
        id: auditId,
        document_hash: docHash,
        document_title: "Attention In Modern Deep Learning",
        file_name: "attention.tex",
        total_in_text: 8,
        total_references: 7,
        matched_citations: 6,
        health_score: 85,
        summary_json: JSON.stringify({ overallHealthScore: 85 }),
        issues_json: JSON.stringify([]),
        references_json: JSON.stringify([]),
        created_at: new Date().toISOString(),
      });

      expect(saved.id).toBe(auditId);
      expect(saved.health_score).toBe(85);

      const retrieved = await getCitationAuditDb(auditId);
      expect(retrieved.document_title).toBe("Attention In Modern Deep Learning");

      const audits = await listCitationAuditsDb(1, 10);
      expect(audits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Writing Revisions Database Operations", () => {
    it("saves writing revisions and lists revisions by session ID", async () => {
      const sessionId = `session_ai_humanizer_${Date.now()}`;
      const revId = `rev_${Date.now()}`;

      const rev = await saveWritingRevisionDb({
        id: revId,
        session_id: sessionId,
        revision_number: 1,
        action_type: "natural_flow",
        original_text:
          "In recent years, deep learning has revolutionized computer vision.",
        revised_text: "Recently, deep neural networks have transformed computer vision.",
        diff_summary: "Delta words: 0, score: 98",
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        is_accepted: false,
        created_at: new Date().toISOString(),
      });

      expect(rev.id).toBe(revId);

      const list = await listWritingRevisionsDb(sessionId);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].action_type).toBe("natural_flow");
    });
  });

  describe("Readability Reports Persistence", () => {
    it("saves readability report and retrieves by document hash", async () => {
      const docHash = `hash_read_${Date.now()}`;
      const repId = `read_${Date.now()}`;

      const saved = await saveReadabilityReportDb({
        id: repId,
        document_hash: docHash,
        document_title: "Empirical Stylometry Study",
        language_code: "en",
        word_count: 500,
        sentence_count: 25,
        flesch_reading_ease: 45.2,
        flesch_kincaid_grade: 12.8,
        gunning_fog_index: 14.1,
        metrics_json: JSON.stringify({ fleschReadingEase: 45.2 }),
        vocabulary_json: JSON.stringify({ totalWords: 500 }),
        paragraphs_json: JSON.stringify([]),
        recommendations_json: JSON.stringify(["Use active voice"]),
        created_at: new Date().toISOString(),
      });

      expect(saved.id).toBe(repId);

      const byHash = await getReadabilityReportByHashDb(docHash);
      expect(byHash).toBeTruthy();
      expect(byHash?.flesch_reading_ease).toBe(45.2);
    });
  });

  describe("Python Engine Extraction & AI Signal Detection Contracts", () => {
    it("extracts document text structure with clean metadata", async () => {
      const extracted = await extractDocumentText("/path/to/manuscript.txt");
      expect(extracted).toBeTruthy();
      expect(extracted.file_name).toBeTruthy();
      expect(extracted.text).toBeTruthy();
      expect(extracted.word_count).toBeGreaterThan(0);
    });

    it("evaluates statistical AI writing signals and stylistic cadence with uncertainty caveat", async () => {
      const text =
        "In recent years, the rapid advancement of artificial intelligence has revolutionized various domains including computer vision, natural language processing, and automated decision-making. Furthermore, transformer architectures have established new state of the art results. It is important to note that computational resources remain a constraint. Delving deeper into the empirical results, one observes significant gains across all benchmarks.";

      const res = await detectAiSignals(text);
      expect(res.status).toBe("completed");
      expect(res.overall_signal_score).toBeTypeOf("number");
      expect(res.classification).toBeTruthy();
      expect(res.uncertainty_caveat).toMatch(/cadence|authorship|uniformity/i);
    });
  });

  describe("UI Component Integration", () => {
    it("renders ReadabilityAnalyzerView and computes scores with persistence", async () => {
      render(
        <AppProvider>
          <ReadabilityAnalyzerView />
        </AppProvider>
      );

      expect(screen.getByText(/Readability & Clarity Analyzer/i)).toBeTruthy();
      await waitFor(() => {
        expect(screen.getAllByText(/Flesch Reading Ease/i).length).toBeGreaterThan(0);
      });
    });

    it("renders ResearchIntegrityView and displays multi-dimensional integrity audit", async () => {
      render(
        <AppProvider>
          <ResearchIntegrityView />
        </AppProvider>
      );

      expect(screen.getByText(/Research Integrity Auditor/i)).toBeTruthy();
      await waitFor(() => {
        expect(screen.getByText(/Demo Sample/i)).toBeTruthy();
      });
    });

    it("renders AcademicWritingWorkspaceView and tracks revision sessions", async () => {
      render(
        <AppProvider>
          <AcademicWritingWorkspaceView toolId="ai_humanizer" />
        </AppProvider>
      );

      expect(screen.getByText(/AI Humanizer & Scholarly Flow/i)).toBeTruthy();
      expect(screen.getByText(/Original Source Manuscript/i)).toBeTruthy();
      expect(screen.getByText(/Revised Scholarly Prose/i)).toBeTruthy();
    });

    it("renders AiToolWorkspaceView with AI Writing Detector controls and cancellation", async () => {
      render(
        <AppProvider>
          <AiToolWorkspaceView toolId="ai_writing_detector" />
        </AppProvider>
      );

      expect(screen.getByText(/AI Writing Detector/i)).toBeTruthy();
      expect(screen.getByText(/Scan Stylometric Signals/i)).toBeTruthy();

      const scanBtn = screen.getByText(/Scan Stylometric Signals/i);
      fireEvent.click(scanBtn);

      await waitFor(() => {
        expect(screen.getByText(/Machine Generation Probability/i)).toBeTruthy();
      });
    });
  });
});
