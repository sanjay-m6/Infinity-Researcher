-- Migration 0002: Website Scraping Engine & Crawl Job Management
-- SQLite 3 (WAL mode, Foreign Keys ON)

-- 1. Crawl Profiles Table (Configurable website scraping rules)
CREATE TABLE IF NOT EXISTS crawl_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    allowed_patterns TEXT NOT NULL DEFAULT '[]',
    disallowed_patterns TEXT NOT NULL DEFAULT '[]',
    paper_link_selectors TEXT NOT NULL DEFAULT '[]',
    title_selector TEXT,
    authors_selector TEXT,
    abstract_selector TEXT,
    doi_selector TEXT,
    date_selector TEXT,
    venue_selector TEXT,
    pdf_link_selector TEXT,
    use_meta_tags INTEGER NOT NULL DEFAULT 1,
    request_delay_ms INTEGER NOT NULL DEFAULT 1000,
    max_depth INTEGER NOT NULL DEFAULT 2,
    max_pages INTEGER NOT NULL DEFAULT 50,
    headers TEXT,
    is_built_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_profiles_domain ON crawl_profiles(domain);
CREATE INDEX IF NOT EXISTS idx_crawl_profiles_builtin ON crawl_profiles(is_built_in);

-- 2. Crawl Jobs Table (Persistent crawling sessions)
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL REFERENCES crawl_profiles(id) ON DELETE CASCADE,
    start_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, cancelled, failed
    pages_queued INTEGER NOT NULL DEFAULT 0,
    pages_visited INTEGER NOT NULL DEFAULT 0,
    pages_failed INTEGER NOT NULL DEFAULT 0,
    papers_found INTEGER NOT NULL DEFAULT 0,
    current_depth INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created ON crawl_jobs(created_at);

-- 3. Crawl Queue Table (URL queue with depth tracking and status)
CREATE TABLE IF NOT EXISTS crawl_queue (
    id TEXT PRIMARY KEY NOT NULL,
    job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, skipped
    retry_count INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER,
    error_message TEXT,
    discovered_at TEXT NOT NULL,
    processed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_queue_job_url ON crawl_queue(job_id, url);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status ON crawl_queue(job_id, status);

-- 4. Extracted Crawled Papers Table
CREATE TABLE IF NOT EXISTS crawl_job_papers (
    id TEXT PRIMARY KEY NOT NULL,
    job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    canonical_doi TEXT,
    authors TEXT NOT NULL DEFAULT '[]',
    abstract_text TEXT,
    publication_date TEXT,
    venue TEXT,
    pdf_url TEXT,
    is_imported INTEGER NOT NULL DEFAULT 0,
    discovered_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawl_job_papers_job ON crawl_job_papers(job_id);
CREATE INDEX IF NOT EXISTS idx_crawl_job_papers_imported ON crawl_job_papers(is_imported);

-- Seed Default Scholarly Website Profiles (bioRxiv, Nature, PLOS, ACM, Generic)
INSERT OR IGNORE INTO crawl_profiles (
    id, name, domain, description, allowed_patterns, disallowed_patterns,
    paper_link_selectors, title_selector, authors_selector, abstract_selector,
    doi_selector, date_selector, venue_selector, pdf_link_selector,
    use_meta_tags, request_delay_ms, max_depth, max_pages, headers,
    is_built_in, created_at, updated_at
) VALUES
(
    'biorxiv',
    'bioRxiv Preprints',
    'biorxiv.org',
    'Preprint repository for the biological sciences hosted by Cold Spring Harbor Laboratory.',
    '["/content/10.1101/"]',
    '["/download/", "\\.zip$"]',
    '["a.highwire-cite-linked-title", "a[data-article-id]"]',
    'h1#page-title',
    'span.highwire-citation-author',
    'div.abstract',
    'span.highwire-cite-metadata-doi',
    NULL,
    NULL,
    'a.pdf-link',
    1,
    1000,
    2,
    50,
    NULL,
    1,
    datetime('now'),
    datetime('now')
),
(
    'nature',
    'Nature Publishing Group',
    'nature.com',
    'Leading multidisciplinary academic journals and scientific research reports.',
    '["/articles/"]',
    '["/search", "/login"]',
    '["a[data-track-action=\"view article\"]", "a.c-card__link"]',
    'h1.c-article-title',
    'ul.c-article-author-list li',
    'div#Abs1-content',
    'span.c-bibliographic-information__value',
    NULL,
    NULL,
    'a[data-article-pdf=\"true\"]',
    1,
    1500,
    2,
    30,
    NULL,
    1,
    datetime('now'),
    datetime('now')
),
(
    'plos',
    'PLOS Open Access Journals',
    'journals.plos.org',
    'Peer-reviewed open access journals in science and medicine.',
    '["/plosone/article", "/article\\?id="]',
    '["/search"]',
    '["a.title", "h3.title a"]',
    'h1#artTitle',
    'ul.author-list li a',
    'div.abstract',
    'li#doi a',
    NULL,
    NULL,
    'a#downloadPdf',
    1,
    1000,
    2,
    40,
    NULL,
    1,
    datetime('now'),
    datetime('now')
),
(
    'acm',
    'ACM Digital Library',
    'dl.acm.org',
    'Computing and information technology research literature and proceedings.',
    '["/doi/10.1145/"]',
    '["/action/doSearch", "/feedback"]',
    '["a.issue-item__title", ".hlFld-Title a"]',
    'h1.citation__title',
    'span.loa__author-name',
    'div.abstractSection',
    'span.issue-item__doi',
    NULL,
    NULL,
    'a.pdf-btn',
    1,
    2000,
    2,
    25,
    NULL,
    1,
    datetime('now'),
    datetime('now')
),
(
    'generic',
    'Generic Scholarly Website',
    '*',
    'Universal profile extracting Highwire Press, Dublin Core, and Schema.org JSON-LD metadata.',
    '[]',
    '[]',
    '["a[href*=\"/content/\"]", "a[href*=\"/article/\"]", "a[href*=\"/abs/\"]", "a[href*=\"/doi/\"]"]',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    1500,
    2,
    50,
    NULL,
    1,
    datetime('now'),
    datetime('now')
);
