"""
Discovery Query Construction and Link Building.
Constructs source-specific search URLs, pagination parameters, and keyword tokens.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional
from urllib.parse import quote_plus

from paper_scraper.models import QueryFilter


class QueryBuilder:
    """Builds formatted search URLs and query parameters for academic sources."""

    @staticmethod
    def extract_keywords(query: str) -> List[str]:
        """Extract meaningful keyword tokens from a natural language research query."""
        tokens = re.findall(r"\b[A-Za-z0-9\-]{3,}\b", query)
        stop_words = {
            "the", "and", "for", "with", "from", "that", "this", "what",
            "using", "based", "study", "studies", "about", "into", "over",
        }
        return [t.lower() for t in tokens if t.lower() not in stop_words]

    @staticmethod
    def build_arxiv_url(filter_obj: QueryFilter, page_offset: int = 0) -> str:
        """Construct arXiv API query URL."""
        terms = [t for t in filter_obj.query.strip().split() if t]
        if filter_obj.author:
            terms.append(f"au:{filter_obj.author}")
        search_query = "+AND+".join(f"all:{quote_plus(t)}" for t in terms)
        max_results = filter_obj.limit_per_source or 50
        return (
            f"http://export.arxiv.org/api/query?"
            f"search_query={search_query}&start={page_offset}&max_results={max_results}"
            f"&sortBy=relevance&sortOrder=descending"
        )

    @staticmethod
    def build_biorxiv_url(filter_obj: QueryFilter, page: int = 0) -> str:
        """Construct bioRxiv search URL."""
        clean_q = quote_plus(filter_obj.query.strip())
        return f"https://www.biorxiv.org/search/{clean_q}?page={page}"

    @staticmethod
    def build_medrxiv_url(filter_obj: QueryFilter, page: int = 0) -> str:
        """Construct medRxiv search URL."""
        clean_q = quote_plus(filter_obj.query.strip())
        return f"https://www.medrxiv.org/search/{clean_q}?page={page}"

    @staticmethod
    def build_pubmed_url(filter_obj: QueryFilter, page: int = 1) -> str:
        """Construct PubMed search URL."""
        q_terms = [filter_obj.query.strip()]
        if filter_obj.year_start and filter_obj.year_end:
            q_terms.append(f"{filter_obj.year_start}:{filter_obj.year_end}[dp]")
        elif filter_obj.year_start:
            q_terms.append(f"{filter_obj.year_start}:3000[dp]")
        if filter_obj.author:
            q_terms.append(f"{filter_obj.author}[au]")
        full_q = " AND ".join(q_terms)
        size = filter_obj.limit_per_source or 50
        return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote_plus(full_q)}&page={page}&size={size}"

    @staticmethod
    def build_plos_url(filter_obj: QueryFilter, page: int = 1) -> str:
        """Construct PLOS search URL."""
        q = quote_plus(filter_obj.query.strip())
        rows = filter_obj.limit_per_source or 50
        return f"https://journals.plos.org/plosone/search?q={q}&page={page}&rows={rows}"
