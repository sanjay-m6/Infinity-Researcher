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
  last_opened_at?: string | null;
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

export interface ExtractedPdfMetadata {
  title?: string | null;
  author?: string | null;
  authors: string[];
  doi?: string | null;
  abstract_text?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  license?: string | null;
  page_count: number;
  word_count: number;
  status: string;
  is_encrypted: boolean;
  is_scanned: boolean;
  error?: string | null;
}

export interface IeeeManualImportInput {
  file_path: string;
  title: string;
  authors: string[];
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  source_page_url?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  user_confirmed_oa: boolean;
  user_notes?: string | null;
  target_collection_id?: string | null;
  copy_to_library?: boolean;
}

export interface LocalOaPdfImportInput {
  file_path: string;
  title: string;
  authors: string[];
  publication_year?: number | null;
  venue?: string | null;
  canonical_doi?: string | null;
  abstract_text?: string | null;
  source_name?: string | null;
  source_page_url?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  user_confirmed_oa: boolean;
  user_notes?: string | null;
  target_collection_id?: string | null;
  copy_to_library?: boolean;
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
  reading_status?: string | null;
  reading_progress?: number | null;
  last_opened_at?: string | null;
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
  reading_status?: string | null;
  reading_progress?: number | null;
  last_opened_at?: string | null;
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
  sort_by?: "newest" | "oldest" | "citations" | "title" | "recently_opened" | null;
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
  page_number?: number | null;
  highlighted_text?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteSaveInput {
  id?: string | null;
  paper_id: string;
  title?: string | null;
  content_markdown: string;
  page_number?: number | null;
  highlighted_text?: string | null;
}

export interface SavedSearch {
  id: string;
  name: string;
  description: string | null;
  query_text: string | null;
  structured_query_json: string | null;
  selected_sources_json: string | null;
  filters_json: string | null;
  sort_by: string | null;
  result_count_estimate: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchCreateInput {
  name: string;
  description?: string | null;
  query_text?: string | null;
  structured_query_json?: string | null;
  selected_sources_json?: string | null;
  filters_json?: string | null;
  sort_by?: string | null;
}

export interface SavedSearchUpdateInput {
  id: string;
  name: string;
  description?: string | null;
  query_text?: string | null;
  structured_query_json?: string | null;
  selected_sources_json?: string | null;
  filters_json?: string | null;
  sort_by?: string | null;
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
  id?: string;
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
  supports_author_search?: boolean;
  supports_abstracts?: boolean;
  supports_pdf_discovery?: boolean;
  supports_pagination?: boolean;
  supports_cursor_pagination?: boolean;
  requires_api_key: boolean;
  category?: string;
  auth_type?: string;
  preferred_identifier?: string;
}

export type ProviderHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "rate_limited"
  | "auth_required";

export interface ProviderHealthCheck {
  provider_id: string;
  status: ProviderHealthStatus;
  latency_ms: number;
  message?: string | null;
  checked_at: string;
}

export interface MetadataCompleteness {
  score: number;
  has_doi: boolean;
  has_abstract: boolean;
  has_pdf: boolean;
  has_authors: boolean;
  has_venue: boolean;
  has_date: boolean;
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
  metadata_score?: number;
  completeness?: MetadataCompleteness;
  version_type?: string | null;
  pdf_status?: string | null;
}

export interface ProviderQueryPlan {
  provider_id: string;
  native_query: string;
  pushes_year_filter: boolean;
  pushes_oa_filter: boolean;
  requires_client_filtering: boolean;
  warnings: string[];
}

export interface AcademicSearchPlan {
  raw_query: string;
  detected_identifier_type?: string | null;
  cleaned_identifier?: string | null;
  provider_plans: ProviderQueryPlan[];
  global_warnings: string[];
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
  query_plan?: AcademicSearchPlan | null;
  warnings?: string[];
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
  | "verified_open_access"
  | "verified_authorized_access"
  | "download_queued"
  | "downloading"
  | "downloaded"
  | "metadata_only"
  | "public_metadata_only"
  | "landing_page_only"
  | "restricted_or_subscription"
  | "access_restricted"
  | "authentication_required"
  | "source_unverified"
  | "not_found"
  | "blocked_by_policy"
  | "failed_retryable"
  | "failed_permanent"
  | "retrieval_failed"
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
  version_type?: string | null;
  identity_status?: string | null;
  identity_score?: number | null;
  provenance_json?: string | null;
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
  status: "queued" | "resolving" | "downloading" | "validating" | "verifying_identity" | "completed" | "failed" | "cancelling" | "cancelled";
  bytes_downloaded: number;
  total_bytes: number;
  progress_percent: number;
  stage_message: string;
  error_message?: string | null;
  destination_path?: string | null;
  sha256_hash?: string | null;
  retry_count: number;
  speed_bps?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_category?: string | null;
  version_type?: string | null;
  identity_status?: string | null;
  identity_score?: number | null;
  identity_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DownloadStorageMetrics {
  storage_path: string;
  total_bytes: number;
  pdf_count: number;
  temp_files_count: number;
  temp_files_bytes: number;
}

export interface CleanOrphanedResult {
  files_deleted: number;
  bytes_freed: number;
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
  version_type?: string | null;
  identity_status?: string | null;
  identity_score?: number | null;
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
  provenance_urls?: string[];
  citation_count?: number | null;
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

export interface PageTextItem {
  page_number: number;
  text: string;
  section_heading?: string | null;
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

export interface VerifiedEvidenceItem {
  chunk_id: string;
  paper_id: string;
  page_number: number;
  section_heading?: string | null;
  snippet: string;
  is_verified: boolean;
  verification_method: string;
  confidence: number;
}

export interface AiRagContext {
  query: string;
  scope: string; // 'paper' | 'library' | 'none'
  paper_id?: string | null;
  passages: AiChunkCitation[];
  warnings: string[];
  is_grounded: boolean;
}

export interface AiChatSession {
  id: string;
  paper_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
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
  ui_context?: string | null;
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

// ---------------------------------------------------------------------------
// Phase 9: AI Tools, Citation Audits, and Integrity Persistence
// ---------------------------------------------------------------------------

export interface IngestedDocumentMeta {
  document_hash: string;
  file_name: string;
  file_format: string;
  word_count: number;
  char_count: number;
  is_clean_encoding: boolean;
  existing_report_id?: string | null;
}

export interface AnalysisJob {
  id: string;
  job_type: string;
  document_hash: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress_pct: number;
  current_step?: string | null;
  result_json?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrityReportFindingDb {
  id: string;
  report_id: string;
  dimension: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  confidence: string;
  evidence: string;
  location: string;
  suggested_action: string;
  is_reviewed: boolean;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
}

export interface SavedIntegrityReportDb {
  id: string;
  document_hash: string;
  file_name: string;
  title: string;
  word_count: number;
  dimensions_json: string;
  ethical_disclaimer: string;
  findings_count: number;
  unreviewed_count: number;
  created_at: string;
  updated_at: string;
  findings: IntegrityReportFindingDb[];
}

export interface SavedCitationAuditDb {
  id: string;
  document_hash: string;
  document_title: string;
  file_name: string;
  total_in_text: number;
  total_references: number;
  matched_citations: number;
  health_score: number;
  summary_json: string;
  issues_json: string;
  references_json: string;
  created_at: string;
}

export interface SavedReadabilityReportDb {
  id: string;
  document_hash: string;
  document_title: string;
  language_code: string;
  word_count: number;
  sentence_count: number;
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  gunning_fog_index: number;
  metrics_json: string;
  vocabulary_json: string;
  paragraphs_json: string;
  recommendations_json: string;
  created_at: string;
}

export interface WritingRevisionDb {
  id: string;
  session_id: string;
  revision_number: number;
  action_type: string;
  original_text: string;
  revised_text: string;
  diff_summary: string;
  preserved_numbers_ok: boolean;
  preserved_citations_ok: boolean;
  preserved_equations_ok: boolean;
  preserved_dois_ok: boolean;
  is_accepted: boolean;
  created_at: string;
}

export interface ExtractedDocumentResult {
  file_name: string;
  file_type: string;
  text: string;
  char_count: number;
  word_count: number;
  warning?: string | null;
}

export interface AiSignalDetectionResult {
  status: string;
  overall_signal_score: number;
  classification: string;
  sentence_count: number;
  mean_sentence_length: number;
  std_dev?: number;
  variance?: number;
  burstiness: number;
  lexical_diversity_ttr?: number;
  uncertainty_caveat: string;
}










// =============================================================================
// Research Project Management, To-Dos, Domains & AI Diagnostics (Phase 18)
// =============================================================================

export interface ResearchDomain {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDomainInput {
  name: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface ResearchProject {
  id: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  research_questions?: string | null;
  hypotheses?: string | null;
  expected_outcomes?: string | null;
  primary_domain_id?: string | null;
  subdomain_id?: string | null;
  custom_domain_text?: string | null;
  status: "active" | "completed" | "archived" | "on_hold";
  priority: "low" | "medium" | "high" | "critical";
  progress_percent: number;
  start_date?: string | null;
  target_deadline?: string | null;
  completed_at?: string | null;
  tags_json: string;
  template_type?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string | null;
  objective?: string | null;
  research_questions?: string | null;
  hypotheses?: string | null;
  expected_outcomes?: string | null;
  primary_domain_id?: string | null;
  subdomain_id?: string | null;
  custom_domain_text?: string | null;
  priority?: string | null;
  start_date?: string | null;
  target_deadline?: string | null;
  template_type?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface UpdateProjectInput {
  id: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  research_questions?: string | null;
  hypotheses?: string | null;
  expected_outcomes?: string | null;
  primary_domain_id?: string | null;
  subdomain_id?: string | null;
  custom_domain_text?: string | null;
  status: string;
  priority: string;
  start_date?: string | null;
  target_deadline?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneInput {
  project_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  sort_order?: number | null;
}

export interface UpdateMilestoneInput {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  is_completed: boolean;
  sort_order?: number | null;
}

export interface ProjectTask {
  id: string;
  project_id?: string | null;
  parent_task_id?: string | null;
  milestone_id?: string | null;
  title: string;
  description?: string | null;
  phase: "planning" | "literature_review" | "methodology" | "experimentation" | "writing" | "review";
  status: "backlog" | "todo" | "in_progress" | "blocked" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  tags_json: string;
  completion_notes?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  project_id?: string | null;
  parent_task_id?: string | null;
  milestone_id?: string | null;
  title: string;
  description?: string | null;
  phase?: string | null;
  status?: string | null;
  priority?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  tags?: string[] | null;
  dependency_task_ids?: string[] | null;
  linked_paper_ids?: string[] | null;
}

export interface UpdateTaskInput {
  id: string;
  title: string;
  description?: string | null;
  phase: string;
  status: string;
  priority: string;
  milestone_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  tags?: string[] | null;
  completion_notes?: string | null;
}

export interface ProjectPaper {
  id: string;
  project_id: string;
  paper_id: string;
  paper_title: string;
  paper_authors: string[];
  publication_year?: number | null;
  venue?: string | null;
  relationship_type: string;
  notes?: string | null;
  added_at: string;
}

export interface TaskPaper {
  id: string;
  task_id: string;
  paper_id: string;
  paper_title: string;
  notes?: string | null;
  added_at: string;
}

export interface TaskWithDetails {
  task: ProjectTask;
  project_title?: string | null;
  milestone_title?: string | null;
  dependencies: string[];
  dependency_titles: string[];
  is_blocked: boolean;
  linked_papers: TaskPaper[];
  subtask_count: number;
  completed_subtask_count: number;
}

export interface ProjectWithDetails {
  project: ResearchProject;
  primary_domain_name?: string | null;
  subdomain_name?: string | null;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  total_milestones: number;
  completed_milestones: number;
  linked_papers_count: number;
}

export interface ProjectActivityEvent {
  id: string;
  project_id: string;
  activity_type: string;
  title: string;
  details?: string | null;
  created_at: string;
}

export interface ProposedTask {
  title: string;
  description: string;
  phase: string;
  priority: string;
  estimated_hours: number;
  suggested_days_from_start: number;
  prerequisite_indexes: number[];
  deliverable?: string | null;
}

export interface ProposedMilestone {
  title: string;
  description: string;
  suggested_days_from_start: number;
  tasks: ProposedTask[];
}

export interface AiProjectPlanProposal {
  project_title: string;
  objective_summary: string;
  methodology_strategy: string;
  estimated_total_weeks: number;
  milestones: ProposedMilestone[];
  recommended_paper_search_queries: string[];
}

export interface ApplyPlanInput {
  project_id: string;
  milestones: ProposedMilestone[];
}

export interface AiDiagnosticReport {
  provider_id: string;
  display_name: string;
  is_enabled: boolean;
  is_local: boolean;
  access_category: string;
  endpoint_url: string;
  selected_model: string;
  has_credential: boolean;
  is_ready: boolean;
  connection_status: string;
  last_health_message?: string | null;
  last_error_category?: string | null;
  latency_ms?: number | null;
  streaming_supported: boolean;
  embeddings_supported: boolean;
  reranker_supported: boolean;
}

export interface DiagnosticTestGenResult {
  provider_id: string;
  model_id: string;
  success: boolean;
  response_text?: string | null;
  latency_ms: number;
  error_category?: string | null;
  error_message?: string | null;
}

// ---------------------------------------------------------------------------
// In-App Local AI Engine & Sidecar Types
// ---------------------------------------------------------------------------

export interface HardwareProfile {
  total_ram_mb: number;
  available_ram_mb: number;
  cpu_cores: number;
  recommended_tier: "nano" | "balanced" | "pro";
}

export interface DownloadProgress {
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  status: string;
}

export interface LocalAiStatus {
  is_running: boolean;
  port: number;
  active_model?: string | null;
  endpoint: string;
}

export interface InstalledModelInfo {
  filename: string;
  size_mb: number;
  full_path: string;
}
