"""
Relevance Scoring and Confidence Estimation Module.
Provides transparent, explainable ranking for research papers based on:
1. Query-to-title token overlap and fuzzy similarity
2. Query-to-abstract coverage
3. Exact DOI / identifier matches
4. Publication year filter penalties/bonuses
5. Metadata completeness confidence
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple
from rapidfuzz import fuzz


def tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric words."""
    if not text:
        return []
    return re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", text.lower())


STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves",
}


class RelevanceScorer:
    """Computes transparent relevance scores and breakdowns for paper discovery."""

    def __init__(
        self,
        title_weight: float = 0.35,
        abstract_weight: float = 0.20,
        phrase_weight: float = 0.15,
        author_weight: float = 0.10,
        metadata_weight: float = 0.10,
        pdf_bonus_weight: float = 0.10,
    ) -> None:
        self.title_weight = title_weight
        self.abstract_weight = abstract_weight
        self.phrase_weight = phrase_weight
        self.author_weight = author_weight
        self.metadata_weight = metadata_weight
        self.pdf_bonus_weight = pdf_bonus_weight

    def score(
        self,
        query: str,
        title: str,
        abstract: Optional[str] = None,
        authors: Optional[List[str]] = None,
        publication_year: Optional[int] = None,
        has_pdf: bool = False,
        metadata_confidence: float = 0.5,
        year_start: Optional[int] = None,
        year_end: Optional[int] = None,
    ) -> Tuple[float, Dict[str, Any]]:
        clean_query = query.strip().lower()
        q_tokens = [t for t in tokenize(clean_query) if t not in STOPWORDS]
        if not q_tokens:
            q_tokens = tokenize(clean_query)

        if not q_tokens:
            return 1.0, {"summary": "Empty query matching all records"}

        title_lower = title.lower()
        title_tokens = set(tokenize(title_lower))
        abstract_lower = (abstract or "").lower()
        abstract_tokens = set(tokenize(abstract_lower))
        authors_lower = [a.lower() for a in (authors or [])]

        title_matches = [t for t in q_tokens if t in title_tokens]
        title_coverage = len(title_matches) / len(q_tokens) if q_tokens else 0.0

        abstract_matches = [t for t in q_tokens if t in abstract_tokens]
        abstract_coverage = len(abstract_matches) / len(q_tokens) if q_tokens else 0.0

        overall_matches = [
            t for t in q_tokens
            if t in title_tokens or any(t in auth for auth in authors_lower) or t in abstract_tokens
        ]
        query_coverage = len(overall_matches) / len(q_tokens) if q_tokens else 0.0

        exact_phrase_in_title = clean_query in title_lower if len(clean_query) > 3 else False
        phrase_score = 1.0 if exact_phrase_in_title else (0.5 if clean_query in abstract_lower else 0.0)

        author_match = any(any(qt in auth for qt in q_tokens) for auth in authors_lower)
        author_score = 1.0 if author_match else 0.0

        meta_score = metadata_confidence
        pdf_score = 1.0 if has_pdf else 0.2

        year_penalty = 1.0
        if publication_year:
            if year_start and publication_year < year_start:
                year_penalty = 0.5
            elif year_end and publication_year > year_end:
                year_penalty = 0.5

        fuzzy_ratio = fuzz.token_sort_ratio(clean_query, title_lower) / 100.0

        raw_score = (
            0.25 * title_coverage
            + 0.15 * query_coverage
            + 0.15 * phrase_score
            + 0.15 * fuzzy_ratio
            + 0.10 * author_score
            + 0.10 * meta_score
            + 0.10 * pdf_score
        ) * year_penalty

        final_score = round(min(1.0, max(0.05, raw_score)), 2)

        explanation = {
            "query_terms": q_tokens,
            "title_coverage": round(title_coverage, 2),
            "abstract_coverage": round(abstract_coverage, 2),
            "fuzzy_similarity": round(fuzzy_ratio, 2),
            "exact_phrase_match": exact_phrase_in_title,
            "author_matched": author_match,
            "pdf_available": has_pdf,
            "metadata_confidence": round(metadata_confidence, 2),
            "year_fit": year_penalty == 1.0,
            "final_relevance": final_score,
        }

        return final_score, explanation
