"""
Query Identity and Identifier Intelligence (Stage A).
Extracts DOIs, IEEE arnumbers, arXiv IDs, PMIDs, author/year cues,
and builds multi-representation queries for federated discovery.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote


# Standard DOI pattern: 10.NNNN/...
# Matches bare 10.NNNN/... or prefixed by doi:, doi.org/, dx.doi.org/
DOI_PATTERN = re.compile(
    r"(?:https?://(?:dx\.)?doi\.org/|doi\s*[:/]\s*|\b)(10\.\d{4,9}/[^\s\"'<>]+)",
    re.IGNORECASE,
)

# IEEE document ID / arnumber
IEEE_URL_PATTERN = re.compile(
    r"ieeexplore\.ieee\.org/(?:document/|stamp/stamp\.jsp\?(?:[^\"'\s]*&)*arnumber=)(\d{6,10})",
    re.IGNORECASE,
)
IEEE_DIRECT_PATTERN = re.compile(
    r"\b(?:arnumber|ieee(?:\s*id)?)[=:\s]+(\d{6,10})\b",
    re.IGNORECASE,
)

# arXiv identifiers (new style: 2301.12345 or 2301.12345v2, old style: math.PR/0501123)
ARXIV_URL_PATTERN = re.compile(
    r"arxiv\.org/(?:abs|pdf)/([a-z\-]+(?:\.[A-Z]{2})?/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?",
    re.IGNORECASE,
)
ARXIV_PREFIX_PATTERN = re.compile(
    r"(?:^|\s|\b)arxiv\s*[:/]\s*([a-z\-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?|\d{4}\.\d{4,5}(?:v\d+)?)\b",
    re.IGNORECASE,
)
ARXIV_BARE_PATTERN = re.compile(
    r"\b(\d{4}\.\d{4,5}(?:v\d+)?)\b"
)

# PubMed & PMC IDs
PUBMED_URL_PATTERN = re.compile(
    r"pubmed\.ncbi\.nlm\.nih\.gov/(\d{4,9})",
    re.IGNORECASE,
)
PUBMED_PREFIX_PATTERN = re.compile(
    r"\bpmid\s*[:=\s]\s*(\d{4,9})\b",
    re.IGNORECASE,
)
PMC_PATTERN = re.compile(
    r"\b(PMC\d{5,9})\b",
    re.IGNORECASE,
)

# Author + Year patterns (e.g., "Vaswani et al., 2017", "Smith & Jones (2020)", "Bengio 2018")
AUTHOR_YEAR_PATTERN = re.compile(
    r"(?P<authors>[A-Z][a-zA-Z\s\-]+?)\s*(?:et\s+al\.?|and\s+[A-Z][a-zA-Z\-]+|&\s+[A-Z][a-zA-Z\-]+)?\s*[\(\[]?(?P<year>(?:19|20)\d{2})[\)\]]?",
)

YEAR_ONLY_PATTERN = re.compile(r"\b((?:19|20)\d{2})\b")

# Punctuation to trim from ends of extracted IDs
TRAILING_PUNCT = ".,;:!?)'\"}]"


def clean_doi(raw_doi: str) -> str:
    """Normalize a raw DOI: lowercase, strip URL prefixes, remove trailing punctuation."""
    doi = raw_doi.strip()
    # Strip URL prefixes
    doi = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
    doi = re.sub(r"^doi\s*[:/]\s*", "", doi, flags=re.IGNORECASE)
    # Strip common URL encodings
    doi = unquote(doi)
    # Strip trailing punctuation that often attaches to DOIs at the end of sentences
    while doi and doi[-1] in TRAILING_PUNCT:
        # Don't strip closing paren if there is an unmatched opening paren inside
        if doi[-1] == ")" and doi.count("(") > doi.count(")"):
            break
        doi = doi[:-1]
    return doi.strip().lower()


def extract_doi(text: str) -> Optional[str]:
    """Extract and normalize a DOI from text if present."""
    match = DOI_PATTERN.search(text)
    if not match:
        return None
    raw = match.group(1)
    cleaned = clean_doi(raw)
    # Valid DOIs have a prefix 10.NNNN and a suffix after a slash
    if "/" in cleaned and cleaned.startswith("10."):
        return cleaned
    return None


def extract_ieee_id(text: str) -> Optional[str]:
    """Extract IEEE document ID / arnumber from URL or text string."""
    m_url = IEEE_URL_PATTERN.search(text)
    if m_url:
        return m_url.group(1)
    m_dir = IEEE_DIRECT_PATTERN.search(text)
    if m_dir:
        return m_dir.group(1)
    return None


def extract_arxiv_id(text: str) -> Optional[str]:
    """Extract arXiv ID from URL, prefixed string, or bare numeric token if context suggests."""
    m_url = ARXIV_URL_PATTERN.search(text)
    if m_url:
        return m_url.group(1).lower()
    m_prefix = ARXIV_PREFIX_PATTERN.search(text)
    if m_prefix:
        return m_prefix.group(1).lower()
    # Only match bare ID if the query is very short (looks like an ID query)
    stripped = text.strip()
    m_bare = ARXIV_BARE_PATTERN.fullmatch(stripped)
    if m_bare:
        return m_bare.group(1).lower()
    return None


def extract_pmid_pmcid(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract PMID and PMCID from URL or prefix."""
    pmid = None
    pmc = None

    m_pmid_url = PUBMED_URL_PATTERN.search(text)
    if m_pmid_url:
        pmid = m_pmid_url.group(1)
    else:
        m_pmid_pref = PUBMED_PREFIX_PATTERN.search(text)
        if m_pmid_pref:
            pmid = m_pmid_pref.group(1)

    m_pmc = PMC_PATTERN.search(text)
    if m_pmc:
        pmc = m_pmc.group(1).upper()

    return pmid, pmc


@dataclass
class QueryIdentity:
    """Structured representation of query intelligence and extracted identifiers."""
    raw_query: str
    detected_type: str  # 'doi', 'ieee_id', 'arxiv_id', 'pmid', 'pmcid', 'freeform', 'author_year_title'
    is_identifier_lookup: bool
    canonical_id: Optional[str] = None
    doi: Optional[str] = None
    ieee_id: Optional[str] = None
    arxiv_id: Optional[str] = None
    pmid: Optional[str] = None
    pmc_id: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    year: Optional[int] = None
    cleaned_title: str = ""
    exact_title_query: str = ""
    keywords: List[str] = field(default_factory=list)
    multi_queries: Dict[str, str] = field(default_factory=dict)


class QueryIntelligence:
    """Analyzes and transforms user queries into multi-representation academic search plans."""

    STOP_WORDS = {
        "the", "and", "for", "with", "from", "that", "this", "what",
        "using", "based", "study", "studies", "about", "into", "over",
        "towards", "toward", "via", "through", "between", "under", "after",
        "during", "before", "an", "a", "in", "on", "at", "by", "to", "of",
        "paper", "article", "journal", "proceedings", "conference", "review",
        "et", "al",
    }

    @classmethod
    def extract_keywords(cls, text: str) -> List[str]:
        """Extract meaningful keyword tokens, preserving hyphenated terms and alphanumeric models."""
        tokens = re.findall(r"\b[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*\b", text)
        result = []
        for t in tokens:
            tl = t.lower()
            if tl not in cls.STOP_WORDS and len(tl) >= 2:
                result.append(tl)
        return result

    @classmethod
    def parse(
        cls,
        raw_query: str,
        hint_author: Optional[str] = None,
        hint_year: Optional[int] = None,
    ) -> QueryIdentity:
        """
        Parse freeform user query, extract all identifiers, authors, years, and
        generate multi-representation queries.
        """
        text = raw_query.strip()
        doi = extract_doi(text)
        ieee_id = extract_ieee_id(text)
        arxiv_id = extract_arxiv_id(text)
        pmid, pmc_id = extract_pmid_pmcid(text)

        # Identifier lookup determination
        detected_type = "freeform"
        canonical_id: Optional[str] = None
        is_identifier = False

        if doi:
            detected_type = "doi"
            canonical_id = doi
            is_identifier = True
        elif ieee_id and ("ieeexplore" in text.lower() or text.strip().isdigit() or "arnumber" in text.lower() or "ieee" in text.lower()):
            detected_type = "ieee_id"
            canonical_id = ieee_id
            is_identifier = True
        elif arxiv_id and ("arxiv" in text.lower() or re.fullmatch(r"\d{4}\.\d{4,5}(?:v\d+)?", text.strip())):
            detected_type = "arxiv_id"
            canonical_id = arxiv_id
            is_identifier = True
        elif pmid and ("pubmed" in text.lower() or "pmid" in text.lower()):
            detected_type = "pmid"
            canonical_id = pmid
            is_identifier = True
        elif pmc_id and ("pmc" in text.lower()):
            detected_type = "pmcid"
            canonical_id = pmc_id
            is_identifier = True

        # Extract authors and year from query if not provided as explicit hints
        authors: List[str] = []
        year: Optional[int] = hint_year

        if hint_author:
            authors.append(hint_author.strip())

        cleaned_text = text
        # If text is primarily an identifier URL, strip it for text representations
        if is_identifier:
            # If text had surrounding title or words, keep those; otherwise title is empty
            cleaned_text = re.sub(r"https?://\S+", "", cleaned_text).strip()
            if doi:
                cleaned_text = re.sub(re.escape(doi), "", cleaned_text, flags=re.IGNORECASE).strip()
            if ieee_id:
                cleaned_text = re.sub(re.escape(ieee_id), "", cleaned_text, flags=re.IGNORECASE).strip()

        # Check for author + year pattern in text if title-like
        if not is_identifier or len(cleaned_text) > 15:
            m_ay = AUTHOR_YEAR_PATTERN.search(cleaned_text)
            if m_ay and not hint_author:
                cand_author = m_ay.group("authors").strip()
                # Ensure cand_author is not just stopwords or common nouns
                if len(cand_author.split()) <= 3 and cand_author.lower() not in cls.STOP_WORDS:
                    if not authors:
                        authors.append(cand_author)
                    if year is None:
                        try:
                            year = int(m_ay.group("year"))
                        except (ValueError, TypeError):
                            pass
                    # Remove author+year span from cleaned title
                    cleaned_text = (
                        cleaned_text[: m_ay.start()] + " " + cleaned_text[m_ay.end() :]
                    ).strip()

        if year is None and not is_identifier:
            m_yr = YEAR_ONLY_PATTERN.search(cleaned_text)
            if m_yr:
                try:
                    y_val = int(m_yr.group(1))
                    if 1950 <= y_val <= 2035:
                        year = y_val
                except (ValueError, TypeError):
                    pass

        # Clean title: normalize spaces and remove residual quotes
        cleaned_title = re.sub(r"\s+", " ", cleaned_text).strip()
        cleaned_title = cleaned_title.strip("\"'` ")

        keywords = cls.extract_keywords(cleaned_title if cleaned_title else raw_query)

        # Multi-representation query generation
        exact_title_query = f'"{cleaned_title}"' if cleaned_title else ""
        keyword_query = " ".join(keywords)

        multi_queries: Dict[str, str] = {
            "raw": raw_query,
            "title_exact": exact_title_query,
            "keywords": keyword_query,
        }

        if authors and year:
            multi_queries["author_year"] = f"{authors[0]} {year} {keyword_query}".strip()
        elif authors:
            multi_queries["author"] = f"{authors[0]} {keyword_query}".strip()

        if detected_type == "freeform" and authors and year:
            detected_type = "author_year_title"

        return QueryIdentity(
            raw_query=raw_query,
            detected_type=detected_type,
            is_identifier_lookup=is_identifier,
            canonical_id=canonical_id,
            doi=doi,
            ieee_id=ieee_id,
            arxiv_id=arxiv_id,
            pmid=pmid,
            pmc_id=pmc_id,
            authors=authors,
            year=year,
            cleaned_title=cleaned_title,
            exact_title_query=exact_title_query,
            keywords=keywords,
            multi_queries=multi_queries,
        )
