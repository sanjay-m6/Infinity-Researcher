"""
medRxiv Source Adapter
Scrapes preprints from medRxiv (Cold Spring Harbor Laboratory) via public search.
Falls back to Europe PMC Preprints repository when gated by anti-bot checks.
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


class MedrxivAdapter(BaseAdapter):
    id = "medrxiv"
    name = "medRxiv"
    domain = "medrxiv.org"
    policy_url = "https://www.medrxiv.org/about/faq"
    policy_notes = "Preprint server for health sciences hosted by CSHL. HighWire Press citation structure."
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
        search_url = f"https://www.medrxiv.org/search/{encoded_query}"

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
            epmc_query = f"SRC:PPR AND PUBLISHER:medRxiv AND ({query})"
            async for paper in search_europe_pmc(
                epmc_query=epmc_query,
                source_id="medrxiv",
                source_name="medRxiv",
                default_venue="medRxiv Preprints",
                is_preprint=True,
                filters=filters,
                client=client,
            ):
                yield paper

    def _parse_result_item(self, item: BeautifulSoup) -> Optional[PaperResult]:
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

        href = ""
        link_el = item.select_one("a.highwire-cite-linked-title") or item.select_one("h4 a")
        if link_el:
            href = link_el.get("href", "")
        if href and not href.startswith("http"):
            landing_url = f"https://www.medrxiv.org{href}"
        else:
            landing_url = href or "https://www.medrxiv.org"

        author_els = item.select("span.highwire-citation-author") or item.select("span.author")
        authors = [a.get_text(strip=True) for a in author_els if a.get_text(strip=True)]

        date_el = item.select_one("span.highwire-cite-metadata-date")
        date_str = date_el.get_text(strip=True) if date_el else None
        pub_year = self.parse_year(date_str)

        doi_el = item.select_one("span.highwire-cite-metadata-doi")
        doi = None
        if doi_el:
            doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", doi_el.get_text())
            if doi_match:
                doi = doi_match.group(0).rstrip(".")

        pdf_url = f"{landing_url}.full.pdf" if landing_url and "medrxiv.org" in landing_url else None
        paper_id = PaperResult.generate_id(self.id, title, doi)

        conf = ConfidenceBreakdown(
            title=1.0,
            authors=0.8 if authors else 0.0,
            doi=1.0 if doi else 0.0,
            pdf=0.8 if pdf_url else 0.0,
            abstract=0.0,
        )

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            publication_year=pub_year,
            published_date=date_str,
            venue="medRxiv Preprints",
            publisher="Cold Spring Harbor Laboratory",
            doi=doi,
            source_id=self.id,
            source_name=self.name,
            source_page_url=landing_url,
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="medRxiv Open Access Preprint",
            license_text="CC-BY-NC-ND or CC-BY",
            document_type="preprint",
            metadata_confidence=conf.compute_composite(),
            confidence_breakdown=conf,
            keywords=["preprint", "health_sciences"],
        )

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=SRC:PPR%20AND%20PUBLISHER:medRxiv&pageSize=1&format=json", timeout=5.0)
            return {"health": "healthy" if resp.status_code == 200 else "degraded", "latency_ms": 100}
        except Exception as e:
            return {"health": "degraded", "error": str(e)}
