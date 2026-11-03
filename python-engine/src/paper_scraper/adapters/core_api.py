"""
CORE Repository API Adapter (IMARE Stage C).
Aggregates open access research papers and PDF copies from institutional repositories worldwide.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.discovery.identity import QueryIntelligence, clean_doi
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.ranking.source_ranker import SourceCandidate
from paper_scraper.security import validate_url


class CoreApiAdapter(BaseAdapter):
    """Adapter querying CORE API for institutional repository preprints and OA full-texts."""

    id = "core_api"
    name = "CORE Repositories"
    domain = "api.core.ac.uk"
    policy_url = "https://core.ac.uk/services/api"
    policy_notes = "Official CORE API aggregating global academic institutional repositories"
    supports_native_years = True
    request_delay_ms = 400
    content_types = ["Article", "Preprint", "Thesis"]

    BASE_URL = "https://api.core.ac.uk/v3/search/works"

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Verify CORE API status."""
        test_url = f"{self.BASE_URL}?q=quantum&limit=1"
        try:
            resp = await client.get(test_url, timeout=6.0)
            if resp.status_code == 200:
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
        Directly resolve a repository PDF candidate for a paper via CORE.
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
                url = f"{self.BASE_URL}?q=doi:\"{quote_plus(c_doi)}\"&limit=1"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        return self._build_candidate(results[0])

            if title:
                url = f"{self.BASE_URL}?q=title:\"{quote_plus(title)}\"&limit=1"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        return self._build_candidate(results[0])

            return None
        except Exception:
            return None
        finally:
            if own_client:
                await client.aclose()

    def _build_candidate(self, item: Dict[str, Any]) -> Optional[SourceCandidate]:
        """Convert a CORE search result into a SourceCandidate."""
        pdf_url = item.get("downloadUrl")
        if not pdf_url:
            for link in item.get("links", []):
                url = link.get("url") if isinstance(link, dict) else link
                if url and url.endswith(".pdf"):
                    pdf_url = url
                    break

        if not pdf_url:
            return None

        raw_doi = item.get("doi")
        doi = clean_doi(raw_doi) if raw_doi else None

        authors = []
        for a in item.get("authors", []):
            name = a.get("name") if isinstance(a, dict) else str(a)
            if name:
                authors.append(name)

        return SourceCandidate(
            candidate_id=f"core_{item.get('id', '')}",
            source_name="CORE Repository",
            url=pdf_url,
            doi=doi,
            title=item.get("title"),
            authors=authors,
            publication_year=item.get("yearPublished"),
            venue=item.get("publisher"),
            access_status="green_oa",
            version_type="accepted",
            provenance={"core_id": item.get("id", ""), "provider": "CORE Aggregator"},
        )

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        """Search CORE works catalog."""
        identity = QueryIntelligence.parse(query, hint_author=filters.author)
        headers = {"User-Agent": "InfinityResearcher/1.0", "Accept": "application/json"}
        limit = min(filters.limit_per_source or 20, 50)

        if identity.doi:
            search_param = f"doi:\"{identity.doi}\""
        elif identity.cleaned_title:
            search_param = f"title:\"{identity.cleaned_title}\""
        else:
            search_param = query

        url = f"{self.BASE_URL}?q={quote_plus(search_param)}&limit={limit}"
        validate_url(url)

        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return

        data = resp.json()
        results = data.get("results", [])
        for item in results:
            paper = self._to_paper_result(item)
            if paper:
                yield paper

    def _to_paper_result(self, item: Dict[str, Any]) -> Optional[PaperResult]:
        title = item.get("title")
        if not title:
            return None

        raw_doi = item.get("doi")
        doi = clean_doi(raw_doi) if raw_doi else None

        authors = []
        for a in item.get("authors", []):
            name = a.get("name") if isinstance(a, dict) else str(a)
            if name:
                authors.append(name)

        pdf_url = item.get("downloadUrl")
        source_url = f"https://core.ac.uk/works/{item.get('id', '')}"
        year = item.get("yearPublished")
        abstract = item.get("abstract")

        paper_id = PaperResult.generate_id("core_api", title, doi)

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
            venue=item.get("publisher"),
            doi=doi,
            source_id="core_api",
            source_name="CORE Repositories",
            source_page_url=source_url,
            canonical_url=source_url,
            landing_page_url=source_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="Institutional Repository Full Text",
            metadata_confidence=conf.score,
            confidence_breakdown=conf,
            relevance_score=0.85,
            provenance={"provider": "CORE Aggregator", "core_id": str(item.get("id", ""))},
        )
