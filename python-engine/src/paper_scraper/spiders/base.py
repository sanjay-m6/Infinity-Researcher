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
        "ROBOTSTXT_OBEY": False,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.5,
        "AUTOTHROTTLE_MAX_DELAY": 5.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 2.0,
        "DEFAULT_REQUEST_HEADERS": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
        self.terminal_status = "queued"
        self.status_message: Optional[str] = None
        self.error_message: Optional[str] = None
        self.results_count = 0

    @classmethod
    def from_crawler(cls, crawler, *args: Any, **kwargs: Any):
        from scrapy import signals
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(spider.spider_closed, signal=signals.spider_closed)
        return spider

    async def start(self):
        """Bridge Scrapy 2.19 async start() with synchronous start_requests()."""
        for req in self.start_requests():
            yield req

    def spider_opened(self, spider):
        self.status = "searching"
        self.terminal_status = "searching"
        self.dispatch_event("source.started", {
            "source_id": getattr(self, "source_id", self.name),
            "status": "searching",
        })

    def spider_closed(self, spider, reason):
        if self.status in ("failed", "blocked", "rate_limited", "timeout"):
            status = self.status
        elif self.results_count > 0:
            status = "completed"
        elif reason == "finished":
            status = "no_results"
        else:
            status = reason
        self.status = status
        self.terminal_status = status
        self.dispatch_event("source.completed", {
            "source_id": getattr(self, "source_id", self.name),
            "count": self.results_count,
            "status": status,
            "reason": reason,
            "message": self.status_message or self.error_message,
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
        self.terminal_status = status
        self.status_message = message
        self.error_message = message
        if status in ("blocked", "rate_limited", "timeout"):
            self.dispatch_event(f"source.{status}", {
                "message": message or f"Source status updated to {status}",
                "status": status,
            })
        elif status == "failed":
            self.dispatch_event("source.failed", {
                "message": message or "Source search failed",
                "status": "failed",
            })

    def is_challenge_or_blocked_response(self, response: Response) -> tuple[bool, str]:
        """Detect HTTP 403, Cloudflare challenge, or CAPTCHA pages disguised as 200/403."""
        if response.status == 403:
            return True, "HTTP 403 Forbidden"
        if response.status == 429:
            return True, "HTTP 429 Rate Limited"
        text_lower = response.text[:2000].lower() if hasattr(response, "text") else ""
        if "cf-chl-" in text_lower or "just a moment..." in text_lower or "attention required! | cloudflare" in text_lower or "client challenge" in text_lower or "<title>challenge" in text_lower:
            return True, "Anti-bot challenge page detected (automated access restricted)"
        if "ddos-guard" in text_lower or ("waf" in text_lower and "blocked" in text_lower):
            return True, "Web Application Firewall block page detected"
        return False, ""

    def handle_error(self, failure):
        """Scrapy errback for logging and classifying network failures."""
        req = getattr(failure, "request", None)
        if not req and hasattr(failure, "value"):
            req = getattr(failure.value, "request", None)
        req_url = getattr(req, "url", "unknown") if req else "unknown"
        err_msg = str(getattr(failure, "value", failure))
        logger.warning("Request failed on %s (%s): %s", self.name, req_url, err_msg)
        if "429" in err_msg or "Too Many Requests" in err_msg:
            self.record_status("rate_limited", f"Rate limited by server (HTTP 429): {err_msg}")
        elif "403" in err_msg or "Forbidden" in err_msg:
            self.record_status("blocked", f"Access restricted by source server (HTTP 403): {err_msg}")
        elif "Timeout" in err_msg or "timed out" in err_msg.lower():
            self.record_status("timeout", f"Connection timed out: {err_msg}")
        elif "DNS" in err_msg or "gaierror" in err_msg.lower() or "Host not found" in err_msg:
            self.record_status("failed", f"DNS lookup failed: {err_msg}")
        elif "404" in err_msg:
            self.record_status("failed", f"Search endpoint not found (HTTP 404): {err_msg}")
        elif any(code in err_msg for code in ("500", "502", "503", "504")):
            self.record_status("failed", f"Source server error ({err_msg})")
        else:
            self.record_status("failed", err_msg)
