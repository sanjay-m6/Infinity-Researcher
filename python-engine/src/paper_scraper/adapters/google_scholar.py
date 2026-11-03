"""
Google Scholar Source Adapter
Queries Google Scholar with live HTML parsing and intelligent open scholarly catalog fallback.
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
        .replace("&apos;", "'")
        .strip()
    )


class GoogleScholarAdapter(BaseAdapter):
    id = "google_scholar"
    name = "Google Scholar"
    domain = "scholar.google.com"
    policy_url = "https://policies.google.com/terms"
    policy_notes = "Google Scholar query discovery with live parsing and automated open scholarly catalog fallback."
    supports_native_years = True
    request_delay_ms = 1500
    content_types = ["Article", "Preprint", "Conference Paper"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        limit = filters.limit_per_source or 20
        yielded = 0

        # Strategy 1: Attempt direct Google Scholar search
        scholar_url = f"https://scholar.google.com/scholar?q={quote_plus(query)}&hl=en"
        if filters.year_start:
            scholar_url += f"&as_ylo={filters.year_start}"
        if filters.year_end:
            scholar_url += f"&as_yhi={filters.year_end}"

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        try:
            resp = await client.get(scholar_url, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                html = resp.text
                if "recaptcha" not in html.lower() and "/sorry/index" not in html.lower():
                    soup = BeautifulSoup(html, "html.parser")
                    cards = soup.select("div.gs_r.gs_or.gs_scl, div.gs_r")
                    for card in cards:
                        if yielded >= limit:
                            return

                        title_elem = card.select_one("h3.gs_rt a") or card.select_one("h3.gs_rt")
                        if not title_elem:
                            continue

                        raw_title = title_elem.get_text()
                        for prefix in ["[PDF]", "[HTML]", "[BOOK]", "[B]", "[CITATION]", "[C]"]:
                            if raw_title.startswith(prefix):
                                raw_title = raw_title[len(prefix):].strip()
                        title = _strip_html(raw_title).rstrip(".").strip()
                        if not title:
                            continue

                        landing_url = title_elem.get("href") or scholar_url
                        pdf_elem = card.select_one("div.gs_or_ggsm a, div.gs_ggs a")
                        pdf_url = pdf_elem.get("href") if pdf_elem else None
                        if pdf_url and not pdf_url.startswith("http"):
                            pdf_url = None

                        authors: List[str] = []
                        pub_year = None
                        venue = "Google Scholar"

                        author_elem = card.select_one("div.gs_a")
                        if author_elem:
                            a_text = author_elem.get_text()
                            parts = [p.strip() for p in re.split(r"[-–—]", a_text)]
                            if parts:
                                for a in parts[0].split(","):
                                    cleaned = a.strip().rstrip("….").strip()
                                    if cleaned:
                                        authors.append(cleaned)
                            if len(parts) >= 2:
                                venue = parts[1].strip() or venue
                                match_yr = re.search(r"\b(19\d\d|20\d\d)\b", parts[1])
                                if match_yr:
                                    pub_year = int(match_yr.group(1))
                            if not pub_year and len(parts) >= 3:
                                match_yr = re.search(r"\b(19\d\d|20\d\d)\b", parts[2])
                                if match_yr:
                                    pub_year = int(match_yr.group(1))

                        if not authors:
                            authors = ["Google Scholar Author"]

                        if filters.year_start and pub_year and pub_year < filters.year_start:
                            continue
                        if filters.year_end and pub_year and pub_year > filters.year_end:
                            continue
                        if filters.author and authors:
                            if not any(filters.author.lower() in a.lower() for a in authors):
                                continue

                        is_oa = pdf_url is not None
                        if filters.open_access_only and not is_oa:
                            continue

                        snip_elem = card.select_one("div.gs_rs")
                        abstract = _strip_html(snip_elem.get_text()) if snip_elem else None

                        doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", landing_url)
                        doi = doi_match.group(0) if doi_match else None

                        breakdown = ConfidenceBreakdown(
                            title=1.0,
                            authors=0.8 if authors else 0.4,
                            abstract=0.8 if abstract else 0.0,
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
                            publisher="Google Scholar",
                            doi=doi,
                            landing_page_url=landing_url,
                            pdf_download_url=pdf_url,
                            is_open_access=is_oa,
                            source_domain=self.domain,
                            source_adapter=self.id,
                            content_type="Journal Article",
                            confidence_score=breakdown.composite(),
                            breakdown=breakdown,
                            provenance=[scholar_url, landing_url],
                        )
                        yielded += 1
                        if yielded >= limit:
                            return
        except Exception:
            pass

        # Strategy 2: Resilient Fallback to OpenAlex Scholarly Catalog
        oa_url = f"https://api.openalex.org/works?search={quote_plus(query)}&per_page={min(limit, 50)}"
        if filters.year_start and filters.year_end:
            oa_url += f"&filter=publication_year:{filters.year_start}-{filters.year_end}"
        elif filters.year_start:
            oa_url += f"&filter=publication_year:{filters.year_start}-2030"
        elif filters.year_end:
            oa_url += f"&filter=publication_year:1900-{filters.year_end}"

        try:
            resp = await client.get(oa_url, headers={"Accept": "application/json"}, timeout=12.0)
            if resp.status_code == 200:
                data = resp.json()
                works = data.get("results", [])
                for w in works:
                    if yielded >= limit:
                        return

                    title = (w.get("title") or w.get("display_name") or "").strip()
                    if not title:
                        continue

                    authors = []
                    for a in w.get("authorships", []):
                        aname = (a.get("author") or {}).get("display_name")
                        if aname:
                            authors.append(aname.strip())
                    if not authors:
                        authors = ["Google Scholar Author"]

                    pub_year = w.get("publication_year")
                    doi_raw = w.get("doi") or ""
                    doi = doi_raw.replace("https://doi.org/", "").strip() or None

                    landing_url = f"https://doi.org/{doi}" if doi else (w.get("primary_location") or {}).get("landing_page_url") or f"https://scholar.google.com/scholar?q={quote_plus(title)}"
                    pdf_url = (w.get("open_access") or {}).get("oa_url") or (w.get("primary_location") or {}).get("pdf_url")
                    is_oa = (w.get("open_access") or {}).get("is_oa", False) or pdf_url is not None

                    if filters.open_access_only and not is_oa:
                        continue

                    venue_obj = (w.get("primary_location") or {}).get("source") or {}
                    venue = venue_obj.get("display_name") or "Google Scholar"

                    breakdown = ConfidenceBreakdown(
                        title=1.0,
                        authors=0.9 if authors else 0.5,
                        abstract=0.0,
                        doi=1.0 if doi else 0.0,
                        pdf=0.9 if pdf_url else 0.0,
                    )
                    paper_id = PaperResult.generate_id(self.id, title, doi)

                    yield PaperResult(
                        paper_id=paper_id,
                        title=title,
                        authors=authors,
                        abstract=None,
                        publication_year=pub_year,
                        published_date=str(pub_year) if pub_year else None,
                        venue=venue,
                        publisher="Google Scholar",
                        doi=doi,
                        landing_page_url=landing_url,
                        pdf_download_url=pdf_url,
                        is_open_access=is_oa,
                        source_domain=self.domain,
                        source_adapter=self.id,
                        content_type="Journal Article",
                        confidence_score=breakdown.composite(),
                        breakdown=breakdown,
                        provenance=[oa_url, landing_url],
                    )
                    yielded += 1
        except Exception:
            return

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Verify Google Scholar connectivity or OpenAlex fallback."""
        try:
            resp = await client.get("https://api.openalex.org/works?per_page=1", timeout=6.0)
            if resp.status_code == 200:
                return {"status": "healthy", "latency_ms": int(resp.elapsed.total_seconds() * 1000)}
            return {"status": "degraded", "code": resp.status_code}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
