"""
Data models and schemas for the research paper scraping engine.
Includes paper metadata, search queries, source descriptors, and status types.
"""

from __future__ import annotations

import datetime
import hashlib
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class QueryFilter(BaseModel):
    query: str
    sources: Optional[List[str]] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    content_type: Optional[str] = None
    open_access_only: Optional[bool] = None
    author: Optional[str] = None
    limit_per_source: Optional[int] = Field(default=50, ge=1, le=100)


class ConfidenceBreakdown(BaseModel):
    title: float = 1.0
    authors: float = 0.5
    abstract: float = 0.0
    doi: float = 0.0
    pdf: float = 0.0

    def compute_composite(self) -> float:
        # Title (0.35) + Authors (0.25) + DOI (0.15) + PDF (0.15) + Abstract (0.10)
        score = (
            self.title * 0.35
            + self.authors * 0.25
            + self.doi * 0.15
            + self.pdf * 0.15
            + self.abstract * 0.10
        )
        return round(min(1.0, max(0.0, score)), 2)


class PaperResult(BaseModel):
    paper_id: str
    title: str
    authors: List[str] = Field(default_factory=list)
    abstract: Optional[str] = None
    publication_year: Optional[int] = None
    published_date: Optional[str] = None
    venue: Optional[str] = None
    publisher: Optional[str] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    source_id: str
    source_name: str
    source_page_url: str
    canonical_url: Optional[str] = None
    landing_page_url: str
    pdf_url: Optional[str] = None
    pdf_access_status: str = Field(
        default="unknown",
        description="available, not_found, restricted, unknown, invalid",
    )
    open_access_evidence: Optional[str] = None
    license_text: Optional[str] = None
    document_type: str = "journal_article"  # journal_article, preprint, conference_paper, book_chapter, other
    language: Optional[str] = "en"
    keywords: List[str] = Field(default_factory=list)
    metadata_confidence: float = 0.5
    confidence_breakdown: ConfidenceBreakdown = Field(default_factory=ConfidenceBreakdown)
    discovered_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    affiliations: List[str] = Field(default_factory=list)
    conference: Optional[str] = None
    extraction_method: str = "structured_meta"
    provenance: Dict[str, str] = Field(default_factory=dict)
    validation_status: str = "valid"  # valid, incomplete, flagged
    relevance_score: float = 1.0
    relevance_explanation: Dict[str, Any] = Field(default_factory=dict)
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        cleaned = " ".join(v.split()).strip()
        if not cleaned:
            raise ValueError("Title cannot be empty")
        return cleaned

    @classmethod
    def generate_id(cls, source_id: str, title: str, doi: Optional[str] = None) -> str:
        """Deterministically generate an ID based on DOI or source + normalized title."""
        if doi:
            norm_doi = doi.lower().strip()
            return f"doi_{hashlib.sha256(norm_doi.encode('utf-8')).hexdigest()[:16]}"
        norm_title = "".join(ch for ch in title.lower() if ch.isalnum() or ch.isspace())
        norm_title = " ".join(norm_title.split())
        return f"{source_id}_{hashlib.sha256(norm_title.encode('utf-8')).hexdigest()[:16]}"

    def to_discovered_search_result(self) -> Dict[str, Any]:
        """Convert to the exact format expected by Tauri desktop API and frontend."""
        is_oa = (
            self.open_access_evidence is not None
            or self.pdf_access_status == "available"
            or (self.license_text is not None and "cc" in self.license_text.lower())
        )
        is_preprint = "preprint" in self.document_type.lower()
        peer_rev = False if is_preprint else (True if self.venue else None)

        return {
            "id": self.paper_id,
            "title": self.title,
            "authors": self.authors if self.authors else ["Unknown Author"],
            "publication_date": self.published_date,
            "publication_year": self.publication_year,
            "venue": self.venue,
            "canonical_doi": self.doi,
            "abstract_text": self.abstract,
            "landing_url": self.landing_page_url,
            "pdf_url": self.pdf_url,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "content_type": self.document_type,
            "is_open_access": is_oa,
            "license_name": self.license_text,
            "peer_reviewed": peer_rev,
            "subject_tags": self.keywords,
            "language": self.language or "en",
            "relevance_score": float(self.relevance_score),
            "metadata_confidence": float(self.metadata_confidence),
        }


class SourceSearchStatus(BaseModel):
    source_id: str
    source_name: str
    status: str  # queued, searching, completed, no_results, blocked, rate_limited, unsupported, failed, manual_only, disabled, cancelled
    message: Optional[str] = None
    results_count: int = 0
    elapsed_ms: int = 0


class SourceDescriptor(BaseModel):
    id: str
    name: str
    domain: str
    status: str = "enabled"  # enabled, disabled, manual_only
    policy_url: str
    policy_notes: str
    supports_native_years: bool = False
    request_delay_ms: int = 500
    content_types: List[str] = Field(default_factory=lambda: ["Preprint", "Article"])
    last_health_check: Optional[str] = None
    health_status: str = "healthy"  # healthy, degraded, blocked, offline
    success_rate: float = 1.0
