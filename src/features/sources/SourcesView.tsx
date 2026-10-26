import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  listCrawlProfiles,
  createCrawlProfile,
  deleteCrawlProfile,
  previewUrlExtraction,
  checkWebsitePolicy,
  importSinglePage,
  startCrawlJob,
  getProviderConfigStatus,
  setProviderApiKey,
} from "../../lib/desktop-api";
import {
  CrawlProfile,
  CrawlProfileCreateInput,
  ExtractionPreviewResult,
  ProviderConfigStatus,
  WebsitePolicyCheck,
} from "../../lib/desktop-api/types";
import {
  Clock,
  Globe,
  Key,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Code2,
  RefreshCw,
  FileText,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

export const SourcesView: React.FC = () => {
  const { sources, collections, refreshDatabase, showToast, setActiveSection } = useApp();

  // Tab state - default to scraping (No-API mode)
  const [activeTab, setActiveTab] = useState<"scraping" | "academic">("scraping");

  // Academic Connectors state (kept for preservation, disabled in No-API mode)
  const [providerStatuses, setProviderStatuses] = useState<ProviderConfigStatus[]>([]);
  const [apiKeyModalProvider, setApiKeyModalProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Scraping Profiles state
  const [crawlProfiles, setCrawlProfiles] = useState<CrawlProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Sandbox Live Test state
  const [testUrl, setTestUrl] = useState("");
  const [testProfileId, setTestProfileId] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ExtractionPreviewResult | null>(null);

  // Add Website Wizard Modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardSeedUrl, setWizardSeedUrl] = useState("");
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);
  const [policyCheck, setPolicyCheck] = useState<WebsitePolicyCheck | null>(null);
  const [wizardMode, setWizardMode] = useState<"public_html" | "rendered" | "manual" | "link_only">("public_html");
  const [wizardName, setWizardName] = useState("");
  const [wizardDomain, setWizardDomain] = useState("");
  const [wizardDesc, setWizardDesc] = useState("");
  const [wizardDelay, setWizardDelay] = useState("1000");
  const [wizardMaxDepth, setWizardMaxDepth] = useState("2");
  const [wizardMaxPages, setWizardMaxPages] = useState("20");
  const [wizardAllowed, setWizardAllowed] = useState("");
  const [wizardDisallowed, setWizardDisallowed] = useState("");
  const [wizardTitleSel, setWizardTitleSel] = useState("");
  const [wizardAuthorsSel, setWizardAuthorsSel] = useState("");
  const [wizardAbstractSel, setWizardAbstractSel] = useState("");
  const [wizardDoiSel, setWizardDoiSel] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Single-Page Import Modal state
  const [isSingleImportOpen, setIsSingleImportOpen] = useState(false);
  const [singleImportUrl, setSingleImportUrl] = useState("");
  const [singleImportProfileId, setSingleImportProfileId] = useState("");
  const [singleImportCollectionId, setSingleImportCollectionId] = useState("");
  const [isImportingSingle, setIsImportingSingle] = useState(false);

  // Quick Start Crawl Modal state
  const [crawlStartProfile, setCrawlStartProfile] = useState<CrawlProfile | null>(null);
  const [crawlSeedUrl, setCrawlSeedUrl] = useState("");
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);

  const loadProviderStatuses = useCallback(async () => {
    try {
      const statuses = await getProviderConfigStatus();
      setProviderStatuses(statuses);
    } catch (e) {
      console.warn("Failed to load provider statuses", e);
    }
  }, []);

  const loadCrawlProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const data = await listCrawlProfiles();
      setCrawlProfiles(data);
    } catch (e) {
      console.error("Failed to load crawl profiles", e);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    loadProviderStatuses();
    loadCrawlProfiles();
  }, [loadProviderStatuses, loadCrawlProfiles]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyModalProvider) return;

    setIsSavingKey(true);
    try {
      await setProviderApiKey(apiKeyModalProvider, apiKeyInput.trim());
      showToast(`API Key saved for ${apiKeyModalProvider}`, "success");
      setApiKeyModalProvider(null);
      setApiKeyInput("");
      await loadProviderStatuses();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to save key: ${msg}`, "error");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) {
      showToast("Please enter a research paper URL to test.", "warning");
      return;
    }

    setIsPreviewing(true);
    setPreviewResult(null);
    try {
      const result = await previewUrlExtraction(
        testUrl.trim(),
        testProfileId ? testProfileId : null
      );
      setPreviewResult(result);
      showToast("Metadata extracted successfully via public HTML parser!", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Extraction failed: ${msg}`, "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  // Add Website Wizard: Step 1 -> Step 2 (Policy check)
  const handleWizardCheckPolicy = async () => {
    if (!wizardSeedUrl.trim()) {
      showToast("Please enter a seed URL or website domain.", "warning");
      return;
    }

    setIsCheckingPolicy(true);
    try {
      const check = await checkWebsitePolicy(wizardSeedUrl.trim());
      setPolicyCheck(check);
      setWizardDomain(check.domain);
      if (!wizardName) {
        setWizardName(
          check.detected_platform !== "generic"
            ? `${check.detected_platform.toUpperCase()} Repository`
            : check.domain
        );
      }
      if (check.crawl_delay_ms) {
        setWizardDelay(check.crawl_delay_ms.toString());
      }
      setWizardStep(2);
      showToast("Robots.txt & Website Policy inspected.", "info");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Policy check failed: ${msg}`, "error");
    } finally {
      setIsCheckingPolicy(false);
    }
  };

  // Add Website Wizard: Save Profile
  const handleWizardSubmit = async (startCrawlImmediately = false) => {
    if (!wizardName.trim() || !wizardDomain.trim()) {
      showToast("Profile name and domain are required.", "warning");
      return;
    }

    setIsCreatingProfile(true);
    const input: CrawlProfileCreateInput = {
      name: wizardName.trim(),
      domain: wizardDomain.trim(),
      description: wizardDesc.trim() || undefined,
      allowed_patterns: wizardAllowed
        ? wizardAllowed.split("\n").map((s) => s.trim()).filter(Boolean)
        : undefined,
      disallowed_patterns: wizardDisallowed
        ? wizardDisallowed.split("\n").map((s) => s.trim()).filter(Boolean)
        : undefined,
      title_selector: wizardTitleSel.trim() || undefined,
      authors_selector: wizardAuthorsSel.trim() || undefined,
      abstract_selector: wizardAbstractSel.trim() || undefined,
      doi_selector: wizardDoiSel.trim() || undefined,
      request_delay_ms: parseInt(wizardDelay, 10) || 1000,
      max_depth: parseInt(wizardMaxDepth, 10) || 2,
      max_pages: parseInt(wizardMaxPages, 10) || 20,
    };

    try {
      const newProfile = await createCrawlProfile(input);
      showToast(`Crawl profile '${input.name}' created!`, "success");
      setIsWizardOpen(false);
      resetWizard();
      await loadCrawlProfiles();

      if (startCrawlImmediately && wizardSeedUrl.trim()) {
        const job = await startCrawlJob(wizardSeedUrl.trim(), newProfile.id);
        showToast(`Crawl job started (ID: ${job.id.slice(0, 8)}...)`, "success");
        setActiveSection("downloads");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to create profile: ${msg}`, "error");
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardSeedUrl("");
    setPolicyCheck(null);
    setWizardMode("public_html");
    setWizardName("");
    setWizardDomain("");
    setWizardDesc("");
    setWizardDelay("1000");
    setWizardMaxDepth("2");
    setWizardMaxPages("20");
    setWizardAllowed("");
    setWizardDisallowed("");
    setWizardTitleSel("");
    setWizardAuthorsSel("");
    setWizardAbstractSel("");
    setWizardDoiSel("");
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete profile '${name}'?`)) return;
    try {
      await deleteCrawlProfile(id);
      showToast(`Profile '${name}' deleted`, "info");
      await loadCrawlProfiles();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to delete profile: ${msg}`, "error");
    }
  };

  const handleSinglePageImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleImportUrl.trim()) {
      showToast("Please enter a research paper URL.", "warning");
      return;
    }

    setIsImportingSingle(true);
    try {
      const paper = await importSinglePage(
        singleImportUrl.trim(),
        singleImportProfileId || null,
        singleImportCollectionId || null
      );
      showToast(`Imported: "${paper.title}"`, "success");
      setIsSingleImportOpen(false);
      setSingleImportUrl("");
      await refreshDatabase();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Import failed: ${msg}`, "error");
    } finally {
      setIsImportingSingle(false);
    }
  };

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlSeedUrl.trim() || !crawlStartProfile) return;

    setIsStartingCrawl(true);
    try {
      await startCrawlJob(crawlSeedUrl.trim(), crawlStartProfile.id);
      showToast(`Started crawl job for ${crawlStartProfile.name}`, "success");
      setCrawlStartProfile(null);
      setCrawlSeedUrl("");
      setActiveSection("downloads");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to start crawl: ${msg}`, "error");
    } finally {
      setIsStartingCrawl(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Website Sources & Scraper Profiles"
        description="Public website-driven paper discovery and extraction without third-party APIs. Compliant with robots.txt, Highwire Press, and Dublin Core standards."
      />

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("scraping")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "scraping"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Website Scraping Profiles ({crawlProfiles.length})</span>
          <Badge variant="success" size="sm">Active (No-API)</Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("academic")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "academic"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Academic API Connectors ({sources.length})</span>
          <Badge variant="outline" size="sm">Disabled in No-API Mode</Badge>
        </button>
      </div>

      {/* TAB 1: WEBSITE SCRAPING PROFILES (PRIMARY WORKFLOW) */}
      {activeTab === "scraping" && (
        <div className="space-y-8">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/20 dark:from-indigo-950/20 dark:via-slate-900 dark:to-indigo-950/10">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Website-Driven Paper Discovery</span>
              </h3>
              <p className="text-xs text-slate-500">
                Discover papers via public HTML pages, journal issue archives, and normal hyperlinks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSingleImportOpen(true)}
                className="flex items-center gap-1.5 text-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Import Single Page</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetWizard();
                  setIsWizardOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Website Source</span>
              </Button>
            </div>
          </div>

          {/* Section: URL Extraction Sandbox */}
          <div className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  <span>URL Extraction Sandbox (Live Test)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Verify metadata extraction, Highwire Press / Dublin Core meta tags, and Anti-SSRF safety for any scholarly web page.
                </p>
              </div>
            </div>

            <form onSubmit={handleTestExtraction} className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                placeholder="https://www.biorxiv.org/content/10.1101/2026.01.01.123456"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={testProfileId}
                onChange={(e) => setTestProfileId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Auto-Detect Profile</option>
                {crawlProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="primary" size="sm" disabled={isPreviewing}>
                <Play className="w-3.5 h-3.5 mr-1" />
                {isPreviewing ? "Extracting..." : "Preview Extraction"}
              </Button>
            </form>

            {/* Sandbox Results */}
            {previewResult && (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {previewResult.title || "Untitled Paper"}
                  </span>
                  <div className="flex gap-1">
                    {previewResult.extraction_methods_used.map((m) => (
                      <Badge key={m} variant="outline" size="sm">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="font-semibold">Authors: </span>
                    {previewResult.authors.length > 0
                      ? previewResult.authors.join(", ")
                      : "None detected"}
                  </div>
                  <div>
                    <span className="font-semibold">DOI: </span>
                    {previewResult.canonical_doi || "None detected"}
                  </div>
                  <div>
                    <span className="font-semibold">Publication Date: </span>
                    {previewResult.publication_date || "None detected"}
                  </div>
                  <div>
                    <span className="font-semibold">Venue: </span>
                    {previewResult.venue || "None detected"}
                  </div>
                </div>

                {previewResult.abstract_text && (
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Abstract:
                    </span>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 line-clamp-3">
                      {previewResult.abstract_text}
                    </p>
                  </div>
                )}

                {previewResult.pdf_url && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>PDF Full-Text Link: {previewResult.pdf_url}</span>
                  </div>
                )}

                {previewResult.discovered_paper_links.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    Discovered {previewResult.discovered_paper_links.length} eligible paper links on this page.
                  </div>
                )}

                {previewResult.warnings.length > 0 && (
                  <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 space-y-1">
                    {previewResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Configured Profiles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Configured Website Scraping Profiles
                </h3>
                <p className="text-xs text-slate-500">
                  Domain boundaries, allowed/disallowed URL regexes, polite rate limits, and custom CSS extraction rules.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetWizard();
                  setIsWizardOpen(true);
                }}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Website Source
              </Button>
            </div>

            {isLoadingProfiles ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading website scraping profiles...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crawlProfiles.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {p.name}
                            </h4>
                            {p.is_built_in ? (
                              <Badge variant="outline" size="sm">
                                Built-in
                              </Badge>
                            ) : (
                              <Badge variant="info" size="sm">
                                Custom
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">{p.domain}</span>
                        </div>

                        {!p.is_built_in && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id, p.name)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {p.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {p.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-500 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span>Delay: </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {p.request_delay_ms} ms
                          </span>
                        </div>
                        <div>
                          <span>Meta Tags: </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {p.use_meta_tags ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <div>
                          <span>Max Depth: </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {p.max_depth}
                          </span>
                        </div>
                        <div>
                          <span>Max Pages: </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {p.max_pages}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestProfileId(p.id);
                          setTestUrl(`https://${p.domain}`);
                        }}
                        className="text-xs"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-1" />
                        <span>Inspect in Sandbox</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setCrawlStartProfile(p);
                          setCrawlSeedUrl(`https://${p.domain}`);
                        }}
                        className="text-xs"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        <span>Run Crawl</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMIC CONNECTORS (DISABLED IN NO-API MODE) */}
      {activeTab === "academic" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">No-API Compliance Notice</span>
              <p>
                Academic provider APIs (OpenAlex, Crossref, Semantic Scholar, etc.) are inactive in compliance with the strict No-API Website-Driven specification. All research paper discovery is conducted via public HTML parsing, Highwire Press metadata, and Dublin Core tags under the Website Scraping Profiles tab.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {sources.map((source) => {
              return (
                <div
                  key={source.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {source.name}
                          </h3>
                          <Badge variant="outline" size="sm">
                            {source.tier}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {source.category}
                        </span>
                      </div>

                      {providerStatuses.find((p) => p.provider_id === source.id)?.is_configured ? (
                        <Badge variant="success" size="sm">
                          Configured (Inactive)
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm">
                          API Mode Inactive
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {source.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {source.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                        >
                          ✓ {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{source.rateLimit}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setApiKeyModalProvider(source.id);
                        setApiKeyInput("");
                      }}
                      className="text-xs"
                    >
                      <Key className="w-3.5 h-3.5 mr-1" />
                      Configure Key
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Add Website Source & Crawl Wizard */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Add Website Source & Crawl Wizard"
        description="Step-by-step setup with automated robots.txt verification, mode selection, and custom extraction rules."
      >
        <div className="py-2 text-xs space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Wizard Steps Indicator */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 text-[11px]">
            <span className={wizardStep === 1 ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-400"}>
              1. Seed URL & Policy
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className={wizardStep === 2 ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-400"}>
              2. Acquisition Mode
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className={wizardStep === 3 ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-400"}>
              3. Scope & Rules
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className={wizardStep === 4 ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-400"}>
              4. Review & Launch
            </span>
          </div>

          {/* STEP 1: Seed URL & Policy Check */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Seed Website / Section URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://www.biorxiv.org/content/early/recent"
                    value={wizardSeedUrl}
                    onChange={(e) => setWizardSeedUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isCheckingPolicy}
                    onClick={handleWizardCheckPolicy}
                  >
                    {isCheckingPolicy ? "Inspecting..." : "Check Policy"}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter a journal page, preprint archive, conference proceedings, or institutional repository URL.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Or pick a known scholarly repository:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: "bioRxiv Biology Preprints", url: "https://www.biorxiv.org/content/early/recent" },
                    { name: "PLOS ONE Open Access", url: "https://journals.plos.org/plosone/" },
                    { name: "Nature Scientific Reports", url: "https://www.nature.com/srep/" },
                    { name: "arXiv Physics & CS", url: "https://arxiv.org/list/cs/recent" },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setWizardSeedUrl(p.url)}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Acquisition Mode Selection */}
          {wizardStep === 2 && policyCheck && (
            <div className="space-y-4">
              {/* Policy Feedback Card */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{policyCheck.domain}</span>
                    <Badge variant={policyCheck.policy_state === "allowed" ? "success" : "warning"} size="sm">
                      {policyCheck.policy_state.toUpperCase()}
                    </Badge>
                  </div>
                  <Badge variant="outline" size="sm">
                    Platform: {policyCheck.detected_platform}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {policyCheck.message}
                </p>
                {policyCheck.crawl_delay_ms && (
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    Recommended polite crawl delay: {policyCheck.crawl_delay_ms} ms
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Choose Acquisition Mode:
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: "public_html",
                      name: "Public HTML Crawl (Recommended)",
                      desc: "Crawl ordinary public pages with Rust HTTP + HTML parser. High performance, zero external browser runtime required.",
                    },
                    {
                      id: "rendered",
                      name: "Rendered Website Mode (Sandboxed DOM)",
                      desc: "For dynamic JavaScript-rendered sites. Inspects client-side DOM after page hydration without private APIs.",
                    },
                    {
                      id: "manual",
                      name: "Manual Current-Page Import Only",
                      desc: "Extract bibliographic metadata only when explicitly triggered for a specific URL.",
                    },
                    {
                      id: "link_only",
                      name: "Link-Only Discovery",
                      desc: "Index paper records and public web links without downloading PDF documents.",
                    },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        wizardMode === m.id
                          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="acquisition_mode"
                        checked={wizardMode === m.id}
                        onChange={() => setWizardMode(m.id as "public_html" | "rendered" | "manual" | "link_only")}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {m.name}
                        </span>
                        <p className="text-[11px] text-slate-500">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button variant="primary" size="sm" onClick={() => setWizardStep(3)}>
                  Next: Scope & Rules
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Scope & Extraction Rules */}
          {wizardStep === 3 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Profile Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={wizardName}
                    onChange={(e) => setWizardName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Domain / Host Origin:
                  </label>
                  <input
                    type="text"
                    required
                    value={wizardDomain}
                    onChange={(e) => setWizardDomain(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Delay (ms):
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={wizardDelay}
                    onChange={(e) => setWizardDelay(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Max Depth:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={wizardMaxDepth}
                    onChange={(e) => setWizardMaxDepth(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Max Pages:
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={wizardMaxPages}
                    onChange={(e) => setWizardMaxPages(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Optional CSS Selectors (Fallback if meta tags are absent):
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Title: h1.article-title"
                    value={wizardTitleSel}
                    onChange={(e) => setWizardTitleSel(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="Authors: .authors-list a"
                    value={wizardAuthorsSel}
                    onChange={(e) => setWizardAuthorsSel(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="Abstract: .abstract p"
                    value={wizardAbstractSel}
                    onChange={(e) => setWizardAbstractSel(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="DOI: span.doi-value"
                    value={wizardDoiSel}
                    onChange={(e) => setWizardDoiSel(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(2)}>
                  Back
                </Button>
                <Button variant="primary" size="sm" onClick={() => setWizardStep(4)}>
                  Next: Review & Launch
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Launch */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {wizardName}
                  </span>
                  <Badge variant="outline" size="sm">
                    Mode: {wizardMode}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>Domain: <span className="font-mono text-slate-700 dark:text-slate-300">{wizardDomain}</span></div>
                  <div>Delay: <span className="font-mono text-slate-700 dark:text-slate-300">{wizardDelay} ms</span></div>
                  <div>Max Depth: <span className="font-mono text-slate-700 dark:text-slate-300">{wizardMaxDepth}</span></div>
                  <div>Max Pages: <span className="font-mono text-slate-700 dark:text-slate-300">{wizardMaxPages}</span></div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Highwire Press, Dublin Core, and Anti-SSRF URL validation active.</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(3)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCreatingProfile}
                    onClick={() => handleWizardSubmit(false)}
                  >
                    Save Profile Only
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isCreatingProfile}
                    onClick={() => handleWizardSubmit(true)}
                  >
                    {isCreatingProfile ? "Saving..." : "Save & Start Crawl"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Single-Page Direct Import */}
      <Modal
        isOpen={isSingleImportOpen}
        onClose={() => setIsSingleImportOpen(false)}
        title="Direct Single-Page Paper Import"
        description="Extract bibliographic metadata and eligible full-text PDF from a single research paper page."
      >
        <form onSubmit={handleSinglePageImport} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Research Paper URL:
            </label>
            <input
              type="url"
              required
              placeholder="https://www.biorxiv.org/content/10.1101/2026.01.01.123456v1"
              value={singleImportUrl}
              onChange={(e) => setSingleImportUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Profile (Optional):
              </label>
              <select
                value={singleImportProfileId}
                onChange={(e) => setSingleImportProfileId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Auto-Detect Platform</option>
                {crawlProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Target Collection:
              </label>
              <select
                value={singleImportCollectionId}
                onChange={(e) => setSingleImportCollectionId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">General Library</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSingleImportOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isImportingSingle}>
              {isImportingSingle ? "Importing..." : "Import to Library"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Start Crawl */}
      <Modal
        isOpen={Boolean(crawlStartProfile)}
        onClose={() => setCrawlStartProfile(null)}
        title={`Start Website Crawl: ${crawlStartProfile?.name}`}
        description="Launch a controlled, bounded crawl starting from a seed URL within this domain."
      >
        <form onSubmit={handleStartCrawl} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Seed URL:
            </label>
            <input
              type="url"
              required
              value={crawlSeedUrl}
              onChange={(e) => setCrawlSeedUrl(e.target.value)}
              placeholder={`https://${crawlStartProfile?.domain}/`}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500 space-y-1">
            <div>Domain Scope: <span className="font-semibold">{crawlStartProfile?.domain}</span></div>
            <div>Polite Request Delay: <span className="font-semibold">{crawlStartProfile?.request_delay_ms} ms</span></div>
            <div>Maximum Depth: <span className="font-semibold">{crawlStartProfile?.max_depth}</span></div>
            <div>Maximum Pages: <span className="font-semibold">{crawlStartProfile?.max_pages}</span></div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCrawlStartProfile(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isStartingCrawl}>
              {isStartingCrawl ? "Starting..." : "Start Crawl Job"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: API Key Configuration */}
      <Modal
        isOpen={Boolean(apiKeyModalProvider)}
        onClose={() => setApiKeyModalProvider(null)}
        title={`Configure API Key: ${apiKeyModalProvider}`}
        description="Keys are stored securely in local SQLite settings and never transmitted to third parties."
      >
        <form onSubmit={handleSaveApiKey} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              API Key:
            </label>
            <input
              type="password"
              required
              placeholder="Paste provider API key here"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApiKeyModalProvider(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSavingKey}>
              {isSavingKey ? "Saving..." : "Save Key"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
