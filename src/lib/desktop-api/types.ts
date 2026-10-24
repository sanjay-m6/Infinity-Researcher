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
  created_at: string;
  updated_at: string;
  authors: DbAuthor[];
  collection_ids: string[];
  tags: string[];
  source_names: string[];
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
  authors?: string[] | null;
  collection_ids?: string[] | null;
  tags?: string[] | null;
}

export interface PaperListQuery {
  query?: string | null;
  collection_id?: string | null;
  source_id?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  open_access_only?: boolean | null;
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
