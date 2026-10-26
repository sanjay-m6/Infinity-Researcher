"""
Unit tests for Scrapy Item Pipeline chain.
"""

import os
import tempfile
import pytest
from scrapy.exceptions import DropItem

from paper_scraper.models import PaperResult
from paper_scraper.pipelines.dedup import DeduplicationPipeline
from paper_scraper.pipelines.event_dispatch import EventDispatchPipeline
from paper_scraper.pipelines.normalization import NormalizationPipeline
from paper_scraper.pipelines.relevance import RelevancePipeline
from paper_scraper.pipelines.storage import StoragePipeline
from paper_scraper.pipelines.validation import ValidationPipeline
from paper_scraper.spiders.arxiv import ArxivSpider


def create_sample_paper(title: str = "Attention in Vision", doi: str = "10.1234/test.001") -> PaperResult:
    return PaperResult(
        paper_id=PaperResult.generate_id("arxiv", title, doi),
        title=title,
        authors=["Alice Smith", "Bob Jones"],
        abstract="Abstract: A comprehensive study on attention mechanisms.",
        publication_year=2024,
        published_date="2024-03-01",
        venue="arXiv",
        publisher="arXiv",
        doi=doi,
        source_id="arxiv",
        source_name="arXiv",
        source_page_url="https://arxiv.org/abs/2401.0001",
        landing_page_url="https://arxiv.org/abs/2401.0001",
        pdf_url="https://arxiv.org/pdf/2401.0001.pdf",
    )


def test_validation_pipeline_drops_empty_title():
    pipeline = ValidationPipeline()
    spider = ArxivSpider(query="test")

    # Valid item passes
    valid_paper = create_sample_paper()
    res = pipeline.process_item(valid_paper, spider)
    assert res.title == "Attention in Vision"

    # Malformed item with empty title drops
    with pytest.raises(DropItem, match="Validation failed|too short or empty"):
        pipeline.process_item({"title": "  ", "source_id": "arxiv", "landing_page_url": "https://example.com"}, spider)


def test_normalization_pipeline_cleans_fields():
    pipeline = NormalizationPipeline()
    spider = ArxivSpider(query="test")

    paper = create_sample_paper(title="  Noisy Title with Quotes\"'  ", doi="https://doi.org/10.1000/182")
    paper.abstract = "Abstract - Cleaned summary here"
    paper.published_date = "Published on 2022-04-15"
    paper.publication_year = None

    normalized = pipeline.process_item(paper, spider)
    assert normalized.title == "Noisy Title with Quotes"
    assert normalized.abstract == "Cleaned summary here"
    assert normalized.doi == "10.1000/182"
    assert normalized.publication_year == 2022


def test_deduplication_pipeline():
    pipeline = DeduplicationPipeline()
    events_received = []

    spider = ArxivSpider(query="test")
    spider.dispatch_event = lambda ev, pl: events_received.append((ev, pl))

    p1 = create_sample_paper(title="Attention Networks", doi="10.1000/1")
    p2_exact = create_sample_paper(title="Attention Networks", doi="10.1000/1")

    # First item passes
    out1 = pipeline.process_item(p1, spider)
    assert out1 == p1

    # Second item with exact DOI dropped as duplicate
    with pytest.raises(DropItem, match="Duplicate paper dropped"):
        pipeline.process_item(p2_exact, spider)

    assert len(events_received) == 1
    assert events_received[0][0] == "paper.duplicate_candidate"


def test_relevance_pipeline():
    pipeline = RelevancePipeline()
    spider = ArxivSpider(query="attention vision", limit=5)

    paper = create_sample_paper(title="Attention Mechanisms for Computer Vision")
    scored = pipeline.process_item(paper, spider)

    assert scored.relevance_score >= 0.60
    assert "title_coverage" in scored.relevance_explanation or "title_match_score" in scored.relevance_explanation
    assert scored.relevance_explanation["pdf_available"] is True or scored.relevance_explanation.get("has_direct_pdf") is True


def test_storage_pipeline():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        pipeline = StoragePipeline(db_path=temp_db)
        spider = ArxivSpider(query="test", job_id="test_job_123")

        paper = create_sample_paper()
        pipeline.process_item(paper, spider)

        # Verify paper is stored
        from paper_scraper.jobs.state import JobStorage
        storage = JobStorage(temp_db)
        stored_papers = storage.get_job_papers("test_job_123")
        assert len(stored_papers) == 1
        assert stored_papers[0]["title"] == paper.title
    finally:
        import gc
        gc.collect()
        try:
            if os.path.exists(temp_db):
                os.remove(temp_db)
        except OSError:
            pass
