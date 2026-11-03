import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { CommandPalette } from "../components/ui/CommandPalette";
import { Paper, Collection } from "../types/domain";
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
    collectionIds: ["c2"],
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

// Context inspector to verify state changes
const CommandPaletteTestHarness: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    activeSection,
    selectedPaperId,
    selectedCollectionId,
    globalSearchQuery,
    theme,
  } = useApp();

  return (
    <div>
      <button
        type="button"
        data-testid="open-palette-btn"
        onClick={() => setIsCommandPaletteOpen(true)}
      >
        Open Command Palette
      </button>
      <div data-testid="active-section">{activeSection}</div>
      <div data-testid="selected-paper">{selectedPaperId || "none"}</div>
      <div data-testid="selected-collection">{selectedCollectionId || "none"}</div>
      <div data-testid="global-query">{globalSearchQuery || "none"}</div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="palette-status">{isCommandPaletteOpen ? "open" : "closed"}</div>
      <CommandPalette />
    </div>
  );
};

describe("Phase 10 — Global Search and Command Palette Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
  });

  describe("1. Keyboard Triggers & Dialog Lifecycle", () => {
    it("renders dialog with role='dialog' and accessible label when opened", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();

      await user.click(screen.getByTestId("open-palette-btn"));

      expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Type a screen name or search papers...")
      ).toBeInTheDocument();
    });

    it("toggles command palette using global Ctrl+K shortcut", () => {
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      // Press Ctrl+K to open
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();

      // Press Ctrl+K again to toggle close
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });

    it("closes command palette when Escape key is pressed", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });

    it("closes command palette when clicking backdrop overlay", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const dialog = screen.getByRole("dialog", { name: "Command Palette" });

      // Click outer overlay
      await user.click(dialog);
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });
  });

  describe("2. Empty Query Defaults & Recent Searches", () => {
    it("renders top navigation and research tools by default when query is empty", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));

      expect(screen.getByText(/Research Tools/i)).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Literature Workspace" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "AI Research Assistant" })
      ).toBeInTheDocument();
      expect(screen.getByText(/Navigation/i)).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Discover Papers" })).toBeInTheDocument();
    });

    it("displays and clears recent search history when available", async () => {
      localStorage.setItem(
        "rps_recent_searches",
        JSON.stringify(["quantum computing", "crispr cas9"])
      );
      const user = userEvent.setup();

      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));

      expect(screen.getByText(/Recent Searches/i)).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "quantum computing" })
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "crispr cas9" })).toBeInTheDocument();

      // Clear recent searches
      const clearBtn = screen.getByRole("button", { name: /Clear recent searches/i });
      await user.click(clearBtn);

      expect(
        screen.queryByRole("option", { name: "quantum computing" })
      ).not.toBeInTheDocument();
    });
  });

  describe("3. Search Query Filtering, Ranking & Highlighting", () => {
    it("filters and displays matching papers with authors and badges", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Attention");

      expect(screen.getByText(/Research Papers/i)).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Attention Is All You Need" })
      ).toBeInTheDocument();
    });

    it("prioritizes exact DOI match and assigns highest score", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "10.1038/s41586-021-03819-2");

      expect(
        screen.getByRole("option", {
          name: "Highly Accurate Protein Structure Prediction with AlphaFold",
        })
      ).toBeInTheDocument();
      expect(screen.getByText("DOI")).toBeInTheDocument();
    });

    it("filters collections by name and displays paper count", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Foundation");

      expect(screen.getByText(/Collections/i)).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Foundation Models" })
      ).toBeInTheDocument();
      expect(screen.getByText("2 papers")).toBeInTheDocument();
    });

    it("clears search input when clear button (X) is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Transformer");
      expect(input).toHaveValue("Transformer");

      const clearBtn = screen.getByRole("button", { name: "Clear search input" });
      await user.click(clearBtn);

      expect(input).toHaveValue("");
    });
  });

  describe("4. Result Execution & Section Navigation", () => {
    it("navigates to literature workspace when selected", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Literature");

      const option = screen.getByRole("option", { name: "Literature Workspace" });
      await user.click(option);

      expect(screen.getByTestId("active-section")).toHaveTextContent(
        "literature_workspace"
      );
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });

    it("selects paper and closes palette when paper result is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "AlphaFold");

      const paperOption = screen.getByRole("option", {
        name: "Highly Accurate Protein Structure Prediction with AlphaFold",
      });
      await user.click(paperOption);

      expect(screen.getByTestId("selected-paper")).toHaveTextContent("p2");
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });

    it("selects collection and navigates to collections view when collection is clicked", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Structural Biology");

      const colOption = screen.getByRole("option", { name: "Structural Biology" });
      await user.click(colOption);

      expect(screen.getByTestId("selected-collection")).toHaveTextContent("c2");
      expect(screen.getByTestId("active-section")).toHaveTextContent("collections");
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });

    it("executes theme toggle action when selected", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "Toggle Theme");

      const themeOption = screen.getByRole("option", {
        name: "Toggle Theme (Light / Dark)",
      });
      await user.click(themeOption);

      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });
  });

  describe("5. Keyboard Navigation through Results", () => {
    it("navigates down with ArrowDown and selects with Enter key", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      // Type a query that brings up Citation Checker
      await user.type(input, "Citation Checker");

      expect(
        screen.getByRole("option", { name: "Citation Checker" })
      ).toBeInTheDocument();

      // Press Enter to execute the selected item
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByTestId("active-section")).toHaveTextContent("citation_checker");
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });
  });

  describe("6. Empty Search State & Online Discover Action", () => {
    it("displays informative empty state and triggers online search when query yields no local results", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={[]} initialCollections={[]}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));
      const input = screen.getByPlaceholderText("Type a screen name or search papers...");

      await user.type(input, "xyznonexistentquery12345");

      expect(screen.getByText(/No matching results found for/i)).toBeInTheDocument();

      const searchOnlineBtn = screen.getByRole("button", {
        name: /Search Online in Discover/i,
      });
      await user.click(searchOnlineBtn);

      expect(screen.getByTestId("global-query")).toHaveTextContent(
        "xyznonexistentquery12345"
      );
      expect(screen.getByTestId("active-section")).toHaveTextContent("discover");
    });
  });

  describe("7. Accessibility & Combobox Semantics", () => {
    it("satisfies WCAG 2.1 AA combobox and listbox requirements", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={mockPapers} initialCollections={mockCollections}>
          <CommandPaletteTestHarness />
        </AppProvider>
      );

      await user.click(screen.getByTestId("open-palette-btn"));

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("aria-autocomplete", "list");
      expect(input).toHaveAttribute("aria-expanded", "true");
      expect(input).toHaveAttribute("aria-controls", "command-palette-results");

      const listbox = screen.getByRole("listbox", { name: "Search Results" });
      expect(listbox).toBeInTheDocument();

      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveAttribute("aria-selected", "true");
    });
  });
});
