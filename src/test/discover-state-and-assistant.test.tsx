import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AppShell } from "../components/layout/AppShell";
import { DiscoverPaperAssistant } from "../features/discover/DiscoverPaperAssistant";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";
import { UnifiedDiscoverPaper } from "../features/discover/DiscoverView";

describe("Discover State Persistence & Grounded Paper Assistant", () => {
  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.clearAll();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Part 1: discoverSessionStore Tests
  // ---------------------------------------------------------------------------
  it("persists search parameters, active tab, and selected paper in discoverSessionStore", () => {
    expect(discoverSessionStore.getState().searchQuery).toBe("");

    discoverSessionStore.setSearchQuery("quantum computing error mitigation");
    expect(discoverSessionStore.getState().searchQuery).toBe("quantum computing error mitigation");

    discoverSessionStore.setSelectedPaperId("paper-test-1");
    expect(discoverSessionStore.getState().selectedPaperId).toBe("paper-test-1");

    discoverSessionStore.setActiveRightTab("insights");
    expect(discoverSessionStore.getState().activeRightTab).toBe("insights");

    // Add chat message
    discoverSessionStore.addChatMessage("paper-test-1", {
      id: "msg-1",
      session_id: "sess-1",
      role: "user",
      content: "Explain the syndrome measurement technique.",
      citations: [],
      retrieval_mode: "paper",
      created_at: new Date().toISOString(),
    });

    expect(discoverSessionStore.getState().chatHistoryByPaper["paper-test-1"]).toHaveLength(1);

    // Cache an insight
    discoverSessionStore.setInsight("paper-test-1", "beginner_eli5", {
      type: "beginner_eli5",
      title: "Beginner Explanation (ELI5)",
      content: "Think of quantum error correction like checking spelling in three copies of a letter.",
      citations: [
        {
          chunk_id: "chk-1",
          paper_id: "paper-test-1",
          paper_title: "Quantum Mitigation",
          page_number: 3,
          snippet: "Surface codes use stabilizer measurements.",
          score: 0.95,
        },
      ],
      createdAt: new Date().toISOString(),
    });

    const cachedInsight = discoverSessionStore.getState().insightsByPaper["paper-test-1"]["beginner_eli5"];
    expect(cachedInsight).toBeDefined();
    expect(cachedInsight.content).toContain("Think of quantum error correction");
    expect(cachedInsight.citations[0].page_number).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Part 2: Route Navigation Persistence in AppShell
  // ---------------------------------------------------------------------------
  it("keeps Discover view state intact when navigating to Library and returning to Discover", async () => {
    const user = userEvent.setup();

    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <AppShell />
      </AppProvider>
    );

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });

    // 1. Navigate to Discover
    const discoverNavBtn = within(nav).getByRole("button", { name: /Discover/i });
    await user.click(discoverNavBtn);

    expect(screen.getByRole("heading", { name: /Discover Research Papers/i, level: 1 })).toBeInTheDocument();

    // 2. Type search query in Discover search input
    const searchInput = screen.getByPlaceholderText(/Search by topic, title, author/i);
    await user.type(searchInput, "deep reinforcement learning robotics");
    expect(searchInput).toHaveValue("deep reinforcement learning robotics");

    // Verify state stored in session store
    await waitFor(() => {
      expect(discoverSessionStore.getState().searchQuery).toBe("deep reinforcement learning robotics");
    });

    // 3. Navigate away to Library
    const libraryNavBtn = within(nav).getByRole("button", { name: /Library/i });
    await user.click(libraryNavBtn);

    // Verify Library view is displayed
    expect(screen.getByRole("heading", { name: /Saved Paper Library/i, level: 1 })).toBeInTheDocument();

    // 4. Return to Discover
    await user.click(discoverNavBtn);

    // 5. Verify query was NOT wiped out and remains completely intact
    const restoredInput = screen.getByPlaceholderText(/Search by topic, title, author/i);
    expect(restoredInput).toHaveValue("deep reinforcement learning robotics");
    expect(screen.getByRole("heading", { name: /Discover Research Papers/i, level: 1 })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Part 3: Grounded Paper Assistant (Chat & Citations)
  // ---------------------------------------------------------------------------
  it("renders DiscoverPaperAssistant with grounded chat, text status, and triggers page navigation on citation click", async () => {
    const user = userEvent.setup();
    const onNavigatePdfPage = vi.fn();
    const showToast = vi.fn();

    vi.spyOn(desktopApi, "getPaperRagChunks").mockResolvedValue([
      {
        id: "chunk-1",
        paper_id: "paper-1",
        chunk_index: 0,
        page_number: 2,
        section_heading: "Methodology",
        content_text: "We use a multi-head attention mechanism.",
        token_count: 85,
        created_at: new Date().toISOString(),
      },
      {
        id: "chunk-2",
        paper_id: "paper-1",
        chunk_index: 1,
        page_number: 4,
        section_heading: "Results",
        content_text: "BLEU score of 28.4 on WMT 2014.",
        token_count: 90,
        created_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({
      text: "The paper introduces multi-head self-attention [Page 2, Section Methodology] which achieves 28.4 BLEU [Page 4, Section Results].",
      citations: [
        {
          chunk_id: "chunk-1",
          paper_id: "paper-1",
          paper_title: "Attention Is All You Need",
          page_number: 2,
          section_heading: "Methodology",
          snippet: "We use a multi-head attention mechanism.",
          score: 0.94,
        },
        {
          chunk_id: "chunk-2",
          paper_id: "paper-1",
          paper_title: "Attention Is All You Need",
          page_number: 4,
          section_heading: "Results",
          snippet: "BLEU score of 28.4 on WMT 2014.",
          score: 0.91,
        },
      ],
      provider_id: "ollama_local",
      model_id: "llama3.2:latest",
      latency_ms: 85,
      is_grounded: true,
    });

    const mockPaper: UnifiedDiscoverPaper = {
      id: "paper-1",
      paper_id: "paper-1",
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      url: "https://arxiv.org/abs/1706.03762",
      is_imported: true,
      is_downloaded: true,
      is_open_access: true,
      source_name: "arXiv Preprints",
      abstract_text: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
    };

    render(
      <DiscoverPaperAssistant
        paper={mockPaper}
        onNavigatePdfPage={onNavigatePdfPage}
        onRefreshPaperNotes={vi.fn()}
        showToast={showToast}
      />
    );

    // Verify text status badge shows indexed chunks
    await waitFor(() => {
      expect(screen.getByText(/Full Text Indexed/i)).toBeInTheDocument();
    });

    // Verify starter questions are rendered
    expect(screen.getByText(/What is the main hypothesis and contribution\?/i)).toBeInTheDocument();

    // Type a question in chat input
    const chatInput = screen.getByPlaceholderText(/Ask about equations, datasets, findings, or limitations/i);
    await user.type(chatInput, "What is the key architecture contribution?{Enter}");

    // Verify assistant response rendered
    await waitFor(() => {
      expect(screen.getByText(/The paper introduces multi-head self-attention/i)).toBeInTheDocument();
    });

    // Verify citations are clickable
    const page2Citation = screen.getByRole("button", { name: /Page 2/i });
    expect(page2Citation).toBeInTheDocument();

    await user.click(page2Citation);
    expect(onNavigatePdfPage).toHaveBeenCalledWith(2);
  });

  // ---------------------------------------------------------------------------
  // Part 4: 8 Actionable AI Insights
  // ---------------------------------------------------------------------------
  it("renders and generates all 8 actionable AI insights with grounded citations and saving to notes", async () => {
    const user = userEvent.setup();
    const onNavigatePdfPage = vi.fn();
    const onRefreshPaperNotes = vi.fn();
    const showToast = vi.fn();

    const saveNoteSpy = vi.spyOn(desktopApi, "saveNote").mockResolvedValue({
      id: "note-ai-1",
      paper_id: "paper-1",
      title: "Note",
      content_markdown: "AI Insight content",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({
      text: "### Replication Checklist\n- Compute: 8 NVIDIA P100 GPUs\n- Dataset: WMT 2014 English-German\n- Optimizer: Adam with beta1=0.9, beta2=0.98",
      citations: [
        {
          chunk_id: "chunk-5",
          paper_id: "paper-1",
          paper_title: "Attention Is All You Need",
          page_number: 5,
          section_heading: "Hardware and Schedule",
          snippet: "We trained our models on one machine with 8 NVIDIA P100 GPUs.",
          score: 0.98,
        },
      ],
      provider_id: "ollama_local",
      model_id: "llama3.2:latest",
      latency_ms: 110,
      is_grounded: true,
    });

    const mockPaper: UnifiedDiscoverPaper = {
      id: "paper-1",
      paper_id: "paper-1",
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      url: "https://arxiv.org/abs/1706.03762",
      is_imported: true,
      is_downloaded: true,
      is_open_access: true,
      source_name: "arXiv Preprints",
      abstract_text: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
    };

    render(
      <DiscoverPaperAssistant
        paper={mockPaper}
        onNavigatePdfPage={onNavigatePdfPage}
        onRefreshPaperNotes={onRefreshPaperNotes}
        showToast={showToast}
      />
    );

    // Switch to Insights tab
    const insightsTabBtn = screen.getByRole("button", { name: /AI Insights \(8\)/i });
    await user.click(insightsTabBtn);

    // Verify all 8 Actionable Tools are present
    expect(screen.getAllByText("Beginner Explanation (ELI5)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Structured Summary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Methodology Analysis").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Results Interpretation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strengths & Weaknesses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Research Gaps").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Future Work Roadmap").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Replication Checklist").length).toBeGreaterThan(0);

    // Click "Replication Checklist"
    const replicationToolBtn = screen.getByRole("button", { name: /Replication Checklist/i });
    await user.click(replicationToolBtn);

    // Verify generated content appears
    await waitFor(() => {
      expect(screen.getByText(/Compute: 8 NVIDIA P100 GPUs/i)).toBeInTheDocument();
    });

    // Verify citation appears and navigates on click
    const page5Citation = screen.getByRole("button", { name: /Page 5/i });
    await user.click(page5Citation);
    expect(onNavigatePdfPage).toHaveBeenCalledWith(5);

    // Test Save to Notes button
    const saveToNotesBtn = screen.getByRole("button", { name: /Save to Notes/i });
    await user.click(saveToNotesBtn);

    expect(saveNoteSpy).toHaveBeenCalled();
    expect(onRefreshPaperNotes).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Saved insight to research notes!", "success");
  });
});
