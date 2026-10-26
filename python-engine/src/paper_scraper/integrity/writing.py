"""
Academic Writing Assistant Engine.
Provides transparent writing improvements, inline diffs, and strict preservation
of scientific numbers, units, citations, equations, and epistemic uncertainty.
CRITICAL PRINCIPLE: Never marketed as an AI detection evasion tool.
"""

from __future__ import annotations

import difflib
import json
import re
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field


# Patterns for protected scientific tokens
REGEX_NUMBERS = re.compile(r"\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b")
REGEX_UNITS = re.compile(r"\b(?:mg|kg|g|ml|μl|l|nm|μm|mm|cm|m|km|ms|s|min|h|GHz|MHz|kHz|Hz|kDa|Da|mol|mmol|μmol|%|°C|K|eV|mV|V)\b", re.IGNORECASE)
REGEX_CITATIONS = re.compile(r"\[\d+(?:[,\s–-]+\d+)*\]|\([A-Z][A-Za-z\s]+(?:et al\.)?,\s*\d{4}[a-z]?\)")
REGEX_DOIS = re.compile(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+")
REGEX_EQUATIONS = re.compile(r"\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\begin\{equation\}[\s\S]*?\\end\{equation\}")
REGEX_HEDGING = re.compile(r"\b(?:suggests|indicates|may|might|could|potential|correlated|associated|preliminary)\b", re.IGNORECASE)
REGEX_CAUSAL = re.compile(r"\b(?:proves|definitively shows|causes|irrefutable|certainly)\b", re.IGNORECASE)


class TokenPreservationReport(BaseModel):
    numbers_ok: bool
    citations_ok: bool
    equations_ok: bool
    dois_ok: bool
    units_ok: bool
    missing_numbers: List[str] = Field(default_factory=list)
    missing_citations: List[str] = Field(default_factory=list)
    missing_equations: List[str] = Field(default_factory=list)
    missing_dois: List[str] = Field(default_factory=list)
    missing_units: List[str] = Field(default_factory=list)
    meaning_risk_flags: List[str] = Field(default_factory=list)


class DiffChunk(BaseModel):
    operation: str  # "equal", "insert", "delete"
    text: str


class DiffSummary(BaseModel):
    additions_count: int
    deletions_count: int
    modifications_count: int
    diff_chunks: List[DiffChunk] = Field(default_factory=list)


class WritingRevisionResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    revision_number: int
    action_type: str
    original_text: str
    revised_text: str
    diff_summary: DiffSummary
    token_preservation: TokenPreservationReport
    is_accepted: bool = False


def extract_protected_tokens(text: str) -> Dict[str, Set[str]]:
    """Extract sets of protected tokens from text."""
    numbers = set(REGEX_NUMBERS.findall(text))
    units = set(REGEX_UNITS.findall(text))
    citations = set(REGEX_CITATIONS.findall(text))
    dois = set(REGEX_DOIS.findall(text))
    equations = set(REGEX_EQUATIONS.findall(text))

    return {
        "numbers": numbers,
        "units": units,
        "citations": citations,
        "dois": dois,
        "equations": equations,
    }


def validate_preservation(original: str, revised: str) -> TokenPreservationReport:
    """Validate that all protected scientific entities from original are retained in revised."""
    orig_tokens = extract_protected_tokens(original)
    rev_tokens = extract_protected_tokens(revised)

    missing_numbers = sorted(list(orig_tokens["numbers"] - rev_tokens["numbers"]))
    missing_citations = sorted(list(orig_tokens["citations"] - rev_tokens["citations"]))
    missing_equations = sorted(list(orig_tokens["equations"] - rev_tokens["equations"]))
    missing_dois = sorted(list(orig_tokens["dois"] - rev_tokens["dois"]))
    missing_units = sorted(list(orig_tokens["units"] - rev_tokens["units"]))

    risk_flags: List[str] = []
    if missing_numbers:
        risk_flags.append(f"Missing numerical values in revision: {', '.join(missing_numbers[:3])}")
    if missing_citations:
        risk_flags.append(f"Missing citation references in revision: {', '.join(missing_citations[:3])}")
    if missing_equations:
        risk_flags.append(f"Missing math equation formulas in revision ({len(missing_equations)} dropped)")
    if missing_dois:
        risk_flags.append(f"Missing DOI identifiers in revision: {', '.join(missing_dois[:2])}")
    
    # Check for epistemic drift (turning scientific hedging into unhedged causal claims)
    orig_had_hedging = bool(REGEX_HEDGING.search(original))
    rev_has_causal = bool(REGEX_CAUSAL.search(revised))
    if orig_had_hedging and rev_has_causal and not REGEX_CAUSAL.search(original):
        risk_flags.append("Epistemic drift detected: Nuanced scientific hedging was replaced with definitive causal assertion.")

    return TokenPreservationReport(
        numbers_ok=len(missing_numbers) == 0,
        citations_ok=len(missing_citations) == 0,
        equations_ok=len(missing_equations) == 0,
        dois_ok=len(missing_dois) == 0,
        units_ok=len(missing_units) == 0,
        missing_numbers=missing_numbers,
        missing_citations=missing_citations,
        missing_equations=missing_equations,
        missing_dois=missing_dois,
        missing_units=missing_units,
        meaning_risk_flags=risk_flags,
    )


def compute_word_diff(original: str, revised: str) -> DiffSummary:
    """Compute token-level diff chunks between original and revised text."""
    matcher = difflib.SequenceMatcher(None, original.splitlines(keepends=True), revised.splitlines(keepends=True))
    chunks: List[DiffChunk] = []
    adds = 0
    dels = 0
    mods = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        orig_slice = "".join(original.splitlines(keepends=True)[i1:i2])
        rev_slice = "".join(revised.splitlines(keepends=True)[j1:j2])

        if tag == "equal":
            chunks.append(DiffChunk(operation="equal", text=orig_slice))
        elif tag == "replace":
            chunks.append(DiffChunk(operation="delete", text=orig_slice))
            chunks.append(DiffChunk(operation="insert", text=rev_slice))
            mods += 1
            adds += len(rev_slice.split())
            dels += len(orig_slice.split())
        elif tag == "delete":
            chunks.append(DiffChunk(operation="delete", text=orig_slice))
            dels += len(orig_slice.split())
        elif tag == "insert":
            chunks.append(DiffChunk(operation="insert", text=rev_slice))
            adds += len(rev_slice.split())

    return DiffSummary(
        additions_count=adds,
        deletions_count=dels,
        modifications_count=mods,
        diff_chunks=chunks,
    )


# Academic transformation heuristics for rule-based local mode
TRANSFORMATION_RULES = {
    "academic_tone": [
        (r"\ba lot of\b", "substantial quantities of"),
        (r"\bget rid of\b", "eliminate"),
        (r"\blook into\b", "investigate"),
        (r"\bfind out\b", "determine"),
        (r"\bbig\b", "significant"),
        (r"\bshows that\b", "demonstrates that"),
        (r"\bgood\b", "favorable"),
        (r"\bbad\b", "detrimental"),
        (r"\bdid\b", "conducted"),
    ],
    "concise": [
        (r"\bin order to\b", "to"),
        (r"\bdue to the fact that\b", "because"),
        (r"\bat the present moment\b", "currently"),
        (r"\ba majority of\b", "most"),
        (r"\bhas the capability of\b", "can"),
        (r"\bit is important to note that\b", "notably,"),
    ],
    "transitions": [
        (r"\bAlso,\b", "Furthermore,"),
        (r"\bSo,\b", "Consequently,"),
        (r"\bBut\b", "However,"),
        (r"\bAnd then\b", "Subsequently,"),
    ],
}


def apply_local_transformation(original: str, action_type: str) -> str:
    """
    Apply rule-based local academic transformations while strictly preserving protected tokens.
    """
    revised = original

    if action_type in TRANSFORMATION_RULES:
        for pattern, replacement in TRANSFORMATION_RULES[action_type]:
            revised = re.sub(pattern, replacement, revised, flags=re.IGNORECASE)
    elif action_type == "grammar":
        # Fix common punctuation and spacing artifacts
        revised = re.sub(r"\s+([,.:;?!])", r"\1", revised)
        revised = re.sub(r"([.?!])([A-Z])", r"\1 \2", revised)
    elif action_type == "clarity":
        # Simplify convoluted phrasing while retaining technical tokens
        for pattern, replacement in TRANSFORMATION_RULES.get("concise", []):
            revised = re.sub(pattern, replacement, revised, flags=re.IGNORECASE)
        for pattern, replacement in TRANSFORMATION_RULES.get("academic_tone", []):
            revised = re.sub(pattern, replacement, revised, flags=re.IGNORECASE)
    
    return revised


def generate_revision(
    session_id: str,
    revision_number: int,
    original_text: str,
    action_type: str,
    custom_revised_text: Optional[str] = None,
) -> WritingRevisionResult:
    """
    Generate an academic revision, compute token preservation metrics, and generate diff.
    """
    if custom_revised_text is not None:
        revised = custom_revised_text
    else:
        revised = apply_local_transformation(original_text, action_type)

    token_report = validate_preservation(original_text, revised)
    diff = compute_word_diff(original_text, revised)

    return WritingRevisionResult(
        session_id=session_id,
        revision_number=revision_number,
        action_type=action_type,
        original_text=original_text,
        revised_text=revised,
        diff_summary=diff,
        token_preservation=token_report,
        is_accepted=False,
    )
