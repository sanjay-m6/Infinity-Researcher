"""
PubMed / PMC Source Adapter
Scrapes biomedical literature from NCBI PubMed public search.
Identifies Open Access / Free PMC full-text articles and DOIs.
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


class PubmedAdapter(BaseAdapter):
    id = "pubmed"
    name = "PubMed"
    domain = "pubmed.ncbi.nlm.nih.gov"
    policy_url = "https://www.ncbi.nlm.nih.gov/home/about/policies/"
    policy_notes = "NLM PubMed service. Identifies free PMC full text articles."
    supports_native_years = False
    request_delay_ms = 400
    content_types = ["Journal Article", "Review"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        limit = filters.limit_per_source or 50
        yielded_count = 0

        # Method 1: HTML search (used by unit tests with respx fixtures)
        try:
            encoded_query = quote_plus(query)
            search_url = f"https://pubmed.ncbi.nlm.nih.gov/?term={encoded_query}"
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
                results = soup.select("article.full-docsum")
                for item in results:
                    if yielded_count >= limit:
                        break
                    paper = self._parse_result_item(item)
                    if not paper:
                        continue
                    if filters.open_access_only and not (
                        paper.open_access_evidence or paper.pdf_access_status == "available"
                    ):
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

        # Method 2: Europe PMC PubMed search
        epmc_query = f"SRC:MED AND ({query})"
        async for paper in search_europe_pmc(
            epmc_query=epmc_query,
            source_id="pmc",
            source_name="PubMed Central",
            default_venue="PubMed Central",
            is_preprint=False,
            filters=filters,
            client=client,
        ):
            yield paper

    def _parse_result_item(self, item: BeautifulSoup) -> Optional[PaperResult]:
        # Title
        title_link = item.select_one("a.docsum-title")
        if not title_link:
            return None
        title = title_link.get_text(strip=True)
        if not title:
            return None

        # Landing URL
        href = title_link.get("href", "")
        landing_url = (
            f"https://pubmed.ncbi.nlm.nih.gov{href}"
            if href.startswith("/")
            else href
        )

        pmid = None
        match_pmid = re.search(r"/([0-9]+)/?$", landing_url)
        if match_pmid:
            pmid = match_pmid.group(1)

        # Authors
        authors = []
        auth_span = item.select_one("span.docsum-authors")
        if auth_span:
            raw_authors = auth_span.get_text(strip=True)
            for part in raw_authors.split(","):
                clean = part.strip()
                if clean and clean != "...":
                    authors.append(clean)

        # Journal / Year / Date citation
        citation_span = item.select_one("span.docsum-journal-citation")
        citation_text = citation_span.get_text(strip=True) if citation_span else ""
        
        venue = None
        if citation_text:
            venue = citation_text.split(".")[0].strip()

        pub_year = self.parse_year(citation_text)

        # DOI extraction from citation or data
        doi = None
        match_doi = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", citation_text)
        if match_doi:
            doi = match_doi.group(0).rstrip(".")

        # Free PMC / Open Access check
        free_pmc_span = item.select_one("span.free-resources") or item.select_one("span.pmc-id")
        is_free_pmc = False
        pmc_id = None
        if free_pmc_span:
            is_free_pmc = True
            pmc_text = free_pmc_span.get_text(strip=True)
            match_pmc = re.search(r"PMC\d+", pmc_text)
            if match_pmc:
                pmc_id = match_pmc.group(0)

        # Also search in full item text for PMC ID
        if not pmc_id:
            match_pmc = re.search(r"\bPMC\d+\b", item.get_text())
            if match_pmc:
                pmc_id = match_pmc.group(0)
                is_free_pmc = True

        pdf_url = None
        if pmc_id:
            pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/"

        breakdown = ConfidenceBreakdown(
            title=1.0,
            authors=1.0 if authors else 0.5,
            abstract=0.0,
            doi=1.0 if doi else 0.5,
            pdf=1.0 if pdf_url else 0.0,
        )

        paper_id = PaperResult.generate_id(self.id, title, doi)

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            publication_year=pub_year,
            published_date=str(pub_year) if pub_year else None,
            venue=venue or "PubMed",
            publisher="National Library of Medicine",
            doi=doi,
            source_id=self.id,
            source_name=self.name,
            source_page_url="https://pubmed.ncbi.nlm.nih.gov",
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="Free PMC Article" if is_free_pmc else None,
            license_text="Public / Open Access" if is_free_pmc else None,
            document_type="journal_article",
            language="en",
            keywords=["biomedicine", "PubMed"] + ([pmc_id] if pmc_id else []),
            metadata_confidence=breakdown.compute_composite(),
            confidence_breakdown=breakdown,
        )

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get("https://pubmed.ncbi.nlm.nih.gov", timeout=10.0)
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
