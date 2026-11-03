import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { Sidebar } from "../components/layout/Sidebar";
import { Toolbar } from "../components/layout/Toolbar";
import { AiToolsHubView } from "../features/ai-tools/AiToolsHubView";
import { AiToolWorkspaceView } from "../features/ai-tools/AiToolWorkspaceView";
import { SavedReportsView } from "../features/reports/SavedReportsView";
import { PrivacySecurityView } from "../features/privacy/PrivacySecurityView";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";
import * as desktopApi from "../lib/desktop-api";

describe("Sidebar 03 — Two-Column Sidebar & Clean Navigation Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "listWebsiteSearchSources").mockResolvedValue([]);
  });

  it("renders Two-Column Sidebar with Primary Icon Rail and Category Sub-Navigation Panel", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Sidebar />
      </AppProvider>
    );

    // Primary Rail Category Buttons
    expect(screen.getByTitle(/Research \(Click to open\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/AI Tools \(Click to open\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Workspace \(Click to open\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/System \(Click to open\)/i)).toBeInTheDocument();

    // Secondary Panel items for RESEARCH
    expect(screen.getByRole("button", { name: /Discover Papers/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Library/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Research Assistant/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paper Comparison/i })).toBeInTheDocument();
  });

  it("switches category in secondary panel when clicking Primary Rail icon", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Sidebar />
      </AppProvider>
    );

    // Click AI Tools in primary rail
    const aiToolsBtn = screen.getByTitle(/AI Tools \(Click to open\)/i);
    await user.click(aiToolsBtn);

    // Secondary panel updates to show AI TOOLS
    expect(screen.getByText("AI TOOLS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Tools Hub/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /AI Writing Detector/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Plagiarism Checker/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Humanizer/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Academic Writing Assistant/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Paraphrasing Tool/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Citation Checker/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Readability Analyzer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Research Integrity/i })
    ).toBeInTheDocument();

    // Click Workspace in primary rail
    const workspaceBtn = screen.getByTitle(/Workspace \(Click to open\)/i);
    await user.click(workspaceBtn);

    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Research Projects/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saved Reports/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /History & Activity/i })
    ).toBeInTheDocument();
  });

  it("collapses and re-expands the secondary category column", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Sidebar />
      </AppProvider>
    );

    // Initially secondary panel is visible
    expect(screen.getByText("RESEARCH")).toBeInTheDocument();

    // Collapse secondary column via toggle
    const collapseBtn = screen.getByTitle(/Collapse category panel/i);
    await user.click(collapseBtn);

    // Secondary column is now hidden
    expect(screen.queryByText("RESEARCH")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Discover Papers/i })
    ).not.toBeInTheDocument();

    // Re-expand via Primary Rail category click
    const aiToolsBtn = screen.getByTitle(/AI Tools \(Click to open\)/i);
    await user.click(aiToolsBtn);

    expect(screen.getByText("AI TOOLS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Tools Hub/i })).toBeInTheDocument();
  });

  it("applies theme-adaptive classes to Sidebar columns for light and dark modes", () => {
    const { container } = render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Sidebar />
      </AppProvider>
    );

    // Primary Rail has both light bg-slate-100 and dark:bg-[#070b12]
    const rail = container.querySelector(".w-14");
    expect(rail).toHaveClass("bg-slate-100");
    expect(rail).toHaveClass("dark:bg-[#070b12]");

    // Secondary panel has light bg-slate-50/90 and dark:bg-[#0b101b]
    const secondaryCol = container.querySelector(".w-54");
    expect(secondaryCol).toHaveClass("bg-slate-50/90");
    expect(secondaryCol).toHaveClass("dark:bg-[#0b101b]");
  });

  it("renders Toolbar with dynamic Breadcrumbs and section title", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <Toolbar />
      </AppProvider>
    );

    expect(screen.getByRole("navigation", { name: /Breadcrumbs/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search papers across all sources/i)
    ).toBeInTheDocument();
  });
});

describe("AI Tools Hub & Specialized Workspaces", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders AI Tools Hub landing page with searchable tool cards and category filters", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <AiToolsHubView />
      </AppProvider>
    );

    expect(screen.getByText("Professional AI Academic Tools")).toBeInTheDocument();
    expect(screen.getByText("AI Research & Writing Suite")).toBeInTheDocument();

    // Category filter pills
    expect(screen.getByRole("button", { name: /All Tools/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Detection and Verification/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Writing and Editing/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Academic Quality/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Citation and References/i })
    ).toBeInTheDocument();

    // All 8 cards present
    expect(screen.getByText("AI Writing Detector")).toBeInTheDocument();
    expect(screen.getByText("Plagiarism Checker")).toBeInTheDocument();
    expect(screen.getByText("AI Humanizer")).toBeInTheDocument();
    expect(screen.getByText("Academic Writing Assistant")).toBeInTheDocument();
    expect(screen.getByText("Paraphrasing Tool")).toBeInTheDocument();
    expect(screen.getByText("Citation Checker")).toBeInTheDocument();
    expect(screen.getByText("Readability Analyzer")).toBeInTheDocument();
    expect(screen.getByText("Research Integrity")).toBeInTheDocument();

    // Filter by Detection and Verification
    await user.click(screen.getByRole("button", { name: /Detection and Verification/i }));
    expect(screen.getByText("AI Writing Detector")).toBeInTheDocument();
    expect(screen.getByText("Plagiarism Checker")).toBeInTheDocument();
    expect(screen.queryByText("Academic Writing Assistant")).not.toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search AI tools by name/i);
    await user.type(searchInput, "readability");
    await user.click(screen.getByRole("button", { name: /All Tools/i }));
    expect(screen.getByText("Readability Analyzer")).toBeInTheDocument();
    expect(screen.queryByText("AI Writing Detector")).not.toBeInTheDocument();
  });

  it("renders Readability Analyzer workspace with empirical statistical formulas", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <AiToolWorkspaceView toolId="readability_analyzer" />
      </AppProvider>
    );

    expect(screen.getByText("Readability Analyzer")).toBeInTheDocument();
    expect(screen.getByText(/Empirical Readability Formulas/i)).toBeInTheDocument();
    expect(screen.getByText(/Flesch-Kincaid Grade/i)).toBeInTheDocument();
    expect(screen.getByText(/Gunning Fog Index/i)).toBeInTheDocument();
    expect(screen.getByText(/Flesch Reading Ease/i)).toBeInTheDocument();
    expect(screen.getByText(/Coleman-Liau Metric/i)).toBeInTheDocument();
  });

  it("renders AI Writing Detector with burstiness, uniformity, and sentence scan", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <AiToolWorkspaceView toolId="ai_writing_detector" />
      </AppProvider>
    );

    expect(screen.getByText("AI Writing Detector")).toBeInTheDocument();
    expect(screen.getByText(/Stylometric Probability Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentence Burstiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadence Uniformity/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Sentence-by-Sentence Stylometric Scan/i)
    ).toBeInTheDocument();
  });

  it("renders Citation Checker with canonical DOI identification", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <AiToolWorkspaceView toolId="citation_checker" />
      </AppProvider>
    );

    expect(screen.getByText("Citation Checker")).toBeInTheDocument();
    expect(screen.getByText(/Reference Format & DOI Verification/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Canonical DOI/i).length).toBeGreaterThan(0);
  });

  it("renders Saved Reports View with export and download actions", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <SavedReportsView />
      </AppProvider>
    );

    expect(screen.getByText("Saved Reports & Exports")).toBeInTheDocument();
    expect(
      screen.getByText("Deep Learning Load Forecasting Review Matrix")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Download/i }).length).toBeGreaterThan(
      0
    );
  });

  it("renders Privacy & Security View with offline-first isolation guarantees", () => {
    render(
      <AppProvider
        initialPapers={INITIAL_DEMO_PAPERS}
        initialCollections={INITIAL_DEMO_COLLECTIONS}
      >
        <PrivacySecurityView />
      </AppProvider>
    );

    expect(screen.getByText("Privacy, Data Isolation & Security")).toBeInTheDocument();
    expect(screen.getByText("100% Local-First SQLite Database")).toBeInTheDocument();
    expect(
      screen.getByText("Zero Analytics & No Telemetry Tracking")
    ).toBeInTheDocument();
    expect(screen.getByText("Strict Offline-Only Mode")).toBeInTheDocument();
  });
});
