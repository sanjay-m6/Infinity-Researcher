import pytest
from paper_scraper.ai.chunker import chunk_text_content
from paper_scraper.ai.finetuning import evaluate_hardware_capability, prepare_finetuning_dataset


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
