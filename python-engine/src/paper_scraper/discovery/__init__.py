"""
Query and link discovery modules.
"""

from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.discovery.links import LinkDiscoverer
from paper_scraper.discovery.identity import (
    QueryIntelligence,
    QueryIdentity,
    clean_doi,
    extract_doi,
    extract_ieee_id,
    extract_arxiv_id,
    extract_pmid_pmcid,
)

__all__ = [
    "QueryBuilder",
    "LinkDiscoverer",
    "QueryIntelligence",
    "QueryIdentity",
    "clean_doi",
    "extract_doi",
    "extract_ieee_id",
    "extract_arxiv_id",
    "extract_pmid_pmcid",
]
