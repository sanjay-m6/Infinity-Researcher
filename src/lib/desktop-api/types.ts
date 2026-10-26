/**
 * TypeScript type definitions mapping 1-to-1 with Rust SQLite domain models and command payloads.
 */

export interface DatabaseInfo {
  path: string;
  schema_version: number;
  journal_mode: string;
  foreign_keys: boolean;
}

export interface DbAuthor {
  id: string;
  full_name: string;
  family_name: string | null;
  given_name: string | null;
  orcid: string | null;
  affiliation: string | null;
  author_order: number;
  created_at: string;
}

export interface DbPaper {
  id: string;
  canonical_doi: string | null;
  title: string;
  clean_title_key: string;
  abstract_text: string | null;
  publication_date: string | null;
  publication_year: number | null;
  venue: string | null;
  venue_type: string | null;
  language: string;
  citation_count: number;
  reference_count: number;
  is_open_access: boolean;
  license: string | null;
  primary_landing_url: string | null;
  pdf_url: string | null;
  has_file: boolean;
  local_pdf_path: string | null;
  content_hash: string | null;
  metadata_confidence: string;
  is_saved: boolean;
  reading_status?: string;

  reading_progress?: number;
  open_access_status?: string;
  access_evidence_type?: string;
  access_evidence_note?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_name?: string | null;
  retrieval_method?: string;
  access_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  authors: DbAuthor[];
  collection_ids: string[];
  tags: string[];
  source_names: string[];
}

export interface IeeeManualImportInput {
  file_path: string;
  title: string;
  authors: string[];
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  source_page_url?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  user_confirmed_oa: boolean;
  user_notes?: string | null;
  target_collection_id?: string | null;
}

export interface LocalOaPdfImportInput {
  file_path: string;
  title: string;
  authors: string[];
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  source_name?: string | null;
  source_page_url?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  user_confirmed_oa: boolean;
  user_notes?: string | null;
  target_collection_id?: string | null;
}

export interface OpenAccessStats {
  total_oa_papers: number;
  ieee_imported_papers: number;
  permitted_downloads: number;
  pending_verification_count: number;
  missing_or_corrupt_count: number;
}

export interface ImportPdfResult {
  paper: DbPaper;
  is_duplicate: boolean;
  duplicate_paper_id?: string | null;
  file_size_bytes: number;
  content_hash: string;
  storage_path: string;
}

export interface PaperCreateInput {
  title: string;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  publication_date?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  venue_type?: string | null;
  language?: string | null;
  is_open_access?: boolean | null;
  primary_landing_url?: string | null;
  pdf_url?: string | null;
  is_saved?: boolean | null;
  open_access_status?: string | null;
  access_evidence_type?: string | null;
  access_evidence_note?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_name?: string | null;
  retrieval_method?: string | null;
  access_confirmed_at?: string | null;
  authors: string[];
  collection_ids?: string[] | null;
  tags?: string[] | null;
  source_id?: string | null;
}

export interface PaperUpdateInput {
  id: string;
  title?: string | null;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  publication_date?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  is_open_access?: boolean | null;
  primary_landing_url?: string | null;
  pdf_url?: string | null;
  is_saved?: boolean | null;
  open_access_status?: string | null;
  access_evidence_type?: string | null;
  access_evidence_note?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_name?: string | null;
  retrieval_method?: string | null;
  access_confirmed_at?: string | null;
  authors?: string[] | null;
  collection_ids?: string[] | null;
  tags?: string[] | null;
}

export interface PaperListQuery {
  query?: string | null;
  collection_id?: string | null;
  tag?: string | null;
  reading_status?: string | null;
  source_id?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  open_access_only?: boolean | null;
  open_access_status?: string | null;
  retrieval_method?: string | null;
  is_saved_only?: boolean | null;
  sort_by?: "newest" | "oldest" | "citations" | "title" | null;
  page?: number | null;
  page_size?: number | null;
}


export interface PagedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DbCollection {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color_hex: string;
  paper_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionCreateInput {
  name: string;
  description?: string | null;
  color_hex?: string | null;
  parent_id?: string | null;
}

export interface CollectionUpdateInput {
  id: string;
  name: string;
  description?: string | null;
  color_hex?: string | null;
}

export interface DbTag {
  id: string;
  name: string;
  color_hex: string;
  paper_count: number;
  created_at: string;
}

export interface DbNote {
  id: string;
  paper_id: string;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface NoteSaveInput {
  id?: string | null;
  paper_id: string;
  title?: string | null;
  content_markdown: string;
}

export interface DbSource {
  id: string;
  name: string;
  source_type: string;
  tier: string;
  base_url: string;
  policy_url: string | null;
  rate_limit_rps: number;
  concurrency_limit: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Academic Sources & Unified Discovery (Phase 5)
// ---------------------------------------------------------------------------

export type ProviderId =
  | "openalex"
  | "crossref"
  | "semantic_scholar"
  | "arxiv"
  | "europe_pmc"
  | string;

export interface ProviderCapabilities {
  id: string;
  provider_id: string;
  display_name: string;
  base_url?: string;
  description?: string;
  documentation_url: string;
  rate_limit_info?: string;
  rate_limit_rps?: number;
  supports_doi_lookup: boolean;
  supports_year_filter: boolean;
  supports_open_access_filter: boolean;
  supports_pagination?: boolean;
  supports_cursor_pagination?: boolean;
  requires_api_key: boolean;
}

export type ProviderStatusCategory =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "succeeded_with_warnings"
  | "no_results"
  | "rate_limited"
  | "authentication_required"
  | "unavailable"
  | "failed"
  | "cancelled";

export interface ProviderStatus {
  provider_id: string;
  status: ProviderStatusCategory;
  message?: string | null;
  result_count: number;
  total_results?: number | null;
  has_more: boolean;
  next_cursor?: string | null;
  elapsed_ms: number;
}

export interface NormalizedAuthor {
  name: string;
  orcid?: string | null;
  affiliation?: string | null;
}

export interface ProviderProvenance {
  provider_id: string;
  record_id: string;
  landing_url?: string | null;
  retrieved_at: string;
}

export interface NormalizedWork {
  id: string;
  canonical_doi?: string | null;
  title: string;
  clean_title_key: string;
  abstract_text?: string | null;
  publication_date?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  venue_type?: string | null;
  authors: NormalizedAuthor[];
  is_open_access: boolean;
  landing_url?: string | null;
  pdf_url?: string | null;
  citation_count?: number | null;
  provider_id: string;
  provider_record_id: string;
  provenance: ProviderProvenance[];
}

export interface AcademicSearchQuery {
  query: string;
  providers: string[];
  year_start?: number | null;
  year_end?: number | null;
  open_access_only?: boolean | null;
  page?: number | null;
  page_size?: number | null;
  cursor_tokens?: Record<string, string> | null;
}

export interface UnifiedSearchResponse {
  works: NormalizedWork[];
  provider_statuses: ProviderStatus[];
  total_found: number;
  completed_at: string;
}

export interface ImportSummary {
  added: number;
  already_present: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface ProviderConfigStatus {
  provider_id: string;
  is_configured: boolean;
  requires_api_key: boolean;
}

// ----------------------------------------------------------------------------
// Phase 6 — Website Crawling & Scraping Engine Types
// ----------------------------------------------------------------------------

export interface CrawlProfile {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  allowed_patterns: string[];
  disallowed_patterns: string[];
  paper_link_selectors: string[];
  title_selector: string | null;
  authors_selector: string | null;
  abstract_selector: string | null;
  doi_selector: string | null;
  date_selector: string | null;
  venue_selector: string | null;
  pdf_link_selector: string | null;
  use_meta_tags: boolean;
  request_delay_ms: number;
  max_depth: number;
  max_pages: number;
  headers: Record<string, string> | null;
  is_built_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrawlProfileCreateInput {
  id?: string;
  name: string;
  domain: string;
  description?: string;
  allowed_patterns?: string[];
  disallowed_patterns?: string[];
  paper_link_selectors?: string[];
  title_selector?: string;
  authors_selector?: string;
  abstract_selector?: string;
  doi_selector?: string;
  date_selector?: string;
  venue_selector?: string;
  pdf_link_selector?: string;
  use_meta_tags?: boolean;
  request_delay_ms?: number;
  max_depth?: number;
  max_pages?: number;
  headers?: Record<string, string>;
}

export interface CrawlProfileUpdateInput {
  name?: string;
  domain?: string;
  description?: string;
  allowed_patterns?: string[];
  disallowed_patterns?: string[];
  paper_link_selectors?: string[];
  title_selector?: string;
  authors_selector?: string;
  abstract_selector?: string;
  doi_selector?: string;
  date_selector?: string;
  venue_selector?: string;
  pdf_link_selector?: string;
  use_meta_tags?: boolean;
  request_delay_ms?: number;
  max_depth?: number;
  max_pages?: number;
  headers?: Record<string, string>;
}

export type CrawlJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface CrawlJob {
  id: string;
  profile_id: string;
  start_url: string;
  status: CrawlJobStatus;
  pages_queued: number;
  pages_visited: number;
  pages_failed: number;
  papers_found: number;
  current_depth: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CrawlQueueItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export interface CrawlQueueItem {
  id: string;
  job_id: string;
  url: string;
  depth: number;
  status: CrawlQueueItemStatus;
  retry_count: number;
  http_status: number | null;
  error_message: string | null;
  discovered_at: string;
  processed_at: string | null;
}

export interface CrawlJobPaper {
  id: string;
  job_id: string;
  paper_id: string | null;
  url: string;
  title: string;
  canonical_doi: string | null;
  authors: string[];
  abstract_text: string | null;
  publication_date: string | null;
  venue: string | null;
  pdf_url: string | null;
  is_imported: boolean;
  discovered_at: string;
}

export interface ExtractionPreviewResult {
  url: string;
  profile_id: string | null;
  title: string | null;
  authors: string[];
  abstract_text: string | null;
  canonical_doi: string | null;
  publication_date: string | null;
  venue: string | null;
  pdf_url: string | null;
  discovered_paper_links: string[];
  extraction_methods_used: string[];
  meta_tags_found: Record<string, string>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Paper Processing, Deduplication & Document Integrity (Phase 7)
// ---------------------------------------------------------------------------

export interface PaperIdentifier {
  id: string;
  paper_id: string;
  identifier_type: string;
  canonical_value: string;
  raw_value: string;
  source_id?: string | null;
  created_at: string;
}

export type FileVerificationStatus =
  | "verified"
  | "unverified"
  | "corrupt"
  | "no_text"
  | "encrypted"
  | "missing"
  | "oversized"
  | "failed";

export interface PaperFile {
  id: string;
  paper_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  sha256_hash: string | null;
  verification_status: FileVerificationStatus;
  page_count: number | null;
  extracted_title: string | null;
  extracted_author: string | null;
  extracted_text_preview: string | null;
  extracted_text: string | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DuplicateMatchTier =
  | "exact_match"
  | "high_confidence"
  | "review_required"
  | "distinct";

export type DuplicateCandidateStatus =
  | "pending"
  | "merged"
  | "kept_separate"
  | "deferred";

export interface DuplicateCandidate {
  id: string;
  paper_a_id: string;
  paper_b_id: string;
  score: number;
  match_tier: DuplicateMatchTier;
  evidence: string[];
  status: DuplicateCandidateStatus;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateComparisonView {
  candidate_id: string;
  score: number;
  match_tier: DuplicateMatchTier;
  evidence: string[];
  status: DuplicateCandidateStatus;
  paper_a: DbPaper;
  paper_b: DbPaper;
  conflicting_fields: string[];
}

export interface MergeRequest {
  candidate_id?: string | null;
  canonical_paper_id: string;
  merged_paper_id: string;
  preferred_title_source?: string | null;
  preserve_notes: boolean;
  preserve_tags: boolean;
  preserve_collections: boolean;
  merge_notes?: string | null;
}

export interface MergeResult {
  success: boolean;
  canonical_paper_id: string;
  merged_paper_id: string;
  fields_updated: string[];
  files_reassigned: number;
  sources_reassigned: number;
  message: string;
}

export interface ProcessingJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number;
  completed_items: number;
  failed_items: number;
  warnings_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingOverview {
  total_papers: number;
  normalized_papers: number;
  total_files: number;
  verified_files: number;
  pending_duplicates_count: number;
  active_jobs_count: number;
  last_processing_time: string | null;
}

// ---------------------------------------------------------------------------
// PDF Workspace, Embedded Viewer & Download Manager (Unified Search & Reader)
// ---------------------------------------------------------------------------

export type PdfAvailabilityStatus =
  | "unknown"
  | "checking"
  | "open_access_available"
  | "download_queued"
  | "downloading"
  | "downloaded"
  | "metadata_only"
  | "landing_page_only"
  | "restricted_or_subscription"
  | "authentication_required"
  | "not_found"
  | "blocked_by_policy"
  | "failed_retryable"
  | "failed_permanent"
  | "local_file_missing"
  | "file_corrupt";

export interface PdfCandidate {
  id: string;
  paper_id: string;
  url: string;
  provider_id: string;
  source_type: string;
  access_status: PdfAvailabilityStatus;
  evidence_notes?: string | null;
  last_checked_at: string;
  created_at: string;
}

export interface PdfResolutionResult {
  paper_id: string;
  status: PdfAvailabilityStatus;
  best_url?: string | null;
  candidates: PdfCandidate[];
  evidence: string[];
  local_file_path?: string | null;
  sha256_hash?: string | null;
}

export interface DownloadJob {
  id: string;
  paper_id: string;
  paper_title: string;
  url: string;
  source_id: string;
  status: "queued" | "downloading" | "completed" | "failed" | "cancelled";
  bytes_downloaded: number;
  total_bytes: number;
  progress_percent: number;
  stage_message: string;
  error_message?: string | null;
  destination_path?: string | null;
  sha256_hash?: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaperPdfInfo {
  paper_id: string;
  file_id?: string | null;
  has_local_file: boolean;
  file_name?: string | null;
  byte_size?: number | null;
  sha256_hash?: string | null;
  verification_status: string;
  page_count?: number | null;
  is_text_indexed: boolean;
  last_page: number;
  zoom_level: number;
  rotation: number;
  access_status: PdfAvailabilityStatus;
  download_url?: string | null;
}

export interface ReaderState {
  paper_id: string;
  file_id?: string | null;
  last_page: number;
  zoom_level: number;
  rotation: number;
  updated_at: string;
}

export interface EnqueueDownloadInput {
  paper_id: string;
  paper_title: string;
  url: string;
  source_id: string;
}

export interface BulkDownloadRequest {
  paper_ids: string[];
}

export interface BulkDownloadSummary {
  enqueued: number;
  skipped: number;
  failed: number;
  reasons: string[];
}

export interface WebsitePolicyCheck {
  url: string;
  origin: string;
  domain: string;
  is_allowed: boolean;
  crawl_delay_ms: number;
  policy_state: "allowed" | "restricted" | "disallowed" | "unknown";
  robots_found: boolean;
  message: string;
  detected_platform: string;
}

// ---------------------------------------------------------------------------
// Query-Based Academic Website Discovery (No-API)
// ---------------------------------------------------------------------------

export interface WebsiteSearchQuery {
  query: string;
  sources?: string[] | null;
  year_start?: number | null;
  year_end?: number | null;
  content_type?: string | null;
  open_access_only?: boolean | null;
  author?: string | null;
  limit_per_source?: number | null;
}

export interface DiscoveredSearchResult {
  id: string;
  title: string;
  authors: string[];
  publication_date?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  landing_url: string;
  pdf_url?: string | null;
  source_id: string;
  source_name: string;
  content_type: string;
  is_open_access: boolean;
  license_name?: string | null;
  peer_reviewed?: boolean | null;
  subject_tags: string[];
  language?: string | null;
  relevance_score: number;
  metadata_confidence?: number | null;
}

export interface SourceSearchStatus {
  source_id: string;
  source_name: string;
  status:
    | "queued"
    | "searching"
    | "completed"
    | "no_results"
    | "blocked"
    | "rate_limited"
    | "unsupported"
    | "failed"
    | "timeout"
    | "manual_only"
    | "disabled"
    | "cancelled";
  message?: string | null;
  results_count: number;
  elapsed_ms: number;
}

export type SearchStreamEvent =
  | {
      type: "search_started";
      session_id: string;
      query: string;
      sources: string[];
    }
  | {
      type: "source_started";
      session_id: string;
      source_id: string;
      source_name: string;
    }
  | {
      type: "source_progress";
      session_id: string;
      source_id: string;
      pages_crawled: number;
      papers_found: number;
    }
  | {
      type: "source_status";
      session_id: string;
      source_id: string;
      source_name: string;
      status: SourceSearchStatus["status"];
      message?: string | null;
      results_count: number;
      elapsed_ms: number;
    }
  | {
      type: "paper_found";
      session_id: string;
      source_id: string;
      paper: DiscoveredSearchResult;
    }
  | {
      type: "paper_updated";
      session_id: string;
      source_id: string;
      paper: DiscoveredSearchResult;
    }
  | {
      type: "source_completed";
      session_id: string;
      source_id: string;
      count: number;
      elapsed_ms: number;
    }
  | {
      type: "source_failed";
      session_id: string;
      source_id: string;
      error?: string;
      message?: string;
      error_category?: string;
      elapsed_ms: number;
    }
  | {
      type: "search_progress";
      session_id: string;
      sources_total: number;
      sources_finished: number;
      papers_found: number;
    }
  | {
      type: "search_completed";
      session_id: string;
      total_unique: number;
      duration_ms: number;
    }
  | {
      type: "search_completed_with_errors";
      session_id: string;
      total_unique: number;
      duration_ms: number;
      failed_sources: string[];
    }
  | {
      type: "search_no_results";
      session_id: string;
      duration_ms: number;
    }
  | {
      type: "search_failed";
      session_id: string;
      error: string;
      duration_ms: number;
    }
  | {
      type: "search_cancelled";
      session_id: string;
      total_unique: number;
      duration_ms: number;
    }
  | {
      type: "search_timed_out";
      session_id: string;
      total_unique: number;
      duration_ms: number;
    }
  | {
      type: "search_error";
      session_id: string;
      source_id?: string | null;
      message: string;
    };

export interface WebsiteSearchResponse {
  results: DiscoveredSearchResult[];
  source_statuses: SourceSearchStatus[];
  total_results: number;
  completed_at: string;
}

export interface SourceDiagnosticInfo {
  source_id: string;
  source_name: string;
  status: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_papers_found: number;
  last_elapsed_ms: number;
  last_error?: string | null;
}

export interface SearchJobSummary {
  session_id: string;
  query: string;
  sources: string[];
  state: string;
  total_results: number;
  duration_ms: number;
  timestamp: string;
}

export interface EngineDiagnostics {
  engine_version: string;
  engine_status: string;
  uptime_seconds: number;
  total_searches: number;
  successful_searches: number;
  failed_searches: number;
  cancelled_searches: number;
  active_sessions: number;
  sources: SourceDiagnosticInfo[];
  recent_jobs: SearchJobSummary[];
}

export interface WebsiteSourceDescriptor {
  id: string;
  name: string;
  domain: string;
  status: "enabled" | "disabled" | "manual_only";
  policy_url: string;
  policy_notes: string;
  supports_native_years: boolean;
  request_delay_ms: number;
  content_types: string[];
}

export interface PythonEngineStatus {
  available: boolean;
  python_path?: string | null;
  engine_dir?: string | null;
  version?: string | null;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// AI Workspace, Multi-Provider & RAG Knowledge Types
// ---------------------------------------------------------------------------

export type AiProviderCategory = "local_runtime" | "cloud_hosted" | "custom_endpoint";
export type AiAccessCategory = "local" | "hosted_free_tier" | "hosted_free_models" | "trial_or_credit" | "paid" | "self_hosted";

export interface AiProvider {
  id: string;
  display_name: string;
  category: AiProviderCategory;
  endpoint_url: string;
  doc_url: string;
  auth_type: string;
  access_category: AiAccessCategory;
  credential_ref?: string | null;
  default_model: string;
  embedding_model?: string | null;
  reranker_model?: string | null;
  timeout_secs: number;
  max_tokens: number;
  temperature: number;
  context_length: number;
  streaming_enabled: boolean;
  is_local: boolean;
  is_enabled: boolean;
  priority: number;
  last_verified_at: string;
  last_health_status: string;
  last_health_message?: string | null;
  supported_capabilities: string[];
  created_at: string;
  updated_at: string;
}

export interface AiProviderTaskRoute {
  task_type: string;
  provider_id: string;
  model_id: string;
  updated_at: string;
}

export interface AiPaperChunk {
  id: string;
  paper_id: string;
  chunk_index: number;
  page_number: number;
  section_heading?: string | null;
  content_text: string;
  token_count: number;
  embedding_json?: string | null;
  created_at: string;
}

export interface AiChunkCitation {
  chunk_id: string;
  paper_id: string;
  paper_title: string;
  page_number: number;
  section_heading?: string | null;
  snippet: string;
  score: number;
}

export interface AiRagContext {
  query: string;
  scope: string; // 'paper' | 'library' | 'none'
  paper_id?: string | null;
  passages: AiChunkCitation[];
  warnings: string[];
  is_grounded: boolean;
}

export interface AiChatMessage {
  id: string;
  session_id: string;
  paper_id?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  citations: AiChunkCitation[];
  provider_id?: string | null;
  model_id?: string | null;
  retrieval_mode: string;
  created_at: string;
}

export interface AiRecommendation {
  id: string;
  paper_id: string;
  recommended_paper_id: string;
  recommended_title: string;
  recommended_authors: string[];
  recommended_year?: number | null;
  recommended_venue?: string | null;
  recommended_doi?: string | null;
  score: number;
  reason: string;
  matched_concepts: string[];
  confidence_label: string;
  recommendation_mode: string;
  feedback_status: string; // 'none' | 'saved' | 'dismissed' | 'not_relevant'
  feedback_note?: string | null;
  updated_at: string;
}

export interface AiEvaluationResult {
  id: string;
  benchmark_suite: string;
  provider_id: string;
  model_id: string;
  total_tests: number;
  passed_tests: number;
  citation_accuracy: number;
  abstention_accuracy: number;
  avg_latency_ms: number;
  details_json?: string | null;
  evaluated_at: string;
}

export interface AiFinetuningJob {
  id: string;
  model_name: string;
  adapter_name: string;
  hardware_check: string;
  dataset_size: number;
  train_val_split_ratio: number;
  epochs: number;
  learning_rate: number;
  status: string;
  progress_percent: number;
  stage_message?: string | null;
  adapter_path?: string | null;
  eval_loss?: number | null;
  model_card_json?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiSettings {
  local_only_mode: boolean;
  never_use_paid_apis: boolean;
  cloud_paper_sharing_enabled: boolean;
  active_rag_scope: string;
  default_audience_level: string;
  recommendations_diversity_weight: number;
}

export interface AiHardwareInfo {
  os?: string;
  arch?: string;
  cuda_available?: boolean;
  min_recommended_vram_gb?: number;
  supported_methods?: string[];
  notice?: string;
  [key: string]: unknown;
}

export interface ProviderTestResult {
  provider_id: string;
  success: boolean;
  latency_ms: number;
  message: string;
  detected_models: string[];
}

export interface GenerateRequestInput {
  prompt: string;
  system_instruction?: string | null;
  paper_id?: string | null;
  task_type?: string | null;
  audience_level?: string | null;
  reading_mode?: string | null;
  rag_scope?: string | null;
  provider_override?: string | null;
  model_override?: string | null;
}

export interface GenerateResponseOutput {
  text: string;
  citations: AiChunkCitation[];
  provider_id: string;
  model_id: string;
  latency_ms: number;
  is_grounded: boolean;
  warning?: string | null;
}

// ---------------------------------------------------------------------------
// Research Integrity & Academic Writing Assistant Types
// ---------------------------------------------------------------------------

export interface IntegrityDocument {
  id: string;
  source_type: "file" | "library_paper" | "pasted_text";
  source_reference: string | null;
  file_hash: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number;
  raw_content: string;
  normalized_content: string;
  word_count: number;
  page_count: number;
  extraction_metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentSegment {
  id: string;
  document_id: string;
  segment_index: number;
  segment_type:
    | "paragraph"
    | "section_heading"
    | "abstract"
    | "methodology"
    | "results"
    | "discussion"
    | "references"
    | "boilerplate";
  raw_text: string;
  normalized_text: string;
  char_start: number;
  char_end: number;
  page_number: number;
  embedding_id: string | null;
  created_at: string;
}

export interface CorpusSource {
  id: string;
  source_type: "library_paper" | "local_folder" | "imported_file" | "external_open_access";
  source_ref: string | null;
  title: string;
  authors: string | null;
  venue: string | null;
  year: number | null;
  doi: string | null;
  canonical_url: string | null;
  file_path: string | null;
  content_hash: string;
  raw_content: string;
  word_count: number;
  fingerprint_count: number;
  is_active: boolean;
  indexed_at: string;
  last_error: string | null;
}

export interface SimilarityRun {
  id: string;
  document_id: string;
  status: "queued" | "running" | "completed" | "completed_with_warnings" | "failed" | "cancelled";
  total_body_words: number;
  matched_body_words: number;
  overall_similarity_ratio: number;
  corpus_sources_searched: number;
  matched_sources_count: number;
  matches_count: number;
  execution_duration_ms: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SimilarityMatch {
  id: string;
  similarity_run_id: string;
  corpus_source_id: string;
  match_type: "exact" | "fingerprint" | "fuzzy" | "semantic_candidate";
  target_char_start: number;
  target_char_end: number;
  target_page_number: number;
  target_passage: string;
  source_char_start: number;
  source_char_end: number;
  source_page_number: number;
  source_passage: string;
  overlap_chars: number;
  confidence_score: number;
  review_status:
    | "unreviewed"
    | "marked_quote"
    | "citation_present"
    | "excluded_boilerplate"
    | "not_a_match";
  review_notes: string | null;
  created_at: string;
}

export interface SimilarityMatchWithSource {
  id: string;
  similarity_run_id: string;
  corpus_source_id: string;
  match_type: "exact" | "fingerprint" | "fuzzy" | "semantic_candidate";
  target_char_start: number;
  target_char_end: number;
  target_page_number: number;
  target_passage: string;
  source_char_start: number;
  source_char_end: number;
  source_page_number: number;
  source_passage: string;
  overlap_chars: number;
  confidence_score: number;
  review_status:
    | "unreviewed"
    | "marked_quote"
    | "citation_present"
    | "excluded_boilerplate"
    | "not_a_match";
  review_notes: string | null;
  created_at: string;
  source_title: string;
  source_authors: string | null;
  source_doi: string | null;
  source_canonical_url: string | null;
}

export interface SimilarityReport {
  run: SimilarityRun;
  document: IntegrityDocument;
  segments: DocumentSegment[];
  matches: SimilarityMatchWithSource[];
  corpus_coverage_note: string;
  formula_explanation: string;
}

export interface AiSignalRun {
  id: string;
  document_id: string;
  model_id: string;
  model_version: string;
  inference_mode: "local" | "remote";
  status:
    | "not_run"
    | "insufficient_text"
    | "running"
    | "completed"
    | "experimental"
    | "model_unavailable"
    | "failed";
  overall_signal_score: number | null;
  signal_classification:
    | "unsupported"
    | "insufficient_text"
    | "low_ai_signal"
    | "mixed_signals"
    | "elevated_ai_signal";
  analyzed_characters: number;
  analyzed_paragraphs: number;
  uncertainty_caveat: string;
  created_at: string;
  completed_at: string | null;
}

export interface AiSignalSegment {
  id: string;
  ai_signal_run_id: string;
  segment_id: string;
  paragraph_index: number;
  score: number;
  classification: string;
  notes: string | null;
}

export interface WritingSession {
  id: string;
  document_id: string;
  title: string;
  active_mode: string;
  created_at: string;
  updated_at: string;
}

export interface WritingRevision {
  id: string;
  session_id: string;
  revision_number: number;
  action_type:
    | "clarity"
    | "academic_tone"
    | "concise"
    | "grammar"
    | "transitions"
    | "structure"
    | "abstract"
    | "methodology"
    | "results_discussion"
    | "conclusion"
    | "simplify";
  original_text: string;
  revised_text: string;
  diff_summary: string;
  preserved_numbers_ok: boolean;
  preserved_citations_ok: boolean;
  preserved_equations_ok: boolean;
  preserved_dois_ok: boolean;
  meaning_risk_flags: string | null;
  is_accepted: boolean;
  created_at: string;
}

export interface IntegrityModelDescriptor {
  id: string;
  model_name: string;
  task_type: string;
  hf_repo_id: string | null;
  revision: string | null;
  license: string;
  is_local: boolean;
  is_available: boolean;
  size_mb: number;
  evaluation_summary: string | null;
  created_at: string;
}

export interface IntegrityDashboardSummary {
  total_documents_analyzed: number;
  total_corpus_sources: number;
  total_fingerprints_indexed: number;
  recent_similarity_runs: SimilarityRun[];
  available_models: IntegrityModelDescriptor[];
  active_writing_sessions: number;
}

// ---------------------------------------------------------------------------
// Literature Review Matrix & Evidence-Linked Copilot
// ---------------------------------------------------------------------------

export interface MatrixColumnConfig {
  key: string;
  label: string;
  col_type: string;
  required: boolean;
  width?: number | null;
}

export interface MatrixWorkspace {
  id: string;
  title: string;
  description: string | null;
  columns_json: string;
  created_at: string;
  updated_at: string;
}

export interface MatrixExtraction {
  id: string;
  workspace_id: string;
  paper_id: string;
  field_key: string;
  extracted_value: string;
  confidence: number;
  page_number: number | null;
  char_offset_start: number | null;
  char_offset_end: number | null;
  source_passage: string | null;
  status: "extracted" | "user_verified" | "flagged";
  created_at: string;
  updated_at: string;
}

export interface EvidenceSource {
  paper_id: string;
  paper_title: string;
  page_number: number | null;
  passage: string;
  confidence: number;
  char_offset_start: number | null;
  char_offset_end: number | null;
}

export interface EvidenceCopilotSession {
  id: string;
  title: string;
  target_scope: string;
  target_paper_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceCopilotMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  evidence_sources_json: string;
  created_at: string;
}

export interface MatrixRow {
  paper_id: string;
  paper_title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  pdf_path: string | null;
  added_at: string;
  extractions: Record<string, MatrixExtraction>;
}

export interface MatrixWorkspaceDetail {
  workspace: MatrixWorkspace;
  columns: MatrixColumnConfig[];
  rows: MatrixRow[];
  total_papers: number;
  total_extractions: number;
}







