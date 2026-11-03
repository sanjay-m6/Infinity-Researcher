"""
Adapters package: base adapter, source adapters, and registry.
"""

from paper_scraper.adapters.acm import AcmAdapter
from paper_scraper.adapters.arxiv import ArxivAdapter
from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.adapters.biorxiv import BiorxivAdapter
from paper_scraper.adapters.core_api import CoreApiAdapter
from paper_scraper.adapters.google_scholar import GoogleScholarAdapter
from paper_scraper.adapters.ieee import IeeeAdapter
from paper_scraper.adapters.medrxiv import MedrxivAdapter
from paper_scraper.adapters.nature import NatureAdapter
from paper_scraper.adapters.openalex import OpenAlexAdapter
from paper_scraper.adapters.plos import PlosAdapter
from paper_scraper.adapters.pubmed import PubmedAdapter
from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.adapters.semantic_scholar import SemanticScholarAdapter

__all__ = [
    "AcmAdapter",
    "BaseAdapter",
    "GoogleScholarAdapter",
    "SourceRegistry",
    "ArxivAdapter",
    "BiorxivAdapter",
    "CoreApiAdapter",
    "IeeeAdapter",
    "MedrxivAdapter",
    "NatureAdapter",
    "OpenAlexAdapter",
    "PlosAdapter",
    "PubmedAdapter",
    "SemanticScholarAdapter",
]
