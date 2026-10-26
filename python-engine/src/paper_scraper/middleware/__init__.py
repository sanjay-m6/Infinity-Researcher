"""
Scrapy downloader middlewares and logging.
"""

from paper_scraper.middleware.anti_ssrf import AntiSsrfDownloaderMiddleware
from paper_scraper.middleware.retry import ScholarRetryMiddleware
from paper_scraper.middleware.logging import configure_engine_logging

__all__ = ["AntiSsrfDownloaderMiddleware", "ScholarRetryMiddleware", "configure_engine_logging"]
