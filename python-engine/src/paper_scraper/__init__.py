"""
Research Paper Scraping Engine.
High-coverage academic research paper discovery and extraction powered by Scrapy.
"""

from paper_scraper.engine import ScrapySearchEngine, SearchEngine
from paper_scraper.jobs.state import JobStorage
from paper_scraper.models import PaperResult, QueryFilter, SourceDescriptor
from paper_scraper.ranking.relevance import RelevanceScorer
from paper_scraper.deduplication.dedup import Deduplicator
from paper_scraper.security import validate_url, is_safe_redirect

__version__ = "0.2.0"

__all__ = [
    "ScrapySearchEngine",
    "SearchEngine",
    "JobStorage",
    "PaperResult",
    "QueryFilter",
    "SourceDescriptor",
    "RelevanceScorer",
    "Deduplicator",
    "validate_url",
    "is_safe_redirect",
]
