"""
Scrapy Spider for Nature Scientific Reports.
Crawls open-access peer-reviewed articles from Nature Scientific Reports via Europe PMC and Crossref.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Generator
from urllib.parse import quote_plus
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
    allowed_domains = ["www.ebi.ac.uk", "ebi.ac.uk", "nature.com"]

    def start_requests(self) -> Generator[Request, None, None]:
        clean_q = self.query.strip()
        epmc_query = f'JOURNAL:"Sci Rep" AND ({clean_q})'
        limit = self.limit or 10
        url = (
            f"https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            f"?query={quote_plus(epmc_query)}&resultType=core&format=json&pageSize={limit}"
        )
        headers = {
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        }
        yield Request(url, headers=headers, callback=self.parse, errback=self.handle_error)

    def parse(self, response: Response) -> Generator[Any, None, None]:
        try:
            data = json.loads(response.text)
        except Exception as e:
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
