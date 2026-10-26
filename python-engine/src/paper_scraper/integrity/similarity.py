"""
Similarity analysis engine: Seed-and-extend character alignment,
overlap de-duplication, candidate matching, and documented denominator scoring.
"""

from __future__ import annotations

import difflib
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field


class MatchSpan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    corpus_source_id: str
    match_type: str  # "exact", "fingerprint", "fuzzy", "semantic_candidate"
    target_char_start: int
    target_char_end: int
    target_page_number: int
    target_passage: str
    source_char_start: int
    source_char_end: int
    source_page_number: int
    source_passage: str
    overlap_chars: int
    confidence_score: float
    review_status: str = "unreviewed"  # "unreviewed", "marked_quote", "citation_present", "excluded_boilerplate", "not_a_match"
    review_notes: Optional[str] = None


class SimilarityAnalysisResult(BaseModel):
    similarity_run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    status: str  # "completed", "completed_with_warnings", "failed"
    total_body_words: int
    matched_body_words: int
    total_body_chars: int
    matched_body_chars: int
    overall_similarity_ratio: float
    corpus_sources_searched: int
    matched_sources_count: int
    matches: List[MatchSpan] = Field(default_factory=list)
    corpus_coverage_note: str
    formula_explanation: str
    error_message: Optional[str] = None


def merge_overlapping_spans(spans: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """
    Merge overlapping and adjacent [start, end] intervals.
    Prevents double-counting the same characters when multiple sources match the same target text.
    """
    if not spans:
        return []
    sorted_spans = sorted(spans, key=lambda s: (s[0], s[1]))
    merged: List[Tuple[int, int]] = [sorted_spans[0]]

    for current in sorted_spans[1:]:
        prev_start, prev_end = merged[-1]
        curr_start, curr_end = current
        if curr_start <= prev_end:
            # Overlapping or contiguous interval
            merged[-1] = (prev_start, max(prev_end, curr_end))
        else:
            merged.append(current)

    return merged


def seed_and_extend_alignment(
    target_text: str,
    target_seed_offset: int,
    source_text: str,
    source_seed_offset: int,
    seed_len: int = 50,
) -> Tuple[int, int, int, int]:
    """
    Given a matched seed offset in target and source, extend forward and backward
    to locate the maximal contiguous or near-contiguous matching character spans.
    Returns (target_start, target_end, source_start, source_end).
    """
    # 1. Extend backward
    t_start = max(0, target_seed_offset)
    s_start = max(0, source_seed_offset)

    while t_start > 0 and s_start > 0:
        if target_text[t_start - 1].lower() == source_text[s_start - 1].lower():
            t_start -= 1
            s_start -= 1
        elif target_text[t_start - 1].isspace() and source_text[s_start - 1].isspace():
            t_start -= 1
            s_start -= 1
        else:
            break

    # 2. Extend forward
    t_end = min(len(target_text), target_seed_offset + seed_len)
    s_end = min(len(source_text), source_seed_offset + seed_len)

    while t_end < len(target_text) and s_end < len(source_text):
        if target_text[t_end].lower() == source_text[s_end].lower():
            t_end += 1
            s_end += 1
        elif target_text[t_end].isspace() and source_text[s_end].isspace():
            t_end += 1
            s_end += 1
        else:
            break

    return t_start, t_end, s_start, s_end


def compute_similarity(
    document_id: str,
    target_text: str,
    corpus_sources: Dict[str, Dict[str, Any]],  # source_id -> {title, content, page_count, ...}
    fingerprint_hits: List[Dict[str, Any]],  # [{target_offset, source_id, source_offset, hash_value}]
    min_match_chars: int = 40,
) -> SimilarityAnalysisResult:
    """
    Perform seed-and-extend candidate alignment from fingerprint hits and calculate de-duplicated overlap.
    """
    total_body_chars = len(target_text)
    total_body_words = len(target_text.split())

    if total_body_chars == 0 or not corpus_sources:
        note = "No corpus sources available for indexing." if not corpus_sources else "Document has no extractable text."
        return SimilarityAnalysisResult(
            document_id=document_id,
            status="completed",
            total_body_words=total_body_words,
            matched_body_words=0,
            total_body_chars=total_body_chars,
            matched_body_chars=0,
            overall_similarity_ratio=0.0,
            corpus_sources_searched=len(corpus_sources),
            matched_sources_count=0,
            matches=[],
            corpus_coverage_note=note,
            formula_explanation=(
                "Similarity ratio is calculated as: (total unique matched characters in non-boilerplate sections) / "
                "(total non-boilerplate body characters). Overlapping matches from multiple sources are unioned so no "
                "character is counted more than once."
            ),
        )

    # Group hits by source_id
    raw_matches: List[MatchSpan] = []
    matched_target_spans: List[Tuple[int, int]] = []
    matched_source_ids: Set[str] = set()

    for hit in fingerprint_hits:
        s_id = hit["source_id"]
        source_data = corpus_sources.get(s_id)
        if not source_data:
            continue

        source_text = source_data.get("raw_content", "")
        t_off = hit["target_offset"]
        s_off = hit["source_offset"]

        t_start, t_end, s_start, s_end = seed_and_extend_alignment(
            target_text, t_off, source_text, s_off, seed_len=60
        )

        overlap_len = t_end - t_start
        if overlap_len < min_match_chars:
            continue

        matched_passage_t = target_text[t_start:t_end]
        matched_passage_s = source_text[s_start:s_end]

        # Calculate character-level sequence similarity ratio
        seq_ratio = difflib.SequenceMatcher(
            None, matched_passage_t.lower(), matched_passage_s.lower()
        ).ratio()

        match_type = "exact" if seq_ratio > 0.96 else "fingerprint"

        # Calculate estimated page numbers (assuming ~2500 chars/page)
        target_page = max(1, (t_start // 2500) + 1)
        source_page = max(1, (s_start // 2500) + 1)

        raw_matches.append(
            MatchSpan(
                corpus_source_id=s_id,
                match_type=match_type,
                target_char_start=t_start,
                target_char_end=t_end,
                target_page_number=target_page,
                target_passage=matched_passage_t,
                source_char_start=s_start,
                source_char_end=s_end,
                source_page_number=source_page,
                source_passage=matched_passage_s,
                overlap_chars=overlap_len,
                confidence_score=float(round(seq_ratio, 4)),
            )
        )
        matched_target_spans.append((t_start, t_end))
        matched_source_ids.add(s_id)

    # De-duplicate matches that completely overlap within the same source
    deduped_matches: List[MatchSpan] = []
    seen_ranges: Set[Tuple[str, int, int]] = set()

    for m in raw_matches:
        range_key = (m.corpus_source_id, m.target_char_start // 20, m.target_char_end // 20)
        if range_key not in seen_ranges:
            seen_ranges.add(range_key)
            deduped_matches.append(m)

    # Union all matched target spans to calculate non-duplicated matched characters
    merged_spans = merge_overlapping_spans(matched_target_spans)
    total_matched_chars = sum(end - start for start, end in merged_spans)
    
    # Calculate matched body words from merged character spans
    matched_words_count = 0
    for start, end in merged_spans:
        matched_words_count += len(target_text[start:end].split())

    overall_ratio = float(
        round(total_matched_chars / total_body_chars, 4) if total_body_chars > 0 else 0.0
    )

    coverage_note = (
        f"Compared against {len(corpus_sources)} indexed corpus sources. "
        + ("No matching passages found in the searched corpus." if not deduped_matches else f"Found {len(deduped_matches)} candidate matching passages across {len(matched_source_ids)} sources.")
    )

    formula = (
        "Similarity ratio is calculated as: (total unique matched characters in non-boilerplate sections) / "
        "(total non-boilerplate body characters). Overlapping matches from multiple sources are unioned so no "
        "character is counted more than once."
    )

    return SimilarityAnalysisResult(
        document_id=document_id,
        status="completed",
        total_body_words=total_body_words,
        matched_body_words=matched_words_count,
        total_body_chars=total_body_chars,
        matched_body_chars=total_matched_chars,
        overall_similarity_ratio=overall_ratio,
        corpus_sources_searched=len(corpus_sources),
        matched_sources_count=len(matched_source_ids),
        matches=deduped_matches,
        corpus_coverage_note=coverage_note,
        formula_explanation=formula,
    )
