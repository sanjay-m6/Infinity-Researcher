"""
Persistent SQLite Job and Metadata Storage.
Tracks search sessions, crawl history, and discovered paper records across runs.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any, Dict, List, Optional

from paper_scraper.models import PaperResult

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "crawl_jobs.db"
)


from contextlib import contextmanager


class JobStorage:
    """Manages SQLite persistent job tracking and paper history."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self.db_path = db_path or DEFAULT_DB_PATH
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS crawl_jobs (
                    job_id TEXT PRIMARY KEY,
                    query TEXT NOT NULL,
                    sources_json TEXT,
                    status TEXT NOT NULL,  -- started, completed, cancelled, failed
                    total_results INTEGER DEFAULT 0,
                    duration_ms INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS crawl_papers (
                    paper_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    doi TEXT,
                    arxiv_id TEXT,
                    paper_url TEXT NOT NULL,
                    pdf_url TEXT,
                    publication_year INTEGER,
                    relevance_score REAL,
                    metadata_confidence REAL,
                    raw_data_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (job_id, paper_id)
                );

                CREATE INDEX IF NOT EXISTS idx_papers_job ON crawl_papers(job_id);
                CREATE INDEX IF NOT EXISTS idx_papers_doi ON crawl_papers(doi);
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON crawl_jobs(status);
            """)

    def record_job_start(self, job_id: str, query: str, sources: Optional[List[str]] = None) -> None:
        sources_json = json.dumps(sources or [])
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO crawl_jobs (job_id, query, sources_json, status, total_results, duration_ms)
                VALUES (?, ?, ?, 'started', 0, 0)
                """,
                (job_id, query, sources_json),
            )

    def record_job_complete(self, job_id: str, total_results: int, duration_ms: int, status: str = "completed") -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                UPDATE crawl_jobs
                SET status = ?, total_results = ?, duration_ms = ?, completed_at = CURRENT_TIMESTAMP
                WHERE job_id = ?
                """,
                (status, total_results, duration_ms, job_id),
            )

    def record_paper(self, job_id: str, paper: PaperResult) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO crawl_papers (
                    paper_id, job_id, source_id, title, doi, arxiv_id,
                    paper_url, pdf_url, publication_year, relevance_score,
                    metadata_confidence, raw_data_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    paper.paper_id,
                    job_id,
                    paper.source_id,
                    paper.title,
                    paper.doi,
                    paper.arxiv_id,
                    paper.landing_page_url,
                    paper.pdf_url,
                    paper.publication_year,
                    paper.relevance_score,
                    paper.metadata_confidence,
                    json.dumps(paper.to_discovered_search_result()),
                ),
            )

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM crawl_jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            res = dict(row)
            res["sources"] = json.loads(res.get("sources_json") or "[]")
            return res

    def list_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM crawl_jobs ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["sources"] = json.loads(d.get("sources_json") or "[]")
                results.append(d)
            return results

    def get_job_papers(self, job_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT raw_data_json FROM crawl_papers WHERE job_id = ? ORDER BY relevance_score DESC",
                (job_id,),
            ).fetchall()
            return [json.loads(r["raw_data_json"]) for r in rows if r["raw_data_json"]]
