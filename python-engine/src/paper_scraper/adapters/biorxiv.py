"""
bioRxiv / medRxiv Source Adapter
Scrapes preprints from bioRxiv (Cold Spring Harbor Laboratory) via public search.
"""

from __future__ import annotations

import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.adapters.epmc import search_europe_pmc
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.security import validate_url


class BiorxivAdapter(BaseAdapter):
    id = "biorxiv"
    name = "bioRxiv"
    domain = "biorxiv.org"
    policy_url = "https://www.biorxiv.org/about-biorxiv"
    policy_notes = "Preprint server for biology. HighWire Press citation structure."
    supports_native_years = False
    request_delay_ms = 500
    content_types = ["Preprint"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        encoded_query = quote_plus(query)
        search_url = f"https://www.biorxiv.org/search/{encoded_query}"

        use_fallback = False
        try:
            validate_url(search_url)

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }

            resp = await client.get(search_url, headers=headers)
            if resp.status_code in (403, 429) or "challenges.cloudflare.com" in resp.text:
                use_fallback = True
            elif resp.status_code != 200:
                use_fallback = True
            else:
                soup = BeautifulSoup(resp.text, "html.parser")
                results = (
                    soup.select("li.search-result")
                    or soup.select("div.search-result")
                    or soup.select("div.highwire-article-citation")
                )
                if not results:
                    use_fallback = True
                else:
                    limit = filters.limit_per_source or 50
                    yielded_count = 0
                    for item in results:
                        if yielded_count >= limit:
                            break
                        paper = self._parse_result_item(item)
                        if not paper:
                            continue
                        if filters.year_start and paper.publication_year and paper.publication_year < filters.year_start:
                            continue
                        if filters.year_end and paper.publication_year and paper.publication_year > filters.year_end:
                            continue
                        if filters.author:
                            auth_match = any(filters.author.lower() in a.lower() for a in paper.authors)
                            if not auth_match:
                                continue
                        yielded_count += 1
                        yield paper
        except Exception:
            use_fallback = True

        if use_fallback:
            epmc_query = f"SRC:PPR AND PUBLISHER:bioRxiv AND ({query})"
            async for paper in search_europe_pmc(
                epmc_query=epmc_query,
                source_id="biorxiv",
                source_name="bioRxiv",
                default_venue="bioRxiv Preprints",
                is_preprint=True,
                filters=filters,
                client=client,
            ):
                yield paper

    def _parse_result_item(self, item: BeautifulSoup) -> Optional[PaperResult]:
        # Title
        title_el = (
            item.select_one("span.highwire-cite-title")
            or item.select_one("a.highwire-cite-linked-title")
            or item.select_one("h4 a")
        )
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        if not title:
            return None

        # Landing URL
        link = item.select_one("a.highwire-cite-linked-title") or item.select_one("h4 a")
        landing_url = "https://www.biorxiv.org"
        if link and link.get("href"):
            href = link.get("href")
            landing_url = f"https://www.biorxiv.org{href}" if href.startswith("/") else href

        # Authors
        authors = []
        author_spans = item.select("span.highwire-citation-author")
        for a_span in author_spans:
            a_text = a_span.get_text(strip=True)
            if a_text:
                authors.append(a_text)

        # DOI
        doi = None
        doi_span = item.select_one("span.highwire-cite-metadata-doi")
        if doi_span:
            doi_text = doi_span.get_text(strip=True)
            match = re.search(r"10\.1101/[^\s]+", doi_text)
            if match:
                doi = match.group(0).rstrip(".")
        if not doi and "10.1101/" in landing_url:
            match = re.search(r"10\.1101/[0-9.]+", landing_url)
            if match:
                doi = match.group(0)

        # PDF Link
        pdf_url = None
        pdf_link = item.select_one("a[href*='.full.pdf']") or item.select_one("a[href*='/content/'][href$='.pdf']")
        if pdf_link:
            pdf_href = pdf_link.get("href", "")
            pdf_url = f"https://www.biorxiv.org{pdf_href}" if pdf_href.startswith("/") else pdf_href
        elif doi:
            # Standard bioRxiv direct PDF URL scheme
            pdf_url = f"https://www.biorxiv.org/content/{doi}v1.full.pdf"

        # Date & Year
        date_span = item.select_one("span.highwire-cite-metadata-date")
        date_text = date_span.get_text(strip=True) if date_span else None
        pub_year = self.parse_year(date_text)

        # Abstract snippet if visible
        abstract = None
        abs_snippet = item.select_one("p.highwire-cite-snippet") or item.select_one("div.abstract-text")
        if abs_snippet:
            abstract = abs_snippet.get_text(strip=True)

        breakdown = ConfidenceBreakdown(
            title=1.0,
            authors=1.0 if authors else 0.5,
            abstract=1.0 if abstract else 0.0,
            doi=1.0 if doi else 0.5,
            pdf=1.0 if pdf_url else 0.0,
        )

        paper_id = PaperResult.generate_id(self.id, title, doi)

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            abstract=abstract,
            publication_year=pub_year,
            published_date=date_text,
            venue="bioRxiv",
            publisher="Cold Spring Harbor Laboratory",
            doi=doi,
            source_id=self.id,
            source_name=self.name,
            source_page_url="https://www.biorxiv.org",
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="bioRxiv preprint server",
            license_text="bioRxiv preprint license",
            document_type="preprint",
            language="en",
            keywords=["preprint", "biology", "bioRxiv"],
            metadata_confidence=breakdown.compute_composite(),
            confidence_breakdown=breakdown,
        )

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get("https://www.biorxiv.org", timeout=10.0)
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
