import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { redactDiagnostics } from "../lib/github/redactor";
import {
  mapCategoryToLabels,
  buildBugReportMarkdown,
  buildFeatureRequestMarkdown,
  generateWebIssueUrl,
  DEFAULT_REPO_CONFIG,
} from "../lib/github/github-client";
import { OnboardingWizard } from "../features/onboarding/OnboardingWizard";
import { FeedbackCenterModal } from "../features/feedback/FeedbackCenterModal";
import { AppProvider } from "../context/AppContext";
import * as desktopApi from "../lib/desktop-api";

describe("GitHub Redaction & Client Logic", () => {
  it("redacts GitHub personal access tokens and OAuth tokens", () => {
    const raw = "Error encountered with token ghp_1234567890abcdefghijklmnopqrstuvwxyz and github_pat_11AABBCCDDeeffgghhiijjkk";
    const redacted = redactDiagnostics(raw);
    expect(redacted).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz");
    expect(redacted).not.toContain("github_pat_11AABBCCDDeeffgghhiijjkk");
    expect(redacted).toContain("[REDACTED_GH_TOKEN]");
  });

  it("redacts generic API keys and Authorization headers", () => {
    const raw = "POST /v1/chat Authorization: Bearer sk-proj-1234567890abcdef123456";
    const redacted = redactDiagnostics(raw);
    expect(redacted).not.toContain("sk-proj-1234567890abcdef123456");
    expect(redacted).toContain("[REDACTED_AUTH_HEADER]");
  });

  it("sanitizes Windows and Unix user directory paths", () => {
    const raw = "File read failed at C:\\Users\\sanjay\\Documents\\Research\\paper.pdf and /home/researcher/data.db";
    const redacted = redactDiagnostics(raw);
    expect(redacted).not.toContain("C:\\Users\\sanjay");
    expect(redacted).toContain("C:\\Users\\<user>");
    expect(redacted).not.toContain("/home/researcher");
    expect(redacted).toContain("/Users/<user>");
  });

  it("maps categories and severity to appropriate labels", () => {
    const bugLabels = mapCategoryToLabels("bug", "critical");
    expect(bugLabels).toContain("bug");
    expect(bugLabels).toContain("priority: critical");
    expect(bugLabels).toContain("needs-triage");

    const scraperLabels = mapCategoryToLabels("scraper", "major");
    expect(scraperLabels).toContain("bug");
    expect(scraperLabels).toContain("scraper");
    expect(scraperLabels).toContain("priority: high");

    const featLabels = mapCategoryToLabels("feature");
    expect(featLabels).toContain("enhancement");
    expect(featLabels).toContain("needs-triage");
  });

  it("generates structured bug report Markdown with environment details", () => {
    const md = buildBugReportMarkdown({
      title: "PDF page jump failed",
      whatHappened: "Page jump threw an error",
      expectedBehavior: "Jump to page 5",
      stepsToReproduce: "1. Click page 5\n2. See error",
      reproducibility: "always",
      severity: "major",
      affectedArea: "PDF Reader",
      includeDiagnostics: true,
      diagnosticsText: "Path: C:\\Users\\sanjay\\secret_key=ghp_abcdef1234567890abcdef1234567890",
    });

    expect(md).toContain("## Summary\nPage jump threw an error");
    expect(md).toContain("## Affected Area\nPDF Reader");
    expect(md).toContain("## Severity\nmajor");
    expect(md).toContain("Infinity Researcher");
    expect(md).not.toContain("ghp_abcdef1234567890abcdef1234567890");
    expect(md).toContain("[REDACTED_GH_TOKEN]");
  });

  it("generates structured feature request Markdown", () => {
    const md = buildFeatureRequestMarkdown({
      title: "BibTeX Export Button",
      problemStatement: "Exporting references requires manual copying",
      proposedSolution: "Add a 1-click BibTeX export button",
      researchBenefit: "Saves time when citing papers",
      additionalContext: "See drawer export tab",
    });

    expect(md).toContain("## Problem or Scholarly Use Case\nExporting references requires manual copying");
    expect(md).toContain("## Proposed Solution\nAdd a 1-click BibTeX export button");
    expect(md).toContain("## Value & Research Benefit\nSaves time when citing papers");
    expect(md).toContain("Infinity Researcher");
  });

  it("generates valid web fallback issue URL for browser", () => {
    const url = generateWebIssueUrl(DEFAULT_REPO_CONFIG.owner, DEFAULT_REPO_CONFIG.repo, {
      title: "[Bug]: Test Issue",
      body: "Test Body Content",
      labels: ["bug", "needs-triage"],
    });

    expect(url).toContain("https://github.com/sanjay-m6/Infinity-Researcher/issues/new");
    expect(url).toContain("title=%5BBug%5D%3A+Test+Issue");
    expect(url).toContain("labels=bug%2Cneeds-triage");
  });
});

describe("Dynamic Onboarding Wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "setAppSetting").mockResolvedValue(undefined);
  });

  it("renders Welcome step with Infinity Researcher branding and tagline", () => {
    render(
      <AppProvider>
        <OnboardingWizard isOpen={true} onClose={() => {}} onComplete={() => {}} />
      </AppProvider>
    );

    expect(screen.getByText("Welcome to Infinity Researcher")).toBeInTheDocument();
    expect(screen.getByText("Discover. Understand. Research.")).toBeInTheDocument();
    expect(screen.getByText("Created by Sanjay · Infinity Web Technology")).toBeInTheDocument();
    expect(screen.getByText("Discover Papers")).toBeInTheDocument();
    expect(screen.getByText("Review Matrix")).toBeInTheDocument();
    expect(screen.getByText("Research Integrity")).toBeInTheDocument();
  });

  it("navigates through steps and allows selecting research topics", async () => {
    render(
      <AppProvider>
        <OnboardingWizard isOpen={true} onClose={() => {}} onComplete={() => {}} />
      </AppProvider>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText("Continue"));

    await waitFor(() => {
      expect(screen.getByText("Select Your Research Interests")).toBeInTheDocument();
    });

    // Toggle topic
    const topicBtn = screen.getByText("Quantum Computing");
    fireEvent.click(topicBtn);

    // Add custom topic
    const input = screen.getByPlaceholderText(/Add custom topic/i);
    fireEvent.change(input, { target: { value: "Neuromorphic Engineering" } });
    fireEvent.click(screen.getByText("Add"));

    expect(screen.getByText("Neuromorphic Engineering")).toBeInTheDocument();

    // Step 2 -> Step 3
    fireEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("What is your primary goal today?")).toBeInTheDocument();
    });
  });

  it("completes onboarding and triggers onComplete callback", async () => {
    const onComplete = vi.fn();
    render(
      <AppProvider>
        <OnboardingWizard isOpen={true} onClose={() => {}} onComplete={onComplete} />
      </AppProvider>
    );

    // Advance to step 6
    fireEvent.click(screen.getByText("Continue")); // Step 2
    fireEvent.click(screen.getByText("Continue")); // Step 3
    fireEvent.click(screen.getByText("Continue")); // Step 4
    fireEvent.click(screen.getByText("Continue")); // Step 5
    fireEvent.click(screen.getByText("Continue")); // Step 6

    await waitFor(() => {
      expect(screen.getByText("Setup Complete!")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open Infinity Researcher"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});

describe("FeedbackCenterModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(desktopApi, "getAppSetting").mockResolvedValue(null);
    vi.spyOn(desktopApi, "setAppSetting").mockResolvedValue(undefined);
  });

  it("renders Bug Report form with required fields and area selection", () => {
    render(
      <AppProvider>
        <FeedbackCenterModal isOpen={true} onClose={() => {}} initialCategory="bug" />
      </AppProvider>
    );

    expect(screen.getByText("Infinity Researcher Feedback & Issue Center")).toBeInTheDocument();
    expect(screen.getByText("Report a Bug")).toBeInTheDocument();
    expect(screen.getByText("Request a Feature")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Short summary of what went wrong/i)).toBeInTheDocument();
  });

  it("switches to Feature Request tab and displays feature fields", () => {
    render(
      <AppProvider>
        <FeedbackCenterModal isOpen={true} onClose={() => {}} initialCategory="bug" />
      </AppProvider>
    );

    fireEvent.click(screen.getByText("Request a Feature"));

    expect(screen.getByText(/Problem or Scholarly Friction/i)).toBeInTheDocument();
    expect(screen.getByText(/Proposed Solution \/ Feature/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Value & Research Benefit/i)[0]).toBeInTheDocument();
  });

  it("switches between Double-Sided, Edit, and Preview layouts", () => {
    render(
      <AppProvider>
        <FeedbackCenterModal isOpen={true} onClose={() => {}} initialCategory="bug" />
      </AppProvider>
    );

    expect(screen.getByText("Double-Sided")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();

    // Click Edit to enter form-only mode
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.queryByText(/Live GitHub Issue Preview/i)).not.toBeInTheDocument();

    // Click Preview to enter preview-only mode
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByText(/Live GitHub Issue Preview/i)).toBeInTheDocument();

    // Click Double-Sided to return to split mode
    fireEvent.click(screen.getByText("Double-Sided"));
    expect(screen.getByText(/Live GitHub Issue Preview/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Short summary of what went wrong/i)).toBeInTheDocument();
  });

  it("clears validation error when user begins typing", async () => {
    render(
      <AppProvider>
        <FeedbackCenterModal isOpen={true} onClose={() => {}} initialCategory="bug" />
      </AppProvider>
    );

    // Attempt direct submission with empty fields to trigger validation
    fireEvent.click(screen.getByText("Create GitHub Issue"));
    expect(screen.getByText("Please enter an issue title.")).toBeInTheDocument();

    // Type into title field -> error should clear immediately
    const titleInput = screen.getByPlaceholderText(/Short summary of what went wrong/i);
    fireEvent.change(titleInput, { target: { value: "Resolving unexpected error" } });
    expect(screen.queryByText("Please enter an issue title.")).not.toBeInTheDocument();
  });

  it("switches to Preview tab and shows Markdown preview", () => {
    render(
      <AppProvider>
        <FeedbackCenterModal isOpen={true} onClose={() => {}} initialCategory="bug" />
      </AppProvider>
    );

    const titleInput = screen.getByPlaceholderText(/Short summary of what went wrong/i);
    fireEvent.change(titleInput, { target: { value: "Matrix column sorting error" } });

    fireEvent.click(screen.getByText("Preview"));

    expect(screen.getByText(/Title: \[Bug\]: Matrix column sorting error/i)).toBeInTheDocument();
    expect(screen.getByText(/Applied GitHub Labels/i)).toBeInTheDocument();
  });
});

