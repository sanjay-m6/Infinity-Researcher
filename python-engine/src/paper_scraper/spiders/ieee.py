"""
Scrapy Spider for IEEE Xplore.
Queries IEEE conference proceedings and journals using official IEEE REST API with Crossref prefix index fallback.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Generator
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import scrapy
from scrapy.http import JsonRequest, Request, Response

from paper_scraper.models import ConfidenceBreakdown, PaperResult
from paper_scraper.spiders.base import BasePaperSpider

logger = logging.getLogger(__name__)


def _strip_html(text: Any) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", str(text))
    return (
        clean.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .strip()
    )


class IeeeSpider(BasePaperSpider):
    name = "ieee_xplore"
    source_id = "ieee_xplore"
    source_name = "IEEE Xplore"
    allowed_domains = ["ieeexplore.ieee.org", "api.crossref.org", "crossref.org"]

    def start_requests(self) -> Generator[Request, None, None]:
        payload: dict[str, Any] = {

            "queryText": self.query.strip(),
            "rowsPerPage": min(self.limit, 50),
        }
        if getattr(self, "open_access_only", False):
            payload["openAccess"] = True

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": "https://ieeexplore.ieee.org",
            "Referer": f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(self.query)}",
        }
        yield JsonRequest(
            url="https://ieeexplore.ieee.org/rest/search",
            data=payload,
            headers=headers,
            callback=self.parse_ieee_rest,
            errback=self.handle_ieee_rest_error,
            dont_filter=True,
        )

    def parse_ieee_rest(self, response: Response) -> Generator[Any, None, None]:
        is_blocked, reason = self.is_challenge_or_blocked_response(response)
        if is_blocked:
            logger.info("IEEE REST API blocked/challenged, falling back to Crossref prefix index: %s", reason)
            yield from self._fallback_crossref()
            return

        try:
            data = json.loads(response.text)
        except Exception as e:
            logger.info("IEEE response was not JSON, falling back to Crossref prefix index: %s", e)
            yield from self._fallback_crossref()
            return

        records = data.get("records", [])
        if not records:
            logger.info("IEEE REST API returned 0 records, attempting Crossref prefix index fallback")
            yield from self._fallback_crossref()
            return

        for rec in records:
            if self.results_count >= self.limit:
                break

            raw_title = rec.get("articleTitle", "")
            title = _strip_html(raw_title).rstrip(".").strip()
            if not title:
                continue

            authors = []
            for a in rec.get("authors", []):
                name = a.get("preferredName") or a.get("normalizedName") or ""
                if name.strip():
                    authors.append(name.strip())

            pub_year = None
            py_raw = rec.get("publicationYear")
            if py_raw:
                try:
                    pub_year = int(py_raw)
                except (ValueError, TypeError):
                    pass

            if self.year_start and pub_year and pub_year < self.year_start:
                continue
            if self.year_end and pub_year and pub_year > self.year_end:
                continue
            if self.author and authors:
                if not any(self.author.lower() in a.lower() for a in authors):
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
            )

            if getattr(self, "open_access_only", False) and not is_oa:
                continue

            pdf_link = rec.get("pdfLink", "")
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
            paper_id = PaperResult.generate_id(self.source_id, title, doi)

            paper = PaperResult(
                paper_id=paper_id,
                title=title,
                authors=authors,
                abstract=abstract,
                publication_year=pub_year,
                published_date=str(pub_year) if pub_year else None,
                venue=venue,
                publisher="IEEE",
                doi=doi,
                source_id=self.source_id,
                source_name=self.source_name,
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
            self.results_count += 1
            yield paper

    def handle_ieee_rest_error(self, failure: Any) -> Generator[Request, None, None]:
        logger.info("IEEE REST search error (%s), initiating Crossref fallback", failure)
        yield from self._fallback_crossref()

    def _fallback_crossref(self) -> Generator[Request, None, None]:
        url = f"https://api.crossref.org/works?query={quote_plus(self.query)}&filter=prefix:10.1109&rows={self.limit}"
        headers = {
            "User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)",
            "Accept": "application/json",
        }
        yield Request(
            url=url,
            headers=headers,
            callback=self.parse_crossref,
            errback=self.handle_error,
            dont_filter=True,
        )

    def parse_crossref(self, response: Response) -> Generator[Any, None, None]:
        try:
            data = json.loads(response.text)
        except Exception as e:
            self.record_status("failed", f"Failed to parse Crossref response for IEEE: {e}")
            return

        items = data.get("message", {}).get("items", [])
        for item in items:
            if self.results_count >= self.limit:
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

            if self.year_start and pub_year and pub_year < self.year_start:
                continue
            if self.year_end and pub_year and pub_year > self.year_end:
                continue
            if self.author and authors:
                if not any(self.author.lower() in a.lower() for a in authors):
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

            if getattr(self, "open_access_only", False) and not is_oa:
                continue



            breakdown = ConfidenceBreakdown(
                title=1.0,
                authors=0.9 if authors else 0.5,
                abstract=0.9 if abstract else 0.0,
                doi=1.0 if doi else 0.0,
                pdf=0.0,
            )
            paper_id = PaperResult.generate_id(self.source_id, title, doi)

            paper = PaperResult(
                paper_id=paper_id,
                title=title,
                authors=authors,
                abstract=abstract,
                publication_year=pub_year,
                published_date=str(pub_year) if pub_year else None,
                venue=venue,
                publisher="IEEE",
                doi=doi,
                source_id=self.source_id,
                source_name=self.source_name,
                source_page_url=landing_url,
                landing_page_url=landing_url,
                pdf_url=None,
                pdf_access_status="open_access" if is_oa else "paywalled",
                open_access_evidence="Open Access" if is_oa else None,
                license_text="IEEE" if not is_oa else "Open Access",
                document_type=item.get("type", "journal_article"),
                language="en",
                keywords=["IEEE"],
                metadata_confidence=breakdown.compute_composite(),
                confidence_breakdown=breakdown,
                extraction_method="crossref_ieee_prefix",
            )
            self.results_count += 1
            yield paper
