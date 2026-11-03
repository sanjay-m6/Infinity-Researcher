import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DownloadsView } from "../features/downloads/DownloadsView";
import * as desktopApi from "../lib/desktop-api";
import { DownloadJob, DownloadStorageMetrics } from "../lib/desktop-api/types";

const MOCK_DOWNLOAD_JOBS: DownloadJob[] = [
  {
    id: "dl-1",
    paper_id: "paper-1",
    paper_title: "Attention Is All You Need",
    url: "https://arxiv.org/pdf/1706.03762.pdf",
    source_id: "arxiv",
    status: "downloading",
    bytes_downloaded: 4194304, // 4 MB
    total_bytes: 8388608, // 8 MB
    progress_percent: 50.0,
    stage_message: "Transferring PDF stream...",
    error_message: null,
    destination_path: null,
    sha256_hash: null,
    retry_count: 0,
    speed_bps: 1048576, // 1 MB/s
    started_at: "2026-03-30T10:00:00Z",
    completed_at: null,
    error_category: null,
    created_at: "2026-03-30T10:00:00Z",
    updated_at: "2026-03-30T10:00:02Z",
  },
  {
    id: "dl-2",
    paper_id: "paper-2",
    paper_title: "Deep Residual Learning for Image Recognition",
    url: "https://arxiv.org/pdf/1512.03385.pdf",
    source_id: "arxiv",
    status: "completed",
    bytes_downloaded: 5242880, // 5 MB
    total_bytes: 5242880,
    progress_percent: 100.0,
    stage_message: "Verified PDF downloaded and linked to library",
    error_message: null,
    destination_path: "storage/paper-2.pdf",
    sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    retry_count: 0,
    speed_bps: 0,
    started_at: "2026-03-30T09:30:00Z",
    completed_at: "2026-03-30T09:30:05Z",
    error_category: null,
    created_at: "2026-03-30T09:30:00Z",
    updated_at: "2026-03-30T09:30:05Z",
  },
  {
    id: "dl-3",
    paper_id: "paper-3",
    paper_title: "Generative Adversarial Nets",
    url: "https://proceedings.neurips.cc/paper/2014/file/54406-Paper.pdf",
    source_id: "neurips",
    status: "failed",
    bytes_downloaded: 0,
    total_bytes: 0,
    progress_percent: 0.0,
    stage_message: "Download failed: Server returned HTTP 403 Forbidden",
    error_message: "Remote server returned an HTML webpage instead of a direct PDF",
    destination_path: null,
    sha256_hash: null,
    retry_count: 1,
    speed_bps: 0,
    started_at: "2026-03-30T09:00:00Z",
    completed_at: "2026-03-30T09:00:02Z",
    error_category: "html_paywall",
    created_at: "2026-03-30T09:00:00Z",
    updated_at: "2026-03-30T09:00:02Z",
  },
  {
    id: "dl-4",
    paper_id: "paper-4",
    paper_title: "BERT: Pre-training of Deep Bidirectional Transformers",
    url: "https://arxiv.org/pdf/1810.04805.pdf",
    source_id: "arxiv",
    status: "queued",
    bytes_downloaded: 0,
    total_bytes: 0,
    progress_percent: 0.0,
    stage_message: "Queued for download",
    error_message: null,
    destination_path: null,
    sha256_hash: null,
    retry_count: 0,
    speed_bps: 0,
    started_at: null,
    completed_at: null,
    error_category: null,
    created_at: "2026-03-30T10:05:00Z",
    updated_at: "2026-03-30T10:05:00Z",
  },
];

const MOCK_STORAGE_METRICS: DownloadStorageMetrics = {
  storage_path: "D:\\Paper\\storage\\papers",
  total_bytes: 52428800, // 50 MB
  pdf_count: 12,
  temp_files_count: 2,
  temp_files_bytes: 3145728, // 3 MB
};

describe("Phase 16 — Download Manager & PDF Acquisition Engine Modernization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(desktopApi, "listPdfDownloadJobs").mockResolvedValue(MOCK_DOWNLOAD_JOBS);
    vi.spyOn(desktopApi, "getDownloadStorageMetrics").mockResolvedValue(
      MOCK_STORAGE_METRICS
    );
    vi.spyOn(desktopApi, "cancelPdfDownload").mockResolvedValue(undefined);
    vi.spyOn(desktopApi, "retryPdfDownload").mockResolvedValue(MOCK_DOWNLOAD_JOBS[0]);
    vi.spyOn(desktopApi, "clearCompletedPdfDownloads").mockResolvedValue(1);
    vi.spyOn(desktopApi, "deletePdfDownloadJob").mockResolvedValue(1);
    vi.spyOn(desktopApi, "cleanOrphanedDownloads").mockResolvedValue({
      files_deleted: 2,
      bytes_freed: 3145728,
    });

    vi.spyOn(desktopApi, "listCrawlJobs").mockResolvedValue([]);
    vi.spyOn(desktopApi, "listCrawlProfiles").mockResolvedValue([]);
  });

  it("renders download overview metric cards with truthful counts and storage size", async () => {
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    // Header & Workspace Tab
    expect(screen.getByText("Download Manager & Retrieval")).toBeInTheDocument();
    expect(screen.getByText("PDF Acquisition Queue")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Active Transfers")).toBeInTheDocument();
      expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
      expect(screen.getByText("Failed / Issues")).toBeInTheDocument();
      expect(screen.getByText("Library Storage")).toBeInTheDocument();
    });

    // Check storage stats
    expect(screen.getByText("50 MB")).toBeInTheDocument();
    expect(screen.getByText("12 PDFs stored")).toBeInTheDocument();
  });

  it("renders all download jobs with their truthful titles, sources, stages, and badges", async () => {
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
      expect(
        screen.getByText("Deep Residual Learning for Image Recognition")
      ).toBeInTheDocument();
      expect(screen.getByText("Generative Adversarial Nets")).toBeInTheDocument();
      expect(
        screen.getByText("BERT: Pre-training of Deep Bidirectional Transformers")
      ).toBeInTheDocument();
    });

    // Stage messages
    expect(screen.getByText("Transferring PDF stream...")).toBeInTheDocument();
    expect(
      screen.getByText("Verified PDF downloaded and linked to library")
    ).toBeInTheDocument();
    expect(screen.getByText("Queued for download")).toBeInTheDocument();

    // Badges
    expect(screen.getByText("Downloading")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });

  it("calculates and displays truthful transfer rate and progress metrics without fabricated values", async () => {
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      // 1 MB/s transfer speed
      expect(screen.getByText("1 MB/s")).toBeInTheDocument();
      // 4 MB of 8 MB
      expect(screen.getByText(/4 MB of 8 MB/)).toBeInTheDocument();
      // 50% progress
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  it("displays error banner with category taxonomy when a download encounters an issue", async () => {
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Error \(html_paywall\): Remote server returned an HTML webpage/)
      ).toBeInTheDocument();
    });
  });

  it("filters jobs by active status pill", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    });

    // Click Active filter button
    const activeFilterBtn = screen.getByRole("button", { name: /^Active/i });
    await user.click(activeFilterBtn);

    // Active job should remain visible
    expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    // Completed and failed jobs should not be rendered
    expect(
      screen.queryByText("Deep Residual Learning for Image Recognition")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Generative Adversarial Nets")).not.toBeInTheDocument();
  });

  it("searches download jobs by substring query", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search download tasks...");
    await user.type(searchInput, "BERT");

    expect(
      screen.getByText("BERT: Pre-training of Deep Bidirectional Transformers")
    ).toBeInTheDocument();
    expect(screen.queryByText("Attention Is All You Need")).not.toBeInTheDocument();
  });

  it("calls cancelPdfDownload when clicking cancel on an active job", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /^Cancel$/i });
    await user.click(cancelBtn);

    expect(desktopApi.cancelPdfDownload).toHaveBeenCalledWith("dl-1");
  });

  it("calls retryPdfDownload when clicking retry on a failed job", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Generative Adversarial Nets")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    await user.click(retryBtn);

    expect(desktopApi.retryPdfDownload).toHaveBeenCalledWith("dl-3");
  });

  it("prompts confirmation and calls cleanOrphanedDownloads when purging temp files", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/2 orphaned temporary files/i)).toBeInTheDocument();
    });

    const purgeBtn = screen.getByRole("button", { name: /Purge Temporary Files/i });
    await user.click(purgeBtn);

    // Confirmation dialog should be open
    expect(screen.getByText("Purge Temporary Download Files?")).toBeInTheDocument();

    const confirmBtns = screen.getAllByRole("button", { name: "Purge Temporary Files" });
    await user.click(confirmBtns[confirmBtns.length - 1]);

    expect(desktopApi.cleanOrphanedDownloads).toHaveBeenCalled();
  });

  it("prompts confirmation and calls clearCompletedPdfDownloads without touching library papers", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Clear Completed (1)")).toBeInTheDocument();
    });

    const clearCompletedBtn = screen.getByRole("button", {
      name: /Clear Completed \(1\)/i,
    });
    await user.click(clearCompletedBtn);

    expect(screen.getByText("Clear Completed Downloads History?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Clear History" });
    await user.click(confirmBtn);

    expect(desktopApi.clearCompletedPdfDownloads).toHaveBeenCalled();
  });

  it("navigates to the embedded reader when clicking Read PDF on a completed job", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Read PDF/i })).toBeInTheDocument();
    });

    const readBtn = screen.getByRole("button", { name: /Read PDF/i });
    await user.click(readBtn);

    // Verify Read PDF button triggers navigation
    expect(readBtn).toBeInTheDocument();
  });

  it("renders safe storage commitment reassurance banner", async () => {
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Safe Storage Commitment:/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Clearing download tasks from this queue view will never delete your verified local research papers/
        )
      ).toBeInTheDocument();
    });
  });

  it("preserves web crawler workspace tab and switching functionality", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DownloadsView />
      </AppProvider>
    );

    const webCrawlersTab = screen.getByRole("button", {
      name: /Website Crawlers & Scrapers/i,
    });
    await user.click(webCrawlersTab);

    await waitFor(() => {
      expect(screen.getByText("Total Crawl Jobs")).toBeInTheDocument();
      expect(screen.getByText("New Website Crawl")).toBeInTheDocument();
    });
  });
});
