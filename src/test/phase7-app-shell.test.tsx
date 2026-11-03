import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { Sidebar } from "../components/layout/Sidebar";
import { Toolbar } from "../components/layout/Toolbar";
import { AppShell } from "../components/layout/AppShell";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";
import * as desktopApi from "../lib/desktop-api";

describe("Phase 7 — App Shell & Navigation Modernization Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
  });

  describe("Sidebar Navigation Rail & Category Sub-Navigation", () => {
    it("renders the primary rail with all 4 navigation categories and brand button", () => {
      render(
        <AppProvider
          initialPapers={INITIAL_DEMO_PAPERS}
          initialCollections={INITIAL_DEMO_COLLECTIONS}
        >
          <Sidebar />
        </AppProvider>
      );

      // Brand about button
      expect(
        screen.getByRole("button", { name: /About Infinity Researcher/i })
      ).toBeInTheDocument();

      // Primary rail category buttons with aria-label and titles
      expect(
        screen.getByRole("button", { name: /Research navigation group/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /AI Tools navigation group/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Workspace navigation group/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /System navigation group/i })
      ).toBeInTheDocument();
    });

    it("displays active indicator line and aria-current='page' on the active category rail button", () => {
      render(
        <AppProvider initialSection="discover">
          <Sidebar />
        </AppProvider>
      );

      const researchCatBtn = screen.getByRole("button", {
        name: /Research navigation group/i,
      });
      expect(researchCatBtn).toHaveAttribute("aria-current", "page");

      const aiToolsCatBtn = screen.getByRole("button", {
        name: /AI Tools navigation group/i,
      });
      expect(aiToolsCatBtn).not.toHaveAttribute("aria-current");
    });

    it("switches category and displays associated sub-navigation items", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="discover">
          <Sidebar />
        </AppProvider>
      );

      // Default shows RESEARCH subnav
      expect(screen.getByText("RESEARCH")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Discover Papers/i })
      ).toBeInTheDocument();

      // Click AI Tools category in primary rail
      const aiToolsBtn = screen.getByRole("button", {
        name: /AI Tools navigation group/i,
      });
      await user.click(aiToolsBtn);

      expect(screen.getAllByText("AI TOOLS").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("button", { name: /AI Tools Hub/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Citation Checker/i })
      ).toBeInTheDocument();
    });

    it("supports keyboard arrow navigation (ArrowDown / ArrowUp) across sub-navigation buttons", async () => {
      render(
        <AppProvider initialSection="discover">
          <Sidebar />
        </AppProvider>
      );

      const discoverBtn = screen.getByRole("button", { name: /Discover Papers/i });
      discoverBtn.focus();
      expect(discoverBtn).toHaveFocus();

      // Arrow down should focus the next subnav item
      fireEvent.keyDown(discoverBtn, { key: "ArrowDown" });
      const litWorkspaceBtn = screen.getByRole("button", {
        name: /Literature Workspace/i,
      });
      expect(litWorkspaceBtn).toHaveFocus();

      // Arrow up should wrap back to the previous item
      fireEvent.keyDown(litWorkspaceBtn, { key: "ArrowUp" });
      expect(discoverBtn).toHaveFocus();
    });

    it("collapses and re-expands the secondary panel using the toggle button and persists state", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="discover">
          <Sidebar />
        </AppProvider>
      );

      const collapseBtn = screen.getByRole("button", {
        name: /Collapse category panel/i,
      });
      expect(collapseBtn).toBeInTheDocument();

      await user.click(collapseBtn);

      // Panel collapsed: localStorage updated and expand button available on rail
      expect(localStorage.getItem("infinity_sidebar_v3_secondary_collapsed")).toBe(
        "true"
      );
      const expandBtn = screen.getByRole("button", { name: /Expand sidebar panel/i });
      expect(expandBtn).toBeInTheDocument();

      // Clicking expand restores panel
      await user.click(expandBtn);
      expect(localStorage.getItem("infinity_sidebar_v3_secondary_collapsed")).toBe(
        "false"
      );
      expect(screen.getByText("RESEARCH")).toBeInTheDocument();
    });
  });

  describe("Toolbar & Header Modernization", () => {
    it("renders dynamic breadcrumbs with category button and active page title", () => {
      render(
        <AppProvider initialSection="discover">
          <Toolbar />
        </AppProvider>
      );

      const breadcrumbNav = screen.getByRole("navigation", { name: /Breadcrumbs/i });
      expect(breadcrumbNav).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Research" })).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Discover & Query Papers" })
      ).toBeInTheDocument();
    });

    it("renders search bar with input, keyboard shortcut badge, and clear button", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="discover">
          <Toolbar />
        </AppProvider>
      );

      const searchInput = screen.getByRole("searchbox", {
        name: /Search papers across all sources/i,
      });
      expect(searchInput).toBeInTheDocument();

      // Shortcut badge exists
      expect(
        screen.getByRole("button", { name: /Open command palette/i })
      ).toBeInTheDocument();

      // Type in search input
      await user.type(searchInput, "Machine learning");
      expect(searchInput).toHaveValue("Machine learning");

      // Clear button appears
      const clearBtn = screen.getByRole("button", { name: /Clear search query/i });
      expect(clearBtn).toBeInTheDocument();

      await user.click(clearBtn);
      expect(searchInput).toHaveValue("");
    });

    it("submits search query and triggers global search", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="dashboard">
          <Toolbar />
        </AppProvider>
      );

      const searchInput = screen.getByRole("searchbox", {
        name: /Search papers across all sources/i,
      });
      await user.type(searchInput, "Quantum computing{enter}");

      // Input clears after submit
      expect(searchInput).toHaveValue("");
    });

    it("displays active download jobs pill when background jobs are active", () => {
      const activeJob = {
        id: "job-1",
        paperId: "p-1",
        paperTitle: "Attention Is All You Need",
        sourceName: "arXiv",
        jobType: "pdf_download" as const,
        status: "running" as const,
        progressPercent: 45,
        stageMessage: "Downloading PDF...",
        startedAt: new Date().toISOString(),
      };

      render(
        <AppProvider initialJobs={[activeJob]}>
          <Toolbar />
        </AppProvider>
      );

      expect(
        screen.getByRole("button", { name: /1 active download jobs/i })
      ).toBeInTheDocument();
    });

    it("renders segmented theme selector with light, dark, and system options", () => {
      render(
        <AppProvider>
          <Toolbar />
        </AppProvider>
      );

      expect(
        screen.getByRole("radiogroup", { name: /Theme mode selector/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Light mode/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dark mode/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /System theme/i })).toBeInTheDocument();
    });
  });

  describe("AppShell Layout Architecture", () => {
    it("renders TitleBar, Sidebar, Toolbar, Main Canvas, and BottomBar in unified shell", () => {
      const { container } = render(
        <AppProvider initialSection="dashboard">
          <AppShell />
        </AppProvider>
      );

      expect(
        screen.getByRole("banner", { name: /Window title bar/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("complementary", { name: /Main Sidebar/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("navigation", { name: /Breadcrumbs/i })
      ).toBeInTheDocument();
      expect(container.querySelector("main#main-content")).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("renders full-bleed layout for discovery and canvas-oriented workspaces", () => {
      const { container } = render(
        <AppProvider initialSection="discover">
          <AppShell />
        </AppProvider>
      );

      const main = container.querySelector("main#main-content");
      expect(main).toBeInTheDocument();
      expect(main).toHaveClass("overflow-hidden", "p-0");
    });
  });
});
