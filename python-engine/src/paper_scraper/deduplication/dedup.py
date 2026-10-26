"""
Cross-Source Deduplication and Duplicate Candidate Identification.
Identifies duplicate papers via exact DOIs, native repository identifiers,
and RapidFuzz title and author similarity.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple
from rapidfuzz import fuzz

from paper_scraper.models import PaperResult


def normalize_doi(doi: Optional[str]) -> Optional[str]:
    """Normalize a DOI to lowercase canonical format without URL prefixes."""
    if not doi:
        return None
    cleaned = doi.strip().lower()
    cleaned = re.sub(r"^https?://(dx\.)?doi\.org/", "", cleaned)
    cleaned = re.sub(r"^doi:\s*", "", cleaned)
    cleaned = cleaned.strip("/")
    return cleaned if cleaned else None


def normalize_title(title: str) -> str:
    """Normalize title for lexical and fuzzy comparison."""
    if not title:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", title.lower())
    return " ".join(cleaned.split())


def extract_first_author_surname(authors: List[str]) -> Optional[str]:
    """Extract the surname of the first author."""
    if not authors:
        return None
    first = authors[0].strip()
    if not first:
        return None
    if "," in first:
        return first.split(",")[0].strip().lower()
    parts = first.split()
    return parts[-1].strip().lower() if parts else None


class Deduplicator:
    """Maintains an index of seen papers and checks for duplicates or candidates."""

    def __init__(self) -> None:
        self.doi_map: Dict[str, str] = {}            # norm_doi -> paper_id
        self.arxiv_map: Dict[str, str] = {}          # arxiv_id -> paper_id
        self.papers: Dict[str, PaperResult] = {}     # paper_id -> PaperResult
        self.seen_titles: Dict[str, str] = {}        # norm_title -> paper_id

    def check_and_register(
        self, paper: PaperResult
    ) -> Tuple[bool, Optional[str], float, str]:
        """
        Check if a paper is already seen or is a candidate duplicate.
        Returns:
            (is_duplicate, matched_paper_id, confidence, reason)
        """
        norm_d = normalize_doi(paper.doi)
        norm_t = normalize_title(paper.title)

        # 1. Exact DOI match
        if norm_d and norm_d in self.doi_map:
            matched_id = self.doi_map[norm_d]
            return True, matched_id, 1.0, f"Exact DOI match: {norm_d}"

        # 2. Exact arXiv ID match
        if paper.arxiv_id and paper.arxiv_id in self.arxiv_map:
            matched_id = self.arxiv_map[paper.arxiv_id]
            return True, matched_id, 1.0, f"Exact arXiv ID match: {paper.arxiv_id}"

        # 3. Exact normalized title match
        if norm_t in self.seen_titles:
            matched_id = self.seen_titles[norm_t]
            existing = self.papers[matched_id]
            if (
                paper.publication_year
                and existing.publication_year
                and abs(paper.publication_year - existing.publication_year) > 1
            ):
                pass
            else:
                return True, matched_id, 0.95, "Exact normalized title match"

        # 4. Fuzzy title candidate check
        first_author = extract_first_author_surname(paper.authors)
        for existing_id, existing in self.papers.items():
            existing_title = normalize_title(existing.title)
            if abs(len(norm_t) - len(existing_title)) > 40:
                continue

            similarity = fuzz.token_sort_ratio(norm_t, existing_title)
            if similarity >= 92.0:
                existing_author = extract_first_author_surname(existing.authors)
                same_author = (
                    first_author
                    and existing_author
                    and (first_author == existing_author or first_author in existing_author)
                )

                if same_author:
                    return True, existing_id, round(similarity / 100.0, 2), f"Fuzzy title ({similarity:.0f}%) and author match"
                elif similarity >= 96.0:
                    return True, existing_id, round(similarity / 100.0, 2), f"High fuzzy title match ({similarity:.0f}%)"

        # Not a duplicate -> register in index
        self.papers[paper.paper_id] = paper
        if norm_d:
            self.doi_map[norm_d] = paper.paper_id
        if paper.arxiv_id:
            self.arxiv_map[paper.arxiv_id] = paper.paper_id
        self.seen_titles[norm_t] = paper.paper_id

        return False, None, 0.0, "Unique paper"
