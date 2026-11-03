import os
import pytest
from paper_scraper.ai.chunker import chunk_text_content
from paper_scraper.ai.finetuning import evaluate_hardware_capability, prepare_finetuning_dataset
from paper_scraper.ai.signals import compute_statistical_ai_signals, extract_document_file


def test_chunk_text_preserves_page_numbers_and_headings():
    sample_text = (
        "1. Introduction\n"
        "Recent advances in retrieval-augmented generation have enabled dense index lookups "
        "across large-scale research paper libraries. Grounded citations provide transparency."
    )
    chunks = chunk_text_content(
        paper_id="paper_xyz",
        text=sample_text,
        page_number=4,
        section_heading="1. Introduction",
        chunk_size_chars=80,
        overlap_chars=20,
    )

    assert len(chunks) >= 2
    for c in chunks:
        assert c["paper_id"] == "paper_xyz"
        assert c["page_number"] == 4
        assert c["section_heading"] == "1. Introduction"
        assert c["token_count"] > 0
        assert "content_text" in c


def test_hardware_evaluation():
    hw = evaluate_hardware_capability()
    assert "cuda_available" in hw
    assert "total_ram_gb" in hw
    assert "free_disk_gb" in hw
    assert "advice" in hw
    assert hw["total_ram_gb"] > 0
    assert hw["free_disk_gb"] > 0


def test_finetuning_dataset_leakage_prevention():
    # 4 examples from paper A, 3 from paper B, 3 from paper C
    examples = [
        {"instruction": f"Q{i}", "output": f"A{i}", "paper_id": "paper_A"}
        for i in range(4)
    ] + [
        {"instruction": f"Q{i}", "output": f"A{i}", "paper_id": "paper_B"}
        for i in range(4, 7)
    ] + [
        {"instruction": f"Q{i}", "output": f"A{i}", "paper_id": "paper_C"}
        for i in range(7, 10)
    ]

    res = prepare_finetuning_dataset(examples, train_ratio=0.66)
    assert res["validation_passed"] is True
    assert res["total_examples"] == 10
    assert res["leakage_prevented"] is True

    # Ensure no paper in train_set appears in val_set
    train_papers = {item["paper_id"] for item in res["train_sample"]}
    val_papers = {item["paper_id"] for item in res["val_sample"]}
    assert len(train_papers.intersection(val_papers)) == 0


def test_finetuning_dataset_empty():
    res = prepare_finetuning_dataset([])
    assert res["validation_passed"] is False
    assert res["total_examples"] == 0


def _find_fixture(filename: str) -> str:
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "documents", filename),
        os.path.join("fixtures", "documents", filename),
        os.path.join("..", "fixtures", "documents", filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    pytest.skip(f"Fixture {filename} not found in workspace")


def test_extract_document_file_txt():
    path = _find_fixture("synthetic_paper.txt")
    res = extract_document_file(path)
    assert res["file_format"] == "txt"
    assert res["word_count"] > 500
    assert res["char_count"] > 2000
    assert res["is_clean_encoding"] is True
    assert "Scalable Retrieval-Augmented Architectures" in res["raw_text"]
    assert "Table 1: Performance Benchmarks" in res["raw_text"]
    assert "10.1145/" in res["raw_text"]
    assert "[1]" in res["raw_text"]


def test_extract_document_file_docx():
    path = _find_fixture("synthetic_paper.docx")
    res = extract_document_file(path)
    assert res["file_format"] == "docx"
    assert res["word_count"] > 500
    assert res["is_clean_encoding"] is True
    assert "Scalable Retrieval-Augmented Architectures" in res["raw_text"]
    assert "Table 1: Performance Benchmarks" in res["raw_text"]
    assert "10.1145/" in res["raw_text"]
    assert "[1]" in res["raw_text"]


def test_extract_document_file_pdf():
    path = _find_fixture("synthetic_paper.pdf")
    res = extract_document_file(path)
    assert res["file_format"] == "pdf"
    assert res["page_count"] >= 2
    assert res["word_count"] > 500
    assert res["is_clean_encoding"] is True
    assert "Scalable Retrieval-Augmented Architectures" in res["raw_text"]
    assert "Table 1: Performance Benchmarks" in res["raw_text"]
    assert "10.1145/" in res["raw_text"]


def test_extract_document_file_nonexistent():
    with pytest.raises(FileNotFoundError):
        extract_document_file("nonexistent_file_path_12345.pdf")


def test_extract_document_file_invalid_docx(tmp_path):
    bad_docx = tmp_path / "bad.docx"
    bad_docx.write_bytes(b"not a valid zip file")
    with pytest.raises(ValueError, match="not a valid zip archive"):
        extract_document_file(str(bad_docx))


def test_compute_statistical_ai_signals_empty():
    res = compute_statistical_ai_signals("")
    assert res["status"] == "insufficient_text"
    assert res["burstiness"] == 0.0
    assert res["mean_sentence_length"] == 0.0
    assert res["variance"] == 0.0
    assert res["vocabulary_variance"] == 0.0
    assert "insufficient text" in res["uncertainty_caveat"].lower()


def test_compute_statistical_ai_signals_short_text():
    short_text = "This is a single short sentence. Here is another short one."
    res = compute_statistical_ai_signals(short_text)
    assert res["status"] == "insufficient_text"
    assert res["burstiness"] == 0.0
    assert res["variance"] == 0.0
    assert "fewer than 4" in res["uncertainty_caveat"].lower()


def test_compute_statistical_ai_signals_academic_prose():
    path = _find_fixture("synthetic_paper.txt")
    doc = extract_document_file(path)
    res = compute_statistical_ai_signals(doc["raw_text"])

    assert res["status"] == "completed"
    assert res["sentence_count"] >= 15
    assert res["mean_sentence_length"] > 10.0
    assert res["std_dev"] > 0.0
    assert res["variance"] > 0.0
    assert res["burstiness"] > 0.0
    assert 0.0 <= res["lexical_diversity_ttr"] <= 1.0
    assert res["vocabulary_variance"] > 0.0
    assert 0.0 <= res["overall_signal_score"] <= 1.0
    assert res["classification"] in ("low_ai_signal", "mixed_signals", "elevated_ai_signal")
    assert "uncertainty_caveat" in res
    assert "authorship" in res["uncertainty_caveat"].lower()


def test_compute_statistical_ai_signals_uniform_cadence():
    # Synthetic sentences of strictly identical length (12 words each) to test lower burstiness
    uniform_sentences = [
        f"This is synthetic sentence number {i} with exactly twelve distinct words included here."
        for i in range(10)
    ]
    uniform_text = " ".join(uniform_sentences)
    res = compute_statistical_ai_signals(uniform_text)

    assert res["status"] == "completed"
    assert res["sentence_count"] == 10
    assert res["variance"] < 0.1
    assert res["burstiness"] < 0.05
    assert res["mean_sentence_length"] == 13.0
    assert res["vocabulary_variance"] >= 0.0
