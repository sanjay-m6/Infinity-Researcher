import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { IntegrityView } from "../features/integrity/IntegrityView";
import { SimilarityWorkspace } from "../features/integrity/SimilarityWorkspace";
import { AiSignalWorkspace } from "../features/integrity/AiSignalWorkspace";
import { WritingAssistantWorkspace } from "../features/integrity/WritingAssistantWorkspace";
import { CorpusManagerModal } from "../features/integrity/CorpusManagerModal";
import * as desktopApi from "../lib/desktop-api";

describe("Research Integrity & Writing Suite (Parts A-G)", () => {
  it("renders IntegrityView with 3 feature cards, local privacy badge, and dropzone", async () => {
    vi.spyOn(desktopApi, "getIntegrityDashboardSummary").mockResolvedValue({
      total_documents_analyzed: 5,
      total_corpus_sources: 12,
      total_fingerprints_indexed: 3450,
      recent_similarity_runs: [],
      available_models: [],
      active_writing_sessions: 2,
    });
    vi.spyOn(desktopApi, "listIntegrityDocuments").mockResolvedValue([]);

    render(
      <AppProvider>
        <IntegrityView />
      </AppProvider>
    );

    // Title & Privacy Badge
    expect(screen.getByText("Research Integrity & Writing Suite")).toBeInTheDocument();
    expect(screen.getByText(/Local Only • Documents Never Uploaded/i)).toBeInTheDocument();

    // 3 Pillar Feature Cards
    expect(screen.getByText("Check Similarity")).toBeInTheDocument();
    expect(screen.getByText("AI-Writing Signals")).toBeInTheDocument();
    expect(screen.getByText("Improve Writing")).toBeInTheDocument();

    // Ingestion Actions
    expect(screen.getByText("Paste Draft Text")).toBeInTheDocument();
    expect(screen.getByText("Choose from Research Library")).toBeInTheDocument();
    expect(screen.getByText("Corpus Manager")).toBeInTheDocument();
  });

  it("renders CorpusManagerModal with honest coverage guarantee notice", async () => {
    vi.spyOn(desktopApi, "listCorpusSources").mockResolvedValue([
      {
        id: "src_1",
        source_type: "library_paper",
        source_ref: "paper_123",
        title: "Scalable Superconducting Qubits",
        authors: "A. Smith, B. Jones",
        venue: "Nature Physics",
        year: 2023,
        doi: "10.1038/s41567-023-0001-x",
        canonical_url: "https://doi.org/10.1038/s41567-023-0001-x",
        file_path: null,
        content_hash: "hash123",
        raw_content: "Sample content...",
        word_count: 540,
        fingerprint_count: 32,
        is_active: true,
        indexed_at: "2026-10-26T12:00:00Z",
        last_error: null,
      },
    ]);

    render(
      <CorpusManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Local Corpus Manager")).toBeInTheDocument();
    expect(screen.getByText(/Corpus Coverage Guarantee:/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Scalable Superconducting Qubits")).toBeInTheDocument();
    });
    expect(screen.getByText("Index Research Library")).toBeInTheDocument();
  });

  it("renders SimilarityWorkspace with 3 columns, match selection, and review buttons", async () => {
    const mockReport: desktopApi.SimilarityReport = {
      run: {
        id: "run_1",
        document_id: "doc_1",
        status: "completed",
        total_body_words: 250,
        matched_body_words: 100,
        overall_similarity_ratio: 0.40,
        corpus_sources_searched: 1,
        matched_sources_count: 1,
        matches_count: 1,
        execution_duration_ms: 12,
        error_message: null,
        created_at: "2026-10-26T12:00:00Z",
        completed_at: "2026-10-26T12:00:01Z",
      },
      document: {
        id: "doc_1",
        source_type: "file",
        source_reference: "/docs/draft.txt",
        file_hash: "hash_abc",
        file_name: "draft.txt",
        file_format: "txt",
        file_size_bytes: 1200,
        raw_content: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
        normalized_content: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
        word_count: 250,
        page_count: 1,
        extraction_metadata: null,
        created_at: "2026-10-26T12:00:00Z",
        updated_at: "2026-10-26T12:00:00Z",
      },
      segments: [
        {
          id: "seg_1",
          document_id: "doc_1",
          segment_index: 0,
          segment_type: "paragraph",
          raw_text: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
          normalized_text: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
          char_start: 0,
          char_end: 86,
          page_number: 1,
          embedding_id: null,
          created_at: "2026-10-26T12:00:00Z",
        },
      ],
      matches: [
        {
          id: "match_1",
          similarity_run_id: "run_1",
          corpus_source_id: "src_1",
          match_type: "exact",
          target_char_start: 0,
          target_char_end: 86,
          target_page_number: 1,
          target_passage: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
          source_char_start: 10,
          source_char_end: 96,
          source_page_number: 1,
          source_passage: "In this work, we demonstrate a 10-qubit quantum processor with 99.8% gate fidelity [1].",
          overlap_chars: 86,
          confidence_score: 1.0,
          review_status: "unreviewed",
          review_notes: null,
          created_at: "2026-10-26T12:00:00Z",
          source_title: "Quantum Architecture Reference",
          source_authors: "Dr. Alice",
          source_doi: "10.1038/s41586-020-0001-2",
          source_canonical_url: "https://doi.org/10.1038/s41586-020-0001-2",
        },
      ],
      corpus_coverage_note: "Searched 1 indexed corpus source.",
      formula_explanation: "Similarity ratio = unique matched characters / total body characters.",
    };

    render(
      <SimilarityWorkspace
        report={mockReport}
        onBack={() => {}}
      />
    );

    // Left summary tiles
    expect(screen.getByText("Overall Ratio")).toBeInTheDocument();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);

    // Center viewer text
    expect(screen.getAllByText(/10-qubit quantum processor/i).length).toBeGreaterThan(0);

    // Right details & review buttons
    expect(screen.getAllByText("Quantum Architecture Reference").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark as Quote").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Citation Present").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Boilerplate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not a Match").length).toBeGreaterThan(0);
  });

  it("renders AiSignalWorkspace with mandatory uncertainty caveat and classification", async () => {
    const mockDoc: desktopApi.IntegrityDocument = {
      id: "doc_ai_1",
      source_type: "pasted_text",
      source_reference: null,
      file_hash: "hash_ai",
      file_name: "ai_essay.txt",
      file_format: "txt",
      file_size_bytes: 800,
      raw_content: "Detailed text for testing...",
      normalized_content: "Detailed text for testing...",
      word_count: 120,
      page_count: 1,
      extraction_metadata: null,
      created_at: "2026-10-26T12:00:00Z",
      updated_at: "2026-10-26T12:00:00Z",
    };

    const mockRun: desktopApi.AiSignalRun = {
      id: "ai_run_1",
      document_id: "doc_ai_1",
      model_id: "baseline-statistical-v1",
      model_version: "1.0.0",
      inference_mode: "local",
      status: "completed",
      overall_signal_score: 0.25,
      signal_classification: "low_ai_signal",
      analyzed_characters: 600,
      analyzed_paragraphs: 2,
      uncertainty_caveat: "Classifiers exhibit false positives and never prove misconduct.",
      created_at: "2026-10-26T12:00:00Z",
      completed_at: "2026-10-26T12:00:01Z",
    };

    render(
      <AiSignalWorkspace
        document={mockDoc}
        segments={[]}
        existingRun={mockRun}
        onBack={() => {}}
        onRunCompleted={() => {}}
      />
    );

    // Strict uncertainty banner
    expect(screen.getByText(/Strict Uncertainty Caveat:/i)).toBeInTheDocument();
    expect(screen.getByText(/never constitute proof/i)).toBeInTheDocument();

    // Signal classification
    expect(screen.getByText(/Low AI Signal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/25%/i).length).toBeGreaterThan(0);
  });


  it("renders WritingAssistantWorkspace with side-by-side layout and protected token badges", async () => {
    const mockDoc: desktopApi.IntegrityDocument = {
      id: "doc_write_1",
      source_type: "pasted_text",
      source_reference: null,
      file_hash: "hash_w",
      file_name: "paper_draft.txt",
      file_format: "txt",
      file_size_bytes: 500,
      raw_content: "We did a lot of experiments yielding 45.2% efficiency [4].",
      normalized_content: "We did a lot of experiments yielding 45.2% efficiency [4].",
      word_count: 10,
      page_count: 1,
      extraction_metadata: null,
      created_at: "2026-10-26T12:00:00Z",
      updated_at: "2026-10-26T12:00:00Z",
    };

    vi.spyOn(desktopApi, "createWritingSession").mockResolvedValue({
      id: "sess_1",
      document_id: "doc_write_1",
      title: "Session 1",
      active_mode: "academic_tone",
      created_at: "2026-10-26T12:00:00Z",
      updated_at: "2026-10-26T12:00:00Z",
    });

    vi.spyOn(desktopApi, "listWritingRevisions").mockResolvedValue([
      {
        id: "rev_1",
        session_id: "sess_1",
        revision_number: 1,
        action_type: "academic_tone",
        original_text: "We did a lot of experiments yielding 45.2% efficiency [4].",
        revised_text: "We conducted substantial quantities of experiments yielding 45.2% efficiency [4].",
        diff_summary: JSON.stringify({ additions_count: 2, deletions_count: 2, net_word_change: 2 }),
        preserved_numbers_ok: true,
        preserved_citations_ok: true,
        preserved_equations_ok: true,
        preserved_dois_ok: true,
        meaning_risk_flags: null,
        is_accepted: false,
        created_at: "2026-10-26T12:00:00Z",
      },
    ]);

    render(
      <WritingAssistantWorkspace
        document={mockDoc}
        onBack={() => {}}
      />
    );

    // Header & Privacy
    expect(screen.getByText("Academic Writing Assistant • paper_draft.txt")).toBeInTheDocument();
    expect(screen.getByText(/Local Processing Only • Zero Cloud Leakage/i)).toBeInTheDocument();

    // Mode buttons
    expect(screen.getByText("Academic Tone")).toBeInTheDocument();
    expect(screen.getByText("Improve Clarity")).toBeInTheDocument();

    // Side-by-side columns
    expect(screen.getByText("Original Source Draft (Immutable)")).toBeInTheDocument();
    expect(screen.getByText("Proposed Revision")).toBeInTheDocument();

    // Protected Token Badges
    await waitFor(() => {
      expect(screen.getByText("Numbers & Units:")).toBeInTheDocument();
      expect(screen.getByText("Citations:")).toBeInTheDocument();
      expect(screen.getByText("Equations:")).toBeInTheDocument();
      expect(screen.getByText("Accept Revision")).toBeInTheDocument();
    });
  });
});
