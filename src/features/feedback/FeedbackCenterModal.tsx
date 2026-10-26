import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import {
  Bug,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Edit3,
  Copy,
  Lock,
  Columns,
  X,
  Check,
} from "lucide-react";
import { GithubIcon } from "../../components/ui/GithubIcon";

import {
  IssueCategory,
  IssueSeverity,
  ReproducibilityRate,
  GitHubLabel,
  GitHubIssueResponse,
} from "../../lib/github/types";
import {
  DEFAULT_REPO_CONFIG,
  mapCategoryToLabels,
  fetchRepositoryLabels,
  createGitHubIssue,
  generateWebIssueUrl,
  buildBugReportMarkdown,
  buildFeatureRequestMarkdown,
  FALLBACK_REPO_LABELS,
} from "../../lib/github/github-client";
import { getAppSetting, setAppSetting } from "../../lib/desktop-api";
import { useApp } from "../../context/AppContext";

export type ViewLayout = "split" | "edit" | "preview";

export interface FeedbackCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: IssueCategory;
}

export const FeedbackCenterModal: React.FC<FeedbackCenterModalProps> = ({
  isOpen,
  onClose,
  initialCategory = "bug",
}) => {
  const { showToast, backendHealth } = useApp();

  const [activeTab, setActiveTab] = useState<"bug" | "feature">(
    initialCategory === "feature" ? "feature" : "bug"
  );
  const [category, setCategory] = useState<IssueCategory>(initialCategory);
  const [severity, setSeverity] = useState<IssueSeverity>("normal");
  const [reproducibility, setReproducibility] = useState<ReproducibilityRate>("always");
  const [affectedArea, setAffectedArea] = useState<string>("Discover / Search");

  // Form Fields
  const [title, setTitle] = useState<string>("");
  const [whatHappened, setWhatHappened] = useState<string>("");
  const [expectedBehavior, setExpectedBehavior] = useState<string>("");
  const [stepsToReproduce, setStepsToReproduce] = useState<string>(
    "1. Navigate to ...\n2. Perform action ...\n3. Observe error ..."
  );

  // Feature request fields
  const [problemStatement, setProblemStatement] = useState<string>("");
  const [proposedSolution, setProposedSolution] = useState<string>("");
  const [researchBenefit, setResearchBenefit] = useState<string>("");

  // Diagnostics & Authentication
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(false);
  const [rawDiagnostics, setRawDiagnostics] = useState<string>("");
  const [githubToken, setGithubToken] = useState<string>("");
  const [isTokenSaved, setIsTokenSaved] = useState<boolean>(false);

  // View state: split (double-sided), edit (form only), or preview (preview only)
  const [viewLayout, setViewLayout] = useState<ViewLayout>("split");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [labels, setLabels] = useState<GitHubLabel[]>(FALLBACK_REPO_LABELS);
  const [submissionResult, setSubmissionResult] = useState<GitHubIssueResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Helper to clear error message on input
  const clearError = () => {
    if (errorMessage) setErrorMessage(null);
  };

  // Load saved token and draft from storage
  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const savedToken = await getAppSetting("github_pat_token");
        if (savedToken) {
          setGithubToken(savedToken);
          setIsTokenSaved(true);
        }
      } catch {
        const localTok = localStorage.getItem("rps_gh_token");
        if (localTok) {
          setGithubToken(localTok);
          setIsTokenSaved(true);
        }
      }
    })();

    // Construct basic environment diagnostics
    const initialDiag = `App Version: Infinity Researcher v${backendHealth?.app_version || "0.1.0"}
OS: Windows 10/11 x64
Core: Tauri 2 + Rust Core (SQLite WAL)
Active Subsystem: ${affectedArea}
Timestamp: ${new Date().toISOString()}`;
    setRawDiagnostics(initialDiag);

    // Fetch repository labels from GitHub
    void fetchRepositoryLabels(DEFAULT_REPO_CONFIG.owner, DEFAULT_REPO_CONFIG.repo).then((res) => {
      if (res && res.length > 0) setLabels(res);
    });
  }, [isOpen, backendHealth, affectedArea]);

  const handleSaveToken = async () => {
    if (!githubToken.trim()) return;
    try {
      await setAppSetting("github_pat_token", githubToken.trim());
      setIsTokenSaved(true);
      showToast("GitHub token saved securely in application settings.", "success");
    } catch {
      localStorage.setItem("rps_gh_token", githubToken.trim());
      setIsTokenSaved(true);
      showToast("GitHub token saved.", "info");
    }
  };

  const handleClearToken = async () => {
    try {
      await setAppSetting("github_pat_token", "");
    } catch {
      localStorage.removeItem("rps_gh_token");
    }
    setGithubToken("");
    setIsTokenSaved(false);
    showToast("GitHub token removed from application storage.", "info");
  };

  // Compute active labels for current selection
  const activeLabelNames = mapCategoryToLabels(category, activeTab === "bug" ? severity : undefined);
  const activeLabelObjects = activeLabelNames.map((name) => {
    const found = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
    return found || { name, color: "ededed" };
  });

  // Generated Markdown body
  const generatedMarkdown =
    activeTab === "bug"
      ? buildBugReportMarkdown({
          title,
          whatHappened,
          expectedBehavior,
          stepsToReproduce,
          reproducibility,
          severity,
          affectedArea,
          includeDiagnostics,
          diagnosticsText: rawDiagnostics,
        })
      : buildFeatureRequestMarkdown({
          title,
          problemStatement,
          proposedSolution,
          researchBenefit,
        });

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generatedMarkdown);
      setIsCopied(true);
      showToast("Issue Markdown copied to clipboard.", "info");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast("Could not copy markdown to clipboard.", "warning");
    }
  };

  // Direct submission to GitHub API
  const handleSubmitDirect = async () => {
    if (!title.trim()) {
      setErrorMessage("Please enter an issue title.");
      return;
    }
    if (activeTab === "bug" && (!whatHappened.trim() || !expectedBehavior.trim())) {
      setErrorMessage("Please fill in both what happened and expected behavior.");
      return;
    }
    if (activeTab === "feature" && (!problemStatement.trim() || !proposedSolution.trim())) {
      setErrorMessage("Please fill in the problem statement and proposed solution.");
      return;
    }

    if (!githubToken.trim()) {
      setErrorMessage("Enter a GitHub token to create the issue directly, or click 'Continue on GitHub' below.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createGitHubIssue(
        DEFAULT_REPO_CONFIG.owner,
        DEFAULT_REPO_CONFIG.repo,
        {
          title: `[${activeTab === "bug" ? "Bug" : "Feature"}]: ${title.trim()}`,
          body: generatedMarkdown,
          labels: activeLabelNames,
        },
        githubToken.trim()
      );

      setSubmissionResult(result);
      showToast(`GitHub Issue #${result.number} created successfully!`, "success");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create issue on GitHub.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Browser Fallback (Prefilled URL)
  const handleOpenBrowserFallback = () => {
    if (!title.trim()) {
      setErrorMessage("Please enter an issue title before opening on GitHub.");
      return;
    }

    const url = generateWebIssueUrl(DEFAULT_REPO_CONFIG.owner, DEFAULT_REPO_CONFIG.repo, {
      title: `[${activeTab === "bug" ? "Bug" : "Feature"}]: ${title.trim()}`,
      body: generatedMarkdown,
      labels: activeLabelNames,
    });

    window.open(url, "_blank");
    showToast("Opened prefilled issue in your default browser.", "info");
  };

  // Render Form Inputs Component
  const renderFormInputs = () => (
    <div className="space-y-3.5">
      {/* Title input */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>
            Issue Title <span className="text-rose-500">*</span>
          </span>
          <span className="text-[10px] font-normal text-slate-400">
            {title.length > 0 ? `${title.length} chars` : "Required"}
          </span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearError();
          }}
          placeholder={
            activeTab === "bug"
              ? "Short summary of what went wrong..."
              : "Describe your requested research feature..."
          }
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {activeTab === "bug" ? (
        <>
          {/* 2x2 Dropdown Grid: eliminates truncation bug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as IssueCategory);
                  clearError();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="bug">Standard Bug</option>
                <option value="scraper">Scraper / Connector Failure</option>
                <option value="pdf_reader">PDF Reader Issue</option>
                <option value="ai">AI / Copilot Synthesis</option>
                <option value="performance">Performance / Latency</option>
                <option value="ui_ux">UI / Visual Defect</option>
                <option value="installer_updater">Installer / Update</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Affected Area
              </label>
              <select
                value={affectedArea}
                onChange={(e) => {
                  setAffectedArea(e.target.value);
                  clearError();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Discover / Search">Discover / Search</option>
                <option value="Literature Review Matrix">Literature Review Matrix</option>
                <option value="PDF Reader">PDF Reader</option>
                <option value="Research Integrity Suite">Research Integrity Suite</option>
                <option value="AI Workspace">AI Workspace</option>
                <option value="Library / Collections">Library / Collections</option>
                <option value="Sources & Crawls">Sources & Crawls</option>
                <option value="Settings & Setup">Settings & Setup</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value as IssueSeverity);
                  clearError();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="minor">Minor (Cosmetic)</option>
                <option value="normal">Normal (Has workaround)</option>
                <option value="major">Major (Feature broken)</option>
                <option value="critical">Critical (Crash / Data Loss)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Reproducibility
              </label>
              <select
                value={reproducibility}
                onChange={(e) => {
                  setReproducibility(e.target.value as ReproducibilityRate);
                  clearError();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="always">Always (100%)</option>
                <option value="frequently">Frequently</option>
                <option value="intermittently">Intermittently</option>
                <option value="once">Only Once</option>
              </select>
            </div>
          </div>

          {/* What Happened */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              What happened? <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={whatHappened}
              onChange={(e) => {
                setWhatHappened(e.target.value);
                clearError();
              }}
              placeholder="Describe the failure, error code, or unexpected behavior..."
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Steps to Reproduce
            </label>
            <textarea
              rows={3}
              value={stepsToReproduce}
              onChange={(e) => {
                setStepsToReproduce(e.target.value);
                clearError();
              }}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
            />
          </div>

          {/* Expected Behavior */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              What did you expect to happen? <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={expectedBehavior}
              onChange={(e) => {
                setExpectedBehavior(e.target.value);
                clearError();
              }}
              placeholder="What should have occurred instead?"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Sanitized Diagnostics Opt-In */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Include sanitized technical environment details
              </span>
            </label>
            {includeDiagnostics && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5 leading-normal">
                Guaranteed privacy: Tokens, API keys, document text, and personal usernames are
                automatically redacted by the application privacy filter before transmission.
              </p>
            )}
          </div>
        </>
      ) : (
        /* Feature Request Form */
        <>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Problem or Scholarly Friction <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={problemStatement}
              onChange={(e) => {
                setProblemStatement(e.target.value);
                clearError();
              }}
              placeholder="What bottleneck or limitation do you encounter in your research workflow?"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Proposed Solution / Feature <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={proposedSolution}
              onChange={(e) => {
                setProposedSolution(e.target.value);
                clearError();
              }}
              placeholder="How should Infinity Researcher address this? Describe controls or interactions..."
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Value & Research Benefit <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={researchBenefit}
              onChange={(e) => {
                setResearchBenefit(e.target.value);
                clearError();
              }}
              placeholder="Why would this be valuable for researchers and literature reviews?"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>
        </>
      )}

      {/* GitHub Authorization Section */}
      <div className="p-3 rounded-lg border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>GitHub Direct Issue Creation (Optional PAT)</span>
          </div>
          {isTokenSaved && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Token configured
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
          To create issues directly from the app, enter a GitHub Personal Access Token (with{" "}
          <code className="text-indigo-600 dark:text-indigo-400 font-mono">issues:write</code> scope).
          Otherwise, click <strong>Continue on GitHub</strong> to submit without a token.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => {
              setGithubToken(e.target.value);
              clearError();
            }}
            placeholder="github_pat_... or ghp_..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button variant="secondary" size="sm" onClick={handleSaveToken}>
            Save Token
          </Button>
          {isTokenSaved && (
            <Button variant="ghost" size="sm" onClick={handleClearToken}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Render Preview Card Component
  const renderPreviewCard = () => (
    <div className="space-y-3.5">
      {/* Preview Header & Copy Markdown Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Live GitHub Issue Preview
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyMarkdown}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          title="Copy generated markdown"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Markdown</span>
            </>
          )}
        </button>
      </div>

      {/* Applied GitHub Labels Pill Group */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
          Applied GitHub Labels ({activeLabelObjects.length})
        </span>
        <div className="flex flex-wrap gap-1.5">
          {activeLabelObjects.map((lbl) => (
            <span
              key={lbl.name}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium border transition-transform hover:scale-105"
              style={{
                backgroundColor: `#${lbl.color}25`,
                borderColor: `#${lbl.color}80`,
                color: `#${lbl.color}`,
              }}
            >
              {lbl.name}
            </span>
          ))}
        </div>
      </div>

      {/* Issue Title Preview */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
          Issue Title Preview
        </span>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-words font-mono">
          Title: [{activeTab === "bug" ? "Bug" : "Feature"}]: {title.trim() || "Untitled Issue"}
        </p>
      </div>

      {/* Markdown Body Code Block */}
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
          Issue Body (GFM Markdown)
        </span>
        <pre className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-100 dark:text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[38vh] border border-slate-800 leading-relaxed whitespace-pre-wrap select-text custom-scrollbar">
          {generatedMarkdown}
        </pre>
      </div>

      {/* Environmental specs preview badge */}
      {includeDiagnostics && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
          Diagnostics will attach: Infinity Researcher v{backendHealth?.app_version || "0.1.0"} · Windows 10/11 x64 · SQLite Core · Subsystem: {affectedArea}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Infinity Researcher Feedback & Issue Center"
      maxWidth={viewLayout === "split" ? "5xl" : "3xl"}
      footer={
        submissionResult ? (
          <div className="flex items-center justify-between w-full text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Issue #{submissionResult.number} registered on GitHub
            </span>
            <div className="flex items-center gap-2">
              <a
                href={submissionResult.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                <span>Open on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <GithubIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Target: </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {DEFAULT_REPO_CONFIG.owner}/{DEFAULT_REPO_CONFIG.repo}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenBrowserFallback}
                title="Open GitHub in your browser with all fields prefilled (no token needed)"
              >
                <span>Continue on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitDirect}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Creating Issue...</span>
                  </>
                ) : (
                  <>
                    <GithubIcon className="w-3.5 h-3.5 mr-1.5" />
                    <span>Create GitHub Issue</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      }
    >
      {submissionResult ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              GitHub Issue Created Successfully
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Issue <span className="font-semibold text-slate-800 dark:text-slate-200">#{submissionResult.number}</span>:{" "}
              {submissionResult.title}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            {submissionResult.labels.map((lbl) => (
              <span
                key={lbl.name}
                className="px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: `#${lbl.color}25`,
                  borderColor: `#${lbl.color}60`,
                  color: `#${lbl.color}`,
                }}
              >
                {lbl.name}
              </span>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <a
              href={submissionResult.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>View Issue on GitHub</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(submissionResult.html_url);
                showToast("Issue link copied to clipboard.", "info");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              <span>Copy Link</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 select-none">
          {/* Top Control Bar: Bug vs Feature Switcher + View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 gap-2.5">
            {/* Bug vs Feature selection tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("bug");
                  setCategory("bug");
                  clearError();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "bug"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Bug className="w-3.5 h-3.5 text-rose-500" />
                <span>Report a Bug</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("feature");
                  setCategory("feature");
                  clearError();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "feature"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Request a Feature</span>
              </button>
            </div>

            {/* View Layout Mode Switcher: Double-Sided (Split) vs Edit vs Preview */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewLayout("split")}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  viewLayout === "split"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
                title="Double-sided view: Form editor and live Markdown preview side-by-side"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Double-Sided</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLayout("edit")}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  viewLayout === "edit"
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
                title="Form only"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLayout("preview")}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  viewLayout === "preview"
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
                title="Preview only"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>
          </div>

          {/* Validation & Error Banner with Auto-Dismiss & Manual Dismiss */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="p-1 rounded text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer"
                aria-label="Dismiss error"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Dynamic Layout: Double-Sided (Split), Form Only, or Preview Only */}
          {viewLayout === "split" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {/* Left Column: Form Editor */}
              <div className="max-h-[62vh] overflow-y-auto pr-1 sm:pr-2">
                {renderFormInputs()}
              </div>

              {/* Right Column: Live Markdown & GitHub Preview Card */}
              <div className="max-h-[62vh] overflow-y-auto pl-1 sm:pl-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-4 lg:pt-0">
                {renderPreviewCard()}
              </div>
            </div>
          )}

          {viewLayout === "edit" && (
            <div className="max-h-[62vh] overflow-y-auto pr-1">
              {renderFormInputs()}
            </div>
          )}

          {viewLayout === "preview" && (
            <div className="max-h-[62vh] overflow-y-auto pr-1">
              {renderPreviewCard()}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
