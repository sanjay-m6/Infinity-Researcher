"""
Base adapter protocol and abstract base class for scholarly website scraping.
"""

from __future__ import annotations

import abc
import datetime
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from bs4 import BeautifulSoup
import httpx

from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter


class BaseAdapter(abc.ABC):
    """Abstract base class for all academic source adapters."""

    id: str
    name: str
    domain: str
    policy_url: str
    policy_notes: str
    supports_native_years: bool = False
    request_delay_ms: int = 500
    content_types: List[str] = ["Preprint", "Article"]

    @abc.abstractmethod
    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        """
        Execute search against the source and yield PaperResult records incrementally.
        Must handle errors, pagination, and selector fallbacks.
        """
        yield  # type: ignore

    @abc.abstractmethod
    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Check if source website is currently reachable and responding normally."""
        pass

    @staticmethod
    def extract_meta_tags(soup: BeautifulSoup) -> Dict[str, Any]:
        """
        Extract standard scholarly meta tags:
        - Dublin Core (dc.title, dc.creator, dc.date, dc.identifier)
        - Google Scholar Highwire Press (citation_title, citation_author, citation_pdf_url, citation_doi)
        - Open Graph & Schema.org
        """
        meta: Dict[str, Any] = {
            "citation_authors": [],
            "keywords": [],
        }

        for tag in soup.find_all("meta"):
            name = (tag.get("name") or tag.get("property") or "").lower()
            content = tag.get("content") or ""
            if not name or not content:
                continue

            if name in ("citation_title", "dc.title", "og:title"):
                meta["title"] = meta.get("title") or content.strip()
            elif name in ("citation_author", "dc.creator"):
                meta["citation_authors"].append(content.strip())
            elif name in ("citation_date", "citation_publication_date", "dc.date"):
                meta["date"] = meta.get("date") or content.strip()
            elif name in ("citation_doi", "dc.identifier"):
                if "10." in content:
                    meta["doi"] = meta.get("doi") or content.strip()
            elif name in ("citation_pdf_url", "dc.identifier.pdf"):
                meta["pdf_url"] = meta.get("pdf_url") or content.strip()
            elif name in ("citation_journal_title", "dc.source"):
                meta["venue"] = meta.get("venue") or content.strip()
            elif name in ("citation_abstract", "description", "og:description"):
                meta["abstract"] = meta.get("abstract") or content.strip()
            elif name in ("keywords", "citation_keywords"):
                parts = [k.strip() for k in re.split(r"[,;]", content) if k.strip()]
                meta["keywords"].extend(parts)

        return meta

    @staticmethod
    def parse_year(date_str: Optional[str]) -> Optional[int]:
        """Extract a 4-digit year from date strings."""
        if not date_str:
            return None
        match = re.search(r"\b(19\d\d|20\d\d)\b", date_str)
        return int(match.group(1)) if match else None
