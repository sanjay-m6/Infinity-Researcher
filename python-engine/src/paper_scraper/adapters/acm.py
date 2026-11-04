"""
ACM Digital Library Source Adapter
Queries ACM conference proceedings and journals using Crossref prefix index (prefix 10.1145) and ACM DL index.
"""

from __future__ import annotations

import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.security import validate_url


def _strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    return (
        clean.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .strip()
    )


class AcmAdapter(BaseAdapter):
    id = "acm_dl"
    name = "ACM Digital Library"
    domain = "dl.acm.org"
    policy_url = "https://www.acm.org/about-acm/terms-of-use"
    policy_notes = "ACM Digital Library publications and conference proceedings via Crossref prefix 10.1145 and ACM DL index."
    supports_native_years = True
    request_delay_ms = 1000
    content_types = ["Conference Paper", "Journal Article"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        limit = filters.limit_per_source or 25
        yielded = 0

        # Query Crossref index for ACM publications (Prefix 10.1145)
        crossref_url = (
            f"https://api.crossref.org/works?query={quote_plus(query)}"
            f"&filter=prefix:10.1145&rows={min(limit * 2, 50)}"
        )

        try:
            val_url = validate_url(crossref_url, self.domain)
        except Exception:
            val_url = crossref_url

        headers = {
            "User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            "Accept": "application/json",
        }

        try:
            resp = await client.get(val_url, headers=headers, timeout=12.0)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("message", {}).get("items", [])
                for item in items:
                    if yielded >= limit:
                        return

                    raw_titles = item.get("title", [])
                    raw_title = raw_titles[0] if raw_titles else ""
                    title = _strip_html(raw_title).rstrip(".").strip()
                    if not title:
                        continue

                    # Authors
                    authors: List[str] = []
                    for a in item.get("author", []):
                        g = a.get("given", "").strip()
                        f = a.get("family", "").strip()
                        name = f"{g} {f}".strip() if (g or f) else a.get("name", "").strip()
                        if name:
                            authors.append(name)
                    if not authors:
                        authors = ["ACM Contributor"]

                    # Publication Year
                    pub_year = None
                    try:
                        date_parts = (
                            item.get("published-print", {}).get("date-parts")
                            or item.get("published-online", {}).get("date-parts")
                            or item.get("created", {}).get("date-parts")
                        )
                        if date_parts and date_parts[0]:
                            pub_year = int(date_parts[0][0])
                    except (ValueError, TypeError, IndexError):
                        pass

                    if filters.year_start and pub_year and pub_year < filters.year_start:
                        continue
                    if filters.year_end and pub_year and pub_year > filters.year_end:
                        continue
                    if filters.author and authors:
                        if not any(filters.author.lower() in a.lower() for a in authors):
                            continue

                    venue_list = item.get("container-title", [])
                    venue = venue_list[0].strip() if venue_list else "ACM Digital Library"
                    doi = item.get("DOI", "").strip() or None

                    landing_url = f"https://dl.acm.org/doi/{doi}" if doi else item.get("URL") or f"https://dl.acm.org/action/doSearch?AllField={quote_plus(title)}"

                    licenses = item.get("license", [])
                    is_oa = any(
                        "creativecommons.org" in lic.get("URL", "").lower()
                        or "/open-access" in lic.get("URL", "").lower()
                        or "/oa/" in lic.get("URL", "").lower()
                        for lic in licenses
                    )

                    if filters.open_access_only and not is_oa:
                        continue

                    pdf_url = f"https://dl.acm.org/doi/pdf/{doi}" if doi else None
                    abstract = _strip_html(item.get("abstract")) or None

                    raw_type = item.get("type", "journal-article")
                    content_type = "Conference Paper" if "proceedings" in raw_type else "Journal Article"

                    breakdown = ConfidenceBreakdown(
                        title=1.0,
                        authors=0.9 if authors else 0.5,
                        abstract=0.9 if abstract else 0.0,
                        doi=1.0 if doi else 0.0,
                        pdf=0.9 if pdf_url else 0.0,
                    )
                    paper_id = PaperResult.generate_id(self.id, title, doi)

                    yield PaperResult(
                        paper_id=paper_id,
                        title=title,
                        authors=authors,
                        abstract=abstract,
                        publication_year=pub_year,
                        published_date=str(pub_year) if pub_year else None,
                        venue=venue,
                        publisher="Association for Computing Machinery (ACM)",
                        doi=doi,
                        landing_page_url=landing_url,
                        pdf_download_url=pdf_url,
                        is_open_access=is_oa,
                        source_domain=self.domain,
                        source_adapter=self.id,
                        content_type=content_type,
                        confidence_score=breakdown.composite(),
                        breakdown=breakdown,
                        provenance=[val_url, landing_url],
                    )
                    yielded += 1
        except Exception:
            return

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Verify ACM index connectivity via Crossref prefix."""
        test_url = "https://api.crossref.org/works?rows=1&filter=prefix:10.1145"
        try:
            resp = await client.get(test_url, timeout=6.0)
            if resp.status_code == 200:
                return {"status": "healthy", "latency_ms": int(resp.elapsed.total_seconds() * 1000)}
            return {"status": "degraded", "code": resp.status_code}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}

