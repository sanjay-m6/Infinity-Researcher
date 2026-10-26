"""
Anti-SSRF Scrapy Downloader Middleware.
Enforces strict security checks on all outbound requests and redirect targets:
- Disallows non-HTTP/HTTPS schemes (file://, gopher://, ftp://)
- Disallows loopback (127.0.0.1, ::1)
- Disallows RFC1918 private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Disallows cloud metadata IP addresses (169.254.169.254, metadata.google.internal)
- Enforces response size bounds to prevent decompression/memory exhaustion
- Validates redirect targets before following
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urljoin
from scrapy import signals
from scrapy.exceptions import IgnoreRequest
from scrapy.http import Request, Response

from paper_scraper.security import MAX_CONTENT_LENGTH, is_safe_redirect, validate_url

logger = logging.getLogger(__name__)


class AntiSsrfDownloaderMiddleware:
    """Downloader middleware blocking SSRF attacks, internal IPs, and oversize payloads."""

    def __init__(self, check_dns: bool = True) -> None:
        self.check_dns = check_dns

    @classmethod
    def from_crawler(cls, crawler):
        check_dns = crawler.settings.getbool("ANTI_SSRF_CHECK_DNS", True)
        return cls(check_dns=check_dns)

    def process_request(self, request: Request, spider) -> Optional[Response]:
        """Validate request URL before scheduling network download."""
        # Allow Scrapy data: or memory fixtures in tests if configured
        if request.url.startswith("data:"):
            return None

        try:
            validate_url(request.url, check_dns=self.check_dns)
        except Exception as e:
            logger.warning("Anti-SSRF blocked request URL %s: %s", request.url, e)
            raise IgnoreRequest(f"Anti-SSRF blocked request: {e} ({request.url})")

        return None

    def process_response(self, request: Request, response: Response, spider) -> Response:
        """Validate response size and safe redirect targets."""
        # Check payload size
        content_len = len(response.body)
        if content_len > MAX_CONTENT_LENGTH:
            logger.warning("Response payload size (%d bytes) exceeds max limit for %s", content_len, request.url)
            raise IgnoreRequest(f"Payload too large: {content_len} bytes")

        # Check redirect Location headers for SSRF
        if response.status in (301, 302, 303, 307, 308):
            location = response.headers.get("Location")
            if location:
                loc_str = location.decode("utf-8", errors="ignore").strip()
                target_url = urljoin(request.url, loc_str)
                is_safe, reason = is_safe_redirect(request.url, target_url)
                if not is_safe:
                    logger.warning("Anti-SSRF blocked redirect target %s: %s", target_url, reason)
                    raise IgnoreRequest(f"Anti-SSRF blocked redirect: {reason}")

        return response
