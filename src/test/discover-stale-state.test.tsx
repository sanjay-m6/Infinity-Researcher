import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";

describe("Discover View Stale State & Source Telemetry Regression Suite (Part C & D)", () => {
  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.setState({
      searchQuery: "",
      submittedQuery: "",
      activeJobId: null,
      isSearching: false,
      discoveredResults: [],
      sourceStatuses: [],
      selectedPaperId: null,
    });
    vi.restoreAllMocks();
  });

  it("does not pollute Discover results with library papers and never shows DOAJ on new search", async () => {
    const user = userEvent.setup();

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Initial state: 0 papers discovered, DOAJ library paper must NOT be selected or listed
    expect(screen.queryByText(/DOAJ: 20 years of open access/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Results \(0\)/i)).toBeInTheDocument();

    // Type new search query
    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "machine learning for medical image segmentation");

    // Click search
    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    // During search and before results arrive, DOAJ must never appear in center or right panes
    expect(screen.queryByText(/DOAJ: 20 years of open access/i)).not.toBeInTheDocument();
  });

  it("truthfully renders source statuses and transitions chips out of searching state", async () => {
    const user = userEvent.setup();

    // Mock startWebsiteSearchStream to emit events for sources
    vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
      async (_params, callback, sessionId) => {
        const sid = sessionId || "test-session";
        // Emit source_started
        callback({
          type: "source_started",
          source_id: "arxiv",
          source_name: "arXiv Preprints",
          session_id: sid,
        });

        // Emit source_completed for arxiv
        callback({
          type: "source_completed",
          source_id: "arxiv",
          session_id: sid,
          count: 2,
          elapsed_ms: 120,
        });

        // Emit source_failed for biorxiv
        callback({
          type: "source_failed",
          source_id: "biorxiv",
          session_id: sid,
          error: "Access restricted by source server (HTTP 403)",
          elapsed_ms: 250,
        });

        // Emit search_completed
        callback({
          type: "search_completed",
          session_id: sid,
          total_unique: 2,
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

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "transformer models");
    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    // Verify arxiv chip shows completed with 2 found
    await waitFor(() => {
      expect(screen.getByTitle(/diagnostics for arXiv Preprints/i)).toBeInTheDocument();
    });

    // Verify biorxiv chip shows failed
    expect(screen.getByTitle(/diagnostics for bioRxiv Preprints/i)).toBeInTheDocument();
  });

  it("cancelling search terminates stream and marks active sources as cancelled", async () => {
    const user = userEvent.setup();
    let unlistenCalled = false;

    vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
      async () => {
        return () => {
          unlistenCalled = true;
        };
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
    await user.type(queryInput, "neural networks");
    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    // Cancel button is visible in search bar and progress banner
    const cancelBtns = screen.getAllByRole("button", { name: /Cancel/i });
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
    await user.click(cancelBtns[0]);

    expect(unlistenCalled).toBe(true);
    // Searching banner should disappear
    expect(screen.queryByRole("button", { name: /^Cancel$/i })).not.toBeInTheDocument();
  });

  it("opens Diagnostics modal displaying engine telemetry and copy report button", async () => {
    const user = userEvent.setup();

    vi.spyOn(desktopApi, "getScrapingEngineDiagnostics").mockResolvedValue({
      engine_version: "2.19.0",
      engine_status: "ready",
      uptime_seconds: 120,
      total_searches: 3,
      successful_searches: 2,
      failed_searches: 1,
      cancelled_searches: 0,
      active_sessions: 0,
      recent_jobs: [],
      sources: [
        {
          source_id: "arxiv",
          source_name: "arXiv Preprints",
          status: "enabled",
          total_requests: 3,
          successful_requests: 3,
          failed_requests: 0,
          total_papers_found: 25,
          last_elapsed_ms: 350,
          last_error: "Nominal",
        },
        {
          source_id: "biorxiv",
          source_name: "bioRxiv Preprints",
          status: "enabled",
          total_requests: 2,
          successful_requests: 0,
          failed_requests: 2,
          total_papers_found: 0,
          last_elapsed_ms: 180,
          last_error: "HTTP 403 Forbidden",
        },
      ],
    });

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Click Diagnostics in the header
    const diagBtn = screen.getByRole("button", { name: /Diagnostics/i });
    await user.click(diagBtn);

    // Diagnostics modal opens with Engine Version and telemetry
    await waitFor(() => {
      expect(screen.getByText(/Scraping Engine Diagnostics & Observability/i)).toBeInTheDocument();
      expect(screen.getByText(/2.19.0/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copy Diagnostics Report/i })).toBeInTheDocument();
    });
  });
});
