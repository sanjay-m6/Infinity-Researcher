import pytest
from paper_scraper.dedup import (
    Deduplicator,
    extract_first_author_surname,
    normalize_doi,
    normalize_title,
)
from paper_scraper.models import PaperResult


def test_normalize_doi():
    assert normalize_doi("https://doi.org/10.1038/s41586-020-2649-2") == "10.1038/s41586-020-2649-2"
    assert normalize_doi("http://dx.doi.org/10.1145/3372278.3390670") == "10.1145/3372278.3390670"
    assert normalize_doi("doi: 10.1101/2024.01.01.123456 ") == "10.1101/2024.01.01.123456"
    assert normalize_doi(None) is None


def test_normalize_title():
    assert normalize_title("Attention Is All You Need!") == "attention is all you need"
    assert normalize_title("Deep Learning: A Survey (2024)") == "deep learning a survey 2024"


def test_dedup_exact_doi():
    dedup = Deduplicator()
    p1 = PaperResult(
        paper_id="paper_1",
        title="Attention Is All You Need",
        doi="10.1145/123456",
        source_id="arxiv",
        source_name="arXiv",
        source_page_url="https://arxiv.org",
        landing_page_url="https://arxiv.org/abs/1706.03762",
    )
    is_dup1, _, _, _ = dedup.check_and_register(p1)
    assert is_dup1 is False

    # Second paper with same DOI from different source
    p2 = PaperResult(
        paper_id="paper_2",
        title="Attention Is All You Need (Reprint)",
        doi="https://doi.org/10.1145/123456",
        source_id="biorxiv",
        source_name="bioRxiv",
        source_page_url="https://biorxiv.org",
        landing_page_url="https://biorxiv.org/content/123456",
    )
    is_dup2, matched_id, conf, reason = dedup.check_and_register(p2)
    assert is_dup2 is True
    assert matched_id == "paper_1"
    assert conf == 1.0


def test_dedup_fuzzy_title():
    dedup = Deduplicator()
    p1 = PaperResult(
        paper_id="paper_a",
        title="Large Language Models in Healthcare: A Comprehensive Systematic Review",
        authors=["John Smith", "David Lee"],
        publication_year=2024,
        source_id="pubmed",
        source_name="PubMed",
        source_page_url="https://pubmed.ncbi.nlm.nih.gov",
        landing_page_url="https://pubmed.ncbi.nlm.nih.gov/123/",
    )
    dedup.check_and_register(p1)

    # Slight variation in title (punctuation, subtitle order)
    p2 = PaperResult(
        paper_id="paper_b",
        title="Large Language Models in Healthcare - A Comprehensive Systematic Review",
        authors=["Smith, J.", "Lee, D."],
        publication_year=2024,
        source_id="arxiv",
        source_name="arXiv",
        source_page_url="https://arxiv.org",
        landing_page_url="https://arxiv.org/abs/2401.99999",
    )
    is_dup, matched_id, conf, reason = dedup.check_and_register(p2)
    assert is_dup is True
    assert matched_id == "paper_a"
    assert conf >= 0.90
