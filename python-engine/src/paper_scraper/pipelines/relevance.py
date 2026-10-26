"""
Relevance Scoring Pipeline.
Computes query-to-paper relevance scores and explanations for ranked result presentation.
"""

from __future__ import annotations

from paper_scraper.models import PaperResult
from paper_scraper.ranking.relevance import RelevanceScorer


class RelevancePipeline:
    """Scores paper relevance relative to the spider search query."""

    def __init__(self) -> None:
        self.scorer = RelevanceScorer()

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_item(self, item: PaperResult, spider) -> PaperResult:
        query = getattr(spider, "query", "")
        year_start = getattr(spider, "year_start", None)
        year_end = getattr(spider, "year_end", None)

        score, explanation = self.scorer.score(
            query=query,
            title=item.title,
            abstract=item.abstract,
            authors=item.authors,
            publication_year=item.publication_year,
            has_pdf=item.pdf_url is not None,
            metadata_confidence=item.metadata_confidence,
            year_start=year_start,
            year_end=year_end,
        )

        item.relevance_score = score
        item.relevance_explanation = explanation

        return item
