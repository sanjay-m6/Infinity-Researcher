"""
Adapters package: base adapter, source adapters, and registry.
"""

from paper_scraper.adapters.arxiv import ArxivAdapter
from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.adapters.biorxiv import BiorxivAdapter
from paper_scraper.adapters.plos import PlosAdapter
from paper_scraper.adapters.pubmed import PubmedAdapter
from paper_scraper.adapters.registry import SourceRegistry

__all__ = [
    "BaseAdapter",
    "SourceRegistry",
    "ArxivAdapter",
    "BiorxivAdapter",
    "PubmedAdapter",
    "PlosAdapter",
]
