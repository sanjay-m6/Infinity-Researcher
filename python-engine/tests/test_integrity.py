"""
Unit and integration tests for the Python Integrity & Academic Writing Engine.
"""

import pytest
from paper_scraper.integrity.ingest import (
    ingest_document,
    extract_latex_text,
    extract_docx_text,
    classify_segment,
)
from paper_scraper.integrity.fingerprint import (
    generate_winnowing_fingerprints,
    tokenize_with_offsets,
)
from paper_scraper.integrity.similarity import (
    compute_similarity,
    merge_overlapping_spans,
    seed_and_extend_alignment,
)
from paper_scraper.integrity.ai_signal import (
    StatisticalBaselineOriginModel,
    UNCERTAINTY_DISCLOSURE,
)
from paper_scraper.integrity.writing import (
    generate_revision,
    validate_preservation,
    compute_word_diff,
)
from paper_scraper.integrity.cli import handle_integrity_request


def test_document_ingestion_and_segmentation():
    sample_text = (
        "Abstract\n\n"
        "In this paper, we explore novel architectures for fault-tolerant quantum error correction.\n\n"
        "Methodology\n\n"
        "We construct a distance-5 surface code layout with 49 physical data and ancilla qubits [1]. \n"
        "The dilution refrigerator operates at 10 mK temperature with crosstalk suppression.\n\n"
        "References\n\n"
        "[1] Fowler et al., Surface codes: Towards practical large-scale quantum computation, 2012."
    )
    result = ingest_document(content=sample_text, file_name="quantum_draft.txt", file_format="txt")

    assert result.word_count > 30
    assert result.page_count >= 1
    assert len(result.segments) >= 3

    # Check segment classifications
    types = [s.segment_type for s in result.segments]
    assert "abstract" in types or "section_heading" in types
    assert "section_heading" in types
    assert "references" in types



def test_latex_text_extraction():
    latex = (
        r"\documentclass{article}" "\n"
        r"\begin{document}" "\n"
        r"% Pure comment line that should be discarded" "\n"
        r"\section{Introduction}" "\n"
        r"This is an \textbf{important} study on quantum state tomography with $E=mc^2$." "\n"
        r"\end{document}"
    )
    extracted, meta = extract_latex_text(latex)
    assert "important study on quantum state tomography with $E=mc^2$" in extracted
    assert "% Pure comment" not in extracted


def test_winnowing_fingerprints_deterministic():
    text = (
        "Machine learning models trained on large academic corpuses often exhibit distinct "
        "syntactic regularities and reduced lexical burstiness compared to human researchers."
    )
    fps1 = generate_winnowing_fingerprints(text, k=8, w=3)
    fps2 = generate_winnowing_fingerprints(text, k=8, w=3)

    assert len(fps1) > 0
    assert fps1 == fps2
    for h, offset in fps1:
        assert isinstance(h, int)
        assert 0 <= offset < len(text)


def test_similarity_seed_and_extend_and_deduplication():
    source_passage = "We evaluate 128-layer deep neural networks trained with stochastic gradient descent [2]."
    target_doc = (
        "In our preliminary experiments, we evaluate 128-layer deep neural networks "
        "trained with stochastic gradient descent [2]. Subsequent trials verified convergence."
    )

    s_fps = dict(generate_winnowing_fingerprints(source_passage, k=6, w=2))
    t_fps = generate_winnowing_fingerprints(target_doc, k=6, w=2)

    hits = []
    for h, t_off in t_fps:
        if h in s_fps:
            hits.append({
                "target_offset": t_off,
                "source_id": "src_paper_1",
                "source_offset": s_fps[h],
                "hash_value": h,
            })

    sim_res = compute_similarity(
        document_id="target_doc_id",
        target_text=target_doc,
        corpus_sources={"src_paper_1": {"raw_content": source_passage, "title": "DNN Training Paper"}},
        fingerprint_hits=hits,
        min_match_chars=25,
    )

    assert sim_res.status == "completed"
    assert len(sim_res.matches) >= 1
    assert sim_res.matches[0].match_type in ["exact", "fingerprint"]
    assert sim_res.overall_similarity_ratio > 0.40
    assert "Compared against" in sim_res.corpus_coverage_note or "Searched" in sim_res.corpus_coverage_note



def test_merge_overlapping_spans_logic():
    spans = [(0, 30), (25, 60), (100, 150), (140, 200)]
    merged = merge_overlapping_spans(spans)
    assert merged == [(0, 60), (100, 200)]


def test_ai_writing_signal_insufficient_text_and_baseline():
    model = StatisticalBaselineOriginModel()

    # 1. Short text (< 80 words)
    short_paragraphs = [{"normalized_text": "A brief summary of findings.", "segment_index": 0}]
    short_res = model.analyze("doc_short", short_paragraphs)
    assert short_res.status == "insufficient_text"
    assert short_res.signal_classification == "insufficient_text"
    assert "fewer than the required 80 words" in short_res.uncertainty_caveat

    # 2. Substantial text (> 80 words)
    long_academic_text = (
        "In this investigation, we synthesize a multi-layer microwave resonator network designed for dispersive readout. "
        "By controlling Josephson junction inductance and shunt capacitance, we systematically evaluate single-qubit relaxation times. "
        "The observed T1 lifetimes average 85 microseconds across four independent fabrication cycles. "
        "Furthermore, randomized benchmarking confirms single-qubit Clifford gate errors below 0.04 percent. "
        "Cross-resonance gate calibration indicates minimal spectator qubit dephasing during simultaneous operation. "
        "These findings confirm that microwave shielding significantly mitigates stray thermal photon occupation in millikelvin cryogenic stages."
    )
    long_paragraphs = [{"normalized_text": long_academic_text, "segment_index": 0}]
    long_res = model.analyze("doc_long", long_paragraphs)

    assert long_res.status == "completed"
    assert long_res.overall_signal_score is not None
    assert long_res.uncertainty_caveat == UNCERTAINTY_DISCLOSURE
    assert len(long_res.segments) == 1


def test_writing_assistant_token_preservation_and_risk_detection():
    original = (
        "The reaction synthesized 25 mg of nanoparticle compound at 300 K with 94.5% yield [3]. "
        "The registered DOI is 10.1021/acs.nano.001. The energy relation satisfies $E = \\hbar \\omega$. "
        "Preliminary data suggests a correlation with catalytic activity."
    )

    # 1. Legitimate academic improvement (numbers and citations intact)
    revised_good = (
        "The catalytic reaction synthesized 25 mg of nanoparticle compound at 300 K with 94.5% yield [3]. "
        "The registered DOI is 10.1021/acs.nano.001. The energy relation satisfies $E = \\hbar \\omega$. "
        "Preliminary empirical observations suggest a potential correlation with catalytic activity."
    )
    report_good = validate_preservation(original, revised_good)
    assert report_good.numbers_ok is True
    assert report_good.citations_ok is True
    assert report_good.dois_ok is True
    assert report_good.equations_ok is True
    assert len(report_good.meaning_risk_flags) == 0

    # 2. Risk detection: dropped citations and epistemic drift
    revised_risky = (
        "The catalytic reaction produced nanoparticles at high yield. "
        "Our work definitively proves catalytic activity."
    )
    report_risky = validate_preservation(original, revised_risky)
    assert report_risky.numbers_ok is False
    assert report_risky.citations_ok is False
    assert report_risky.dois_ok is False
    assert report_risky.equations_ok is False
    assert len(report_risky.meaning_risk_flags) >= 2


def test_writing_assistant_diff_generation():
    orig = "We did a lot of experiments to look into the problem."
    rev = generate_revision("sess_1", 1, orig, "academic_tone")
    assert rev.diff_summary.modifications_count > 0
    assert "substantial quantities of" in rev.revised_text or "investigate" in rev.revised_text


def test_cli_ipc_dispatch():
    res = handle_integrity_request("ingest", {"content": "Sample content for testing.", "file_name": "test.txt"})
    assert "file_hash" in res
    assert res["word_count"] == 4
