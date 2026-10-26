import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";
import * as desktopApi from "../lib/desktop-api";

describe("Query-First Academic Discovery & Advanced Filters (Part J)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Discover starts with a prominent query input and no URL required to search", () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Primary search input is present with exact requested placeholder
    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    expect(queryInput).toBeInTheDocument();

    // Prominent Search button is present
    expect(screen.getByRole("button", { name: /^Search$/i })).toBeInTheDocument();

    // Source Selector trigger is present showing count
    expect(screen.getByRole("button", { name: /Sources \(/i })).toBeInTheDocument();

    // Advanced Filters toggle is present
    expect(screen.getByRole("button", { name: /Filters/i })).toBeInTheDocument();
  });

  it("executes query-based search when typing keywords and pressing Enter or Search", async () => {
    const user = userEvent.setup();
    const streamSpy = vi.spyOn(desktopApi, "startWebsiteSearchStream");

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "machine learning for medical image segmentation");

    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    // Assert streaming search API was called with the topic query and no seed URL was required
    expect(streamSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "machine learning for medical image segmentation",
      }),
      expect.any(Function),
      expect.any(String)
    );

    // Verify discovered search result cards stream into the list
    await waitFor(() => {
      expect(
        screen.getAllByText(/Simulated Research on machine learning for medical image segmentation/i).length
      ).toBeGreaterThan(0);
    });

    // Check recent search is persisted and displayed
    expect(
      screen.getByRole("button", { name: /machine learning for medical image segmentation/i })
    ).toBeInTheDocument();
  });

  it("handles empty query validation politely without sending requests", async () => {
    const user = userEvent.setup();
    const searchSpy = vi.spyOn(desktopApi, "searchWebsiteSources");

    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const searchBtn = screen.getByRole("button", { name: /^Search$/i });
    await user.click(searchBtn);

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("opens Sources selector and shows policy status badges for supported and restricted repositories", async () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const sourcesTrigger = screen.getByTestId("sources-trigger");
    fireEvent.click(sourcesTrigger);

    // Check popover content
    expect(screen.getByText("Academic Sources")).toBeInTheDocument();
    expect(screen.getAllByText(/^Policy Checked$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Manual Only$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disabled$/i)).toBeInTheDocument();
    expect(screen.getByText("Google Scholar")).toBeInTheDocument();
  });

  it("expands filters panel, applies publication year and content type, and resets via Clear all", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const filtersBtn = screen.getByRole("button", { name: /Filters/i });
    await user.click(filtersBtn);

    // Verify filter fields
    expect(screen.getByPlaceholderText(/^From$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^To$/i)).toBeInTheDocument();

    // Click quick year filter "3y"
    const quickYearBtn = screen.getByRole("button", { name: /3y/i });
    await user.click(quickYearBtn);

    // Verify Clear All Filters button appears
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Clear All Filters/i })).toBeInTheDocument();
    });

    // Click Clear All
    await user.click(screen.getByRole("button", { name: /Clear All Filters/i }));

    const fromInput = screen.getByPlaceholderText(/^From$/i) as HTMLInputElement;
    expect(fromInput.value).toBe("");
  });

  it("distinguishes Open Access badge from direct PDF found state in discovered papers", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Perform query search
    const queryInput = screen.getByPlaceholderText(
      /Search by topic, title, author, keyword, or phrase…/i
    );
    await user.type(queryInput, "segmentation");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    await waitFor(() => {
      // OA badge is present
      expect(screen.getAllByText(/^OA$/i).length).toBeGreaterThan(0);
      // PDF Available / Found badge is distinct
      expect(screen.getAllByText(/PDF Found/i).length).toBeGreaterThan(0);
    });
  });
});
