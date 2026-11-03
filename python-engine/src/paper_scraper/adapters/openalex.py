"""
OpenAlex REST API Adapter (IMARE Stage C).
Discovers scholarly papers and open-access PDF locations across global repositories.
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


class OpenAlexAdapter(BaseAdapter):
    """Adapter querying OpenAlex catalog for comprehensive metadata and OA repository locations."""

    id = "openalex"
    name = "OpenAlex"
    domain = "api.openalex.org"
    policy_url = "https://openalex.org/"
    policy_notes = "Official OpenAlex REST API for open scientific infrastructure"
    supports_native_years = True
    request_delay_ms = 300
    content_types = ["Article", "Preprint", "Book Chapter", "Conference"]

    BASE_URL = "https://api.openalex.org/works"

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Verify OpenAlex API status."""
        test_url = f"{self.BASE_URL}?per_page=1"
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
        Directly resolve a PDF candidate for a paper via OpenAlex best_oa_location.
        Used by Stage C Candidate Generation.
        """
        if not doi and not title:
            return None

        own_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=10.0)
            own_client = True

        try:
            headers = {"User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)", "Accept": "application/json"}
            if doi:
                c_doi = clean_doi(doi)
                url = f"{self.BASE_URL}/https://doi.org/{quote_plus(c_doi)}"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    work = resp.json()
                    return self._build_candidate(work)

            if title:
                url = f"{self.BASE_URL}?search={quote_plus(title)}&per_page=1"
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

    def _build_candidate(self, work: Dict[str, Any]) -> Optional[SourceCandidate]:
        """Convert an OpenAlex work record into a SourceCandidate."""
        best_oa = work.get("best_oa_location") or {}
        pdf_url = best_oa.get("pdf_url")

        # Fallback to any location with pdf_url
        if not pdf_url:
            for loc in work.get("locations", []):
                if loc.get("pdf_url"):
                    pdf_url = loc.get("pdf_url")
                    best_oa = loc
                    break

        if not pdf_url:
            return None

        raw_doi = work.get("doi")
        doi = clean_doi(raw_doi) if raw_doi else None

        authors = []
        for authorship in work.get("authorships", []):
            author_obj = authorship.get("author") or {}
            name = author_obj.get("display_name")
            if name:
                authors.append(name)

        oa_info = work.get("open_access") or {}
        oa_status = oa_info.get("oa_status", "unverified")
        status_map = {
            "gold": "verified_oa",
            "hybrid": "verified_oa",
            "green": "green_oa",
            "bronze": "bronze_oa",
            "closed": "restricted",
        }
        access_status = status_map.get(oa_status, "unverified")

        ver = best_oa.get("version")
        version_type = "published" if ver == "publishedVersion" else "accepted" if ver == "acceptedVersion" else "preprint"

        host_venue = best_oa.get("source") or {}
        venue = host_venue.get("display_name")

        return SourceCandidate(
            candidate_id=f"oa_{work.get('id', '')[-10:]}",
            source_name="OpenAlex",
            url=pdf_url,
            doi=doi,
            title=work.get("title") or work.get("display_name"),
            authors=authors,
            publication_year=work.get("publication_year"),
            venue=venue,
            access_status=access_status,
            license=best_oa.get("license"),
            version_type=version_type,
            provenance={"openalex_id": work.get("id", ""), "landing_url": best_oa.get("landing_page_url")},
        )

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        """Search OpenAlex works."""
        identity = QueryIntelligence.parse(query, hint_author=filters.author)
        headers = {"User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)", "Accept": "application/json"}
        limit = min(filters.limit_per_source or 20, 50)

        # DOI direct lookup path
        if identity.doi:
            url = f"{self.BASE_URL}/https://doi.org/{quote_plus(identity.doi)}"
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
        url = f"{self.BASE_URL}?search={quote_plus(search_term)}&per_page={limit}"
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

    def _to_paper_result(self, work: Dict[str, Any]) -> Optional[PaperResult]:
        title = work.get("title") or work.get("display_name")
        if not title:
            return None

        raw_doi = work.get("doi")
        doi = clean_doi(raw_doi) if raw_doi else None

        authors = []
        for authorship in work.get("authorships", []):
            author_obj = authorship.get("author") or {}
            name = author_obj.get("display_name")
            if name:
                authors.append(name)

        best_oa = work.get("best_oa_location") or {}
        pdf_url = best_oa.get("pdf_url")
        landing_url = best_oa.get("landing_page_url") or work.get("doi") or ""

        oa_info = work.get("open_access") or {}
        oa_status = oa_info.get("oa_status", "unknown")
        access_status = "available" if pdf_url else "restricted" if oa_status == "closed" else "unknown"

        year = work.get("publication_year")
        host_venue = best_oa.get("source") or {}
        venue = host_venue.get("display_name")

        paper_id = PaperResult.generate_id("openalex", title, doi)

        conf = ConfidenceBreakdown(
            title=1.0,
            authors=0.9 if authors else 0.4,
            abstract=0.0,
            doi=1.0 if doi else 0.0,
            pdf=1.0 if pdf_url else 0.0,
        )

        return PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            publication_year=year,
            venue=venue,
            doi=doi,
            source_id="openalex",
            source_name="OpenAlex",
            source_page_url=landing_url,
            canonical_url=landing_url,
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status=access_status,
            open_access_evidence=oa_status,
            license_text=best_oa.get("license"),
            metadata_confidence=conf.score,
            confidence_breakdown=conf,
            relevance_score=0.88,
            provenance={"provider": "OpenAlex REST API", "openalex_id": work.get("id", "")},
        )
