import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import * as desktopApi from "../lib/desktop-api";

describe("Streaming Search & Direct PDF In-Panel Preview (Part K Requirements)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("streams paper_found events immediately into result list with session isolation and truthful status chips", async () => {
    const user = userEvent.setup();

    // Mock streaming implementation that emits events incrementally
    let capturedOnEvent: ((event: desktopApi.SearchStreamEvent) => void) | null = null;
    vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
      async (query, onEvent, sessionId) => {
        capturedOnEvent = onEvent;
        // Search started
        onEvent({
          type: "search_started",
          session_id: sessionId || "sess_1",
          query: query.query,
          sources: ["arxiv", "plos", "biorxiv"],
        });
        // arXiv searching
        onEvent({
          type: "source_status",
          session_id: sessionId || "sess_1",
          source_id: "arxiv",
          source_name: "arXiv Preprints",
          status: "searching",
          results_count: 0,
          elapsed_ms: 10,
        });
        // arXiv finds first paper immediately
        onEvent({
          type: "paper_found",
          session_id: sessionId || "sess_1",
          source_id: "arxiv",
          paper: {
            id: "2401.12345",
            title: "Real-time Streaming Transformers for Visual Reasoning",
            authors: ["Alice Smith", "Bob Jones"],
            publication_date: "2024-01-15",
            publication_year: 2024,
            venue: "arXiv cs.CV",
            canonical_doi: "10.48550/arXiv.2401.12345",
            abstract_text: "We propose a low-latency streaming transformer that updates predictions immediately.",
            landing_url: "https://arxiv.org/abs/2401.12345",
            pdf_url: "https://arxiv.org/pdf/2401.12345.pdf",
            source_id: "arxiv",
            source_name: "arXiv Preprints",
            content_type: "preprint",
            is_open_access: true,
            license_name: "arXiv.org perpetual non-exclusive license",
            peer_reviewed: false,
            subject_tags: ["cs.CV", "cs.AI"],
            language: "en",
            relevance_score: 1.0,
          },
        });
        // PLOS is unsupported (AJAX)
        onEvent({
          type: "source_status",
          session_id: sessionId || "sess_1",
          source_id: "plos",
          source_name: "PLOS Open Access Journals",
          status: "unsupported",
          message: "PLOS search requires browser execution (AJAX). Use official web search.",
          results_count: 0,
          elapsed_ms: 60,
        });
        // bioRxiv is blocked (Cloudflare)
        onEvent({
          type: "source_status",
          session_id: sessionId || "sess_1",
          source_id: "biorxiv",
          source_name: "bioRxiv Preprints",
          status: "blocked",
          message: "Source is protected by Cloudflare bot management (HTTP 403).",
          results_count: 0,
          elapsed_ms: 80,
        });
        // arXiv completes
        onEvent({
          type: "source_completed",
          session_id: sessionId || "sess_1",
          source_id: "arxiv",
          count: 1,
          elapsed_ms: 120,
        });
        onEvent({
          type: "search_completed",
          session_id: sessionId || "sess_1",
          total_unique: 1,
          duration_ms: 130,
        });

        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "streaming visual transformers");

    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    // 1. Paper appeared immediately in the results list
    await waitFor(() => {
      expect(
        screen.getAllByText("Real-time Streaming Transformers for Visual Reasoning").length
      ).toBeGreaterThanOrEqual(1);
    });

    // 2. Truthful source chips distinguishing success, unsupported (AJAX), and blocked (Cloudflare)
    expect(screen.getByText(/arxiv:/i)).toBeInTheDocument();
    expect(screen.getByText(/1 found/i)).toBeInTheDocument();
    expect(screen.getByText(/plos:/i)).toBeInTheDocument();
    expect(screen.getByText(/unsupported/i)).toBeInTheDocument();
    expect(screen.getByText(/biorxiv:/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();

    // 3. Stale session event discarded: event with old or wrong session id must not corrupt results
    if (capturedOnEvent) {
      const handler = capturedOnEvent as (event: desktopApi.SearchStreamEvent) => void;
      handler({
        type: "paper_found",
        session_id: "stale_old_session_999",
        source_id: "arxiv",
        paper: {
          id: "stale_paper_id",
          title: "STALE PAPER THAT SHOULD NEVER APPEAR",
          authors: ["Ghost"],
          landing_url: "https://example.com/stale",
          source_id: "arxiv",
          source_name: "arXiv",
          content_type: "preprint",
          is_open_access: true,
          subject_tags: [],
          relevance_score: 0.1,
        },
      });
    }

    expect(screen.queryByText("STALE PAPER THAT SHOULD NEVER APPEAR")).not.toBeInTheDocument();
  });

  it("renders in-panel PDF viewer directly when paper has a direct PDF URL without requiring manual download click", async () => {
    const user = userEvent.setup();
    const fetchPreviewSpy = vi.spyOn(desktopApi, "fetchRemotePdfPreview");

    vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
      async (_query, onEvent, sessionId) => {
        onEvent({
          type: "search_started",
          session_id: sessionId || "sess_2",
          query: "cancer segmentation",
          sources: ["arxiv"],
        });
        onEvent({
          type: "paper_found",
          session_id: sessionId || "sess_2",
          source_id: "arxiv",
          paper: {
            id: "2402.99999",
            title: "Direct In-Panel Streaming Test Paper",
            authors: ["Dr. Segmenter"],
            publication_date: "2024-02-01",
            publication_year: 2024,
            venue: "arXiv",
            landing_url: "https://arxiv.org/abs/2402.99999",
            pdf_url: "https://arxiv.org/pdf/2402.99999.pdf",
            source_id: "arxiv",
            source_name: "arXiv Preprints",
            content_type: "preprint",
            is_open_access: true,
            subject_tags: ["cs.CV"],
            relevance_score: 1.0,
          },
        });
        onEvent({
          type: "source_completed",
          session_id: sessionId || "sess_2",
          source_id: "arxiv",
          count: 1,
          elapsed_ms: 50,
        });
        onEvent({
          type: "search_completed",
          session_id: sessionId || "sess_2",
          total_unique: 1,
          duration_ms: 60,
        });
        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "cancer segmentation");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Direct In-Panel Streaming Test Paper").length).toBeGreaterThanOrEqual(1);
    });

    // Selecting paper triggers fetchRemotePdfPreview without downloading to disk
    await waitFor(() => {
      expect(fetchPreviewSpy).toHaveBeenCalledWith("https://arxiv.org/pdf/2402.99999.pdf");
    });

    // Center panel provides Save Offline action for the user to explicitly save if desired
    expect(screen.getByRole("button", { name: /Save Offline/i })).toBeInTheDocument();
  });

  it("shows honest fallback in center panel when selected paper has no direct PDF link", async () => {
    const user = userEvent.setup();

    vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
      async (_query, onEvent, sessionId) => {
        onEvent({
          type: "paper_found",
          session_id: sessionId || "sess_3",
          source_id: "nature_srep",
          paper: {
            id: "srep_metadata_only",
            title: "Study of Molecular Pathways (Metadata Only)",
            authors: ["Lab Researcher"],
            landing_url: "https://www.nature.com/articles/s41598-024-00000",
            pdf_url: null, // No direct PDF available
            source_id: "nature_srep",
            source_name: "Nature Scientific Reports",
            content_type: "journal_article",
            is_open_access: false,
            subject_tags: ["Biology"],
            relevance_score: 0.9,
          },
        });
        onEvent({
          type: "search_completed",
          session_id: sessionId || "sess_3",
          total_unique: 1,
          duration_ms: 50,
        });
        return () => {};
      }
    );

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "molecular pathways");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Study of Molecular Pathways (Metadata Only)").length).toBeGreaterThanOrEqual(1);
    });

    // Center panel shows truthful fallback without perpetual spinner or fake PDF
    expect(screen.getByText(/No Direct PDF Stream Available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Source Article Page/i })).toBeInTheDocument();
  });
});
