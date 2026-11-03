"""
Scrapy Spider for bioRxiv.org.
Crawls biology and life sciences preprints, Highwire Press metadata, and direct PDF downloads.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Generator
import urllib.parse
import urllib.request
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import HtmlResponse, Request, Response

from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


class BiorxivSpider(BasePaperSpider):
    name = "biorxiv"
    source_id = "biorxiv"
    source_name = "bioRxiv"
    base_host = "https://www.biorxiv.org"
    allowed_domains = ["www.biorxiv.org", "biorxiv.org"]

    def start_requests(self) -> Generator[Request, None, None]:
        yield Request(f"{self.base_host}/", callback=self.initiate_search, dont_filter=True, errback=self.handle_error)

    def initiate_search(self, response: Response) -> Generator[Any, None, None]:
        # If response already contains search results (e.g., from unit test fixtures)
        if response.css(".highwire-article-citation, li.search-result, div.search-result"):
            yield from self.parse(response)
            return

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
        try:
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
            opener.addheaders = list(headers.items())
            home = opener.open(f"{self.base_host}/", timeout=15)
            soup = BeautifulSoup(home.read().decode("utf-8", errors="ignore"), "html.parser")
            form = soup.find("form", id="highwire-search-quicksearch-form-0") or soup.find("form")
            build_id_elem = form.find("input", {"name": "form_build_id"}) if form else None
            build_id = build_id_elem.get("value") if build_id_elem else None

            if not build_id:
                yield from self.parse(response)
                return

            data = urllib.parse.urlencode({
                "keywords": self.query,
                "op": "Search",
                "form_build_id": build_id,
                "form_id": "highwire_search_quicksearch_form_0",
            }).encode("utf-8")
            req = urllib.request.Request(f"{self.base_host}/", data=data, headers=headers)
            post_resp = opener.open(req, timeout=20)
            body = post_resp.read()
            search_response = HtmlResponse(url=post_resp.geturl(), body=body, encoding="utf-8")
            yield from self.parse(search_response)
        except Exception as e:
            logger.warning("Error initiating %s search: %s", self.name, e)
            self.handle_error(e)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        is_blocked, reason = self.is_challenge_or_blocked_response(response)
        if is_blocked:
            self.record_status("blocked", reason)
            return

        soup = BeautifulSoup(response.text, "html.parser")
        items = soup.select(".highwire-article-citation, li.search-result, div.search-result")

        for item in items:
            if self.results_count >= self.limit:
                break

            try:
                # Title & link
                title_elem = item.select_one(".highwire-cite-title, a.highwire-cite-linked-title, .search-result-title")
                if not title_elem:
                    continue
                raw_title = " ".join(title_elem.text.split())

                link_elem = title_elem.find("a") if title_elem.name != "a" else title_elem
                rel_url = link_elem["href"] if link_elem and link_elem.get("href") else None
                landing_url = urllib.parse.urljoin(response.url, rel_url) if rel_url else response.url

                # Authors
                author_elems = item.select(".highwire-citation-author, .highwire-citation-authors .nlm-given-names")
                authors = [" ".join(a.text.split()) for a in author_elems if a.text.strip()]
                if not authors:
                    auth_container = item.select_one(".highwire-cite-authors, .search-result-authors")
                    if auth_container:
                        authors = [a.strip() for a in auth_container.text.split(",") if a.strip()]

                # DOI
                doi_elem = item.select_one(".highwire-cite-metadata-doi, a[href*='doi.org']")
                doi = None
                if doi_elem:
                    m = re.search(r"10\.1101/[0-9.]+", doi_elem.text + " " + doi_elem.get("href", ""))
                    if m:
                        doi = m.group(0)

                # Abstract snippet
                snippet_elem = item.select_one(".highwire-cite-snippet, .search-result-snippet")
                abstract = " ".join(snippet_elem.text.split()) if snippet_elem else None

                # PDF URL
                pdf_url = None
                pdf_elem = item.select_one("a[href*='.full.pdf'], a.highwire-link-pdf")
                if pdf_elem and pdf_elem.get("href"):
                    pdf_url = urllib.parse.urljoin(response.url, pdf_elem["href"])
                elif landing_url:
                    clean_landing = re.sub(r"\.full$", "", landing_url.rstrip("/"))
                    pdf_url = f"{clean_landing}.full.pdf"

                # Year
                pub_year = None
                year_elem = item.select_one(".highwire-cite-metadata-date, .search-result-date")
                if year_elem:
                    m = re.search(r"\b(20\d\d|19\d\d)\b", year_elem.text)
                    if m:
                        pub_year = int(m.group(1))

                # Check year filter
                if self.year_start and pub_year and pub_year < self.year_start:
                    continue
                if self.year_end and pub_year and pub_year > self.year_end:
                    continue
                if self.author and authors:
                    if not any(self.author.lower() in a.lower() for a in authors):
                        continue

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
                    published_date=str(pub_year) if pub_year else None,
                    venue=self.source_name,
                    publisher="Cold Spring Harbor Laboratory",
                    doi=doi,
                    source_id=self.source_id,
                    source_name=self.source_name,
                    source_page_url=landing_url,
                    landing_page_url=landing_url,
                    pdf_url=pdf_url,
                    pdf_access_status="available" if pdf_url else "unknown",
                    open_access_evidence=f"{self.source_name} Open Access Preprint",
                    license_text="CC-BY or author-specified preprint license",
                    document_type="preprint",
                    metadata_confidence=conf_breakdown.compute_composite(),
                    confidence_breakdown=conf_breakdown,
                    extraction_method=f"{self.source_id}_search_html",
                )

                self.results_count += 1
                yield paper

            except Exception as e:
                logger.warning("Error parsing %s item: %s", self.name, e)
                continue
