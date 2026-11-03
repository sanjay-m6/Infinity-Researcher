"""
Source-specific Scrapy Spiders.
"""

from paper_scraper.spiders.base import BasePaperSpider
from paper_scraper.spiders.arxiv import ArxivSpider
from paper_scraper.spiders.biorxiv import BiorxivSpider
from paper_scraper.spiders.ieee import IeeeSpider
from paper_scraper.spiders.medrxiv import MedrxivSpider
from paper_scraper.spiders.nature import NatureSpider
from paper_scraper.spiders.plos import PlosSpider
from paper_scraper.spiders.pmc import PmcSpider
from paper_scraper.spiders.pubmed import PubmedSpider

SPIDER_REGISTRY = {
    "arxiv": ArxivSpider,
    "biorxiv": BiorxivSpider,
    "medrxiv": MedrxivSpider,
    "pubmed": PubmedSpider,
    "pmc": PmcSpider,
    "plos": PlosSpider,
    "nature": NatureSpider,
    "nature_srep": NatureSpider,
    "ieee": IeeeSpider,
    "ieee_xplore": IeeeSpider,
}

__all__ = [
    "BasePaperSpider",
    "ArxivSpider",
    "BiorxivSpider",
    "IeeeSpider",
    "MedrxivSpider",
    "PubmedSpider",
    "PlosSpider",
    "NatureSpider",
    "PmcSpider",
    "SPIDER_REGISTRY",
]
