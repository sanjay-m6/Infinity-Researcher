import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AiHubView } from "../features/ai-hub/AiHubView";
import { PdfRightPanel } from "../components/pdf-viewer/PdfRightPanel";
import { DiscoverPaperAssistant } from "../features/discover/DiscoverPaperAssistant";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";
import type { AiChatMessage } from "../lib/desktop-api/types";
import type { UnifiedDiscoverPaper } from "../features/discover/DiscoverView";

describe("Milestone 2: Frontend Chat Persistence Across Panels", () => {
  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.clearAll();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. AI Hub Chat Persistence Suite
  // ===========================================================================
  describe("AI Hub Chat Persistence", () => {
    it("hydrates existing chat messages from SQLite on mount via listAiChatMessages", async () => {
      const persistedMessages: AiChatMessage[] = [
        {
          id: "msg_hub_1",
          session_id: "ai_hub_default",
          role: "user",
          content: "What are the core transformer advantages?",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: "msg_hub_2",
          session_id: "ai_hub_default",
          role: "assistant",
          content: "Transformers enable full parallelization via multi-head self-attention.",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
      ];

      const listSpy = vi
        .spyOn(desktopApi, "listAiChatMessages")
        .mockResolvedValue(persistedMessages);

      render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      // Navigate to chat tab
      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith("ai_hub_default");
        expect(
          screen.getByText("What are the core transformer advantages?")
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Transformers enable full parallelization/i)
        ).toBeInTheDocument();
      });
    });

    it("persists user prompt and assistant response to SQLite via saveAiChatMessage", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockResolvedValue();
      vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({
        text: "Self-attention replaces recurrent cells entirely.",
        citations: [],
        provider_id: "nvidia_nim",
        model_id: "meta/llama-3-70b-instruct",
        latency_ms: 120,
        is_grounded: true,
      });

      render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      const input = screen.getByPlaceholderText(/Ask a question about this paper/i);
      await user.type(input, "Explain self-attention simply");

      const sendBtn = screen.getByRole("button", { name: /Send/i });
      await user.click(sendBtn);

      await waitFor(() => {
        // Must save user message
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "ai_hub_default",
            role: "user",
            content: "Explain self-attention simply",
          })
        );
        // Must save assistant response
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "ai_hub_default",
            role: "assistant",
            content: "Self-attention replaces recurrent cells entirely.",
          })
        );
      });
    });

    it("clears chat session from SQLite via clearAiChatSession and clears UI state", async () => {
      const user = userEvent.setup();
      const initialMessages: AiChatMessage[] = [
        {
          id: "msg_existing",
          session_id: "ai_hub_default",
          role: "user",
          content: "Initial query to clear",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
      ];
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue(initialMessages);
      const clearSpy = vi.spyOn(desktopApi, "clearAiChatSession").mockResolvedValue();

      render(
        <AppProvider>
          <AiHubView />
        </AppProvider>
      );

      const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
      fireEvent.click(chatTab);

      await waitFor(() => {
        expect(screen.getByText("Initial query to clear")).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear History/i });
      await user.click(clearBtn);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith("ai_hub_default");
        expect(screen.queryByText("Initial query to clear")).not.toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // 2. PDF Viewer Right Panel Chat Persistence Suite
  // ===========================================================================
  describe("PDF Viewer Right Panel Chat Persistence", () => {
    it("hydrates existing PDF chat history from SQLite keyed by pdf_chat_${paperId}", async () => {
      const persistedMessages: AiChatMessage[] = [
        {
          id: "pdf_msg_1",
          session_id: "pdf_chat_paper_xyz",
          paper_id: "paper_xyz",
          role: "user",
          content: "Summarize Theorem 1 on page 2",
          citations: [
            {
              chunk_id: "page_2",
              paper_id: "paper_xyz",
              paper_title: "Attention",
              page_number: 2,
              snippet: "Theorem 1 snippet",
              score: 1.0,
            },
          ],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
        {
          id: "pdf_msg_2",
          session_id: "pdf_chat_paper_xyz",
          paper_id: "paper_xyz",
          role: "assistant",
          content: "Theorem 1 establishes the convergence rate under bounded loss.",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      const listSpy = vi
        .spyOn(desktopApi, "listAiChatMessages")
        .mockResolvedValue(persistedMessages);

      render(
        <PdfRightPanel
          paperId="paper_xyz"
          paperTitle="Attention Is All You Need"
          authors={["Vaswani et al."]}
          currentPage={2}
          numPages={15}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith("pdf_chat_paper_xyz");
        expect(screen.getByText("Summarize Theorem 1 on page 2")).toBeInTheDocument();
        expect(
          screen.getByText(/Theorem 1 establishes the convergence rate/i)
        ).toBeInTheDocument();
      });
    });

    it("persists PDF user questions and assistant answers to SQLite", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockResolvedValue();
      vi.spyOn(desktopApi, "generateAiResponse").mockResolvedValue({
        text: "The scaled dot-product attention scales scores by 1/sqrt(d_k).",
        citations: [],
        provider_id: "ollama_local",
        model_id: "qwen2.5:7b",
        latency_ms: 95,
        is_grounded: true,
      });

      render(
        <PdfRightPanel
          paperId="paper_math"
          paperTitle="Attention Is All You Need"
          authors={["Vaswani et al."]}
          currentPage={4}
          numPages={15}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      const input = screen.getByPlaceholderText(/Ask about Page 4/i);
      await user.type(input, "Why is dot-product scaled?");
      const sendBtn = screen.getByTitle(/Send message/i);
      await user.click(sendBtn);

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "pdf_chat_paper_math",
            paper_id: "paper_math",
            role: "user",
            content: "Why is dot-product scaled?",
          })
        );
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "pdf_chat_paper_math",
            paper_id: "paper_math",
            role: "assistant",
            content: "The scaled dot-product attention scales scores by 1/sqrt(d_k).",
          })
        );
      });
    });

    it("provides Clear History button that clears SQLite session and local state", async () => {
      const user = userEvent.setup();
      const existing: AiChatMessage[] = [
        {
          id: "pdf_prev_1",
          session_id: "pdf_chat_paper_clear",
          paper_id: "paper_clear",
          role: "user",
          content: "Question to clear from PDF panel",
          citations: [],
          retrieval_mode: "page",
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue(existing);
      const clearSpy = vi.spyOn(desktopApi, "clearAiChatSession").mockResolvedValue();

      render(
        <PdfRightPanel
          paperId="paper_clear"
          paperTitle="Test Document"
          currentPage={1}
          numPages={5}
          onNavigatePdfPage={vi.fn()}
          initialTab="ai"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Question to clear from PDF panel")).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear History/i });
      await user.click(clearBtn);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith("pdf_chat_paper_clear");
        expect(
          screen.queryByText("Question to clear from PDF panel")
        ).not.toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // 3. Discover Paper Assistant Chat Persistence Suite
  // ===========================================================================
  describe("Discover Paper Assistant Chat Persistence", () => {
    const mockPaper: UnifiedDiscoverPaper = {
      id: "disc_paper_persistence",
      paper_id: "disc_paper_persistence",
      title: "Deep Residual Learning for Image Recognition",
      authors: ["Kaiming He", "Xiangyu Zhang"],
      abstract_text: "Deeper neural networks are more difficult to train.",
      source_name: "arXiv Preprints",
      url: "https://arxiv.org/abs/1512.03385",
      is_downloaded: true,
      is_imported: true,
      is_open_access: true,
      publication_year: 2016,
    };

    it("hydrates Discover chat history from SQLite keyed by discover_${paperIdKey}", async () => {
      const persistedMessages: AiChatMessage[] = [
        {
          id: "disc_msg_1",
          session_id: "discover_disc_paper_persistence",
          paper_id: "disc_paper_persistence",
          role: "user",
          content: "What degradation problem does ResNet address?",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
        {
          id: "disc_msg_2",
          session_id: "discover_disc_paper_persistence",
          paper_id: "disc_paper_persistence",
          role: "assistant",
          content: "ResNet addresses vanishing/exploding gradients and degradation via skip connections.",
          citations: [],
          retrieval_mode: "paper",
          created_at: new Date().toISOString(),
        },
      ];

      const listSpy = vi
        .spyOn(desktopApi, "listAiChatMessages")
        .mockResolvedValue(persistedMessages);

      render(
        <DiscoverPaperAssistant
          paper={mockPaper}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith("discover_disc_paper_persistence");
        expect(
          screen.getByText("What degradation problem does ResNet address?")
        ).toBeInTheDocument();
        expect(
          screen.getByText(/ResNet addresses vanishing\/exploding gradients/i)
        ).toBeInTheDocument();
      });
    });

    it("persists chat turns to SQLite when sending messages in Discover", async () => {
      const user = userEvent.setup();
      vi.spyOn(desktopApi, "listAiChatMessages").mockResolvedValue([]);
      const saveSpy = vi.spyOn(desktopApi, "saveAiChatMessage").mockResolvedValue();

      render(
        <DiscoverPaperAssistant
          paper={mockPaper}
          onNavigatePdfPage={vi.fn()}
          onRefreshPaperNotes={vi.fn()}
          showToast={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask about equations, datasets/i);
      await user.type(textarea, "Hello");
      const sendBtn = screen.getByTitle(/Send message/i);
      await user.click(sendBtn);

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "discover_disc_paper_persistence",
            role: "user",
            content: "Hello",
          })
        );
        // Greeting assistant response
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            session_id: "discover_disc_paper_persistence",
            role: "assistant",
            content: expect.stringContaining("AI Research Assistant"),
          })
        );
      });
    });

    it("clears SQLite session when discoverSessionStore.clearChat is invoked", async () => {
      const clearSpy = vi.spyOn(desktopApi, "clearAiChatSession").mockResolvedValue();

      // Seed message into store
      discoverSessionStore.addChatMessage("disc_paper_persistence", {
        id: "msg_to_clear",
        session_id: "discover_disc_paper_persistence",
        role: "user",
        content: "Will be deleted",
        citations: [],
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      });

      expect(
        discoverSessionStore.getState().chatHistoryByPaper["disc_paper_persistence"]
      ).toHaveLength(1);

      // Call clearChat
      discoverSessionStore.clearChat("disc_paper_persistence");

      expect(
        discoverSessionStore.getState().chatHistoryByPaper["disc_paper_persistence"]
      ).toBeUndefined();

      expect(clearSpy).toHaveBeenCalledWith("discover_disc_paper_persistence");
    });
  });
});
