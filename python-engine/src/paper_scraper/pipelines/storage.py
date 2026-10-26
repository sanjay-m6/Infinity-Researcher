"""
SQLite Job and Metadata Storage Pipeline.
Persists discovered paper results to SQLite.
"""

from __future__ import annotations

import logging
from paper_scraper.jobs.state import JobStorage
from paper_scraper.models import PaperResult

logger = logging.getLogger(__name__)


class StoragePipeline:
    """Stores discovered paper metadata into SQLite crawl records."""

    def __init__(self, db_path: str = None) -> None:
        self.storage = JobStorage(db_path)

    @classmethod
    def from_crawler(cls, crawler):
        db_path = crawler.settings.get("SQLITE_DB_PATH")
        return cls(db_path=db_path)

    def process_item(self, item: PaperResult, spider) -> PaperResult:
        job_id = getattr(spider, "job_id", "default_job")
        try:
            self.storage.record_paper(job_id, item)
        except Exception as e:
            logger.warning("Failed to record paper %s in SQLite: %s", item.paper_id, e)

        return item
