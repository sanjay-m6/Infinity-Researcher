"""
Source-specific Scrapy Spiders.
"""

from paper_scraper.spiders.base import BasePaperSpider
from paper_scraper.spiders.arxiv import ArxivSpider
from paper_scraper.spiders.biorxiv import BiorxivSpider
from paper_scraper.spiders.medrxiv import MedrxivSpider
from paper_scraper.spiders.pubmed import PubmedSpider
from paper_scraper.spiders.plos import PlosSpider
from paper_scraper.spiders.nature import NatureSpider

SPIDER_REGISTRY = {
    "arxiv": ArxivSpider,
    "biorxiv": BiorxivSpider,
    "medrxiv": MedrxivSpider,
    "pubmed": PubmedSpider,
    "pmc": PubmedSpider,
    "plos": PlosSpider,
    "nature": NatureSpider,
    "nature_srep": NatureSpider,
}

__all__ = [
    "BasePaperSpider",
    "ArxivSpider",
    "BiorxivSpider",
    "MedrxivSpider",
    "PubmedSpider",
    "PlosSpider",
    "NatureSpider",
    "SPIDER_REGISTRY",
]
