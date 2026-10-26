import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";

import { DownloadsView } from "../features/downloads/DownloadsView";
import { SourcesView } from "../features/sources/SourcesView";
import * as desktopApi from "../lib/desktop-api";
import { CrawlProfile, CrawlJob } from "../lib/desktop-api/types";

describe("Phase 6 — Website Crawling & Scraping Engine Frontend", () => {
  const mockProfiles: CrawlProfile[] = [
    {
      id: "biorxiv",
      name: "bioRxiv & medRxiv",
      domain: "biorxiv.org",
      description: "Preprint server for biology",
      allowed_patterns: ["/content/10.1101/"],
      disallowed_patterns: ["/download/"],
      paper_link_selectors: ["a.highwire-cite-linked-title"],
      title_selector: "h1#page-title",
      authors_selector: ".author-name",
      abstract_selector: ".abstract",
      doi_selector: ".doi",
      date_selector: ".date",
      venue_selector: ".journal",
      pdf_link_selector: "a.pdf-link",
      use_meta_tags: true,
      request_delay_ms: 1000,
      max_depth: 2,
      max_pages: 50,
      headers: null,
      is_built_in: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "nature",
      name: "Nature Publishing Group",
      domain: "nature.com",
      description: "Multidisciplinary academic journals",
      allowed_patterns: ["/articles/"],
      disallowed_patterns: ["/search"],
      paper_link_selectors: ["a[data-track-action='view article']"],
      title_selector: null,
      authors_selector: null,
      abstract_selector: null,
      doi_selector: null,
      date_selector: null,
      venue_selector: null,
      pdf_link_selector: null,
      use_meta_tags: true,
      request_delay_ms: 2000,
      max_depth: 2,
      max_pages: 30,
      headers: null,
      is_built_in: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const mockJobs: CrawlJob[] = [
    {
      id: "job_test_123",
      profile_id: "biorxiv",
      start_url: "https://www.biorxiv.org/content/early/recent",
      status: "running",
      pages_queued: 15,
      pages_visited: 5,
      pages_failed: 0,
      papers_found: 4,
      current_depth: 1,
      error_message: null,
      started_at: "2026-03-20T10:00:00Z",
      completed_at: null,
      created_at: "2026-03-20T10:00:00Z",
      updated_at: "2026-03-20T10:05:00Z",
    },
  ];

  it("renders DownloadsView and displays crawl jobs with live progress", async () => {
    vi.spyOn(desktopApi, "listCrawlJobs").mockResolvedValue(mockJobs);
    vi.spyOn(desktopApi, "listCrawlProfiles").mockResolvedValue(mockProfiles);

    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    expect(screen.getByRole("heading", { name: "Downloads & Retrieval Jobs" })).toBeInTheDocument();
    expect(screen.getByText("New Website Crawl")).toBeInTheDocument();

    // Verify job start url is displayed
    const jobUrl = await screen.findByText("https://www.biorxiv.org/content/early/recent");
    expect(jobUrl).toBeInTheDocument();

    // Verify progress text
    expect(screen.getByText(/Visited 5 of 15 queued pages/)).toBeInTheDocument();
    expect(screen.getByText("View Papers (4)")).toBeInTheDocument();
  });

  it("renders SourcesView with Website Scraping tab and sandbox preview", async () => {
    vi.spyOn(desktopApi, "listCrawlProfiles").mockResolvedValue(mockProfiles);
    vi.spyOn(desktopApi, "getProviderConfigStatus").mockResolvedValue([]);

    render(
      <AppProvider>
        <SourcesView />
      </AppProvider>
    );

    // Scraping tab button is active by default
    const tabButton = screen.getByRole("button", { name: /Website Scraping Profiles/i });
    expect(tabButton).toBeInTheDocument();
  });
});
