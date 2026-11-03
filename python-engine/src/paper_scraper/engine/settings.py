"""
Central Scrapy Settings Configuration for Research Paper Scraping Engine.
Configures AutoThrottle, Anti-SSRF Downloader Middleware, Polite Retry Backoff,
Item Pipelines, and Stderr-isolated logging.
"""

from __future__ import annotations

import os
from typing import Any, Dict
from scrapy.settings import Settings


def get_scrapy_settings(custom_overrides: Dict[str, Any] = None) -> Settings:
    """Return a configured Scrapy Settings instance."""
    s = Settings()

    base_settings = {
        # User research search queries (disable robots.txt filtering for website search)
        "ROBOTSTXT_OBEY": False,

        # Standard modern browser User-Agent and headers for scholarly portals
        "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "DEFAULT_REQUEST_HEADERS": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        },

        # AutoThrottle: latency-adaptive rate control
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.5,
        "AUTOTHROTTLE_MAX_DELAY": 8.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 2.0,
        "AUTOTHROTTLE_DEBUG": False,

        # Bounded concurrency
        "CONCURRENT_REQUESTS": 16,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 4,
        "DOWNLOAD_TIMEOUT": 25,
        "COOKIES_ENABLED": True,
        "TELNETCONSOLE_ENABLED": False,

        # Stderr-isolated logging (keeps stdout clean for JSON Lines protocol)
        "LOG_ENABLED": True,
        "LOG_LEVEL": "WARNING",
        "LOG_STDOUT": False,

        # Downloader Middlewares
        "DOWNLOADER_MIDDLEWARES": {
            "paper_scraper.middleware.anti_ssrf.AntiSsrfDownloaderMiddleware": 50,
            "scrapy.downloadermiddlewares.retry.RetryMiddleware": None,  # replaced
            "paper_scraper.middleware.retry.ScholarRetryMiddleware": 550,
        },

        # Item Pipelines
        "ITEM_PIPELINES": {
            "paper_scraper.pipelines.validation.ValidationPipeline": 100,
            "paper_scraper.pipelines.normalization.NormalizationPipeline": 200,
            "paper_scraper.pipelines.dedup.DeduplicationPipeline": 300,
            "paper_scraper.pipelines.relevance.RelevancePipeline": 400,
            "paper_scraper.pipelines.storage.StoragePipeline": 500,
            "paper_scraper.pipelines.event_dispatch.EventDispatchPipeline": 600,
        },
    }

    s.setdict(base_settings, priority="project")
    if custom_overrides:
        s.setdict(custom_overrides, priority="cmdline")

    return s
