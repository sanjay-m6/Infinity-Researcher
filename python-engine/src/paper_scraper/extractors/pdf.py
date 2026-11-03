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

        # 1. citation_pdf_url and academic repository meta tags
        for meta_name in ("citation_pdf_url", "eprints.document_url", "biorxiv_pdf", "biorxiv_url"):
            meta = soup.find("meta", attrs={"name": lambda n, m=meta_name: n and n.lower() == m})
            if meta and meta.get("content"):
                candidates.append(meta["content"].strip())

        meta_prop = soup.find("meta", attrs={"property": lambda p: p and p.lower() == "citation_pdf_url"})
        if meta_prop and meta_prop.get("content"):
            candidates.append(meta_prop["content"].strip())

        # Dublin core identifier
        dc_meta = soup.find("meta", attrs={"name": lambda n: n and n.lower() in ("dc.identifier", "dc.relation")})
        if dc_meta and dc_meta.get("content") and dc_meta["content"].lower().endswith(".pdf"):
            candidates.append(dc_meta["content"].strip())

        # 2. link rel="alternate" type="application/pdf"
        link_pdf = soup.find("link", rel=lambda r: r and "alternate" in r.lower(), type=lambda t: t and "pdf" in t.lower())
        if link_pdf and link_pdf.get("href"):
            candidates.append(link_pdf["href"].strip())

        # 3. Source-specific transformation rules
        if source_id == "arxiv" or "arxiv.org" in base_url or "ar5iv" in base_url:
            arxiv_match = re.search(r"arxiv\.org/(?:abs|html|pdf)/([0-9]+\.[0-9]+(?:v[0-9]+)?)", base_url)
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

        elif "mdpi.com" in base_url:
            doi_match = re.search(r"(10\.3390/[^/&?#]+)", base_url)
            if doi_match:
                candidates.append(f"https://www.mdpi.com/{doi_match.group(1)}/pdf")

        elif "frontiersin.org" in base_url:
            doi_match = re.search(r"(10\.3389/[^/&?#]+)", base_url)
            if doi_match:
                candidates.append(f"https://www.frontiersin.org/articles/{doi_match.group(1)}/pdf")

        elif "springer.com" in base_url or "nature.com" in base_url:
            doi_match = re.search(r"(10\.(?:1007|1038|1186)/[^/&?#\s]+)", base_url)
            if doi_match:
                candidates.append(f"https://link.springer.com/content/pdf/{doi_match.group(1)}.pdf")

        elif "dl.acm.org" in base_url:
            doi_match = re.search(r"(10\.1145/[^/&?#\s]+)", base_url)
            if doi_match:
                candidates.append(f"https://dl.acm.org/doi/pdf/{doi_match.group(1)}")

        elif "wiley.com" in base_url:
            doi_match = re.search(r"(10\.(?:1002|1111)/[^/&?#\s]+)", base_url)
            if doi_match:
                candidates.append(f"https://onlinelibrary.wiley.com/doi/pdfdirect/{doi_match.group(1)}")

        elif "ncbi.nlm.nih.gov" in base_url or "europepmc.org" in base_url:
            pmc_match = re.search(r"(PMC[0-9]+)", base_url, re.IGNORECASE)
            if pmc_match:
                candidates.append(f"https://europepmc.org/backend/ptpmcrender.fcgi?accid={pmc_match.group(1).upper()}&blobtype=pdf")

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
