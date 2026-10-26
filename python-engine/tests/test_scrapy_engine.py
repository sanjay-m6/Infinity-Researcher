"""
Integration tests for ScrapySearchEngine settings, spider registry, and crawl lifecycle.
"""

import pytest
from paper_scraper.engine.crawler import ScrapySearchEngine
from paper_scraper.engine.settings import get_scrapy_settings
from paper_scraper.spiders import SPIDER_REGISTRY


def test_scrapy_settings_configuration():
    settings = get_scrapy_settings()

    # Core requirements
    assert settings.getbool("ROBOTSTXT_OBEY") is True
    assert settings.getbool("AUTOTHROTTLE_ENABLED") is True
    assert settings.getint("CONCURRENT_REQUESTS") == 16
    assert settings.getint("DOWNLOAD_TIMEOUT") == 25
    assert settings.getbool("LOG_STDOUT") is False

    # Middlewares
    downloader_mw = settings.get("DOWNLOADER_MIDDLEWARES")
    assert "paper_scraper.middleware.anti_ssrf.AntiSsrfDownloaderMiddleware" in downloader_mw
    assert "paper_scraper.middleware.retry.ScholarRetryMiddleware" in downloader_mw

    # Pipelines
    pipelines = settings.get("ITEM_PIPELINES")
    assert "paper_scraper.pipelines.validation.ValidationPipeline" in pipelines
    assert "paper_scraper.pipelines.normalization.NormalizationPipeline" in pipelines
    assert "paper_scraper.pipelines.dedup.DeduplicationPipeline" in pipelines
    assert "paper_scraper.pipelines.relevance.RelevancePipeline" in pipelines
    assert "paper_scraper.pipelines.storage.StoragePipeline" in pipelines
    assert "paper_scraper.pipelines.event_dispatch.EventDispatchPipeline" in pipelines


def test_spider_registry():
    assert "arxiv" in SPIDER_REGISTRY
    assert "biorxiv" in SPIDER_REGISTRY
    assert "medrxiv" in SPIDER_REGISTRY
    assert "pubmed" in SPIDER_REGISTRY
    assert "pmc" in SPIDER_REGISTRY
    assert "plos" in SPIDER_REGISTRY
    assert "nature_srep" in SPIDER_REGISTRY

    arxiv_cls = SPIDER_REGISTRY["arxiv"]
    assert arxiv_cls.name == "arxiv"
    assert "arxiv.org" in arxiv_cls.allowed_domains

    medrxiv_cls = SPIDER_REGISTRY["medrxiv"]
    assert medrxiv_cls.name == "medrxiv"
    assert "medrxiv.org" in medrxiv_cls.allowed_domains

    nature_cls = SPIDER_REGISTRY["nature_srep"]
    assert nature_cls.name == "nature_srep"
    assert "ebi.ac.uk" in nature_cls.allowed_domains


def test_scrapy_search_engine_cancellation_tracking():
    engine = ScrapySearchEngine()
    cancelled = engine.cancel_job("job_nonexistent")
    assert cancelled is False
    assert "job_nonexistent" in engine.cancelled_jobs


@pytest.mark.asyncio
async def test_scrapy_search_engine_cancellation_lifecycle():
    engine = ScrapySearchEngine()
    events = []

    def on_event(ev_type: str, pl: dict, sid: str = None):
        events.append((ev_type, pl))

    engine.cancel_job("job_cancel_test")
    res = await engine.execute_search(
        job_id="job_cancel_test",
        query="biology",
        sources=["arxiv"],
        event_callback=on_event,
        timeout_seconds=5.0,
    )

    assert res["status"] == "cancelled"
    ev_types = [e[0] for e in events]
    assert "job.cancelled" in ev_types


@pytest.mark.asyncio
async def test_scrapy_search_engine_timeout_lifecycle():
    engine = ScrapySearchEngine()
    events = []

    def on_event(ev_type: str, pl: dict, sid: str = None):
        events.append((ev_type, pl))

    # Test that a tiny timeout triggers clean termination within deadline
    res = await engine.execute_search(
        job_id="job_timeout_test",
        query="neuroscience",
        sources=["arxiv"],
        event_callback=on_event,
        timeout_seconds=0.01,
    )

    assert res["status"] == "timed_out"
    ev_types = [e[0] for e in events]
    assert "job.timed_out" in ev_types

