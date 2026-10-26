"""
Scrapy Spider for PubMed (NLM / NCBI).
Extracts biomedical literature citations, PMIDs, PMCIDs, DOIs, and free PMC PDF links.
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


class PubmedSpider(BasePaperSpider):
    name = "pubmed"
    source_id = "pubmed"
    source_name = "PubMed"
    allowed_domains = ["pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov"]

    def start_requests(self) -> Generator[Request, None, None]:
        q_filter = QueryFilter(
            query=self.query,
            year_start=self.year_start,
            year_end=self.year_end,
            author=self.author,
            limit_per_source=self.limit,
        )
        url = QueryBuilder.build_pubmed_url(q_filter, page=1)
        yield Request(url, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        soup = BeautifulSoup(response.text, "html.parser")
        docsums = soup.select(".docsum-wrap, article.full-docsum")

        for doc in docsums:
            if self.results_count >= self.limit:
                break

            try:
                # Title
                title_elem = doc.select_one("a.docsum-title")
                if not title_elem:
                    continue
                raw_title = " ".join(title_elem.text.split())

                rel_url = title_elem.get("href", "")
                landing_url = urljoin(response.url, rel_url)

                # PMID from url or data attribute
                pmid_match = re.search(r"/(\d+)/?$", landing_url)
                pmid = pmid_match.group(1) if pmid_match else None

                # Authors
                authors_elem = doc.select_one(".docsum-authors, .full-authors")
                authors = []
                if authors_elem:
                    authors = [a.strip() for a in authors_elem.text.split(",") if a.strip()]

                # Journal & date citation line
                journal_elem = doc.select_one(".docsum-journal-citation, .full-journal-citation")
                venue = None
                pub_year = None
                doi = None
                pmcid = None

                if journal_elem:
                    j_text = journal_elem.text
                    venue = j_text.split(".")[0].strip() if "." in j_text else j_text.strip()
                    year_match = re.search(r"\b(19\d\d|20\d\d)\b", j_text)
                    if year_match:
                        pub_year = int(year_match.group(1))

                    doi_match = re.search(r"doi:\s*(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)", j_text, flags=re.I)
                    if doi_match:
                        doi = doi_match.group(1)

                # PMCID badge check
                pmcid_elem = doc.select_one(".pmc-id, .pmcid, span.citation-part")
                if pmcid_elem:
                    m = re.search(r"PMC\d+", pmcid_elem.text)
                    if m:
                        pmcid = m.group(0)

                # Free full text / PDF link
                pdf_url = None
                pdf_status = "unknown"
                if pmcid:
                    pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"
                    pdf_status = "available"

                # Check year bounds
                if self.year_start and pub_year and pub_year < self.year_start:
                    continue
                if self.year_end and pub_year and pub_year > self.year_end:
                    continue

                paper_id = PaperResult.generate_id(self.source_id, raw_title, doi or pmid)
                conf_breakdown = ConfidenceBreakdown(
                    title=1.0,
                    authors=0.9 if authors else 0.4,
                    abstract=0.0,
                    doi=1.0 if doi else (0.8 if pmid else 0.0),
                    pdf=1.0 if pdf_url else 0.0,
                )

                paper = PaperResult(
                    paper_id=paper_id,
                    title=raw_title,
                    authors=authors,
                    abstract=None,
                    publication_year=pub_year,
                    published_date=str(pub_year) if pub_year else None,
                    venue=venue,
                    publisher="National Library of Medicine",
                    doi=doi,
                    source_id=self.source_id,
                    source_name=self.source_name,
                    source_page_url=landing_url,
                    landing_page_url=landing_url,
                    pdf_url=pdf_url,
                    pdf_access_status=pdf_status,
                    open_access_evidence="PubMed Central Free Full Text" if pmcid else None,
                    document_type="journal_article",
                    metadata_confidence=conf_breakdown.compute_composite(),
                    confidence_breakdown=conf_breakdown,
                    extraction_method="pubmed_search_html",
                )

                self.results_count += 1
                yield paper

            except Exception as e:
                logger.warning("Error parsing PubMed docsum: %s", e)
                continue
