import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { LiteratureWorkspaceView } from "../features/literature-workspace/LiteratureWorkspaceView";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";
import * as desktopApi from "../lib/desktop-api";

describe("Infinity Researcher — 3-Panel Literature Survey & Academic Workspace Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  it("renders Literature Workspace with all 3 panels and default project scope", () => {
    render(<LiteratureWorkspaceView />);

    // Top workspace bar with project title
    expect(
      screen.getByText(/AI-Based Intrusion Detection Systems for Cloud Computing/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/3-Panel Literature Hub/i)).toBeInTheDocument();

    // Panel 1: Document Collection & Discovery
    expect(
      screen.getByRole("region", { name: /Panel 1 Collection/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project \(/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Discover$/i })).toBeInTheDocument();

    // Panel 2: Center Workspace (Tabs: Survey, Comparison, Gaps, Writer, Notes, Figures)
    expect(screen.getByRole("button", { name: /Survey Matrix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Comparison/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Research Gaps/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paper Writer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Figures & Tables/i })).toBeInTheDocument();

    // Panel 3: Details & Evidence Review
    expect(
      screen.getByRole("complementary", { name: /Panel 3 Evidence and Details/i })
    ).toBeInTheDocument();
  });

  it("switches tabs in Panel 2 smoothly", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // 1. Survey Matrix by default
    expect(screen.getByText(/Literature Survey Matrix/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Every cell is grounded in verbatim source evidence/i)
    ).toBeInTheDocument();

    // 2. Switch to Comparison Tab
    const compareTab = screen.getByRole("button", { name: /Comparison/i });
    await user.click(compareTab);
    expect(screen.getByText(/Multi-Paper Dimensional Comparison/i)).toBeInTheDocument();

    // 3. Switch to Research Gaps Tab
    const gapsTab = screen.getByRole("button", { name: /Research Gaps/i });
    await user.click(gapsTab);
    expect(screen.getByText(/Synthesized Potential Research Gaps/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Trade-Off Between Adversarial Hardening/i)
    ).toBeInTheDocument();

    // 4. Switch to Paper Writer Tab
    const writerTab = screen.getByRole("button", { name: /Paper Writer/i });
    await user.click(writerTab);
    expect(
      screen.getByText(/Evidence-Linked Academic Manuscript Editor/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Title & Abstract/i).length).toBeGreaterThan(0);

    // 5. Switch to Notes Tab
    const notesTab = screen.getByRole("button", { name: /Notes/i });
    await user.click(notesTab);
    expect(screen.getByText(/Project Research Notes/i)).toBeInTheDocument();

    // 6. Switch to Figures & Tables Tab
    const figuresTab = screen.getByRole("button", { name: /Figures & Tables/i });
    await user.click(figuresTab);
    expect(
      screen.getByText(/Extracted Figures & Structured Tables Gallery/i)
    ).toBeInTheDocument();
  });

  it("synchronizes evidence to Panel 3 when clicking a Literature Survey cell", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // Look for a cell in the matrix (e.g. Methodology or Objective)
    const methodologyCells = screen.getAllByText(/Hybrid CNN for packet header/i);
    expect(methodologyCells.length).toBeGreaterThan(0);

    // Click the cell
    await user.click(methodologyCells[0]);

    // Panel 3 switches to Evidence tab and displays ground truth source excerpt
    expect(screen.getByText(/Ground Truth Source/i)).toBeInTheDocument();
    expect(screen.getByText(/Verbatim Document Excerpt/i)).toBeInTheDocument();
    expect(screen.getByText(/The architecture couples a 1D-CNN/i)).toBeInTheDocument();
    expect(screen.getByText(/Pg 4 \(Indexed\)/i)).toBeInTheDocument();
  });

  it("synchronizes evidence to Panel 3 when selecting a claim in the Academic Writer", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // Switch to Paper Writer tab
    const writerTab = screen.getByRole("button", { name: /Paper Writer/i });
    await user.click(writerTab);

    // Click on a verified claim
    const claimEls = screen.getAllByText(/Deep neural networks achieve high/i);
    await user.click(claimEls[0]);

    // Panel 3 displays the claim's linked ground truth evidence
    expect(screen.getByText(/Ground Truth Source/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Deep Neural Network Architectures for Cloud Intrusion Detection/i
      ).length
    ).toBeGreaterThan(0);
  });

  it("updates similarity match review tags in Panel 3", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // Click Similarity tab in Panel 3
    const similarityTabBtn = screen.getByRole("button", { name: /Similarity/i });
    await user.click(similarityTabBtn);

    expect(screen.getByText(/Manuscript Similarity Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Matches Found/i)).toBeInTheDocument();

    // Find "Properly Quoted" button for a match
    const properlyQuotedBtns = screen.getAllByRole("button", {
      name: /Properly Quoted/i,
    });
    expect(properlyQuotedBtns.length).toBeGreaterThan(0);

    // Click "Properly Quoted"
    await user.click(properlyQuotedBtns[0]);

    // Review status should reflect "Properly Quoted"
    expect(screen.getAllByText(/properly quoted/i).length).toBeGreaterThan(0);
  });

  it("formats citations in APA, IEEE, and ACM formats in Panel 3", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // Click Citations tab in Panel 3
    const citationsTabBtn = screen.getByRole("button", { name: /Citations/i });
    await user.click(citationsTabBtn);

    expect(screen.getByText(/Citation Consistency Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Citation Style:/i)).toBeInTheDocument();

    // Click IEEE format
    const ieeeBtn = screen.getByRole("button", { name: /ieee/i });
    await user.click(ieeeBtn);

    // Click BibTeX format
    const bibtexBtn = screen.getByRole("button", { name: /bibtex/i });
    await user.click(bibtexBtn);
    expect(screen.getAllByText(/@article{/i).length).toBeGreaterThan(0);
  });

  it("supports collapsing and expanding Panel 1 and Panel 3", async () => {
    const user = userEvent.setup();
    render(<LiteratureWorkspaceView />);

    // Toggle Left Panel (Panel 1)
    const toggleLeftBtn = screen.getByRole("button", { name: /Toggle Left Panel/i });
    await user.click(toggleLeftBtn);

    // Left panel should now show the vertical collapsed indicator bar
    expect(screen.getByTitle(/Expand Left Panel/i)).toBeInTheDocument();

    // Toggle Right Panel (Panel 3)
    const toggleRightBtn = screen.getByRole("button", { name: /Toggle Right Panel/i });
    await user.click(toggleRightBtn);

    // Right panel should now show the vertical collapsed indicator bar
    expect(screen.getByTitle(/Expand Right Evidence Panel/i)).toBeInTheDocument();

    // Expand Left Panel back
    await user.click(screen.getByTitle(/Expand Left Panel/i));
    expect(
      screen.getByRole("region", { name: /Panel 1 Collection/i })
    ).toBeInTheDocument();
  });

  it("is accessible via the Two-Column Sidebar under RESEARCH category", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Sidebar />
      </AppProvider>
    );

    // Under RESEARCH, "Literature Workspace" item with 3-Pane badge is present
    const litWorkspaceBtn = screen.getByRole("button", { name: /Literature Workspace/i });
    expect(litWorkspaceBtn).toBeInTheDocument();
    expect(within(litWorkspaceBtn).getByText(/3-Pane/i)).toBeInTheDocument();
  });

  it("renders LiteratureWorkspaceView inside AppShell when activeSection is literature_workspace", () => {
    render(
      <AppProvider
        initialSection="literature_workspace"
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <AppShell />
      </AppProvider>
    );

    expect(screen.getByTestId("literature-workspace")).toBeInTheDocument();
    expect(screen.getByText(/3-Panel Literature Hub/i)).toBeInTheDocument();
  });

  it("does not display stale mock evidence when paper collection is empty, showing clean prompt", () => {
    localStorage.setItem("lit_workspace_papers", JSON.stringify([]));
    localStorage.setItem("lit_workspace_matrix", JSON.stringify([]));
    render(<LiteratureWorkspaceView />);

    expect(screen.getByText(/Literature Survey Matrix is Empty/i)).toBeInTheDocument();
    expect(screen.getByText(/No Paper Evidence Selected/i)).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Deep Neural Network Architectures for Cloud Intrusion Detection/i
      )
    ).not.toBeInTheDocument();
  });

  it("allows Quick AI Review on a paper and populates the survey matrix with real evidence", async () => {
    const user = userEvent.setup();
    const testPaper = {
      id: "paper_renewable_01",
      title: "Renewable Energy Forecasting Using Graph Neural Networks",
      authors: ["E. Vance", "S. Morales"],
      publicationYear: 2025,
      abstract:
        "We propose a spatio-temporal GNN to forecast solar farm irradiance with 98% accuracy.",
      venue: "IEEE Trans. Sustainable Energy",
      hasFullText: true,
      isOpenAccess: true,
      extractionStatus: "imported" as const,
      tags: ["Solar", "GNN"],
      documentHash: "hash_test_renewable",
    };
    localStorage.setItem("lit_workspace_papers", JSON.stringify([testPaper]));
    localStorage.setItem("lit_workspace_matrix", JSON.stringify([]));

    render(<LiteratureWorkspaceView />);

    // Click "AI Review" button on the paper card
    const aiReviewBtn = screen.getByRole("button", { name: /^AI Review$/i });
    expect(aiReviewBtn).toBeInTheDocument();
    await user.click(aiReviewBtn);

    // Survey matrix now has the paper row
    expect(
      screen.getAllByText(/Renewable Energy Forecasting Using Graph Neural Networks/i)
        .length
    ).toBeGreaterThanOrEqual(2);
    // Evidence panel displays ground truth evidence for this specific paper
    expect(screen.getByText(/Evidence for:/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Renewable Energy Forecasting Using Graph Neural Networks/i)
        .length
    ).toBeGreaterThan(0);
  });
});
