"""
Scrapy Spider for PubMed Central (PMC).
Crawls free full-text biomedical literature, PMCIDs, DOIs, and direct PDF downloads.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Generator
from urllib.parse import quote_plus, urljoin
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import Request, Response

from paper_scraper.models import ConfidenceBreakdown, PaperResult
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


class PmcSpider(BasePaperSpider):
    name = "pmc"
    source_id = "pmc"
    source_name = "PubMed Central"
    allowed_domains = ["www.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov"]

    def start_requests(self) -> Generator[Request, None, None]:
        clean_q = quote_plus(self.query.strip())
        url = f"https://pmc.ncbi.nlm.nih.gov/search/?term={clean_q}"
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        yield Request(url, headers=headers, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        is_blocked, reason = self.is_challenge_or_blocked_response(response)
        if is_blocked:
            self.record_status("blocked", reason)
            return

        soup = BeautifulSoup(response.text, "html.parser")
        docsums = soup.select(".docsum-wrap, .rprt, article.full-docsum")

        for doc in docsums:
            if self.results_count >= self.limit:
                break

            try:
                # Title and landing link
                title_elem = doc.select_one("a.docsum-title, .rprt-title a, a.usa-link.docsum-title")
                if not title_elem:
                    continue
                raw_title = " ".join(title_elem.text.split())
                if not raw_title:
                    continue

                rel_url = title_elem.get("href", "")
                landing_url = urljoin(response.url, rel_url)

                # PMCID from URL or data attribute or text
                pmcid = None
                pmc_match = re.search(r"/(PMC\d+)/?", landing_url, re.I)
                if pmc_match:
                    pmcid = pmc_match.group(1).upper()
                if not pmcid and title_elem.get("data-ga-label"):
                    ga_val = title_elem.get("data-ga-label")
                    if "PMC" in ga_val:
                        pmcid = ga_val.strip().upper()
                if not pmcid:
                    pmcid_elem = doc.select_one(".pmcid, .pmc-id, span.citation-part")
                    if pmcid_elem:
                        m = re.search(r"PMC\d+", pmcid_elem.text, re.I)
                        if m:
                            pmcid = m.group(0).upper()

                # Authors
                authors = []
                authors_elem = doc.select_one(".docsum-authors, .full-authors, ul li:first-child span")
                if authors_elem:
                    raw_auth = authors_elem.text.strip()
                    # Filter out citation parts if accidentally matched
                    if not re.search(r"\b(19\d\d|20\d\d)\b", raw_auth) and "doi:" not in raw_auth.lower():
                        authors = [a.strip() for a in raw_auth.split(",") if a.strip()]

                # Journal citation line (venue, year, DOI)
                citation_elem = doc.select_one(".citation-part, .docsum-journal-citation, .full-journal-citation")
                venue = "PubMed Central"
                pub_year = None
                doi = None

                if citation_elem:
                    c_text = citation_elem.text.strip()
                    parts = [p.strip() for p in c_text.split(".") if p.strip()]
                    if parts and not parts[0].startswith("PMCID"):
                        venue = parts[0]

                    year_match = re.search(r"\b(19\d\d|20\d\d)\b", c_text)
                    if year_match:
                        pub_year = int(year_match.group(1))

                    doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", c_text, flags=re.I)
                    if doi_match:
                        doi = doi_match.group(0).rstrip(".")

                # Free full text PDF link
                pdf_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/" if pmcid else None

                # Filters
                if self.year_start and pub_year and pub_year < self.year_start:
                    continue
                if self.year_end and pub_year and pub_year > self.year_end:
                    continue
                if self.author and authors:
                    if not any(self.author.lower() in a.lower() for a in authors):
                        continue

                paper_id = PaperResult.generate_id(self.source_id, raw_title, doi or pmcid)
                conf_breakdown = ConfidenceBreakdown(
                    title=1.0,
                    authors=0.9 if authors else 0.4,
                    abstract=0.0,
                    doi=1.0 if doi else (0.9 if pmcid else 0.0),
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
                    publisher="National Center for Biotechnology Information (NCBI)",
                    doi=doi,
                    source_id=self.source_id,
                    source_name=self.source_name,
                    source_page_url=landing_url,
                    landing_page_url=landing_url,
                    pdf_url=pdf_url,
                    pdf_access_status="available" if pdf_url else "unknown",
                    open_access_evidence="PubMed Central Free Full Text Open Access",
                    document_type="journal_article",
                    metadata_confidence=conf_breakdown.compute_composite(),
                    confidence_breakdown=conf_breakdown,
                    extraction_method="pmc_search_html",
                )

                self.results_count += 1
                yield paper

            except Exception as e:
                logger.warning("Error parsing PMC search result: %s", e)
                continue
