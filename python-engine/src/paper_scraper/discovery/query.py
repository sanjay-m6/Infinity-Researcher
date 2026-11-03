"""
Discovery Query Construction and Link Building.
Constructs source-specific search URLs, pagination parameters, and keyword tokens.
Integrated with QueryIntelligence (Stage A).
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional
from urllib.parse import quote_plus

from paper_scraper.models import QueryFilter
from paper_scraper.discovery.identity import QueryIdentity, QueryIntelligence


class QueryBuilder:
    """Builds formatted search URLs and query parameters for academic sources."""

    @staticmethod
    def extract_keywords(query: str) -> List[str]:
        """Extract meaningful keyword tokens from a natural language research query."""
        return QueryIntelligence.extract_keywords(query)

    @staticmethod
    def parse_identity(
        query: str,
        author: Optional[str] = None,
        year: Optional[int] = None,
    ) -> QueryIdentity:
        """Parse query into structured identity with extracted DOIs, IDs, and multi-representations."""
        return QueryIntelligence.parse(query, hint_author=author, hint_year=year)

    @staticmethod
    def build_arxiv_url(filter_obj: QueryFilter, page_offset: int = 0) -> str:
        """Construct arXiv website HTML search query URL."""
        identity = QueryIntelligence.parse(filter_obj.query, hint_author=filter_obj.author)
        # If arXiv ID found directly, construct landing or targeted search
        if identity.arxiv_id:
            return f"https://arxiv.org/abs/{identity.arxiv_id}"

        terms = [t for t in filter_obj.query.strip().split() if t]
        if filter_obj.author and not any(t.startswith("au:") for t in terms):
            terms.append(f"au:{filter_obj.author}")
        search_query = "+".join(quote_plus(t) for t in terms)
        # arXiv valid sizes: 25, 50, 100, 200
        req_size = filter_obj.limit_per_source or 50
        valid_sizes = [25, 50, 100, 200]
        size = min(valid_sizes, key=lambda x: abs(x - req_size))
        return (
            f"https://arxiv.org/search/?"
            f"query={search_query}&searchtype=all&source=header&start={page_offset}&size={size}"
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
        identity = QueryIntelligence.parse(filter_obj.query, hint_author=filter_obj.author)
        if identity.pmid:
            return f"https://pubmed.ncbi.nlm.nih.gov/{identity.pmid}/"

        q_terms = [filter_obj.query.strip()]
        if filter_obj.year_start and filter_obj.year_end:
            q_terms.append(f"{filter_obj.year_start}:{filter_obj.year_end}[dp]")
        elif filter_obj.year_start:
            q_terms.append(f"{filter_obj.year_start}:3000[dp]")
        elif identity.year:
            q_terms.append(f"{identity.year}:{identity.year}[dp]")

        if filter_obj.author:
            q_terms.append(f"{filter_obj.author}[au]")
        elif identity.authors:
            q_terms.append(f"{identity.authors[0]}[au]")

        full_q = " AND ".join(q_terms)
        # PubMed valid sizes: 10, 20, 50, 100, 200
        req_size = filter_obj.limit_per_source or 50
        valid_sizes = [10, 20, 50, 100, 200]
        size = min(valid_sizes, key=lambda x: abs(x - req_size))
        return f"https://pubmed.ncbi.nlm.nih.gov/?term={quote_plus(full_q)}&page={page}&size={size}"

    @staticmethod
    def build_plos_url(filter_obj: QueryFilter, page: int = 1) -> str:
        """Construct PLOS search URL."""
        q = quote_plus(filter_obj.query.strip())
        return f"https://journals.plos.org/plosone/dynamicSearch?filterJournals=PLoSONE&q={q}&page={page}"

    @staticmethod
    def build_ieee_search_url(filter_obj: QueryFilter, page: int = 1) -> str:
        """Construct IEEE Xplore search URL."""
        identity = QueryIntelligence.parse(filter_obj.query, hint_author=filter_obj.author)
        if identity.ieee_id:
            return f"https://ieeexplore.ieee.org/document/{identity.ieee_id}"
        if identity.doi:
            return f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(identity.doi)}"

        q = quote_plus(filter_obj.query.strip())
        return f"https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText={q}&pageNumber={page}"

    @staticmethod
    def build_semantic_scholar_url(
        query: str,
        offset: int = 0,
        limit: int = 20,
    ) -> str:
        """Construct Semantic Scholar Graph API query URL."""
        identity = QueryIntelligence.parse(query)
        if identity.doi:
            return (
                f"https://api.semanticscholar.org/graph/v1/paper/DOI:{quote_plus(identity.doi)}"
                f"?fields=paperId,title,authors,year,abstract,venue,publicationTypes,openAccessPdf,externalIds,url"
            )
        if identity.arxiv_id:
            return (
                f"https://api.semanticscholar.org/graph/v1/paper/ARXIV:{quote_plus(identity.arxiv_id)}"
                f"?fields=paperId,title,authors,year,abstract,venue,publicationTypes,openAccessPdf,externalIds,url"
            )
        search_q = quote_plus(identity.cleaned_title if identity.cleaned_title else query)
        return (
            f"https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={search_q}&offset={offset}&limit={limit}"
            f"&fields=paperId,title,authors,year,abstract,venue,publicationTypes,openAccessPdf,externalIds,url"
        )

    @staticmethod
    def build_openalex_url(query: str, page: int = 1, per_page: int = 25) -> str:
        """Construct OpenAlex REST API query URL."""
        identity = QueryIntelligence.parse(query)
        if identity.doi:
            return f"https://api.openalex.org/works/https://doi.org/{quote_plus(identity.doi)}"
        search_q = quote_plus(identity.cleaned_title if identity.cleaned_title else query)
        return f"https://api.openalex.org/works?search={search_q}&page={page}&per_page={per_page}"

    @staticmethod
    def build_core_url(query: str, limit: int = 20, offset: int = 0) -> str:
        """Construct CORE API search URL."""
        identity = QueryIntelligence.parse(query)
        if identity.doi:
            search_q = quote_plus(f"doi:\"{identity.doi}\"")
        else:
            search_q = quote_plus(identity.cleaned_title if identity.cleaned_title else query)
        return f"https://api.core.ac.uk/v3/search/works?q={search_q}&limit={limit}&offset={offset}"
