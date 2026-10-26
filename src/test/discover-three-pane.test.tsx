import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import * as desktopApi from "../lib/desktop-api";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";

describe("Discover Page — Three-Pane UI & Backend Integration Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the three panes: search list, center reader area, and right details pane", () => {
    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    // Header & Workspace Title
    expect(screen.getByRole("heading", { name: /Discover Research Papers/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Three-Pane Workspace/i)).toBeInTheDocument();

    // Left Pane: Search & Filter elements
    expect(screen.getByText(/Advanced: Inspect Permitted Website/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^OA$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^PDF$/i })).toBeInTheDocument();

    // Center Pane & Left Pane display discovered paper title
    expect(
      screen.getAllByText(/Attention Is All You Need/i).length
    ).toBeGreaterThan(0);

    // Right Pane: Article details & Metadata sections
    expect(screen.getByText(/Article Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Research Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Collections/i)).toBeInTheDocument();
  });

  it("selects a paper from the left pane and updates center and right panes", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    // Find and click on "BERT: Pre-training of Deep Bidirectional Transformers"
    const bertCards = screen.getAllByText(/BERT: Pre-training of Deep Bidirectional Transformers/i);
    await user.click(bertCards[0]);

    // Verify right pane displays BERT details
    await waitFor(() => {
      const rightPane = screen.getByText(/Article Details/i).closest("aside");
      expect(rightPane).not.toBeNull();
      expect(within(rightPane!).getByText(/BERT: Pre-training of Deep Bidirectional Transformers/i)).toBeInTheDocument();
    });
  });

  it("collapses and expands left and right panes using toggle buttons", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    const leftToggle = screen.getByTitle(/Collapse search list pane/i);
    const rightToggle = screen.getByTitle(/Collapse details pane/i);

    // Collapse left pane
    await user.click(leftToggle);
    expect(screen.queryByRole("button", { name: /^All$/i })).not.toBeInTheDocument();

    // Re-expand left pane
    await user.click(screen.getByTitle(/Expand search list pane/i));
    expect(screen.getByRole("button", { name: /^All$/i })).toBeInTheDocument();

    // Collapse right pane
    await user.click(rightToggle);
    expect(screen.queryByText(/Article Details/i)).not.toBeInTheDocument();

    // Re-expand right pane
    await user.click(screen.getByTitle(/Expand details pane/i));
    expect(screen.getByText(/Article Details/i)).toBeInTheDocument();
  });

  it("allows taking persistent SQLite notes in the right pane", async () => {
    const user = userEvent.setup();
    const saveNoteSpy = vi.spyOn(desktopApi, "saveNote").mockResolvedValue({
      id: "note-123",
      paper_id: "paper-1",
      title: "Note",
      content_markdown: "Key transformer architecture insight for local pipeline",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    const noteInput = screen.getByPlaceholderText(/Add a private note about this paper/i);
    await user.type(noteInput, "Key transformer architecture insight for local pipeline");

    const saveButton = screen.getByRole("button", { name: /Save Note/i });
    await user.click(saveButton);

    expect(saveNoteSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Key transformer architecture insight for local pipeline")).toBeInTheDocument();
    });
  });

  it("allows adding and removing a paper from collections in the right pane", async () => {
    const addCollectionSpy = vi.spyOn(desktopApi, "addPaperToCollection").mockResolvedValue();

    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    const collectionSelect = screen.getByDisplayValue("+ Add to Collection...");
    fireEvent.change(collectionSelect, { target: { value: "col-1" } });

    expect(addCollectionSpy).toHaveBeenCalled();
  });

  it("handles PDF download enqueueing from center pane for un-downloaded paper", async () => {
    const user = userEvent.setup();
    const enqueueSpy = vi.spyOn(desktopApi, "enqueuePdfDownload").mockResolvedValue({
      id: "job-pdf-1",
      paper_id: "paper-2",
      paper_title: "BERT: Pre-training",
      url: "https://arxiv.org/pdf/1810.04805.pdf",
      source_id: "website_crawler",
      status: "queued",
      bytes_downloaded: 0,
      total_bytes: 1048576,
      progress_percent: 0,
      stage_message: "Queued",
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <AppProvider initialPapers={INITIAL_DEMO_PAPERS} initialCollections={INITIAL_DEMO_COLLECTIONS}>
        <DiscoverView />
      </AppProvider>
    );

    // Click BERT paper which is not locally downloaded in demo state
    const bertCards = screen.getAllByText(/BERT: Pre-training of Deep Bidirectional Transformers/i);
    await user.click(bertCards[0]);

    // In the embedded viewer, Save Offline button is available
    const downloadBtn = await screen.findByRole("button", { name: /Save Offline/i });
    await user.click(downloadBtn);

    expect(enqueueSpy).toHaveBeenCalled();
  });
});
