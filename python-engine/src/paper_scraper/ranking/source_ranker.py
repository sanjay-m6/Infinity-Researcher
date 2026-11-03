"""
Source Candidate Ranking Engine (IMARE Stage F).
Ranks full-text retrieval candidates using composite scoring:
    S(c) = 0.30M + 0.25R + 0.20A + 0.15I + 0.10V
Applies mandatory rejection rules for invalid or access-restricted candidates.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from rapidfuzz import fuzz

from paper_scraper.discovery.identity import clean_doi


@dataclass
class TargetPaper:
    """Target paper identity against which candidates are ranked."""
    title: str
    doi: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    publication_year: Optional[int] = None
    venue: Optional[str] = None


@dataclass
class SourceCandidate:
    """A candidate PDF source discovered across various repositories/aggregators."""
    candidate_id: str
    source_name: str
    url: str
    doi: Optional[str] = None
    title: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    publication_year: Optional[int] = None
    venue: Optional[str] = None
    access_status: str = "unknown"  # 'verified_oa', 'green_oa', 'bronze_oa', 'unverified', 'restricted', 'paywalled'
    license: Optional[str] = None
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    has_pdf_magic_bytes: Optional[bool] = None
    is_html_login_page: bool = False
    version_type: str = "published"  # 'published', 'accepted', 'preprint', 'unknown'
    provenance: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CandidateRankingResult:
    """Output score breakdown and verdict for a single candidate."""
    candidate: SourceCandidate
    composite_score: float
    metadata_match: float
    source_reliability: float
    access_confidence: float
    pdf_integrity: float
    version_consistency: float
    is_rejected: bool
    rejection_reason: Optional[str] = None
    explanation: Dict[str, Any] = field(default_factory=dict)


class SourceRanker:
    """
    Ranks retrieval candidates using multi-factor composite scoring.
    Formula: S(c) = 0.30M + 0.25R + 0.20A + 0.15I + 0.10V
    """

    # Domain reliability base scores
    DOMAIN_RELIABILITY: Dict[str, float] = {
        "arxiv.org": 0.98,
        "ncbi.nlm.nih.gov": 0.96,
        "pmc": 0.96,
        "europepmc.org": 0.95,
        "unpaywall.org": 0.92,
        "biorxiv.org": 0.92,
        "medrxiv.org": 0.92,
        "journals.plos.org": 0.94,
        "api.semanticscholar.org": 0.90,
        "semanticscholar.org": 0.88,
        "openalex.org": 0.87,
        "core.ac.uk": 0.85,
        "nature.com": 0.85,
        "ieeexplore.ieee.org": 0.85,
        "sciencedirect.com": 0.80,
        "springer.com": 0.80,
        "wiley.com": 0.80,
    }

    def __init__(
        self,
        weight_m: float = 0.30,
        weight_r: float = 0.25,
        weight_a: float = 0.20,
        weight_i: float = 0.15,
        weight_v: float = 0.10,
    ) -> None:
        self.w_m = weight_m
        self.w_r = weight_r
        self.w_a = weight_a
        self.w_i = weight_i
        self.w_v = weight_v

    @staticmethod
    def _extract_surnames(author_list: List[str]) -> set[str]:
        surnames = set()
        for a in author_list:
            parts = re.findall(r"[A-Za-z]+", a)
            if parts:
                surnames.add(parts[-1].lower())
        return surnames

    def evaluate_metadata_match(self, target: TargetPaper, cand: SourceCandidate) -> Tuple[float, Optional[str]]:
        """
        Compute M (Metadata match).
        Returns (score, rejection_reason_if_any).
        """
        # 1. DOI check
        t_doi = clean_doi(target.doi) if target.doi else None
        c_doi = clean_doi(cand.doi) if cand.doi else None

        doi_matched = False
        if t_doi and c_doi:
            if t_doi == c_doi:
                doi_matched = True
            else:
                return 0.0, f"Mismatched DOI: target {t_doi} vs candidate {c_doi}"

        # 2. Title similarity
        title_sim = 1.0
        if cand.title and target.title:
            ratio_tokens = fuzz.token_set_ratio(target.title.lower(), cand.title.lower()) / 100.0
            ratio_sort = fuzz.token_sort_ratio(target.title.lower(), cand.title.lower()) / 100.0
            title_sim = max(ratio_tokens, ratio_sort)

            if title_sim < 0.40 and not doi_matched:
                return 0.0, f"Low title similarity ({title_sim:.2f}) with no matching DOI"

        # 3. Author overlap
        author_score = 0.5
        t_authors = self._extract_surnames(target.authors)
        c_authors = self._extract_surnames(cand.authors)
        if t_authors and c_authors:
            overlap = len(t_authors & c_authors)
            author_score = min(1.0, overlap / max(1, len(t_authors)))

        if doi_matched:
            m_score = 0.50 * 1.0 + 0.35 * title_sim + 0.15 * author_score
        else:
            m_score = 0.70 * title_sim + 0.30 * author_score

        return round(min(1.0, max(0.0, m_score)), 3), None

    def evaluate_source_reliability(self, cand: SourceCandidate) -> float:
        """Compute R (Source reliability) based on domain host and source registry."""
        netloc = urlparse(cand.url).netloc.lower()
        for domain, score in self.DOMAIN_RELIABILITY.items():
            if domain in netloc or domain in cand.source_name.lower():
                return score
        # Institutional repositories typically have .edu, .ac.uk, etc.
        if ".edu" in netloc or ".ac." in netloc or "repo" in netloc:
            return 0.78
        return 0.60

    def evaluate_access_confidence(self, cand: SourceCandidate) -> Tuple[float, Optional[str]]:
        """
        Compute A (Access confidence).
        Returns (score, rejection_reason_if_any).
        """
        status = cand.access_status.lower()
        if status in ("restricted", "paywalled", "closed"):
            return 0.0, "Access restricted or paywalled"

        if status in ("verified_oa", "gold_oa"):
            return 1.0, None
        if "cc" in (cand.license or "").lower():
            return 1.0, None
        if status in ("green_oa", "accepted_manuscript", "preprint"):
            return 0.85, None
        if status in ("bronze_oa", "free_to_read"):
            return 0.75, None
        if status == "unverified":
            return 0.60, None

        return 0.50, None

    def evaluate_pdf_integrity(self, cand: SourceCandidate) -> Tuple[float, Optional[str]]:
        """
        Compute I (PDF integrity).
        Returns (score, rejection_reason_if_any).
        """
        # Rejection: HTML login/challenge page
        if cand.is_html_login_page:
            return 0.0, "Candidate is an HTML login or CAPTCHA challenge page"

        # Rejection: Explicit HTML content type
        if cand.content_type and "text/html" in cand.content_type.lower():
            return 0.0, "Content-Type is text/html, not a PDF document"

        # Signature check
        if cand.has_pdf_magic_bytes is False:
            return 0.0, "Missing %PDF- header magic signature"

        score = 0.65
        if cand.has_pdf_magic_bytes is True:
            score = 1.0

        # Content length checks
        if cand.content_length is not None:
            if cand.content_length < 5_000:
                return 0.1, "Payload suspiciously small (<5KB) for academic PDF"
            elif cand.content_length > 50_000:
                score = max(score, 0.95)

        if cand.content_type and "application/pdf" in cand.content_type.lower():
            score = min(1.0, score + 0.05)

        return round(score, 3), None

    def evaluate_version_consistency(self, target: TargetPaper, cand: SourceCandidate) -> float:
        """Compute V (Version consistency: year alignment and version status)."""
        year_score = 0.8
        if target.publication_year and cand.publication_year:
            diff = abs(target.publication_year - cand.publication_year)
            if diff == 0:
                year_score = 1.0
            elif diff == 1:
                year_score = 0.85
            elif diff == 2:
                year_score = 0.60
            else:
                year_score = 0.30

        version_weights = {
            "published": 1.0,
            "accepted": 0.90,
            "preprint": 0.80,
            "unknown": 0.70,
        }
        v_type_score = version_weights.get(cand.version_type.lower(), 0.70)

        venue_score = 0.8
        if target.venue and cand.venue:
            v_sim = fuzz.token_set_ratio(target.venue.lower(), cand.venue.lower()) / 100.0
            venue_score = max(0.5, v_sim)

        v_score = 0.50 * year_score + 0.35 * v_type_score + 0.15 * venue_score
        return round(min(1.0, max(0.0, v_score)), 3)

    def rank_candidate(self, target: TargetPaper, cand: SourceCandidate) -> CandidateRankingResult:
        """Rank a single candidate against the target paper."""
        # 1. Metadata Match
        m_score, m_rej = self.evaluate_metadata_match(target, cand)
        if m_rej:
            return CandidateRankingResult(
                candidate=cand,
                composite_score=0.0,
                metadata_match=0.0,
                source_reliability=0.0,
                access_confidence=0.0,
                pdf_integrity=0.0,
                version_consistency=0.0,
                is_rejected=True,
                rejection_reason=m_rej,
                explanation={"rejected_at": "metadata_match", "reason": m_rej},
            )

        # 2. Source Reliability
        r_score = self.evaluate_source_reliability(cand)

        # 3. Access Confidence
        a_score, a_rej = self.evaluate_access_confidence(cand)
        if a_rej:
            return CandidateRankingResult(
                candidate=cand,
                composite_score=0.0,
                metadata_match=m_score,
                source_reliability=r_score,
                access_confidence=0.0,
                pdf_integrity=0.0,
                version_consistency=0.0,
                is_rejected=True,
                rejection_reason=a_rej,
                explanation={"rejected_at": "access_confidence", "reason": a_rej},
            )

        # 4. PDF Integrity
        i_score, i_rej = self.evaluate_pdf_integrity(cand)
        if i_rej:
            return CandidateRankingResult(
                candidate=cand,
                composite_score=0.0,
                metadata_match=m_score,
                source_reliability=r_score,
                access_confidence=a_score,
                pdf_integrity=0.0,
                version_consistency=0.0,
                is_rejected=True,
                rejection_reason=i_rej,
                explanation={"rejected_at": "pdf_integrity", "reason": i_rej},
            )

        # 5. Version Consistency
        v_score = self.evaluate_version_consistency(target, cand)

        # Composite score
        composite = (
            self.w_m * m_score
            + self.w_r * r_score
            + self.w_a * a_score
            + self.w_i * i_score
            + self.w_v * v_score
        )
        composite = round(min(1.0, max(0.0, composite)), 4)

        explanation = {
            "metadata_match": m_score,
            "source_reliability": r_score,
            "access_confidence": a_score,
            "pdf_integrity": i_score,
            "version_consistency": v_score,
            "weights": {
                "M": self.w_m,
                "R": self.w_r,
                "A": self.w_a,
                "I": self.w_i,
                "V": self.w_v,
            },
        }

        return CandidateRankingResult(
            candidate=cand,
            composite_score=composite,
            metadata_match=m_score,
            source_reliability=r_score,
            access_confidence=a_score,
            pdf_integrity=i_score,
            version_consistency=v_score,
            is_rejected=False,
            rejection_reason=None,
            explanation=explanation,
        )

    def rank_candidates(
        self,
        target: TargetPaper,
        candidates: List[SourceCandidate],
    ) -> List[CandidateRankingResult]:
        """
        Rank a collection of candidates.
        Returns candidates ordered by composite score descending.
        Rejected candidates appear at the end with score 0.0.
        """
        results = [self.rank_candidate(target, c) for c in candidates]
        # Sort valid first by composite score descending, then rejected
        return sorted(results, key=lambda r: (not r.is_rejected, r.composite_score), reverse=True)
