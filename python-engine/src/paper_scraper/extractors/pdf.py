"""
PDF Link Discovery and Validation Extractor.
Identifies downloadable or previewable academic PDF URLs using:
1. Citation meta tags (citation_pdf_url)
2. Dublin Core relations and identifiers
3. HTML link rel="alternate" type="application/pdf"
4. Anchor tags containing PDF references
5. Source-specific canonical PDF transformation rules
Validates hostname safety and SSRF protections before returning.
"""

from __future__ import annotations

import re
from typing import List, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from paper_scraper.security import validate_url


class PdfDiscoveryExtractor:
    """Discovers and validates direct PDF links from scholarly HTML pages."""

    @staticmethod
    def discover_pdf_url(html: str, base_url: str, source_id: Optional[str] = None) -> Optional[str]:
        """
        Extract direct PDF URL from page markup and canonical patterns.
        Returns the highest-confidence validated PDF URL, or None.
        """
        candidates: List[str] = []
        soup = BeautifulSoup(html, "html.parser")

        # 1. citation_pdf_url meta tag
        meta_pdf = soup.find("meta", attrs={"name": lambda n: n and n.lower() == "citation_pdf_url"})
        if meta_pdf and meta_pdf.get("content"):
            candidates.append(meta_pdf["content"].strip())

        # 2. link rel="alternate" type="application/pdf"
        link_pdf = soup.find("link", rel=lambda r: r and "alternate" in r.lower(), type=lambda t: t and "pdf" in t.lower())
        if link_pdf and link_pdf.get("href"):
            candidates.append(link_pdf["href"].strip())

        # 3. Source-specific transformation rules
        if source_id == "arxiv" or "arxiv.org" in base_url:
            arxiv_match = re.search(r"arxiv\.org/abs/([0-9]+\.[0-9]+(?:v[0-9]+)?)", base_url)
            if arxiv_match:
                candidates.append(f"https://arxiv.org/pdf/{arxiv_match.group(1)}.pdf")

        elif source_id in ("biorxiv", "medrxiv") or "biorxiv.org" in base_url or "medrxiv.org" in base_url:
            if not base_url.endswith(".full.pdf"):
                clean_base = re.sub(r"\.full$", "", base_url.rstrip("/"))
                candidates.append(f"{clean_base}.full.pdf")

        elif source_id == "plos" or "journals.plos.org" in base_url:
            doi_match = re.search(r"id=(10\.1371/[^&]+)", base_url)
            if doi_match:
                candidates.append(f"https://journals.plos.org/plosone/article/file?id={doi_match.group(1)}&type=printable")

        # 4. Anchor tags containing PDF links
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            # Must contain pdf in URL or text
            if href.lower().endswith(".pdf") or "/pdf/" in href.lower() or "type=printable" in href.lower():
                candidates.append(href)
            elif "download pdf" in a.text.lower() or "view pdf" in a.text.lower():
                candidates.append(href)

        # Validate and return first safe candidate
        for raw_url in candidates:
            resolved = urljoin(base_url, raw_url)
            try:
                validate_url(resolved, check_dns=False)
                return resolved
            except Exception:
                continue

        return None
