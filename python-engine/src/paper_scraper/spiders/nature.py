"""
Scrapy Spider for Nature Scientific Reports.
Crawls open-access peer-reviewed articles from Nature Scientific Reports via PMC and Europe PMC.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Generator
from urllib.parse import quote_plus, urljoin
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import Request, Response

from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


def _strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", text)
    return (
        cleaned.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .strip()
    )


class NatureSpider(BasePaperSpider):
    name = "nature_srep"
    source_id = "nature_srep"
    source_name = "Nature Scientific Reports"
    allowed_domains = ["www.ebi.ac.uk", "ebi.ac.uk", "nature.com", "ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov"]

    def start_requests(self) -> Generator[Request, None, None]:
        clean_q = quote_plus(self.query.strip())
        url = f"https://pmc.ncbi.nlm.nih.gov/search/?term=%22Sci+Rep%22%5BJournal%5D+{clean_q}"
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

        raw_text = response.text if hasattr(response, "text") else response.body.decode("utf-8")
        stripped_text = raw_text.strip()

        # Check if response is JSON (e.g. Europe PMC API or test fixture)
        if stripped_text.startswith("{") or "application/json" in response.headers.get("Content-Type", b"").decode("utf-8", errors="ignore"):
            yield from self._parse_json(response, stripped_text)
        else:
            yield from self._parse_html(response)

    def _parse_json(self, response: Response, raw_text: str) -> Generator[Any, None, None]:
        try:
            data = json.loads(raw_text)
        except Exception as e:
            self.record_status("failed", f"Failed to parse Europe PMC response for Nature: {e}")
            logger.warning("Failed to parse Europe PMC JSON for Nature: %s", e)
            return

        items = data.get("resultList", {}).get("result", [])

        for item in items:
            if self.results_count >= self.limit:
                break

            raw_title = item.get("title", "")
            title = _strip_html(raw_title).rstrip(".").strip()
            if not title:
                continue

            authors = []
            author_list = item.get("authorList", {}).get("author", [])
            if isinstance(author_list, list) and author_list:
                for a in author_list:
                    name = a.get("fullName") or ""
                    if name.strip():
                        authors.append(name.strip())
            elif item.get("authorString"):
                for part in item["authorString"].split(","):
                    if part.strip():
                        authors.append(part.strip())

            pub_year = None
            if item.get("pubYear"):
                try:
                    pub_year = int(item["pubYear"])
                except ValueError:
                    pass

            if self.year_start and pub_year and pub_year < self.year_start:
                continue
            if self.year_end and pub_year and pub_year > self.year_end:
                continue
            if self.author and authors:
                if not any(self.author.lower() in a.lower() for a in authors):
                    continue

            doi = item.get("doi", "").strip() if item.get("doi") else None
            pmcid = item.get("pmcid", "").strip() if item.get("pmcid") else None

            abstract_raw = item.get("abstractText")
            abstract = _strip_html(abstract_raw) if abstract_raw else None

            if doi:
                landing_url = f"https://doi.org/{doi}"
            elif pmcid:
                landing_url = f"https://europepmc.org/article/PMC/{pmcid}"
            else:
                landing_url = f"https://europepmc.org/article/{item.get('source', 'MED')}/{item.get('id', '')}"

            pdf_url = None
            full_text_list = item.get("fullTextUrlList", {}).get("fullTextUrl", [])
            if isinstance(full_text_list, list):
                for ft in full_text_list:
                    doc_style = (ft.get("documentStyle") or "").lower()
                    u = ft.get("url") or ""
                    if doc_style == "pdf" or u.lower().endswith(".pdf") or "pdf=render" in u.lower():
                        pdf_url = u
                        break

            if not pdf_url and pmcid:
                pdf_url = f"https://europepmc.org/articles/{pmcid}?pdf=render"

            paper_id = PaperResult.generate_id(self.source_id, title, doi)
            conf = ConfidenceBreakdown(
                title=1.0,
                authors=0.9 if authors else 0.0,
                doi=1.0 if doi else 0.0,
                pdf=0.9 if pdf_url else 0.0,
                abstract=0.9 if abstract else 0.0,
            )

            paper = PaperResult(
                paper_id=paper_id,
                title=title,
                authors=authors,
                abstract=abstract,
                publication_year=pub_year,
                published_date=str(pub_year) if pub_year else None,
                venue="Scientific Reports",
                publisher="Nature Publishing Group",
                doi=doi,
                source_id=self.source_id,
                source_name=self.source_name,
                source_page_url=landing_url,
                landing_page_url=landing_url,
                pdf_url=pdf_url,
                pdf_access_status="available" if pdf_url else "unknown",
                open_access_evidence="Nature Scientific Reports Open Access (CC BY 4.0)",
                license_text="CC BY 4.0",
                document_type="journal_article",
                metadata_confidence=conf.compute_composite(),
                confidence_breakdown=conf,
                extraction_method="nature_epmc_json",
            )

            self.results_count += 1
            yield paper

    def _parse_html(self, response: Response) -> Generator[Any, None, None]:
        soup = BeautifulSoup(response.text, "html.parser")
        docsums = soup.select(".docsum-wrap, .rprt, article.full-docsum")

        for doc in docsums:
            if self.results_count >= self.limit:
                break

            try:
                title_elem = doc.select_one("a.docsum-title, .rprt-title a, a.usa-link.docsum-title")
                if not title_elem:
                    continue
                raw_title = " ".join(title_elem.text.split())
                if not raw_title:
                    continue

                rel_url = title_elem.get("href", "")
                landing_url = urljoin(response.url, rel_url)

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

                authors = []
                authors_elem = doc.select_one(".docsum-authors, .full-authors, ul li:first-child span")
                if authors_elem:
                    raw_auth = authors_elem.text.strip()
                    if not re.search(r"\b(19\d\d|20\d\d)\b", raw_auth) and "doi:" not in raw_auth.lower():
                        authors = [a.strip() for a in raw_auth.split(",") if a.strip()]

                citation_elem = doc.select_one(".citation-part, .docsum-journal-citation, .full-journal-citation")
                pub_year = None
                doi = None
                venue = "Scientific Reports"

                if citation_elem:
                    c_text = citation_elem.text.strip()
                    year_match = re.search(r"\b(19\d\d|20\d\d)\b", c_text)
                    if year_match:
                        pub_year = int(year_match.group(1))

                    doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", c_text, flags=re.I)
                    if doi_match:
                        doi = doi_match.group(0).rstrip(".")

                if not doi:
                    # Look for Nature DOI pattern in links
                    doi_link = doc.select_one("a[href*='10.1038']")
                    if doi_link and doi_link.get("href"):
                        m = re.search(r"10\.1038/[-._;()/:A-Za-z0-9]+", doi_link["href"])
                        if m:
                            doi = m.group(0)

                pdf_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/" if pmcid else None

                if self.year_start and pub_year and pub_year < self.year_start:
                    continue
                if self.year_end and pub_year and pub_year > self.year_end:
                    continue
                if self.author and authors:
                    if not any(self.author.lower() in a.lower() for a in authors):
                        continue

                paper_id = PaperResult.generate_id(self.source_id, raw_title, doi or pmcid)
                conf = ConfidenceBreakdown(
                    title=1.0,
                    authors=0.9 if authors else 0.4,
                    doi=1.0 if doi else (0.8 if pmcid else 0.0),
                    pdf=1.0 if pdf_url else 0.0,
                    abstract=0.0,
                )

                paper = PaperResult(
                    paper_id=paper_id,
                    title=raw_title,
                    authors=authors,
                    abstract=None,
                    publication_year=pub_year,
                    published_date=str(pub_year) if pub_year else None,
                    venue=venue,
                    publisher="Nature Publishing Group",
                    doi=doi,
                    source_id=self.source_id,
                    source_name=self.source_name,
                    source_page_url=landing_url,
                    landing_page_url=landing_url,
                    pdf_url=pdf_url,
                    pdf_access_status="available" if pdf_url else "unknown",
                    open_access_evidence="Nature Scientific Reports Open Access (CC BY 4.0)",
                    license_text="CC BY 4.0",
                    document_type="journal_article",
                    metadata_confidence=conf.compute_composite(),
                    confidence_breakdown=conf,
                    extraction_method="nature_srep_html",
                )

                self.results_count += 1
                yield paper

            except Exception as e:
                logger.warning("Error parsing Nature search result: %s", e)
                continue
