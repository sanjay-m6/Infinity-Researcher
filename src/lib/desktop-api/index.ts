import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment, normalizeCommandError } from "../tauri-bridge";
import type {
  AppPlatformInfo,
  AcademicSearchQuery,
  AppSetting,
  CollectionCreateInput,
  CollectionUpdateInput,
  CrawlJob,
  CrawlJobPaper,
  CrawlProfile,
  CrawlProfileCreateInput,
  CrawlProfileUpdateInput,
  DatabaseInfo,
  DbCollection,
  DbNote,
  DbPaper,
  DbSource,
  DbTag,
  ExtractionPreviewResult,
  ImportSummary,
  NormalizedWork,
  NoteSaveInput,
  PagedResponse,
  PaperCreateInput,
  PaperListQuery,
  PaperUpdateInput,
  ProviderCapabilities,
  ProviderConfigStatus,
  ProviderHealthCheck,
  UnifiedSearchResponse,
  DuplicateComparisonView,
  MergeRequest,
  MergeResult,
  PaperFile,
  PaperIdentifier,
  ProcessingJob,
  ProcessingOverview,
  BulkDownloadSummary,
  CleanOrphanedResult,
  DownloadJob,
  DownloadStorageMetrics,
  EnqueueDownloadInput,
  PaperPdfInfo,
  PdfResolutionResult,
  ReaderState,
  WebsitePolicyCheck,
  IeeeManualImportInput,
  LocalOaPdfImportInput,
  OpenAccessStats,
  ImportPdfResult,
  ExtractedPdfMetadata,
  WebsiteSearchQuery,
  WebsiteSearchResponse,
  WebsiteSourceDescriptor,
  DiscoveredSearchResult,
  SearchStreamEvent,
  PythonEngineStatus,
  EngineDiagnostics,
  AiHardwareInfo,
  MatrixWorkspace,
  MatrixExtraction,
  EvidenceCopilotSession,
  EvidenceCopilotMessage,
  MatrixWorkspaceDetail,
  IngestedDocumentMeta,
  AnalysisJob,
  SavedIntegrityReportDb,
  SavedCitationAuditDb,
  SavedReadabilityReportDb,
  WritingRevisionDb,
  ExtractedDocumentResult,
  AiSignalDetectionResult,
  SavedSearch,
  SavedSearchCreateInput,
  SavedSearchUpdateInput,
  AiDiagnosticReport,
  DiagnosticTestGenResult,
  ResearchDomain,
  CreateDomainInput,
  CreateProjectInput,
  UpdateProjectInput,
  ResearchProject,
  ProjectWithDetails,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  ProjectMilestone,
  CreateTaskInput,
  UpdateTaskInput,
  ProjectTask,
  TaskWithDetails,
  ProjectPaper,
  TaskPaper,
  ProjectActivityEvent,
  AiProjectPlanProposal,
  ApplyPlanInput,
  HardwareProfile,
  DownloadProgress,
  InstalledModelInfo,
  LocalAiStatus,
} from "./types";

export * from "./types";
export * from "./adapters";
export {
  isTauriEnvironment,
  normalizeCommandError,
  getErrorMessage,
} from "../tauri-bridge";

/**
 * Invokes a typed Tauri command with error normalization.
 */
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw {
      code: "ERR_RUNTIME_UNAVAILABLE",
      message: `Desktop IPC unavailable for command "${cmd}". Running in web preview.`,
      retryable: false,
    };
  }

  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeCommandError(err);
  }
}

// ---------------------------------------------------------------------------
// Database Diagnostics
// ---------------------------------------------------------------------------

export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  return invokeCommand<DatabaseInfo>("get_database_info");
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

export async function listPapers(
  query: PaperListQuery = {}
): Promise<PagedResponse<DbPaper>> {
  return invokeCommand<PagedResponse<DbPaper>>("list_papers", { query });
}

export async function getPaper(id: string): Promise<DbPaper | null> {
  return invokeCommand<DbPaper | null>("get_paper", { id });
}

export async function createPaper(input: PaperCreateInput): Promise<DbPaper> {
  return invokeCommand<DbPaper>("create_paper", { input });
}

export async function updatePaper(input: PaperUpdateInput): Promise<DbPaper> {
  return invokeCommand<DbPaper>("update_paper", { input });
}

export async function deletePaper(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_paper", { id });
}

export async function toggleSavePaper(id: string, isSaved: boolean): Promise<boolean> {
  return invokeCommand<boolean>("toggle_save_paper", { id, isSaved });
}

export async function setPaperReadingStatus(
  id: string,
  status: string
): Promise<boolean> {
  return invokeCommand<boolean>("set_paper_reading_status", { id, status });
}

export async function setPaperReadingProgress(
  id: string,
  progress: number
): Promise<boolean> {
  return invokeCommand<boolean>("set_paper_reading_progress", { id, progress });
}

export async function bulkUpdateReadingStatus(
  paperIds: string[],
  status: string
): Promise<number> {
  return invokeCommand<number>("bulk_update_reading_status", { paperIds, status });
}

export async function touchPaperOpened(id: string): Promise<boolean> {
  return invokeCommand<boolean>("touch_paper_opened", { id });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function listCollections(): Promise<DbCollection[]> {
  return invokeCommand<DbCollection[]>("list_collections");
}

export async function createCollection(
  input: CollectionCreateInput
): Promise<DbCollection> {
  return invokeCommand<DbCollection>("create_collection", { input });
}

export async function updateCollection(input: CollectionUpdateInput): Promise<boolean> {
  return invokeCommand<boolean>("update_collection", { input });
}

export async function deleteCollection(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_collection", { id });
}

export async function addPaperToCollection(
  collectionId: string,
  paperId: string
): Promise<void> {
  return invokeCommand<void>("add_paper_to_collection", {
    collectionId,
    paperId,
  });
}

export async function removePaperFromCollection(
  collectionId: string,
  paperId: string
): Promise<boolean> {
  return invokeCommand<boolean>("remove_paper_from_collection", {
    collectionId,
    paperId,
  });
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function listTags(): Promise<DbTag[]> {
  return invokeCommand<DbTag[]>("list_tags");
}

export async function assignTagToPaper(paperId: string, tagName: string): Promise<DbTag> {
  return invokeCommand<DbTag>("assign_tag_to_paper", { paperId, tagName });
}

export async function removeTagFromPaper(
  paperId: string,
  tagId: string
): Promise<boolean> {
  return invokeCommand<boolean>("remove_tag_from_paper", { paperId, tagId });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function getNotesForPaper(paperId: string): Promise<DbNote[]> {
  return invokeCommand<DbNote[]>("get_notes_for_paper", { paperId });
}

export async function saveNote(input: NoteSaveInput): Promise<DbNote> {
  return invokeCommand<DbNote>("save_note", { input });
}

export async function deleteNote(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_note", { id });
}

export async function searchNotes(query: string): Promise<DbNote[]> {
  return invokeCommand<DbNote[]>("search_notes", { query });
}

// ---------------------------------------------------------------------------
// Saved Searches
// ---------------------------------------------------------------------------

export async function listSavedSearches(): Promise<SavedSearch[]> {
  return invokeCommand<SavedSearch[]>("list_saved_searches");
}

export async function getSavedSearch(id: string): Promise<SavedSearch | null> {
  return invokeCommand<SavedSearch | null>("get_saved_search", { id });
}

export async function createSavedSearch(
  input: SavedSearchCreateInput
): Promise<SavedSearch> {
  return invokeCommand<SavedSearch>("create_saved_search", { input });
}

export async function updateSavedSearch(input: SavedSearchUpdateInput): Promise<boolean> {
  return invokeCommand<boolean>("update_saved_search", { input });
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_saved_search", { id });
}

export async function touchSavedSearch(id: string): Promise<boolean> {
  return invokeCommand<boolean>("touch_saved_search", { id });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getAppSetting(key: string): Promise<string | null> {
  return invokeCommand<string | null>("get_app_setting", { key });
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  return invokeCommand<void>("set_app_setting", { key, value });
}

export async function listAppSettings(): Promise<AppSetting[]> {
  return invokeCommand<AppSetting[]>("list_app_settings");
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listSources(): Promise<DbSource[]> {
  return invokeCommand<DbSource[]>("list_sources");
}

// ---------------------------------------------------------------------------
// Academic Search & Unified Discovery (Phase 5)
// ---------------------------------------------------------------------------

export async function listAcademicProviders(): Promise<ProviderCapabilities[]> {
  const rawList = await invokeCommand<Record<string, unknown>[]>(
    "list_academic_providers"
  );
  return (rawList || []).map((p) => {
    const rawId = p.provider_id || p.id || "";
    const pid = String(rawId).toLowerCase().trim();
    return {
      id: pid,
      provider_id: pid,
      display_name: p.display_name ? String(p.display_name) : pid,
      description: p.description ? String(p.description) : "",
      documentation_url: p.documentation_url ? String(p.documentation_url) : "",
      supports_year_filter: Boolean(p.supports_year_filter),
      supports_open_access_filter: Boolean(p.supports_open_access_filter),
      supports_doi_lookup: Boolean(p.supports_doi_lookup),
      supports_pagination: Boolean(p.supports_pagination),
      requires_api_key: Boolean(p.requires_api_key),
      rate_limit_rps: typeof p.rate_limit_rps === "number" ? p.rate_limit_rps : 5.0,
      base_url: p.base_url ? String(p.base_url) : undefined,
      rate_limit_info: p.rate_limit_info ? String(p.rate_limit_info) : undefined,
    };
  });
}

export async function searchAcademicSources(
  query: AcademicSearchQuery
): Promise<UnifiedSearchResponse> {
  const sanitizedProviders = (query.providers || [])
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());

  const finalProviders =
    sanitizedProviders.length > 0
      ? sanitizedProviders
      : ["openalex", "crossref", "semantic_scholar", "arxiv", "europe_pmc"];

  const payload: AcademicSearchQuery = {
    ...query,
    providers: finalProviders,
  };

  return invokeCommand<UnifiedSearchResponse>("search_academic_sources", {
    query: payload,
  });
}

export async function importSearchResults(
  works: NormalizedWork[],
  targetCollectionId?: string | null
): Promise<ImportSummary> {
  return invokeCommand<ImportSummary>("import_search_results", {
    works,
    targetCollectionId: targetCollectionId ?? null,
  });
}

export async function getProviderConfigStatus(): Promise<ProviderConfigStatus[]> {
  return invokeCommand<ProviderConfigStatus[]>("get_provider_config_status");
}

export async function setProviderApiKey(
  providerId: string,
  apiKey: string
): Promise<void> {
  return invokeCommand<void>("set_provider_api_key", {
    providerId,
    apiKey,
  });
}

export async function checkAcademicProviderHealth(
  providerId?: string
): Promise<ProviderHealthCheck[]> {
  return invokeCommand<ProviderHealthCheck[]>("check_academic_provider_health", {
    providerId: providerId ?? null,
  });
}

export async function getAcademicProviderCapabilities(): Promise<ProviderCapabilities[]> {
  return invokeCommand<ProviderCapabilities[]>("get_provider_capabilities");
}

export async function enrichPaperMetadata(paperId: string): Promise<DbPaper> {
  return invokeCommand<DbPaper>("enrich_paper_metadata", { paperId });
}

// ---------------------------------------------------------------------------
// Website Scraping & Crawling Engine (Phase 6)
// ---------------------------------------------------------------------------

export async function listCrawlProfiles(): Promise<CrawlProfile[]> {
  return invokeCommand<CrawlProfile[]>("list_crawl_profiles");
}

export async function getCrawlProfile(id: string): Promise<CrawlProfile | null> {
  return invokeCommand<CrawlProfile | null>("get_crawl_profile", { id });
}

export async function createCrawlProfile(
  input: CrawlProfileCreateInput
): Promise<CrawlProfile> {
  return invokeCommand<CrawlProfile>("create_crawl_profile", { input });
}

export async function updateCrawlProfile(
  id: string,
  input: CrawlProfileUpdateInput
): Promise<CrawlProfile | null> {
  return invokeCommand<CrawlProfile | null>("update_crawl_profile", { id, input });
}

export async function deleteCrawlProfile(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_crawl_profile", { id });
}

export async function previewUrlExtraction(
  url: string,
  profileId?: string | null
): Promise<ExtractionPreviewResult> {
  return invokeCommand<ExtractionPreviewResult>("preview_url_extraction", {
    url,
    profileId: profileId ?? null,
  });
}

export async function startCrawlJob(
  startUrl: string,
  profileId?: string | null
): Promise<CrawlJob> {
  return invokeCommand<CrawlJob>("start_crawl_job", {
    startUrl,
    profileId: profileId ?? null,
  });
}

export async function pauseCrawlJob(jobId: string): Promise<void> {
  return invokeCommand<void>("pause_crawl_job", { jobId });
}

export async function resumeCrawlJob(jobId: string): Promise<void> {
  return invokeCommand<void>("resume_crawl_job", { jobId });
}

export async function cancelCrawlJob(jobId: string): Promise<void> {
  return invokeCommand<void>("cancel_crawl_job", { jobId });
}

export async function getCrawlJob(jobId: string): Promise<CrawlJob | null> {
  return invokeCommand<CrawlJob | null>("get_crawl_job", { jobId });
}

export async function listCrawlJobs(limit?: number): Promise<CrawlJob[]> {
  return invokeCommand<CrawlJob[]>("list_crawl_jobs", { limit: limit ?? null });
}

export async function listCrawledPapers(jobId: string): Promise<CrawlJobPaper[]> {
  return invokeCommand<CrawlJobPaper[]>("list_crawled_papers", { jobId });
}

export async function importCrawledPapers(
  jobId: string,
  paperIds?: string[],
  targetCollectionId?: string | null
): Promise<ImportSummary> {
  return invokeCommand<ImportSummary>("import_crawled_papers", {
    jobId,
    paperIds: paperIds ?? null,
    targetCollectionId: targetCollectionId ?? null,
  });
}

// ---------------------------------------------------------------------------
// Paper Processing, Deduplication & Document Integrity (Phase 7)
// ---------------------------------------------------------------------------

export async function getProcessingOverview(): Promise<ProcessingOverview> {
  return invokeCommand<ProcessingOverview>("get_processing_overview");
}

export async function startMetadataNormalization(): Promise<ProcessingJob> {
  return invokeCommand<ProcessingJob>("start_metadata_normalization");
}

export async function startDuplicateScan(): Promise<ProcessingJob> {
  return invokeCommand<ProcessingJob>("start_duplicate_scan");
}

export async function startPdfVerification(): Promise<ProcessingJob> {
  return invokeCommand<ProcessingJob>("start_pdf_verification");
}

export async function listDuplicateCandidates(
  status?: string | null,
  page?: number,
  pageSize?: number
): Promise<DuplicateComparisonView[]> {
  return invokeCommand<DuplicateComparisonView[]>("list_duplicate_candidates", {
    status: status ?? null,
    page: page ?? null,
    pageSize: pageSize ?? null,
  });
}

export async function resolveDuplicateCandidate(
  candidateId: string,
  decision: "kept_separate" | "deferred",
  notes?: string | null
): Promise<void> {
  return invokeCommand<void>("resolve_duplicate_candidate", {
    candidateId,
    decision,
    notes: notes ?? null,
  });
}

export async function mergePapers(request: MergeRequest): Promise<MergeResult> {
  return invokeCommand<MergeResult>("merge_papers", { request });
}

export async function listPaperFiles(
  paperId?: string | null,
  page?: number,
  pageSize?: number
): Promise<PaperFile[]> {
  return invokeCommand<PaperFile[]>("list_paper_files", {
    paperId: paperId ?? null,
    page: page ?? null,
    pageSize: pageSize ?? null,
  });
}

export async function listProcessingJobs(limit?: number): Promise<ProcessingJob[]> {
  return invokeCommand<ProcessingJob[]>("list_processing_jobs", {
    limit: limit ?? null,
  });
}

export async function getPaperIdentifiers(paperId: string): Promise<PaperIdentifier[]> {
  return invokeCommand<PaperIdentifier[]>("get_paper_identifiers", {
    paperId,
  });
}

// ---------------------------------------------------------------------------
// PDF Workspace, Embedded Viewer & Download Manager API
// ---------------------------------------------------------------------------

export async function readPaperPdf(paperId: string): Promise<ArrayBuffer> {
  return invokeCommand<ArrayBuffer>("read_paper_pdf", { paperId });
}

export async function getPaperPdfInfo(paperId: string): Promise<PaperPdfInfo> {
  return invokeCommand<PaperPdfInfo>("get_paper_pdf_info", { paperId });
}

export async function resolvePaperPdf(paperId: string): Promise<PdfResolutionResult> {
  return invokeCommand<PdfResolutionResult>("resolve_paper_pdf", { paperId });
}

export async function enqueuePdfDownload(
  input: EnqueueDownloadInput
): Promise<DownloadJob> {
  return invokeCommand<DownloadJob>("enqueue_pdf_download", { input });
}

export async function enqueueBulkPdfDownloads(
  paperIds: string[]
): Promise<BulkDownloadSummary> {
  return invokeCommand<BulkDownloadSummary>("enqueue_bulk_pdf_downloads", {
    request: { paper_ids: paperIds },
  });
}

export async function cancelPdfDownload(jobId: string): Promise<void> {
  return invokeCommand<void>("cancel_pdf_download", { jobId });
}

export async function retryPdfDownload(jobId: string): Promise<DownloadJob> {
  return invokeCommand<DownloadJob>("retry_pdf_download", { jobId });
}

export async function listPdfDownloadJobs(limit?: number): Promise<DownloadJob[]> {
  return invokeCommand<DownloadJob[]>("list_pdf_download_jobs", { limit: limit ?? null });
}

export async function clearCompletedPdfDownloads(): Promise<number> {
  return invokeCommand<number>("clear_completed_pdf_downloads");
}

export async function deletePdfDownloadJob(jobId: string): Promise<number> {
  return invokeCommand<number>("delete_pdf_download_job", { jobId });
}

export async function getDownloadStorageMetrics(): Promise<DownloadStorageMetrics> {
  return invokeCommand<DownloadStorageMetrics>("get_download_storage_metrics");
}

export async function cleanOrphanedDownloads(): Promise<CleanOrphanedResult> {
  return invokeCommand<CleanOrphanedResult>("clean_orphaned_downloads");
}

export async function saveReaderState(state: ReaderState): Promise<void> {
  return invokeCommand<void>("save_reader_state", { input: state });
}

export async function getReaderState(paperId: string): Promise<ReaderState | null> {
  return invokeCommand<ReaderState | null>("get_reader_state", { paperId });
}

export async function checkWebsitePolicy(url: string): Promise<WebsitePolicyCheck> {
  return invokeCommand<WebsitePolicyCheck>("check_website_policy", { url });
}

export async function importSinglePage(
  url: string,
  profileId?: string | null,
  targetCollectionId?: string | null
): Promise<DbPaper> {
  return invokeCommand<DbPaper>("import_single_page", {
    url,
    profileId: profileId ?? null,
    targetCollectionId: targetCollectionId ?? null,
  });
}

export async function importIeeePaper(
  input: IeeeManualImportInput
): Promise<ImportPdfResult> {
  return invokeCommand<ImportPdfResult>("import_ieee_paper", { input });
}

export async function importLocalOaPdf(
  input: LocalOaPdfImportInput
): Promise<ImportPdfResult> {
  return invokeCommand<ImportPdfResult>("import_local_oa_pdf", { input });
}

export async function extractPdfMetadata(
  filePath: string
): Promise<ExtractedPdfMetadata> {
  return invokeCommand<ExtractedPdfMetadata>("extract_pdf_metadata", {
    filePath,
  });
}

export async function getOpenAccessStats(): Promise<OpenAccessStats> {
  return invokeCommand<OpenAccessStats>("get_open_access_stats");
}

export async function listOpenAccessPapers(
  statusFilter?: string | null
): Promise<DbPaper[]> {
  return invokeCommand<DbPaper[]>("list_open_access_papers", {
    statusFilter: statusFilter ?? null,
  });
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("window_minimize");
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  return invokeCommand<boolean>("window_toggle_maximize");
}

export async function closeWindow(): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("window_close");
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  return invokeCommand<boolean>("window_is_maximized");
}

export async function startDraggingWindow(): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("window_start_dragging");
}

// ---------------------------------------------------------------------------
// Query-Based Academic Website Discovery (No-API)
// ---------------------------------------------------------------------------

export async function listWebsiteSearchSources(): Promise<WebsiteSourceDescriptor[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        id: "arxiv",
        name: "arXiv Preprints",
        domain: "arxiv.org",
        status: "enabled",
        policy_url: "https://arxiv.org/help/robots",
        policy_notes:
          "Permitted HTML search and metadata extraction with 3s crawl delay.",
        supports_native_years: false,
        request_delay_ms: 3000,
        content_types: ["preprint"],
      },
      {
        id: "biorxiv",
        name: "bioRxiv Preprints",
        domain: "biorxiv.org",
        status: "enabled",
        policy_url: "https://www.biorxiv.org/about/faq",
        policy_notes:
          "Cold Spring Harbor Laboratory preprint repository. Permitted HTML search.",
        supports_native_years: true,
        request_delay_ms: 2000,
        content_types: ["preprint"],
      },
      {
        id: "medrxiv",
        name: "medRxiv Preprints",
        domain: "medrxiv.org",
        status: "enabled",
        policy_url: "https://www.medrxiv.org/about/faq",
        policy_notes: "Medical preprint server. Permitted HTML search.",
        supports_native_years: true,
        request_delay_ms: 2000,
        content_types: ["preprint"],
      },
      {
        id: "plos",
        name: "PLOS Open Access Journals",
        domain: "journals.plos.org",
        status: "enabled",
        policy_url: "https://journals.plos.org/plosone/s/content-license",
        policy_notes: "100% open-access peer-reviewed journals under CC BY.",
        supports_native_years: true,
        request_delay_ms: 2000,
        content_types: ["journal_article"],
      },
      {
        id: "nature_srep",
        name: "Nature Scientific Reports",
        domain: "nature.com",
        status: "enabled",
        policy_url: "https://www.nature.com/srep/about",
        policy_notes: "Open-access peer-reviewed research from Nature Portfolio.",
        supports_native_years: false,
        request_delay_ms: 2500,
        content_types: ["journal_article"],
      },
      {
        id: "pmc",
        name: "PubMed Central (PMC)",
        domain: "pmc.ncbi.nlm.nih.gov",
        status: "enabled",
        policy_url: "https://pmc.ncbi.nlm.nih.gov/about/mou/",
        policy_notes: "Public web interface and Open Access subset.",
        supports_native_years: false,
        request_delay_ms: 3000,
        content_types: ["journal_article"],
      },
      {
        id: "ieee_xplore",
        name: "IEEE Xplore",
        domain: "ieeexplore.ieee.org",
        status: "enabled",
        policy_url: "https://ieeexplore.ieee.org/XploreHelp/legal-terms",
        policy_notes:
          "IEEE conference and journal research publications via official REST and Crossref prefix index.",
        supports_native_years: true,
        request_delay_ms: 1000,
        content_types: ["conference_paper", "journal_article"],
      },
      {
        id: "acm_dl",
        name: "ACM Digital Library",
        domain: "dl.acm.org",
        status: "enabled",
        policy_url: "https://www.acm.org/about-acm/terms-of-use",
        policy_notes:
          "ACM Digital Library publications and conference proceedings via Crossref prefix 10.1145 and ACM DL indexing.",
        supports_native_years: true,
        request_delay_ms: 1000,
        content_types: ["conference_paper", "journal_article"],
      },
      {
        id: "google_scholar",
        name: "Google Scholar",
        domain: "scholar.google.com",
        status: "enabled",
        policy_url: "https://policies.google.com/terms",
        policy_notes:
          "Google Scholar query discovery with live parsing and automated open scholarly catalog fallback.",
        supports_native_years: true,
        request_delay_ms: 1500,
        content_types: ["all"],
      },
    ];
  }
  return invokeCommand<WebsiteSourceDescriptor[]>("list_website_search_sources");
}

export async function searchWebsiteSources(
  query: WebsiteSearchQuery
): Promise<WebsiteSearchResponse> {
  if (!isTauriEnvironment()) {
    return {
      results: [],
      source_statuses: [],
      total_results: 0,
      completed_at: new Date().toISOString(),
    };
  }

  return invokeCommand<WebsiteSearchResponse>("search_website_sources", { query });
}

export async function importDiscoveredSearchResult(
  result: DiscoveredSearchResult,
  targetCollectionId?: string
): Promise<DbPaper> {
  if (!isTauriEnvironment()) {
    return {
      id: "paper_" + Math.random().toString(36).substring(2, 9),
      title: result.title,
      clean_title_key: result.title.toLowerCase().replace(/[^a-z0-9]/g, ""),
      canonical_doi: result.canonical_doi || null,
      abstract_text: result.abstract_text || null,
      publication_date: result.publication_date || null,
      publication_year: result.publication_year || null,
      venue: result.venue || null,
      venue_type: null,
      language: result.language || "en",
      is_open_access: result.is_open_access,
      license: result.license_name || null,
      primary_landing_url: result.landing_url,
      pdf_url: result.pdf_url || null,
      has_file: false,
      local_pdf_path: null,
      content_hash: null,
      metadata_confidence: "high",
      citation_count: 0,
      reference_count: 0,
      is_saved: true,
      reading_status: "unread",
      reading_progress: 0,
      open_access_status: result.is_open_access
        ? "verified_open_access"
        : "access_unverified",
      access_evidence_type: "permitted_source_search",
      access_evidence_note: `Discovered via ${result.source_name}`,
      license_name: result.license_name || null,
      license_url: null,
      source_name: result.source_name,
      retrieval_method: "public_web_connector",
      access_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      authors: result.authors.map((a, idx) => ({
        id: `author_${idx}`,
        paper_id: "paper_temp",
        full_name: a,
        family_name: a.split(" ").slice(-1)[0] || a,
        given_name: a.split(" ").slice(0, -1).join(" ") || null,
        orcid: null,
        affiliation: null,
        author_order: idx + 1,
        created_at: new Date().toISOString(),
      })),
      tags: [],
      collection_ids: [],
      source_names: [result.source_name],
    };
  }

  return invokeCommand<DbPaper>("import_discovered_search_result", {
    result,
    targetCollectionId: targetCollectionId || null,
  });
}

// ---------------------------------------------------------------------------
// Streaming Search & In-Panel PDF Preview
// ---------------------------------------------------------------------------

export async function startWebsiteSearchStream(
  query: WebsiteSearchQuery,
  onEvent: (event: SearchStreamEvent) => void,
  sessionId?: string
): Promise<() => void> {
  const activeSessionId =
    sessionId || `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!isTauriEnvironment()) {
    // Mock simulation for Vitest / non-desktop preview
    const timeoutId = setTimeout(() => {
      onEvent({
        type: "search_started",
        session_id: activeSessionId,
        query: query.query,
        sources: query.sources || ["arxiv", "plos", "biorxiv", "medrxiv", "pmc"],
      });
      onEvent({
        type: "source_status",
        session_id: activeSessionId,
        source_id: "arxiv",
        source_name: "arXiv Preprints",
        status: "searching",
        message: null,
        results_count: 0,
        elapsed_ms: 50,
      });
      const mockPaper: DiscoveredSearchResult = {
        id: "mock_arxiv_001",
        title: `Simulated Research on ${query.query || "Machine Learning"}`,
        authors: ["A. Researcher", "B. Scientist"],
        publication_date: "2024-03-15",
        publication_year: 2024,
        venue: "arXiv cs.AI",
        canonical_doi: null,
        abstract_text:
          "A simulated preprint abstract for preview and testing environments.",
        landing_url: "https://arxiv.org/abs/2403.00001",
        pdf_url: "https://arxiv.org/pdf/2403.00001.pdf",
        source_id: "arxiv",
        source_name: "arXiv Preprints",
        content_type: "preprint",
        is_open_access: true,
        license_name: "arXiv.org perpetual non-exclusive license",
        peer_reviewed: false,
        subject_tags: ["cs.AI", "cs.LG"],
        language: "en",
        relevance_score: 1.0,
      };
      onEvent({
        type: "paper_found",
        session_id: activeSessionId,
        source_id: "arxiv",
        paper: mockPaper,
      });
      onEvent({
        type: "source_completed",
        session_id: activeSessionId,
        source_id: "arxiv",
        count: 1,
        elapsed_ms: 120,
      });
      onEvent({
        type: "source_status",
        session_id: activeSessionId,
        source_id: "plos",
        source_name: "PLOS Open Access Journals",
        status: "unsupported",
        message:
          "PLOS search requires browser execution (AJAX). Use official web search.",
        results_count: 0,
        elapsed_ms: 150,
      });
      onEvent({
        type: "source_status",
        session_id: activeSessionId,
        source_id: "biorxiv",
        source_name: "bioRxiv Preprints",
        status: "blocked",
        message: "Source is protected by Cloudflare bot management (HTTP 403).",
        results_count: 0,
        elapsed_ms: 180,
      });
      onEvent({
        type: "search_completed",
        session_id: activeSessionId,
        total_unique: 1,
        duration_ms: 200,
      });
    }, 20);

    return () => clearTimeout(timeoutId);
  }

  const { listen } = await import("@tauri-apps/api/event");
  const channelName = `search_stream_${activeSessionId}`;

  let isUnsubscribed = false;
  const unlistenPromise = listen<SearchStreamEvent>(channelName, (event) => {
    if (!isUnsubscribed) {
      onEvent(event.payload);
    }
  });

  const unlistenFn = await unlistenPromise;

  invokeCommand<void>("start_website_search_stream", {
    sessionId: activeSessionId,
    query,
  }).catch((err: unknown) => {
    if (!isUnsubscribed) {
      const errorMsg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      onEvent({
        type: "search_error",
        session_id: activeSessionId,
        source_id: null,
        message: errorMsg || "Failed to start search stream",
      });
    }
  });

  return () => {
    isUnsubscribed = true;
    unlistenFn();
    cancelWebsiteSearch(activeSessionId).catch(() => {});
  };
}

export async function cancelWebsiteSearch(sessionId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }
  return invokeCommand<void>("cancel_website_search", { sessionId });
}

export async function getScrapingEngineDiagnostics(): Promise<EngineDiagnostics> {
  if (!isTauriEnvironment()) {
    return {
      engine_version: "2.1.0-spider-hardened (web preview)",
      engine_status: "ready",
      uptime_seconds: 120,
      total_searches: 1,
      successful_searches: 1,
      failed_searches: 0,
      cancelled_searches: 0,
      active_sessions: 0,
      sources: [
        {
          source_id: "arxiv",
          source_name: "arXiv Preprints",
          status: "enabled",
          total_requests: 1,
          successful_requests: 1,
          failed_requests: 0,
          total_papers_found: 1,
          last_elapsed_ms: 120,
          last_error: null,
        },
      ],
      recent_jobs: [],
    };
  }
  return invokeCommand<EngineDiagnostics>("get_scraping_engine_diagnostics");
}

export async function fetchRemotePdfPreview(
  url: string,
  doi?: string | null,
  title?: string | null
): Promise<ArrayBuffer> {
  if (!isTauriEnvironment()) {
    const minimalPdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n193\n%%EOF`;
    return new TextEncoder().encode(minimalPdf).buffer as ArrayBuffer;
  }
  return invokeCommand<ArrayBuffer>("fetch_remote_pdf_preview", {
    url,
    doi: doi ?? null,
    title: title ?? null,
  });
}

export async function startPythonSearchStream(
  query: WebsiteSearchQuery,
  onEvent: (event: SearchStreamEvent) => void,
  sessionId?: string
): Promise<() => void> {
  const activeSessionId =
    sessionId || `py_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (!isTauriEnvironment()) {
    // In web preview, reuse mock stream
    return startWebsiteSearchStream(query, onEvent, activeSessionId);
  }

  const { listen } = await import("@tauri-apps/api/event");
  const channelName = `search_stream_${activeSessionId}`;

  let isUnsubscribed = false;
  const unlistenPromise = listen<SearchStreamEvent>(channelName, (event) => {
    if (!isUnsubscribed) {
      onEvent(event.payload);
    }
  });

  const unlistenFn = await unlistenPromise;

  invokeCommand<void>("start_python_search_stream", {
    sessionId: activeSessionId,
    query,
  }).catch((err: unknown) => {
    if (!isUnsubscribed) {
      const errorMsg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      onEvent({
        type: "search_error",
        session_id: activeSessionId,
        source_id: null,
        message: errorMsg || "Failed to start Python search stream",
      });
    }
  });

  return () => {
    isUnsubscribed = true;
    unlistenFn();
    cancelPythonSearch(activeSessionId).catch(() => {});
  };
}

export async function cancelPythonSearch(sessionId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }
  return invokeCommand<void>("cancel_python_search", { sessionId });
}

export async function listPythonSearchSources(): Promise<WebsiteSourceDescriptor[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        id: "arxiv",
        name: "arXiv (Python Engine)",
        domain: "arxiv.org",
        status: "enabled",
        policy_url: "https://arxiv.org/help/robots",
        policy_notes: "Open access physics, math, and computer science preprints.",
        supports_native_years: false,
        request_delay_ms: 400,
        content_types: ["Preprint"],
      },
      {
        id: "biorxiv",
        name: "bioRxiv (Python Engine)",
        domain: "biorxiv.org",
        status: "enabled",
        policy_url: "https://www.biorxiv.org/about-biorxiv",
        policy_notes: "Biological sciences preprints from Cold Spring Harbor Laboratory.",
        supports_native_years: false,
        request_delay_ms: 500,
        content_types: ["Preprint"],
      },
      {
        id: "pubmed",
        name: "PubMed (Python Engine)",
        domain: "pubmed.ncbi.nlm.nih.gov",
        status: "enabled",
        policy_url: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
        policy_notes: "Biomedical literature with PMC open access full-text detection.",
        supports_native_years: false,
        request_delay_ms: 400,
        content_types: ["Journal Article", "Review"],
      },
      {
        id: "plos",
        name: "PLOS (Python Engine)",
        domain: "journals.plos.org",
        status: "enabled",
        policy_url: "https://plos.org/open-science/",
        policy_notes: "Peer-reviewed open access scientific journals (CC BY 4.0).",
        supports_native_years: false,
        request_delay_ms: 500,
        content_types: ["Journal Article"],
      },
    ];
  }
  return invokeCommand<WebsiteSourceDescriptor[]>("list_python_search_sources");
}

export async function getPythonEngineStatus(): Promise<PythonEngineStatus> {
  if (!isTauriEnvironment()) {
    return {
      available: true,
      python_path: "python",
      engine_dir: "python-engine/src",
      version: "1.0.0",
    };
  }
  return invokeCommand<PythonEngineStatus>("get_python_engine_status");
}

// ---------------------------------------------------------------------------
// AI Workspace & Provider API
// ---------------------------------------------------------------------------

import type {
  PageTextItem,
  AiProvider,
  AiProviderTaskRoute,
  AiPaperChunk,
  AiChunkCitation,
  VerifiedEvidenceItem,
  AiRagContext,
  AiChatSession,
  AiChatMessage,
  AiRecommendation,
  AiEvaluationResult,
  AiFinetuningJob,
  AiSettings,
  ProviderTestResult,
  GenerateRequestInput,
  GenerateResponseOutput,
} from "./types";

export const DEFAULT_AI_PROVIDERS: AiProvider[] = [
  {
    id: "ollama_local",
    display_name: "Ollama Local Runtime",
    category: "local_runtime",
    endpoint_url: "http://127.0.0.1:11434",
    doc_url: "https://docs.ollama.com/api",
    auth_type: "none",
    access_category: "local",
    default_model: "llama3.2:latest",
    embedding_model: "nomic-embed-text:latest",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: true,
    is_enabled: true,
    priority: 1,
    last_verified_at: "2026-10-25",
    last_health_status: "connected",
    supported_capabilities: ["chat", "streaming", "embeddings", "local"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "lm_studio_local",
    display_name: "LM Studio Local Server",
    category: "local_runtime",
    endpoint_url: "http://127.0.0.1:1234/v1",
    doc_url: "https://lmstudio.ai/docs/developer/core/server",
    auth_type: "none",
    access_category: "local",
    default_model: "local-model",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: true,
    is_enabled: true,
    priority: 2,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "local"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "llamacpp_local",
    display_name: "llama.cpp Server",
    category: "local_runtime",
    endpoint_url: "http://127.0.0.1:8080/v1",
    doc_url: "https://github.com/ggerganov/llama.cpp",
    auth_type: "none",
    access_category: "local",
    default_model: "default",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: true,
    is_enabled: false,
    priority: 3,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "local"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "generic_openai",
    display_name: "Generic OpenAI-Compatible Endpoint",
    category: "custom_endpoint",
    endpoint_url: "http://127.0.0.1:8000/v1",
    doc_url: "https://developers.openai.com/api/docs/",
    auth_type: "bearer_token",
    access_category: "self_hosted",
    default_model: "default",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: true,
    is_enabled: false,
    priority: 4,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "nvidia_nim",
    display_name: "NVIDIA NIM / API Catalog",
    category: "cloud_hosted",
    endpoint_url: "https://integrate.api.nvidia.com/v1",
    doc_url: "https://docs.api.nvidia.com/nim/docs/api-quickstart",
    auth_type: "api_key",
    access_category: "trial_or_credit",
    default_model: "mistralai/mistral-large-4-1t-a52b",
    timeout_secs: 45,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 32768,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 5,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "open_weight"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "groq_cloud",
    display_name: "GroqCloud",
    category: "cloud_hosted",
    endpoint_url: "https://api.groq.com/openai/v1",
    doc_url: "https://console.groq.com/docs",
    auth_type: "api_key",
    access_category: "hosted_free_tier",
    default_model: "llama-3.3-70b-versatile",
    timeout_secs: 30,
    max_tokens: 8192,
    temperature: 0.2,
    context_length: 32768,
    streaming_enabled: true,
    is_local: false,
    is_enabled: true,
    priority: 6,
    last_verified_at: "2026-10-25",
    last_health_status: "connected",
    supported_capabilities: ["chat", "streaming", "open_weight"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cerebras",
    display_name: "Cerebras Inference",
    category: "cloud_hosted",
    endpoint_url: "https://api.cerebras.ai/v1",
    doc_url: "https://inference-docs.cerebras.ai/",
    auth_type: "api_key",
    access_category: "hosted_free_tier",
    default_model: "llama3.1-8b",
    timeout_secs: 30,
    max_tokens: 8192,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 7,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "open_weight"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "huggingface",
    display_name: "Hugging Face Inference Providers",
    category: "cloud_hosted",
    endpoint_url: "https://api-inference.huggingface.co/v1",
    doc_url: "https://huggingface.co/docs/inference-providers/index",
    auth_type: "api_key",
    access_category: "trial_or_credit",
    default_model: "meta-llama/Llama-3.2-3B-Instruct",
    timeout_secs: 45,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 8,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "embeddings"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "openrouter",
    display_name: "OpenRouter",
    category: "cloud_hosted",
    endpoint_url: "https://openrouter.ai/api/v1",
    doc_url: "https://openrouter.ai/docs",
    auth_type: "api_key",
    access_category: "hosted_free_models",
    default_model: "meta-llama/llama-3.2-3b-instruct:free",
    timeout_secs: 45,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 16384,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 9,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "free_tier_routes"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "gemini_api",
    display_name: "Google Gemini Developer API",
    category: "cloud_hosted",
    endpoint_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    doc_url: "https://ai.google.dev/gemini-api/docs",
    auth_type: "api_key",
    access_category: "hosted_free_tier",
    default_model: "gemini-1.5-flash",
    timeout_secs: 45,
    max_tokens: 8192,
    temperature: 0.2,
    context_length: 32768,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 10,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "embeddings", "vision"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cloudflare_ai",
    display_name: "Cloudflare Workers AI",
    category: "cloud_hosted",
    endpoint_url: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/",
    doc_url: "https://developers.cloudflare.com/workers-ai/",
    auth_type: "api_key",
    access_category: "hosted_free_tier",
    default_model: "@cf/meta/llama-3.1-8b-instruct",
    timeout_secs: 30,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 8192,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 11,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "embeddings"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "openai",
    display_name: "OpenAI API",
    category: "cloud_hosted",
    endpoint_url: "https://api.openai.com/v1",
    doc_url: "https://developers.openai.com/api/docs/",
    auth_type: "api_key",
    access_category: "paid",
    default_model: "gpt-4o-mini",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 16384,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 12,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "embeddings", "vision"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "anthropic",
    display_name: "Anthropic Claude API",
    category: "cloud_hosted",
    endpoint_url: "https://api.anthropic.com/v1",
    doc_url: "https://platform.claude.com/docs/en/api/overview",
    auth_type: "api_key",
    access_category: "paid",
    default_model: "claude-3-5-haiku-latest",
    timeout_secs: 60,
    max_tokens: 4096,
    temperature: 0.2,
    context_length: 32768,
    streaming_enabled: true,
    is_local: false,
    is_enabled: false,
    priority: 13,
    last_verified_at: "2026-10-25",
    last_health_status: "untested",
    supported_capabilities: ["chat", "streaming", "vision"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function listAiProviders(): Promise<AiProvider[]> {
  if (!isTauriEnvironment()) {
    return DEFAULT_AI_PROVIDERS;
  }
  try {
    const list = await invokeCommand<AiProvider[]>("list_ai_providers");
    return list && list.length > 0 ? list : DEFAULT_AI_PROVIDERS;
  } catch (err) {
    console.warn("Failed to load providers from desktop IPC, using defaults:", err);
    return DEFAULT_AI_PROVIDERS;
  }
}

export async function getAiProvider(providerId: string): Promise<AiProvider | null> {
  return invokeCommand<AiProvider | null>("get_ai_provider", { providerId });
}

export async function saveAiProvider(provider: AiProvider): Promise<void> {
  return invokeCommand<void>("save_ai_provider", { provider });
}

export async function deleteAiProvider(providerId: string): Promise<void> {
  return invokeCommand<void>("delete_ai_provider", { providerId });
}

export async function setAiProviderEnabled(
  providerId: string,
  isEnabled: boolean
): Promise<void> {
  return invokeCommand<void>("set_ai_provider_enabled", { providerId, isEnabled });
}

export async function setAiProviderModel(
  providerId: string,
  model: string
): Promise<void> {
  return invokeCommand<void>("set_ai_provider_model", { providerId, model });
}

export async function setAiProviderCredential(
  providerId: string,
  apiKey: string
): Promise<void> {
  return invokeCommand<void>("set_ai_provider_credential", { providerId, apiKey });
}

export async function clearAiProviderCredential(providerId: string): Promise<void> {
  return invokeCommand<void>("clear_ai_provider_credential", { providerId });
}

export async function testAiProvider(providerId: string): Promise<ProviderTestResult> {
  if (!isTauriEnvironment()) {
    return {
      provider_id: providerId,
      success: true,
      latency_ms: 45,
      message: "Browser mock connection test successful",
      detected_models: ["llama3.2:latest", "mistral:latest"],
    };
  }
  return invokeCommand<ProviderTestResult>("test_ai_provider", { providerId });
}

export const DEFAULT_AI_TASK_ROUTES: AiProviderTaskRoute[] = [
  {
    task_type: "quick_summary",
    provider_id: "ollama_local",
    model_id: "llama3.2:latest",
    updated_at: "",
  },
  {
    task_type: "deep_analysis",
    provider_id: "ollama_local",
    model_id: "llama3.2:latest",
    updated_at: "",
  },
  {
    task_type: "qa_citations",
    provider_id: "ollama_local",
    model_id: "llama3.2:latest",
    updated_at: "",
  },
  {
    task_type: "cross_paper_compare",
    provider_id: "ollama_local",
    model_id: "llama3.2:latest",
    updated_at: "",
  },
  {
    task_type: "recommendations",
    provider_id: "ollama_local",
    model_id: "llama3.2:latest",
    updated_at: "",
  },
  {
    task_type: "embeddings",
    provider_id: "ollama_local",
    model_id: "nomic-embed-text:latest",
    updated_at: "",
  },
];

export async function listAiTaskRoutes(): Promise<AiProviderTaskRoute[]> {
  if (!isTauriEnvironment()) {
    return DEFAULT_AI_TASK_ROUTES;
  }
  try {
    const routes = await invokeCommand<AiProviderTaskRoute[]>("list_ai_task_routes");
    return routes && routes.length > 0 ? routes : DEFAULT_AI_TASK_ROUTES;
  } catch (err) {
    console.warn("Failed to load task routes from desktop IPC, using defaults:", err);
    return DEFAULT_AI_TASK_ROUTES;
  }
}

export async function setAiTaskRoute(
  taskType: string,
  providerId: string,
  modelId: string
): Promise<void> {
  return invokeCommand<void>("set_ai_task_route", { taskType, providerId, modelId });
}

export async function getAiSettings(): Promise<AiSettings> {
  if (!isTauriEnvironment()) {
    return {
      local_only_mode: false,
      never_use_paid_apis: true,
      cloud_paper_sharing_enabled: false,
      active_rag_scope: "paper",
      default_audience_level: "researcher",
      recommendations_diversity_weight: 0.35,
    };
  }
  return invokeCommand<AiSettings>("get_ai_settings");
}

export async function updateAiSettings(settings: AiSettings): Promise<void> {
  return invokeCommand<void>("update_ai_settings", { settings });
}

export async function indexPaperForRag(paperId: string): Promise<number> {
  if (!isTauriEnvironment()) return 8;
  return invokeCommand<number>("index_paper_for_rag", { paperId });
}

export async function indexPaperPageTexts(
  paperId: string,
  pages: PageTextItem[],
  title?: string,
  canonicalDoi?: string
): Promise<number> {
  if (!isTauriEnvironment()) return pages.length * 2;
  return invokeCommand<number>("index_paper_page_texts", {
    paperId,
    pages,
    title: title || null,
    canonicalDoi: canonicalDoi || null,
  });
}

export async function getPaperRagChunks(paperId: string): Promise<AiPaperChunk[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiPaperChunk[]>("get_paper_rag_chunks", { paperId });
}

export async function searchRagPassages(
  query: string,
  paperId?: string | null,
  scope: string = "paper",
  limit?: number
): Promise<AiRagContext> {
  if (!isTauriEnvironment()) {
    return {
      query,
      scope,
      paper_id: paperId,
      passages: [],
      warnings: [],
      is_grounded: false,
    };
  }
  return invokeCommand<AiRagContext>("search_rag_passages", {
    query,
    paperId,
    scope,
    limit,
  });
}

export async function searchRagPassagesMulti(
  query: string,
  paperIds: string[],
  limit?: number
): Promise<AiRagContext> {
  if (!isTauriEnvironment()) {
    return {
      query,
      scope: "multi_paper",
      paper_id: paperIds[0] ?? null,
      passages: [],
      warnings: [],
      is_grounded: false,
    };
  }
  return invokeCommand<AiRagContext>("search_rag_passages_multi", {
    query,
    paperIds,
    limit,
  });
}

export async function validateAiCitations(
  paperId: string,
  citations: AiChunkCitation[]
): Promise<VerifiedEvidenceItem[]> {
  if (!isTauriEnvironment()) {
    return citations.map((c) => ({
      chunk_id: c.chunk_id,
      paper_id: c.paper_id,
      page_number: c.page_number,
      section_heading: c.section_heading,
      snippet: c.snippet,
      is_verified: true,
      verification_method: "browser_simulated",
      confidence: 0.95,
    }));
  }
  return invokeCommand<VerifiedEvidenceItem[]>("validate_ai_citations", {
    paperId,
    citations,
  });
}

export async function generateAiResponse(
  input: GenerateRequestInput
): Promise<GenerateResponseOutput> {
  if (!isTauriEnvironment()) {
    try {
      const res = await fetch("http://127.0.0.1:11435/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `/no_think\n${input.prompt}` }],
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return {
          text,
          citations: [],
          provider_id: "in_app_local",
          model_id: "qwen",
          latency_ms: 120,
          is_grounded: false,
        };
      }
    } catch {
      // Offline fallback
    }

    return {
      text: `[Browser Preview] Grounded response to: "${input.prompt}". Based on Page 2 and Page 4. Direct evidence indicates strong empirical gains across the evaluation suite.`,
      citations: [
        {
          chunk_id: "preview_chunk_1",
          paper_id: input.paper_id || "paper_1",
          paper_title: "Preview Paper",
          page_number: 2,
          section_heading: "Methodology",
          snippet:
            "We formulate the retrieval model using dense passage index representations.",
          score: 0.88,
        },
      ],
      provider_id: "in_app_local",
      model_id: "qwen",
      latency_ms: 120,
      is_grounded: true,
    };
  }
  return invokeCommand<GenerateResponseOutput>("generate_ai_response", { input });
}

export async function listAiChatSessions(): Promise<AiChatSession[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiChatSession[]>("list_ai_chat_sessions");
}

export async function createAiChatSession(session: AiChatSession): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("create_ai_chat_session", { session });
}

export async function deleteAiChatSession(sessionId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("delete_ai_chat_session", { sessionId });
}

export async function listAiChatMessages(sessionId: string): Promise<AiChatMessage[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiChatMessage[]>("list_ai_chat_messages", { sessionId });
}

export async function saveAiChatMessage(message: AiChatMessage): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("save_ai_chat_message", { message });
}

export async function clearAiChatSession(sessionId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("clear_ai_chat_session", { sessionId });
}

export async function getAiRecommendations(
  paperId: string,
  mode: string = "next_paper",
  limit?: number
): Promise<AiRecommendation[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        id: "rec_1",
        paper_id: paperId,
        recommended_paper_id: "cand_1",
        recommended_title: "Attention Is All You Need",
        recommended_authors: ["Ashish Vaswani", "Noam Shazeer"],
        recommended_year: 2017,
        recommended_venue: "NeurIPS",
        recommended_doi: "10.48550/arXiv.1706.03762",
        score: 0.94,
        reason: "Seminal architecture introducing multi-head self-attention mechanisms.",
        matched_concepts: ["self-attention", "transformer", "neural translation"],
        confidence_label: "Strong Relevance (94%)",
        recommendation_mode: mode,
        feedback_status: "none",
        updated_at: new Date().toISOString(),
      },
    ];
  }
  return invokeCommand<AiRecommendation[]>("get_ai_recommendations", {
    paperId,
    mode,
    limit,
  });
}

export async function submitRecommendationFeedback(
  recommendationId: string,
  feedbackStatus: string,
  feedbackNote?: string | null
): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("submit_recommendation_feedback", {
    recommendationId,
    feedbackStatus,
    feedbackNote,
  });
}

export async function runAiEvaluation(
  suiteName: string,
  provider_id: string,
  model_id: string
): Promise<AiEvaluationResult> {
  if (!isTauriEnvironment()) {
    return {
      id: "eval_mock",
      benchmark_suite: suiteName,
      provider_id,
      model_id,
      total_tests: 5,
      passed_tests: 5,
      citation_accuracy: 1.0,
      abstention_accuracy: 1.0,
      avg_latency_ms: 85,
      evaluated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<AiEvaluationResult>("run_ai_evaluation", {
    suiteName,
    providerId: provider_id,
    modelId: model_id,
  });
}

export async function listAiEvaluations(): Promise<AiEvaluationResult[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiEvaluationResult[]>("list_ai_evaluations");
}

export async function listAiFinetuningJobs(): Promise<AiFinetuningJob[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<AiFinetuningJob[]>("list_ai_finetuning_jobs");
}

export async function getAiHardwareInfo(): Promise<AiHardwareInfo> {
  if (!isTauriEnvironment()) {
    return {
      os: "windows",
      arch: "x86_64",
      cuda_available: false,
      min_recommended_vram_gb: 12,
      supported_methods: ["PEFT/LoRA", "QLoRA 4-bit"],
      notice:
        "Browser simulation environment. Local hardware detection active in desktop app.",
    };
  }
  return invokeCommand<AiHardwareInfo>("get_ai_hardware_info");
}

export async function createAiFinetuningJob(
  modelName: string,
  adapterName: string,
  datasetSize: number,
  epochs: number,
  learningRate: number
): Promise<AiFinetuningJob> {
  return invokeCommand<AiFinetuningJob>("create_ai_finetuning_job", {
    modelName,
    adapterName,
    datasetSize,
    epochs,
    learningRate,
  });
}

// ---------------------------------------------------------------------------
// Literature Review Matrix & Evidence-Linked Copilot
// ---------------------------------------------------------------------------

export async function listMatrixWorkspaces(): Promise<MatrixWorkspace[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        id: "default_matrix",
        title: "Main Literature Review Matrix",
        description: "Comprehensive multi-paper comparison matrix.",
        columns_json: "[]",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
  return invokeCommand<MatrixWorkspace[]>("list_matrix_workspaces");
}

export async function getMatrixWorkspaceDetail(
  workspaceId: string
): Promise<MatrixWorkspaceDetail> {
  if (!isTauriEnvironment()) {
    return {
      workspace: {
        id: workspaceId,
        title: "Main Literature Review Matrix",
        description: "Comprehensive multi-paper comparison matrix.",
        columns_json: "[]",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      columns: [
        {
          key: "research_question",
          label: "Research Question",
          col_type: "text",
          required: true,
          width: 240,
        },
        {
          key: "methodology",
          label: "Methodology",
          col_type: "text",
          required: true,
          width: 220,
        },
        {
          key: "dataset",
          label: "Dataset / Benchmark",
          col_type: "text",
          required: false,
          width: 180,
        },
        {
          key: "sample_size",
          label: "Sample Size",
          col_type: "text",
          required: false,
          width: 130,
        },
        {
          key: "model_architecture",
          label: "Model / Architecture",
          col_type: "text",
          required: false,
          width: 190,
        },
        {
          key: "eval_metrics",
          label: "Key Metrics",
          col_type: "text",
          required: false,
          width: 160,
        },
        {
          key: "main_findings",
          label: "Main Findings",
          col_type: "text",
          required: true,
          width: 260,
        },
        {
          key: "limitations",
          label: "Limitations",
          col_type: "text",
          required: false,
          width: 200,
        },
        {
          key: "future_work",
          label: "Future Work",
          col_type: "text",
          required: false,
          width: 180,
        },
      ],
      rows: [],
      total_papers: 0,
      total_extractions: 0,
    };
  }
  return invokeCommand<MatrixWorkspaceDetail>("get_matrix_workspace_detail", {
    workspaceId,
  });
}

export async function createMatrixWorkspace(
  title: string,
  description?: string | null,
  columnsJson?: string | null
): Promise<MatrixWorkspace> {
  return invokeCommand<MatrixWorkspace>("create_matrix_workspace", {
    title,
    description,
    columnsJson,
  });
}

export async function updateMatrixColumns(
  workspaceId: string,
  columnsJson: string
): Promise<void> {
  return invokeCommand<void>("update_matrix_columns", {
    workspaceId,
    columnsJson,
  });
}

export async function deleteMatrixWorkspace(workspaceId: string): Promise<void> {
  return invokeCommand<void>("delete_matrix_workspace", { workspaceId });
}

export async function addPaperToMatrix(
  workspaceId: string,
  paperId: string
): Promise<void> {
  return invokeCommand<void>("add_paper_to_matrix", {
    workspaceId,
    paperId,
  });
}

export async function removePaperFromMatrix(
  workspaceId: string,
  paperId: string
): Promise<void> {
  return invokeCommand<void>("remove_paper_from_matrix", {
    workspaceId,
    paperId,
  });
}

export async function upsertMatrixExtraction(
  extraction: MatrixExtraction
): Promise<MatrixExtraction> {
  return invokeCommand<MatrixExtraction>("upsert_matrix_extraction", { extraction });
}

export async function extractMatrixFields(
  workspaceId: string,
  paperId: string
): Promise<MatrixExtraction[]> {
  return invokeCommand<MatrixExtraction[]>("extract_matrix_fields", {
    workspaceId,
    paperId,
  });
}

export async function exportMatrixCsv(workspaceId: string): Promise<string> {
  return invokeCommand<string>("export_matrix_csv", { workspaceId });
}

export async function createEvidenceCopilotSession(
  title: string,
  targetScope: string,
  targetPaperId?: string | null,
  workspaceId?: string | null
): Promise<EvidenceCopilotSession> {
  return invokeCommand<EvidenceCopilotSession>("create_evidence_copilot_session", {
    title,
    targetScope,
    targetPaperId,
    workspaceId,
  });
}

export async function listEvidenceCopilotSessions(
  workspaceId?: string | null,
  targetPaperId?: string | null
): Promise<EvidenceCopilotSession[]> {
  return invokeCommand<EvidenceCopilotSession[]>("list_evidence_copilot_sessions", {
    workspaceId,
    targetPaperId,
  });
}

export async function getEvidenceCopilotMessages(
  sessionId: string
): Promise<EvidenceCopilotMessage[]> {
  return invokeCommand<EvidenceCopilotMessage[]>("get_evidence_copilot_messages", {
    sessionId,
  });
}

export async function clearEvidenceCopilotMessages(sessionId: string): Promise<void> {
  return invokeCommand<void>("clear_evidence_copilot_messages", {
    sessionId,
  });
}

export async function askEvidenceCopilot(
  sessionId: string,
  question: string,
  workspaceId?: string | null,
  targetPaperId?: string | null,
  scope?: string | null,
  selectedPaperIds?: string[] | null,
  selectedCellJson?: string | null
): Promise<EvidenceCopilotMessage> {
  return invokeCommand<EvidenceCopilotMessage>("ask_evidence_copilot", {
    sessionId,
    question,
    workspaceId: workspaceId ?? null,
    targetPaperId: targetPaperId ?? null,
    scope: scope ?? null,
    selectedPaperIds: selectedPaperIds ?? null,
    selectedCellJson: selectedCellJson ?? null,
  });
}

// ---------------------------------------------------------------------------
// Phase 9: AI Tools & Integrity Backend Integration
// ---------------------------------------------------------------------------

const mockIntegrityReports = new Map<string, SavedIntegrityReportDb>();
const mockCitationAudits = new Map<string, SavedCitationAuditDb>();
const mockWritingRevisions = new Map<string, WritingRevisionDb[]>();
const mockReadabilityReports = new Map<string, SavedReadabilityReportDb>();

export async function ingestDocumentContent(
  fileName: string,
  fileFormat: string,
  rawContent: string
): Promise<IngestedDocumentMeta> {
  if (!rawContent || !rawContent.trim()) {
    throw {
      code: "ERR_EMPTY_DOCUMENT",
      message: "Document content cannot be empty",
      retryable: false,
    };
  }

  if (!isTauriEnvironment()) {
    // Deterministic 64-character hash for web preview / test environments
    let h1 = 0x811c9dc5,
      h2 = 0x27d4eb2f;
    for (let i = 0; i < rawContent.length; i++) {
      h1 = Math.imul(h1 ^ rawContent.charCodeAt(i), 0x01000193);
      h2 = Math.imul(h2 ^ rawContent.charCodeAt(i), 0x5bd1e995);
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
    const docHash = (hex1 + hex2).repeat(4);
    const words = rawContent.trim().split(/\s+/).filter(Boolean);

    return {
      document_hash: docHash,
      file_name: fileName,
      file_format: fileFormat,
      word_count: words.length,
      char_count: rawContent.length,
      is_clean_encoding: !rawContent.includes("\uFFFD"),
      existing_report_id: null,
    };
  }
  return invokeCommand<IngestedDocumentMeta>("ingest_document_content", {
    fileName,
    fileFormat,
    rawContent,
  });
}

export async function startAnalysisJob(
  jobType: string,
  documentHash: string
): Promise<AnalysisJob> {
  if (!isTauriEnvironment()) {
    return {
      id: `preview_job_${Date.now()}`,
      job_type: jobType,
      document_hash: documentHash,
      status: "queued",
      progress_pct: 0,
      current_step: "Queued in preview",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<AnalysisJob>("start_analysis_job", {
    jobType,
    documentHash,
  });
}

export async function getAnalysisJobStatus(jobId: string): Promise<AnalysisJob> {
  if (!isTauriEnvironment()) {
    return {
      id: jobId,
      job_type: "integrity_audit",
      document_hash: "mock_hash",
      status: "completed",
      progress_pct: 100,
      current_step: "Completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<AnalysisJob>("get_analysis_job_status", { jobId });
}

export async function cancelAnalysisJob(jobId: string): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return true;
  }
  return invokeCommand<boolean>("cancel_analysis_job", { jobId });
}

export async function saveIntegrityReportDb(
  report: SavedIntegrityReportDb
): Promise<SavedIntegrityReportDb> {
  if (!isTauriEnvironment()) {
    mockIntegrityReports.set(report.id, report);
    return report;
  }
  return invokeCommand<SavedIntegrityReportDb>("save_integrity_report", { report });
}

export async function getIntegrityReportDb(id: string): Promise<SavedIntegrityReportDb> {
  if (!isTauriEnvironment()) {
    const found = mockIntegrityReports.get(id);
    if (!found) {
      throw {
        code: "ERR_NOT_FOUND",
        message: "Integrity report not found",
        retryable: false,
      };
    }
    return found;
  }
  return invokeCommand<SavedIntegrityReportDb>("get_integrity_report", { id });
}

export async function listSavedIntegrityReportsDb(
  page = 1,
  pageSize = 50
): Promise<SavedIntegrityReportDb[]> {
  if (!isTauriEnvironment()) {
    const all = Array.from(mockIntegrityReports.values());
    const offset = (page - 1) * pageSize;
    return all.slice(offset, offset + pageSize);
  }
  return invokeCommand<SavedIntegrityReportDb[]>("list_saved_integrity_reports", {
    page,
    pageSize,
  });
}

export async function deleteIntegrityReportDb(id: string): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return mockIntegrityReports.delete(id);
  }
  return invokeCommand<boolean>("delete_integrity_report", { id });
}

export async function updateIntegrityFindingReviewDb(
  findingId: string,
  isReviewed: boolean,
  notes?: string
): Promise<boolean> {
  if (!isTauriEnvironment()) {
    for (const report of mockIntegrityReports.values()) {
      const finding = report.findings?.find((f) => f.id === findingId);
      if (finding) {
        finding.is_reviewed = isReviewed;
        finding.reviewer_notes = notes || null;
        finding.reviewed_at = isReviewed ? new Date().toISOString() : null;
        return true;
      }
    }
    return true;
  }
  return invokeCommand<boolean>("update_integrity_finding_review", {
    findingId,
    isReviewed,
    notes,
  });
}

export async function saveCitationAuditDb(
  audit: SavedCitationAuditDb
): Promise<SavedCitationAuditDb> {
  if (!isTauriEnvironment()) {
    mockCitationAudits.set(audit.id, audit);
    return audit;
  }
  return invokeCommand<SavedCitationAuditDb>("save_citation_audit", { audit });
}

export async function getCitationAuditDb(id: string): Promise<SavedCitationAuditDb> {
  if (!isTauriEnvironment()) {
    const found = mockCitationAudits.get(id);
    if (!found) {
      throw {
        code: "ERR_NOT_FOUND",
        message: "Citation audit not found",
        retryable: false,
      };
    }
    return found;
  }
  return invokeCommand<SavedCitationAuditDb>("get_citation_audit", { id });
}

export async function listCitationAuditsDb(
  page = 1,
  pageSize = 50
): Promise<SavedCitationAuditDb[]> {
  if (!isTauriEnvironment()) {
    const all = Array.from(mockCitationAudits.values());
    const offset = (page - 1) * pageSize;
    return all.slice(offset, offset + pageSize);
  }
  return invokeCommand<SavedCitationAuditDb[]>("list_citation_audits", {
    page,
    pageSize,
  });
}

export async function saveWritingRevisionDb(
  revision: WritingRevisionDb
): Promise<WritingRevisionDb> {
  if (!isTauriEnvironment()) {
    const list = mockWritingRevisions.get(revision.session_id) || [];
    list.unshift(revision);
    mockWritingRevisions.set(revision.session_id, list);
    return revision;
  }
  return invokeCommand<WritingRevisionDb>("save_writing_revision", { revision });
}

export async function listWritingRevisionsDb(
  sessionId: string
): Promise<WritingRevisionDb[]> {
  if (!isTauriEnvironment()) {
    return mockWritingRevisions.get(sessionId) || [];
  }
  return invokeCommand<WritingRevisionDb[]>("list_writing_revisions", { sessionId });
}

export async function saveReadabilityReportDb(
  report: SavedReadabilityReportDb
): Promise<SavedReadabilityReportDb> {
  if (!isTauriEnvironment()) {
    mockReadabilityReports.set(report.document_hash, report);
    return report;
  }
  return invokeCommand<SavedReadabilityReportDb>("save_readability_report", { report });
}

export async function getReadabilityReportByHashDb(
  docHash: string
): Promise<SavedReadabilityReportDb | null> {
  if (!isTauriEnvironment()) {
    return mockReadabilityReports.get(docHash) || null;
  }
  return invokeCommand<SavedReadabilityReportDb | null>(
    "get_readability_report_by_hash",
    { docHash }
  );
}

export async function extractDocumentText(
  filePath: string
): Promise<ExtractedDocumentResult> {
  if (!isTauriEnvironment()) {
    return {
      file_name: filePath.split("/").pop() || "preview_document.txt",
      file_type: "txt",
      text: "Simulated preview text content for non-desktop environment.",
      char_count: 60,
      word_count: 8,
      warning: null,
    };
  }
  return invokeCommand<ExtractedDocumentResult>("extract_document_text", {
    filePath,
  });
}

export async function detectAiSignals(text: string): Promise<AiSignalDetectionResult> {
  if (!isTauriEnvironment()) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      status: "completed",
      overall_signal_score: 0.35,
      classification: "natural_cadence",
      sentence_count: sentences.length,
      mean_sentence_length: sentences.length ? words.length / sentences.length : 0,
      variance: 2.5,
      burstiness: 0.15,
      uncertainty_caveat:
        "Statistical cadence measures linguistic uniformity rather than authorship. Rigorous technical manuscripts frequently adopt standardized, uniform phraseology. This diagnostic must never be treated as definitive evidence of AI authorship.",
    };
  }
  return invokeCommand<AiSignalDetectionResult>("detect_ai_signals", {
    text,
  });
}

// -----------------------------------------------------------------------------
// AI Diagnostics
// -----------------------------------------------------------------------------

export async function diagnoseAiSystem(): Promise<AiDiagnosticReport[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        provider_id: "nvidia_nim",
        display_name: "NVIDIA NIM / API Catalog",
        is_enabled: true,
        is_local: false,
        access_category: "hosted_free_tier",
        endpoint_url: "https://integrate.api.nvidia.com/v1",
        selected_model: "mistralai/mistral-large-4-1t-a52b",
        has_credential: true,
        is_ready: true,
        connection_status: "connected",
        last_health_message: "Connected successfully (124 models available)",
        last_error_category: null,
        latency_ms: 120,
        streaming_supported: true,
        embeddings_supported: false,
        reranker_supported: false,
      },
      {
        provider_id: "ollama_local",
        display_name: "Ollama Local Runtime",
        is_enabled: true,
        is_local: true,
        access_category: "local",
        endpoint_url: "http://127.0.0.1:11434",
        selected_model: "llama3.2:latest",
        has_credential: true,
        is_ready: true,
        connection_status: "connected",
        last_health_message: "Ollama active (found 3 installed models)",
        last_error_category: null,
        latency_ms: 15,
        streaming_supported: true,
        embeddings_supported: true,
        reranker_supported: false,
      },
    ];
  }
  return invokeCommand<AiDiagnosticReport[]>("diagnose_ai_system");
}

export async function testAiGeneration(
  providerId: string
): Promise<DiagnosticTestGenResult> {
  if (!isTauriEnvironment()) {
    return {
      provider_id: providerId,
      model_id: "simulation-model",
      success: true,
      response_text: "Scientific AI Diagnostic Verified. Response latency optimal.",
      latency_ms: 145,
      error_category: null,
      error_message: null,
    };
  }
  return invokeCommand<DiagnosticTestGenResult>("test_ai_generation", { providerId });
}

// -----------------------------------------------------------------------------
// Research Domains & Projects
// -----------------------------------------------------------------------------

export async function listResearchDomains(): Promise<ResearchDomain[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        id: "dom_cs",
        parent_id: null,
        name: "Computer Science",
        slug: "computer-science",
        description: "Computing & intelligent systems",
        icon: "Cpu",
        color: "#4f46e5",
        is_custom: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "sub_cs_ai",
        parent_id: "dom_cs",
        name: "Artificial Intelligence",
        slug: "artificial-intelligence",
        description: "AI foundations & models",
        icon: "Bot",
        color: "#4f46e5",
        is_custom: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "sub_cs_nlp",
        parent_id: "dom_cs",
        name: "Natural Language Processing",
        slug: "natural-language-processing",
        description: "Language models & text extraction",
        icon: "MessageSquare",
        color: "#4f46e5",
        is_custom: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "dom_life",
        parent_id: null,
        name: "Medicine and Life Sciences",
        slug: "medicine-life-sciences",
        description: "Biomedicine & biology",
        icon: "Activity",
        color: "#dc2626",
        is_custom: false,
        created_at: "",
        updated_at: "",
      },
      {
        id: "sub_life_bioinf",
        parent_id: "dom_life",
        name: "Bioinformatics",
        slug: "bioinformatics",
        description: "Genomics & computational medicine",
        icon: "Dna",
        color: "#dc2626",
        is_custom: false,
        created_at: "",
        updated_at: "",
      },
    ];
  }
  return invokeCommand<ResearchDomain[]>("list_research_domains");
}

export async function createCustomResearchDomain(
  input: CreateDomainInput
): Promise<ResearchDomain> {
  if (!isTauriEnvironment()) {
    return {
      id: `dom_${Date.now()}`,
      parent_id: input.parent_id || null,
      name: input.name,
      slug: input.name.toLowerCase().replace(/\s+/g, "-"),
      description: input.description || null,
      icon: input.icon || "Folder",
      color: input.color || "#6366f1",
      is_custom: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ResearchDomain>("create_custom_research_domain", { input });
}

export async function createResearchProject(
  input: CreateProjectInput
): Promise<ResearchProject> {
  if (!isTauriEnvironment()) {
    return {
      id: `proj_${Date.now()}`,
      title: input.title,
      description: input.description || null,
      objective: input.objective || null,
      research_questions: input.research_questions || null,
      hypotheses: input.hypotheses || null,
      expected_outcomes: input.expected_outcomes || null,
      primary_domain_id: input.primary_domain_id || null,
      subdomain_id: input.subdomain_id || null,
      custom_domain_text: input.custom_domain_text || null,
      status: "active",
      priority: (input.priority as "medium") || "medium",
      progress_percent: 0,
      start_date: input.start_date || null,
      target_deadline: input.target_deadline || null,
      completed_at: null,
      tags_json: JSON.stringify(input.tags || []),
      template_type: input.template_type || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ResearchProject>("create_research_project", { input });
}

export async function updateResearchProject(
  input: UpdateProjectInput
): Promise<ResearchProject> {
  if (!isTauriEnvironment()) {
    return {
      id: input.id,
      title: input.title,
      description: input.description || null,
      objective: input.objective || null,
      research_questions: input.research_questions || null,
      hypotheses: input.hypotheses || null,
      expected_outcomes: input.expected_outcomes || null,
      primary_domain_id: input.primary_domain_id || null,
      subdomain_id: input.subdomain_id || null,
      custom_domain_text: input.custom_domain_text || null,
      status: input.status as "active",
      priority: input.priority as "medium",
      progress_percent: 35,
      start_date: input.start_date || null,
      target_deadline: input.target_deadline || null,
      completed_at: null,
      tags_json: JSON.stringify(input.tags || []),
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ResearchProject>("update_research_project", { input });
}

export async function getResearchProject(
  projectId: string
): Promise<ProjectWithDetails | null> {
  if (!isTauriEnvironment()) return null;
  return invokeCommand<ProjectWithDetails | null>("get_research_project", { projectId });
}

export async function listResearchProjects(
  status?: string,
  domainId?: string,
  search?: string
): Promise<ProjectWithDetails[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<ProjectWithDetails[]>("list_research_projects", {
    status: status || null,
    domainId: domainId || null,
    search: search || null,
  });
}

export async function archiveResearchProject(projectId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("archive_research_project", { projectId });
}

export async function deleteResearchProject(projectId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("delete_research_project", { projectId });
}

// -----------------------------------------------------------------------------
// Milestones
// -----------------------------------------------------------------------------

export async function createProjectMilestone(
  input: CreateMilestoneInput
): Promise<ProjectMilestone> {
  if (!isTauriEnvironment()) {
    return {
      id: `ms_${Date.now()}`,
      project_id: input.project_id,
      title: input.title,
      description: input.description || null,
      due_date: input.due_date || null,
      is_completed: false,
      completed_at: null,
      sort_order: input.sort_order || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectMilestone>("create_project_milestone", { input });
}

export async function updateProjectMilestone(
  input: UpdateMilestoneInput
): Promise<ProjectMilestone> {
  if (!isTauriEnvironment()) {
    return {
      id: input.id,
      project_id: "demo",
      title: input.title,
      description: input.description || null,
      due_date: input.due_date || null,
      is_completed: input.is_completed,
      completed_at: input.is_completed ? new Date().toISOString() : null,
      sort_order: input.sort_order || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectMilestone>("update_project_milestone", { input });
}

export async function deleteProjectMilestone(milestoneId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("delete_project_milestone", { milestoneId });
}

export async function listProjectMilestones(
  projectId: string
): Promise<ProjectMilestone[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<ProjectMilestone[]>("list_project_milestones", { projectId });
}

// -----------------------------------------------------------------------------
// Tasks & Dependencies
// -----------------------------------------------------------------------------

export async function createProjectTask(input: CreateTaskInput): Promise<ProjectTask> {
  if (!isTauriEnvironment()) {
    return {
      id: `task_${Date.now()}`,
      project_id: input.project_id || null,
      parent_task_id: input.parent_task_id || null,
      milestone_id: input.milestone_id || null,
      title: input.title,
      description: input.description || null,
      phase: (input.phase as "planning") || "planning",
      status: (input.status as "todo") || "todo",
      priority: (input.priority as "medium") || "medium",
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      completed_at: null,
      estimated_hours: input.estimated_hours || null,
      actual_hours: null,
      tags_json: JSON.stringify(input.tags || []),
      completion_notes: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectTask>("create_project_task", { input });
}

export async function updateProjectTask(input: UpdateTaskInput): Promise<ProjectTask> {
  if (!isTauriEnvironment()) {
    return {
      id: input.id,
      project_id: "demo",
      parent_task_id: null,
      milestone_id: input.milestone_id || null,
      title: input.title,
      description: input.description || null,
      phase: input.phase as "planning",
      status: input.status as "todo",
      priority: input.priority as "medium",
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      estimated_hours: input.estimated_hours || null,
      actual_hours: input.actual_hours || null,
      tags_json: JSON.stringify(input.tags || []),
      completion_notes: input.completion_notes || null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectTask>("update_project_task", { input });
}

export async function updateProjectTaskStatus(
  taskId: string,
  status: string
): Promise<ProjectTask> {
  if (!isTauriEnvironment()) {
    return {
      id: taskId,
      title: "Sample Task",
      phase: "planning",
      status: status as "todo",
      priority: "medium",
      tags_json: "[]",
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectTask>("update_project_task_status", { taskId, status });
}

export async function deleteProjectTask(taskId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("delete_project_task", { taskId });
}

export async function listProjectTasks(
  projectId?: string,
  status?: string,
  priority?: string,
  search?: string
): Promise<TaskWithDetails[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<TaskWithDetails[]>("list_project_tasks", {
    projectId: projectId || null,
    status: status || null,
    priority: priority || null,
    search: search || null,
  });
}

export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string
): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("add_task_dependency", { taskId, dependsOnTaskId });
}

export async function removeTaskDependency(
  taskId: string,
  dependsOnTaskId: string
): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("remove_task_dependency", { taskId, dependsOnTaskId });
}

// -----------------------------------------------------------------------------
// Project & Task Papers Linking
// -----------------------------------------------------------------------------

export async function linkPaperToProject(
  projectId: string,
  paperId: string,
  relationshipType?: string,
  notes?: string
): Promise<ProjectPaper> {
  if (!isTauriEnvironment()) {
    return {
      id: `pp_${Date.now()}`,
      project_id: projectId,
      paper_id: paperId,
      paper_title: "Linked Research Paper",
      paper_authors: ["Author Name"],
      relationship_type: relationshipType || "reference",
      notes: notes || null,
      added_at: new Date().toISOString(),
    };
  }
  return invokeCommand<ProjectPaper>("link_paper_to_project", {
    projectId,
    paperId,
    relationshipType: relationshipType || null,
    notes: notes || null,
  });
}

export async function unlinkPaperFromProject(
  projectId: string,
  paperId: string
): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("unlink_paper_from_project", { projectId, paperId });
}

export async function listProjectPapers(projectId: string): Promise<ProjectPaper[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<ProjectPaper[]>("list_project_papers", { projectId });
}

export async function linkPaperToTask(
  taskId: string,
  paperId: string,
  notes?: string
): Promise<TaskPaper> {
  if (!isTauriEnvironment()) {
    return {
      id: `tp_${Date.now()}`,
      task_id: taskId,
      paper_id: paperId,
      paper_title: "Task Referenced Paper",
      notes: notes || null,
      added_at: new Date().toISOString(),
    };
  }
  return invokeCommand<TaskPaper>("link_paper_to_task", {
    taskId,
    paperId,
    notes: notes || null,
  });
}

export async function unlinkPaperFromTask(
  taskId: string,
  paperId: string
): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("unlink_paper_from_task", { taskId, paperId });
}

export async function listProjectActivity(
  projectId: string,
  limit?: number
): Promise<ProjectActivityEvent[]> {
  if (!isTauriEnvironment()) return [];
  return invokeCommand<ProjectActivityEvent[]>("list_project_activity", {
    projectId,
    limit: limit || null,
  });
}

// -----------------------------------------------------------------------------
// AI Project Plan Generation & Grounded Assistant
// -----------------------------------------------------------------------------

export async function generateAiProjectPlan(
  projectId: string
): Promise<AiProjectPlanProposal> {
  if (!isTauriEnvironment()) {
    return {
      project_title: "Simulated AI Project Roadmap",
      objective_summary: "Comprehensive research roadmap with milestones & tasks.",
      methodology_strategy: "Grounded empirical and literature synthesis",
      estimated_total_weeks: 16,
      milestones: [],
      recommended_paper_search_queries: ["sample topic review"],
    };
  }
  return invokeCommand<AiProjectPlanProposal>("generate_ai_project_plan", { projectId });
}

export async function applyAiProjectPlan(input: ApplyPlanInput): Promise<number> {
  if (!isTauriEnvironment()) return 5;
  return invokeCommand<number>("apply_ai_project_plan", { input });
}

export async function askProjectAiAssistant(
  projectId: string,
  question: string
): Promise<string> {
  if (!isTauriEnvironment()) {
    return `[Simulation] Advice for project query: "${question}". Based on your active milestones, consider completing your literature review matrix extractions before finalizing baseline experiments.`;
  }
  return invokeCommand<string>("ask_project_ai_assistant", { projectId, question });
}

// -----------------------------------------------------------------------------
// In-App AI Engine & Sidecar Commands
// -----------------------------------------------------------------------------

export async function getHardwareProfile(): Promise<HardwareProfile> {
  if (!isTauriEnvironment()) {
    return {
      total_ram_mb: 16180,
      available_ram_mb: 11400,
      cpu_cores: 4,
      recommended_tier: "pro",
    };
  }
  return invokeCommand<HardwareProfile>("get_hardware_profile");
}

export async function downloadAiModel(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  if (!isTauriEnvironment()) {
    for (let i = 15; i <= 100; i += 20) {
      await new Promise((r) => setTimeout(r, 120));
      onProgress?.({
        downloaded_bytes: i * 49 * 1024 * 1024,
        total_bytes: 4920 * 1024 * 1024,
        percentage: Math.min(100, i),
        status: i >= 100 ? "completed" : "downloading",
      });
    }
    return `simulated/path/${modelId}.gguf`;
  }

  const { Channel } = await import("@tauri-apps/api/core");
  const onProgressChannel = new Channel<DownloadProgress>();
  if (onProgress) {
    onProgressChannel.onmessage = (message) => {
      onProgress(message);
    };
  }
  return invokeCommand<string>("download_ai_model", {
    modelId,
    onProgress: onProgressChannel,
  });
}

export async function listInstalledAiModels(): Promise<InstalledModelInfo[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        filename: "DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
        size_mb: 4920,
        full_path: "mock/models/DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
      },
      {
        filename: "qwen2.5-7b-instruct-q4_k_m.gguf",
        size_mb: 4680,
        full_path: "mock/models/qwen2.5-7b-instruct-q4_k_m.gguf",
      },
    ];
  }
  return invokeCommand<InstalledModelInfo[]>("list_installed_ai_models");
}

export async function startInAppAiEngine(modelFilename: string): Promise<LocalAiStatus> {
  if (!isTauriEnvironment()) {
    return {
      is_running: true,
      port: 11435,
      active_model: modelFilename,
      endpoint: "http://127.0.0.1:11435",
    };
  }
  return invokeCommand<LocalAiStatus>("start_in_app_ai_engine", { modelFilename });
}

export async function stopInAppAiEngine(): Promise<void> {
  if (!isTauriEnvironment()) return;
  return invokeCommand<void>("stop_in_app_ai_engine");
}

export async function getAiEngineStatus(): Promise<LocalAiStatus> {
  if (!isTauriEnvironment()) {
    return {
      is_running: false,
      port: 11435,
      active_model: null,
      endpoint: "http://127.0.0.1:11435",
    };
  }
  return invokeCommand<LocalAiStatus>("get_ai_engine_status");
}

export * from "./auth";
export * from "./types";

export async function getAppPlatform(): Promise<AppPlatformInfo> {
  if (!isTauriEnvironment()) {
    return {
      os: "web",
      arch: "wasm",
      family: "browser",
      target_triple: "browser-wasm",
      app_data_dir: "IndexedDB",
      library_dir: "VirtualFileSystem",
    };
  }
  return invokeCommand<AppPlatformInfo>("app_platform");
}
