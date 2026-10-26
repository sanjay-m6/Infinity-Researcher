import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewMatrixView } from "../features/review-matrix/ReviewMatrixView";
import { EvidenceDrawer } from "../features/review-matrix/EvidenceDrawer";
import { EvidenceCopilotModal } from "../features/review-matrix/EvidenceCopilotModal";
import { ColumnConfigModal } from "../features/review-matrix/ColumnConfigModal";
import { AddPapersModal } from "../features/review-matrix/AddPapersModal";
import * as desktopApi from "../lib/desktop-api";
import { MatrixWorkspaceDetail, MatrixRow, MatrixColumnConfig } from "../lib/desktop-api/types";

describe("Literature Review Matrix & Evidence-Linked Copilot Suite", () => {
  const mockColumns: MatrixColumnConfig[] = [
    { key: "research_question", label: "Research Question", col_type: "text", required: true, width: 240 },
    { key: "methodology", label: "Methodology", col_type: "text", required: true, width: 220 },
    { key: "dataset", label: "Dataset / Benchmark", col_type: "text", required: false, width: 180 },
    { key: "sample_size", label: "Sample Size", col_type: "text", required: false, width: 130 },
    { key: "main_findings", label: "Main Findings", col_type: "text", required: true, width: 260 },
  ];

  const mockRows: MatrixRow[] = [
    {
      paper_id: "p_1",
      paper_title: "Fault-Tolerant Surface Codes for Quantum Processors",
      authors: ["Alice Smith", "Bob Jones"],
      year: 2025,
      venue: "Nature Quantum",
      doi: "10.1038/s41586-025-001",
      pdf_path: "C:/papers/quantum.pdf",
      added_at: "2026-10-26T12:00:00Z",
      extractions: {
        research_question: {
          id: "ext_1",
          workspace_id: "default_matrix",
          paper_id: "p_1",
          field_key: "research_question",
          extracted_value: "How to scale surface codes with sub-threshold physical error rates?",
          confidence: 0.94,
          page_number: 1,
          char_offset_start: 0,
          char_offset_end: 65,
          source_passage: "In this work, we investigate scaling surface codes with sub-threshold physical error rates.",
          status: "user_verified",
          created_at: "2026-10-26T12:00:00Z",
          updated_at: "2026-10-26T12:00:00Z",
        },
        methodology: {
          id: "ext_2",
          workspace_id: "default_matrix",
          paper_id: "p_1",
          field_key: "methodology",
          extracted_value: "Syndrome graph decoding with neural minimum-weight matching.",
          confidence: 0.89,
          page_number: 3,
          char_offset_start: 120,
          char_offset_end: 180,
          source_passage: "We develop a syndrome graph decoding approach with neural minimum-weight matching.",
          status: "extracted",
          created_at: "2026-10-26T12:00:00Z",
          updated_at: "2026-10-26T12:00:00Z",
        },
        sample_size: {
          id: "ext_3",
          workspace_id: "default_matrix",
          paper_id: "p_1",
          field_key: "sample_size",
          extracted_value: "N = 50,000 Monte Carlo syndrome cycles",
          confidence: 0.95,
          page_number: 5,
          char_offset_start: 400,
          char_offset_end: 440,
          source_passage: "evaluated across N = 50,000 Monte Carlo syndrome cycles.",
          status: "extracted",
          created_at: "2026-10-26T12:00:00Z",
          updated_at: "2026-10-26T12:00:00Z",
        },
      },
    },
  ];

  const mockDetail: MatrixWorkspaceDetail = {
    workspace: {
      id: "default_matrix",
      title: "Main Literature Review Matrix",
      description: "Comparison matrix",
      columns_json: JSON.stringify(mockColumns),
      created_at: "2026-10-26T12:00:00Z",
      updated_at: "2026-10-26T12:00:00Z",
    },
    columns: mockColumns,
    rows: mockRows,
    total_papers: 1,
    total_extractions: 3,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "listMatrixWorkspaces").mockResolvedValue([mockDetail.workspace]);
    vi.spyOn(desktopApi, "getMatrixWorkspaceDetail").mockResolvedValue(mockDetail);
  });

  it("renders ReviewMatrixView with toolbar, spreadsheet grid, and extracted claims", async () => {
    render(<ReviewMatrixView />);

    await waitFor(() => {
      expect(screen.getByText("Literature Review Matrix")).toBeInTheDocument();
      expect(screen.getByText("Local-First Verification")).toBeInTheDocument();
    });

    // Check header buttons
    expect(screen.getByText("Columns")).toBeInTheDocument();
    expect(screen.getByText("Evidence Copilot")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
    expect(screen.getByText("Add Papers")).toBeInTheDocument();

    // Check table headers
    expect(screen.getByText("Paper & Authors")).toBeInTheDocument();
    expect(screen.getByText("Research Question")).toBeInTheDocument();
    expect(screen.getByText("Methodology")).toBeInTheDocument();

    // Check paper row & extractions
    expect(screen.getByText("Fault-Tolerant Surface Codes for Quantum Processors")).toBeInTheDocument();
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/How to scale surface codes/i)).toBeInTheDocument();
    expect(screen.getByText(/N = 50,000 Monte Carlo syndrome cycles/i)).toBeInTheDocument();
  });

  it("renders EvidenceDrawer with source quote, page number, and verify claim action", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onNavPdf = vi.fn();

    render(
      <EvidenceDrawer
        isOpen={true}
        onClose={() => {}}
        row={mockRows[0]}
        column={mockColumns[1]} // Methodology
        extraction={mockRows[0].extractions.methodology}
        onSaveExtraction={onSave}
        onNavigateToPdf={onNavPdf}
      />
    );

    expect(screen.getByText("Evidence & Claim Inspector")).toBeInTheDocument();
    expect(screen.getByText("Supporting Source Passage")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(
      screen.getByText(/"We develop a syndrome graph decoding approach with neural minimum-weight matching."/)
    ).toBeInTheDocument();

    // Verify button exists
    expect(screen.getByText("Verify Claim")).toBeInTheDocument();
    expect(screen.getByText("Save Value")).toBeInTheDocument();

    // Click jump to PDF page
    fireEvent.click(screen.getByText("Jump to Page 3 in PDF Reader"));
    expect(onNavPdf).toHaveBeenCalledWith("p_1", 3);
  });

  it("renders EvidenceCopilotModal with suggested prompts, QA, and grounded evidence chips", async () => {
    vi.spyOn(desktopApi, "getEvidenceCopilotMessages").mockResolvedValue([
      {
        id: "msg_1",
        session_id: "session_matrix_default_matrix",
        role: "user",
        content: "What sample size was evaluated?",
        evidence_sources_json: "[]",
        created_at: "2026-10-26T12:00:00Z",
      },
      {
        id: "msg_2",
        session_id: "session_matrix_default_matrix",
        role: "assistant",
        content: "The authors evaluated 50,000 Monte Carlo syndrome cycles.",
        evidence_sources_json: JSON.stringify([
          {
            paper_id: "p_1",
            paper_title: "Fault-Tolerant Surface Codes for Quantum Processors",
            page_number: 5,
            passage: "evaluated across N = 50,000 Monte Carlo syndrome cycles.",
            confidence: 0.95,
          },
        ]),
        created_at: "2026-10-26T12:00:01Z",
      },
    ]);

    render(
      <EvidenceCopilotModal
        isOpen={true}
        onClose={() => {}}
        workspaceId="default_matrix"
        rows={mockRows}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Evidence-Linked AI Copilot")).toBeInTheDocument();
      expect(screen.getByText("What sample size was evaluated?")).toBeInTheDocument();
      expect(
        screen.getByText("The authors evaluated 50,000 Monte Carlo syndrome cycles.")
      ).toBeInTheDocument();
      expect(screen.getByText("Show Supporting Evidence (1 passages)")).toBeInTheDocument();
    });

    // Expand evidence
    fireEvent.click(screen.getByText("Show Supporting Evidence (1 passages)"));
    expect(
      screen.getByText(/"evaluated across N = 50,000 Monte Carlo syndrome cycles."/)
    ).toBeInTheDocument();
    expect(screen.getByText("p. 5")).toBeInTheDocument();
  });

  it("renders ColumnConfigModal and allows adding a custom dimension", async () => {
    const onSaveCols = vi.fn().mockResolvedValue(undefined);

    render(
      <ColumnConfigModal
        isOpen={true}
        onClose={() => {}}
        columns={mockColumns}
        onSaveColumns={onSaveCols}
      />
    );

    expect(screen.getByText("Customize Matrix Columns")).toBeInTheDocument();
    expect(screen.getByText("Research Question")).toBeInTheDocument();

    // Add custom column
    const input = screen.getByPlaceholderText(/Hardware Used, Loss Function/i);
    fireEvent.change(input, { target: { value: "Hardware Architecture" } });
    fireEvent.click(screen.getByText("Add"));

    expect(screen.getByText("Hardware Architecture")).toBeInTheDocument();
  });

  it("renders AddPapersModal and provides Add & Extract action", async () => {
    vi.spyOn(desktopApi, "listPapers").mockResolvedValue({
      items: [
        {
          id: "p_2",
          title: "Neural Error Mitigation for NISQ Devices",
          clean_title_key: "neural error mitigation",
          abstract_text: "We introduce neural error mitigation with 10x lower variance.",
          publication_date: "2025-01-01",
          publication_year: 2025,
          venue: "IEEE QCE",
          venue_type: "conference",
          canonical_doi: null,
          language: "en",
          citation_count: 5,
          reference_count: 20,
          is_open_access: true,
          license: "CC-BY",
          primary_landing_url: "",
          pdf_url: null,
          has_file: true,
          local_pdf_path: "C:/p2.pdf",
          content_hash: null,
          metadata_confidence: "verified",
          is_saved: true,
          authors: [
            {
              id: "auth_1",
              full_name: "Test Author",
              family_name: "Author",
              given_name: "Test",
              orcid: null,
              affiliation: null,
              author_order: 1,
              created_at: "2026-10-26T12:00:00Z",
            },
          ],
          collection_ids: [],
          tags: [],
          source_names: ["IEEE"],
          created_at: "2026-10-26T12:00:00Z",
          updated_at: "2026-10-26T12:00:00Z",
        },
      ],
      total_count: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddPapersModal
        isOpen={true}
        onClose={() => {}}
        existingPaperIds={new Set(["p_1"])}
        onAddPaper={onAdd}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Add Papers to Literature Review Matrix")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Neural Error Mitigation for NISQ Devices")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add & Extract"));
    expect(onAdd).toHaveBeenCalledWith("p_2");
  });
});
