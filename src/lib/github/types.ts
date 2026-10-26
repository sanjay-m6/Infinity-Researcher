export interface GitHubLabel {
  id?: number;
  name: string;
  color: string; // 6 hex digits without '#'
  description?: string;
  default?: boolean;
}

export type IssueCategory =
  | "bug"
  | "feature"
  | "ui_ux"
  | "performance"
  | "scraper"
  | "pdf_reader"
  | "ai"
  | "installer_updater"
  | "question";

export type IssueSeverity = "minor" | "normal" | "major" | "critical";

export type ReproducibilityRate = "always" | "sometimes" | "once" | "rare";

export interface BugReportPayload {
  title: string;
  whatHappened: string;
  expectedBehavior: string;
  stepsToReproduce: string;
  reproducibility: ReproducibilityRate;
  severity: IssueSeverity;
  affectedArea: string;
  includeDiagnostics: boolean;
  diagnosticsText?: string;
}

export interface FeatureRequestPayload {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  researchBenefit: string;
  additionalContext?: string;
}

export interface GitHubIssueCreateRequest {
  title: string;
  body: string;
  labels: string[];
}

export interface GitHubIssueResponse {
  id: number;
  number: number;
  html_url: string;
  title: string;
  state: string;
  labels: Array<{
    id?: number;
    name: string;
    color: string;
    description?: string;
  }>;
  created_at: string;
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
}

export interface SystemDiagnostics {
  appName: string;
  appVersion: string;
  osPlatform: string;
  arch: string;
  backendStatus: string;
  databaseSchemaVersion: number;
  sanitizedLogs: string;
}
