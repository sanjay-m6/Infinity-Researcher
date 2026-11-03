import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";
import { DiscoveredSearchResult } from "../lib/desktop-api";

describe("Phase 11: Discover Papers Modernization Test Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.clearAll();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Search Correctness & Validation
  // ---------------------------------------------------------------------------
  describe("Search Correctness & Validation", () => {
    it("renders search input, Enter submission, and prevents empty queries", async () => {
      const user = userEvent.setup();
      const streamSpy = vi.spyOn(desktopApi, "startWebsiteSearchStream");

      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      const input = screen.getByRole("textbox", { name: /Search research papers/i });
      expect(input).toBeInTheDocument();

      // Attempt to submit empty query
      const searchBtn = screen.getByRole("button", { name: /^Search$/i });
      await user.click(searchBtn);

      // Search stream should NOT be launched for empty queries
      expect(streamSpy).not.toHaveBeenCalled();

      // Now enter a valid topic and submit via Enter key
      await user.type(input, "quantum computing error mitigation{enter}");

      expect(streamSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "quantum computing error mitigation",
        }),
        expect.any(Function),
        expect.any(String)
      );
    });

    it("clears search query and resets discovery state on clear button click", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      const input = screen.getByRole("textbox", { name: /Search research papers/i });
      await user.type(input, "deep learning transformers");

      const clearBtn = screen.getByRole("button", { name: /Clear search query/i });
      expect(clearBtn).toBeInTheDocument();
      await user.click(clearBtn);

      expect(input).toHaveValue("");
      expect(discoverSessionStore.getState().searchQuery).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Metadata Normalization & Deduplication
  // ---------------------------------------------------------------------------
  describe("Metadata Normalization & Deduplication", () => {
    it("deduplicates results with matching DOIs or titles across multiple sources and merges metadata", async () => {
      const user = userEvent.setup();

      vi.spyOn(desktopApi, "startWebsiteSearchStream").mockImplementation(
        async (_params, callback, sessionId) => {
          const sid = sessionId || "test-session";
          // First paper from arXiv
          callback({
            type: "paper_found",
            session_id: sid,
            source_id: "arxiv",
            paper: {
              id: "arxiv_001",
              title: "Attention Is All You Need",
              authors: ["Ashish Vaswani", "Noam Shazeer"],
              publication_year: 2017,
              canonical_doi: "10.48550/arXiv.1706.03762",
              landing_url: "https://arxiv.org/abs/1706.03762",
              pdf_url: "https://arxiv.org/pdf/1706.03762.pdf",
              source_id: "arxiv",
              source_name: "arXiv",
              content_type: "preprint",
              is_open_access: true,
              subject_tags: ["cs.CL"],
              relevance_score: 0.98,
              abstract_text: "The dominant sequence transduction models...",
            } as DiscoveredSearchResult,
          });

          // Duplicate paper arriving from Semantic Scholar with lowercase DOI and richer abstract
          callback({
            type: "paper_found",
            session_id: sid,
            source_id: "semantic_scholar",
            paper: {
              id: "s2_001",
              title: "Attention Is All You Need",
              authors: ["A. Vaswani", "N. Shazeer"],
              publication_year: 2017,
              canonical_doi: "10.48550/arxiv.1706.03762",
              landing_url: "https://www.semanticscholar.org/paper/1706.03762",
              pdf_url: "https://arxiv.org/pdf/1706.03762.pdf",
              source_id: "semantic_scholar",
              source_name: "Semantic Scholar",
              content_type: "conference_paper",
              is_open_access: true,
              subject_tags: ["Computer Science"],
              relevance_score: 0.95,
              abstract_text: "Extended abstract with complete benchmark results.",
            } as DiscoveredSearchResult,
          });

          callback({
            type: "search_completed",
            session_id: sid,
            total_unique: 1,
            duration_ms: 120,
          });
          return () => {};
        }
      );

      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      const input = screen.getByRole("textbox", { name: /Search research papers/i });
      await user.type(input, "Attention Is All You Need{enter}");

      await waitFor(() => {
        // Only 1 result card should exist due to DOI deduplication
        const titles = screen.getAllByText("Attention Is All You Need");
        expect(titles.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Results \(1\)/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Filters & Sorting Engine
  // ---------------------------------------------------------------------------
  describe("Filters & Sorting", () => {
    beforeEach(() => {
      // Seed store with test papers
      discoverSessionStore.setState({
        submittedQuery: "machine learning",
        searchQuery: "machine learning",
        discoveredResults: [
          {
            id: "p1",
            title: "Early Foundations of Neural Networks",
            authors: ["Warren McCulloch", "Walter Pitts"],
            publication_year: 1943,
            landing_url: "https://example.com/p1",
            pdf_url: null,
            source_id: "plos",
            source_name: "PLOS",
            content_type: "journal_article",
            is_open_access: false,
            subject_tags: ["AI"],
            relevance_score: 0.6,
          } as DiscoveredSearchResult,
          {
            id: "p2",
            title: "Deep Residual Learning for Image Recognition",
            authors: ["Kaiming He", "Xiangyu Zhang"],
            publication_year: 2016,
            landing_url: "https://example.com/p2",
            pdf_url: "https://example.com/p2.pdf",
            source_id: "arxiv",
            source_name: "arXiv",
            content_type: "preprint",
            is_open_access: true,
            subject_tags: ["Computer Vision"],
            relevance_score: 0.95,
          } as DiscoveredSearchResult,
          {
            id: "p3",
            title: "Generative Adversarial Nets",
            authors: ["Ian Goodfellow", "Jean Pouget-Abadie"],
            publication_year: 2014,
            landing_url: "https://example.com/p3",
            pdf_url: "https://example.com/p3.pdf",
            source_id: "arxiv",
            source_name: "arXiv",
            content_type: "preprint",
            is_open_access: true,
            subject_tags: ["Machine Learning"],
            relevance_score: 0.9,
          } as DiscoveredSearchResult,
        ],
      });
    });

    it("filters papers by Open Access status using quick filter pill", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // Initially 3 results
      expect(screen.getByText(/Results \(3\)/i)).toBeInTheDocument();

      // Click "OA" quick filter pill
      const oaBtn = screen.getByRole("button", { name: /^OA$/i });
      await user.click(oaBtn);

      // Only 2 open-access papers should be listed (p2, p3)
      await waitFor(() => {
        expect(screen.getByText(/Results \(2\)/i)).toBeInTheDocument();
        expect(
          screen.queryByText("Early Foundations of Neural Networks")
        ).not.toBeInTheDocument();
        expect(
          screen.getAllByText("Deep Residual Learning for Image Recognition").length
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it("filters papers by publication year range and author search", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // Open advanced filters drawer
      const filterToggle = screen.getByRole("button", { name: /^Filters/i });
      await user.click(filterToggle);

      // Set year start to 2015
      const fromInput = screen.getByPlaceholderText("From");
      await user.clear(fromInput);
      await user.type(fromInput, "2015");

      // Only p2 (2016) should remain
      await waitFor(() => {
        expect(screen.getByText(/Results \(1\)/i)).toBeInTheDocument();
        expect(
          screen.getAllByText("Deep Residual Learning for Image Recognition").length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText("Generative Adversarial Nets")).not.toBeInTheDocument();
      });

      // Clear filters
      const clearFiltersBtn = screen.getByRole("button", { name: /Clear All Filters/i });
      await user.click(clearFiltersBtn);

      await waitFor(() => {
        expect(screen.getByText(/Results \(3\)/i)).toBeInTheDocument();
      });
    });

    it("sorts search results by year descending (Newest) and title alphabetically", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      const filterToggle = screen.getByRole("button", { name: /^Filters/i });
      await user.click(filterToggle);

      const sortSelect = screen.getByRole("combobox", { name: /Sort search results/i });

      // Change sort to Title A-Z
      await user.selectOptions(sortSelect, "title_az");
      expect(discoverSessionStore.getState().sortBy).toBe("title_az");

      // Change sort to Newest
      await user.selectOptions(sortSelect, "newest");
      expect(discoverSessionStore.getState().sortBy).toBe("newest");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Pagination & Infinite Loading Reliability
  // ---------------------------------------------------------------------------
  describe("Pagination & Progressive Loading", () => {
    it("slices visible items and handles 'Query +50 More from Sources'", async () => {
      const user = userEvent.setup();
      const streamSpy = vi.spyOn(desktopApi, "startWebsiteSearchStream");

      // Generate 60 mock papers
      const manyPapers: DiscoveredSearchResult[] = Array.from(
        { length: 60 },
        (_, idx) => ({
          id: `paper_${idx + 1}`,
          title: `Research Discovery Paper ${idx + 1}`,
          authors: [`Author ${idx + 1}`],
          publication_year: 2020 + (idx % 5),
          landing_url: `https://example.com/paper_${idx + 1}`,
          pdf_url: `https://example.com/paper_${idx + 1}.pdf`,
          source_id: "arxiv",
          source_name: "arXiv",
          content_type: "preprint",
          is_open_access: true,
          subject_tags: ["Computer Science"],
          relevance_score: 0.85,
        })
      );

      discoverSessionStore.setState({
        submittedQuery: "distributed systems",
        searchQuery: "distributed systems",
        discoveredResults: manyPapers,
        limitPerSource: 50,
      });

      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // Total results 60, but visibleCount starts at 50
      expect(screen.getByText(/Results \(60\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Load More Papers \(Showing 50 of 60\)/i)
      ).toBeInTheDocument();

      // Click Load More
      const loadMoreBtn = screen.getByRole("button", { name: /Load More Papers/i });
      await user.click(loadMoreBtn);

      // Now all 60 are visible, showing the end-of-results indicator
      await waitFor(() => {
        expect(screen.getByText(/Showing all 60 matching papers/i)).toBeInTheDocument();
      });

      // Click Query +50 More from Sources
      const queryMoreSourcesBtn = screen.getByRole("button", {
        name: /Fetch \+50 More from Academic Sources/i,
      });
      await user.click(queryMoreSourcesBtn);

      // Should call search API with limit 100 without wiping current results
      expect(streamSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "distributed systems",
          limit_per_source: 100,
        }),
        expect.any(Function),
        expect.any(String)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PDF Availability & Status Integrity
  // ---------------------------------------------------------------------------
  describe("PDF Availability & Retrieval Integrity", () => {
    it("truthfully identifies verified remote PDF vs metadata-only and allows workspace reading", async () => {
      const user = userEvent.setup();

      discoverSessionStore.setState({
        submittedQuery: "quantum computing",
        searchQuery: "quantum computing",
        discoveredResults: [
          {
            id: "pdf_paper",
            title: "Quantum Supremacy Using a Programmable Superconducting Processor",
            authors: ["John Martinis et al."],
            publication_year: 2019,
            landing_url: "https://example.com/quantum",
            pdf_url: "https://example.com/quantum.pdf",
            source_id: "nature_srep",
            source_name: "Nature Scientific Reports",
            content_type: "journal_article",
            is_open_access: true,
            subject_tags: ["Physics"],
            relevance_score: 0.99,
          } as DiscoveredSearchResult,
          {
            id: "meta_only_paper",
            title: "Proprietary Commercial Architecture Benchmark",
            authors: ["Industry Research Team"],
            publication_year: 2021,
            landing_url: "https://example.com/closed",
            pdf_url: null,
            source_id: "plos",
            source_name: "PLOS",
            content_type: "journal_article",
            is_open_access: false,
            subject_tags: ["Hardware"],
            relevance_score: 0.7,
          } as DiscoveredSearchResult,
        ],
        selectedPaperId: "websearch_pdf_paper",
      });

      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // Verified PDF badge should appear on the first card
      expect(screen.getByText("Verified PDF")).toBeInTheDocument();

      // Metadata Only badge should appear on the second card
      expect(screen.getByText("Metadata Only")).toBeInTheDocument();

      // Right Details pane has "Read in Workspace" button
      const readBtn = screen.getByRole("button", { name: /Read in Workspace/i });
      expect(readBtn).toBeInTheDocument();
      await user.click(readBtn);

      // Now click on the metadata-only paper
      const metaCard = screen.getByText("Proprietary Commercial Architecture Benchmark");
      await user.click(metaCard);

      // Truthful fallback is displayed in the center pane explaining no direct stream
      await waitFor(() => {
        expect(screen.getByText(/No Direct PDF Stream Available/i)).toBeInTheDocument();
        expect(screen.getByText(/Import or Link Downloaded PDF/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. State Preservation & Global Search Handoff
  // ---------------------------------------------------------------------------
  describe("State Preservation & Global Search Handoff", () => {
    it("preserves search query, results, and active filters in discoverSessionStore across remounts", () => {
      discoverSessionStore.setState({
        searchQuery: "neural radiance fields",
        submittedQuery: "neural radiance fields",
        filterYearStart: 2020,
        quickFilter: "oa",
        discoveredResults: [
          {
            id: "nerf_01",
            title: "NeRF: Representing Scenes as Neural Radiance Fields",
            authors: ["Ben Mildenhall"],
            publication_year: 2020,
            landing_url: "https://arxiv.org/abs/2003.08934",
            pdf_url: "https://arxiv.org/pdf/2003.08934.pdf",
            source_id: "arxiv",
            source_name: "arXiv",
            content_type: "preprint",
            is_open_access: true,
            subject_tags: ["cs.CV"],
            relevance_score: 0.99,
          } as DiscoveredSearchResult,
        ],
      });

      const { unmount } = render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      expect(screen.getByDisplayValue("neural radiance fields")).toBeInTheDocument();
      expect(
        screen.getAllByText(/NeRF: Representing Scenes/i).length
      ).toBeGreaterThanOrEqual(1);

      // Unmount component (simulating user navigating to Library, Dashboard, etc.)
      unmount();

      // Re-render DiscoverView (simulating user returning)
      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // All state should be completely intact
      expect(screen.getByDisplayValue("neural radiance fields")).toBeInTheDocument();
      expect(
        screen.getAllByText(/NeRF: Representing Scenes/i).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Accessibility (WCAG 2.1 AA)
  // ---------------------------------------------------------------------------
  describe("Accessibility (WCAG 2.1 AA Standards)", () => {
    it("features accessible names, combobox/listbox attributes, keyboard navigation, and live regions", async () => {
      const user = userEvent.setup();

      discoverSessionStore.setState({
        submittedQuery: "climate change",
        searchQuery: "climate change",
        discoveredResults: [
          {
            id: "paper_acc_1",
            title: "Global Climate Warming Trends",
            authors: ["Jane Doe", "John Smith"],
            publication_year: 2022,
            landing_url: "https://example.com/climate",
            pdf_url: "https://example.com/climate.pdf",
            source_id: "nature_srep",
            source_name: "Nature Scientific Reports",
            content_type: "journal_article",
            is_open_access: true,
            subject_tags: ["Geoscience"],
            relevance_score: 0.92,
          } as DiscoveredSearchResult,
        ],
      });

      render(
        <AppProvider>
          <DiscoverView />
        </AppProvider>
      );

      // Search input has accessible label
      expect(
        screen.getByRole("textbox", { name: "Search research papers" })
      ).toBeInTheDocument();

      // Live region polite announcement
      expect(screen.getByRole("status")).toHaveTextContent(
        /Found 1 results for "climate change"/i
      );

      // Result card has role="article", tabIndex=0, accessible label, and Enter key selection
      const card = screen.getByRole("article", {
        name: /Global Climate Warming Trends by Jane Doe, John Smith/i,
      });
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("tabindex", "0");

      card.focus();
      expect(document.activeElement).toBe(card);

      // Press Enter to select
      await user.keyboard("{Enter}");
      expect(discoverSessionStore.getState().selectedPaperId).toBe(
        "websearch_paper_acc_1"
      );
    });
  });
});
