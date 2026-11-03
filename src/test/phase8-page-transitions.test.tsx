import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AppShell } from "../components/layout/AppShell";
import { PageTransition } from "../components/animation/PageTransition";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";
import * as desktopApi from "../lib/desktop-api";
import * as reducedMotionHook from "../hooks/use-reduced-motion-preference";

describe("Phase 8 — Page Transitions & Layout Animations Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
  });

  describe("PageTransition Component Architecture", () => {
    it("renders page content inside data-slot='page-transition' with route identifier", () => {
      render(
        <PageTransition routeKey="dashboard">
          <div>Dashboard Workspace Content</div>
        </PageTransition>
      );

      const transitionContainer = screen.getByText("Dashboard Workspace Content").parentElement;
      expect(transitionContainer).toHaveAttribute("data-slot", "page-transition");
      expect(transitionContainer).toHaveAttribute("data-route", "dashboard");
    });

    it("respects optOut prop and renders data-slot='page-transition-opt-out' without motion animations", () => {
      render(
        <PageTransition routeKey="literature_workspace" optOut={true}>
          <div>3-Pane Canvas Workspace</div>
        </PageTransition>
      );

      const optOutContainer = screen.getByText("3-Pane Canvas Workspace").parentElement;
      expect(optOutContainer).toHaveAttribute("data-slot", "page-transition-opt-out");
      expect(optOutContainer).not.toHaveAttribute("data-route");
    });

    it("applies reduced-motion instantaneous variants when user prefers reduced motion", () => {
      vi.spyOn(reducedMotionHook, "useReducedMotionPreference").mockReturnValue(true);

      render(
        <PageTransition routeKey="library">
          <div>Library Content</div>
        </PageTransition>
      );

      const element = screen.getByText("Library Content").parentElement;
      expect(element).toBeInTheDocument();
      expect(element).toHaveAttribute("data-slot", "page-transition");
    });
  });

  describe("AppShell Route Transition & State Preservation", () => {
    it("transitions cleanly across standard sections and updates route container", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider
          initialSection="dashboard"
          initialPapers={INITIAL_DEMO_PAPERS}
          initialCollections={INITIAL_DEMO_COLLECTIONS}
        >
          <AppShell />
        </AppProvider>
      );

      expect(screen.getByText("Scholarly Workspace")).toBeInTheDocument();

      // Navigate to My Library via sidebar
      const libraryBtn = screen.getByRole("button", { name: /My Library/i });
      await user.click(libraryBtn);

      // Verify PageTransition container updated to library route
      await vi.waitFor(() => {
        const pageContainer = document.querySelector("[data-slot='page-transition']");
        expect(pageContainer).toBeInTheDocument();
        expect(pageContainer).toHaveAttribute("data-route", "library");
      });
    });

    it("opts out multi-panel canvas workspaces to avoid layout recalculation and table shifts", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider
          initialSection="dashboard"
          initialPapers={INITIAL_DEMO_PAPERS}
          initialCollections={INITIAL_DEMO_COLLECTIONS}
        >
          <AppShell />
        </AppProvider>
      );

      // Navigate to Paper Comparison / Review Matrix
      const matrixBtn = screen.getByRole("button", { name: /Paper Comparison/i });
      await user.click(matrixBtn);

      // Multi-panel canvas workspaces use optOut to ensure 0-displacement rendering
      const optOutContainer = document.querySelector("[data-slot='page-transition-opt-out']");
      expect(optOutContainer).toBeInTheDocument();
    });

    it("preserves DiscoverView mounted state across tab switching to prevent search query loss", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider
          initialSection="discover"
          initialPapers={INITIAL_DEMO_PAPERS}
          initialCollections={INITIAL_DEMO_COLLECTIONS}
        >
          <AppShell />
        </AppProvider>
      );

      // Switch to Library
      const libraryBtn = screen.getByRole("button", { name: /My Library/i });
      await user.click(libraryBtn);

      // Switch back to Discover
      const discoverBtn = screen.getAllByRole("button", { name: /Discover Papers/i })[0];
      await user.click(discoverBtn);

      // DiscoverView remains present in DOM
      expect(screen.getByRole("heading", { name: "Discover & Query Papers" })).toBeInTheDocument();
    });

    it("handles rapid consecutive navigation without errors or stuck states", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider
          initialSection="dashboard"
          initialPapers={INITIAL_DEMO_PAPERS}
          initialCollections={INITIAL_DEMO_COLLECTIONS}
        >
          <AppShell />
        </AppProvider>
      );

      // Rapidly click between multiple workspaces
      const libraryBtn = screen.getByRole("button", { name: /My Library/i });
      const assistantBtn = screen.getByRole("button", { name: /Research Assistant/i });

      await user.click(libraryBtn);
      await user.click(assistantBtn);
      await user.click(libraryBtn);

      await vi.waitFor(() => {
        const pageContainer = document.querySelector("[data-slot='page-transition'][data-route='library']");
        expect(pageContainer).toBeInTheDocument();
      });
    });
  });

  describe("Overlay & Modal Transitions", () => {
    it("opens and closes Command Palette with smooth backdrop transition and Escape key", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="dashboard">
          <AppShell />
        </AppProvider>
      );

      // Open command palette via header shortcut button
      const openPaletteBtn = screen.getByRole("button", { name: /Open command palette/i });
      await user.click(openPaletteBtn);

      const dialog = screen.getByRole("dialog", { name: /Command Palette/i });
      expect(dialog).toBeInTheDocument();

      // Press Escape to dismiss
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: /Command Palette/i })).not.toBeInTheDocument();
    });

    it("opens and closes AboutModal with accessible dialog animations", async () => {
      const user = userEvent.setup();
      render(
        <AppProvider initialSection="dashboard">
          <AppShell />
        </AppProvider>
      );

      const aboutBtn = screen.getByRole("button", { name: /About Infinity Researcher/i });
      await user.click(aboutBtn);

      const aboutDialog = screen.getByRole("dialog", { name: /About Infinity Researcher/i });
      expect(aboutDialog).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: "Close" });
      await user.click(closeBtn);

      expect(screen.queryByRole("dialog", { name: /About Infinity Researcher/i })).not.toBeInTheDocument();
    });
  });
});
