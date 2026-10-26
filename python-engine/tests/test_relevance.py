import pytest
from paper_scraper.relevance import RelevanceScorer, tokenize


def test_tokenize():
    tokens = tokenize("Attention Is All You Need (2017)")
    assert "attention" in tokens
    assert "need" in tokens
    assert "2017" in tokens


def test_relevance_scorer_exact_phrase():
    scorer = RelevanceScorer()
    score, explanation = scorer.score(
        query="Attention Is All You Need",
        title="Attention Is All You Need For Scholarly Document Summarization",
        abstract="We use transformers for summarization.",
        authors=["Vaswani"],
        publication_year=2024,
        has_pdf=True,
    )
    assert score >= 0.70
    assert explanation["exact_phrase_match"] is True
    assert explanation["title_coverage"] == 1.0


def test_relevance_scorer_partial_match():
    scorer = RelevanceScorer()
    score, explanation = scorer.score(
        query="quantum computing cryptography",
        title="Deep Learning for Graph Neural Networks in Biology",
        abstract="Graph representations for molecules.",
        authors=["Smith"],
        publication_year=2023,
        has_pdf=False,
    )
    # Zero term overlap in title or abstract
    assert score <= 0.30
    assert explanation["title_coverage"] == 0.0
    assert explanation["exact_phrase_match"] is False


def test_relevance_scorer_author_match():
    scorer = RelevanceScorer()
    score_with_author, exp_with_author = scorer.score(
        query="Vaswani transformer",
        title="Transformer models in NLP",
        abstract="Study of multi-head attention.",
        authors=["Ashish Vaswani", "Noam Shazeer"],
        has_pdf=True,
    )
    assert exp_with_author["author_matched"] is True
    assert score_with_author >= 0.60
