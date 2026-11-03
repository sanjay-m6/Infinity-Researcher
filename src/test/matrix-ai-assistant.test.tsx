import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewMatrixView } from "../features/review-matrix/ReviewMatrixView";
import * as desktopApi from "../lib/desktop-api";
import {
  MatrixWorkspace,
  MatrixWorkspaceDetail,
  EvidenceCopilotMessage,
} from "../lib/desktop-api/types";

describe("Literature Review Matrix — Dedicated AI Research Assistant & Side-by-Side Panel Suite", () => {
  const mockWorkspaces: MatrixWorkspace[] = [
    {
      id: "ws_default",
      title: "Smart Grid Security Review",
      description: "Comparative matrix for decentralized grid security",
      columns_json: "[]",
      created_at: "2026-01-10T10:00:00Z",
      updated_at: "2026-01-10T10:00:00Z",
    },
  ];

  const mockDetail: MatrixWorkspaceDetail = {
    workspace: mockWorkspaces[0],
    total_papers: 2,
    total_extractions: 4,
    columns: [
      { key: "research_question", label: "Research Question", col_type: "text", required: true, width: 220 },
      { key: "methodology", label: "Methodology", col_type: "text", required: true, width: 240 },
      { key: "main_findings", label: "Main Findings", col_type: "text", required: true, width: 260 },
    ],
    rows: [
      {
        paper_id: "paper_zhang_2023",
        paper_title: "Blockchain-Based Energy Trading in Smart Grids",
        authors: ["Zhang et al."],
        year: 2023,
        venue: "IEEE Transactions",
        doi: "10.1109/TSG.2023.1001",
        pdf_path: "/data/pdfs/zhang2023.pdf",
        added_at: "2026-01-14T10:32:00Z",
        extractions: {
          main_findings: {
            id: "ext_1",
            workspace_id: "ws_default",
            paper_id: "paper_zhang_2023",
            field_key: "main_findings",
            extracted_value: "Achieves 28% lower transaction latency and 15% cost reduction compared to baseline methods.",
            confidence: 0.92,
            page_number: 12,
            char_offset_start: 100,
            char_offset_end: 200,
            source_passage: "Our results show that the proposed blockchain-based trading framework achieves a 28% lower transaction latency and 15% cost reduction compared to baseline methods.",
            status: "user_verified",
            created_at: "2026-01-14T10:32:00Z",
            updated_at: "2026-01-14T10:32:00Z",
          },
        },
      },
      {
        paper_id: "paper_kim_2022",
        paper_title: "Deep Reinforcement Learning for Energy Management",
        authors: ["Kim and Lee"],
        year: 2022,
        venue: "Applied Energy",
        doi: "10.1016/j.apenergy.2022.2002",
        pdf_path: "/data/pdfs/kim2022.pdf",
        added_at: "2026-01-15T09:15:00Z",
        extractions: {
          main_findings: {
            id: "ext_2",
            workspace_id: "ws_default",
            paper_id: "paper_kim_2022",
            field_key: "main_findings",
            extracted_value: "Reduces peak load by 21% and improves grid stability compared to rule-based methods.",
            confidence: 0.88,
            page_number: 11,
            char_offset_start: 50,
            char_offset_end: 150,
            source_passage: "Simulations reveal that the multi-agent DQN architecture reduces peak load by 21% under high renewable intermittency.",
            status: "extracted",
            created_at: "2026-01-15T09:15:00Z",
            updated_at: "2026-01-15T09:15:00Z",
          },
        },
      },
    ],
  };

  const mockWelcomeHistory: EvidenceCopilotMessage[] = [
    {
      id: "msg_init",
      session_id: "session_matrix_ws_default",
      role: "assistant",
      content: "I am your AI Research Assistant grounded in this Literature Review Matrix (2 papers loaded).",
      evidence_sources_json: "[]",
      created_at: "2026-01-15T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    vi.spyOn(desktopApi, "listMatrixWorkspaces").mockResolvedValue(mockWorkspaces);
    vi.spyOn(desktopApi, "getMatrixWorkspaceDetail").mockResolvedValue(mockDetail);
    vi.spyOn(desktopApi, "getEvidenceCopilotMessages").mockResolvedValue(mockWelcomeHistory);
    vi.spyOn(desktopApi, "askEvidenceCopilot").mockResolvedValue({
      id: "msg_ans_1",
      session_id: "session_matrix_ws_default",
      role: "assistant",
      content: "Comparative analysis indicates Zhang et al. (2023) focuses on 28% lower transaction latency, whereas Kim and Lee (2022) focuses on 21% peak load reduction.",
      evidence_sources_json: JSON.stringify([
        {
          paper_id: "paper_zhang_2023",
          paper_title: "Blockchain-Based Energy Trading in Smart Grids",
          page_number: 12,
          passage: "Achieves a 28% lower transaction latency...",
          confidence: 0.92,
        },
        {
          paper_id: "paper_kim_2022",
          paper_title: "Deep Reinforcement Learning for Energy Management",
          page_number: 11,
          passage: "Reduces peak load by 21%...",
          confidence: 0.88,
        },
      ]),
      created_at: "2026-01-15T10:01:00Z",
    });
    vi.spyOn(desktopApi, "clearEvidenceCopilotMessages").mockResolvedValue(undefined);
    vi.spyOn(desktopApi, "saveNote").mockResolvedValue({
      id: "note_123",
      paper_id: "paper_zhang_2023",
      title: "Matrix Review Synthesis",
      content_markdown: "Synthesis content",
      created_at: "2026-01-15T10:02:00Z",
      updated_at: "2026-01-15T10:02:00Z",
    });
  });

  it("renders the Literature Review Matrix and toggles AI Assistant side panel from toolbar", async () => {
    const user = userEvent.setup();
    render(<ReviewMatrixView />);

    expect(await screen.findByText("Literature Review Matrix")).toBeInTheDocument();
    expect(screen.getByText(/Compare papers side-by-side with page-linked evidence/i)).toBeInTheDocument();

    // Check papers in table asynchronously
    expect(await screen.findByText("Blockchain-Based Energy Trading in Smart Grids")).toBeInTheDocument();
    expect(await screen.findByText("Deep Reinforcement Learning for Energy Management")).toBeInTheDocument();

    // Toolbar AI Assistant button
    const aiButton = screen.getByTestId("toolbar-ai-assistant");
    expect(aiButton).toBeInTheDocument();

    // Side panel should not be open initially
    expect(screen.queryByText("Context Scope:")).not.toBeInTheDocument();

    // Click AI Assistant button to open side-by-side panel
    await user.click(aiButton);

    // AI Assistant panel should be visible
    expect(await screen.findByText("Context Scope:")).toBeInTheDocument();
    expect(screen.getByText("All Papers")).toBeInTheDocument();
    expect(screen.getByText("Suggested:")).toBeInTheDocument();
  });

  it("clicking a matrix cell opens Evidence Details panel with claim, page and confidence", async () => {
    const user = userEvent.setup();
    const handleNavigateToPdf = vi.fn();
    render(<ReviewMatrixView onNavigateToDiscoverPdf={handleNavigateToPdf} />);

    // Click on Zhang et al's main findings cell
    const cell = await screen.findByText(/Achieves 28% lower transaction latency/i);
    await user.click(cell);

    // Evidence details panel opens
    expect(await screen.findByText("Evidence details")).toBeInTheDocument();
    expect(screen.getByText("Selected claim")).toBeInTheDocument();
    expect(screen.getByText("Source in paper")).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/i)).toBeInTheDocument();

    // Open PDF at page 12 button is clickable
    const openPdfButton = screen.getByRole("button", { name: /Open PDF at page 12/i });
    expect(openPdfButton).toBeInTheDocument();
    await user.click(openPdfButton);

    expect(handleNavigateToPdf).toHaveBeenCalledWith("paper_zhang_2023", 12);
  });

  it("switches tabs between AI Assistant and Evidence Details in the side panel", async () => {
    const user = userEvent.setup();
    render(<ReviewMatrixView />);

    // Click AI Assistant
    const aiButton = await screen.findByTestId("toolbar-ai-assistant");
    await user.click(aiButton);

    // AI Assistant view is active
    expect(screen.getByText("Context Scope:")).toBeInTheDocument();

    // Click Evidence Details tab in side panel
    const evidenceTab = screen.getByTestId("tab-evidence-details");
    await user.click(evidenceTab);

    // Evidence details tab is active
    expect(await screen.findByText("Evidence details")).toBeInTheDocument();

    // Switch back to AI Assistant tab
    const aiTab = screen.getByTestId("tab-ai-assistant");
    await user.click(aiTab);

    expect(await screen.findByText("Context Scope:")).toBeInTheDocument();
  });

  it("asks a question in AI Assistant, scopes request, and renders grounded answer with citation chips", async () => {
    const user = userEvent.setup();
    const handleNavigateToPdf = vi.fn();
    render(<ReviewMatrixView onNavigateToDiscoverPdf={handleNavigateToPdf} />);

    // Open AI Assistant
    const aiButton = await screen.findByTestId("toolbar-ai-assistant");
    await user.click(aiButton);

    // Ask a question
    const textarea = screen.getByPlaceholderText(/Ask about research questions, methods, datasets/i);
    await user.type(textarea, "Compare the findings between Zhang and Kim");

    const askButton = screen.getByRole("button", { name: /Ask AI/i });
    await user.click(askButton);

    // Verify askEvidenceCopilot was called
    await waitFor(() => {
      expect(desktopApi.askEvidenceCopilot).toHaveBeenCalledWith(
        "session_matrix_ws_default",
        "Compare the findings between Zhang and Kim",
        "ws_default",
        "paper_zhang_2023",
        "entire_matrix",
        null,
        null
      );
    });

    // Check assistant response rendered
    expect(
      await screen.findByText(/Comparative analysis indicates Zhang et al/i)
    ).toBeInTheDocument();

    // Citation chips rendered
    const citationChip = screen.getByTitle(/Click to open page 12 in PDF Reader/i);
    expect(citationChip).toBeInTheDocument();
    await user.click(citationChip);

    expect(handleNavigateToPdf).toHaveBeenCalledWith("paper_zhang_2023", 12);
  });

  it("copies response and saves response as research note", async () => {
    const user = userEvent.setup();
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<ReviewMatrixView />);

    // Open AI Assistant
    const aiButton = await screen.findByTestId("toolbar-ai-assistant");
    await user.click(aiButton);

    // Trigger a suggested query
    const compareBtn = screen.getByText("Compare the experimental results and key metrics across papers");
    await user.click(compareBtn);

    expect(
      await screen.findByText(/Comparative analysis indicates Zhang et al/i)
    ).toBeInTheDocument();

    // Click Copy button
    const copyButtons = await screen.findAllByTitle("Copy response text");
    await user.click(copyButtons[0]);
    expect(writeSpy).toHaveBeenCalled();

    // Click Save Note button
    const saveNoteButtons = await screen.findAllByTitle("Save response as research note");
    await user.click(saveNoteButtons[0]);
    expect(desktopApi.saveNote).toHaveBeenCalled();
  });

  it("clears conversation history when user confirms clear dialog", async () => {
    const user = userEvent.setup();
    render(<ReviewMatrixView />);

    // Open AI Assistant
    const aiButton = await screen.findByTestId("toolbar-ai-assistant");
    await user.click(aiButton);

    // Click clear conversation trash icon
    const trashButton = screen.getByTitle("Clear conversation");
    await user.click(trashButton);

    // Confirmation banner appears
    expect(screen.getByText("Clear all messages in this session?")).toBeInTheDocument();

    // Confirm clear
    const confirmClearBtn = screen.getByRole("button", { name: /^Clear$/i });
    await user.click(confirmClearBtn);

    expect(desktopApi.clearEvidenceCopilotMessages).toHaveBeenCalledWith("session_matrix_ws_default");
    expect(await screen.findByText(/Conversation cleared/i)).toBeInTheDocument();
  });
});
