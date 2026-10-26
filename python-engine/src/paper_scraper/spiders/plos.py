"""
Scrapy Spider for PLOS (Public Library of Science).
Extracts peer-reviewed open access articles, CC-BY licensing, and direct printable PDF links.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Generator
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import Request, Response

from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


class PlosSpider(BasePaperSpider):
    name = "plos"
    source_id = "plos"
    source_name = "PLOS ONE"
    allowed_domains = ["journals.plos.org"]

    def start_requests(self) -> Generator[Request, None, None]:
        q_filter = QueryFilter(
            query=self.query,
            year_start=self.year_start,
            year_end=self.year_end,
            author=self.author,
            limit_per_source=self.limit,
        )
        url = QueryBuilder.build_plos_url(q_filter, page=1)
        yield Request(url, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        soup = BeautifulSoup(response.text, "html.parser")
        items = soup.select(".search-results-item, .search-result, dl")

        for item in items:
            if self.results_count >= self.limit:
                break

            try:
                # Title
                title_elem = item.select_one("dt.search-results-title a, h2 a, a[href*='/article?id=']")
                if not title_elem:
                    continue
                raw_title = " ".join(title_elem.text.split())

                rel_url = title_elem.get("href", "")
                landing_url = urljoin(response.url, rel_url)

                # DOI
                doi_match = re.search(r"id=(10\.1371/[^&]+)", rel_url)
                doi = doi_match.group(1) if doi_match else None

                # Authors
                authors_elem = item.select_one("dd.search-results-authors, p.authors, .authors")
                authors = []
                if authors_elem:
                    authors = [a.strip() for a in authors_elem.text.split(",") if a.strip()]

                # Abstract snippet
                abs_elem = item.select_one("dd.search-results-abstract, p.blurb, .blurb, .search-results-blurb")
                abstract = " ".join(abs_elem.text.split()) if abs_elem else None

                # Publication Date
                date_elem = item.select_one("dd.search-results-date, span.pub-date, .pub-date, .date")
                pub_year = None
                pub_date = None
                if date_elem:
                    pub_date = date_elem.text.strip()
                    m = re.search(r"\b(20\d\d|19\d\d)\b", pub_date)
                    if m:
                        pub_year = int(m.group(1))

                # Check year bounds
                if self.year_start and pub_year and pub_year < self.year_start:
                    continue
                if self.year_end and pub_year and pub_year > self.year_end:
                    continue

                # Printable PDF URL
                pdf_url = (
                    f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable"
                    if doi
                    else None
                )

                paper_id = PaperResult.generate_id(self.source_id, raw_title, doi)
                conf_breakdown = ConfidenceBreakdown(
                    title=1.0,
                    authors=0.9 if authors else 0.4,
                    abstract=0.8 if abstract else 0.0,
                    doi=1.0 if doi else 0.0,
                    pdf=1.0 if pdf_url else 0.0,
                )

                paper = PaperResult(
                    paper_id=paper_id,
                    title=raw_title,
                    authors=authors,
                    abstract=abstract,
                    publication_year=pub_year,
                    published_date=pub_date,
                    venue="PLOS ONE",
                    publisher="Public Library of Science",
                    doi=doi,
                    source_id=self.source_id,
                    source_name=self.source_name,
                    source_page_url=landing_url,
                    landing_page_url=landing_url,
                    pdf_url=pdf_url,
                    pdf_access_status="available" if pdf_url else "unknown",
                    open_access_evidence="PLOS Open Access (CC-BY 4.0)",
                    license_text="Creative Commons Attribution 4.0 International (CC-BY)",
                    document_type="journal_article",
                    metadata_confidence=conf_breakdown.compute_composite(),
                    confidence_breakdown=conf_breakdown,
                    extraction_method="plos_search_html",
                )

                self.results_count += 1
                yield paper

            except Exception as e:
                logger.warning("Error parsing PLOS item: %s", e)
                continue
