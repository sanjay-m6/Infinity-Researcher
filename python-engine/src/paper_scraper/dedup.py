"""
Backwards-compatibility shim re-exporting from paper_scraper.deduplication.dedup.
"""

from paper_scraper.deduplication.dedup import (
    Deduplicator,
    normalize_doi,
    normalize_title,
    extract_first_author_surname,
)

__all__ = [
    "Deduplicator",
    "normalize_doi",
    "normalize_title",
    "extract_first_author_surname",
]
