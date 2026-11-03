"""
Semantic Scholar Academic Graph API Adapter (IMARE Stage C).
Discovers papers and open-access PDF candidates using the Semantic Scholar API.
"""

from __future__ import annotations

import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.discovery.identity import QueryIntelligence, clean_doi
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.ranking.source_ranker import SourceCandidate
from paper_scraper.security import validate_url


class SemanticScholarAdapter(BaseAdapter):
    """Adapter querying Semantic Scholar Academic Graph API for metadata and OA PDFs."""

    id = "semantic_scholar"
    name = "Semantic Scholar"
    domain = "api.semanticscholar.org"
    policy_url = "https://www.semanticscholar.org/product/api"
    policy_notes = "Official Semantic Scholar Graph API (100 req/5min without key)"
    supports_native_years = True
    request_delay_ms = 400
    content_types = ["Article", "Preprint", "Conference"]

    BASE_URL = "https://api.semanticscholar.org/graph/v1"
    FIELDS = "paperId,title,authors,year,abstract,venue,publicationTypes,openAccessPdf,externalIds,url"

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Verify Semantic Scholar API status."""
        test_url = f"{self.BASE_URL}/paper/DOI:10.1109/ACCESS.2020.1?fields=paperId,title"
        try:
            resp = await client.get(test_url, timeout=6.0)
            if resp.status_code in (200, 404):
                return {"status": "healthy", "latency_ms": int(resp.elapsed.total_seconds() * 1000)}
            return {"status": "degraded", "code": resp.status_code}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}

    async def resolve_candidate(
        self,
        doi: Optional[str] = None,
        title: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Optional[SourceCandidate]:
        """
        Directly resolve a PDF candidate for a known paper via DOI or exact title.
        Used by Stage C Candidate Generation.
        """
        if not doi and not title:
            return None

        own_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=10.0)
            own_client = True

        try:
            headers = {"User-Agent": "InfinityResearcher/1.0", "Accept": "application/json"}
            if doi:
                c_doi = clean_doi(doi)
                url = f"{self.BASE_URL}/paper/DOI:{quote_plus(c_doi)}?fields={self.FIELDS}"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return self._build_candidate(data)

            if title:
                url = f"{self.BASE_URL}/paper/search?query={quote_plus(title)}&limit=1&fields={self.FIELDS}"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("data", [])
                    if items:
                        return self._build_candidate(items[0])

            return None
        except Exception:
            return None
        finally:
            if own_client:
                await client.aclose()

    def _build_candidate(self, item: Dict[str, Any]) -> Optional[SourceCandidate]:
        """Convert a Semantic Scholar payload into a SourceCandidate."""
        oa_pdf = item.get("openAccessPdf")
        pdf_url = oa_pdf.get("url") if isinstance(oa_pdf, dict) else None
        if not pdf_url:
            return None

        ext_ids = item.get("externalIds") or {}
        raw_doi = ext_ids.get("DOI") or ext_ids.get("doi")
        doi = clean_doi(raw_doi) if raw_doi else None
        authors = [a.get("name", "") for a in (item.get("authors") or []) if a.get("name")]

        status = "verified_oa" if oa_pdf.get("status") == "GOLD" else "green_oa"

        return SourceCandidate(
            candidate_id=f"s2_{item.get('paperId', '')[:12]}",
            source_name="Semantic Scholar",
            url=pdf_url,
            doi=doi,
            title=item.get("title"),
            authors=authors,
            publication_year=item.get("year"),
            venue=item.get("venue"),
            access_status=status,
            version_type="published" if item.get("venue") else "preprint",
            provenance={"s2_paper_id": item.get("paperId", ""), "provider": "Semantic Scholar Graph API"},
        )

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        """Execute search against Semantic Scholar Graph API."""
        identity = QueryIntelligence.parse(query, hint_author=filters.author)
        headers = {"User-Agent": "InfinityResearcher/1.0", "Accept": "application/json"}
        limit = min(filters.limit_per_source or 20, 50)

        # DOI direct lookup path
        if identity.doi:
            url = f"{self.BASE_URL}/paper/DOI:{quote_plus(identity.doi)}?fields={self.FIELDS}"
            validate_url(url)
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                item = resp.json()
                paper = self._to_paper_result(item)
                if paper:
                    yield paper
            return

        # General search path
        search_term = identity.cleaned_title if identity.cleaned_title else query
        url = f"{self.BASE_URL}/paper/search?query={quote_plus(search_term)}&limit={limit}&fields={self.FIELDS}"
        validate_url(url)

        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return

        data = resp.json()
        items = data.get("data", [])
        for item in items:
            paper = self._to_paper_result(item)
            if paper:
                yield paper

    def _to_paper_result(self, item: Dict[str, Any]) -> Optional[PaperResult]:
        title = item.get("title")
        if not title:
            return None

        ext_ids = item.get("externalIds") or {}
        doi = ext_ids.get("DOI") or ext_ids.get("doi")
        arxiv_id = ext_ids.get("ArXiv") or ext_ids.get("arxiv")
        authors = [a.get("name", "") for a in (item.get("authors") or []) if a.get("name")]

        oa_info = item.get("openAccessPdf") or {}
        pdf_url = oa_info.get("url") if isinstance(oa_info, dict) else None
        access_status = "available" if pdf_url else "restricted"

        year = item.get("year")
        venue = item.get("venue")
        abstract = item.get("abstract")

        paper_id = PaperResult.generate_id("semantic_scholar", title, doi)

        conf = ConfidenceBreakdown(
            title=1.0,
            authors=0.9 if authors else 0.4,
            abstract=0.9 if abstract else 0.0,
            doi=1.0 if doi else 0.0,
            pdf=1.0 if pdf_url else 0.0,
        )

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            abstract=abstract,
            publication_year=year,
            venue=venue,
            publisher=None,
            doi=doi,
            arxiv_id=arxiv_id,
            source_id="semantic_scholar",
            source_name="Semantic Scholar",
            source_page_url=item.get("url") or f"https://www.semanticscholar.org/paper/{item.get('paperId', '')}",
            canonical_url=item.get("url"),
            landing_page_url=item.get("url") or "",
            pdf_url=pdf_url,
            pdf_access_status=access_status,
            open_access_evidence=oa_info.get("status") if isinstance(oa_info, dict) else None,
            metadata_confidence=conf.score,
            confidence_breakdown=conf,
            relevance_score=0.9,
            provenance={"provider": "Semantic Scholar Graph API", "s2_id": item.get("paperId", "")},
        )
