"""
Scrapy Spider for medRxiv.org.
Crawls clinical and health sciences preprints, Highwire Press metadata, and direct PDF downloads.
"""

from __future__ import annotations

import logging
from paper_scraper.spiders.biorxiv import BiorxivSpider

logger = logging.getLogger(__name__)


class MedrxivSpider(BiorxivSpider):
    name = "medrxiv"
    source_id = "medrxiv"
    source_name = "medRxiv"
    base_host = "https://www.medrxiv.org"
    allowed_domains = ["www.medrxiv.org", "medrxiv.org"]
