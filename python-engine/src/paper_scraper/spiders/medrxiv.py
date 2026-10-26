"""
Scrapy Spider for medRxiv.org.
Crawls clinical and health sciences preprints, Highwire Press metadata, and direct PDF downloads.
"""

from __future__ import annotations

import logging
from typing import Any, Generator
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import Request, Response

from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.spiders.biorxiv import BiorxivSpider

logger = logging.getLogger(__name__)


class MedrxivSpider(BiorxivSpider):
    name = "medrxiv"
    source_id = "medrxiv"
    source_name = "medRxiv"
    allowed_domains = ["www.medrxiv.org", "medrxiv.org"]

    def start_requests(self) -> Generator[Request, None, None]:
        q_filter = QueryFilter(
            query=self.query,
            year_start=self.year_start,
            year_end=self.year_end,
            author=self.author,
            limit_per_source=self.limit,
        )
        url = QueryBuilder.build_medrxiv_url(q_filter, page=0)
        yield Request(url, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        for item in super().parse(response):
            if isinstance(item, PaperResult):
                item.source_id = "medrxiv"
                item.source_name = "medRxiv"
                item.venue = "medRxiv"
                item.open_access_evidence = "medRxiv Open Access Preprint"
                item.extraction_method = "medrxiv_search_html"
            yield item
