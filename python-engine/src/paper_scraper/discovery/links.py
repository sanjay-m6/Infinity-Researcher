"""
Link and Continuation Discovery.
Extracts paper detail links, canonical article URLs, and pagination tokens.
"""

from __future__ import annotations

import re
from typing import List, Optional
from urllib.parse import urljoin
from bs4 import BeautifulSoup


class LinkDiscoverer:
    """Discovers article landing pages and pagination links from search result pages."""

    @staticmethod
    def extract_article_links(html: str, base_url: str, source_id: str) -> List[str]:
        """Extract validated article landing URLs from HTML search results."""
        soup = BeautifulSoup(html, "html.parser")
        links: List[str] = []

        if source_id == "pubmed":
            # PubMed search results: a.docsum-title
            for a in soup.select("a.docsum-title"):
                href = a.get("href")
                if href:
                    links.append(urljoin("https://pubmed.ncbi.nlm.nih.gov/", href))

        elif source_id in ("biorxiv", "medrxiv"):
            # bioRxiv search results: span.highwire-cite-title a
            for a in soup.select(".highwire-cite-title a, a.highwire-cite-linked-title"):
                href = a.get("href")
                if href:
                    links.append(urljoin(base_url, href))

        elif source_id == "plos":
            # PLOS search results: dt.search-results-title a
            for a in soup.select("dt.search-results-title a, .search-result a[href*='/article?id=']"):
                href = a.get("href")
                if href and "/article?id=" in href:
                    links.append(urljoin("https://journals.plos.org", href))

        elif source_id == "arxiv":
            for a in soup.select("p.list-title a[href*='/abs/']"):
                href = a.get("href")
                if href:
                    links.append(urljoin("https://arxiv.org", href))

        # Deduplicate preserving order
        seen = set()
        unique_links = []
        for l in links:
            if l not in seen:
                seen.add(l)
                unique_links.append(l)

        return unique_links
