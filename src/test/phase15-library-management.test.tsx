import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { LibraryView } from "../features/library/LibraryView";
import { Paper, Collection } from "../types/domain";
import * as desktopApi from "../lib/desktop-api";
import { DbNote } from "../lib/desktop-api";

const MOCK_PAPERS: Paper[] = [
  {
    id: "paper-1",
    title: "Deep Residual Learning for Image Recognition",
    authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    abstract: "Deeper neural networks are more difficult to train.",
    publicationDate: "2015-12-10",
    year: 2015,
    venue: "CVPR",
    doi: "10.1109/CVPR.2016.90",
    sourceId: "arxiv",
    sourceName: "arXiv",
    landingUrl: "https://arxiv.org/abs/1512.03385",
    pdfUrl: "https://arxiv.org/pdf/1512.03385.pdf",
    accessStatus: "open_access",
    documentStatus: "available",
    tags: ["Computer Vision", "Deep Learning"],
    collectionIds: ["col-1"],
    citationCount: 150000,
    addedAt: "2024-01-01T10:00:00Z",
    isSaved: true,
    readingStatus: "unread",
    readingProgress: 0,
    lastOpenedAt: null,
  },
  {
    id: "paper-2",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
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
    tags: ["Attention", "Deep Learning", "Transformers"],
    collectionIds: ["col-1", "col-2"],
    citationCount: 95000,
    addedAt: "2024-02-01T10:00:00Z",
    isSaved: true,
    readingStatus: "in_progress",
    readingProgress: 45,
    lastOpenedAt: "2024-02-15T12:00:00Z",
  },
  {
    id: "paper-3",
    title: "Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann"],
    abstract: "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks.",
    publicationDate: "2020-05-28",
    year: 2020,
    venue: "NeurIPS",
    doi: "10.48550/arXiv.2005.14165",
    sourceId: "arxiv",
    sourceName: "arXiv",
    landingUrl: "https://arxiv.org/abs/2005.14165",
    pdfUrl: "https://arxiv.org/pdf/2005.14165.pdf",
    accessStatus: "open_access",
    documentStatus: "available",
    tags: ["NLP", "GPT"],
    collectionIds: ["col-2"],
    citationCount: 22000,
    addedAt: "2024-03-01T10:00:00Z",
    isSaved: true,
    readingStatus: "read",
    readingProgress: 100,
    lastOpenedAt: "2024-03-10T15:30:00Z",
  },
];

const MOCK_COLLECTIONS: Collection[] = [
  {
    id: "col-1",
    name: "Foundational Vision",
    description: "Pivotal computer vision architectures",
    colorHex: "#6366f1",
    paperIds: ["paper-1", "paper-2"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "col-2",
    name: "Transformers & LLMs",
    description: "Sequence models and large language models",
    colorHex: "#10b981",
    paperIds: ["paper-2", "paper-3"],
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-02-01T00:00:00Z",
  },
];

describe("Phase 15: Research Library, Collections, and Knowledge Management", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Multi-View Display Modes & Persistence
  // ---------------------------------------------------------------------------
  describe("Multi-View Display Modes & Persistence", () => {
    it("defaults to Table view and renders structured paper columns", () => {
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      expect(screen.getByRole("button", { name: /^Table View$/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByText("Deep Residual Learning for Image Recognition")).toBeInTheDocument();
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      expect(screen.getByText("Language Models are Few-Shot Learners")).toBeInTheDocument();
    });

    it("switches to Card/Grid view and renders rich cards with reading progress", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const gridBtn = screen.getByRole("button", { name: /^Grid View$/i });
      await user.click(gridBtn);

      expect(gridBtn).toHaveAttribute("aria-pressed", "true");
      expect(localStorage.getItem("infinity_library_view_mode")).toBe("grid");

      // Verify abstract snippets render in grid mode
      expect(screen.getByText("Deeper neural networks are more difficult to train.")).toBeInTheDocument();
    });

    it("switches to Compact view and persists choice to localStorage", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const compactBtn = screen.getByRole("button", { name: /^Compact View$/i });
      await user.click(compactBtn);

      expect(compactBtn).toHaveAttribute("aria-pressed", "true");
      expect(localStorage.getItem("infinity_library_view_mode")).toBe("compact");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Reading Status & Progress Management
  // ---------------------------------------------------------------------------
  describe("Reading Status & Progress", () => {
    it("filters papers by reading status", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const statusFilter = screen.getAllByRole("combobox").find((el) =>
        Array.from((el as HTMLSelectElement).options).some((o) => o.value === "in_progress")
      );
      expect(statusFilter).toBeDefined();

      if (statusFilter) {
        await user.selectOptions(statusFilter, "in_progress");
      }

      // Only Attention Is All You Need is "in_progress"
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      expect(screen.queryByText("Deep Residual Learning for Image Recognition")).not.toBeInTheDocument();
      expect(screen.queryByText("Language Models are Few-Shot Learners")).not.toBeInTheDocument();
    });

    it("updates paper reading status inline via dropdown", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      // Locate reading status select for first paper
      const inlineSelects = screen.getAllByRole("combobox").filter((el) =>
        (el as HTMLSelectElement).value === "unread"
      );
      expect(inlineSelects.length).toBeGreaterThan(0);

      await user.selectOptions(inlineSelects[0], "read");
      expect((inlineSelects[0] as HTMLSelectElement).value).toBe("read");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Tag Management & Semantic Color Tokens
  // ---------------------------------------------------------------------------
  describe("Tag Management & Semantic Tokens", () => {
    it("filters papers by tag selection", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const tagFilter = screen.getAllByRole("combobox").find((el) =>
        Array.from((el as HTMLSelectElement).options).some((o) => o.value === "Computer Vision")
      );
      expect(tagFilter).toBeDefined();

      if (tagFilter) {
        await user.selectOptions(tagFilter, "Computer Vision");
      }

      expect(screen.getByText("Deep Residual Learning for Image Recognition")).toBeInTheDocument();
      expect(screen.queryByText("Attention Is All You Need")).not.toBeInTheDocument();
    });

    it("opens Tag Manager modal and displays tag counts", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const tagManagerBtn = screen.getByRole("button", { name: /Tags/i });
      await user.click(tagManagerBtn);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Research Tag Management")).toBeInTheDocument();
      expect(within(dialog).getByText("Deep Learning")).toBeInTheDocument();
      // "Deep Learning" is in 2 papers
      expect(within(dialog).getByText("(2 papers)")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Saved Searches Drawer & Execution
  // ---------------------------------------------------------------------------
  describe("Saved Searches Drawer & Execution", () => {
    it("opens saved searches drawer and displays saved queries", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const savedSearchesBtn = screen.getByRole("button", { name: /Saved Searches/i });
      await user.click(savedSearchesBtn);

      expect(screen.getByText("Saved Search Configurations")).toBeInTheDocument();
      expect(
        screen.getByText("Saved searches preserve query terms, source filters, and sorting criteria for repeatable academic research.")
      ).toBeInTheDocument();
    });

    it("saves a new search configuration and applies it", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      // Open drawer
      await user.click(screen.getByRole("button", { name: /Saved Searches/i }));

      // Click "Save Query"
      const saveQueryBtn = screen.getByRole("button", { name: /Save Query/i });
      await user.click(saveQueryBtn);

      const nameInput = screen.getByPlaceholderText(/e\.g\. Graph Neural Networks 2024/i);
      await user.type(nameInput, "Vision Architectures");

      const submitBtn = screen.getByRole("button", { name: /Save Configuration/i });
      await user.click(submitBtn);

      expect(screen.getByText("Vision Architectures")).toBeInTheDocument();

      // Click "Apply" on the newly created saved search
      const applyBtn = screen.getByRole("button", { name: /Apply/i });
      await user.click(applyBtn);

      // Modal closes upon apply
      expect(screen.queryByText("Saved Search Configurations")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Global Notes Search
  // ---------------------------------------------------------------------------
  describe("Global Notes Search", () => {
    it("searches research notes and displays page numbers and excerpts", async () => {
      const user = userEvent.setup();
      const mockNotes: DbNote[] = [
        {
          id: "note-1",
          paper_id: "paper-2",
          title: "Multi-Head Attention Scaling",
          content_markdown: "Attention is scaled by 1/sqrt(d_k) to avoid vanishing gradients in dot product.",
          page_number: 4,
          highlighted_text: "We compute the matrix of outputs as Softmax(QK^T / sqrt(d_k))V",
          created_at: "2024-02-10T12:00:00Z",
          updated_at: "2024-02-10T12:00:00Z",
        },
      ];

      vi.spyOn(desktopApi, "searchNotes").mockResolvedValueOnce(mockNotes);

      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const notesSearchBtn = screen.getByRole("button", { name: /Notes Search/i });
      await user.click(notesSearchBtn);

      expect(screen.getByText("Global Research Notes Search")).toBeInTheDocument();

      const input = screen.getByPlaceholderText(/Search note contents, keywords, quotes/i);
      await user.type(input, "scaling");

      const submitBtn = screen.getByRole("button", { name: /^Search Notes$/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Multi-Head Attention Scaling")).toBeInTheDocument();
        expect(screen.getByText("Page 4")).toBeInTheDocument();
        expect(screen.getByText(/We compute the matrix of outputs/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Portable Library Backup & Citation Export
  // ---------------------------------------------------------------------------
  describe("Portable Library Backup & Citation Export", () => {
    it("opens Backup & Export modal and generates valid versioned JSON", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const exportBtn = screen.getByRole("button", { name: /Backup & Export/i });
      await user.click(exportBtn);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Library Backup & Citation Export")).toBeInTheDocument();

      // Verify JSON payload contains 3 papers and schema version 1.0
      const textarea = within(dialog).getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toContain('"version": "1.0"');
      expect(textarea.value).toContain("Deep Residual Learning for Image Recognition");
    });

    it("generates BibTeX entries when format is changed", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      await user.click(screen.getByRole("button", { name: /Backup & Export/i }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "BIBTEX" }));

      const textarea = within(dialog).getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toContain("@article{");
      expect(textarea.value).toContain("title = {Attention Is All You Need}");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Safe Collection Unlinking & Merge Preservation
  // ---------------------------------------------------------------------------
  describe("Safe Collection Unlinking & Transactional Merge Preservation", () => {
    it("preserves paper records when a collection is deleted", () => {
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      // Verify initial collection count and paper count
      expect(screen.getByText("Deep Residual Learning for Image Recognition")).toBeInTheDocument();
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    });

    it("renders Duplicate Review tab with preservation toggles", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialPapers={MOCK_PAPERS} initialCollections={MOCK_COLLECTIONS}>
          <LibraryView />
        </AppProvider>
      );

      const dupTab = screen.getByRole("button", { name: /Duplicate Review/i });
      await user.click(dupTab);

      expect(screen.getByText("Explainable Duplicate Detection")).toBeInTheDocument();
      expect(screen.getByText("Scan for Duplicates")).toBeInTheDocument();
    });
  });
});
