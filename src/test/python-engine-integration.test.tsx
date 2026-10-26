import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import * as desktopApi from "../lib/desktop-api";

describe("Python Scraping Engine Frontend Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders Python Engine toggle and allows switching engines", async () => {
    const user = userEvent.setup();

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const pythonEngineBtn = screen.getByRole("button", { name: /Python Engine/i });
    const rustEngineBtn = screen.getByRole("button", { name: /Rust Native/i });

    expect(pythonEngineBtn).toBeInTheDocument();
    expect(rustEngineBtn).toBeInTheDocument();

    // Switch to Python engine
    await user.click(pythonEngineBtn);
    expect(pythonEngineBtn).toHaveClass("bg-white");
  });

  it("streams discovered papers with relevance score and metadata confidence from Python engine", async () => {
    const user = userEvent.setup();

    vi.spyOn(desktopApi, "startPythonSearchStream").mockImplementation(
      async (query, onEvent, sessionId) => {
        const sid = sessionId || "py_sess_1";

        onEvent({
          type: "search_started",
          session_id: sid,
          query: query.query,
          sources: ["arxiv", "plos"],
        });

        onEvent({
          type: "source_status",
          session_id: sid,
          source_id: "arxiv",
          source_name: "arXiv (Python Engine)",
          status: "searching",
          results_count: 0,
          elapsed_ms: 15,
        });

        onEvent({
          type: "paper_found",
          session_id: sid,
          source_id: "arxiv",
          paper: {
            id: "arxiv_2401_05432",
            title: "Transformer Attention Architecture for Scientific Paper Discovery",
            authors: ["Ashish Vaswani", "Noam Shazeer"],
            publication_date: "2024-01-10",
            publication_year: 2024,
            venue: "arXiv",
            canonical_doi: "10.48550/arXiv.2401.05432",
            abstract_text: "High coverage neural parsing for academic paper metadata.",
            landing_url: "https://arxiv.org/abs/2401.05432",
            pdf_url: "https://arxiv.org/pdf/2401.05432.pdf",
            source_id: "arxiv",
            source_name: "arXiv (Python Engine)",
            content_type: "preprint",
            is_open_access: true,
            license_name: "CC BY 4.0",
            peer_reviewed: false,
            subject_tags: ["machine learning", "nlp"],
            language: "en",
            relevance_score: 0.95,
            metadata_confidence: 0.90,
          },
        });

        onEvent({
          type: "source_completed",
          session_id: sid,
          source_id: "arxiv",
          count: 1,
          elapsed_ms: 250,
        });

        onEvent({
          type: "search_completed",
          session_id: sid,
          total_unique: 1,
          duration_ms: 300,
        });

        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Switch to Python engine
    const pythonEngineBtn = screen.getByRole("button", { name: /Python Engine/i });
    await user.click(pythonEngineBtn);

    // Execute search
    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "transformer attention");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    // Verify paper appeared with match and confidence chips
    await waitFor(() => {
      expect(
        screen.getAllByText("Transformer Attention Architecture for Scientific Paper Discovery").length
      ).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText(/Match: 95%/i)).toBeInTheDocument();
    expect(screen.getByText(/Conf: 90%/i)).toBeInTheDocument();
    expect(screen.getAllByText("arXiv (Python Engine)").length).toBeGreaterThanOrEqual(1);
  });

  it("clears search loading state cleanly when Python engine yields 0 results", async () => {
    const user = userEvent.setup();

    vi.spyOn(desktopApi, "startPythonSearchStream").mockImplementation(
      async (query, onEvent, sessionId) => {
        const sid = sessionId || "py_sess_empty";

        onEvent({
          type: "search_started",
          session_id: sid,
          query: query.query,
          sources: ["arxiv"],
        });

        onEvent({
          type: "source_status",
          session_id: sid,
          source_id: "arxiv",
          source_name: "arXiv (Python Engine)",
          status: "searching",
          results_count: 0,
          elapsed_ms: 20,
        });

        onEvent({
          type: "source_completed",
          session_id: sid,
          source_id: "arxiv",
          count: 0,
          elapsed_ms: 250,
        });

        onEvent({
          type: "search_no_results",
          session_id: sid,
          duration_ms: 300,
        });

        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const pythonEngineBtn = screen.getByRole("button", { name: /Python Engine/i });
    await user.click(pythonEngineBtn);

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "nonexistentquery12345");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    // Search button should not be stuck loading
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Search$/i })).toBeInTheDocument();
      expect(screen.queryByText(/Searching papers/i)).not.toBeInTheDocument();
    });
  });

  it("handles source failure without getting stuck in infinite loading", async () => {
    const user = userEvent.setup();

    vi.spyOn(desktopApi, "startPythonSearchStream").mockImplementation(
      async (query, onEvent, sessionId) => {
        const sid = sessionId || "py_sess_err";

        onEvent({
          type: "search_started",
          session_id: sid,
          query: query.query,
          sources: ["arxiv"],
        });

        onEvent({
          type: "source_failed",
          session_id: sid,
          source_id: "arxiv",
          message: "Connection timed out to arXiv",
          error_category: "network",
          elapsed_ms: 500,
        });

        onEvent({
          type: "search_completed_with_errors",
          session_id: sid,
          total_unique: 0,
          failed_sources: ["arxiv"],
          duration_ms: 600,
        });

        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const pythonEngineBtn = screen.getByRole("button", { name: /Python Engine/i });
    await user.click(pythonEngineBtn);

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "quantum gravity");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    // Search should finish and not stay stuck in loading
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Search$/i })).toBeInTheDocument();
      expect(screen.queryByText(/Searching across/i)).not.toBeInTheDocument();
    });
  });
});
