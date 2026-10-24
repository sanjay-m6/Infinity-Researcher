-- Migration 0001: Initial Relational Schema for Research Paper Scraper
-- SQLite 3 (WAL mode, Foreign Keys ON, FTS5 enabled)

-- 1. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

-- 2. Papers Table (Canonical bibliographic records)
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY NOT NULL,
    canonical_doi TEXT UNIQUE,
    title TEXT NOT NULL,
    clean_title_key TEXT NOT NULL,
    abstract TEXT,
    publication_date TEXT,
    publication_year INTEGER,
    venue TEXT,
    venue_type TEXT,
    language TEXT DEFAULT 'en',
    citation_count INTEGER DEFAULT 0,
    reference_count INTEGER DEFAULT 0,
    is_open_access INTEGER NOT NULL DEFAULT 0,
    license TEXT,
    primary_landing_url TEXT,
    pdf_url TEXT,
    has_file INTEGER NOT NULL DEFAULT 0,
    local_pdf_path TEXT,
    content_hash TEXT,
    metadata_confidence TEXT NOT NULL DEFAULT 'verified',
    is_saved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(canonical_doi) WHERE canonical_doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_clean_title ON papers(clean_title_key);
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(publication_year);
CREATE INDEX IF NOT EXISTS idx_papers_created ON papers(created_at);
CREATE INDEX IF NOT EXISTS idx_papers_updated ON papers(updated_at);
CREATE INDEX IF NOT EXISTS idx_papers_is_saved ON papers(is_saved);

-- 3. Authors Table
CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT NOT NULL,
    family_name TEXT,
    given_name TEXT,
    orcid TEXT UNIQUE,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authors_orcid ON authors(orcid) WHERE orcid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(full_name);

-- 4. Paper-Authors Junction Table
CREATE TABLE IF NOT EXISTS paper_authors (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    author_order INTEGER NOT NULL DEFAULT 0,
    affiliation TEXT,
    role TEXT NOT NULL DEFAULT 'author',
    PRIMARY KEY (paper_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_authors_paper ON paper_authors(paper_id, author_order);
CREATE INDEX IF NOT EXISTS idx_paper_authors_author ON paper_authors(author_id);

-- 5. Academic Sources Table
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'api',
    tier TEXT NOT NULL DEFAULT 'tier_a',
    base_url TEXT NOT NULL,
    policy_url TEXT,
    notes TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    rate_limit_rps INTEGER NOT NULL DEFAULT 10,
    concurrency_limit INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. Paper-Sources Junction Table (Multi-source provenance)
CREATE TABLE IF NOT EXISTS paper_sources (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_record_id TEXT NOT NULL,
    source_url TEXT,
    raw_payload_json TEXT,
    open_access_pdf_url TEXT,
    retrieved_at TEXT NOT NULL,
    PRIMARY KEY (paper_id, source_id),
    UNIQUE (source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_sources_lookup ON paper_sources(source_id, source_record_id);

-- 7. Collections Table
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY NOT NULL,
    parent_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_name_lower ON collections(lower(name));

-- 8. Collection-Papers Junction Table
CREATE TABLE IF NOT EXISTS collection_papers (
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (collection_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_papers_paper ON collection_papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_collection_papers_collection ON collection_papers(collection_id);

-- 9. Tags Table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#64748b',
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_lower ON tags(lower(name));

-- 10. Paper-Tags Junction Table
CREATE TABLE IF NOT EXISTS paper_tags (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    tagged_at TEXT NOT NULL,
    PRIMARY KEY (paper_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_tags_tag ON paper_tags(tag_id);

-- 11. Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Research Notes',
    content_markdown TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_paper ON notes(paper_id);

-- 12. App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 13. Full-Text Search (FTS5) Table
CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
    paper_id UNINDEXED,
    title,
    abstract,
    authors,
    venue,
    tokenize = 'unicode61 remove_diacritics 1'
);

-- Seed Initial Academic Sources (Phase 1 Source Matrix)
INSERT OR IGNORE INTO sources (id, name, source_type, tier, base_url, policy_url, rate_limit_rps, concurrency_limit, created_at, updated_at)
VALUES
    ('openalex', 'OpenAlex', 'api', 'tier_a', 'https://api.openalex.org', 'https://docs.openalex.org', 10, 3, datetime('now'), datetime('now')),
    ('crossref', 'Crossref', 'api', 'tier_a', 'https://api.crossref.org', 'https://www.crossref.org/documentation', 10, 2, datetime('now'), datetime('now')),
    ('arxiv', 'arXiv', 'repository', 'tier_a', 'https://export.arxiv.org/api', 'https://arxiv.org/help/api', 1, 1, datetime('now'), datetime('now')),
    ('semantic_scholar', 'Semantic Scholar', 'api', 'tier_a', 'https://api.semanticscholar.org/graph/v1', 'https://www.semanticscholar.org/product/api', 5, 2, datetime('now'), datetime('now')),
    ('europe_pmc', 'Europe PMC', 'api', 'tier_b', 'https://www.ebi.ac.uk/europepmc/webservices/rest', 'https://europepmc.org/RestfulWebService', 5, 2, datetime('now'), datetime('now')),
    ('doaj', 'DOAJ', 'structured_feed', 'tier_b', 'https://doaj.org/api', 'https://doaj.org/docs/api', 5, 2, datetime('now'), datetime('now')),
    ('ieee', 'IEEE Xplore', 'commercial_linkout', 'tier_c', 'https://ieeexplore.ieee.org', 'https://developer.ieee.org', 2, 1, datetime('now'), datetime('now')),
    ('sciencedirect', 'ScienceDirect', 'commercial_linkout', 'tier_c', 'https://api.elsevier.com', 'https://dev.elsevier.com', 2, 1, datetime('now'), datetime('now'));
