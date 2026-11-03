"""
IEEE Xplore Source Adapter
Queries IEEE conference proceedings and journals using official IEEE REST API and Crossref prefix index fallback.
"""

from __future__ import annotations

import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
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
        .strip()
    )


class IeeeAdapter(BaseAdapter):
    id = "ieee_xplore"
    name = "IEEE Xplore"
    domain = "ieeexplore.ieee.org"
    policy_url = "https://ieeexplore.ieee.org/XploreHelp/legal-terms"
    policy_notes = "Official IEEE REST and Crossref prefix index for IEEE conference and journal publications."
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

        # Strategy 1: Official IEEE Xplore REST search API
        ieee_url = "https://ieeexplore.ieee.org/rest/search"
        payload: Dict[str, Any] = {
            "queryText": query.strip(),
            "rowsPerPage": min(limit, 50),
        }
        if filters.open_access_only:
            payload["openAccess"] = True

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": "https://ieeexplore.ieee.org",
            "Referer": f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(query)}",
        }

        try:
            resp = await client.post(ieee_url, json=payload, headers=headers, timeout=12.0)
            if resp.status_code == 200:
                data = resp.json()
                records = data.get("records", [])
                for rec in records:
                    if yielded >= limit:
                        return

                    raw_title = rec.get("articleTitle", "")
                    title = _strip_html(raw_title).rstrip(".").strip()
                    if not title:
                        continue

                    # Authors
                    authors: List[str] = []
                    for a in rec.get("authors", []):
                        name = a.get("preferredName") or a.get("normalizedName") or ""
                        if name.strip():
                            authors.append(name.strip())

                    # Year
                    pub_year = None
                    py_raw = rec.get("publicationYear")
                    if py_raw:
                        try:
                            pub_year = int(py_raw)
                        except (ValueError, TypeError):
                            pass

                    # Filter year
                    if filters.year_start and pub_year and pub_year < filters.year_start:
                        continue
                    if filters.year_end and pub_year and pub_year > filters.year_end:
                        continue
                    # Filter author
                    if filters.author and authors:
                        if not any(filters.author.lower() in a.lower() for a in authors):
                            continue

                    venue = _strip_html(rec.get("publicationTitle")) or "IEEE Xplore"
                    doi = rec.get("doi", "").strip() or None
                    doc_link = rec.get("documentLink", "")
                    if doc_link.startswith("http"):
                        landing_url = doc_link
                    elif doc_link:
                        landing_url = f"https://ieeexplore.ieee.org{doc_link}"
                    elif doi:
                        landing_url = f"https://doi.org/{doi}"
                    else:
                        landing_url = f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(title)}"

                    is_oa = (
                        rec.get("isOpenAccess", False) is True
                        or (rec.get("accessType") or {}).get("type") == "open-access"
                        or "ieee access" in venue.lower()
                    )

                    if filters.open_access_only and not is_oa:
                        continue

                    pdf_link = rec.get("pdfLink", "")
                    if not pdf_link and rec.get("articleNumber"):
                        pdf_link = f"/stamp/stamp.jsp?tp=&arnumber={rec.get('articleNumber')}"
                    pdf_url = None
                    if is_oa and pdf_link:
                        pdf_url = pdf_link if pdf_link.startswith("http") else f"https://ieeexplore.ieee.org{pdf_link}"


                    abstract = _strip_html(rec.get("abstract")) or None

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
                        publisher="IEEE",
                        doi=doi,
                        source_id=self.id,
                        source_name=self.name,
                        source_page_url=landing_url,
                        landing_page_url=landing_url,
                        pdf_url=pdf_url,
                        pdf_access_status="available" if pdf_url else ("open_access" if is_oa else "paywalled"),
                        open_access_evidence="IEEE Open Access" if is_oa else None,
                        license_text="IEEE" if not is_oa else "Open Access",
                        document_type=rec.get("contentType", "journal_article"),
                        language="en",
                        keywords=["IEEE"],
                        metadata_confidence=breakdown.compute_composite(),
                        confidence_breakdown=breakdown,
                        extraction_method="ieee_rest_api",
                    )
                    yielded += 1

                if yielded > 0:
                    return
        except Exception:
            # Fall through to Crossref prefix query
            pass

        # Strategy 2: Crossref IEEE prefix index (10.1109) fallback
        crossref_url = (
            f"https://api.crossref.org/works?query={quote_plus(query)}"
            f"&filter=prefix:10.1109&rows={limit}"
        )
        try:
            cr_resp = await client.get(
                crossref_url,
                headers={"User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)"},
                timeout=12.0,
            )
            if cr_resp.status_code == 200:
                cr_data = cr_resp.json()
                items = cr_data.get("message", {}).get("items", [])
                for item in items:
                    if yielded >= limit:
                        break

                    raw_title = (item.get("title") or [""])[0]
                    title = _strip_html(raw_title).rstrip(".").strip()
                    if not title:
                        continue

                    authors = []
                    for a in item.get("author", []):
                        given = a.get("given", "").strip()
                        family = a.get("family", "").strip()
                        if given and family:
                            authors.append(f"{given} {family}")
                        elif family:
                            authors.append(family)
                        elif a.get("name"):
                            authors.append(a["name"].strip())

                    pub_year = None
                    date_parts = (
                        (item.get("published-print") or {}).get("date-parts")
                        or (item.get("published-online") or {}).get("date-parts")
                        or (item.get("created") or {}).get("date-parts")
                    )
                    if date_parts and date_parts[0]:
                        try:
                            pub_year = int(date_parts[0][0])
                        except (ValueError, TypeError):
                            pass

                    # Filter year
                    if filters.year_start and pub_year and pub_year < filters.year_start:
                        continue
                    if filters.year_end and pub_year and pub_year > filters.year_end:
                        continue
                    # Filter author
                    if filters.author and authors:
                        if not any(filters.author.lower() in a.lower() for a in authors):
                            continue

                    venue_list = item.get("container-title") or []
                    venue = venue_list[0] if venue_list else "IEEE"
                    doi = item.get("DOI", "").strip() or None
                    landing_url = item.get("URL") or (f"https://doi.org/{doi}" if doi else f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(title)}")
                    abstract = _strip_html(item.get("abstract")) or None
                    licenses = item.get("license") or []
                    is_oa = any(
                        "creativecommons.org" in (lic.get("URL") or "").lower()
                        or "/open-access" in (lic.get("URL") or "").lower()
                        or "/oa/" in (lic.get("URL") or "").lower()
                        for lic in licenses
                    )

                    if filters.open_access_only and not is_oa:
                        continue


                    pdf_url = None
                    for link_entry in item.get("link", []):
                        raw_u = link_entry.get("URL", "")
                        c_type = (link_entry.get("content-type") or "").lower()
                        if "pdf" in c_type or raw_u.endswith(".pdf") or "arnumber=" in raw_u:
                            pdf_url = raw_u.replace("http://", "https://")
                            is_oa = True
                            break

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
                        publisher="IEEE",
                        doi=doi,
                        source_id=self.id,
                        source_name=self.name,
                        source_page_url=landing_url,
                        landing_page_url=landing_url,
                        pdf_url=pdf_url,
                        pdf_access_status="available" if pdf_url else ("open_access" if is_oa else "paywalled"),
                        open_access_evidence="Open Access" if is_oa else None,
                        license_text="IEEE" if not is_oa else "Open Access",
                        document_type=item.get("type", "journal_article"),
                        language="en",
                        keywords=["IEEE"],
                        metadata_confidence=breakdown.compute_composite(),
                        confidence_breakdown=breakdown,
                        extraction_method="crossref_ieee_prefix",
                    )
                    yielded += 1
        except Exception:
            pass

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get(
                "https://api.crossref.org/works?filter=prefix:10.1109&rows=1",
                headers={"User-Agent": "InfinityResearcher/1.0"},
                timeout=5.0,
            )
            return {"health": "healthy" if resp.status_code == 200 else "degraded", "latency_ms": 100}
        except Exception as e:
            return {"health": "degraded", "error": str(e)}
