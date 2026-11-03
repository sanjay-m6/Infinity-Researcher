import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AiHubView } from "../features/ai-hub/AiHubView";
import { PdfRightPanel } from "../components/pdf-viewer/PdfRightPanel";
import { DiscoverPaperAssistant } from "../features/discover/DiscoverPaperAssistant";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";
import type { AiChatMessage, GenerateResponseOutput } from "../lib/desktop-api/types";
import type { UnifiedDiscoverPaper } from "../features/discover/DiscoverView";

const mockAiResponse = (text: string): GenerateResponseOutput => ({
  text,
  citations: [],
  provider_id: "test_provider",
  model_id: "test_model",
  latency_ms: 50,
  is_grounded: true,
});

describe("Milestone 2 Adversarial Stress Testing: Chat Persistence Lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.clearAll();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. Panel Unmounting Mid-Flight
  // ===========================================================================
  describe("Adversarial: Panel Unmounting Mid-Flight", () => {
    it("PdfRightPanel: unmounting mid-flight while saveAiChatMessage is in-flight does not throw unhandled rejections", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);

      let resolveSave: () => void = () => {};
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockImplementation(() => savePromise);

      vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue(mockAiResponse("Delayed response"));

      const { unmount } = render(
        <PdfRightPanel
          paperId="paper_unmount_test"
          paperTitle="Unmount Test Document"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      const input = screen.getByPlaceholderText(/Ask about Page 1/i);
      await user.type(input, "Will I survive unmount?");
      const sendBtn = screen.getByTitle(/Send message/i);
      await user.click(sendBtn);

      // Verify saveAiChatMessage was called for the user turn
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: "pdf_chat_paper_unmount_test",
          content: "Will I survive unmount?",
        })
      );

      // Unmount the component while the promise is still pending
      unmount();

      // Resolve save promise after unmount
      await act(async () => {
        resolveSave();
      });

      // Assert saveSpy was invoked properly and no error was thrown
      expect(saveSpy).toHaveBeenCalled();
    });

    it("AiHubView: unmounting mid-flight during generation and save does not throw unhandled exceptions", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);

      let resolveSave: () => void = () => {};
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockImplementation(() => savePromise);

      vi.spyOn(desktopApi, "generateAiResponse").mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(mockAiResponse("Response generated after unmount")),
              50
            )
          )
      );

      const { unmount } = render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      const input = screen.getByPlaceholderText(/Ask a question about this paper/i);
      await user.type(input, "Testing unmount mid-flight in AI Hub");
      const sendBtn = screen.getByRole("button", { name: /Send/i });
      await user.click(sendBtn);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Testing unmount mid-flight in AI Hub",
        })
      );

      // Unmount while in flight
      unmount();

      await act(async () => {
        resolveSave();
      });

      expect(saveSpy).toHaveBeenCalled();
    });

    it("DiscoverPaperAssistant: unmounting mid-flight persists message to discoverSessionStore and triggers saveAiChatMessage", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockResolvedValue();

      const mockPaper: UnifiedDiscoverPaper = {
        id: "disc_unmount_paper",
        paper_id: "disc_unmount_paper",
        title: "Unmount Paper",
        authors: ["Author A"],
        abstract_text: "Abstract",
        source_name: "arXiv",
        url: "https://arxiv.org",
        is_downloaded: true,
        is_imported: true,
        is_open_access: true,
        publication_year: 2024,
      };

      const { unmount } = render(
        <DiscoverPaperAssistant
          paper={mockPaper}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about equations, datasets/i);
      await user.type(textarea, "Hello Discover Unmount");
      const sendBtn = screen.getByTitle(/Send message/i);
      await user.click(sendBtn);

      // Unmount immediately
      unmount();

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "discover_disc_unmount_paper",
            content: "Hello Discover Unmount",
          })
        );
        const storeMessages =
          discoverSessionStore.getState().chatHistoryByPaper["disc_unmount_paper"];
        expect(storeMessages).toBeDefined();
        expect(storeMessages?.length).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // 2. Rapid Paper Switching & Stale Message Isolation
  // ===========================================================================
  describe("Adversarial: Rapid Paper Switching & Stale Message Isolation", () => {
    it("PdfRightPanel: rapid switching cancels stale in-flight fetches and shows the correct paper's history", async () => {
      const messagesPaperA: AiChatMessage[] = [
        {
          id: "msg_A",
          session_id: "pdf_chat_paper_A",
          paper_id: "paper_A",
          role: "user",
          content: "Unique question for Paper A",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      const messagesPaperC: AiChatMessage[] = [
        {
          id: "msg_C",
          session_id: "pdf_chat_paper_C",
          paper_id: "paper_C",
          role: "user",
          content: "Unique question for Paper C",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      let resolvePaperB: (msgs: AiChatMessage[]) => void = () => {};
      const paperBPromise = new Promise<AiChatMessage[]>((resolve) => {
        resolvePaperB = resolve;
      });

      vi.spyOn(desktopApi, "listAiChatMessages").mockImplementation((sessionId) => {
        if (sessionId === "pdf_chat_paper_A") {
          return Promise.resolve(messagesPaperA);
        }
        if (sessionId === "pdf_chat_paper_B") {
          return paperBPromise; // delayed
        }
        if (sessionId === "pdf_chat_paper_C") {
          return Promise.resolve(messagesPaperC);
        }
        return Promise.resolve([]);
      });

      // 1. Initial render with Paper A
      const { rerender } = render(
        <PdfRightPanel
          paperId="paper_A"
          paperTitle="Paper A Title"
          currentPage={1}
          numPages={10}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Unique question for Paper A")).toBeInTheDocument();
      });

      // 2. Switch to Paper B (slow)
      rerender(
        <PdfRightPanel
          paperId="paper_B"
          paperTitle="Paper B Title"
          currentPage={1}
          numPages={10}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      // 3. Immediately switch to Paper C (fast) before B resolves
      rerender(
        <PdfRightPanel
          paperId="paper_C"
          paperTitle="Paper C Title"
          currentPage={1}
          numPages={10}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      // Paper C should resolve and be displayed
      await waitFor(() => {
        expect(screen.getByText("Unique question for Paper C")).toBeInTheDocument();
        expect(screen.queryByText("Unique question for Paper A")).not.toBeInTheDocument();
      });

      // Now resolve Paper B late
      await act(async () => {
        resolvePaperB([
          {
            id: "msg_B_stale",
            session_id: "pdf_chat_paper_B",
            paper_id: "paper_B",
            role: "user",
            content: "STALE QUESTION FOR PAPER B",
            citations: [],
            retrieval_mode: "page",
            created_at: new Date().toISOString(),
          },
        ]);
      });

      // Verify that Paper B's stale message does NOT overwrite Paper C's history
      expect(screen.queryByText("STALE QUESTION FOR PAPER B")).not.toBeInTheDocument();
      expect(screen.getByText("Unique question for Paper C")).toBeInTheDocument();
    });

    it("PdfRightPanel: switching from a paper with history to an empty paper clears messages", async () => {
      const messagesPaperWithHistory: AiChatMessage[] = [
        {
          id: "msg_hist_1",
          session_id: "pdf_chat_paper_with_history",
          paper_id: "paper_with_history",
          role: "user",
          content: "Question from previous paper with history",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(desktopApi, "listAiChatMessages").mockImplementation((sessionId) => {
        if (sessionId === "pdf_chat_paper_with_history") {
          return Promise.resolve(messagesPaperWithHistory);
        }
        return Promise.resolve([]); // empty for other papers
      });

      const { rerender } = render(
        <PdfRightPanel
          paperId="paper_with_history"
          paperTitle="Paper With History"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Question from previous paper with history")).toBeInTheDocument();
      });

      // Switch to a paper with empty chat history
      rerender(
        <PdfRightPanel
          paperId="paper_empty_history"
          paperTitle="Paper Empty History"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText("Question from previous paper with history")).not.toBeInTheDocument();
        expect(screen.getByText("Grounded Research Copilot")).toBeInTheDocument();
      });
    });

    it("DiscoverPaperAssistant: switching papers isolates chat history between papers", async () => {
      const paper1: UnifiedDiscoverPaper = {
        id: "paper_disc_1",
        paper_id: "paper_disc_1",
        title: "Discover Paper 1",
        authors: ["Author 1"],
        abstract_text: "Abstract 1",
        source_name: "arXiv",
        url: "https://arxiv.org/1",
        is_downloaded: true,
        is_imported: true,
        is_open_access: true,
        publication_year: 2023,
      };

      const paper2: UnifiedDiscoverPaper = {
        id: "paper_disc_2",
        paper_id: "paper_disc_2",
        title: "Discover Paper 2",
        authors: ["Author 2"],
        abstract_text: "Abstract 2",
        source_name: "arXiv",
        url: "https://arxiv.org/2",
        is_downloaded: true,
        is_imported: true,
        is_open_access: true,
        publication_year: 2024,
      };

      vi.spyOn(desktopApi, "listAiChatMessages").mockImplementation((sessionId) => {
        if (sessionId === "discover_paper_disc_1") {
          return Promise.resolve([
            {
              id: "disc_p1_msg",
              session_id: "discover_paper_disc_1",
              paper_id: "paper_disc_1",
              role: "user",
              content: "Discover query for Paper 1 only",
              citations: [],
              retrieval_mode: "paper",
              created_at: new Date().toISOString(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const { rerender } = render(
        <DiscoverPaperAssistant
          paper={paper1}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Discover query for Paper 1 only")).toBeInTheDocument();
      });

      // Switch to Paper 2
      rerender(
        <DiscoverPaperAssistant
          paper={paper2}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText("Discover query for Paper 1 only")).not.toBeInTheDocument();
        expect(screen.getByText("Ask About This Paper")).toBeInTheDocument();
      });
    });

    it("AiHubView: switching from a paper with history to an empty paper leaks stale messages and pollutes new paper session", async () => {
      const user = userEvent.setup();
      const mockPaper1: any = {
        id: "paper_alpha",
        title: "Paper Alpha Title",
        authors: ["Author 1"],
        abstract: "Abstract 1",
        publicationDate: "2023",
        year: 2023,
        venue: "Venue",
        doi: null,
        sourceId: "src1",
        sourceName: "Source",
        landingUrl: "http://example.com",
        pdfUrl: null,
        accessStatus: "open",
        documentStatus: "ready",
        tags: [],
        collectionIds: [],
        citationCount: 0,
        addedAt: new Date().toISOString(),
        isSaved: true,
      };

      const mockPaper2: any = {
        ...mockPaper1,
        id: "paper_beta",
        title: "Paper Beta Title",
      };

      const alphaMessages: AiChatMessage[] = [
        {
          id: "hub_msg_alpha",
          session_id: "ai_hub_paper_alpha",
          paper_id: "paper_alpha",
          role: "user",
          content: "Alpha Question That Should Disappear on Beta",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
      ];

      const listSpy = vi.spyOn(desktopApi, "listAiChatMessages").mockImplementation((sessionId) => {
        if (sessionId === "ai_hub_paper_alpha") {
          return Promise.resolve(alphaMessages);
        }
        if (sessionId === "ai_hub_paper_beta") {
          return Promise.resolve([]); // Beta has NO history
        }
        return Promise.resolve([]);
      });

      vi.spyOn(desktopApi, "saveAiChatMessage").mockResolvedValue();
      vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue(mockAiResponse("Beta response"));

      render(
        <AppProvider initialPapers={[mockPaper1, mockPaper2]}>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      // Verify Paper Alpha is selected and its message appears
      await waitFor(() => {
        expect(screen.getByText("Alpha Question That Should Disappear on Beta")).toBeInTheDocument();
      });

      // Switch dropdown to Paper Beta
      const select = screen.getByDisplayValue("Paper Alpha Title");
      fireEvent.change(select, { target: { value: "paper_beta" } });

      // Verify listAiChatMessages was invoked for Paper Beta
      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith("ai_hub_paper_beta");
      });

      // Empirically demonstrate the bug:
      // Paper Alpha's message is STILL present on Paper Beta!
      const staleMessageStillPresent = screen.queryByText("Alpha Question That Should Disappear on Beta") !== null;
      expect(staleMessageStillPresent).toBe(true); // Demonstrates the confirmed bug

      // Furthermore, when sending a query on Paper Beta:
      const input = screen.getByPlaceholderText(/Ask a question about this paper/i);
      await user.type(input, "First query on Beta");
      const sendBtn = screen.getByRole("button", { name: /Send/i });
      await user.click(sendBtn);

      await waitFor(() => {
        expect(screen.getByText("First query on Beta")).toBeInTheDocument();
        // The UI now shows BOTH the leaked Alpha question AND the new Beta query!
        expect(screen.getByText("Alpha Question That Should Disappear on Beta")).toBeInTheDocument();
      });

      // Verify that Beta's localStorage key now contains Alpha's leaked message
      const betaLocalStorage = localStorage.getItem("ai_hub_chat_messages_ai_hub_paper_beta");
      expect(betaLocalStorage).toContain("Alpha Question That Should Disappear on Beta");
    });
  });

  // ===========================================================================
  // 3. Multiple Consecutive Clears & Rejection Resilience
  // ===========================================================================
  describe("Adversarial: Multiple Consecutive Clears & Rejection Resilience", () => {
    it("PdfRightPanel: clicking Clear History clears history and disables button against spam clicks", async () => {
      const user = userEvent.setup();
      const existing: AiChatMessage[] = [
        {
          id: "pdf_multi_clear",
          session_id: "pdf_chat_paper_multi_clear",
          paper_id: "paper_multi_clear",
          role: "user",
          content: "Clear me multiple times",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue(existing);
      const clearSpy = vi.spyOn(desktopApi, "clearAiChatSession").mockResolvedValue();

      render(
        <PdfRightPanel
          paperId="paper_multi_clear"
          paperTitle="Multi Clear Doc"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Clear me multiple times")).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear History/i });
      expect(clearBtn).not.toBeDisabled();

      // Click once
      await user.click(clearBtn);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledTimes(1);
        expect(clearSpy).toHaveBeenCalledWith("pdf_chat_paper_multi_clear");
        expect(screen.queryByText("Clear me multiple times")).not.toBeInTheDocument();
        expect(screen.getByText("Grounded Research Copilot")).toBeInTheDocument();
      });

      // Assert button is now disabled to prevent duplicate SQLite deletions
      expect(clearBtn).toBeDisabled();
    });

    it("PdfRightPanel: survives clearAiChatSession database rejection gracefully without uncaught error", async () => {
      const user = userEvent.setup();
      const existing: AiChatMessage[] = [
        {
          id: "pdf_err_clear",
          session_id: "pdf_chat_paper_fail",
          paper_id: "paper_fail",
          role: "user",
          content: "Failing clear question",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue(existing);
      const clearSpy = vi
        .spyOn(desktopApi, "clearAiChatSession")
        .mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));

      render(
        <PdfRightPanel
          paperId="paper_fail"
          paperTitle="Failing Clear Doc"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Failing clear question")).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear History/i });
      // Should not throw uncaught error
      await user.click(clearBtn);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith("pdf_chat_paper_fail");
      });
    });

    it("AiHubView: clicking Clear History repeatedly does not throw unhandled exceptions", async () => {
      const user = userEvent.setup();
      const existing: AiChatMessage[] = [
        {
          id: "aihub_multi_clear",
          session_id: "ai_hub_default",
          role: "user",
          content: "Question to clear in AI Hub",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue(existing);
      const clearSpy = vi.spyOn(desktopApi, "clearAiChatSession").mockResolvedValue();

      render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      await waitFor(() => {
        expect(screen.getByText("Question to clear in AI Hub")).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear History/i });
      await user.click(clearBtn);
      await user.click(clearBtn);
      await user.click(clearBtn);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalled();
        expect(screen.queryByText("Question to clear in AI Hub")).not.toBeInTheDocument();
        expect(screen.getByText("Ask Questions Grounded in Your Research Library")).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // 4. Empty History Initialization
  // ===========================================================================
  describe("Adversarial: Empty History Initialization & Error Resilience", () => {
    it("renders clean empty state for all 3 panels when listAiChatMessages returns []", async () => {
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);

      // 1. PdfRightPanel empty state
      const { unmount: unmountPdf } = render(
        <PdfRightPanel
          paperId="paper_empty_init"
          paperTitle="Empty Init Doc"
          currentPage={1}
          numPages={3}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Grounded Research Copilot")).toBeInTheDocument();
        expect(screen.getByText(/Ask questions grounded in Page 1/i)).toBeInTheDocument();
      });
      unmountPdf();

      // 2. DiscoverPaperAssistant empty state
      const mockPaper: UnifiedDiscoverPaper = {
        id: "disc_empty_init",
        paper_id: "disc_empty_init",
        title: "Empty Discover Doc",
        authors: ["Author E"],
        abstract_text: "Abstract",
        source_name: "arXiv",
        url: "https://arxiv.org/e",
        is_downloaded: true,
        is_imported: true,
        is_open_access: true,
        publication_year: 2024,
      };

      const { unmount: unmountDiscover } = render(
        <DiscoverPaperAssistant
          paper={mockPaper}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Ask About This Paper")).toBeInTheDocument();
        expect(screen.getByText("Suggested Questions:")).toBeInTheDocument();
      });
      unmountDiscover();

      // 3. AiHubView empty state
      render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      await waitFor(() => {
        expect(
          screen.getByText("Ask Questions Grounded in Your Research Library")
        ).toBeInTheDocument();
      });
    });

    it("survives SQLite listAiChatMessages rejection on mount without crashing UI", async () => {
      vi.spyOn(desktopApi, "listAiChatMessages").mockRejectedValue(
        new Error("IPC_ERROR: Failed to query SQLite database")
      );

      // Verify PdfRightPanel renders without throwing
      render(
        <PdfRightPanel
          paperId="paper_ipc_fail"
          paperTitle="Failing DB Doc"
          currentPage={1}
          numPages={2}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Grounded Research Copilot")).toBeInTheDocument();
      });
    });
  });
});
