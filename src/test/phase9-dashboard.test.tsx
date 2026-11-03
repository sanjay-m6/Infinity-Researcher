import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { DashboardView } from "../features/dashboard/DashboardView";
import { Paper, Collection, DownloadJob, ActivityEvent } from "../types/domain";
import * as desktopApi from "../lib/desktop-api";

const mockPapers: Paper[] = [
  {
    id: "p1",
    title: "Attention Is All You Need",
    authors: ["Vaswani et al."],
    abstract: "Transformer architecture based solely on attention mechanisms.",
    publicationDate: "2017-06-12",
    year: 2017,
    venue: "NeurIPS",
    doi: "10.48550/arXiv.1706.03762",
    sourceId: "arxiv",
    sourceName: "arXiv",
    landingUrl: "https://arxiv.org/abs/1706.03762",
    pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    accessStatus: "open_access",
    documentStatus: "available",
    tags: ["nlp", "transformer"],
    collectionIds: ["c1"],
    citationCount: 95000,
    addedAt: "2026-01-10T10:00:00Z",
    isSaved: true,
  },
  {
    id: "p2",
    title: "Highly Accurate Protein Structure Prediction with AlphaFold",
    authors: ["Jumper et al."],
    abstract: "Predicting 3D structures of proteins from amino acid sequences.",
    publicationDate: "2021-07-15",
    year: 2021,
    venue: "Nature",
    doi: "10.1038/s41586-021-03819-2",
    sourceId: "openalex",
    sourceName: "OpenAlex",
    landingUrl: "https://doi.org/10.1038/s41586-021-03819-2",
    pdfUrl: null,
    accessStatus: "open_access",
    documentStatus: "not_downloaded",
    tags: ["biology", "alphafold"],
    collectionIds: [],
    citationCount: 22000,
    addedAt: "2026-01-11T12:00:00Z",
    isSaved: false,
  },
  {
    id: "p3",
    title: "Deep Residual Learning for Image Recognition",
    authors: ["He et al."],
    abstract: "Deeper neural networks are more difficult to train.",
    publicationDate: "2016-12-10",
    year: 2016,
    venue: "CVPR",
    doi: "10.1109/CVPR.2016.90",
    sourceId: "ieee",
    sourceName: "IEEE Xplore",
    landingUrl: "https://ieeexplore.ieee.org/document/7780459",
    pdfUrl: "https://arxiv.org/pdf/1512.03385.pdf",
    accessStatus: "restricted",
    documentStatus: "not_downloaded",
    tags: ["cv", "resnet"],
    collectionIds: ["c1"],
    citationCount: 180000,
    addedAt: "2026-01-05T08:00:00Z",
    isSaved: true,
  },
];

const mockCollections: Collection[] = [
  {
    id: "c1",
    name: "Foundation Models",
    description: "Seminal papers on deep learning architectures",
    colorHex: "#6366f1",
    paperIds: ["p1", "p3"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "c2",
    name: "Structural Biology",
    description: "Computational biology and folding algorithms",
    colorHex: "#10b981",
    paperIds: ["p2"],
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-11T00:00:00Z",
  },
];

const mockJobs: DownloadJob[] = [
  {
    id: "j1",
    paperId: "p1",
    paperTitle: "Attention Is All You Need",
    sourceName: "arXiv",
    jobType: "pdf_download",
    status: "running",
    progressPercent: 65,
    stageMessage: "Downloading PDF binary...",
    startedAt: "2026-01-15T12:00:00Z",
  },
  {
    id: "j2",
    paperId: "p2",
    paperTitle: "Highly Accurate Protein Structure Prediction",
    sourceName: "Nature",
    jobType: "text_extraction",
    status: "completed",
    progressPercent: 100,
    stageMessage: "Text extracted successfully.",
    startedAt: "2026-01-15T11:00:00Z",
    completedAt: "2026-01-15T11:02:00Z",
  },
];

const mockActivity: ActivityEvent[] = [
  {
    id: "a1",
    timestamp: "2026-01-15T12:05:00Z",
    type: "download",
    status: "info",
    title: "PDF Retrieval In Progress",
    details: "Started download for 'Attention Is All You Need'",
  },
  {
    id: "a2",
    timestamp: "2026-01-15T11:30:00Z",
    type: "collection",
    status: "success",
    title: "Paper Added to Collection",
    details: "Added to 'Foundation Models'",
  },
];

// Context inspector component to verify state transitions in integration tests
const ContextStateInspector: React.FC = () => {
  const {
    activeSection,
    selectedPaperId,
    readingPaper,
    selectedCollectionId,
    isCommandPaletteOpen,
    globalSearchQuery,
  } = useApp();

  return (
    <div data-testid="context-inspector">
      <span data-testid="current-section">{activeSection}</span>
      <span data-testid="selected-paper-id">{selectedPaperId || "none"}</span>
      <span data-testid="reading-paper-id">{readingPaper?.id || "none"}</span>
      <span data-testid="selected-collection-id">{selectedCollectionId || "none"}</span>
      <span data-testid="command-palette-open">
        {isCommandPaletteOpen ? "open" : "closed"}
      </span>
      <span data-testid="global-search-query">{globalSearchQuery || "none"}</span>
    </div>
  );
};

describe("Phase 9 — Dashboard Modernization Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
  });

  describe("3.1. Dashboard Header & Quick Actions", () => {
    it("renders page title and description", () => {
      render(
        <AppProvider
          initialPapers={mockPapers}
          initialCollections={mockCollections}
          initialJobs={mockJobs}
          initialActivity={mockActivity}
        >
          <DashboardView />
        </AppProvider>
      );

      expect(
        screen.getByRole("heading", { level: 1, name: "Scholarly Workspace" })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Local-first academic research workbench/i)
      ).toBeInTheDocument();
    });

    it("triggers command palette when Quick Find button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const quickFindBtn = screen.getByRole("button", { name: /Quick Find/i });
      await user.click(quickFindBtn);

      expect(screen.getByTestId("command-palette-open")).toHaveTextContent("open");
    });

    it("navigates to discover when Search Online button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const searchOnlineBtn = screen.getByRole("button", {
        name: /Search academic literature online/i,
      });
      await user.click(searchOnlineBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("discover");
    });

    it("navigates to library when Open Library button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const openLibBtn = screen.getByRole("button", {
        name: /Open personal paper library/i,
      });
      await user.click(openLibBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("library");
    });
  });

  describe("3.2. Research Overview Metric Cards (Zero Mock Data)", () => {
    it("calculates and displays authoritative metrics from real state", () => {
      render(
        <AppProvider
          initialPapers={mockPapers}
          initialCollections={mockCollections}
          initialJobs={mockJobs}
          initialActivity={mockActivity}
        >
          <DashboardView />
        </AppProvider>
      );

      // Metric 1: Total Indexed Papers (3 total, 2 open access)
      expect(screen.getByText("Total Indexed Papers")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("2 open access")).toBeInTheDocument();

      // Metric 2: Saved Records (2 saved out of 3, across 2 collections)
      expect(screen.getByText("Saved in Library")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("across 2 collections")).toBeInTheDocument();

      // Metric 3: Active Job Queue (1 running out of 2 jobs)
      expect(screen.getByText("Active Job Queue")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2 total tasks")).toBeInTheDocument();

      // Metric 4: Configured Providers
      expect(screen.getByText("Configured Providers")).toBeInTheDocument();
      expect(screen.getByText("Verified feeds")).toBeInTheDocument();
    });

    it("navigates to appropriate sections when metric cards are clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider
          initialPapers={mockPapers}
          initialCollections={mockCollections}
          initialJobs={mockJobs}
          initialActivity={mockActivity}
        >
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      // Click Metric 3 (Active Job Queue)
      const jobsCard = screen.getByLabelText(/Active job queue/i);
      await user.click(jobsCard);
      expect(screen.getByTestId("current-section")).toHaveTextContent("downloads");

      // Click Metric 4 (Configured Providers)
      const sourcesCard = screen.getByLabelText(/Configured providers/i);
      await user.click(sourcesCard);
      expect(screen.getByTestId("current-section")).toHaveTextContent("sources");
    });

    it("supports keyboard navigation (Enter key) on metric cards", async () => {
      render(
        <AppProvider
          initialPapers={mockPapers}
          initialCollections={mockCollections}
          initialJobs={mockJobs}
        >
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const libraryCard = screen.getByLabelText(/Total indexed papers/i);
      fireEvent.keyDown(libraryCard, { key: "Enter" });
      expect(screen.getByTestId("current-section")).toHaveTextContent("library");
    });
  });

  describe("3.8. Quick Discovery Launchpad", () => {
    it("executes global search when recommended query pill is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const queryPill = screen.getByRole("button", {
        name: /deep learning transformer/i,
      });
      await user.click(queryPill);

      expect(screen.getByTestId("global-search-query")).toHaveTextContent(
        "deep learning transformer"
      );
      expect(screen.getByTestId("current-section")).toHaveTextContent("discover");
    });

    it("navigates to discover when Open Discover button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const openDiscoverBtn = screen.getByRole("button", { name: "Open Discover" });
      await user.click(openDiscoverBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("discover");
    });
  });

  describe("3.3. Continue Researching (Recent Papers)", () => {
    it("renders recent paper items with title, authors, venue, year, and badges", () => {
      render(
        <AppProvider initialPapers={mockPapers}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("Recent Scholarly Papers")).toBeInTheDocument();
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      expect(screen.getByText("Vaswani et al.")).toBeInTheDocument();
      expect(screen.getByText("NeurIPS")).toBeInTheDocument();
      expect(screen.getByText("2017")).toBeInTheDocument();
    });

    it("opens PDF reader when Read button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers}>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const readBtn = screen.getByRole("button", {
        name: /Read PDF for Attention Is All You Need/i,
      });
      await user.click(readBtn);

      expect(screen.getByTestId("reading-paper-id")).toHaveTextContent("p1");
    });

    it("opens details drawer when Details button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers}>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const detailsBtn = screen.getByRole("button", {
        name: /View details for Attention Is All You Need/i,
      });
      await user.click(detailsBtn);

      expect(screen.getByTestId("selected-paper-id")).toHaveTextContent("p1");
    });

    it("displays informative EmptyState when library is empty", () => {
      render(
        <AppProvider initialPapers={[]}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("No papers in your library yet")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Search Academic Sources" })
      ).toBeInTheDocument();
    });
  });

  describe("3.4. Active Downloads and Background Tasks", () => {
    it("renders active jobs with title, stage message, progress bar, and cancel action", () => {
      render(
        <AppProvider initialJobs={mockJobs}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("Active Tasks & Retrieval Queue")).toBeInTheDocument();
      expect(screen.getByText("Downloading PDF binary...")).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", {
        name: /Cancel job Attention Is All You Need/i,
      });
      expect(cancelBtn).toBeInTheDocument();
    });

    it("cancels job when cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialJobs={mockJobs}>
          <DashboardView />
        </AppProvider>
      );

      const cancelBtn = screen.getByRole("button", {
        name: /Cancel job Attention Is All You Need/i,
      });
      await user.click(cancelBtn);

      // Job should no longer be listed in active tasks
      expect(screen.queryByText("Downloading PDF binary...")).not.toBeInTheDocument();
    });

    it("displays idle message when running jobs count is zero", () => {
      const completedOnlyJobs: DownloadJob[] = [
        {
          id: "j2",
          paperId: "p2",
          paperTitle: "Highly Accurate Protein Structure Prediction",
          sourceName: "Nature",
          jobType: "text_extraction",
          status: "completed",
          progressPercent: 100,
          stageMessage: "Finished.",
          startedAt: "2026-01-15T11:00:00Z",
        },
      ];

      render(
        <AppProvider initialJobs={completedOnlyJobs}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText(/Queue is currently idle/i)).toBeInTheDocument();
      expect(
        screen.getByText("Highly Accurate Protein Structure Prediction")
      ).toBeInTheDocument();
    });

    it("displays compact EmptyState when jobs list is completely empty", () => {
      render(
        <AppProvider initialJobs={[]}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("Task queue is idle")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Search Papers" })).toBeInTheDocument();
    });
  });

  describe("3.5. Research Collections Widget", () => {
    it("renders collection cards with title, color dot, description, and paper counts", () => {
      render(
        <AppProvider initialCollections={mockCollections}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("Research Collections")).toBeInTheDocument();
      expect(screen.getByText("Foundation Models")).toBeInTheDocument();
      expect(screen.getByText("2 papers")).toBeInTheDocument();
      expect(screen.getByText("Structural Biology")).toBeInTheDocument();
      expect(screen.getByText("1 papers")).toBeInTheDocument();
    });

    it("opens collection and navigates to collections view when collection card is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialCollections={mockCollections}>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const colCard = screen.getByLabelText(/Collection: Foundation Models/i);
      await user.click(colCard);

      expect(screen.getByTestId("selected-collection-id")).toHaveTextContent("c1");
      expect(screen.getByTestId("current-section")).toHaveTextContent("collections");
    });

    it("displays compact EmptyState when collections list is empty", () => {
      render(
        <AppProvider initialCollections={[]}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("No collections created yet")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create Collection" })
      ).toBeInTheDocument();
    });
  });

  describe("3.7. Quick Research Tools & Shortcuts", () => {
    it("navigates to literature workspace when clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const toolBtn = screen.getByRole("button", { name: /Open Literature Workspace/i });
      await user.click(toolBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent(
        "literature_workspace"
      );
    });

    it("navigates to AI research assistant when clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const toolBtn = screen.getByRole("button", { name: /AI Copilot Assistant/i });
      await user.click(toolBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent(
        "research_assistant"
      );
    });

    it("navigates to citation checker when clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const toolBtn = screen.getByRole("button", { name: /Audit Citations/i });
      await user.click(toolBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("citation_checker");
    });

    it("navigates to review matrix when clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const toolBtn = screen.getByRole("button", { name: /Systematic Review Matrix/i });
      await user.click(toolBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("review_matrix");
    });

    it("navigates to paper comparison when clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DashboardView />
          <ContextStateInspector />
        </AppProvider>
      );

      const toolBtn = screen.getByRole("button", {
        name: /Compare Papers Side-by-Side/i,
      });
      await user.click(toolBtn);

      expect(screen.getByTestId("current-section")).toHaveTextContent("paper_comparison");
    });
  });

  describe("3.6. Recent Research Activity Feed", () => {
    it("renders activity events with titles and details", () => {
      render(
        <AppProvider initialActivity={mockActivity}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      expect(screen.getByText("PDF Retrieval In Progress")).toBeInTheDocument();
      expect(screen.getByText("Paper Added to Collection")).toBeInTheDocument();
    });

    it("renders empty state when activity list is empty", () => {
      render(
        <AppProvider initialActivity={[]}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByText("No recent activity recorded yet")).toBeInTheDocument();
    });
  });

  describe("Accessibility & WCAG 2.1 AA Compliance", () => {
    it("contains proper semantic landmarks and headings", () => {
      render(
        <AppProvider
          initialPapers={mockPapers}
          initialCollections={mockCollections}
          initialJobs={mockJobs}
        >
          <DashboardView />
        </AppProvider>
      );

      expect(
        screen.getByRole("heading", { level: 1, name: "Scholarly Workspace" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Recent Scholarly Papers" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Active Tasks & Retrieval Queue" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Research Collections" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Recent Activity" })
      ).toBeInTheDocument();
    });

    it("has accessible button roles and labels on all metric cards", () => {
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <DashboardView />
        </AppProvider>
      );

      expect(screen.getByLabelText(/Total indexed papers: 3/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Saved papers: 2/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Active job queue/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Configured providers/i)).toBeInTheDocument();
    });
  });
});
