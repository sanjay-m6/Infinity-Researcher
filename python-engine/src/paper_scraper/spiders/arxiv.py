"""
Scrapy Spider for arXiv.org.
Discovers preprints, authors, categories, and direct PDF downloads via arXiv API / search feeds.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Generator
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import Request, Response

from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


class ArxivSpider(BasePaperSpider):
    name = "arxiv"
    source_id = "arxiv"
    source_name = "arXiv"
    allowed_domains = ["export.arxiv.org", "arxiv.org"]

    def start_requests(self) -> Generator[Request, None, None]:
        q_filter = QueryFilter(
            query=self.query,
            year_start=self.year_start,
            year_end=self.year_end,
            author=self.author,
            limit_per_source=self.limit,
        )
        url = QueryBuilder.build_arxiv_url(q_filter, page_offset=0)
        yield Request(url, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        # Detect if response is XML Atom feed or HTML
        if "<feed" in response.text[:500] or "xmlns=" in response.text[:500]:
            soup = BeautifulSoup(response.text, "xml")
            entries = soup.find_all("entry")

            for entry in entries:
                if self.results_count >= self.limit:
                    break
                try:
                    title_elem = entry.find("title")
                    if not title_elem:
                        continue
                    raw_title = " ".join(title_elem.text.split())

                    summary_elem = entry.find("summary")
                    abstract = " ".join(summary_elem.text.split()) if summary_elem else None

                    authors = [a.find("name").text.strip() for a in entry.find_all("author") if a.find("name")]

                    published_elem = entry.find("published")
                    published_date = published_elem.text.strip() if published_elem else None
                    pub_year = None
                    if published_date:
                        m = re.match(r"^(\d{4})", published_date)
                        if m:
                            pub_year = int(m.group(1))

                    if self.year_start and pub_year and pub_year < self.year_start:
                        continue
                    if self.year_end and pub_year and pub_year > self.year_end:
                        continue

                    id_elem = entry.find("id")
                    entry_id_url = id_elem.text.strip() if id_elem else ""
                    arxiv_id_match = re.search(r"arxiv\.org/abs/([0-9]+\.[0-9]+(?:v[0-9]+)?)", entry_id_url)
                    arxiv_id = arxiv_id_match.group(1) if arxiv_id_match else None

                    landing_url = entry_id_url or f"https://arxiv.org/abs/{arxiv_id}"
                    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf" if arxiv_id else None

                    doi_elem = entry.find("arxiv:doi") or entry.find("doi")
                    doi = doi_elem.text.strip() if doi_elem else None

                    cat_elem = entry.find("arxiv:primary_category")
                    categories = [cat_elem.get("term")] if cat_elem and cat_elem.get("term") else []

                    paper_id = PaperResult.generate_id(self.source_id, raw_title, doi or arxiv_id)
                    conf_breakdown = ConfidenceBreakdown(
                        title=1.0,
                        authors=1.0 if authors else 0.5,
                        abstract=1.0 if abstract else 0.0,
                        doi=1.0 if doi else 0.5,
                        pdf=1.0 if pdf_url else 0.0,
                    )

                    self.results_count += 1
                    yield PaperResult(
                        paper_id=paper_id,
                        title=raw_title,
                        authors=authors,
                        abstract=abstract,
                        publication_year=pub_year,
                        published_date=published_date,
                        venue="arXiv",
                        publisher="arXiv",
                        doi=doi,
                        arxiv_id=arxiv_id,
                        source_id=self.source_id,
                        source_name=self.source_name,
                        source_page_url=landing_url,
                        landing_page_url=landing_url,
                        pdf_url=pdf_url,
                        pdf_access_status="available" if pdf_url else "unknown",
                        open_access_evidence="arXiv Open Access Preprint",
                        license_text="arXiv.org perpetual non-exclusive license",
                        document_type="preprint",
                        keywords=categories,
                        metadata_confidence=conf_breakdown.compute_composite(),
                        confidence_breakdown=conf_breakdown,
                        extraction_method="arxiv_api_xml",
                    )
                except Exception as e:
                    logger.warning("Error parsing arXiv XML entry: %s", e)
        else:
            # HTML Search results
            soup = BeautifulSoup(response.text, "html.parser")
            results = soup.select(".arxiv-result, li.arxiv-result")
            for item in results:
                if self.results_count >= self.limit:
                    break
                try:
                    title_elem = item.select_one(".title")
                    if not title_elem:
                        continue
                    raw_title = re.sub(r"^Title:\s*", "", " ".join(title_elem.text.split()), flags=re.I)

                    arxiv_id = None
                    id_elem = item.select_one(".is-size-7 span, a[href*='/abs/']")
                    if id_elem:
                        m = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", id_elem.text)
                        if m:
                            arxiv_id = m.group(1)

                    landing_url = f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else response.url
                    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf" if arxiv_id else None

                    authors = []
                    authors_elem = item.select_one(".authors")
                    if authors_elem:
                        for a in authors_elem.find_all("a"):
                            authors.append(a.text.strip())

                    abstract_elem = item.select_one(".abstract-full, .abstract-short, .abstract")
                    abstract = None
                    if abstract_elem:
                        cleaned_abs = re.sub(r"[△▽]\s*(Less|More)", "", abstract_elem.text)
                        abstract = " ".join(cleaned_abs.split())

                    pub_year = None
                    for p_elem in item.find_all(["p", "div"], class_="is-size-7"):
                        m = re.search(r"\b(19\d\d|20\d\d)\b", p_elem.text)
                        if m and "submitted" in p_elem.text.lower():
                            pub_year = int(m.group(1))
                            break
                    if not pub_year:
                        m = re.search(r"\b(19\d\d|20\d\d)\b", item.text)
                        if m:
                            pub_year = int(m.group(1))

                    doi = None
                    doi_elem = item.select_one("[data-doi], a[href*='doi.org']")
                    if doi_elem:
                        doi = doi_elem.get("data-doi")
                        if not doi and doi_elem.text:
                            m = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", doi_elem.text)
                            if m:
                                doi = m.group(0)

                    paper_id = PaperResult.generate_id(self.source_id, raw_title, doi or arxiv_id)
                    conf_breakdown = ConfidenceBreakdown(
                        title=1.0,
                        authors=0.9 if authors else 0.4,
                        abstract=0.9 if abstract else 0.0,
                        doi=1.0 if doi else 0.4,
                        pdf=1.0 if pdf_url else 0.0,
                    )

                    self.results_count += 1
                    yield PaperResult(
                        paper_id=paper_id,
                        title=raw_title,
                        authors=authors,
                        abstract=abstract,
                        publication_year=pub_year,
                        published_date=str(pub_year) if pub_year else None,
                        venue="arXiv",
                        publisher="arXiv",
                        doi=doi,
                        arxiv_id=arxiv_id,
                        source_id=self.source_id,
                        source_name=self.source_name,
                        source_page_url=landing_url,
                        landing_page_url=landing_url,
                        pdf_url=pdf_url,
                        pdf_access_status="available" if pdf_url else "unknown",
                        open_access_evidence="arXiv Open Access Preprint",
                        license_text="arXiv.org perpetual non-exclusive license",
                        document_type="preprint",
                        metadata_confidence=conf_breakdown.compute_composite(),
                        confidence_breakdown=conf_breakdown,
                        extraction_method="arxiv_search_html",
                    )
                except Exception as e:
                    logger.warning("Error parsing arXiv HTML item: %s", e)
