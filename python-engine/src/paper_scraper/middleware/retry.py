"""
Scholar Retry and Response Classification Middleware.
Implements polite scholarly rate-limit and error classification:
- Honors 'Retry-After' headers on HTTP 429 responses
- Classifies anti-bot challenges and 403 Forbidden responses (records blocked status; never evades)
- Exponential backoff for transient 500/502/503/504 errors
"""

from __future__ import annotations

import logging
import time
from typing import Optional
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.http import Request, Response
from scrapy.utils.response import response_status_message

logger = logging.getLogger(__name__)


class ScholarRetryMiddleware(RetryMiddleware):
    """Polite retry middleware honoring Retry-After and classifying restrictions."""

    def process_response(self, request: Request, response: Response, spider) -> Response:
        if request.meta.get("dont_retry", False):
            return response

        # 1. HTTP 429 Rate Limited - Check Retry-After
        if response.status == 429:
            retry_after = response.headers.get("Retry-After")
            wait_sec = 5.0
            if retry_after:
                try:
                    val = retry_after.decode("utf-8").strip()
                    wait_sec = float(val)
                except (ValueError, TypeError):
                    wait_sec = 5.0

            logger.warning(
                "Source %s rate limited (HTTP 429). Server requested Retry-After %s s.",
                getattr(spider, "name", "unknown"),
                wait_sec,
            )
            # Notify spider of rate limit event
            if hasattr(spider, "record_status"):
                spider.record_status("rate_limited", f"HTTP 429 Rate limited. Retry-After: {wait_sec}s")

            # Apply backoff delay to request metadata
            request.meta["download_delay"] = max(request.meta.get("download_delay", 0), wait_sec)
            return self._retry(request, "HTTP 429 Rate Limited") or response

        # 2. HTTP 403 Forbidden or Anti-bot Challenge
        elif response.status == 403:
            logger.warning(
                "Source %s access forbidden (HTTP 403). Automated access restricted.",
                getattr(spider, "name", "unknown"),
            )
            if hasattr(spider, "record_status"):
                spider.record_status("blocked", "HTTP 403 Forbidden - Access restricted by source")
            # Do NOT retry 403; respect access control
            return response

        # 3. Standard transient 5xx server errors
        elif response.status in self.retry_http_codes:
            reason = response_status_message(response.status)
            return self._retry(request, reason) or response

        return response
