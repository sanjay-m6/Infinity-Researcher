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


def _extract_keywords(query: str) -> str:
    """Extract salient academic terms if query is a long sentence or title."""
    stop_words = {
        "using", "ahead", "with", "from", "that", "this", "which", "into", "over",
        "than", "more", "then", "their", "about", "study", "based", "approach",
        "through", "under", "between", "these", "those", "such", "after", "before",
    }
    words = [w.strip() for w in re.split(r"[\s\-_,;:]+", query) if w.strip()]
    if len(words) <= 4:
        return query
    salient = [w for w in words if len(w) > 3 and w.lower() not in stop_words]
    return " ".join(salient) if len(salient) >= 3 else query


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
        seen_dois: set[str] = set()

        headers = {
            "User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            "Accept": "application/json",
        }

        # Strategy 1: Direct Crossref query for ACM prefix (10.1145)
        # We test both verbatim query and relaxed keywords if verbatim yields few results
        queries_to_try = [query]
        relaxed = _extract_keywords(query)
        if relaxed.lower() != query.lower():
            queries_to_try.append(relaxed)

        for q_attempt in queries_to_try:
            if yielded >= limit:
                break

            crossref_url = (
                f"https://api.crossref.org/works?query={quote_plus(q_attempt)}"
                f"&filter=prefix:10.1145&rows={min(limit * 2, 50)}"
            )

            try:
                val_url = validate_url(crossref_url, self.domain)
            except Exception:
                val_url = crossref_url

            try:
                resp = await client.get(val_url, headers=headers, timeout=12.0)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("message", {}).get("items", [])
                    for item in items:
                        if yielded >= limit:
                            return

                        doi = item.get("DOI", "").strip() or None
                        if doi and doi.lower() in seen_dois:
                            continue

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

                        landing_url = (
                            f"https://dl.acm.org/doi/{doi}"
                            if doi
                            else item.get("URL") or f"https://dl.acm.org/action/doSearch?AllField={quote_plus(title)}"
                        )

                        licenses = item.get("license", [])
                        is_oa = any(
                            "creativecommons.org" in lic.get("URL", "").lower()
                            or "/open-access" in lic.get("URL", "").lower()
                            or "/oa/" in lic.get("URL", "").lower()
                            for lic in licenses
                        )

                        if filters.open_access_only and not is_oa:
                            continue

                        # Only designate direct pdf_url if open access, avoiding paywall Cloudflare blocks
                        pdf_url = f"https://dl.acm.org/doi/pdf/{doi}" if (doi and is_oa) else None
                        abstract = _strip_html(item.get("abstract")) or None

                        raw_type = item.get("type", "journal-article")
                        doc_type = "conference_paper" if "proceedings" in raw_type else "journal_article"

                        breakdown = ConfidenceBreakdown(
                            title=1.0,
                            authors=0.9 if authors else 0.5,
                            abstract=0.9 if abstract else 0.0,
                            doi=1.0 if doi else 0.0,
                            pdf=0.9 if pdf_url else 0.0,
                        )
                        paper_id = PaperResult.generate_id(self.id, title, doi)

                        if doi:
                            seen_dois.add(doi.lower())

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
                            source_id=self.id,
                            source_name=self.name,
                            source_page_url="https://dl.acm.org",
                            landing_page_url=landing_url,
                            pdf_url=pdf_url,
                            pdf_access_status="available" if is_oa else "restricted",
                            open_access_evidence="ACM Open Access" if is_oa else None,
                            document_type=doc_type,
                            language="en",
                            keywords=["Computer Science", "ACM"],
                            metadata_confidence=breakdown.compute_composite(),
                            confidence_breakdown=breakdown,
                            provenance={"crossref": val_url, "landing": landing_url},
                        )
                        yielded += 1
            except Exception:
                continue

        # Strategy 2: Resilient Fallback to OpenAlex ACM Catalog if few results
        if yielded < limit:
            oa_url = (
                f"https://api.openalex.org/works?search={quote_plus(query)}"
                f"&filter=doi:10.1145*&per_page={min(limit - yielded, 50)}"
            )
            try:
                resp = await client.get(oa_url, headers=headers, timeout=12.0)
                if resp.status_code == 200:
                    works = resp.json().get("results", [])
                    for w in works:
                        if yielded >= limit:
                            return
                        doi_raw = w.get("doi") or ""
                        doi = doi_raw.replace("https://doi.org/", "").strip() or None
                        if doi and doi.lower() in seen_dois:
                            continue

                        title = (w.get("title") or w.get("display_name") or "").strip()
                        if not title:
                            continue

                        authors = []
                        for a in w.get("authorships", []):
                            aname = (a.get("author") or {}).get("display_name")
                            if aname:
                                authors.append(aname.strip())
                        if not authors:
                            authors = ["ACM Contributor"]

                        pub_year = w.get("publication_year")
                        landing_url = f"https://dl.acm.org/doi/{doi}" if doi else (w.get("primary_location") or {}).get("landing_page_url") or f"https://dl.acm.org/action/doSearch?AllField={quote_plus(title)}"
                        pdf_url = (w.get("open_access") or {}).get("oa_url") or (w.get("primary_location") or {}).get("pdf_url")
                        is_oa = (w.get("open_access") or {}).get("is_oa", False) or pdf_url is not None

                        if filters.open_access_only and not is_oa:
                            continue

                        venue_obj = (w.get("primary_location") or {}).get("source") or {}
                        venue = venue_obj.get("display_name") or "ACM Digital Library"

                        breakdown = ConfidenceBreakdown(
                            title=1.0,
                            authors=0.9 if authors else 0.5,
                            abstract=0.0,
                            doi=1.0 if doi else 0.0,
                            pdf=0.9 if pdf_url else 0.0,
                        )
                        paper_id = PaperResult.generate_id(self.id, title, doi)
                        if doi:
                            seen_dois.add(doi.lower())

                        yield PaperResult(
                            paper_id=paper_id,
                            title=title,
                            authors=authors,
                            abstract=None,
                            publication_year=pub_year,
                            published_date=str(pub_year) if pub_year else None,
                            venue=venue,
                            publisher="Association for Computing Machinery (ACM)",
                            doi=doi,
                            source_id=self.id,
                            source_name=self.name,
                            source_page_url="https://dl.acm.org",
                            landing_page_url=landing_url,
                            pdf_url=pdf_url,
                            pdf_access_status="available" if is_oa else "restricted",
                            open_access_evidence="OpenAlex OA" if is_oa else None,
                            document_type="conference_paper",
                            language="en",
                            keywords=["Computer Science", "ACM"],
                            metadata_confidence=breakdown.compute_composite(),
                            confidence_breakdown=breakdown,
                            provenance={"openalex": oa_url, "landing": landing_url},
                        )
                        yielded += 1
            except Exception:
                pass

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
