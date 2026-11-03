import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfToolbar } from "../components/pdf-viewer/PdfToolbar";
import { PdfLeftPanel } from "../components/pdf-viewer/PdfLeftPanel";
import { PdfRightPanel } from "../components/pdf-viewer/PdfRightPanel";
import { TextSelectionMenu } from "../components/pdf-viewer/TextSelectionMenu";
import { EmbeddedPdfViewer } from "../components/pdf-viewer/EmbeddedPdfViewer";
import * as desktopApi from "../lib/desktop-api";

// ---------------------------------------------------------------------------
// JSDOM Mocks (Canvas, ResizeObserver, pdfjs-dist)
// ---------------------------------------------------------------------------

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
  });
});

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "mock-worker-url",
}));

vi.mock("pdfjs-dist", () => {
  return {
    GlobalWorkerOptions: {
      workerSrc: "",
    },
    Util: {
      transform: vi.fn().mockReturnValue([1, 0, 0, 1, 10, 20]),
    },
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 5,
        getPage: vi.fn().mockImplementation((pageNumber: number) =>
          Promise.resolve({
            getViewport: vi.fn().mockReturnValue({
              width: 600,
              height: 800,
              transform: [1, 0, 0, 1, 0, 0],
            }),
            render: vi.fn().mockReturnValue({
              promise: Promise.resolve(),
              cancel: vi.fn(),
            }),
            getTextContent: vi.fn().mockResolvedValue({
              items: [
                {
                  str: `Heading for section on page ${pageNumber}`,
                  transform: [1, 0, 0, 1, 10, 20],
                  height: 14,
                },
                {
                  str: "Deep learning transformer architecture empirical evaluation",
                  transform: [1, 0, 0, 1, 10, 40],
                  height: 10,
                },
              ],
            }),
          })
        ),
        getOutline: vi.fn().mockResolvedValue([
          {
            title: "1. Introduction",
            dest: "intro_dest",
            items: [{ title: "1.1 Background", dest: "bg_dest" }],
          },
          {
            title: "2. Empirical Methods",
            dest: "methods_dest",
          },
        ]),
        getDestination: vi.fn().mockImplementation((dest: string) => {
          if (dest === "intro_dest") return Promise.resolve(["ref_page_1"]);
          if (dest === "bg_dest") return Promise.resolve(["ref_page_2"]);
          if (dest === "methods_dest") return Promise.resolve(["ref_page_3"]);
          return Promise.resolve(null);
        }),
        getPageIndex: vi.fn().mockImplementation((ref: string) => {
          if (ref === "ref_page_1") return Promise.resolve(0); // page 1
          if (ref === "ref_page_2") return Promise.resolve(1); // page 2
          if (ref === "ref_page_3") return Promise.resolve(2); // page 3
          return Promise.resolve(0);
        }),
        cleanup: vi.fn(),
      }),
      destroy: vi.fn(),
    }),
  };
});

describe("Phase 13: PDF Reader Workspace Modernization Suite", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextSpy,
      },
      writable: true,
      configurable: true,
    });
  });

  // -------------------------------------------------------------------------
  // 1. PdfToolbar Tests
  // -------------------------------------------------------------------------
  describe("PdfToolbar Component", () => {
    it("renders document title, venue, year, canonical DOI, and offline badge", () => {
      render(
        <PdfToolbar
          paperTitle="Attention Is All You Need"
          sourceName="arXiv"
          venue="NeurIPS"
          publicationYear={2017}
          canonicalDoi="10.48550/arXiv.1706.03762"
          isDownloaded={true}
          currentPage={2}
          numPages={15}
          pageInput="2"
          setPageInput={vi.fn()}
          onPageInputSubmit={vi.fn()}
          goToPage={vi.fn()}
          zoom={1.25}
          setZoom={vi.fn()}
          fitMode="custom"
          setFitMode={vi.fn()}
          setRotation={vi.fn()}
          isSidebarOpen={false}
          setIsSidebarOpen={vi.fn()}
          isRightPanelOpen={false}
          setIsRightPanelOpen={vi.fn()}
          showSearch={false}
          setShowSearch={vi.fn()}
          isFullscreen={false}
          setIsFullscreen={vi.fn()}
        />
      );

      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      expect(screen.getByText(/NeurIPS/i)).toBeInTheDocument();
      expect(screen.getByText(/\(2017\)/i)).toBeInTheDocument();
      expect(screen.getByText("Saved Offline")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /DOI/i })).toBeInTheDocument();
      expect(screen.getByText("/ 15")).toBeInTheDocument();
    });

    it("triggers page navigation and zoom callbacks correctly", async () => {
      const user = userEvent.setup();
      const goToPage = vi.fn();
      const setZoom = vi.fn();
      const setRotation = vi.fn();
      const setIsSidebarOpen = vi.fn();
      const setIsRightPanelOpen = vi.fn();

      render(
        <PdfToolbar
          paperTitle="Transformer Workspace"
          currentPage={3}
          numPages={10}
          pageInput="3"
          setPageInput={vi.fn()}
          onPageInputSubmit={vi.fn()}
          goToPage={goToPage}
          zoom={1.0}
          setZoom={setZoom}
          fitMode="width"
          setFitMode={vi.fn()}
          setRotation={setRotation}
          isSidebarOpen={false}
          setIsSidebarOpen={setIsSidebarOpen}
          isRightPanelOpen={false}
          setIsRightPanelOpen={setIsRightPanelOpen}
          showSearch={false}
          setShowSearch={vi.fn()}
          isFullscreen={false}
          setIsFullscreen={vi.fn()}
        />
      );

      // Previous page button
      const prevBtn = screen.getByTitle(/Previous page/i);
      await user.click(prevBtn);
      expect(goToPage).toHaveBeenCalledWith(2);

      // Next page button
      const nextBtn = screen.getByTitle(/Next page/i);
      await user.click(nextBtn);
      expect(goToPage).toHaveBeenCalledWith(4);

      // Zoom in button
      const zoomInBtn = screen.getByTitle(/Zoom in/i);
      await user.click(zoomInBtn);
      expect(setZoom).toHaveBeenCalled();

      // Rotate clockwise
      const rotateBtn = screen.getByTitle(/Rotate clockwise/i);
      await user.click(rotateBtn);
      expect(setRotation).toHaveBeenCalled();

      // Sidebar Outline Toggle
      const outlineBtn = screen.getByTitle(/Toggle Document Outline/i);
      await user.click(outlineBtn);
      expect(setIsSidebarOpen).toHaveBeenCalled();

      // Right Research Panel Toggle
      const researchBtn = screen.getByTitle(/Toggle Research Assistant/i);
      await user.click(researchBtn);
      expect(setIsRightPanelOpen).toHaveBeenCalled();
    });

    it("copies canonical DOI to clipboard when clicking DOI badge", async () => {
      const user = userEvent.setup();
      const writeSpy = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined);
      render(
        <PdfToolbar
          paperTitle="Paper with DOI"
          canonicalDoi="10.1234/test.doi"
          currentPage={1}
          numPages={5}
          pageInput="1"
          setPageInput={vi.fn()}
          onPageInputSubmit={vi.fn()}
          goToPage={vi.fn()}
          zoom={1.0}
          setZoom={vi.fn()}
          fitMode="page"
          setFitMode={vi.fn()}
          setRotation={vi.fn()}
          isSidebarOpen={false}
          setIsSidebarOpen={vi.fn()}
          isRightPanelOpen={false}
          setIsRightPanelOpen={vi.fn()}
          showSearch={false}
          setShowSearch={vi.fn()}
          isFullscreen={false}
          setIsFullscreen={vi.fn()}
        />
      );

      const doiBtn = screen.getByTitle(/Copy DOI: 10.1234\/test.doi/i);
      await user.click(doiBtn);
      expect(writeSpy).toHaveBeenCalledWith("10.1234/test.doi");
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. PdfLeftPanel Tests (Outline, Pages, Bookmarks)
  // -------------------------------------------------------------------------
  describe("PdfLeftPanel Component", () => {
    it("renders document outline and jumps to page on click", async () => {
      const user = userEvent.setup();
      const goToPage = vi.fn();
      const outline = [
        {
          title: "1. Introduction",
          pageNumber: 1,
          items: [{ title: "1.1 Related Work", pageNumber: 2 }],
        },
        {
          title: "2. Methodology",
          pageNumber: 4,
        },
      ];

      render(
        <PdfLeftPanel
          outline={outline}
          numPages={10}
          currentPage={1}
          goToPage={goToPage}
          bookmarks={[]}
          onAddBookmark={vi.fn()}
          onRemoveBookmark={vi.fn()}
          initialTab="outline"
        />
      );

      expect(screen.getByText("1. Introduction")).toBeInTheDocument();
      expect(screen.getByText("2. Methodology")).toBeInTheDocument();

      // Click section heading
      await user.click(screen.getByText("2. Methodology"));
      expect(goToPage).toHaveBeenCalledWith(4);
    });

    it("allows adding, navigating to, and deleting bookmarks", async () => {
      const user = userEvent.setup();
      const goToPage = vi.fn();
      const onAddBookmark = vi.fn();
      const onRemoveBookmark = vi.fn();

      const bookmarks = [
        {
          id: "bm_1",
          paperId: "paper_abc",
          pageNumber: 3,
          label: "Proof of Theorem 2",
          createdAt: new Date().toISOString(),
        },
      ];

      render(
        <PdfLeftPanel
          outline={[]}
          numPages={10}
          currentPage={3}
          goToPage={goToPage}
          bookmarks={bookmarks}
          onAddBookmark={onAddBookmark}
          onRemoveBookmark={onRemoveBookmark}
          initialTab="bookmarks"
        />
      );

      expect(screen.getByText("Proof of Theorem 2")).toBeInTheDocument();

      // Jump to bookmark
      await user.click(screen.getByText("Proof of Theorem 2"));
      expect(goToPage).toHaveBeenCalledWith(3);

      // Delete bookmark
      const deleteBtn = screen.getByTitle(/Delete bookmark/i);
      await user.click(deleteBtn);
      expect(onRemoveBookmark).toHaveBeenCalledWith("bm_1");

      // Add new bookmark button opens prompt
      const addBtn = screen.getByRole("button", { name: /Bookmark Page 3/i });
      await user.click(addBtn);
      expect(screen.getByPlaceholderText(/Label \(e\.g\./i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 3. PdfRightPanel Tests (AI Copilot, Metadata, SQLite Notes)
  // -------------------------------------------------------------------------
  describe("PdfRightPanel Component", () => {
    it("renders AI copilot with grounding scopes and handles question submission", async () => {
      const user = userEvent.setup();
      const onNavigatePdfPage = vi.fn();

      vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({
        text: "The core contribution is a multi-head self-attention mechanism without recurrence.",
        citations: [],
        provider_id: "test-provider",
        model_id: "test-model",
        latency_ms: 120,
        is_grounded: true,
      });

      render(
        <PdfRightPanel
          paperId="paper_transformer"
          paperTitle="Attention Is All You Need"
          authors={["Vaswani et al."]}
          currentPage={3}
          numPages={15}
          selectedText="Multi-head attention allows the model to jointly attend to information."
          onNavigatePdfPage={onNavigatePdfPage}
          initialTab="ai"
        />
      );

      expect(screen.getByText(/AI Copilot/i)).toBeInTheDocument();
      expect(screen.getByText(/Selected Text/i)).toBeInTheDocument();

      // Submit question
      const input = screen.getByPlaceholderText(/Ask about Page 3/i);
      await user.type(input, "What is the key advantage?");
      const sendBtn = screen.getByTitle(/Send message/i);
      await user.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/multi-head self-attention mechanism/i)
        ).toBeInTheDocument();
      });
    });

    it("renders metadata, abstract, and copies APA/BibTeX citations", async () => {
      const user = userEvent.setup();
      const writeSpy = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined);

      render(
        <PdfRightPanel
          paperId="paper_vaswani"
          paperTitle="Attention Is All You Need"
          authors={["Ashish Vaswani", "Noam Shazeer"]}
          venue="NeurIPS"
          publicationYear={2017}
          canonicalDoi="10.48550/arXiv.1706.03762"
          abstractText="The dominant sequence transduction models are based on complex recurrent or convolutional neural networks."
          currentPage={1}
          numPages={15}
          onNavigatePdfPage={vi.fn()}
          initialTab="metadata"
        />
      );

      expect(screen.getAllByText(/Ashish Vaswani/i)[0]).toBeInTheDocument();
      expect(
        screen.getByText(/The dominant sequence transduction models/i)
      ).toBeInTheDocument();

      // Copy APA Citation
      const copyApaBtn = screen.getByRole("button", { name: /Copy APA/i });
      await user.click(copyApaBtn);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Ashish Vaswani, Noam Shazeer (2017). Attention Is All You Need."
        )
      );

      // Copy BibTeX Citation
      const copyBibtexBtn = screen.getByRole("button", { name: /Copy BibTeX/i });
      await user.click(copyBibtexBtn);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining("@article{vaswani2017")
      );
    });

    it("loads and persists SQLite notes for the paper", async () => {
      const user = userEvent.setup();
      const getNotesSpy = vi.spyOn(desktopApi, "getNotesForPaper").mockResolvedValue([
        {
          id: "note_1",
          paper_id: "paper_123",
          title: "Page 2 Note",
          content_markdown: "Key formula for scaled dot-product attention.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const saveNoteSpy = vi.spyOn(desktopApi, "saveNote").mockResolvedValue({
        id: "note_2",
        paper_id: "paper_123",
        title: "Page 4",
        content_markdown: "Need to verify baseline comparison table.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      render(
        <PdfRightPanel
          paperId="paper_123"
          paperTitle="Attention Is All You Need"
          currentPage={4}
          numPages={15}
          onNavigatePdfPage={vi.fn()}
          initialTab="notes"
        />
      );

      await waitFor(() => {
        expect(getNotesSpy).toHaveBeenCalledWith("paper_123");
        expect(
          screen.getByText(/Key formula for scaled dot-product attention/i)
        ).toBeInTheDocument();
      });

      // Add a note
      const textarea = screen.getByPlaceholderText(/Write a research note for Page 4/i);
      await user.type(textarea, "Need to verify baseline comparison table.");
      const saveBtn = screen.getByRole("button", { name: /Save Note/i });
      await user.click(saveBtn);

      expect(saveNoteSpy).toHaveBeenCalledWith({
        paper_id: "paper_123",
        title: "Page 4",
        content_markdown: "Need to verify baseline comparison table.",
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. TextSelectionMenu Tests
  // -------------------------------------------------------------------------
  describe("TextSelectionMenu Component", () => {
    it("renders floating toolbar with research actions and dispatches events", async () => {
      const user = userEvent.setup();
      const onAskAi = vi.fn();
      const onSaveNote = vi.fn();
      const onSearchInDoc = vi.fn();
      const onCopyText = vi.fn();
      const onCopyCitation = vi.fn();

      render(
        <TextSelectionMenu
          selectedText="Transformer architecture"
          position={{ x: 250, y: 150 }}
          currentPage={2}
          onAskAi={onAskAi}
          onSaveNote={onSaveNote}
          onSearchInDoc={onSearchInDoc}
          onCopyText={onCopyText}
          onCopyCitation={onCopyCitation}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByTestId("text-selection-menu")).toBeInTheDocument();

      // Click Ask AI
      await user.click(screen.getByRole("button", { name: /Ask AI/i }));
      expect(onAskAi).toHaveBeenCalledWith("Transformer architecture");

      // Click Save Note
      await user.click(screen.getByRole("button", { name: /Save Note/i }));
      expect(onSaveNote).toHaveBeenCalledWith("Transformer architecture", 2);

      // Click Find
      await user.click(screen.getByRole("button", { name: /Find/i }));
      expect(onSearchInDoc).toHaveBeenCalledWith("Transformer architecture");

      // Click Copy
      await user.click(screen.getByRole("button", { name: /Copy/i }));
      expect(onCopyText).toHaveBeenCalledWith("Transformer architecture");

      // Click Cite
      await user.click(screen.getByRole("button", { name: /Cite/i }));
      expect(onCopyCitation).toHaveBeenCalledWith("Transformer architecture");
    });
  });

  // -------------------------------------------------------------------------
  // 5. EmbeddedPdfViewer End-to-End Workspace Tests
  // -------------------------------------------------------------------------
  describe("EmbeddedPdfViewer Workspace Integration", () => {
    it("completes full document lifecycle to READY state and scales smoothly", async () => {
      vi.spyOn(desktopApi, "readPaperPdf").mockResolvedValue(
        new TextEncoder().encode("%PDF-1.7 mock valid pdf stream").buffer
      );
      vi.spyOn(desktopApi, "getReaderState").mockResolvedValue({
        paper_id: "local_paper_1",
        file_id: null,
        last_page: 2,
        zoom_level: 1.2,
        rotation: 0,
        updated_at: new Date().toISOString(),
      });

      render(
        <EmbeddedPdfViewer
          paperId="local_paper_1"
          paperTitle="Attention Is All You Need"
          sourceName="arXiv"
          venue="NeurIPS"
          publicationYear={2017}
          canonicalDoi="10.48550/arXiv.1706.03762"
          isDownloaded={true}
        />
      );

      // Wait for READY state
      await waitFor(() => {
        expect(screen.getByTestId("pdf-reader-workspace")).toBeInTheDocument();
        expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      });
    });

    it("handles ACCESS_RESTRICTED state when publisher paywall or anti-bot is encountered", async () => {
      vi.spyOn(desktopApi, "fetchRemotePdfPreview").mockRejectedValue(
        new Error("IEEE_ACCESS_RESTRICTED: subscription paywall required.")
      );

      render(
        <EmbeddedPdfViewer
          remotePdfUrl="https://ieeexplore.ieee.org/document/12345/pdf"
          paperTitle="IEEE Subscription Study"
          canonicalDoi="10.1109/TEST.2024.12345"
          sourceUrl="https://ieeexplore.ieee.org/document/12345"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Publisher Access Restricted/i)).toBeInTheDocument();
        expect(screen.getByText(/Document Requires Browser Access/i)).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /Open Official Article Page/i })
        ).toBeInTheDocument();
      });
    });

    it("handles INVALID_DOCUMENT state when HTML landing page is returned instead of PDF", async () => {
      vi.spyOn(desktopApi, "fetchRemotePdfPreview").mockResolvedValue(
        new TextEncoder().encode(
          "<!DOCTYPE html><html><body>Login Required</body></html>"
        ).buffer
      );

      render(
        <EmbeddedPdfViewer
          remotePdfUrl="https://example.com/paper.pdf"
          paperTitle="HTML Barrier Paper"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Non-PDF Response/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Web Landing Page Received Instead of PDF/i)
        ).toBeInTheDocument();
      });
    });

    it("handles in-document search and match navigation", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "readPaperPdf").mockResolvedValue(
        new TextEncoder().encode("%PDF-1.7 valid binary").buffer
      );

      render(
        <EmbeddedPdfViewer
          paperId="search_paper"
          paperTitle="Searchable Document"
          isDownloaded={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Searchable Document")).toBeInTheDocument();
      });

      // Open Find in Document
      const findBtn = screen.getByRole("button", { name: /Find/i });
      await user.click(findBtn);

      const searchInput = screen.getByPlaceholderText(/Find text in document.../i);
      expect(searchInput).toBeInTheDocument();

      // Search for keyword present in mock getTextContent
      await user.type(searchInput, "empirical");

      await waitFor(() => {
        expect(screen.getByText(/1 of 5/i)).toBeInTheDocument();
      });

      // Navigate to next match
      const nextMatchBtn = screen.getByTitle(/Next match/i);
      await user.click(nextMatchBtn);
      expect(screen.getByText(/2 of 5/i)).toBeInTheDocument();
    });

    it("debounces SQLite reader state persistence", async () => {
      const saveStateSpy = vi
        .spyOn(desktopApi, "saveReaderState")
        .mockResolvedValue(undefined);

      vi.spyOn(desktopApi, "readPaperPdf").mockResolvedValue(
        new TextEncoder().encode("%PDF-1.7 valid pdf").buffer
      );

      render(
        <EmbeddedPdfViewer
          paperId="paper_persist_test"
          paperTitle="Persistence Paper"
          isDownloaded={true}
        />
      );

      await waitFor(
        () => {
          expect(saveStateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              paper_id: "paper_persist_test",
              last_page: 1,
            })
          );
        },
        { timeout: 2000 }
      );
    });
  });
});
