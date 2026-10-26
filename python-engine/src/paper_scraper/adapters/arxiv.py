"""
arXiv Source Adapter
Scrapes search results directly from arXiv.org public search interface.
Preprints are open access and provide direct PDF links.
"""

from __future__ import annotations

import datetime
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.security import SecurityException, validate_url


class ArxivAdapter(BaseAdapter):
    id = "arxiv"
    name = "arXiv"
    domain = "arxiv.org"
    policy_url = "https://arxiv.org/help/robots"
    policy_notes = "Open access preprint repository. Respect 3-second delay on bulk retrieval."
    supports_native_years = False
    request_delay_ms = 400
    content_types = ["Preprint"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        encoded_query = quote_plus(query)
        search_url = f"https://arxiv.org/search/?query={encoded_query}&searchtype=all&source=header"

        validate_url(search_url)

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        resp = await client.get(search_url, headers=headers)
        if resp.status_code == 429:
            raise RuntimeError("arXiv rate limit reached (HTTP 429). Please wait before retrying.")
        if resp.status_code != 200:
            raise RuntimeError(f"arXiv returned unexpected status {resp.status_code}")

        soup = BeautifulSoup(resp.text, "html.parser")
        results = soup.select("li.arxiv-result")

        limit = filters.limit_per_source or 50
        yielded_count = 0

        for item in results:
            if yielded_count >= limit:
                break

            paper = self._parse_result_item(item)
            if not paper:
                continue

            # Year filter check
            if filters.year_start and paper.publication_year and paper.publication_year < filters.year_start:
                continue
            if filters.year_end and paper.publication_year and paper.publication_year > filters.year_end:
                continue

            # Author filter check
            if filters.author:
                auth_match = any(
                    filters.author.lower() in a.lower() for a in paper.authors
                )
                if not auth_match:
                    continue

            yielded_count += 1
            yield paper

    def _parse_result_item(self, item: BeautifulSoup) -> Optional[PaperResult]:
        # Title
        title_el = item.select_one("p.title")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        # Remove leading "Title:" if present
        title = re.sub(r"^Title:\s*", "", title, flags=re.IGNORECASE).strip()
        if not title:
            return None

        # Authors
        authors = []
        authors_p = item.select_one("p.authors")
        if authors_p:
            for a_tag in authors_p.find_all("a"):
                auth_name = a_tag.get_text(strip=True)
                if auth_name:
                    authors.append(auth_name)

        # Abstract
        abstract = None
        abstract_full = item.select_one("span.abstract-full")
        if abstract_full:
            abstract = abstract_full.get_text(strip=True)
            # Remove trailing 'Less' or 'More'
            abstract = re.sub(r"\s*△\s*Less$", "", abstract)
            abstract = re.sub(r"^Abstract:\s*", "", abstract, flags=re.IGNORECASE).strip()
        else:
            abstract_short = item.select_one("span.abstract-short")
            if abstract_short:
                abstract = abstract_short.get_text(strip=True)
                abstract = re.sub(r"\s*▽\s*More$", "", abstract)
                abstract = re.sub(r"^Abstract:\s*", "", abstract, flags=re.IGNORECASE).strip()

        # Identifier, Landing page, and PDF
        arxiv_id = None
        landing_url = "https://arxiv.org"
        pdf_url = None

        abs_link = item.select_one("a[href*='/abs/']")
        if abs_link:
            href = abs_link.get("href", "")
            if href.startswith("/"):
                landing_url = f"https://arxiv.org{href}"
            else:
                landing_url = href
            match = re.search(r"/abs/([0-9]+\.[0-9]+(?:v[0-9]+)?)", landing_url)
            if match:
                arxiv_id = match.group(1)

        pdf_link = item.select_one("a[href*='/pdf/']")
        if pdf_link:
            pdf_href = pdf_link.get("href", "")
            if pdf_href.startswith("/"):
                pdf_url = f"https://arxiv.org{pdf_href}"
            else:
                pdf_url = pdf_href
            # Ensure .pdf suffix for compatibility
            if not pdf_url.endswith(".pdf"):
                pdf_url = f"{pdf_url}.pdf"
        elif arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

        # Date & Year
        pub_year = None
        pub_date = None
        date_p = item.select_one("p.is-size-7")
        if date_p:
            date_text = date_p.get_text(strip=True)
            # e.g. "Submitted 12 January, 2024; originally announced January 2024."
            pub_year = self.parse_year(date_text)
            match_date = re.search(r"Submitted\s+([0-9]{1,2}\s+[A-Za-z]+,\s+[0-9]{4})", date_text)
            if match_date:
                pub_date = match_date.group(1)

        # DOI
        doi = None
        doi_link = item.select_one("a[data-doi]")
        if doi_link:
            doi = doi_link.get("data-doi")

        # Confidence calculation
        breakdown = ConfidenceBreakdown(
            title=1.0,
            authors=1.0 if authors else 0.5,
            abstract=1.0 if abstract else 0.0,
            doi=1.0 if doi else 0.0,
            pdf=1.0 if pdf_url else 0.0,
        )

        paper_id = PaperResult.generate_id(self.id, title, doi)

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            abstract=abstract,
            publication_year=pub_year,
            published_date=pub_date,
            venue="arXiv",
            publisher="Cornell University",
            doi=doi,
            arxiv_id=arxiv_id,
            source_id=self.id,
            source_name=self.name,
            source_page_url="https://arxiv.org",
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="arXiv open-access distribution license",
            license_text="arXiv.org perpetual non-exclusive license",
            document_type="preprint",
            language="en",
            keywords=["preprint", "arXiv"],
            metadata_confidence=breakdown.compute_composite(),
            confidence_breakdown=breakdown,
        )

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get("https://arxiv.org", timeout=10.0)
            return {
                "source_id": self.id,
                "reachable": resp.status_code == 200,
                "status_code": resp.status_code,
                "health": "healthy" if resp.status_code == 200 else "degraded",
            }
        except Exception as e:
            return {
                "source_id": self.id,
                "reachable": False,
                "health": "offline",
                "error": str(e),
            }
