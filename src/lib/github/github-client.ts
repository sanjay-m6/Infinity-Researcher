import {
  GitHubLabel,
  IssueCategory,
  IssueSeverity,
  BugReportPayload,
  FeatureRequestPayload,
  GitHubIssueCreateRequest,
  GitHubIssueResponse,
  GitHubRepoConfig,
} from "./types";
import { redactDiagnostics } from "./redactor";

export const DEFAULT_REPO_CONFIG: GitHubRepoConfig = {
  owner: "sanjay-m6",
  repo: "Infinity-Researcher",
};

export const FALLBACK_REPO_LABELS: GitHubLabel[] = [
  { name: "bug", color: "d73a4a", description: "Confirmed defect or error report" },
  { name: "enhancement", color: "a2eeef", description: "New feature or capability request" },
  { name: "ui/ux", color: "c5def5", description: "User interface, layout, or visual experience" },
  { name: "onboarding", color: "bfd4f2", description: "First-run setup wizard" },
  { name: "performance", color: "fbca04", description: "Speed or resource optimization" },
  { name: "scraper", color: "d4c5f9", description: "Academic crawler or connector problem" },
  { name: "pdf-reader", color: "0075ca", description: "PDF rendering or viewer issue" },
  { name: "ai", color: "7057ff", description: "AI synthesis, RAG, or provider issue" },
  { name: "installer", color: "e99695", description: "Packaging, MSI, or installer problem" },
  { name: "updater", color: "f9d0c4", description: "In-app signed update check issue" },
  { name: "documentation", color: "0075ca", description: "Documentation additions" },
  { name: "question", color: "d876e3", description: "Usage question or inquiry" },
  { name: "priority: critical", color: "b60205", description: "Work-stopping defect" },
  { name: "priority: high", color: "d93f0b", description: "High impact defect" },
  { name: "priority: normal", color: "fbca04", description: "Standard impact" },
  { name: "priority: low", color: "0e8a16", description: "Minor cosmetic issue" },
  { name: "needs-triage", color: "ededed", description: "Awaiting maintainer review" },
];

let labelsCache: { [key: string]: { timestamp: number; labels: GitHubLabel[] } } = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function mapCategoryToLabels(category: IssueCategory, severity?: IssueSeverity): string[] {
  const labels: string[] = [];

  switch (category) {
    case "bug":
      labels.push("bug");
      break;
    case "feature":
      labels.push("enhancement");
      break;
    case "ui_ux":
      labels.push("ui/ux");
      break;
    case "performance":
      labels.push("performance");
      break;
    case "scraper":
      labels.push("bug", "scraper");
      break;
    case "pdf_reader":
      labels.push("bug", "pdf-reader");
      break;
    case "ai":
      labels.push("bug", "ai");
      break;
    case "installer_updater":
      labels.push("bug", "installer");
      break;
    case "question":
      labels.push("question");
      break;
  }

  if (severity) {
    const priorityLabel =
      severity === "critical"
        ? "priority: critical"
        : severity === "major"
        ? "priority: high"
        : severity === "minor"
        ? "priority: low"
        : "priority: normal";
    labels.push(priorityLabel);
  }

  labels.push("needs-triage");

  return Array.from(new Set(labels));
}

export async function fetchRepositoryLabels(
  owner: string = DEFAULT_REPO_CONFIG.owner,
  repo: string = DEFAULT_REPO_CONFIG.repo,
  token?: string | null
): Promise<GitHubLabel[]> {
  const cacheKey = `${owner}/${repo}`;
  const cached = labelsCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.labels;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels?per_page=100`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token && token.trim()) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return FALLBACK_REPO_LABELS;
    }

    const data: GitHubLabel[] = await response.json();
    labelsCache[cacheKey] = {
      timestamp: Date.now(),
      labels: data,
    };
    return data;
  } catch {
    return FALLBACK_REPO_LABELS;
  }
}

export function buildBugReportMarkdown(payload: BugReportPayload): string {
  const sanitizedDiagnostics = payload.includeDiagnostics && payload.diagnosticsText
    ? redactDiagnostics(payload.diagnosticsText)
    : "No technical diagnostics included.";

  return `## Summary
${payload.whatHappened.trim()}

## Steps to Reproduce
${payload.stepsToReproduce.trim()}

## Expected Behavior
${payload.expectedBehavior.trim()}

## Reproducibility
${payload.reproducibility}

## Affected Area
${payload.affectedArea}

## Severity
${payload.severity}

## Environment
- Application: Infinity Researcher v0.1.0
- Platform: Windows 10/11 x64
- Core: Tauri 2 + Rust + SQLite (WAL)

## Diagnostics (Sanitized)
\`\`\`
${sanitizedDiagnostics}
\`\`\`

---
*Reported from Infinity Researcher desktop feedback center.*`;
}

export function buildFeatureRequestMarkdown(payload: FeatureRequestPayload): string {
  return `## Problem or Scholarly Use Case
${payload.problemStatement.trim()}

## Proposed Solution
${payload.proposedSolution.trim()}

## Value & Research Benefit
${payload.researchBenefit.trim()}

${payload.additionalContext ? `## Additional Context\n${payload.additionalContext.trim()}\n` : ""}
---
*Proposed from Infinity Researcher desktop feedback center.*`;
}

export async function createGitHubIssue(
  owner: string = DEFAULT_REPO_CONFIG.owner,
  repo: string = DEFAULT_REPO_CONFIG.repo,
  request: GitHubIssueCreateRequest,
  token: string
): Promise<GitHubIssueResponse> {
  if (!token || !token.trim()) {
    throw new Error("GitHub authorization token is required to create an issue directly.");
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.trim()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: request.title,
      body: request.body,
      labels: request.labels,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const msg = errorBody?.message || `GitHub API error (HTTP ${response.status})`;
    throw new Error(msg);
  }

  return (await response.json()) as GitHubIssueResponse;
}

export function generateWebIssueUrl(
  owner: string = DEFAULT_REPO_CONFIG.owner,
  repo: string = DEFAULT_REPO_CONFIG.repo,
  request: GitHubIssueCreateRequest
): string {
  const params = new URLSearchParams({
    title: request.title,
    body: request.body,
  });

  if (request.labels.length > 0) {
    params.set("labels", request.labels.join(","));
  }

  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/new?${params.toString()}`;
}
