"""
Base Scholarly Spider Architecture.
Provides common initialization, headers, event dispatching, and status tracking.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional
import scrapy
from scrapy.http import Request, Response

from paper_scraper.models import QueryFilter

logger = logging.getLogger(__name__)


class BasePaperSpider(scrapy.Spider):
    """Abstract base spider for academic paper repositories."""

    custom_settings: Dict[str, Any] = {
        "ROBOTSTXT_OBEY": True,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.5,
        "AUTOTHROTTLE_MAX_DELAY": 5.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 2.0,
        "DEFAULT_REQUEST_HEADERS": {
            "User-Agent": "PaperScraper/1.0 (Scholarly Research Discovery Engine; mailto:research@example.org)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    }

    def __init__(
        self,
        query: str = "",
        job_id: str = "default_job",
        limit: int = 10,
        year_start: Optional[int] = None,
        year_end: Optional[int] = None,
        author: Optional[str] = None,
        event_sink: Optional[Callable[[str, Dict[str, Any], Optional[str]], None]] = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.query = query
        self.job_id = job_id
        self.limit = int(limit)
        self.year_start = int(year_start) if year_start else None
        self.year_end = int(year_end) if year_end else None
        self.author = author
        self.event_sink = event_sink
        self.status = "queued"
        self.status_message: Optional[str] = None
        self.results_count = 0

    @classmethod
    def from_crawler(cls, crawler, *args: Any, **kwargs: Any):
        from scrapy import signals
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(spider.spider_closed, signal=signals.spider_closed)
        return spider

    def spider_opened(self, spider):
        self.status = "searching"
        self.dispatch_event("source.started", {
            "source_id": getattr(self, "source_id", self.name),
            "status": "searching",
        })

    def spider_closed(self, spider, reason):
        status = "completed" if reason == "finished" else reason
        self.status = status
        self.dispatch_event("source.completed", {
            "source_id": getattr(self, "source_id", self.name),
            "count": self.results_count,
            "status": status,
            "reason": reason,
        })

    def dispatch_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Forward lifecycle or item event to the registered event sink."""
        if self.event_sink:
            try:
                self.event_sink(event_type, payload, getattr(self, "source_id", self.name))
            except Exception as e:
                logger.error("Failed to dispatch spider event %s: %s", event_type, e)

    def record_status(self, status: str, message: Optional[str] = None) -> None:
        """Update source status and notify engine."""
        self.status = status
        self.status_message = message
        if status in ("blocked", "rate_limited"):
            self.dispatch_event(f"source.{status}", {
                "message": message or f"Source status updated to {status}",
            })
        elif status == "failed":
            self.dispatch_event("source.failed", {
                "message": message or "Source search failed",
                "status": "failed",
            })

    def handle_error(self, failure):
        """Scrapy errback for logging and classifying network failures."""
        req_url = getattr(failure.request, "url", "unknown")
        err_msg = str(failure.value)
        logger.warning("Request failed on %s (%s): %s", self.name, req_url, err_msg)
        if "429" in err_msg:
            self.record_status("rate_limited", err_msg)
        elif "403" in err_msg or "Forbidden" in err_msg:
            self.record_status("blocked", err_msg)
        else:
            self.record_status("failed", err_msg)
