"""
Scrapy Item Pipelines for academic paper discovery.
"""

from paper_scraper.pipelines.validation import ValidationPipeline
from paper_scraper.pipelines.normalization import NormalizationPipeline
from paper_scraper.pipelines.dedup import DeduplicationPipeline
from paper_scraper.pipelines.relevance import RelevancePipeline
from paper_scraper.pipelines.storage import StoragePipeline
from paper_scraper.pipelines.event_dispatch import EventDispatchPipeline

__all__ = [
    "ValidationPipeline",
    "NormalizationPipeline",
    "DeduplicationPipeline",
    "RelevancePipeline",
    "StoragePipeline",
    "EventDispatchPipeline",
]
