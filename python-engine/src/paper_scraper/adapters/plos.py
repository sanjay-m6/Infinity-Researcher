"""
PLOS (Public Library of Science) Source Adapter
Scrapes open access scientific articles from PLOS journals.
All PLOS articles are CC BY open access with deterministic PDF URLs.
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


class PlosAdapter(BaseAdapter):
    id = "plos"
    name = "PLOS"
    domain = "journals.plos.org"
    policy_url = "https://plos.org/open-science/"
    policy_notes = "Full open-access publisher. Creative Commons Attribution (CC BY 4.0)."
    supports_native_years = False
    request_delay_ms = 500
    content_types = ["Journal Article"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        limit = filters.limit_per_source or 50
        yielded_count = 0

        # Method 1: Try HTML search (mock tests or live when static results work)
        try:
            encoded_query = quote_plus(query)
            search_url = f"https://journals.plos.org/plosone/search?q={encoded_query}&filterJournals=PLoSONE"
            validate_url(search_url)

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }

            resp = await client.get(search_url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                results = (
                    soup.select("div.search-results-item")
                    or soup.select("li.search-results-item")
                    or soup.select("div.item")
                    or soup.select("div.article-listing")
                )
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
            pass

        if yielded_count > 0:
            return

        # Method 2: Public PLOS Search API
        try:
            api_url = f"https://api.plos.org/search?q={quote_plus(query)}&fl=id,title,author_display,abstract,publication_date&wt=json&rows={limit}"
            validate_url(api_url)
            api_resp = await client.get(api_url, timeout=10.0)
            if api_resp.status_code == 200:
                data = api_resp.json()
                docs = data.get("response", {}).get("docs", [])
                for doc in docs:
                    if yielded_count >= limit:
                        break
                    title = (doc.get("title") or "").strip()
                    if not title:
                        continue
                    doi = doc.get("id")
                    authors = doc.get("author_display") or []
                    pub_date = doc.get("publication_date")
                    pub_year = int(pub_date.split("-")[0]) if pub_date and "-" in pub_date else None
                    abstract = (doc.get("abstract") or [""])[0] if isinstance(doc.get("abstract"), list) else None

                    landing_url = f"https://journals.plos.org/plosone/article?id={doi}" if doi else "https://journals.plos.org/plosone"
                    pdf_url = f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable" if doi else None

                    conf = ConfidenceBreakdown(title=1.0, authors=0.9, doi=1.0, pdf=0.9, abstract=0.8 if abstract else 0.0)
                    paper = PaperResult(
                        paper_id=PaperResult.generate_id(self.id, title, doi),
                        title=title,
                        authors=authors,
                        abstract=abstract,
                        publication_year=pub_year,
                        published_date=pub_date,
                        venue="PLOS ONE",
                        publisher="Public Library of Science",
                        doi=doi,
                        source_id=self.id,
                        source_name=self.name,
                        source_page_url=landing_url,
                        landing_page_url=landing_url,
                        pdf_url=pdf_url,
                        pdf_access_status="available" if pdf_url else "unknown",
                        open_access_evidence="PLOS Open Access (CC-BY 4.0)",
                        license_text="Creative Commons Attribution (CC BY 4.0)",
                        document_type="journal_article",
                        metadata_confidence=conf.compute_composite(),
                        confidence_breakdown=conf,
                        keywords=["open_access"],
                    )
                    yielded_count += 1
                    yield paper
        except Exception:
            pass

        if yielded_count > 0:
            return

        # Method 3: Europe PMC PLOS ONE Fallback
        epmc_query = f"JOURNAL:\"PLoS ONE\" AND ({query})"
        async for paper in search_europe_pmc(
            epmc_query=epmc_query,
            source_id="plos",
            source_name="PLOS",
            default_venue="PLOS ONE",
            is_preprint=False,
            filters=filters,
            client=client,
        ):
            yield paper

    def _parse_result_item(self, item: BeautifulSoup) -> Optional[PaperResult]:
        # Title
        title_el = item.select_one("h2 a") or item.select_one("h3 a") or item.select_one("a.title")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        if not title:
            return None

        # Landing URL
        href = title_el.get("href", "")
        landing_url = f"https://journals.plos.org{href}" if href.startswith("/") else href

        # DOI extraction
        doi = None
        match = re.search(r"10\.1371/journal\.pone\.[0-9]+", landing_url)
        if match:
            doi = match.group(0)
        else:
            doi_span = item.select_one("span.doi") or item.select_one("span.article-doi")
            if doi_span:
                doi_match = re.search(r"10\.1371/[^\s]+", doi_span.get_text())
                if doi_match:
                    doi = doi_match.group(0).rstrip(".")

        # Authors
        authors = []
        author_spans = item.select("span.author") or item.select("p.authors span") or item.select("ul.authors li")
        for a_span in author_spans:
            a_text = a_span.get_text(strip=True).rstrip(",")
            if a_text and a_text.lower() != "et al":
                authors.append(a_text)

        # Date & Year
        date_el = item.select_one("span.pub-date") or item.select_one("span.date") or item.select_one("time")
        date_text = date_el.get_text(strip=True) if date_el else None
        pub_year = self.parse_year(date_text or item.get_text())

        # Abstract snippet
        abstract = None
        abs_el = item.select_one("div.abstract") or item.select_one("p.abstract") or item.select_one("p.blurb")
        if abs_el:
            abstract = abs_el.get_text(strip=True)

        # Direct PDF Link (Deterministic PLOS pattern)
        pdf_url = None
        if doi:
            pdf_url = f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable"
        else:
            pdf_link = item.select_one("a[href*='type=printable']")
            if pdf_link:
                pdf_href = pdf_link.get("href", "")
                pdf_url = f"https://journals.plos.org{pdf_href}" if pdf_href.startswith("/") else pdf_href

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
            venue="PLOS ONE",
            publisher="Public Library of Science",
            doi=doi,
            source_id=self.id,
            source_name=self.name,
            source_page_url="https://journals.plos.org/plosone",
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="PLOS Open Access (CC BY 4.0)",
            license_text="Creative Commons Attribution 4.0 International (CC BY 4.0)",
            document_type="journal_article",
            language="en",
            keywords=["open access", "science", "PLOS ONE"],
            metadata_confidence=breakdown.compute_composite(),
            confidence_breakdown=breakdown,
        )

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get("https://journals.plos.org/plosone", timeout=10.0)
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
