"""
Backwards-compatibility shim re-exporting from paper_scraper.ranking.relevance.
"""

from paper_scraper.ranking.relevance import RelevanceScorer, tokenize, STOPWORDS

__all__ = ["RelevanceScorer", "tokenize", "STOPWORDS"]
